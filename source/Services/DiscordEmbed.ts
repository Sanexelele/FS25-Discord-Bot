import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Channel,
    Client,
    EmbedBuilder,
    Snowflake,
    TextChannel,
} from "discord.js";
import Configuration from "./Configuration";
import type {IDiscordServerChannel} from "../Interfaces/Configuration/IDiscordConfiguration";
import type ITranslationDiscordEmbed from "../Interfaces/Configuration/ITranslationDiscordEmbed";
import ServerStatusFeed from "./ServerStatusFeed";
import {icmpPingHost} from "./IcmpPing";
import WebFeedAuth from "./WebFeedAuth";
import {Logger} from "winston";
import Logging from "./Logging";

function guildIdOfChannel(channel: Channel): string | undefined {
    if ("guildId" in channel && channel.guildId != null) {
        return channel.guildId as string;
    }
    return undefined;
}

function isDiscordChannelAccessError(e: unknown): boolean {
    if (typeof e !== "object" || e === null) {
        return false;
    }
    const err = e as { code?: number; message?: string };
    return err.code === 50001 || err.code === 50013;
}

/** Norwegian-style uptime for the bot process */
function formatProcessUptime(): string {
    let sec = Math.floor(process.uptime());
    const d = Math.floor(sec / 86400);
    sec %= 86400;
    const h = Math.floor(sec / 3600);
    sec %= 3600;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    const parts: string[] = [];
    if (d > 0) {
        parts.push(`${d} d`);
    }
    if (h > 0) {
        parts.push(`${h} t`);
    }
    if (m > 0) {
        parts.push(`${m} min`);
    }
    if (parts.length === 0) {
        parts.push(`${s} s`);
    } else if (d === 0 && h === 0) {
        parts.push(`${s} s`);
    }
    return parts.join(" ");
}

function statusDescriptionLine(t: ITranslationDiscordEmbed, mode: "online" | "offline" | "unknown"): string {
    const emoji = mode === "online" ? "🟢" : mode === "offline" ? "🔴" : "🟡";
    const text =
        mode === "online" ? t.descriptionOnline : mode === "offline" ? t.descriptionOffline : t.descriptionUnknown;
    return `${emoji} **${t.titleStatus}** — ${text}`;
}

function fieldName(emoji: string, label: string): string {
    return `${emoji} ${label}`;
}

function hostFromStatsUrl(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return "?";
    }
}

/** Discord rejects empty embed field values; normalize undefined/null/blank to an em dash. */
function embedFieldValue(raw: unknown): string {
    if (raw === undefined || raw === null) {
        return "—";
    }
    const s = String(raw).trim();
    return s.length > 0 ? s : "—";
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
    /** Tracked status message per channel */
    private firstMessageIds = new Map<string, Snowflake>();
    private channelAccessErrorsLogged = new Set<string>();
    private static modPackUrlWarnLogged = false;
    private discordUpdateErrorThrottle = new Map<string, number>();
    private readonly discordUpdateErrorThrottleMs = 120_000;

    public constructor(discordAppClient: Client) {
        DiscordEmbed.instance = this;
        this.appLogger = Logging.getLogger();
        this.discordAppClient = discordAppClient;
        this.appConfiguration = new Configuration();
        this.serverStatsFeed = new ServerStatusFeed();

        (async () => {
            try {
                await this.deleteAllMessages();
                await this.updateDiscordEmbed();
            } catch (e: unknown) {
                Logging.getLogger().warn(`Initial status update failed: ${e instanceof Error ? e.message : String(e)}`);
            }
        })();
    }

    public async buildStatusEmbed(): Promise<EmbedBuilder> {
        await this.serverStatsFeed.updateServerFeed();
        return this.generateEmbedFromStatusFeed(this.serverStatsFeed);
    }

    /** Link button row under the status embed; empty array if URL not set or invalid. */
    public buildStatusComponents(): ActionRowBuilder<ButtonBuilder>[] {
        const raw = this.appConfiguration.application.modPackButtonUrl?.trim();
        if (!raw) {
            return [];
        }
        const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
        let parsed: URL;
        try {
            parsed = new URL(withScheme);
        } catch {
            if (!DiscordEmbed.modPackUrlWarnLogged) {
                DiscordEmbed.modPackUrlWarnLogged = true;
                this.appLogger.warn("application.modPackButtonUrl is not a valid URL; mod pack button disabled.");
            }
            return [];
        }
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            if (!DiscordEmbed.modPackUrlWarnLogged) {
                DiscordEmbed.modPackUrlWarnLogged = true;
                this.appLogger.warn("application.modPackButtonUrl must be http or https; mod pack button disabled.");
            }
            return [];
        }
        const t = this.appConfiguration.translation.discordEmbed;
        const label = (t.labelModPackButton?.trim() || "Link til modpakkene").slice(0, 80);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(withScheme),
        );
        return [row];
    }

    /** ICMP when possible, else HTTP feed latency; value is ms only (no host / protocol labels). */
    private async formatServerLatency(serverStats: ServerStatusFeed): Promise<string> {
        const host = hostFromStatsUrl(this.appConfiguration.application.serverStatsUrl);
        const icmpMs = await icmpPingHost(host);
        if (icmpMs !== null) {
            return `${icmpMs} ms`;
        }
        const httpMs = serverStats.getLastFeedLatencyMs();
        if (httpMs !== null) {
            return `${httpMs} ms`;
        }
        return "—";
    }

    private async updateDiscordEmbed(): Promise<void> {
        try {
            await this.serverStatsFeed.updateServerFeed();
            if (this.serverStatsFeed.isFetching()) {
                setTimeout(() => {
                    this.updateDiscordEmbed();
                }, 1000);
                return;
            }
            const baseEmbed = await this.generateEmbedFromStatusFeed(this.serverStatsFeed);
            const targets = this.appConfiguration.getDiscordStatusTargets();
            for (const target of targets) {
                const embedCopy = EmbedBuilder.from(baseEmbed.toJSON());
                await this.updateChannelStatusEmbed(embedCopy, target);
            }
        } catch (exception: unknown) {
            const msg = exception instanceof Error ? exception.message : String(exception);
            this.appLogger.warn(`Status embed update failed: ${msg}`);
        }

        setTimeout(() => {
            this.updateDiscordEmbed();
        }, this.appConfiguration.application.updateIntervalSeconds * 1000);
    }

    private async updateChannelStatusEmbed(embedMessage: EmbedBuilder, target: IDiscordServerChannel): Promise<void> {
        const channelId = target.channelId;
        try {
            const channel = await this.discordAppClient.channels.fetch(channelId as Snowflake);
            if (!channel?.isTextBased()) {
                return;
            }
            if (target.guildId && guildIdOfChannel(channel) !== target.guildId) {
                return;
            }
            const textChannel = channel as TextChannel;
            const components = this.buildStatusComponents();

            const sendInitialMessage = async (embed: EmbedBuilder) => {
                const message = await textChannel.send({embeds: [embed], components});
                this.firstMessageIds.set(channelId, message.id);
            };

            const firstId = this.firstMessageIds.get(channelId) ?? null;
            if (firstId !== null) {
                try {
                    const message = await textChannel.messages.fetch(firstId);
                    await message.edit({embeds: [embedMessage], components});
                } catch {
                    await sendInitialMessage(embedMessage);
                }
            } else {
                await sendInitialMessage(embedMessage);
            }
        } catch (exception: unknown) {
            if (isDiscordChannelAccessError(exception)) {
                if (!this.channelAccessErrorsLogged.has(channelId)) {
                    this.channelAccessErrorsLogged.add(channelId);
                    this.appLogger.error(
                        `Discord: Missing Access for status channel ${channelId}. Check guildId/channelId in config, ` +
                            `invite the bot, and channel permissions (View Channel, Send Messages, Embed Links, Manage Messages).`
                    );
                }
            } else {
                const code = typeof exception === "object" && exception !== null && "code" in exception
                    ? (exception as {code?: number}).code
                    : undefined;
                const key = `${channelId}:${code ?? "err"}`;
                const now = Date.now();
                const last = this.discordUpdateErrorThrottle.get(key) ?? 0;
                if (now - last >= this.discordUpdateErrorThrottleMs) {
                    this.discordUpdateErrorThrottle.set(key, now);
                    const msg = exception instanceof Error ? exception.message : String(exception);
                    this.appLogger.warn(`Discord status update failed (${channelId}): ${msg}`);
                }
            }
        }
    }

    private async deleteAllMessages(): Promise<boolean> {
        for (const target of this.appConfiguration.getDiscordStatusTargets()) {
            try {
                const channel = await this.discordAppClient.channels.fetch(target.channelId as Snowflake);
                if (!channel?.isTextBased()) {
                    continue;
                }
                if (target.guildId && guildIdOfChannel(channel) !== target.guildId) {
                    continue;
                }
                const textChannel = channel as TextChannel;
                const messages = await textChannel.messages.fetch();
                messages.forEach((message) => {
                    message.delete().catch(() => {});
                });
            } catch {
                /* channel missing, no access, or API error */
            }
        }
        return true;
    }

    private async truncateText(text: string, maxLength = 1024): Promise<string> {
        return text.length > maxLength ? text.slice(0, maxLength - 3) + "..." : text;
    }

    private async generateEmbedFromStatusFeed(serverStats: ServerStatusFeed): Promise<EmbedBuilder> {
        const embed = new EmbedBuilder();
        const config = this.appConfiguration;
        const t = config.translation.discordEmbed;

        embed.setTitle(`🚜 ${t.title}`);

        const latencyValue = await this.formatServerLatency(serverStats);
        const metaFields = [
            {
                name: fieldName("⏱️", t.titleBotUptime),
                value: formatProcessUptime(),
                inline: true,
            },
            {
                name: fieldName("🌐", t.titleServerLatency),
                value: latencyValue,
                inline: true,
            },
        ];

        if (!serverStats.isOnline()) {
            embed.setColor(0xca0000);
            embed.setDescription(statusDescriptionLine(t, "offline"));
            embed.addFields(...metaFields);
        } else if (serverStats.isFetching()) {
            embed.setColor(0xfaa61a);
            embed.setDescription(statusDescriptionLine(t, "unknown"));
            embed.addFields(...metaFields);
        } else {
            embed.setColor(0x00ca00);
            embed.setDescription(statusDescriptionLine(t, "online"));
            embed.setTimestamp(new Date());
            embed.setThumbnail(WebFeedAuth.getMapUrlWithAuth(config.application));

            let playerListString: string;
            let playerListTitleString = `${t.titlePlayerCount} (${serverStats.getPlayerCount() ?? 0}/${serverStats.getMaxPlayerCount() ?? 0}):`;

            if (serverStats.getPlayerList().length === 0) {
                playerListString = t.noPlayersOnline;
            } else {
                playerListString = serverStats.getPlayerList().map((p) => p.username).join(", ");
            }

            let serverPassword = config.application.serverPassword;
            if (config.application.serverPassword == "") {
                serverPassword = "-/-";
            }

            let serverMods = serverStats.getServerMods();
            let serverModsText = "-/-";
            if (serverMods.length > 0) {
                serverModsText = await this.truncateText(serverMods.map((mod) => `${mod.name}`).join(", "));
            }

            embed.addFields(
                ...metaFields,
                // @ts-ignore
                {
                    name: fieldName("🖥️", t.titleServerName),
                    value: embedFieldValue(serverStats.getServerName()),
                },
                {name: fieldName("🔑", t.titleServerPassword), value: embedFieldValue(serverPassword)},
                {name: fieldName("🕐", t.titleServerTime), value: embedFieldValue(serverStats.getServerTime())},
                {name: fieldName("🗺️", t.titleServerMap), value: embedFieldValue(serverStats.getServerMap())},
                {name: fieldName("📦", t.titleServerMods), value: embedFieldValue(serverModsText)},
                {
                    name: fieldName("👥", playerListTitleString),
                    value: embedFieldValue(playerListString),
                },
            );
        }

        const bannerUrl = config.application.embedImageUrl?.trim();
        if (bannerUrl) {
            embed.setImage(bannerUrl);
        }
        return embed;
    }
}
