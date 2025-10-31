import test from "node:test";
import assert from "node:assert/strict";
import { fetchAllWithConcurrency2, type FetchLike } from "../src/fetchAllWithConcurrency.js";

function makeResponse(url: string): Response {
  return new Response(JSON.stringify({ url }), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* -------------------------------------------------------------
 * 1️⃣ Basic behavior: concurrency limit & order preservation
 * ------------------------------------------------------------- */
test("fetchAllWithConcurrency2 limits concurrency and preserves order", async () => {
  const urls = ["A", "B", "C", "D", "E", "F"];
  const delays: Record<string, number> = { A: 80, B: 20, C: 35, D: 10, E: 60, F: 25 };

  let inFlight = 0;
  let maxInFlight = 0;
  const started: string[] = [];

  const mockFetch: FetchLike = async (input, init) => {
    const url = String(input);
    inFlight++;
    started.push(url);
    maxInFlight = Math.max(maxInFlight, inFlight);
    await sleep(delays[url]!);
    inFlight--;
    return makeResponse(url);
  };

  const res = await fetchAllWithConcurrency2(urls, 2, { fetchImpl: mockFetch });
  const body = await Promise.all(res.map((r) => r.json() as Promise<{ url: string }>));

  assert.deepEqual(body.map((o) => o.url), urls);
  assert.ok(maxInFlight <= 2);
  assert.deepEqual(started.sort(), [...urls].sort());
});

/* -------------------------------------------------------------
 * 2️⃣ Fail-fast behavior: abort remaining requests
 * ------------------------------------------------------------- */
test("fetchAllWithConcurrency2 cancels other requests when failFast=true", async () => {
  const urls = ["A", "FAIL", "B", "C"];
  const aborted: string[] = [];

  const mockFetch: FetchLike = async (input, init) => {
    const url = String(input);
    const signal = init?.signal;
    signal?.addEventListener("abort", () => aborted.push(url));
    await sleep(20);
    if (url === "FAIL") throw new Error("boom");
    return makeResponse(url);
  };

  await assert.rejects(
    () =>
      fetchAllWithConcurrency2(urls, 2, {
        fetchImpl: mockFetch,
        failFast: true,
      }),
    /boom/
  );

  assert.ok(aborted.length > 0);
});

/* -------------------------------------------------------------
 * 3️⃣ Timeout behavior: abort slow requests automatically
 * ------------------------------------------------------------- */
test("fetchAllWithConcurrency2 aborts slow requests when timeoutMs is reached", async () => {
  const urls = ["slow", "fast"];

  const mockFetch: FetchLike = async (input, init) => {
    const url = String(input);
    const signal = init?.signal;

    if (url === "slow") await sleep(1000);
    else await sleep(50);

    if (signal?.aborted) throw new Error("Timeout or abort triggered");
    return makeResponse(url);
  };

  await assert.rejects(
    () =>
      fetchAllWithConcurrency2(urls, 2, {
        fetchImpl: mockFetch,
        timeoutMs: 100,
      }),
    /Timeout|abort/i
  );
});
