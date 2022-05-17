import {Timer} from "./Timer/Timer";
import {gracefulShutdown, taskStarted} from "./gracefulShutdown";
import {Logger} from "./Logger/Logger";
import {checkData, checkFolders} from "./Data/checkData";
import {SKSQL} from "sksql";
import fs from "fs";
import {CSocket} from "./Socket/CSocket";
import {backup} from "./Backup/backup";
import {checkPreviousShutdown} from "./Backup/checkPreviousShutdown";
import {writePID} from "./Backup/writePID";

const {
    performance,
    PerformanceObserver
} = require('perf_hooks');

const VERSION = 1.0;

export interface TServerState {
    db: SKSQL;
    workerId: string;
    port: number;
    databasePath: string;
    alive: number;
    shutdownRequested: boolean;
    shutdownTimer: Timer;
    socket: CSocket;
    taskCounter: number;
}

var ServerState : TServerState = undefined;

export function getServerState(): TServerState {
    return ServerState;
}

export async function main() {
    const databasePath = process.env.SKDB_PATH;
    const workerId = process.env.SKWORKER_ID;
    const sport = process.env.SKWORKER_PORT;
    const sAlive = process.env.SKWORKER_ALIVE || "0";
    const port = parseInt(sport);
    const alive = parseInt(sAlive);
    await checkFolders(databasePath);
    let _ = new Logger(databasePath, workerId);
    Logger.instance.write("SKServer v" + VERSION);
    Logger.instance.write("WorkerId: " + workerId);
    Logger.instance.write("Port: " + port);
    Logger.instance.write("Alive: " + alive + " seconds");
    Logger.instance.write("Data: " + databasePath);
    const sklib = "";

    ServerState = {
        db: undefined,
        workerId: workerId,
        port: port,
        databasePath: databasePath,
        alive: alive,
        shutdownRequested: false,
        shutdownTimer: undefined,
        socket: undefined,
        taskCounter: 0
    }

    taskStarted();
    Logger.instance.write("Checking for data...");

    let db = new SKSQL();
    db.initWorkerPool(0, sklib);
    ServerState.db = db;
    checkPreviousShutdown(db);

    let ret = await checkData(db, databasePath);
    backup(databasePath, db, (db, backupName, success) => {

        if (alive !== 0 ) {
            let autoShutdown = new Timer();
            autoShutdown.setShutdown(() => {
                if (Logger.instance) {
                    Logger.instance.write("Shutting down for inactivity...");
                }
                gracefulShutdown(0);
            });
            autoShutdown.startTimer(alive);
            ServerState.shutdownTimer = autoShutdown;
        }

        let cs = new CSocket(db);
        ServerState.socket = cs;
        cs.setup(port);
        Logger.instance.write("Socket listening on port " + port);
        writePID();

    });




}


main();