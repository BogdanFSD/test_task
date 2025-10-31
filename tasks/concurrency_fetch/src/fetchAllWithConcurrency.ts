export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export async function fetchAllWithConcurrency(
  urls: string[],
  maxConcurrency: number,
  fetchImpl: FetchLike = fetch
): Promise<Response[]> {
  if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1) {
    throw new Error("maxConcurrency must be a positive integer");
  }
  urls.forEach((u, i) => {
    if (u == null) throw new Error(`Invalid URL at index ${i}`);
  });

  const results: Response[] = new Array(urls.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= urls.length) break;
      const url = urls[i]!;
      results[i] = await fetchImpl(url);
    }
  }

  const workers = Array.from({ length: Math.min(maxConcurrency, urls.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// Optional helper for per-request timeouts
export async function fetchWithTimeout(
  url: string,
  ms: number,
  fetchImpl: FetchLike = fetch
) {
  const signal = AbortSignal.timeout(ms);
  return fetchImpl(url, { signal });
}

export interface ConcurrencyOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  signal?: AbortSignal;
  failFast?: boolean;
}

// Advanced, production-grade variant
export async function fetchAllWithConcurrency2(
  inputs: (string | URL | Request)[],
  maxConcurrency: number,
  opts: ConcurrencyOptions = {}
): Promise<Response[]> {
  const { fetchImpl = fetch, timeoutMs, signal, failFast = true } = opts;

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
    if (base && extra && "any" in AbortSignal) {
      return (AbortSignal as any).any([base, extra]);
    }
    if (!base) return extra;
    if (!extra) return base;

    const c = new AbortController();
    const onAbort = () => c.abort(base.aborted ? base.reason : extra.reason);
    base.addEventListener("abort", onAbort, { once: true });
    extra.addEventListener("abort", onAbort, { once: true });
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
          for (const c of controllers) c?.abort("fail-fast");
        }
        throw err;
      } finally {
        controllers[i] = null;
      }
    }
  }

  const workers = Array.from({ length: Math.min(maxConcurrency, inputs.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
