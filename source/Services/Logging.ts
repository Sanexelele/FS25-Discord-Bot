import winston, {Logger} from "winston";

/**
 * Default `error`: quiet during normal operation. Set LOG_LEVEL=info for debugging.
 */
export default class Logging {
    private static instance: Logger | null = null;

    public static getLogger(): Logger {
        if (Logging.instance) {
            return Logging.instance;
        }
        const envLevel = process.env.LOG_LEVEL || "error";
        if (envLevel === "silent" || envLevel === "none") {
            Logging.instance = winston.createLogger({
                silent: true,
                transports: [new winston.transports.Console({silent: true})],
            });
            return Logging.instance;
        }
        Logging.instance = winston.createLogger({
            level: envLevel,
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
        return Logging.instance;
    }
}
