import {WebSocket} from 'ws';
import {performance} from "perf_hooks";

//@ts-ignore
global["worker_threads"] = require("worker_threads");

//@ts-ignore
global["perf_hooks"] = require("perf_hooks");

import {create_table_a} from "./create_table_a";
import {encryption_a} from "./encryption_a";
import {create_table_b} from "./create_table_b";
import {encryption_b} from "./encryption_b";
import * as fs from "fs";
import * as path from "path";
import {encryption_c} from "./encryption_c";
import {encryption_d} from "./encryption_d";
import {pingpong} from "./pingpong";
import {remote_only} from "./remote_only";
import {token} from "./token";
import {relay} from "./relay";

//@ts-ignore
global["WebSocket"] = WebSocket;


console.log("SKSERVER TEST SUITE");
let dbPath = path.normalize("./db/");

try {
    fs.rmSync(dbPath, {force: true, recursive: true});
} catch (err) {
    if (err.code !== 'EEXIST') throw err
}
try {
    fs.mkdirSync(dbPath)
} catch (err) {
    if (err.code !== 'EEXIST') throw err
}


let start = performance.now();

const tests: ((next:()=>void) => void)[] = [create_table_a, create_table_b, encryption_a, encryption_b,
    encryption_c, encryption_d, pingpong, remote_only, token, relay];

let idx = -1;
const next = () => {
    idx++;
    if (idx === tests.length) {
        let end = performance.now();
        let millis = end - start;
        let minutes = Math.floor(millis / 60000);
        let seconds = ((millis % 60000) / 1000).toFixed(0);

        console.log("ALL DONE IN " + minutes + " MINUTES " + seconds + " SECONDS.");
        process.exit(0);
    }
    tests[idx](next);
}

next();

