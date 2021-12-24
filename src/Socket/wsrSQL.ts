import {CSocket} from "./CSocket";
import {TWSRSQL, WSRSQL} from "./TMessages";
import {TAuthSession} from "./TAuthSession";
import {Logger} from "../Logger/Logger";
import {SQLStatement} from "sksql";


export function wsrSQL(requestEnv: TAuthSession, socket: CSocket, id: number, param: TWSRSQL) {

    // write to log
    Logger.instance.write(param.r);
    // write to WAL

    // Apply locally
    try {
        let res = new SQLStatement(param.r);
        let ret = res.run();
    } catch (e) {
        Logger.instance.write(e.message);
        return true;
    }
    // broadcast
    socket.broadcast(param.id, WSRSQL, param)

}