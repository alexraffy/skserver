import {Logger} from "./Logger/Logger";
import {getServerState} from "./main";
import {clearPID} from "./Backup/clearPID";


process.on('SIGTERM', () => {
    if (Logger.instance) {
        Logger.instance.write("Shutdown requested");
    }

    gracefulShutdown(0);
});


export function taskStarted() {
    getServerState().taskCounter++;
}

export function taskDone() {
    getServerState().taskCounter--;
}


export function gracefulShutdown(code: number) {
    if (Logger.instance) {
        Logger.instance.write("Shutdown requested...");
    }
    getServerState().shutdownRequested = true;
    taskDone();
    let timeoutFunction = () => {
        if (getServerState().taskCounter <= 0) {
            if (Logger.instance) {
                Logger.instance.write("Shutting down with code ", String(code));
                Logger.instance.close();
            }
            getServerState().socket.closeAll();
            clearPID();
            return process.exit(code);
        }
        setTimeout(timeoutFunction, 100);
    }

    setTimeout(timeoutFunction, 100);
}