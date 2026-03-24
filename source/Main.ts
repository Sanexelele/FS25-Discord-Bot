import {Client, IntentsBitField} from 'discord.js';
import Configuration from "./Services/Configuration";
import Logging from "./Services/Logging";
import DiscordService from "./Services/DiscordEmbed";
import VersionChecker from './Services/VersionChecker';

// Create a new logger instance and configuration instance
const appLogger = Logging.getLogger();
const appConfig: Configuration = new Configuration();

// Log the application start and version
const packageJson = require('../package.json');
appLogger.info(`Starting | App: ${packageJson.name} | Version: ${packageJson.version}`);
appLogger.info(`----------------------------------------------------`);

/**
 * Check if the configuration is valid and exit the application if it is not
 */
if(!appConfig.isConfigurationValid()) {
    appLogger.error("Configuration is not valid. Exiting application.");
    process.exit(1);
}

/**
 * Check the version of the bot and log if it is up to date
 */
const versionChecker = new VersionChecker();
versionChecker.checkVersionIsUpdated().then((isUpToDate: boolean): void => {
    if (!isUpToDate) {
        appLogger.warn(`====================================================`);
        appLogger.warn(`====================================================`);
        appLogger.warn(`The bot is not up to date. Please update it soon.`);
        appLogger.warn(`Use the command 'git pull && docker compose up -d --build' to update the bot.`);
        appLogger.warn(`====================================================`);
        appLogger.warn(`====================================================`);

    } else {
        appLogger.info(`The bot is up to date. No update needed.`);
    }
});

/**
 * Create a new discord client instance
 */
const discordClient = new Client({
    intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages]
});

/**
 * Start the discord client and log in
 * After that create a new DiscordService instance to start the server stats feed
 */
discordClient.login(appConfig.discord.botToken).then(() => {
    appLogger.info(`Login successful to discord with token`);
});

/**
 * Start the DiscordService and restart it if an error occurred
 */
async function startDiscordService(): Promise<void> {
    try {
        new DiscordService(discordClient);
    } catch (exception) {
        appLogger.error(`Restarting the discord service, an error occurred`, exception);
        startDiscordService();
    }
}

discordClient.on('clientReady', () => {
    appLogger.info(`Discord client ready. Logged in as ${discordClient.user?.username}!`);
    startDiscordService();
});
