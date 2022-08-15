import {run_cmd} from "./run_cmd";


export function setupServer(workerId: number, privateDB: boolean,
                            dbPath: string,
                            encryption: string,
                            port: number,
                            tokenFile: string | undefined,
                            relayAddress: string | undefined,
                            relayToken : string | undefined,
                            heartbeat: string | undefined,
                            isReadOnly: boolean,
                            isRemoteOnly: boolean,
                            patternMatch: {pattern: string, callback: (child, string) => void}[]): Promise<{content: string; error: string}> {
    let envs = {
        "SKSERVER_7Z" : "C:\\Users\\alex\\Downloads\\7z2200 - extra\\x64\\7za.exe",
        "SKSERVER_DBPATH" : dbPath,
        "SKSERVER_ENCRYPTION" : encryption,
        "SKSERVER_ID" : "" + workerId,
        "SKSERVER_ALIVE" : "360000",
        "SKSERVER_PORT" : ""+port,
        "SKSERVER_READONLY": (isReadOnly === true) ? "YES" : "NO",
        "SKSERVER_REMOTEONLY": (isRemoteOnly === true) ? "YES" : "NO",
        "SKSERVER_PRIVATE": (privateDB === true) ? "YES" : "NO"
    };
    if (tokenFile !== undefined && tokenFile !== "") {
        envs["SKSERVER_TOKENLIST"] = tokenFile;
    }
    if (relayAddress !== undefined && relayAddress !== "") {
        envs["SKSERVER_RELAY"] = relayAddress;
    }
    if (relayToken !== undefined && relayToken !== "") {
        envs["SKSERVER_RELAYTOKEN"] = relayToken;
    }
    if (heartbeat !== undefined && heartbeat !== "") {
        envs["SKSERVER_HEARTBEAT"] = heartbeat;
    }

    return run_cmd("node", ["../build/main.js"], envs, patternMatch);
}