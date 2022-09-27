import {readTableDefinition, SKSQL} from "sksql";
import * as path from "path";
import * as fs from "fs";
import {Logger} from "../Logger/Logger";
import {getServerState} from "../main";


export function callbackDropTable(db: SKSQL, tableName: string) {
    tableName = tableName.toUpperCase();
    const databasePath = getServerState().databasePath;
    const dbPath = path.normalize(databasePath + "/db/");
    if (tableName.startsWith('#') || ["DUAL", "ROUTINES", "SYS_TABLE_STATISTICS"].includes(tableName.toUpperCase())) {
        return;
    }
    let tableData = db.getTable(tableName);
    if (tableData === undefined) {
        return;
    }
    let tableInfo = readTableDefinition(tableData.data, true);
    const headerFilename = path.normalize(dbPath + "/" + tableInfo.object_id.toUpperCase() + ".head");
    const blocksFolder = path.normalize(dbPath + "/" + tableInfo.object_id.toUpperCase() + "/");
    try {
        fs.rmSync(headerFilename, {force: true});
        fs.rmSync(blocksFolder, {recursive: true});
    } catch (e) {
        Logger.instance.write("CRITICAL ERROR: COULD NOT DELETE TABLE " + tableName + " ID: " + tableInfo.object_id.toUpperCase());
        Logger.instance.write("Error: " + e.message);
    }

}