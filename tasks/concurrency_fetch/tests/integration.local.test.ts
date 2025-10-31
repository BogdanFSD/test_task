import test from "node:test";
import assert from "node:assert/strict";
import { startLocalServer } from "../server/localServer.js";
import { fetchAllWithConcurrency2 } from "../src/fetchAllWithConcurrency.js";

test("integration: respects max concurrency against local server", async () => {
  const { url, server, metrics } = await startLocalServer(0); // random free port
  try {
    const urls = [
      `${url}/delay?ms=250&label=A`,
      `${url}/delay?ms=50&label=B`,
      `${url}/delay?ms=100&label=C`,
      `${url}/delay?ms=25&label=D`,
      `${url}/delay?ms=150&label=E`,
      `${url}/delay?ms=75&label=F`,
      `${url}/delay?ms=125&label=G`,
    ];

    const max = 3;
    const res = await fetchAllWithConcurrency2(urls, max, { timeoutMs: 5_000 });

    assert.equal(res.length, urls.length);
    assert.ok(metrics.maxInFlight <= max, `server saw max ${metrics.maxInFlight} in-flight > ${max}`);
    assert.equal(metrics.closedBeforeWrite, 0, "should not see aborted requests in happy path");
  } finally {
    server.close();
  }
});

test("integration: fail-fast aborts others", async () => {
  const { url, server, metrics } = await startLocalServer(0);
  try {
    const urls = [
      `${url}/delay?ms=200&label=A`,
      `${url}/fail`,
      `${url}/delay?ms=200&label=C`,
      `${url}/delay?ms=200&label=D`,
      `${url}/delay?ms=200&label=E`,
    ];

    await assert.rejects(
    () =>
        fetchAllWithConcurrency2(urls, 3, {
        failFast: true,
        timeoutMs: 5_000,
        // 🔥 Custom fetch that throws on HTTP 500
        fetchImpl: async (input, init) => {
            const res = await fetch(input, init);
            if (!res.ok) throw new Error(`boom: ${res.status}`);
            return res;
        },
        }),
    /fail|boom|abort|Timeout/i
    );

    // Give server time to detect client disconnects
    await new Promise(resolve => setTimeout(resolve, 50));

    assert.ok(metrics.closedBeforeWrite >= 1, "expected at least one client abort due to fail-fast");
  } finally {
    server.close();
  }
});

test("integration: timeout aborts slow request", async () => {
  const { url, server, metrics } = await startLocalServer(0);
  try {
    const urls = [
      `${url}/delay?ms=1000&label=very-slow`,
    ];

    await assert.rejects(
      () => fetchAllWithConcurrency2(urls, 1, { timeoutMs: 100 }),
      /abort|Timeout/i
    );

    // Give server time to detect client disconnect
    await new Promise(resolve => setTimeout(resolve, 50));

    assert.ok(metrics.closedBeforeWrite >= 1, "server should observe client disconnect from timeout");
  } finally {
    server.close();
  }
});
