import {Client, EmbedBuilder, Snowflake, TextChannel} from "discord.js";
import Configuration from "./Configuration";
import ServerStatusFeed from "./ServerStatusFeed";
import WebFeedAuth from "./WebFeedAuth";
import {Logger} from "winston";
import Logging from "./Logging";

export default class DiscordEmbed {
    private appLogger: Logger;
    private discordAppClient: Client;
    private appConfiguration: Configuration;
    private serverStatsFeed: ServerStatusFeed;
    private firstMessageId: Snowflake | null = null;

    public constructor(discordAppClient: Client) {
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
     * Update the discord embed with the server status, player list and server time
     * This method is called every x seconds to update the discord embed.
     * @private
     */
    private async updateDiscordEmbed(): Promise<void> {
        try {
            await this.serverStatsFeed.updateServerFeed();
            if(this.serverStatsFeed.isFetching()) {
                this.appLogger.info('Server status feed is still fetching, try again...');
                setTimeout(() => {
                    this.updateDiscordEmbed();
                }, 1000);
                return;
            }
            this.discordAppClient.channels.fetch(this.appConfiguration.discord.channelId as Snowflake).then(async channel => {
                /**
                 * Send the initial message to the channel (if the first message id is not set) or
                 * the message is meanwhile deleted
                 * @param embedMessage
                 */
                let sendInitialMessage = (embedMessage: EmbedBuilder) => {
                    // noinspection JSAnnotator
                    (channel as TextChannel).send({embeds: [embedMessage]}).then(message => {
                        this.firstMessageId = message.id;
                    });
                };

                this.generateEmbedFromStatusFeed(this.serverStatsFeed).then(embedMessage => {
                    if (this.firstMessageId !== null) {
                        (channel as TextChannel).messages.fetch(this.firstMessageId).then(message => {
                            this.appLogger.info(`Message found, editing message with new embed`);
                            message.edit({embeds: [embedMessage]});
                        }).catch(() => {
                            this.appLogger.warn('Message not found, sending new message');
                            sendInitialMessage(embedMessage);
                        });
                    } else {
                        this.appLogger.info(`No message found, sending new message`);
                        sendInitialMessage(embedMessage);
                    }
                });
            });
        } catch (exception) {
            this.appLogger.error(exception);
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
        let textChannel = this.discordAppClient.channels.cache.get(this.appConfiguration.discord.channelId as Snowflake) as TextChannel;
        this.appLogger.info(`Deleting all messages in discord text channel ${textChannel.id}`);
        textChannel.messages.fetch().then(messages => {
            messages.forEach(message => {
                message.delete();
            });
        });
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