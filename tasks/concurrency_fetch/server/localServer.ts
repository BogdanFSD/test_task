import http, { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";

export type Metrics = {
  inFlight: number;
  maxInFlight: number;
  total: number;
  closedBeforeWrite: number;
};

/**
 * Start a small HTTP test server that simulates delay/failure endpoints.
 * It also records metrics about concurrent requests and aborted connections.
 */
export function startLocalServer(port = 0) {
  const metrics: Metrics = {
    inFlight: 0,
    maxInFlight: 0,
    total: 0,
    closedBeforeWrite: 0,
  };

  const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const u = new URL(req.url ?? "/", `http://${req.headers.host}`);
    metrics.total++;
    metrics.inFlight++;
    metrics.maxInFlight = Math.max(metrics.maxInFlight, metrics.inFlight);

    let responded = false;
    let closed = false;
    
    const end = (code: number, body: any) => {
      if (responded || closed) return;
      responded = true;
      res.statusCode = code;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(body));
      metrics.inFlight--;
    };

    /** 
     * Detect client disconnects properly (both req.aborted and res.close)
     */
    const markClosed = () => {
      if (closed) return; // prevent double-calling
      closed = true;
      if (!responded) {
        metrics.closedBeforeWrite++;
      }
      metrics.inFlight--;
    };

    req.on("close", markClosed);
    res.on("close", markClosed);

    try {
      if (u.pathname === "/delay") {
        const ms = Number(u.searchParams.get("ms") ?? 100);
        const label = u.searchParams.get("label") ?? "delay";
        setTimeout(() => {
          // only send if still connected
          if (!closed && !res.writableEnded) end(200, { ok: true, label, ms });
        }, ms);
        return;
      }

      if (u.pathname === "/fail") {
        setTimeout(() => {
          if (!closed && !res.writableEnded) end(500, { ok: false, error: "fail" });
        }, 20);
        return;
      }

      if (u.pathname === "/metrics") {
        end(200, { ...metrics });
        return;
      }

      end(404, { ok: false, error: "not_found" });
    } catch (err: any) {
      end(500, { ok: false, error: String(err?.message ?? err) });
    }
  });

  // Important: use dynamic port (0) to avoid EADDRINUSE
  return new Promise<{ url: string; server: http.Server; metrics: Metrics }>((resolve) => {
    server.listen(port, () => {
      const actualPort = (server.address() as any).port;
      const base = `http://localhost:${actualPort}`;
      resolve({ url: base, server, metrics });
    });
  });
}

/**
 * Run standalone (for debugging)
 */
if (process.argv[1] && process.argv[1].includes("localServer.ts")) {
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  startLocalServer(port).then(({ url }) => {
    console.log(`Local server listening at ${url}
GET ${url}/delay?ms=200
GET ${url}/fail
GET ${url}/metrics`);
  });
}
