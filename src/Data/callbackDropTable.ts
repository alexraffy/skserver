import {SKSQL} from "sksql";
import * as path from "path";
import fs from "fs";
import {Logger} from "../Logger/Logger";


export function callbackDropTable(db: SKSQL, tableName: string) {
    const databasePath = process.env.SKDB_PATH;
    const dbPath = path.normalize(databasePath + "/db/");
    if (tableName.startsWith('#') || tableName === "dual") {
        return;
    }
    const headerFilename = path.normalize(dbPath + "/" + tableName + ".head");
    const blocksFolder = path.normalize(dbPath + "/" + tableName + "/");
    try {
        fs.rmSync(headerFilename, {force: true});
        fs.rmdirSync(blocksFolder, {recursive: true});
    } catch (e) {
        Logger.instance.write("CRITICAL ERROR: COULD NOT DELETE TABLE " + tableName);
        Logger.instance.write("Error: " + e.message);
    }

}