import {SKSQL, ITable, readTableDefinition, offs, compressAB} from "sksql";
import * as fs from "fs";
import * as path from "path"
import {taskDone, taskStarted} from "../gracefulShutdown";
import * as crypto from "crypto";
import {getServerState} from "../main";
import {encrypt} from "./encrypt";

export function writeData(dbFolder: string, d: SKSQL, callback) {
    if (getServerState().relayMode === true) {
        return callback();
    }
    taskStarted();
    let currentTableIndex = -1;
    processNextTable(dbFolder, d, currentTableIndex, callback);
}

function processNextTable(dbFolder: string, d: SKSQL, currentTableIndex: number, callback) {
    currentTableIndex++;
    if (currentTableIndex === d.allTables.length) {
        taskDone();
        return callback();
    }
    let currentTable = d.allTables[currentTableIndex];
    let def = readTableDefinition(currentTable.data, true);
    if (def.name.startsWith('#') || def.name.toUpperCase() === "DUAL") {
        return processNextTable(dbFolder, d, currentTableIndex, callback);
    }
    // create the header
    const name = def.object_id.toUpperCase();
    const headerFilename = path.normalize(dbFolder + "/" + name + ".head");
    const blocksFolder = path.normalize(dbFolder + "/" + name + "/");

    let dvHeader = new DataView(currentTable.data.tableDef);
    if (dvHeader.getUint8(offs().BlockDirty) === 1) {
        dvHeader.setUint8(offs().BlockDirty, 0);
        if (getServerState().encryptionKey !== undefined) {
            let encrypted = encrypt(currentTable.data.tableDef);
            let encryptedDV = new DataView(encrypted);
            fs.writeFileSync(headerFilename, encryptedDV);
        } else {
            fs.writeFileSync(headerFilename, dvHeader);
        }
    }
    try {
        fs.mkdirSync(blocksFolder)
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
    for (let i = 0; i < currentTable.data.blocks.length; i++) {
        const fileName = path.normalize(blocksFolder + i + ".blk");
        let dvBlock = new DataView(currentTable.data.blocks[i]);
        if (dvBlock.getUint8(offs().BlockDirty) === 1) {
            dvBlock.setUint8(offs().BlockDirty, 0);

            if (getServerState().encryptionKey !== undefined) {
                let encrypted = encrypt(currentTable.data.blocks[i])
                let encryptedDV = new DataView(encrypted);
                fs.writeFileSync(fileName, encryptedDV );
            } else {
                fs.writeFileSync(fileName, dvBlock);
            }
        }
    }

    return processNextTable(dbFolder, d, currentTableIndex, callback);

}