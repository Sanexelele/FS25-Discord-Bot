export default interface ITranslationDiscordEmbed {
    title: string;
    /** Word used in the STATUS line (e.g. STATUS) */
    titleStatus: string;
    descriptionOnline: string;
    descriptionOffline: string;
    descriptionUnknown: string;
    titleBotUptime: string;
    /** Dedicated server responsiveness (ms); label in translation */
    titleServerLatency: string;
    titleServerName: string;
    titleServerMap: string;
    titleServerMods: string;
    titleServerPassword: string;
    titleServerTime: string;
    titlePlayerCount: string;
    noPlayersOnline: string;
    /** Label for optional mod-pack link button; falls back to Norwegian default if omitted */
    labelModPackButton?: string;
    /** Offline duration field label (e.g. Frakoblet i); optional */
    titleOfflineDuration?: string;
}
