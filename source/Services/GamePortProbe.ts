import dgram from "dgram";
import net from "net";

export type GamePortProbeResult = {
    ok: boolean;
    /** Round-trip time for successful TCP connect (ms), or null on failure. */
    latencyMs: number | null;
};

/**
 * TCP connect probe to the Farming Simulator game port (default 10823).
 * Used as the source of truth for "game session online" — not the web admin feed.
 */
export async function probeTcp(
    host: string,
    port: number,
    timeoutMs: number,
): Promise<GamePortProbeResult> {
    if (!host || host === "?" || !Number.isFinite(port) || port <= 0) {
        return {ok: false, latencyMs: null};
    }
    const timeout = Math.max(200, timeoutMs || 3000);

    return new Promise((resolve) => {
        const socket = new net.Socket();
        const t0 = Date.now();
        let settled = false;

        const finish = (ok: boolean) => {
            if (settled) {
                return;
            }
            settled = true;
            socket.removeAllListeners();
            socket.destroy();
            resolve({
                ok,
                latencyMs: ok ? Math.max(0, Date.now() - t0) : null,
            });
        };

        socket.setTimeout(timeout);
        socket.once("connect", () => finish(true));
        socket.once("timeout", () => finish(false));
        socket.once("error", () => finish(false));

        try {
            socket.connect(port, host);
        } catch {
            finish(false);
        }
    });
}

function isLoopbackHost(host: string): boolean {
    const h = host.trim().toLowerCase();
    return h === "127.0.0.1" || h === "localhost" || h === "::1";
}

/**
 * Same-machine check: FS25 dedicated game listens on UDP 10823, not TCP.
 * If binding the port fails with EADDRINUSE, the game session is up.
 */
export async function probeUdpPortBound(port: number): Promise<GamePortProbeResult> {
    if (!Number.isFinite(port) || port <= 0) {
        return {ok: false, latencyMs: null};
    }
    const t0 = Date.now();
    return new Promise((resolve) => {
        const socket = dgram.createSocket("udp4");
        let settled = false;
        const finish = (ok: boolean) => {
            if (settled) {
                return;
            }
            settled = true;
            socket.removeAllListeners();
            try {
                socket.close();
            } catch {
                /* already closed */
            }
            resolve({ok, latencyMs: ok ? Math.max(0, Date.now() - t0) : null});
        };
        socket.once("error", (err: NodeJS.ErrnoException) => {
            finish(err.code === "EADDRINUSE");
        });
        socket.once("listening", () => {
            finish(false);
        });
        try {
            socket.bind(port);
        } catch (err) {
            const code = err && typeof err === "object" && "code" in err ? (err as NodeJS.ErrnoException).code : "";
            finish(code === "EADDRINUSE");
        }
    });
}

/**
 * TCP first (if the host exposes it). On this PC the game is UDP-only, so loopback
 * falls back to a local UDP bind-check. Web admin alone is never treated as online.
 */
export async function probeGamePort(
    host: string,
    port: number,
    timeoutMs: number,
): Promise<GamePortProbeResult> {
    const tcp = await probeTcp(host, port, timeoutMs);
    if (tcp.ok) {
        return tcp;
    }
    if (isLoopbackHost(host)) {
        return probeUdpPortBound(port);
    }
    return tcp;
}
