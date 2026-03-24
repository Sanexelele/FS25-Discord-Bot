import winston, {Logger} from "winston";

/**
 * Default `error`: quiet during normal operation. Set LOG_LEVEL=info for debugging.
 */
export default class Logging {
    public static getLogger(): Logger {
        return winston.createLogger({
            level: process.env.LOG_LEVEL || "error",
            format: winston.format.combine(
                winston.format.timestamp({
                    format: "YYYY-MM-DD HH:mm:ss",
                }),
                winston.format.colorize(),
                winston.format.simple(),
                winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`),
            ),
            transports: [new winston.transports.Console()],
        });
    }
}
