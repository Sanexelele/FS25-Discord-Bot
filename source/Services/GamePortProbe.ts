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
