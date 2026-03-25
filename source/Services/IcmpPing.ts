import {execFile} from "child_process";
import {promisify} from "util";

const execFileAsync = promisify(execFile);

/**
 * One ICMP echo to host (IP or hostname) using OS ping. Returns round-trip ms or null on failure / blocked.
 */
export async function icmpPingHost(host: string): Promise<number | null> {
    if (!host || host === "?") {
        return null;
    }
    try {
        let stdout: string;
        if (process.platform === "win32") {
            const r = await execFileAsync("ping", ["-n", "1", "-w", "3000", host], {
                windowsHide: true,
                timeout: 5000,
            });
            stdout = String(r.stdout ?? "");
        } else {
            const args =
                process.platform === "darwin"
                    ? ["-c", "1", "-W", "2000", host]
                    : ["-c", "1", "-W", "2", host];
            const r = await execFileAsync("ping", args, {timeout: 5000});
            stdout = String(r.stdout ?? "");
        }
        return parsePingStdout(stdout);
    } catch {
        return null;
    }
}

function parsePingStdout(stdout: string): number | null {
    for (const line of stdout.split(/\r?\n/)) {
        if (/(?:tid|time)<1ms/i.test(line)) {
            return 1;
        }
        const m = line.match(/(?:tid|time)[=<](\d+\.?\d*)\s*ms/i);
        if (m) {
            return Math.round(parseFloat(m[1]));
        }
    }
    return null;
}
