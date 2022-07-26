import {setupServer} from "./setupServer";
import {ChildProcess} from "child_process";
import {SKSQL, SQLStatement, TAuthSession, TWSRSQLResponse, WSRON, WSRSQL, WSRSQLResponse} from "sksql";
import assert from "assert";
import {run_cmd} from "./run_cmd";


export function pingpong( next:()=>void) {
    console.log("TESTING PINGPONG...");
    let dbPath = "./db/step3";
    let encryptionKey = "";
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

let pingpong_score = 0;

function connect(child: ChildProcess, port) {
    let db = new SKSQL();
    db.connectToServer("ws://localhost:" + port, {
        on(db: SKSQL, databaseHashId: string, message: string, payload: any) {
            if (message === WSRON || message === WSRSQL) {
                // worker 2 has connected or we received a SQL from another client
                pingpong_score++;

                if (pingpong_score === 10) {
                    let selectAll = new SQLStatement(db, "SELECT * FROM Tbl_pingpong;");
                    let ret = selectAll.run();
                    console.table(ret.getRows());
                    selectAll.close();
                    return child.send({action: "STOP"});
                }

                let ping = new SQLStatement(db, "INSERT INTO Tbl_pingpong(worker_id, event) VALUES (1, 'PING');");
                ping.run();
                ping.close();

            }
        },
        authRequired(db: SKSQL, databaseHashId: string): TAuthSession {
            return {
                name: "PONG WORKER 1",
                valid: true,
                token: ""
            } as TAuthSession;
        },
        ready(db: SKSQL, databaseHashId: string): any {
            let st = new SQLStatement(db, "CREATE TABLE Tbl_pingpong(worker_id UINT32, timestamp datetime DEFAULT GETUTCDATE(), event VARCHAR(4));");
            st.run();
            st.close();
            // launch worker 2
            run_cmd("node", ["build/pong.js"], {PONGWORKER_ID: 2, PONGWORKER_PORT: port}, []).then((v) => {

            }).catch((e) => {

            });

        },
        connectionLost(db: SKSQL, databaseHashId: string) {
        },
        connectionError(db: SKSQL, databaseHashId: string, error: string): any {
            throw new Error("An error occurred for test1, SKSQL returned the following " + error);
        }
    });
}
