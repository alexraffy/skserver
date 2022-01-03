import {Logger} from "./Logger/Logger";


export function gracefulShutdown(code: number) {

    

    if (Logger.instance) {
        Logger.instance.write("Shutting down with code ", String(code));
        Logger.instance.close();
    }
    process.exit(code);
}