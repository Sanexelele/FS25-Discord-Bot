export default interface IApplicationConfiguration {
    serverStatsUrl: string;
    serverMapUrl: string;
    updateIntervalSeconds: number;
    serverPassword: string;
    /** HTTP Basic Auth user for /feed/ URLs when the web interface requires login (401). */
    webInterfaceUsername?: string;
    webInterfacePassword?: string;
}