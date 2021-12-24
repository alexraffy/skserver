import * as fs from "fs";
import * as path from "path"
import {DBData, ITable, readTableDefinition} from "sksql";

export async function checkFolders(folder: string) {
    const logPath = path.normalize(folder + "/logs/");
    const dbPath = path.normalize(folder + "/db/");
    const walPath = path.normalize(folder + "/wal/");

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
}

export async function checkData(folder: string) {
    const logPath = path.normalize(folder + "/logs/");
    const dbPath = path.normalize(folder + "/db/");
    const walPath = path.normalize(folder + "/wal/");


    const files = fs.readdirSync(dbPath);
    files.forEach(file => {
        let filePath = path.normalize(dbPath + "/" + file);
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
                    dv.setUint8(0, buffer[i]);
                }
                let td = readTableDefinition(tableData.data, true);
                let blocks = fs.readdirSync(path.normalize(dbPath + "/" + file.replace(".head", "")));


            }
        }
    });






    return true;

}