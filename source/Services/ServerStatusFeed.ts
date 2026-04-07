import {ServerStats} from "../Schema/ServerStats";
import Configuration from "./Configuration";
import {XMLParser} from "fast-xml-parser";
import Logging from "./Logging";
import IPlayer from "../Interfaces/Feed/IPlayer";
import IMod from "../Interfaces/Feed/IMod";
import WebFeedAuth from "./WebFeedAuth";

export const CONNECTION_REFUSED = 'ECONNREFUSED';
export const NOT_FOUND = 'ENOTFOUND';

export default class ServerStatusFeed {
    private _serverStats: ServerStats | null = null;
    private _isOnline: boolean = false;
    private _isFetching: boolean = false;
    /** Milliseconds for last successful HTTP round-trip to serverStatsUrl (feed XML). */
    private _lastFeedLatencyMs: number | null = null;
    /** Avoids spamming the console when the feed fails on every poll (same message ≤ once per interval). */
    private _feedWarnThrottle = new Map<string, number>();
    private readonly _feedWarnThrottleMs = 120_000;

    constructor() {
    }

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
     * Last measured HTTP latency to the dedicated server feed (ms), or null if last request failed.
     */
    public getLastFeedLatencyMs(): number | null {
        return this._lastFeedLatencyMs;
    }

    /**
     * Returns the fetching status of the server stats feed
     * @returns {boolean} The fetching status of the server stats feed
     */
    public isFetching(): boolean {
        return this._isFetching;
    }

    /**
     * Get the server stats object
     * @returns {ServerStats | null} The server stats object or null if the server is offline or fetching
     * @private
     */
    private getServerStats(): ServerStats | null {
        if(this._isOnline && !this._isFetching && this._serverStats) {
            return this._serverStats;
        }
        return null;
    }

    /**
     * Update the server feed from the server status feed url
     * @returns {Promise<ServerStats | null>} The server stats object or null if the fetch failed
     */
    public async updateServerFeed(): Promise<ServerStats|null> {
        this._isFetching = true;
        try {
            const application = Configuration.getConfiguration().application;
            const headers = WebFeedAuth.getBasicAuthHeaders(application);
            const init: RequestInit = headers ? { headers } : {};
            const t0 = Date.now();
            const response = await fetch(application.serverStatsUrl, init);
            if (!response.ok) {
                this._lastFeedLatencyMs = Date.now() - t0;
                this._isOnline = false;
                if (response.status === 401) {
                    this.logFeedWarnThrottled(
                        `Server status feed returned 401 Unauthorized. Set webInterfaceUsername and webInterfacePassword in config.json to match the dedicated server web interface login.`,
                    );
                } else {
                    this.logFeedWarnThrottled(`Server status feed returned HTTP ${response.status}`);
                }
                return null;
            }
            const text = await response.text();
            this._lastFeedLatencyMs = Date.now() - t0;
            const parsedFeed = new XMLParser({ignoreAttributes: false, attributeNamePrefix: ''}).parse(text) as ServerStats;
            if (!parsedFeed?.Server?.Slots) {
                this._isOnline = false;
                this.logFeedWarnThrottled(`Server status feed is missing expected Server/Slots data`);
                return null;
            }
            this._isOnline = true;
            this._serverStats = parsedFeed;
        } catch (reason: any) {
            this._lastFeedLatencyMs = null;
            this._isOnline = false;
            const code = reason?.cause?.code ?? reason?.code;
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
            return null;
        } finally {
            this._isFetching = false;
        }
        return this._serverStats;
    }

    /**
     * Returns the online status of the server
     * @returns {boolean} The online status of the server
     */
    public isOnline(): boolean {
        return this._isOnline;
    }

    /**
     * Returns the server name
     * @returns {string} The server name
     */
    public getServerName(): string {
        return <string>this.getServerStats()?.Server.name;
    }

    /**
     * Returns the server map name
     * @returns {string} The server map name
     */
    public getServerMap(): string {
        return <string>this.getServerStats()?.Server.mapName;
    }

    /**
     * Returns the server time in decimal format
     * @returns {number} The server time in decimal format
     */
    public getServerTimeDecimal(): number {
        let dayTime = this.getServerStats()?.Server.dayTime;
        if (dayTime === undefined) {
            return 0;
        }
        return dayTime / (60 * 60 * 1000) + 0.0001;
    }

    /**
     * Get the server mods from the server stats feed
     * @returns {IMod[]} The server mods as an array of IMod objects
     */
    public getServerMods(): IMod[] {
        let modList = this.getServerStats()?.Server?.Mods?.Mod;
        if(modList === undefined || !Array.isArray(modList) || modList == null) {
            return [];
        }
        return modList.map((mod: any) => {
            return {
                name: mod['#text'],
                author: mod.author,
                version: mod.version
            } as IMod;
        });
    }

    /**
     * Returns the server time in the format HH:MM
     * @returns {string} The server time in the format HH:MM
     */
    public getServerTime(): string {
        let decimalTime = this.getServerTimeDecimal();
        if(decimalTime === 0) {
            return "00:00";
        }
        let hours = Math.floor(decimalTime);
        let minutes = Math.floor((decimalTime - hours) * 60);
        let hoursString = hours.toString();
        let minutesString = minutes.toString();
        if(hoursString.length === 1) {
            hoursString = `0${hoursString}`;
        }
        if(minutesString.length === 1) {
            minutesString = `0${minutesString}`;
        }
        return `${hoursString}:${minutesString}`;
    }

    /**
     * Returns the server player count
     * @returns {number | null | undefined} The server player count
     */
    public getPlayerCount(): number | null | undefined {
        return <number>this.getServerStats()?.Server?.Slots?.numUsed;
    }

    /**
     * Returns the server player count
     * @returns {number | null | undefined} The server player count
     */
    public getMaxPlayerCount(): number | null | undefined {
        return <number>this.getServerStats()?.Server?.Slots?.capacity;
    }

    /**
     * Returns the player list from the server stats feed
     * @returns {IPlayer[]} The online player list as an array of IPlayer objects
     */
    public getPlayerList(): IPlayer[] {
        let mappedPlayers: IPlayer[];
        let returnPlayers: IPlayer[] = [];
        let playerList = this.getServerStats()?.Server?.Slots?.Player;
        if (Array.isArray(playerList)) {
            mappedPlayers = playerList.map((player) => {
                return {
                    username: player['#text'],
                    isAdministrator: player.isAdmin === 'true',
                    sessionTime: parseInt(player.uptime),
                    isUsed: player.isUsed === 'true',
                } as IPlayer;
            });
        } else {
            mappedPlayers = [];
        }

        // Filter out player slots that are not used
        mappedPlayers.forEach((player) => {
            if(player.isUsed) {
                returnPlayers.push(player);
            }
        });

        return returnPlayers;
    }
}