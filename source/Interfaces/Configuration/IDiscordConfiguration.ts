export interface IDiscordServerChannel {
    /** Server (guild) snowflake — Developer Mode → right-click server → Copy Server ID */
    guildId: string;
    /** Text channel snowflake for the live status embed */
    channelId: string;
    /** Optional note in config only (JSON has no comments); ignored by the bot */
    label?: string;
}

export default interface IDiscordConfiguration {
    botToken: string;
    /**
     * Single-server shortcut: one status channel. Ignored if `servers` is non-empty.
     */
    channelId?: string;
    /**
     * Multiple servers: one `{ guildId, channelId }` per Discord server. Bot must be in each guild.
     */
    servers?: IDiscordServerChannel[];
}
