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
