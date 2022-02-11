import * as fs from "fs";
import * as path from "path"
import {compileNewRoutines, SKSQL, ITable, readTableDefinition} from "sksql";
import {Logger} from "../Logger/Logger";


export async function checkFolders(folder: string) {
    const logPath = path.normalize(folder + "/logs/");
    const dbPath = path.normalize(folder + "/db/");
    const walPath = path.normalize(folder + "/wal/");
    const functionsPath = path.normalize(folder + "/functions/");
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
        fs.mkdirSync(functionsPath);
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

export async function checkData(db: SKSQL, folder: string) {
    const logPath = path.normalize(folder + "/logs/");
    const dbPath = path.normalize(folder + "/db/");
    const walPath = path.normalize(folder + "/wal/");
    const functionsPath = path.normalize(folder + "/functions/");

    const files = fs.readdirSync(dbPath);
    files.forEach(file => {
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
                let td = readTableDefinition(tableData.data, true);
                db.dropTable(td.name);
                db.allTables.push(tableData);
                Logger.instance.write("Found table " + td.name)
                let blocks = fs.readdirSync(path.normalize(dbPath + "/" + file.replace(".head", "")));
                let blockIndex = -1;
                let fileExists = true;
                while (fileExists) {

                    blockIndex++;
                    fileExists = false;
                    const blockFile = path.normalize(dbPath + "/" + td.name + "/" + blockIndex + ".blk");
                    try {
                        let buf: Buffer = fs.readFileSync(blockFile);
                        let abuf = new ArrayBuffer(buf.byteLength);
                        let dvBlock = new DataView(abuf);
                        for (let i = 0; i < buf.byteLength; i++) {
                            dvBlock.setUint8(i, buf[i]);
                        }
                        tableData.data.blocks.push(abuf);
                        fileExists = true;
                    } catch (err) {
                        fileExists = false;
                    }
                }

            }
        }
    });

    compileNewRoutines(db);




    return true;

}