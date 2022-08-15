import {CSocket} from "./CSocket";
import {Logger} from "../Logger/Logger";
import {
    compressAB,
    kModifiedBlockType,
    SKSQL,
    SQLResult,
    SQLStatement,
    TAuthSession, TDateTime, TDateTimeCmp,
    TSQLResult,
    TWSRSQL,
    TWSRSQLResponse,
    WSRSQL,
    WSRSQLResponse
} from "sksql";
import {writeData} from "../Data/writeData";
import * as path from "path";
import {getServerState} from "../main";
import {date_getutcdate} from "sksql/build/Functions/Date/date_getutcdate";


function sendResponse(db: SKSQL, socket: CSocket, id: string, param: TWSRSQL, st: SQLStatement, tret: TSQLResult) {
    // response
    let res: TWSRSQLResponse = {
        id: param.id,
        u: param.u,
        res: tret,
        r: param.r,
        t: []
    };
    if (param.rd && st !== undefined && st.context !== undefined) {
        // return data blocks
        for (let i = 0; i < st.context.modifiedBlocks.length; i++) {
            let mb = st.context.modifiedBlocks[i];
            // if the table header or block is a temp table, we only send it if it is the result table.
            if (mb.name.startsWith("#") && mb.name.toUpperCase() !== tret.resultTableName.toUpperCase()) {
                continue;
            }
            let compressed: ArrayBuffer;
            let indexBlock = -1;
            let indexTable = -1;
            let tbl = db.tableInfo.get(mb.name);
            if (mb.type === kModifiedBlockType.tableHeader) {
                compressed = compressAB(tbl.pointer.data.tableDef);
            } else if (mb.type === kModifiedBlockType.tableBlock) {
                indexBlock = mb.blockIndex;
                compressed = compressAB(tbl.pointer.data.blocks[mb.blockIndex]);
            }

            // compress and add to the TSQLResult
            let dvCompressed = new DataView(compressed);
            let arr : Uint8Array = new Uint8Array(compressed.byteLength);
            for (let x = 0; x < compressed.byteLength; x++) {
                arr[x] = dvCompressed.getUint8(x);
            }
            res.t.push(
                {
                    id: id,
                    type: mb.type,
                    indexBlock: indexBlock,
                    indexTable: indexTable,
                    tableName: mb.name,
                    size: compressed.byteLength,
                    data: arr

                }
            );


        }
    }
    socket.send(id, WSRSQLResponse, res);
}


export function wsrSQL(db: SKSQL, requestEnv: TAuthSession, socket: CSocket, id: string, param: TWSRSQL, remoteMode: boolean, clientConnectionString: string) {
    const databasePath = getServerState().databasePath;
    const dbPath = path.normalize(databasePath + "/db/");

    // write to log
    Logger.instance.write(clientConnectionString + "\tTransactionID: " + param.u);
    Logger.instance.write(clientConnectionString + "\tUser: " + requestEnv.name);
    Logger.instance.write(clientConnectionString + "\tBroadcast: " + ((param.b === true) ? "YES" : "NO"));
    Logger.instance.write(clientConnectionString + "\tReturn Data: " + ((param.rd === true) ? "YES" : "NO"));
    Logger.instance.write(clientConnectionString + "\tSQL: " + param.r);

    let st: SQLStatement;
    let ret: SQLResult;
    let tret: TSQLResult;
    // Apply locally
    try {
        let accessRights = (getServerState().privateDB === true) ? "N" : "RW";
        // check token
        const tokens = getServerState().tokenList;
        for (let i = 0; i < tokens.length; i++) {
            if (tokens[i].token.toUpperCase() === requestEnv.token.toUpperCase()) {
                // check the expiry
                let now = date_getutcdate(undefined) as TDateTime;
                if (TDateTimeCmp(now, tokens[i].expiry) === -1) {
                    accessRights = tokens[i].rights as "RW" | "R" | "W" | "N";
                } else {
                    Logger.instance.write(clientConnectionString + "\t" + "TOKEN EXPIRED.");
                    tret = {
                        error: "TOKEN EXPIRED.",
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
                    sendResponse(db, socket, id, param, st, tret);
                    return;
                }
                break;
            }
        }

        if (accessRights === "N") {
            Logger.instance.write(clientConnectionString + "\t" + "INVALID TOKEN OR TOKEN NOT FOUND.");
            tret = {
                error: "INVALID TOKEN OR TOKEN NOT FOUND.",
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
            sendResponse(db, socket, id, param, st, tret);
            return;
        }
        let b = false;
        if (getServerState().relayMode === true) {
            b = true;
        }
        st = new SQLStatement(db, param.r, b, accessRights);
        st.id = param.u;
        if (param.p !== undefined) {
            for (let i = 0; i < param.p.length; i++) {
                st.setParameter(param.p[i].name, param.p[i].value, param.p[i].type);
            }
        }
        ret = st.runSync() as SQLResult;
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
        sendResponse(db, socket, id, param, st, tret);
        Logger.instance.write(clientConnectionString + "\t" + e.message);
        if (st !== undefined) {
            st.close();
        }
        return true;
    }

    // writeAll
    writeData(dbPath, db, ()=> {

        sendResponse(db, socket, id, param, st, tret);

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