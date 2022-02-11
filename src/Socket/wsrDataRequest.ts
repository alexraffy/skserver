
import {CSocket} from "./CSocket";
import {
    SKSQL,
    readTableDefinition,
    TAuthSession,
    TWSRDataRequest,
    TWSRDataResponse,
    WSRDataRequest,
    WSROK
} from "sksql";



export function wsrDataRequest(db: SKSQL, requestEnv: TAuthSession, socket: CSocket, id: number, param: TWSRDataRequest) {

    for (let i = 0; i < db.allTables.length;i++) {
        let t = db.allTables[i];
        let def = readTableDefinition(t.data, true);
        if (def.name !== "dual" && !def.name.startsWith("#")) {
            socket.send(id, WSRDataRequest, {
                    id: id,
                    type: "T",
                    tableName: def.name,
                    indexTable: i,
                    indexBlock: -1,
                    size: t.data.tableDef.byteLength,
                    data: new Uint8Array(t.data.tableDef)
                } as TWSRDataResponse
            );
            for (let x = 0; x < t.data.blocks.length; x++) {
                socket.send(id, WSRDataRequest, {
                        id: id,
                        type: "B",
                        tableName: def.name,
                        indexTable: i,
                        indexBlock: x,
                        size: t.data.blocks[x].byteLength,
                        data: new Uint8Array(t.data.blocks[x])
                    } as TWSRDataResponse
                );
            }
        }
    }
    socket.send(id, WSROK, {});

}