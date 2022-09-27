import {
    offs,
    readTableDefinition,
    SKSQL,
    TAuthSession,
    TWSRGNID,
    WSRGNID,
    TWSRGNIDResponse
} from "sksql";
import {CSocket} from "./CSocket";
import path from "path";
import {writeData} from "../Data/writeData";
import {getServerState} from "../main";



export function wsrGetNextId(db: SKSQL, requestEnv: TAuthSession, socket: CSocket, id: string, param: TWSRGNID, clientConnectionString: string) {
    const databasePath = getServerState().databasePath;
    const dbPath = path.normalize(databasePath + "/db/");

    let uid = param.uid;
    let tbl = db.getTable(param.table);
    let def = readTableDefinition(tbl.data, true);
    let ret: number[] = [];
    for (let i = 0; i < param.count; i++) {
        def.identityValue = def.identityValue + def.identityIncrement;
        ret.push(def.identityValue);
    }
    let dv = new DataView(tbl.data.tableDef);
    dv.setUint8(offs().BlockDirty, 1);
    dv.setUint32(offs().TableDefIdentityValue, def.identityValue);


    writeData(dbPath, db, ()=> {
        socket.send(id, WSRGNID, { uid: uid, ids: ret} as TWSRGNIDResponse)
    })
}