import test from "node:test";
import assert from "node:assert/strict";
import { fetchAllWithConcurrency } from "../src/fetchAllWithConcurrency.js";
import { startLocalServer } from "../server/localServer.js";

function makeResponse(url: string, status = 200): Response {
  return new Response(JSON.stringify({ url }), {
    headers: { "content-type": "application/json" },
    status,
  });
}

// =====================
// Unit Tests (Mock Fetch)
// =====================

test("limits concurrency and preserves order", async () => {
  const urls = ["A", "B", "C", "D", "E", "F"];
  const delays: Record<string, number> = {
    A: 80,
    B: 20,
    C: 35,
    D: 10,
    E: 60,
    F: 25,
  };

  let inFlight = 0;
  let maxInFlight = 0;
  const started: string[] = [];

  const mockFetch = async (url: string) => {
    inFlight++;
    started.push(url);
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, delays[url]));
    inFlight--;
    return makeResponse(url);
  };

  const res = await fetchAllWithConcurrency(urls, 2, mockFetch as any);
  const body = await Promise.all(
    res.map((r) => r.json() as Promise<{ url: string }>)
  );

  assert.deepEqual(
    body.map((o) => o.url),
    urls,
    "Results preserve input order"
  );
  assert.ok(maxInFlight <= 2, "Concurrency never exceeded 2");
  assert.deepEqual(started.sort(), [...urls].sort(), "All URLs were fetched");
});

test("rejects when any fetch fails (fail-fast)", async () => {
  const urls = ["OK1", "FAIL", "OK2"];

  const mockFetch = async (url: string) => {
    await new Promise((r) => setTimeout(r, 5));
    if (url === "FAIL") throw new Error("boom");
    return makeResponse(url);
  };

  await assert.rejects(
    () => fetchAllWithConcurrency(urls, 2, mockFetch as any),
    /boom/
  );
});

test("returns empty array for empty input", async () => {
  const res = await fetchAllWithConcurrency([], 3, (() =>
    Promise.reject()) as any);
  assert.deepEqual(res, []);
});

test("handles single URL correctly", async () => {
  const urls = ["single"];
  const mockFetch = async (url: string) => makeResponse(url);

  const res = await fetchAllWithConcurrency(urls, 5, mockFetch as any);
  
  assert.equal(res.length, 1);
  const body = await res[0]!.json() as { url: string };
  assert.equal(body.url, "single");
});

test("handles maxConcurrency > urls.length", async () => {
  const urls = ["A", "B"];
  let maxInFlight = 0;
  let inFlight = 0;

  const mockFetch = async (url: string) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 10));
    inFlight--;
    return makeResponse(url);
  };

  const res = await fetchAllWithConcurrency(urls, 10, mockFetch as any);

  assert.equal(res.length, 2);
  assert.ok(maxInFlight <= 2, "Should not create more workers than URLs");
});

test("handles maxConcurrency = 1 (sequential)", async () => {
  const urls = ["A", "B", "C"];
  let maxInFlight = 0;
  let inFlight = 0;
  const order: string[] = [];

  const mockFetch = async (url: string) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    order.push(`start-${url}`);
    await new Promise((r) => setTimeout(r, 10));
    order.push(`end-${url}`);
    inFlight--;
    return makeResponse(url);
  };

  const res = await fetchAllWithConcurrency(urls, 1, mockFetch as any);

  assert.equal(res.length, 3);
  assert.equal(maxInFlight, 1, "Should never exceed 1 in-flight");
  // With maxConcurrency=1, each request should finish before next starts
  assert.deepEqual(order, ["start-A", "end-A", "start-B", "end-B", "start-C", "end-C"]);
});

test("large batch with high concurrency", async () => {
  const urls = Array.from({ length: 50 }, (_, i) => `url-${i}`);
  let maxInFlight = 0;
  let inFlight = 0;

  const mockFetch = async (url: string) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, Math.random() * 20));
    inFlight--;
    return makeResponse(url);
  };

  const res = await fetchAllWithConcurrency(urls, 10, mockFetch as any);

  assert.equal(res.length, 50);
  assert.ok(maxInFlight <= 10, `Max in-flight was ${maxInFlight}, expected <= 10`);
  
  // Verify order preservation
  const bodies = await Promise.all(res.map((r) => r.json() as Promise<{ url: string }>));
  bodies.forEach((body, i) => {
    assert.equal(body.url, urls[i], `Result at index ${i} should match input order`);
  });
});

// =====================
// Input Validation Tests
// =====================

test("throws on invalid maxConcurrency: zero", async () => {
  await assert.rejects(
    () => fetchAllWithConcurrency(["url"], 0),
    /maxConcurrency must be a positive integer/
  );
});

test("throws on invalid maxConcurrency: negative", async () => {
  await assert.rejects(
    () => fetchAllWithConcurrency(["url"], -5),
    /maxConcurrency must be a positive integer/
  );
});

test("throws on invalid maxConcurrency: non-integer", async () => {
  await assert.rejects(
    () => fetchAllWithConcurrency(["url"], 2.5),
    /maxConcurrency must be a positive integer/
  );
});

test("throws on null URL in array", async () => {
  await assert.rejects(
    () => fetchAllWithConcurrency(["valid", null as any, "valid2"], 2),
    /Invalid URL at index 1/
  );
});

test("throws on undefined URL in array", async () => {
  await assert.rejects(
    () => fetchAllWithConcurrency(["valid", undefined as any], 2),
    /Invalid URL at index 1/
  );
});

// =====================
// Error Handling Tests
// =====================

test("stops all workers when first error occurs", async () => {
  const urls = ["A", "B", "C", "D", "E"];
  const completed: string[] = [];
  
  const mockFetch = async (url: string) => {
    await new Promise((r) => setTimeout(r, url === "B" ? 10 : 50));
    if (url === "B") throw new Error("B failed");
    completed.push(url);
    return makeResponse(url);
  };

  await assert.rejects(
    () => fetchAllWithConcurrency(urls, 2, mockFetch as any),
    /B failed/
  );
});

test("propagates fetch network error", async () => {
  const urls = ["url"];
  
  const mockFetch = async () => {
    throw new TypeError("Network request failed");
  };

  await assert.rejects(
    () => fetchAllWithConcurrency(urls, 1, mockFetch as any),
    /Network request failed/
  );
});

// =====================
// Integration Tests (Real Server)
// =====================

test("integration: works with real HTTP server", async () => {
  const { url, server, metrics } = await startLocalServer(0);
  try {
    const urls = [
      `${url}/delay?ms=50&label=A`,
      `${url}/delay?ms=25&label=B`,
      `${url}/delay?ms=75&label=C`,
    ];

    const res = await fetchAllWithConcurrency(urls, 2);

    assert.equal(res.length, 3);
    assert.ok(res.every(r => r.ok), "All responses should be successful");
    
    const bodies = await Promise.all(res.map(r => r.json())) as Array<{ label: string }>;
    assert.equal(bodies[0]!.label, "A");
    assert.equal(bodies[1]!.label, "B");
    assert.equal(bodies[2]!.label, "C");

    assert.ok(metrics.maxInFlight <= 2, `Server saw max ${metrics.maxInFlight} in-flight`);
    assert.equal(metrics.total, 3, "Server handled all 3 requests");
  } finally {
    server.close();
  }
});

test("integration: respects concurrency with real server", async () => {
  const { url, server, metrics } = await startLocalServer(0);
  try {
    const urls = Array.from({ length: 10 }, (_, i) => 
      `${url}/delay?ms=50&label=${i}`
    );

    const max = 3;
    const res = await fetchAllWithConcurrency(urls, max);

    assert.equal(res.length, 10);
    assert.ok(metrics.maxInFlight <= max, 
      `Server saw max ${metrics.maxInFlight} in-flight, expected <= ${max}`);
    assert.equal(metrics.total, 10);
  } finally {
    server.close();
  }
});

test("integration: fails fast on server error", async () => {
  const { url, server } = await startLocalServer(0);
  try {
    const urls = [
      `${url}/delay?ms=100&label=A`,
      `${url}/fail`,
      `${url}/delay?ms=100&label=C`,
    ];

    // Note: fetchAllWithConcurrency doesn't check response.ok, so we need custom fetch
    const customFetch = async (input: string) => {
      const res = await fetch(input);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    };

    await assert.rejects(
      () => fetchAllWithConcurrency(urls, 2, customFetch as any),
      /HTTP 500/
    );
  } finally {
    server.close();
  }
});

