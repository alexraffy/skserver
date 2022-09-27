
import {WebSocket} from 'ws';

//@ts-ignore
global["WebSocket"] = WebSocket;

//@ts-ignore
global["worker_threads"] = require("worker_threads");

//@ts-ignore
global["perf_hooks"] = require("perf_hooks");

import {SKSQL, SQLStatement, TAuthSession, TWSRSQLResponse, WSRSQL, WSRSQLResponse} from "sksql";



let workerId = parseInt(process.env.PONGWORKER_ID);
let port = process.env.PONGWORKER_PORT;

console.log("PONG WORKER " + workerId);

let db = new SKSQL();
db.connectToServer("ws://localhost:" + port, {
    on(db: SKSQL, databaseHashId: string, message: string, payload: any) {
        if (message === WSRSQL) {
            let pongSt = new SQLStatement(db, "INSERT INTO Tbl_pingpong(worker_id, event) VALUES (@worker_id, 'PONG')");
            pongSt.setParameter("@worker_id", workerId);
            pongSt.runSync();
        }
    },
    authRequired(db: SKSQL, databaseHashId: string): TAuthSession {
        return {
            name: "PONG WORKER " + workerId,
            token: ""
        } as TAuthSession;
    },
    ready(db: SKSQL, databaseHashId: string): any {

    },
    connectionLost(db: SKSQL, databaseHashId: string) {
    },
    connectionError(db: SKSQL, databaseHashId: string, error: string): any {
        throw new Error("An error occurred for test1, SKSQL returned the following " + error);
    }
});



