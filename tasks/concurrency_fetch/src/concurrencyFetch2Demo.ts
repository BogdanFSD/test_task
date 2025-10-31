import { fetchAllWithConcurrency2, type ConcurrencyOptions } from "./fetchAllWithConcurrency.js";

function readUrls(): string[] {
  const fromEnv = process.env.URLS?.split(",").map(s => s.trim()).filter(Boolean);
  if (fromEnv && fromEnv.length) return fromEnv;

  // Fallback: hit local demo server if running (see server below)
  const base = process.env.BASE_URL ?? "http://localhost:3000";
  return [
    `${base}/delay?ms=300&label=A`,
    `${base}/delay?ms=100&label=B`,
    `${base}/delay?ms=200&label=C`,
    `${base}/delay?ms=100&label=D`,
    `${base}/delay?ms=300&label=E`,
  ];
}

async function main() {
  const urls = readUrls();
  const max = Number(process.env.MAX_CONCURRENCY ?? 2);
  const timeoutMs = process.env.TIMEOUT_MS ? Number(process.env.TIMEOUT_MS) : undefined;
  const failFast = process.env.FAIL_FAST !== "false"; // default true

const opts: ConcurrencyOptions = {
  ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  failFast,
};

  console.log({ maxConcurrency: max, timeoutMs, failFast, count: urls.length });
  console.time(`fetchAllWithConcurrency2(max=${max})`);
  try {
    const responses = await fetchAllWithConcurrency2(urls, max, opts);
    const statuses = responses.map(r => r.status);
    console.timeEnd(`fetchAllWithConcurrency2(max=${max})`);
    console.log("Statuses (order preserved):", statuses);
  } catch (err) {
    console.timeEnd(`fetchAllWithConcurrency2(max=${max})`);
    console.error("Failed:", err);
    process.exitCode = 1;
  }
}

main();
