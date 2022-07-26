import {CSocket} from "./CSocket";
import {
    compressAB,
    kModifiedBlockType,
    readTableDefinition,
    SKSQL,
    TAuthSession,
    TWSRDataRequest,
    TWSRDataResponse,
    WSRDataRequest,
    WSROK
} from "sksql";


export function wsrDataRequest(db: SKSQL, requestEnv: TAuthSession, socket: CSocket, id: number, param: TWSRDataRequest, remoteMode: boolean, clientConnectionString: string) {

    for (let i = 0; i < db.allTables.length;i++) {
        let t = db.allTables[i];
        let def = readTableDefinition(t.data, true);
        if (def.name !== "dual" && !def.name.startsWith("#")) {
            let compressedData = compressAB(t.data.tableDef);
            socket.send(id, WSRDataRequest, {
                    id: id,
                    type: kModifiedBlockType.tableHeader,
                    tableName: def.name,
                    indexTable: i,
                    indexBlock: -1,
                    size: compressedData.byteLength,
                    data: new Uint8Array(compressedData)
                } as TWSRDataResponse
            );
            if (remoteMode !== true) {
                for (let x = 0; x < t.data.blocks.length; x++) {
                    let compressedBlock = compressAB(t.data.blocks[x]);
                    socket.send(id, WSRDataRequest, {
                            id: id,
                            type: kModifiedBlockType.tableBlock,
                            tableName: def.name,
                            indexTable: i,
                            indexBlock: x,
                            size: compressedBlock.byteLength,
                            data: new Uint8Array(compressedBlock)
                        } as TWSRDataResponse
                    );
                }
            }
        }
    }
    socket.send(id, WSROK, {});

}