import {CSocket} from "./CSocket";
import {Logger} from "../Logger/Logger";
import {SKSQL, SQLStatement, TAuthSession, TWSRSQL, WSRSQL} from "sksql";
import {writeData} from "../Data/writeData";
import * as path from "path";


export function wsrSQL(requestEnv: TAuthSession, socket: CSocket, id: number, param: TWSRSQL) {

    // write to log
    Logger.instance.write(param.r);
    // write to WAL

    // Apply locally
    try {
        let res = new SQLStatement(param.r, false);
        if (param.p !== undefined) {
            for (let i = 0; i < param.p.length; i++) {
                res.setParameter(param.p[i].k, param.p[i].v);
            }
        }
        let ret = res.run();
        console.log(ret);
    } catch (e) {
        Logger.instance.write(e.message);
        return true;
    }

    // writeAll
    const databasePath = process.env.SKDB_PATH;
    const dbPath = path.normalize(databasePath + "/db/");
    writeData(dbPath, SKSQL.instance, ()=> {
        // broadcast
        socket.broadcast(param.id, WSRSQL, param)
    })



}