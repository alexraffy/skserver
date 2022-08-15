import {getServerState} from "./main";

import * as fs from "fs";
import {Logger} from "./Logger/Logger";
import {parseDateTimeString, TDateTime} from "sksql";



export function readTokenFile() {
    let tokens : {token: string, expiry: TDateTime, rights: string}[] = [];
    if (getServerState().tokenFile !== undefined && getServerState().tokenFile !== "") {
        if (fs.existsSync(getServerState().tokenFile)) {
            fs.readFile(getServerState().tokenFile, (err, data) => {
                if (err !== null) {
                    return Logger.instance.write(err.message);
                }
                let sTokens = data.toString();
                let arr = sTokens.split(",");
                for (let i = 0; i < arr.length; i++ ) {
                    let line = arr[i];
                    if (line !== "") {
                        let lineArr = line.split(" ");
                        if (lineArr.length === 3) {
                            let token = lineArr[0];
                            let expiry = lineArr[1];
                            let rights = lineArr[2];
                            tokens.push(
                                {
                                    token: token,
                                    expiry: parseDateTimeString(expiry),
                                    rights: rights
                                }
                            );

                        }
                    }
                }
                getServerState().tokenList = tokens;
                Logger.instance.write("Token list reloaded : " + tokens.length + " entries.");
            });
        } else {
            getServerState().tokenList = [];
        }
    }
}