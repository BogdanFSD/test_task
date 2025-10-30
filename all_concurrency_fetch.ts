

// ===== FILE: tasks/concurrency_fetch/src/concurrencyFetch.ts =====


import { fetchAllWithConcurrency } from "./fetchAllWithConcurrency.js";

async function main() {
  // Demo endpoints with built-in delay (httpstat.us sleeps server-side)
  const urls = [
    "https://httpstat.us/200?sleep=250",
    "https://httpstat.us/200?sleep=50",
    "https://httpstat.us/200?sleep=100",
    "https://httpstat.us/200?sleep=25",
    "https://httpstat.us/200?sleep=150"
  ];

  const max = Number(process.env.MAX_CONCURRENCY ?? 2);
  console.time(`fetchAllWithConcurrency(max=${max})`);
  const responses = await fetchAllWithConcurrency(urls, max);
  const statuses = await Promise.all(responses.map(r => r.status));
  console.timeEnd(`fetchAllWithConcurrency(max=${max})`);
  console.log("Statuses (order preserved):", statuses);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


// ===== FILE: tasks/concurrency_fetch/src/fetchAllWithConcurrency.ts =====

export async function fetchAllWithConcurrency(
  urls: string[],
  maxConcurrency: number,
  fetchImpl: typeof fetch = fetch
): Promise<Response[]> {
  if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1) {
    throw new Error("maxConcurrency must be a positive integer");
  }
  // Validate inputs up-front (defensive)
  urls.forEach((u, i) => {
    if (u == null) throw new Error(`Invalid URL at index ${i}`);
  });

  const results: Response[] = new Array(urls.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= urls.length) return;

      const url = urls[i]!;
      results[i] = await fetchImpl(url);
    }
  }

  const workers = Array.from(
    { length: Math.min(maxConcurrency, urls.length) },
    () => worker()
  );

  await Promise.all(workers);
  return results;
}

// Optional helper for timeouts (modern Node/Web runtimes)
export async function fetchWithTimeout(
  url: string,
  ms: number,
  fetchImpl: typeof fetch = fetch
) {
  const signal = AbortSignal.timeout(ms); // Node 20+ / modern browsers
  return fetchImpl(url, { signal });
}


export interface ConcurrencyOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;       // caller can cancel the whole batch
  failFast?: boolean;         // default true: abort others on first error
}

export async function fetchAllWithConcurrency2(
  inputs: (string | URL | Request)[],
  maxConcurrency: number,
  opts: ConcurrencyOptions = {}
): Promise<Response[]> {
  const {
    fetchImpl = fetch,
    timeoutMs,
    signal,
    failFast = true,
  } = opts;

  if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1) {
    throw new Error("maxConcurrency must be a positive integer");
  }
  inputs.forEach((u, i) => {
    if (u == null) throw new Error(`Invalid input at index ${i}`);
  });

  const results: Response[] = new Array(inputs.length);
  const controllers: (AbortController | null)[] = new Array(inputs.length).fill(null);
  let next = 0;
  let abortedAll = false;

  function combineSignals(base?: AbortSignal, extra?: AbortSignal) {
    // Prefer AbortSignal.any if available
    if (base && extra && 'any' in AbortSignal) {
      // @ts-ignore runtime feature
      return (AbortSignal as any).any([base, extra]);
    }
    if (!base) return extra;
    if (!extra) return base;

    // Tiny fallback combiner
    const c = new AbortController();
    const onAbort = () => c.abort(base.aborted ? base.reason : extra.reason);
    base.addEventListener('abort', onAbort, { once: true });
    extra.addEventListener('abort', onAbort, { once: true });
    if (base.aborted) c.abort(base.reason);
    else if (extra.aborted) c.abort(extra.reason);
    return c.signal;
  }

  async function worker() {
    while (true) {
      if (abortedAll || signal?.aborted) return;
      const i = next++;
      if (i >= inputs.length) return;

      const reqController = new AbortController();
      controllers[i] = reqController;

      let combined = reqController.signal;
      if (signal) combined = combineSignals(combined, signal)!;
      if (timeoutMs != null) combined = combineSignals(combined, AbortSignal.timeout(timeoutMs))!;

      try {
        results[i] = await fetchImpl(inputs[i] as any, { signal: combined });
      } catch (err) {
        if (failFast && !abortedAll) {
          abortedAll = true;
          // Abort all others immediately
          for (const c of controllers) c?.abort('fail-fast');
        }
        throw err;
      } finally {
        controllers[i] = null;
      }
    }
  }

  const workers = Array.from({ length: Math.min(maxConcurrency, inputs.length) }, () => worker());
  await Promise.all(workers); // rejects on first error if failFast
  return results;
}


// ===== FILE: tasks/concurrency_fetch/tests/fetchAllWithConcurrency.test.ts =====

import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { fetchAllWithConcurrency } from "../src/fetchAllWithConcurrency.js";

function makeResponse(url: string): Response {
  return new Response(JSON.stringify({ url }), {
    headers: { "content-type": "application/json" },
    status: 200
  });
}

test("limits concurrency and preserves order (deterministic timers)", async (t) => {
  const timers = mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const urls = ["A", "B", "C", "D", "E", "F"];
    const delays: Record<string, number> = { A: 80, B: 20, C: 35, D: 10, E: 60, F: 25 };

    let inFlight = 0;
    let maxInFlight = 0;
    const started: string[] = [];

    const mockFetch = (url: string) => {
      inFlight++;
      started.push(url);
      maxInFlight = Math.max(maxInFlight, inFlight);
      return new Promise<Response>((resolve) => {
        setTimeout(() => {
          inFlight--;
          resolve(makeResponse(url));
        }, delays[url]);
      });
    };

    const p = fetchAllWithConcurrency(urls, 2, mockFetch as any);

    // Immediately after start, A and B should have started
    assert.deepEqual(started.slice(0, 2), ["A", "B"]);

    // Advance just enough for B (20ms) to complete; C must start right away
    mock.timers.tick(20);
    assert.ok(started.includes("C"), "C should start as soon as B finishes");

    // Advance 15ms more (C now at 35ms total) -> D should start
    mock.timers.tick(15);
    assert.ok(started.includes("D"), "D should start as soon as the next slot frees");

    // Finish all
    mock.timers.runAll();

    const res = await p;
    const body = await Promise.all(res.map(r => r.json() as Promise<{url: string}>));
    assert.deepEqual(body.map(o => o.url), urls);
    assert.ok(maxInFlight <= 2);
  } finally {
    mock.timers.reset();
  }
});

test("rejects when any fetch fails (fail-fast)", async () => {
  const timers = mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const urls = ["OK1", "FAIL", "OK2"];
    const mockFetch = (url: string) =>
      new Promise<Response>((resolve, reject) => {
        setTimeout(() => {
          if (url === "FAIL") reject(new Error("boom"));
          else resolve(makeResponse(url));
        }, 5);
      });

    const p = fetchAllWithConcurrency(urls, 2, mockFetch as any);
    mock.timers.runAll();
    await assert.rejects(p, /boom/);
  } finally {
    mock.timers.reset();
  }
});

test("returns empty array for empty input", async () => {
  const res = await fetchAllWithConcurrency([], 3, (() => Promise.reject()) as any);
  assert.deepEqual(res, []);
});
