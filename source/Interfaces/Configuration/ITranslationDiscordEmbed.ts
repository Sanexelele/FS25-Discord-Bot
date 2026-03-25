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
}
