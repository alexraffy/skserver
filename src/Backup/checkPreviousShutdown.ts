
import * as fs from "fs";
import * as path from "path";
import {SKSQL} from "sksql";
import {Logger} from "../Logger/Logger";
import {clearPID} from "./clearPID";



export function checkPreviousShutdown(db: SKSQL) {
    let pidFile = path.normalize(process.env.PWD + "/" + "skserver.pid");
    if (fs.existsSync(pidFile)) {
        Logger.instance.write("Server was not shutdown properly.");
    }
    // check wal

    clearPID();
}