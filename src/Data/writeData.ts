import {SKSQL, ITable, readTableDefinition, kBlockHeaderField} from "sksql";
import * as fs from "fs";
import * as path from "path"

export function writeData(dbFolder: string, d: SKSQL, callback) {

    let currentTableIndex = -1;
    processNextTable(dbFolder, d, currentTableIndex, callback);
}

function processNextTable(dbFolder: string, d: SKSQL, currentTableIndex: number, callback) {
    currentTableIndex++;
    if (currentTableIndex === d.allTables.length) {
        return callback();
    }
    let currentTable = d.allTables[currentTableIndex];
    let def = readTableDefinition(currentTable.data, true);
    if (def.name.startsWith('#') || def.name === "dual") {
        return processNextTable(dbFolder, d, currentTableIndex, callback);
    }
    // create the header
    const name = def.name;
    const headerFilename = path.normalize(dbFolder + "/" + name + ".head");
    const blocksFolder = path.normalize(dbFolder + "/" + name + "/");

    let dvHeader = new DataView(currentTable.data.tableDef);
    if (dvHeader.getUint8(kBlockHeaderField.BlockDirty) === 1) {
        dvHeader.setUint8(kBlockHeaderField.BlockDirty, 0);
        fs.writeFileSync(headerFilename, dvHeader);
    }
    try {
        fs.mkdirSync(blocksFolder)
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
    for (let i = 0; i < currentTable.data.blocks.length; i++) {
        const fileName = path.normalize(blocksFolder + i + ".blk");
        let dvBlock = new DataView(currentTable.data.blocks[i]);
        if (dvBlock.getUint8(kBlockHeaderField.BlockDirty) === 1) {
            dvBlock.setUint8(kBlockHeaderField.BlockDirty, 0);
            fs.writeFileSync(fileName, dvBlock);
        }
    }

    return processNextTable(dbFolder, d, currentTableIndex, callback);

}