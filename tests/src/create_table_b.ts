import {setupServer} from "./setupServer";
import {ChildProcess} from "child_process";
import {SKSQL, SQLStatement, TAuthSession, TWSRSQLResponse, WSRSQLResponse} from "sksql";
import * as assert from "assert";


export function create_table_b(next:()=> void) {
    console.log("TESTING EXISTING UNENCRYPTED DB...");
    let dbPath = "./db/step1";
    let encryptionKey = ""; // "kYp2s5v8y/B?E(H+MbQeThWmZq4t7w9z"
    let port = 30001;
    setupServer(1, false,
        dbPath,
        encryptionKey,
        port,
        "",
        undefined,
        undefined,
        undefined,
        false,
        false,[
        {
            pattern: "listening on port",
            callback: (child, pattern: string) => {
                connect(child, port);
            }
        }
    ]).then((v) => {
        if (v.error !== null) {
            throw new Error("An error occurred for test1: " + v.error);
        }
        next();
    }).catch((r) => {

        throw new Error("An error occurred for test1: " + r);
    });


}


function connect(child: ChildProcess, port) {
    let db = new SKSQL();
    db.connectToServer("ws://localhost:" + port, {
        on(db: SKSQL, databaseHashId: string, message: string, payload: any) {
            if (message === WSRSQLResponse) {

            }
        },
        authRequired(db: SKSQL, databaseHashId: string): TAuthSession {
            return {
                name: "Test1",
                valid: true,
                token: ""
            } as TAuthSession;
        },
        ready(db: SKSQL, databaseHashId: string): any {
            let st3 = new SQLStatement(db, "SELECT * FROM t1");
            let ret3 = st3.runSync();
            let rows = ret3.getRows();
            st3.close();
            assert(rows[0]["b"] === "ABCDEFGHIJKLMNOPQRSTUVWXYZ");
            let st4 = new SQLStatement(db, "DROP TABLE t1");
            let ret4 = st4.runSync();
            st4.close();
            child.send({ action: 'STOP' });
        },
        connectionLost(db: SKSQL, databaseHashId: string) {
        },
        connectionError(db: SKSQL, databaseHashId: string, error: string): any {
            throw new Error("An error occurred for test1, SKSQL returned the following " + error);
        }
    });
}
