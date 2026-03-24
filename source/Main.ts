import * as fs from "fs";
import * as path from "path";
import {Client, IntentsBitField, SlashCommandBuilder} from "discord.js";
import Configuration from "./Services/Configuration";
import Logging from "./Services/Logging";
import DiscordService from "./Services/DiscordEmbed";
import VersionChecker from "./Services/VersionChecker";

const appLogger = Logging.getLogger();
const appConfig: Configuration = new Configuration();

const crashLogPath = path.join(__dirname, "..", "bot-crash.log");

function appendCrashLog(kind: string, detail: unknown): void {
    const text =
        detail instanceof Error
            ? `${detail.stack || detail.message}`
            : typeof detail === "object"
              ? JSON.stringify(detail)
              : String(detail);
    const line = `\n${new Date().toISOString()} [${kind}]\n${text}\n`;
    try {
        fs.appendFileSync(crashLogPath, line, "utf8");
    } catch {
        /* disk full / permissions */
    }
}

process.on("uncaughtException", (err: Error) => {
    appendCrashLog("uncaughtException", err);
    appLogger.error(`Uncaught exception: ${err?.message ?? err}`, err);
    process.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
    appendCrashLog("unhandledRejection", reason);
    appLogger.error(`Unhandled rejection: ${reason}`);
});

if (!appConfig.isConfigurationValid()) {
    appLogger.error("Configuration is not valid. Exiting application.");
    process.exit(1);
}

const versionChecker = new VersionChecker();
versionChecker.checkVersionIsUpdated().then((isUpToDate: boolean): void => {
    if (!isUpToDate) {
        appLogger.warn(`The bot is not up to date. Please update it soon.`);
        appLogger.warn(`Use: git pull && docker compose up -d --build`);
    }
});

const discordClient = new Client({
    intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages],
});

discordClient.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) {
        return;
    }
    if (interaction.commandName !== "status") {
        return;
    }
    const svc = DiscordService.getInstance();
    if (!svc) {
        await interaction.reply({content: "Bot is still starting.", ephemeral: true});
        return;
    }
    if (!interaction.channel?.isTextBased()) {
        await interaction.reply({content: "Use this command in a text channel.", ephemeral: true});
        return;
    }
    await interaction.deferReply();
    try {
        const embed = await svc.buildStatusEmbed();
        await interaction.editReply({embeds: [embed]});
    } catch (err: unknown) {
        appLogger.error(err);
        await interaction.editReply({content: "Could not fetch server status."}).catch(() => {});
    }
});

discordClient.login(appConfig.discord.botToken);

async function startDiscordService(): Promise<void> {
    try {
        new DiscordService(discordClient);
    } catch (exception) {
        appLogger.error(`Restarting the discord service, an error occurred`, exception);
        startDiscordService();
    }
}

discordClient.once("clientReady", async () => {
    startDiscordService();
    try {
        const commands = [
            new SlashCommandBuilder()
                .setName("status")
                .setDescription("Post Farming Simulator server status (refreshes the feed now)")
                .toJSON(),
        ];
        const application = discordClient.application;
        if (application) {
            await application.commands.set(commands);
        }
    } catch (err: unknown) {
        appLogger.error("Failed to register slash commands. Re-invite the bot with the applications.commands scope.", err);
    }
});
