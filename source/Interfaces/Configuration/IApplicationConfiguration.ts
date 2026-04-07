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
}