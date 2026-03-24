import {Client, EmbedBuilder, Snowflake, TextChannel} from "discord.js";
import Configuration from "./Configuration";
import ServerStatusFeed from "./ServerStatusFeed";
import WebFeedAuth from "./WebFeedAuth";
import {Logger} from "winston";
import Logging from "./Logging";

function isDiscordChannelAccessError(e: unknown): boolean {
    if (typeof e !== "object" || e === null) {
        return false;
    }
    const err = e as { code?: number; message?: string };
    return err.code === 50001 || err.code === 50013;
}

export default class DiscordEmbed {
    private static instance: DiscordEmbed | null = null;

    public static getInstance(): DiscordEmbed | null {
        return DiscordEmbed.instance;
    }

    private appLogger: Logger;
    private discordAppClient: Client;
    private appConfiguration: Configuration;
    private serverStatsFeed: ServerStatusFeed;
    private firstMessageId: Snowflake | null = null;
    /** Log Missing Access / Missing Permissions only once (same tick would spam every update). */
    private channelAccessErrorLogged = false;

    public constructor(discordAppClient: Client) {
        DiscordEmbed.instance = this;
        this.appLogger = Logging.getLogger();
        this.discordAppClient = discordAppClient;
        this.appConfiguration = new Configuration();
        this.serverStatsFeed = new ServerStatusFeed();

        (async () => {
            // Delete all messages in the channel
            await this.deleteAllMessages();
            // Start the update loop, which updates the discord embed every x seconds itself
            await this.updateDiscordEmbed();
        })();
    }

    /**
     * Refresh the XML feed and build the same embed used for the live status message (for /status).
     */
    public async buildStatusEmbed(): Promise<EmbedBuilder> {
        await this.serverStatsFeed.updateServerFeed();
        return this.generateEmbedFromStatusFeed(this.serverStatsFeed);
    }

    /**
     * Update the discord embed with the server status, player list and server time
     * This method is called every x seconds to update the discord embed.
     * @private
     */
    private async updateDiscordEmbed(): Promise<void> {
        try {
            await this.serverStatsFeed.updateServerFeed();
            if(this.serverStatsFeed.isFetching()) {
                setTimeout(() => {
                    this.updateDiscordEmbed();
                }, 1000);
                return;
            }
            const channel = await this.discordAppClient.channels.fetch(
                this.appConfiguration.discord.channelId as Snowflake
            );
            if (!channel?.isTextBased()) {
                return;
            }
            const textChannel = channel as TextChannel;

            const embedMessage = await this.generateEmbedFromStatusFeed(this.serverStatsFeed);

            const sendInitialMessage = async (embed: EmbedBuilder) => {
                const message = await textChannel.send({embeds: [embed]});
                this.firstMessageId = message.id;
            };

            if (this.firstMessageId !== null) {
                try {
                    const message = await textChannel.messages.fetch(this.firstMessageId);
                    await message.edit({embeds: [embedMessage]});
                } catch {
                    await sendInitialMessage(embedMessage);
                }
            } else {
                await sendInitialMessage(embedMessage);
            }
        } catch (exception: unknown) {
            if (isDiscordChannelAccessError(exception)) {
                if (!this.channelAccessErrorLogged) {
                    this.channelAccessErrorLogged = true;
                    this.appLogger.error(
                        "Discord: Missing Access to the configured channel. Fix: correct channelId in config.json; " +
                            "invite the bot to the server; channel role overrides must allow View Channel, Send Messages, " +
                            "Embed Links, and Manage Messages (for clearing the channel on startup). " +
                            "Put the bot's role above channel restrictions if you use private categories."
                    );
                }
            } else {
                this.appLogger.error(exception);
            }
        }

        setTimeout(() => {
            this.updateDiscordEmbed();
        }, this.appConfiguration.application.updateIntervalSeconds * 1000);
    }

    /**
     * Delete all messages in a text channel to clear the channel
     * @private
     */
    private async deleteAllMessages(): Promise<boolean> {
        try {
            const channel = await this.discordAppClient.channels.fetch(
                this.appConfiguration.discord.channelId as Snowflake
            );
            if (!channel?.isTextBased()) {
                return false;
            }
            const textChannel = channel as TextChannel;
            const messages = await textChannel.messages.fetch();
            messages.forEach((message) => {
                message.delete().catch(() => {});
            });
        } catch {
            /* channel missing, no access, or API error */
        }
        return true;
    }

    /**
     * Truncates a string at a given length
     * @param text The input text to truncate
     * @param maxLength The allowed characters until truncation
     * @returns The truncated string
     */
    private async truncateText(text: string, maxLength = 1024): Promise<string> {
        return text.length > maxLength ? text.slice(0, maxLength - 3) + '...' : text; 
    }

    /**
     * Send server stats embed in a channel
     * @param serverStats
     */
    private async generateEmbedFromStatusFeed(serverStats: ServerStatusFeed): Promise<EmbedBuilder> {
        let embed = new EmbedBuilder();
        let config = this.appConfiguration;

        embed.setTitle(config.translation.discordEmbed.title);
        if (!serverStats.isOnline()) {
            embed.setColor(0xCA0000);
            embed.setDescription(config.translation.discordEmbed.descriptionOffline);
        } else if (serverStats.isFetching()) {
            embed.setDescription(config.translation.discordEmbed.descriptionUnknown);
        } else {
            embed.setColor(0x00CA00);
            embed.setDescription(config.translation.discordEmbed.descriptionOnline);
            embed.setTimestamp(new Date());
            embed.setThumbnail(WebFeedAuth.getMapUrlWithAuth(config.application));

            let playerListString: string;
            let playerListTitleString = `${config.translation.discordEmbed.titlePlayerCount} (${serverStats.getPlayerCount()??0}/${serverStats.getMaxPlayerCount()??0}):`;

            if(serverStats.getPlayerList().length === 0) {
                playerListString = config.translation.discordEmbed.noPlayersOnline;
            } else {
                playerListString = serverStats.getPlayerList().map(p => p.username).join(', ');
            }

            let serverPassword = config.application.serverPassword;
            if(config.application.serverPassword == "") {
                serverPassword = "-/-";
            }

            let serverMods = serverStats.getServerMods();
            let serverModsText = "-/-";
            if(serverMods.length > 0) {
                serverModsText = await this.truncateText(serverMods.map(mod => `${mod.name}`).join(', '));
            }

            // @ts-ignore
            embed.addFields(
                {name: config.translation.discordEmbed.titleServerName, value: serverStats.getServerName()},
                {name: config.translation.discordEmbed.titleServerPassword, value: serverPassword},
                {name: config.translation.discordEmbed.titleServerTime, value: serverStats.getServerTime()},
                {name: config.translation.discordEmbed.titleServerMap, value: serverStats.getServerMap()},
                {name: config.translation.discordEmbed.titleServerMods, value: serverModsText},
                {
                    name: playerListTitleString,
                    value: playerListString
                },
            );
        }
        return embed;
    }
}