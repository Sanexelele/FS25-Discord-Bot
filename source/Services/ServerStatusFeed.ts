import {ServerStats} from "../Schema/ServerStats";
import Configuration from "./Configuration";
import {XMLParser} from "fast-xml-parser";
import Logging from "./Logging";
import IPlayer from "../Interfaces/Feed/IPlayer";
import IMod from "../Interfaces/Feed/IMod";
import WebFeedAuth from "./WebFeedAuth";
import os from "os";
import {probeGamePort} from "./GamePortProbe";

export const CONNECTION_REFUSED = "ECONNREFUSED";
export const NOT_FOUND = "ENOTFOUND";

const STREAK_CONFIRM = 2;
const DEFAULT_GAME_PORT = 10823;
const DEFAULT_GAME_PORT_TIMEOUT_MS = 3000;

function localIpv4Addresses(): string[] {
    const out: string[] = [];
    const nics = os.networkInterfaces();
    for (const addrs of Object.values(nics)) {
        if (!addrs) {
            continue;
        }
        for (const a of addrs) {
            if (a.family === "IPv4" && !a.internal) {
                out.push(a.address);
            }
        }
    }
    return out;
}

function rewriteUrlHost(url: string, host: string): string {
    try {
        const u = new URL(url);
        u.hostname = host;
        return u.toString();
    } catch {
        return url;
    }
}

function feedUrlCandidates(url: string): string[] {
    const seen = new Set<string>();
    const list: string[] = [];
    const add = (u: string) => {
        if (!seen.has(u)) {
            seen.add(u);
            list.push(u);
        }
    };
    add(url);
    try {
        const host = new URL(url).hostname;
        if (host === "127.0.0.1" || host.toLowerCase() === "localhost") {
            for (const ip of localIpv4Addresses()) {
                add(rewriteUrlHost(url, ip));
            }
        }
    } catch {
        /* keep original only */
    }
    return list;
}

function hostFromStatsUrl(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return "";
    }
}

export default class ServerStatusFeed {
    private _serverStats: ServerStats | null = null;
    /** Confirmed online after streak debounce (used by Discord embed). */
    private _isOnline: boolean = false;
    private _isFetching: boolean = false;
    /** Milliseconds for last successful HTTP round-trip to serverStatsUrl (feed XML). */
    private _lastFeedLatencyMs: number | null = null;
    /** Last TCP game-port probe RTT (ms), even if that probe failed (null). */
    private _lastGamePortLatencyMs: number | null = null;
    /** When confirmed offline started (ms since epoch), or null if confirmed online. */
    private _offlineSince: number | null = null;
    private _onlineStreak = 0;
    private _offlineStreak = 0;
    /** Avoids spamming the console when the feed fails on every poll (same message ≤ once per interval). */
    private _feedWarnThrottle = new Map<string, number>();
    private readonly _feedWarnThrottleMs = 120_000;

    constructor() {}

    private logFeedWarnThrottled(message: string): void {
        const now = Date.now();
        const last = this._feedWarnThrottle.get(message) ?? 0;
        if (now - last < this._feedWarnThrottleMs) {
            return;
        }
        this._feedWarnThrottle.set(message, now);
        Logging.getLogger().warn(message);
    }

    /**
     * Apply Elite-style 2-check debounce: one blip does not flip confirmed status.
     */
    private applyProbeDebounce(probeOk: boolean): void {
        const now = Date.now();
        if (probeOk) {
            this._offlineStreak = 0;
            this._onlineStreak += 1;
            if (this._onlineStreak >= STREAK_CONFIRM || this._offlineSince == null) {
                this._isOnline = true;
                this._offlineSince = null;
                return;
            }
            // First online poll after confirmed downtime: keep offline until streak confirms
            this._isOnline = false;
            return;
        }

        this._onlineStreak = 0;
        this._offlineStreak += 1;
        if (this._offlineStreak < STREAK_CONFIRM) {
            // One failed poll — keep previous confirmed state
            return;
        }
        if (this._offlineSince == null) {
            this._offlineSince = now;
        }
        this._isOnline = false;
    }

    /**
     * Last measured HTTP latency to the dedicated server feed (ms), or null if last request failed.
     */
    public getLastFeedLatencyMs(): number | null {
        return this._lastFeedLatencyMs;
    }

    /** Last TCP game-port probe latency (ms) when connect succeeded. */
    public getGamePortLatencyMs(): number | null {
        return this._lastGamePortLatencyMs;
    }

    /**
     * Milliseconds since confirmed offline started, or null if confirmed online / not yet confirmed down.
     */
    public getOfflineDurationMs(): number | null {
        if (this._isOnline || this._offlineSince == null) {
            return null;
        }
        return Math.max(0, Date.now() - this._offlineSince);
    }

    /**
     * Returns the fetching status of the server stats feed
     */
    public isFetching(): boolean {
        return this._isFetching;
    }

    /**
     * Get the server stats object when confirmed online and not mid-fetch.
     */
    private getServerStats(): ServerStats | null {
        if (this._isOnline && !this._isFetching && this._serverStats) {
            return this._serverStats;
        }
        return null;
    }

    /**
     * Probe game port (online gate), then optionally refresh the web feed for details.
     */
    public async updateServerFeed(): Promise<ServerStats | null> {
        this._isFetching = true;
        try {
            const application = Configuration.getConfiguration().application;
            const host =
                (application.gameHost?.trim() || hostFromStatsUrl(application.serverStatsUrl)).trim();
            const port =
                typeof application.gamePort === "number" && application.gamePort > 0
                    ? application.gamePort
                    : DEFAULT_GAME_PORT;
            const timeoutMs =
                typeof application.gamePortTimeoutMs === "number" && application.gamePortTimeoutMs > 0
                    ? application.gamePortTimeoutMs
                    : DEFAULT_GAME_PORT_TIMEOUT_MS;

            const probe = await probeGamePort(host, port, timeoutMs);
            this._lastGamePortLatencyMs = probe.latencyMs;
            this.applyProbeDebounce(probe.ok);

            if (!probe.ok) {
                // Game port down → do not trust web UI alone; clear live details
                this._lastFeedLatencyMs = null;
                return null;
            }

            // Port up: fetch XML for embed details (failure does not force offline)
            const headers = WebFeedAuth.getBasicAuthHeaders(application);
            const init: RequestInit = headers ? {headers} : {};
            const candidates = feedUrlCandidates(application.serverStatsUrl);
            let lastError: unknown = null;
            for (const feedUrl of candidates) {
                const t0 = Date.now();
                try {
                    const response = await fetch(feedUrl, init);
                    this._lastFeedLatencyMs = Date.now() - t0;
                    if (!response.ok) {
                        if (response.status === 401) {
                            this.logFeedWarnThrottled(
                                `Server status feed returned 401 Unauthorized. Set webInterfaceUsername and webInterfacePassword in config.json to match the dedicated server web interface login.`,
                            );
                        } else {
                            this.logFeedWarnThrottled(`Server status feed returned HTTP ${response.status}`);
                        }
                        continue;
                    }
                    const text = await response.text();
                    const parsedFeed = new XMLParser({
                        ignoreAttributes: false,
                        attributeNamePrefix: "",
                    }).parse(text) as ServerStats;
                    if (!parsedFeed?.Server?.Slots) {
                        this.logFeedWarnThrottled(`Server status feed is missing expected Server/Slots data`);
                        continue;
                    }
                    this._serverStats = parsedFeed;
                    lastError = null;
                    break;
                } catch (reason: any) {
                    lastError = reason;
                    this._lastFeedLatencyMs = null;
                }
            }
            if (lastError != null && this._serverStats == null) {
                const code = (lastError as any)?.cause?.code ?? (lastError as any)?.code;
                switch (code) {
                    case CONNECTION_REFUSED:
                        this.logFeedWarnThrottled(`Connection refused to server status feed`);
                        break;
                    case NOT_FOUND:
                        this.logFeedWarnThrottled(`Server status feed not found`);
                        break;
                    default:
                        this.logFeedWarnThrottled(`Error fetching server status feed`);
                        break;
                }
            }
            return this._serverStats;
        } finally {
            this._isFetching = false;
        }
    }

    /**
     * Confirmed online status (game port after debounce).
     */
    public isOnline(): boolean {
        return this._isOnline;
    }

    public getServerName(): string {
        return <string>this.getServerStats()?.Server.name;
    }

    public getServerMap(): string {
        return <string>this.getServerStats()?.Server.mapName;
    }

    public getServerTimeDecimal(): number {
        let dayTime = this.getServerStats()?.Server.dayTime;
        if (dayTime === undefined) {
            return 0;
        }
        return dayTime / (60 * 60 * 1000) + 0.0001;
    }

    public getServerMods(): IMod[] {
        let modList = this.getServerStats()?.Server?.Mods?.Mod;
        if (modList === undefined || !Array.isArray(modList) || modList == null) {
            return [];
        }
        return modList.map((mod: any) => {
            return {
                name: mod["#text"],
                author: mod.author,
                version: mod.version,
            } as IMod;
        });
    }

    public getServerTime(): string {
        let decimalTime = this.getServerTimeDecimal();
        if (decimalTime === 0) {
            return "00:00";
        }
        let hours = Math.floor(decimalTime);
        let minutes = Math.floor((decimalTime - hours) * 60);
        let hoursString = hours.toString();
        let minutesString = minutes.toString();
        if (hoursString.length === 1) {
            hoursString = `0${hoursString}`;
        }
        if (minutesString.length === 1) {
            minutesString = `0${minutesString}`;
        }
        return `${hoursString}:${minutesString}`;
    }

    public getPlayerCount(): number | null | undefined {
        return <number>this.getServerStats()?.Server?.Slots?.numUsed;
    }

    public getMaxPlayerCount(): number | null | undefined {
        return <number>this.getServerStats()?.Server?.Slots?.capacity;
    }

    public getPlayerList(): IPlayer[] {
        let mappedPlayers: IPlayer[];
        let returnPlayers: IPlayer[] = [];
        let playerList = this.getServerStats()?.Server?.Slots?.Player;
        if (Array.isArray(playerList)) {
            mappedPlayers = playerList.map((player) => {
                return {
                    username: player["#text"],
                    isAdministrator: player.isAdmin === "true",
                    sessionTime: parseInt(player.uptime),
                    isUsed: player.isUsed === "true",
                } as IPlayer;
            });
        } else {
            mappedPlayers = [];
        }

        mappedPlayers.forEach((player) => {
            if (player.isUsed) {
                returnPlayers.push(player);
            }
        });

        return returnPlayers;
    }
}

/** Norwegian-style offline duration: «X timer Y minutter». */
export function formatOfflineDuration(ms: number): string {
    const totalMin = Math.max(0, Math.floor(ms / 60_000));
    const hours = Math.floor(totalMin / 60);
    const minutes = totalMin % 60;
    const timerWord = hours === 1 ? "time" : "timer";
    const minWord = minutes === 1 ? "minutt" : "minutter";
    return `${hours} ${timerWord} ${minutes} ${minWord}`;
}
