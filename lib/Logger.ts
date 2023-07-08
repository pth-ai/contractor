export interface Logger {
    debug: (message: string, meta?: object) => void;
    info: (message: string, meta?: object) => void;
    error: (message: string, error: any, meta?: object) => void;
}

export const basicLogger: Logger = {
    debug(message: string, meta: object | undefined): void {
        console.debug("[DEBUG]", message, meta)
    },
    error(message: string, error: any, meta: object | undefined): void {
        console.error("[ERROR]", message, error, meta)
    },
    info(message: string, meta: object | undefined): void {
        console.info("[INFO]", message, meta);
    }
}

export const prefixedLogger = (prefix: string): Logger => ({
    debug(message: string, meta: object | undefined): void {
        console.debug(`[${prefix}][DEBUG]`, message, meta)
    },
    error(message: string, error: any, meta: object | undefined): void {
        console.error(`[${prefix}][ERROR]`, message, error, meta)
    },
    info(message: string, meta: object | undefined): void {
        console.info(`[${prefix}][INFO]`, message, meta);
    }
});