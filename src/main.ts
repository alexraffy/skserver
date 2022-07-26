import {Timer} from "./Timer/Timer";
import {gracefulShutdown, taskDone, taskStarted} from "./gracefulShutdown";
import {Logger} from "./Logger/Logger";
import {checkData, checkFolders} from "./Data/checkData";
import {SKSQL} from "sksql";
import fs from "fs";
import {CSocket} from "./Socket/CSocket";
import {backup} from "./Backup/backup";
import {checkPreviousShutdown} from "./Backup/checkPreviousShutdown";
import {writePID} from "./Backup/writePID";
import {callbackDropTable} from "./Data/callbackDropTable";
import {updateWorkerStatus} from "./updateWorkerStatus";
import {encrypt} from "./Data/encrypt";
import {decrypt} from "./Data/decrypt";

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
    heartBeatTimer: Timer;
    socket: CSocket;
    taskCounter: number;
    encryptionKey: string;
    pathTo7ZExecutable: string;
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
    let encryptionKey = process.env.SKWORKER_ENCRYPTION;
    if (encryptionKey !== undefined && encryptionKey === "") {
        encryptionKey = undefined;
    }
    const port = parseInt(sport);
    const alive = parseInt(sAlive);
    await checkFolders(databasePath);
    let logFileName = new Date().toISOString() + "$" + workerId;
    while (logFileName.indexOf(":") > -1) {
        logFileName = logFileName.replace(":", "_");
    }
    let _ = new Logger(databasePath, logFileName);

    Logger.instance.write("SKServer v" + VERSION);
    Logger.instance.write("WorkerId: " + workerId);
    Logger.instance.write("Port: " + port);
    Logger.instance.write("Alive: " + alive + " seconds");
    Logger.instance.write("Data: " + databasePath);
    Logger.instance.write("Encryption: " + (encryptionKey !== undefined) ? "YES" : "NO");
    const sklib = "";

    process.on("SIGINT", () => {
        if (Logger.instance) {
            Logger.instance.write("Shutdown requested by user.");
        }
        gracefulShutdown(0);
    });

    process.on('SIGTERM', () => {
        if (Logger.instance) {
            Logger.instance.write("Shutdown requested by user.");
        }
        gracefulShutdown(0);
    });

    process.on('message', (msg: {action: string}) => {
        if (msg.action === 'STOP') {
            if (Logger.instance) {
                Logger.instance.write("Shutdown requested by user.");
            }
            gracefulShutdown(0);
        }
    });


    ServerState = {
        db: undefined,
        workerId: workerId,
        port: port,
        databasePath: databasePath,
        alive: alive,
        shutdownRequested: false,
        shutdownTimer: undefined,
        heartBeatTimer: undefined,
        socket: undefined,
        taskCounter: 0,
        encryptionKey: encryptionKey,
        pathTo7ZExecutable: process.env.SKWORKER_7Z || "7z"
    }
    if (getServerState().encryptionKey !== undefined && getServerState().encryptionKey !== "") {
        let testA = new ArrayBuffer(65536);
        let testAdv = new DataView(testA);
        for (let i = 0; i < 65536; i++) {
            testAdv.setUint8(i, i % 255);
        }
        let encrypted = encrypt(testA);
        let decrypted = decrypt(encrypted, false);
        let decryptedDV = new DataView(decrypted);
        for (let i = 0; i < 65536; i++) {
            if (testAdv.getUint8(i) !== decryptedDV.getUint8(i)) {
                throw new Error("encrypted/decrypt error");
            }
        }
    }


    taskStarted();
    Logger.instance.write("Checking for data...");

    let db = new SKSQL();
    db.initWorkerPool(0, sklib);
    db.callbackDropTable = callbackDropTable;
    ServerState.db = db;
    checkPreviousShutdown(db);

    let dataOK = await checkData(db, databasePath);
    taskDone();
    if (dataOK === false) {
        return false;
    }

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

            if (process.env.SKWORKER_HEARTBEAT !== undefined) {
                let heartBeat = new Timer();
                heartBeat.setShutdown(() => {
                    updateWorkerStatus(parseInt(workerId), "RUNNING");
                });
                heartBeat.startTimer(60);
                ServerState.heartBeatTimer = heartBeat;
            }

        }

        let cs = new CSocket(db);
        ServerState.socket = cs;
        cs.setup(port);
        Logger.instance.write("Socket listening on port " + port);
        writePID();
        if (process.env.SKWORKER_HEARTBEAT !== undefined) {
            updateWorkerStatus(parseInt(workerId), "RUNNING");
        }

    });




}


main();