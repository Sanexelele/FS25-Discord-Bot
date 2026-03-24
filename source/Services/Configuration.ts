import IDiscordConfiguration from "../Interfaces/Configuration/IDiscordConfiguration";
import IApplicationConfiguration from "../Interfaces/Configuration/IApplicationConfiguration";
import IConfiguration from "../Interfaces/Configuration/IConfiguration";
import ITranslation from "../Interfaces/Configuration/ITranslation";
import Logging from "./Logging";
import {Logger} from "winston";

export default class Configuration implements IConfiguration{
    private readonly logger: Logger;
    public readonly discord: IDiscordConfiguration;
    public readonly application: IApplicationConfiguration;
    public readonly translation: ITranslation;

    constructor() {
        this.logger = Logging.getLogger();
        try {
            let config = require('../../config.json');
            this.discord = config.discord;
            this.application = config.application;
            this.translation = config.translation;
        } catch (exception) {
            this.logger.error("Error while loading configuration file, please check if the configuration file exists and is valid.");
            process.exit(1);
        }
    }

    /**
     * Returns true if the value is empty or undefined
     * @param value
     * @private
     */
    private isValueEmptyOrUndefined(value: any): boolean {
        return value == null || value == "" || value == undefined;
    }

    /**
     * Returns true if the value is undefined
     * @param value
     * @private
     */
    private isValueUndefined(value: any): boolean {
        return value == undefined;
    }

    /**
     * Validates the discord configuration and returns true if the configuration is valid
     * @private
     */
    private validateDiscordConfiguration(): boolean {
        return !(this.isValueEmptyOrUndefined(this.discord?.botToken) || this.isValueEmptyOrUndefined(this.discord?.channelId));
    }

    /**
     * Validates the application configuration and returns true if the configuration is valid
     * @private
     */
    private validateApplicationConfiguration(): boolean {
        return !(
            this.isValueUndefined(this.application?.serverPassword)
            || this.isValueEmptyOrUndefined(this.application?.serverStatsUrl)
            || this.isValueEmptyOrUndefined(this.application?.serverMapUrl)
            || this.isValueEmptyOrUndefined(this.application?.updateIntervalSeconds)
        );
    }

    /**
     * Validates the translation configuration and returns true if the configuration is valid
     * @private
     */
    private validateTranslationConfiguration(): boolean {
        return !(
            this.isValueEmptyOrUndefined(this?.translation?.discordEmbed?.title)
            || this.isValueEmptyOrUndefined(this?.translation?.discordEmbed?.descriptionOnline)
            || this.isValueEmptyOrUndefined(this?.translation?.discordEmbed?.descriptionOffline)
            || this.isValueEmptyOrUndefined(this?.translation?.discordEmbed?.descriptionUnknown)
            || this.isValueEmptyOrUndefined(this?.translation?.discordEmbed?.titleServerName)
            || this.isValueEmptyOrUndefined(this?.translation?.discordEmbed?.titleServerPassword)
            || this.isValueEmptyOrUndefined(this?.translation?.discordEmbed?.titleServerTime)
            || this.isValueEmptyOrUndefined(this?.translation?.discordEmbed?.titleServerMap)
            || this.isValueEmptyOrUndefined(this?.translation?.discordEmbed?.titleServerMods)
            || this.isValueEmptyOrUndefined(this?.translation?.discordEmbed?.titlePlayerCount)
            || this.isValueEmptyOrUndefined(this?.translation?.discordEmbed?.noPlayersOnline)
            || this.isValueEmptyOrUndefined(this?.translation?.common?.monthJanuary)
            || this.isValueEmptyOrUndefined(this?.translation?.common?.monthFebruary)
            || this.isValueEmptyOrUndefined(this?.translation?.common?.monthMarch)
            || this.isValueEmptyOrUndefined(this?.translation?.common?.monthApril)
            || this.isValueEmptyOrUndefined(this?.translation?.common?.monthMay)
            || this.isValueEmptyOrUndefined(this?.translation?.common?.monthJune)
            || this.isValueEmptyOrUndefined(this?.translation?.common?.monthJuly)
            || this.isValueEmptyOrUndefined(this?.translation?.common?.monthAugust)
            || this.isValueEmptyOrUndefined(this?.translation?.common?.monthSeptember)
            || this.isValueEmptyOrUndefined(this?.translation?.common?.monthOctober)
            || this.isValueEmptyOrUndefined(this?.translation?.common?.monthNovember)
            || this.isValueEmptyOrUndefined(this?.translation?.common?.monthDecember)
        );
    }

    /**
     * Validates the configuration file and returns true if the configuration is valid
     * @returns boolean True if the configuration is valid
     */
    public isConfigurationValid(): boolean {
        if(!this.validateDiscordConfiguration()) {
            this.logger.error("Discord configuration is not valid. Please check your configuration file.");
            return false;
        }

        if(!this.validateApplicationConfiguration()) {
            this.logger.error("Application configuration is not valid. Please check your configuration file.");
            return false;
        }

        if(!this.validateTranslationConfiguration()) {
            this.logger.error("Translation configuration is not valid. Please check your configuration file.");
            return false;
        }
        return true;
    }

    /**
     * Returns the configuration object
     */
    public static getConfiguration(): IConfiguration {
        return new Configuration();
    }
}