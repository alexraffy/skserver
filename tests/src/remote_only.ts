import {setupServer} from "./setupServer";
import {ChildProcess} from "child_process";
import {generateV4UUID, SKSQL, SQLStatement, TAuthSession, TWSRSQLResponse, WSRSQLResponse} from "sksql";
import * as assert from "assert";


export function remote_only(next:()=> void) {

    console.log("TESTING REMOTE ONLY...");
    let dbPath = "./db/step4";
    let encryptionKey = "";
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
        true,[
        {
            pattern: "listening on port",
            callback: (child, pattern: string) => {
                connect1(child, port);
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


var lastStatementUnique: string = "";
let guid: string = "";
function connect1(child: ChildProcess, port) {
    let db = new SKSQL();

    db.connectToServer("ws://localhost:" + port, {
        on(db: SKSQL, databaseHashId: string, message: string, payload: any) {
        },
        authRequired(db: SKSQL, databaseHashId: string): TAuthSession {
            return {
                name: "Test1",
                token: "",
                remoteOnly: true
            } as TAuthSession;
        },
        ready(db: SKSQL, databaseHashId: string): any {
            let st = new SQLStatement(db, "CREATE TABLE t1(a UINT32 IDENTITY(1,1), b VARCHAR(36), c DATETIME);");
            st.runRemote().then((value) => {
                st.close();
                let st2 = new SQLStatement(db, "CREATE PROCEDURE usp_t1 @param_b VARCHAR(36) AS BEGIN INSERT INTO t1(b, c) VALUES (@param_b, GETUTCDATE()); END;");
                lastStatementUnique = st2.id;
                st2.runRemote().then((v2) => {
                   st2.close();
                   db.disconnect();
                   connect2(child, port);
                }).catch((e2) => {
                    throw new Error(e2.message);
                });
            }).catch((e) => {
                throw new Error(e.message);
            })


        },
        connectionLost(db: SKSQL, databaseHashId: string) {
        },
        connectionError(db: SKSQL, databaseHashId: string, error: string): any {
            throw new Error("An error occurred for test1, SKSQL returned the following " + error);
        }
    });
}


function connect2(child: ChildProcess, port) {
    let db = new SKSQL();
    db.connectToServer("ws://localhost:" + port, {
        on(db: SKSQL, databaseHashId: string, message: string, payload: any) {
        },
        authRequired(db: SKSQL, databaseHashId: string): TAuthSession {
            return {
                name: "Test1",
                remoteOnly: true,
                token: ""
            } as TAuthSession;
        },
        ready(db: SKSQL, databaseHashId: string): any {
            guid = generateV4UUID();
            let st = new SQLStatement(db, "Exec usp_t1 @param_b = @b;");
            st.setParameter("@b", guid);
            st.runRemote().then((v) => {
                st.close();
                db.disconnect();
                connect3(child, port);
            }).catch((e) => {
                throw new Error(e.message);
            });
        },
        connectionLost(db: SKSQL, databaseHashId: string) {
        },
        connectionError(db: SKSQL, databaseHashId: string, error: string): any {
            throw new Error("An error occurred for test1, SKSQL returned the following " + error);
        }
    });
}

function connect3(child: ChildProcess, port) {
    let db = new SKSQL();
    db.connectToServer("ws://localhost:" + port, {
        on(db: SKSQL, databaseHashId: string, message: string, payload: any) {
        },
        authRequired(db: SKSQL, databaseHashId: string): TAuthSession {
            return {
                name: "Test1",
                token: ""
            } as TAuthSession;
        },
        ready(db: SKSQL, databaseHashId: string): any {
            let st = new SQLStatement(db, "SELECT * FROM t1");
            let ret = st.runSync();
            let rows = ret.getRows();
            st.close();
            assert(rows[0]["b"] === guid, "Unexpected result.");
            db.disconnect();
            connect4(child, port);
        },
        connectionLost(db: SKSQL, databaseHashId: string) {
        },
        connectionError(db: SKSQL, databaseHashId: string, error: string): any {
            throw new Error("An error occurred for test1, SKSQL returned the following " + error);
        }
    });
}

function connect4(child: ChildProcess, port: number) {
    let db = new SKSQL();
    db.connectToServer("ws://localhost:" + port, {
        on(db: SKSQL, databaseHashId: string, message: string, payload: any) {
        },
        authRequired(db: SKSQL, databaseHashId: string): TAuthSession {
            return {
                name: "Test1",
                remoteOnly: true,
                token: ""
            } as TAuthSession;
        },
        ready(db: SKSQL, databaseHashId: string): any {

            let tbl = db.getTable("t1");
            assert(tbl.data.blocks.length === 0, "The server in remote mode should not send table data.");


            let st = new SQLStatement(db, "SELECT * FROM t1");
            let ret = st.runRemote().then((r) => {
                let rows = r.getRows();
                st.close();
                assert(rows[0]["b"] === guid, "Unexpected result.");
                db.disconnect();
                child.send({action: "STOP"});
            })
        },
        connectionLost(db: SKSQL, databaseHashId: string) {
        },
        connectionError(db: SKSQL, databaseHashId: string, error: string): any {
            throw new Error("An error occurred for test1, SKSQL returned the following " + error);
        }
    });
}
