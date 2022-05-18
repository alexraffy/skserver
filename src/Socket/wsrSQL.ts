import {CSocket} from "./CSocket";
import {Logger} from "../Logger/Logger";
import {SKSQL, SQLResult, SQLStatement, TAuthSession, TWSRSQL, WSRSQL} from "sksql";
import {writeData} from "../Data/writeData";
import * as path from "path";
import {dropTable} from "../Data/dropTable";


export function wsrSQL(db: SKSQL, requestEnv: TAuthSession, socket: CSocket, id: number, param: TWSRSQL, remoteMode: boolean) {
    const databasePath = process.env.SKDB_PATH;
    const dbPath = path.normalize(databasePath + "/db/");
    // write to log
    Logger.instance.write(param.r);
    // write to WAL

    // Apply locally
    try {
        let res = new SQLStatement(db, param.r, false);
        if (param.p !== undefined) {
            for (let i = 0; i < param.p.length; i++) {
                res.setParameter(param.p[i].name, param.p[i].value, param.p[i].type);
            }
        }
        let ret = res.run() as SQLResult;
        if (ret.error !== undefined) {
            console.log(ret.error);
        }
        if (ret.dropTable !== undefined && ret.dropTable.length > 0)
        for (let i = 0; i < ret.dropTable.length; i++) {
            dropTable(dbPath, db, ret.dropTable[i]);
        }
        res.close();
        console.log(ret);
    } catch (e) {
        Logger.instance.write(e.message);
        return true;
    }

    // writeAll

    writeData(dbPath, db, ()=> {
        // broadcast
        socket.broadcast(param.id, WSRSQL, param)
    })



}