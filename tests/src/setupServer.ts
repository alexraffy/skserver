import {run_cmd} from "./run_cmd";


export function setupServer(dbPath: string, encryption: string, port: number, patternMatch: {pattern: string, callback: (child, string) => void}[]): Promise<{content: string; error: string}> {
    let envs = {
        "SKWORKER_7Z" : "C:\\Users\\alex\\Downloads\\7z2200 - extra\\x64\\7za.exe",
    "SKDB_PATH" : dbPath,
    "SKWORKER_ENCRYPTION" : encryption,
    "SKWORKER_ID" : 5,
    "SKWORKER_ALIVE" : 360000,
    "SKWORKER_PORT" : port
    };

    return run_cmd("node", ["../build/main.js"], envs, patternMatch);
}