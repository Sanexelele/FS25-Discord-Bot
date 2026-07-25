export default interface IApplicationConfiguration {
    serverStatsUrl: string;
    serverMapUrl: string;
    updateIntervalSeconds: number;
    serverPassword: string;
    /** HTTP Basic Auth user for /feed/ URLs when the web interface requires login (401). */
    webInterfaceUsername?: string;
    webInterfacePassword?: string;
    /** Large image below embed fields (HTTPS URL). Discord shows it above the footer/timestamp. */
    embedImageUrl?: string;
    /**
     * HTTPS (or http) URL for the «mod pack» link button under the status embed.
     * Leave empty or omit to hide the button.
     */
    modPackButtonUrl?: string;
    /**
     * Farming Simulator game port (TCP probe = online/offline). Default 10823.
     * Web feed on 8080/8081 is only for details, not "is the game up".
     */
    gamePort?: number;
    /** Optional host for the game-port probe; defaults to hostname from serverStatsUrl. */
    gameHost?: string;
    /** TCP connect timeout for gamePort (ms). Default 3000. */
    gamePortTimeoutMs?: number;
}