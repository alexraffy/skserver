import {SKSQL} from "sksql";
import * as path from "path";
import * as fs from "fs";
import {Logger} from "../Logger/Logger";
import {getServerState} from "../main";


export function callbackDropTable(db: SKSQL, tableName: string) {
    tableName = tableName.toUpperCase();
    const databasePath = getServerState().databasePath;
    const dbPath = path.normalize(databasePath + "/db/");
    if (tableName.startsWith('#') || tableName.toUpperCase() === "DUAL") {
        return;
    }
    const headerFilename = path.normalize(dbPath + "/" + tableName + ".head");
    const blocksFolder = path.normalize(dbPath + "/" + tableName + "/");
    try {
        fs.rmSync(headerFilename, {force: true});
        fs.rmSync(blocksFolder, {recursive: true});
    } catch (e) {
        Logger.instance.write("CRITICAL ERROR: COULD NOT DELETE TABLE " + tableName);
        Logger.instance.write("Error: " + e.message);
    }

}