import {setupServer} from "./setupServer";
import {ChildProcess} from "child_process";
import {SKSQL, SQLStatement, TAuthSession, TWSRSQLResponse, WSRSQLResponse} from "sksql";
import * as assert from "assert";


let lastStatementUnique: string = undefined;

export function create_table_a(next: ()=> void) {
    console.log("TESTING NEW UNENCRYPTED DB...");
    let dbPath = "./db/step1";
    let encryptionKey = ""; // "kYp2s5v8y/B?E(H+MbQeThWmZq4t7w9z"
    let port = 30001;
    setupServer(dbPath, encryptionKey, port, [
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
                if ((payload as TWSRSQLResponse).u === lastStatementUnique) {
                    let st3 = new SQLStatement(db, "SELECT * FROM t1");
                    let ret3 = st3.run();
                    let rows = ret3.getRows();
                    st3.close();
                    assert(rows[0]["b"] === "ABCDEFGHIJKLMNOPQRSTUVWXYZ");
                    child.send({ action: 'STOP' });
                }
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
            let st = new SQLStatement(db, "CREATE TABLE t1(a UINT32 IDENTITY(1,1), b VARCHAR(26));");
            st.run();
            st.close();
            let st2 = new SQLStatement(db, "INSERT INTO t1(b) VALUES ('ABCDEFGHIJKLMNOPQRSTUVWXYZ');");
            lastStatementUnique = st2.id;
            st2.run();
            st2.close();


        },
        connectionLost(db: SKSQL, databaseHashId: string) {
        },
        connectionError(db: SKSQL, databaseHashId: string, error: string): any {
            throw new Error("An error occurred for test1, SKSQL returned the following " + error);
        }
    });
}
