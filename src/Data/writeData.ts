import {SKSQL, ITable, readTableDefinition} from "sksql";
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
    fs.writeFileSync(headerFilename, new DataView(currentTable.data.tableDef));
    try {
        fs.mkdirSync(blocksFolder)
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
    for (let i = 0; i < currentTable.data.blocks.length; i++) {
        const fileName = path.normalize(blocksFolder + i + ".blk");
        fs.writeFileSync(fileName, new DataView(currentTable.data.blocks[i]));
    }

    return processNextTable(dbFolder, d, currentTableIndex, callback);

}