import {Logger} from "./Logger/Logger";
import {getServerState} from "./main";
import {clearPID} from "./Backup/clearPID";
import {updateWorkerStatus} from "./updateWorkerStatus";




export function taskStarted() {

    getServerState().taskCounter++;
    //Logger.instance.write("taskStarted " + getServerState().taskCounter);
}

export function taskDone() {
    getServerState().taskCounter--;
    //Logger.instance.write("taskDone " + getServerState().taskCounter);
}


export function gracefulShutdown(code: number) {
    if (Logger.instance) {
        Logger.instance.write("Shutting down in progress...");
    }
    getServerState().shutdownRequested = true;

    if (getServerState().shutdownTimer !== undefined) {
        getServerState().shutdownTimer.stop();
    }
    if (getServerState().heartBeatTimer !== undefined) {
        getServerState().shutdownTimer.stop();
    }

    let timeoutFunction = () => {
        if (getServerState().taskCounter <= 0) {
            if (Logger.instance) {
                Logger.instance.write("Shutting down with code ", String(code));
                Logger.instance.close();
            }
            if (getServerState().socket !== undefined) {
                getServerState().socket.closeAll();
            }
            clearPID();
            if (process.env.SKWORKER_HEARTBEAT !== undefined) {
                updateWorkerStatus(parseInt(getServerState().workerId), "DOWN").then((v) => {
                   process.exit(code);
                });
            } else {
                process.exit(code);
            }
        } else {
            setTimeout(timeoutFunction, 100);
        }
    }

    setTimeout(timeoutFunction, 100);
}