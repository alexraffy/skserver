import {setupServer} from "./setupServer";
import {ChildProcess} from "child_process";
import {generateV4UUID, SKSQL, SQLStatement, TWSRSQL, WSRSQL} from "sksql";
import * as assert from "assert";

export function relay ( next: ()=> void) {
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
        false,[
        {
            pattern: "listening on port",
            callback: async (child, pattern: string) => {
                await setup2(child, port);
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

function setup2(firstChild: ChildProcess, mainPort) {
    let dbPath = undefined;
    let encryptionKey = "";
    let port = 30002;
    setupServer(2, false,
        dbPath,
        encryptionKey,
        port,
        "",
        "ws://localhost:"+mainPort,
        undefined,
        undefined,
        false,
        false,[
        {
            pattern: "listening on port",
            callback: async (child, pattern: string) => {
                await connect1(firstChild, child, mainPort, port);
            }
        }
    ]).then((v) => {
        if (v.error !== null) {
            throw new Error("An error occurred for test1: " + v.error);
        }
    }).catch((r) => {

        throw new Error("An error occurred for test1: " + r);
    });


}

async function connect1(mainChild: ChildProcess, relayChild: ChildProcess, mainPort: number, relayPort: number) {
    let insertGuid = generateV4UUID();
    let updateGuid = generateV4UUID();
    let db1 = new SKSQL();
    let ok = await db1.connectAsync("ws://localhost:" + mainPort, "", "ClientRW");
    db1.getConnectionInfoForDB().delegate.on = (db: SKSQL, databaseHashId: string, message: string, payload: any) => {
        if (message === WSRSQL && (payload as TWSRSQL).u === updateGuid) {
            let s = new SQLStatement(db, "SELECT * FROM test1;");
            let r = s.runSync();
            assert(r.error === undefined, "The client connected to the main server did not receive the SQL message from the relay.");
            let rows = r.getRows();
            assert(rows.length === 1 && rows[0]["v"] === "ABC", "The client connected to the main server did not processed the SQL coming from the relay.");
            relayChild.send({action: "STOP"});
            mainChild.send({action: "STOP"});
        }
    };
    assert(ok === true, "Server not set up correctly.");
    let db2 = new SKSQL();
    let ok2 = await db2.connectAsync("ws://localhost:" + relayPort, "", "ClientR");
    db2.getConnectionInfoForDB().delegate.on = (db, databaseHashId, message, payload) => {
        if (message === WSRSQL && (payload as TWSRSQL).u === insertGuid) {
            // we received the insert statement
            let s = new SQLStatement(db, "SELECT * FROM test1;");
            let r = s.runSync();
            assert(r.error === undefined, "The client connected to the relay did not receive the SQL message.");
            let rows = r.getRows();
            assert(rows.length === 1 && rows[0]["v"] === "A", "The client connected to the relay did not processed the SQL coming from the main server.");
            let up = new SQLStatement(db, "UPDATE test1 SET v = 'ABC';");
            up.id = updateGuid;
            let r2 = up.runSync();
            assert(r2.error === undefined, "Could not update test1.");

        }
    }
    assert(ok2 === true, "Relay Server not set up correctly.");
    let sql1 = new SQLStatement(db1, "CREATE TABLE test1( v VARCHAR(255));", true);
    await sql1.runAsync();
    sql1.close();

    let sql2 = new SQLStatement(db1, "INSERT INTO test1(v) VALUES ('A');");
    sql2.id = insertGuid;
    await sql2.runAsync();
    sql2.close();


}

