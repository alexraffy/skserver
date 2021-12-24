import {Timer} from "./Timer/Timer";
import {gracefulShutdown} from "./gracefulShutdown";
import {Logger} from "./Logger/Logger";
import {checkData, checkFolders} from "./Data/checkData";
import {DBData} from "sksql";
import fs from "fs";
import {CSocket} from "./Socket/CSocket";

const VERSION = 1.0;

export async function main() {
    const databasePath = process.env.SKDB_PATH;
    const workerId = process.env.SKWORKER_ID;
    const sport = process.env.SKWORKER_PORT;
    const port = parseInt(sport);
    const alive = 60 * 5;
    await checkFolders(databasePath);
    let _ = new Logger(databasePath, workerId);
    Logger.instance.write("SKServer v" + VERSION);
    Logger.instance.write("WorkerId: " + workerId);
    Logger.instance.write("Port: " + port);
    Logger.instance.write("Alive: " + alive + " seconds");
    Logger.instance.write("Data: " + databasePath);
    const sklib = "";
    Logger.instance.write("Checking for data...");

    let db = new DBData();
    db.initWorkerPool(0, sklib);
    let ret = await checkData(databasePath);

    let autoShutdown = new Timer();
    autoShutdown.setShutdown(gracefulShutdown);
    autoShutdown.startTimer(60 * 5);


    let cs = new CSocket();
    cs.setup(port);
    Logger.instance.write("Socket listening on port " + port);


}


main();