import {SKSQL} from "sksql";
import * as fs from "fs";
import * as path from "path"
import {Logger} from "../Logger/Logger";

export function dropTable(dbFolder: string, d: SKSQL, tableName: string) {
    if (tableName.startsWith('#') || tableName === "dual") {
        return;
    }
    const headerFilename = path.normalize(dbFolder + "/" + tableName + ".head");
    const blocksFolder = path.normalize(dbFolder + "/" + tableName + "/");
    try {
        fs.rmSync(headerFilename, {force: true});
        fs.rmdirSync(blocksFolder, {recursive: true});
    } catch (e) {
        Logger.instance.write("CRITICAL ERROR: COULD NOT DELETE TABLE " + tableName);
        Logger.instance.write("Error: " + e.message);
    }

}