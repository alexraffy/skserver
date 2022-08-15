import {formatDate, generateV4UUID, kFormatDateTime, SKSQL, SQLStatement, TDateTime} from "sksql";
import {date_dateadd} from "sksql/build/Functions/Date/date_dateadd";
import {date_getutcdate} from "sksql/build/Functions/Date/date_getutcdate";
import * as fs from "fs";
import * as path from "path";
import {setupServer} from "./setupServer";
import {ChildProcess} from "child_process";
import * as assert from "assert";

let rwToken = "e1709ae6-4d37-4653-8488-66ad0a31c157";
let rToken = "2db62831-41bd-474a-8948-41b032cec064";
let wToken = "cefee570-3557-4b06-bf3a-706bf2e2ead7";
let expiredToken = "27dd3191-85ec-4558-9fab-483cc8998429";


export function token( next:()=> void) {
    console.log("TESTING TOKEN...");
    // create a list of tokens
    let list = "";
    let now = date_getutcdate(undefined) as TDateTime;
    let future = date_dateadd(undefined, "mi", 50, now) as TDateTime;
    let past = date_dateadd(undefined, "mi", -10, now) as TDateTime;

    list += rwToken + " " + formatDate(future, kFormatDateTime.datetime_iso) + " " + "RW" + ",";
    list += rToken + " " + formatDate(future, kFormatDateTime.datetime_iso) + " " + "R" + ",";
    list += wToken + " " + formatDate(future, kFormatDateTime.datetime_iso) + " " + "W" + ",";
    list += expiredToken + " " + formatDate(past, kFormatDateTime.datetime_iso) + " " + "RW" + "";


    console.log(list);
    let tokenFile = path.normalize("./db/token.txt");
    fs.writeFileSync(tokenFile, list);

    let dbPath = "./db/step3";
    let encryptionKey = "";
    let port = 30001;
    setupServer(1, false,
        dbPath,
        encryptionKey,
        port,
        tokenFile,
        undefined,
        undefined,
        undefined,
        false,
        false,[
        {
            pattern: "listening on port",
            callback: async (child, pattern: string) => {
                await connect(child, port);
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

async function connect(child: ChildProcess, port) {
    let db = new SKSQL();
    let result: boolean;
    result = await db.connectAsync("ws://localhost:" + port, "", "Without Token", false);
    assert(result === false, "Connecting without a token should have failed.");
    db.disconnect();

    result = await db.connectAsync("ws://localhost:" + port, rwToken, "RWToken", false);
    assert(result === true, "Connecting with a valid token should have succeeded.");
    let stRW = new SQLStatement(db, "SELECT * FROM Tbl_pingpong");
    let retRW = stRW.runSync();
    assert(retRW.getRows().length > 0, "R right");
    let stRW2 = new SQLStatement(db, "INSERT INTO Tbl_pingpong(worker_id, event) VALUES (1, 'PING');");
    let retRW2 = await stRW2.runRemote(false, true);
    assert(retRW2.error === undefined, "W right");
    db.disconnect();

    result = await db.connectAsync("ws://localhost:" + port, rToken, "RToken", false);
    assert(result === true, "Connecting with a valid token should have succeeded.");
    let stR2 = new SQLStatement(db, "SELECT * FROM Tbl_pingpong");
    let retR2 = await stR2.runRemote(true, false);
    assert(retR2.getRows().length > 0, "R right");
    let stR3 = new SQLStatement(db, "INSERT INTO Tbl_pingpong(worker_id, event) VALUES (1, 'PING');", false, "R");
    let retR3 = stR3.runSync();
    assert(retR3.error !== undefined, "Token with R right, local insert should error.");
    let stR4 = new SQLStatement(db, "INSERT INTO Tbl_pingpong(worker_id, event) VALUES (1, 'PING');");
    let retR4 =  await stR4.runRemote(true, true);
    assert(retR4.error !== undefined, "Token with R right, remote insert should error.");
    db.disconnect();

    result = await db.connectAsync("ws://localhost:" + port, expiredToken, "ExpiredToken", false);
    assert(result === false, "Connecting with an expired token should have succeeded.");

    child.send({action: "STOP"});
}
