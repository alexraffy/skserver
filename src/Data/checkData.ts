import * as fs from "fs";
import * as path from "path"
import {
    compileNewRoutines,
    SKSQL,
    ITable,
    readTableDefinition,
    genStatsForTable,
    isValidTableHeader,
    decompress
} from "sksql";
import {Logger} from "../Logger/Logger";
import {getServerState} from "../main";
import {gracefulShutdown} from "../gracefulShutdown";
import * as crypto from "crypto";
import {decrypt} from "./decrypt";


export async function checkFolders(folder: string) {
    const logPath = path.normalize(folder + "/logs/");
    const dbPath = path.normalize(folder + "/db/");
    const walPath = path.normalize(folder + "/wal/");
    const backupsPath = path.normalize(folder + "/backups/");
    // create main folder
    try {
        fs.mkdirSync(folder)
    } catch (err) {
        if (err.code !== 'EEXIST') throw err
    }
    try {
        fs.mkdirSync(logPath);
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
    try {
        fs.mkdirSync(dbPath);
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
    try {
        fs.mkdirSync(walPath);
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
    try {
        fs.mkdirSync(backupsPath);
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

export async function checkData(db: SKSQL, folder: string) {
    const logPath = path.normalize(folder + "/logs/");
    const dbPath = path.normalize(folder + "/db/");
    const backupsPath = path.normalize(folder + "/backups/");
    const walPath = path.normalize(folder + "/wal/");


    const files = fs.readdirSync(dbPath);
    for (let i = 0; i < files.length; i++) {
        let file = files[i];
        let filePath = path.normalize(dbPath + "/" + file);
        Logger.instance.write("Processing file " + filePath);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {

        } else {
            // file is a table header
            if (file.endsWith(".head")) {

                let buffer: Buffer = fs.readFileSync(filePath);
                let tableData: ITable = {
                    data: {
                        tableDef: undefined,
                        blocks: []
                    }
                }
                tableData.data.tableDef = new ArrayBuffer(buffer.byteLength);
                let dv = new DataView(tableData.data.tableDef);
                for (let i = 0; i < buffer.byteLength; i++) {
                    dv.setUint8(i, buffer[i]);
                }

                // is it encrypted?
                if (!isValidTableHeader(dv)) {
                    if (getServerState().encryptionKey === undefined) {
                        Logger.instance.write("Database is encrypted and no key was provided.")
                        gracefulShutdown(0);
                        return false;
                    }

                    tableData.data.tableDef = decrypt(tableData.data.tableDef, true);

                } else if (getServerState().encryptionKey !== undefined && getServerState().encryptionKey !== "") {
                    Logger.instance.write("Database is NOT encrypted and a key was provided.")
                    gracefulShutdown(0);
                    return false;
                }

                let td = readTableDefinition(tableData.data, true);
                if (db.getTable(td.name) !== undefined) {
                    db.dropTable(td.name);
                }
                db.allTables.push(tableData);
                Logger.instance.write("Found table " + td.name)
                let blocks = fs.readdirSync(path.normalize(dbPath + "/" + file.replace(".head", "")));
                let blockIndex = -1;
                let fileExists = true;
                while (fileExists) {

                    blockIndex++;
                    fileExists = false;
                    const blockFile = path.normalize(dbPath + "/" + file.replace(".head", "") + "/" + blockIndex + ".blk");
                    try {
                        let buf: Buffer = fs.readFileSync(blockFile);
                        Logger.instance.write("Found block " + blockIndex);
                        let abuf = new ArrayBuffer(buf.byteLength);
                        let dvBlock = new DataView(abuf);
                        for (let i = 0; i < buf.byteLength; i++) {
                            dvBlock.setUint8(i, buf[i]);
                        }
                        if (getServerState().encryptionKey !== undefined) {
                            let decrypted = decrypt(abuf, true);
                            tableData.data.blocks.push(decrypted);
                        } else {
                            tableData.data.blocks.push(abuf);
                        }
                        fileExists = true;
                    } catch (err) {
                        fileExists = false;
                    }
                }
                //if (!["DUAL", "ROUTINES", "SYS_TABLE_STATISTICS"].includes(td.name.toUpperCase())) {
                 //   genStatsForTable(db, td.name.toUpperCase());
               // }
            }
        }
    }

    db.tableInfo.syncAll();
    compileNewRoutines(db);




    return true;

}