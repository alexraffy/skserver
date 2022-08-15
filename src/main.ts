import {Timer} from "./Timer/Timer";
import {gracefulShutdown, taskDone, taskStarted} from "./gracefulShutdown";
import {Logger} from "./Logger/Logger";
import {checkData, checkFolders} from "./Data/checkData";
import {generateV4UUID, SKSQL, TDateTime, TWSRSQL, WSRSQL, WSRSQLResponse} from "sksql";
import {CSocket} from "./Socket/CSocket";
import {backup} from "./Backup/backup";
import {checkPreviousShutdown} from "./Backup/checkPreviousShutdown";
import {writePID} from "./Backup/writePID";
import {callbackDropTable} from "./Data/callbackDropTable";
import {updateWorkerStatus} from "./updateWorkerStatus";
import {encrypt} from "./Data/encrypt";
import {decrypt} from "./Data/decrypt";
import * as path from "path";
import {getPackageJSONVersion} from "./getPackageJSONVersion";
import * as os from "os";
import * as fs from "fs";
import {Stats} from "fs";
import {readTokenFile} from "./readTokenFile";
import {WebSocket} from "ws";

//@ts-ignore
global["WebSocket"] = WebSocket;

const {
    performance,
    PerformanceObserver
} = require('perf_hooks');

const VERSION = getPackageJSONVersion(path.normalize("./package.json"));

export interface TServerState {
    pwd: string;
    db: SKSQL;
    relayMode: boolean;
    relayAddress: string;
    relayToken: string;
    workerId: string;
    port: number;
    databasePath: string;
    alive: number;
    shutdownRequested: boolean;
    shutdownTimer: Timer;
    heartBeatTimer: Timer;
    heartBeatHost: string;
    socket: CSocket;
    taskCounter: number;
    encryptionKey: string;
    pathTo7ZExecutable: string;
    remoteOnly: boolean;
    readOnly: boolean;
    logFile: string;
    tokenFile: string;
    tokenList: {token: string, expiry: TDateTime, rights: string}[];
    privateDB: boolean;
}

var ServerState : TServerState = undefined;

export function getServerState(): TServerState {
    return ServerState;
}


function usage() {
    console.log("SKSERVER v" + VERSION);
    console.log("Usage:");
    console.log("node build/main.js [options]");
    console.log("");

    console.log("Server Mode");
    console.log("Required parameters:");
    console.log("--dbPath=".padEnd(24, " ") + "Path to the database folder.");
    console.log("--port=".padEnd(24, " ") + "Port number for the websocket.");
    console.log("Optional server parameters:")
    console.log("--encryption=KEY".padEnd(24, " ") +"An optional key for encrypting/decrypting the db.");
    console.log("--7z=PATH".padEnd(24, " ") + "Path to the 7z executable for backing up.");
    console.log("--tokenList=PATH".padEnd(24, " ") + "Path to a flat file containing a list of tokens.");

    console.log("");
    console.log("Relay Mode");
    console.log("Required parameters:");
    console.log("--relay=".padEnd(24, " ") + "WS address of the server.");
    console.log("--port=".padEnd(24, " ") + "Port number for the websocket.");
    console.log("Optional relay parameter:")
    console.log("--relayToken=".padEnd(24, " ") + "Token to authenticate with the distant server.")

    console.log("");
    console.log("Other parameters:");
    console.log("--id=".padEnd(24, " ") + "The server unique id.");
    console.log("--alive=".padEnd(24, " ") + "Number of seconds before shutting down due to inactivity.");
    console.log("--heartbeat=".padEnd(24, " ") + "WS address of the monitor." );
    console.log("--remoteonly=YES/NO".padEnd(24, " ") + "If set to YES, clients will not receive a copy of the db.");
    console.log("--readonly=YES/NO".padEnd(24, " ") + "If set to YES, no data can be modified with CREATE/INSERT/UPDATE/DELETE/DROP.");
    console.log("");
    console.log("Parameters can also be set with ENVIRONMENT VARS:");

    let envs = [
        {name: "SKSERVER_DBPATH", req: "YES", desc: "Server Mode: Path to the database folder."},
        {name: "SKSERVER_PORT", req: "YES", desc: "Port number for the websocket."},
        {name: "SKSERVER_RELAY", req: "YES", desc: "Relay Mode: WS address of the server to connect to."},
        {name: "SKSERVER_RELAYTOKEN", req: "   ", desc: "Relay Mode: Token to authenticate with the distant server."},
        {name: "SKSERVER_ID", req: "   ", desc: "The server unique id."},
        {name: "SKSERVER_ALIVE", req: "   ", desc: "Number of seconds before shutting down due to inactivity."},
        {name: "SKSERVER_7Z", req: "   ", desc: "Server Mode: Path to the 7z executable for backing up."},
        {name: "SKSERVER_ENCRYPTION", req: "   ", desc: "Server Mode: An optional key for encrypting/decrypting the db."},
        {name: "SKSERVER_HEARTBEAT", req: "   ", desc: "ws address of the monitor."},
        {name: "SKSERVER_REMOTEONLY", req: "   ", desc: "If set to YES, clients will not receive a copy of the db." },
        {name: "SKSERVER_READONLY", req: "   ", desc: "If set to YES, no data can be modified with CREATE/INSERT/UPDATE/DELETE/DROP."},
        {name: "SKSERVER_TOKENLIST", req: "   ", desc: "Path to a flat file containing a list of tokens."}
    ];
    let str = "";
    for (let i = 0; i < envs.length; i++) {
        str += envs[i].name.padEnd(24, " ") + "" + envs[i].desc + "\n";
    }
    console.log(str);
    process.exit(0);
}


async function init() {

    ServerState = {
        pwd: process.env.PWD,
        relayAddress: undefined,
        relayMode: false,
        relayToken: undefined,
        db: undefined,
        workerId: undefined,
        port: 0,
        databasePath: undefined,
        alive: 0,
        shutdownRequested: false,
        shutdownTimer: undefined,
        heartBeatTimer: undefined,
        heartBeatHost: undefined,
        socket: undefined,
        taskCounter: 0,
        encryptionKey: undefined,
        pathTo7ZExecutable: "7z",
        remoteOnly: false,
        readOnly: false,
        logFile: undefined,
        tokenFile: undefined,
        tokenList: [],
        privateDB: false
    };

    for (let i = 0; i < process.argv.length; i++) {
        let arg = process.argv[i];
        let argU = arg.toUpperCase();
        if (argU.startsWith("--help".toUpperCase())) {
            return usage();
        } if (argU.startsWith("--relay=".toUpperCase())) {
            ServerState.relayMode = true;
            ServerState.relayAddress = arg.substring(8);
        } else if (argU.startsWith("--relayToken=".toUpperCase())) {
            ServerState.relayMode = true;
            ServerState.relayToken = arg.substring(13);
        } else if (argU.startsWith("--dbPath=".toUpperCase())) {
            ServerState.relayMode = false;
            ServerState.databasePath = arg.substring(9);
        } else if (argU.startsWith("--tokenList=".toUpperCase())) {
            ServerState.tokenFile = arg.substring(12);
            ServerState.privateDB = true;
        } else if (argU.startsWith("--id=".toUpperCase())) {
            ServerState.workerId = arg.substring(5);
        } else if (argU.startsWith("--port=".toUpperCase())) {
            let sPort = arg.substring(7);
            ServerState.port = parseInt(sPort);
        } else if (argU.startsWith("--alive=".toUpperCase())) {
            let sAlive = arg.substring(8);
            ServerState.alive = parseInt(sAlive);
        } else if (argU.startsWith("--heartbeat=".toUpperCase())) {
            ServerState.heartBeatHost = arg.substring(12);
        } else if (argU.startsWith("--7z=".toUpperCase())) {
            ServerState.pathTo7ZExecutable = arg.substring(5);
        } else if (argU.startsWith("--encryption=".toUpperCase())) {
            ServerState.encryptionKey = arg.substring(13);
        } else if (argU.startsWith("--readonly=YES".toUpperCase())) {
            ServerState.readOnly = true;
        } else if (argU.startsWith("--remoteonly=YES".toUpperCase())) {
            ServerState.remoteOnly = true;
        } else if (argU.startsWith("--")) {
            console.log("Unknown switch " + arg);
            usage();
            process.exit(0);
        }
    }
    if (process.env.SKSERVER_RELAY !== undefined) {
        ServerState.relayMode = true;
        ServerState.relayAddress = process.env.SKSERVER_RELAY;
    }
    if (process.env.SKSERVER_RELAYTOKEN !== undefined) {
        ServerState.relayMode = true;
        ServerState.relayToken = process.env.SKSERVER_RELAYTOKEN;
        ServerState.privateDB = true;
    }
    if (process.env.SKSERVER_DBPATH !== undefined) {
        ServerState.databasePath = process.env.SKSERVER_DBPATH;
    }
    if (process.env.SKSERVER_ID !== undefined) {
        ServerState.workerId = process.env.SKSERVER_ID;
    }
    if (process.env.SKSERVER_PORT !== undefined) {
        let sPort = process.env.SKSERVER_PORT;
        ServerState.port = parseInt(sPort);
    }
    if (process.env.SKSERVER_ALIVE !== undefined) {
        let sAlive = process.env.SKSERVER_ALIVE;
        ServerState.alive = parseInt(sAlive);
    }
    if (process.env.SKSERVER_REMOTEONLY !== undefined) {
        if (process.env.SKSERVER_REMOTEONLY.toUpperCase() === "YES") {
            ServerState.remoteOnly = true;
        } else if (process.env.SKSERVER_REMOTEONLY.toUpperCase() === "NO") {
            ServerState.remoteOnly = false;
        }
    }
    if (process.env.SKSERVER_READONLY !== undefined) {
        if (process.env.SKSERVER_READONLY.toUpperCase() === "YES") {
            ServerState.readOnly = true;
        } else if (process.env.SKSERVER_READONLY.toUpperCase() === "NO") {
            ServerState.readOnly = false;
        }
    }
    if (process.env.SKSERVER_ENCRYPTION !== undefined) {
        ServerState.encryptionKey = process.env.SKSERVER_ENCRYPTION;
    }
    if (process.env.SKSERVER_7Z !== undefined) {
        ServerState.pathTo7ZExecutable = process.env.SKSERVER_7Z;
    }
    if (process.env.SKSERVER_HEARTBEAT !== undefined) {
        ServerState.heartBeatHost = process.env.SKSERVER_HEARTBEAT;
    }
    if (process.env.SKSERVER_TOKENLIST !== undefined) {
        ServerState.tokenFile = process.env.SKSERVER_TOKENLIST;
        ServerState.privateDB = true;
    }

    if ((ServerState.databasePath === undefined || ServerState.databasePath === "") &&
        (ServerState.relayAddress === undefined || ServerState.relayAddress === "")) {
        return usage();
    }
    if (ServerState.workerId === undefined) {
        ServerState.workerId = "0";
    }
    if (ServerState.port === undefined || ServerState.port === 0 || isNaN(ServerState.port)) {
        return usage();
    }
    if (ServerState.encryptionKey === "" || ServerState.relayMode === true) {
        ServerState.encryptionKey = undefined;
    }
    if (ServerState.heartBeatHost === "") {
        ServerState.heartBeatHost = undefined;
    }

    let logFileName = new Date().toISOString() + "$" + ServerState.workerId;
    while (logFileName.indexOf(":") > -1) {
        logFileName = logFileName.replace(":", "_");
    }

    if (ServerState.relayMode === true) {
        ServerState.databasePath = path.normalize(os.tmpdir() + "/" + generateV4UUID());
    }
    await checkFolders(ServerState.databasePath);
    let _ = new Logger(ServerState.databasePath, logFileName);
    ServerState.logFile = path.normalize(ServerState.databasePath + "/logs/" + logFileName + ".log");


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

    if (ServerState.tokenFile !== undefined && ServerState.tokenFile !== "") {
        fs.watchFile(ServerState.tokenFile, {persistent: true}, (curr: Stats, prev: Stats) => {
            if (curr.mtimeMs !== prev.mtimeMs) {
                readTokenFile();
            }
        });
        readTokenFile();
    }

}


export async function main() {

    await init();

    Logger.instance.write("SKServer v" + VERSION);
    let sksqlVersion = "";
    if (process.env.PWD !== undefined) {
        sksqlVersion = getPackageJSONVersion(path.normalize(process.env.PWD + "/node_modules/sksql/package.json"));
    } else {
        sksqlVersion = getPackageJSONVersion(path.normalize("./node_modules/sksql/package.json"));
    }
    Logger.instance.write("SKSQL version: v" + sksqlVersion);
    if (ServerState.relayMode === true) {
        Logger.instance.write("RUNNING IN RELAY MODE...");
        Logger.instance.write("Relay: " + ServerState.relayAddress);
        Logger.instance.write("Temp Data: " + ServerState.databasePath);
    } else {
        Logger.instance.write("RUNNING IN SERVER MODE...");
        Logger.instance.write("Data: " + ServerState.databasePath);
    }
    Logger.instance.write("Port: " + ServerState.port);
    Logger.instance.write("Id: " + ServerState.workerId);
    Logger.instance.write("Alive: " + ServerState.alive + " seconds");
    Logger.instance.write("Encryption: " + ((ServerState.encryptionKey !== undefined) ? "YES" : "NO"));
    Logger.instance.write("Read Only: " + ((ServerState.readOnly) ? "YES" : "NO"));
    Logger.instance.write("Remote Only: " + ((ServerState.remoteOnly) ? "YES" : "NO"));
    Logger.instance.write("7z: " + ServerState.pathTo7ZExecutable);
    Logger.instance.write("Heartbeat: " + ServerState.heartBeatHost);
    Logger.instance.write("Log: " + ServerState.logFile);
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






    Logger.instance.write("Checking for data...");

    let db = new SKSQL();
    ServerState.db = db;
    db.initWorkerPool(0, sklib);
    let dataOK = true;
    if (ServerState.relayMode === true) {
        db.callbackDropTable = () => {};
        db.callbackRenameTable = () => {};
        Logger.instance.write("Relay connecting to " + ServerState.relayAddress);
        dataOK = await db.connectAsync(ServerState.relayAddress, ServerState.relayToken, "Relay " + ServerState.workerId, ServerState.remoteOnly);
        if (dataOK === false) {
            Logger.instance.write("Relay could not connect to " + ServerState.relayAddress);
            return gracefulShutdown(0);
        }
        db.getConnectionInfoForDB().delegate.on = (db, databaseHashId, message, payload) => {
            if (message === WSRSQL) {
                getServerState().socket.broadcast((payload as TWSRSQL).id, message, payload);
            }
            if (message === WSRSQLResponse) {
                getServerState().socket.broadcast((payload as TWSRSQL).id, message, payload);
            }
        }
        db.getConnectionInfoForDB().delegate.connectionLost = (db1, databaseHashId) => {
            if (Logger.instance) {
                Logger.instance.write("Connection to server lost.");
                gracefulShutdown(0);
            }
        }
        ready(db);
    } else {
        taskStarted();
        db.callbackDropTable = callbackDropTable;
        checkPreviousShutdown(db);
        dataOK = await checkData(db, ServerState.databasePath);
        if (dataOK === false) {
            taskDone();
            return false;
        }
        backup(ServerState.databasePath, db, (db, backupName, success) => {
            taskDone();
            ready(db);
        });
    }






}

function ready(db: SKSQL) {
    if (ServerState.alive !== 0 ) {
        let autoShutdown = new Timer();
        autoShutdown.setShutdown(() => {
            if (Logger.instance) {
                Logger.instance.write("Shutting down for inactivity...");
            }
            gracefulShutdown(0);
        });
        autoShutdown.startTimer(ServerState.alive);
        ServerState.shutdownTimer = autoShutdown;

        if (ServerState.heartBeatHost !== undefined) {
            let heartBeat = new Timer();
            heartBeat.setShutdown(() => {
                updateWorkerStatus(parseInt(ServerState.workerId), "RUNNING");
            });
            heartBeat.startTimer(60);
            ServerState.heartBeatTimer = heartBeat;
        }

    }

    let cs = new CSocket(db);
    ServerState.socket = cs;
    cs.setup(ServerState.port);
    Logger.instance.write("Socket listening on port " + ServerState.port);
    writePID();
    if (ServerState.heartBeatHost !== undefined) {
        updateWorkerStatus(parseInt(ServerState.workerId), "RUNNING");
    }
}



main();