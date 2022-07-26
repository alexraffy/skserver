import {CSocket} from "./CSocket";
import {Logger} from "../Logger/Logger";
import {
    SKSQL,
    SQLResult,
    SQLStatement,
    TAuthSession,
    TWSRSQL,
    TWSRSQLResponse,
    WSRSQL,
    TSQLResult,
    WSRSQLResponse
} from "sksql";
import {writeData} from "../Data/writeData";
import * as path from "path";


function sendResponse(db: SKSQL, socket: CSocket, id: number, param: TWSRSQL, tret: TSQLResult) {
    // response
    let res: TWSRSQLResponse = {
        id: param.id,
        u: param.u,
        res: tret,
        r: param.r,
        t: []
    };
    if (param.rd) {
        // return data blocks
        // TODO
    }
    socket.send(id, WSRSQLResponse, res);
}


export function wsrSQL(db: SKSQL, requestEnv: TAuthSession, socket: CSocket, id: number, param: TWSRSQL, remoteMode: boolean, clientConnectionString: string) {
    const databasePath = process.env.SKDB_PATH;
    const dbPath = path.normalize(databasePath + "/db/");
    // write to log
    Logger.instance.write(clientConnectionString + "\t" + param.r);

    let st: SQLStatement;
    let ret: SQLResult;
    let tret: TSQLResult;
    // Apply locally
    try {
        st = new SQLStatement(db, param.r, false);
        if (param.p !== undefined) {
            for (let i = 0; i < param.p.length; i++) {
                st.setParameter(param.p[i].name, param.p[i].value, param.p[i].type);
            }
        }
        ret = st.run() as SQLResult;
        tret = ret.getStruct();
        if (ret.error !== undefined) {
            Logger.instance.write(clientConnectionString + "\t" + ret.error);
        }


        //console.log(ret);
    } catch (e) {
        if (tret === undefined) {
            tret = {
                error: e.message,
                rowsDeleted: 0,
                rowsInserted: 0,
                rowCount: 0,
                rowsModified: 0,
                totalRuntime: 0,
                returnValue: undefined,
                resultTableName: "",
                parserTime: 0,
                dropTable: [],
                queries: [],
                messages: undefined
            };
        }
        sendResponse(db, socket, id, param, tret);
        Logger.instance.write(clientConnectionString + "\t" + e.message);
        if (st !== undefined) {
            st.close();
        }
        return true;
    }

    // writeAll
    writeData(dbPath, db, ()=> {

        sendResponse(db, socket, id, param, tret);

        if (param.b) {
            // broadcast blocks to other clients

        }

        // delete temp data
        st.close();

        if (param.rd !== true) {
            // broadcast the query
            socket.broadcast(param.id, WSRSQL, param)
        }
    })



}