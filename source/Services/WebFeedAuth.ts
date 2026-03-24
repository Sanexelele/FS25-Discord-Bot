import IApplicationConfiguration from "../Interfaces/Configuration/IApplicationConfiguration";

/**
 * HTTP Basic Auth for the dedicated server web feeds (stats XML + map image).
 * Set webInterfaceUsername / webInterfacePassword in config when the web UI returns 401.
 */
export default class WebFeedAuth {
    public static getBasicAuthHeaders(application: IApplicationConfiguration): HeadersInit | undefined {
        const username = application.webInterfaceUsername;
        if (username === undefined || username === "") {
            return undefined;
        }
        const password = application.webInterfacePassword ?? "";
        const token = Buffer.from(`${username}:${password}`).toString("base64");
        return { Authorization: `Basic ${token}` };
    }

    /**
     * Discord fetches thumbnail URLs without custom headers; embed userinfo when auth is enabled.
     */
    public static getMapUrlWithAuth(application: IApplicationConfiguration): string {
        const username = application.webInterfaceUsername;
        if (username === undefined || username === "") {
            return application.serverMapUrl;
        }
        const password = application.webInterfacePassword ?? "";
        const url = new URL(application.serverMapUrl);
        url.username = username;
        url.password = password;
        return url.toString();
    }
}
