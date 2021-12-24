


import {WriteStream} from "fs";
import * as path from "path";
import * as fs from "fs";

export class Logger {
    private static _instance: Logger;
    private stream: WriteStream;
    private logFile: string;
    static get instance(): Logger {
        if (Logger._instance === undefined) {
            throw "Logger.constructor must be called with a path";
        }
        return Logger._instance;
    }
    constructor(dataPath: string, logName: string = "skserver") {
        Logger._instance = this;

        const logPath = path.normalize(dataPath + "/logs/"+logName+".log");
        this.logFile = logPath;

        this.stream = fs.createWriteStream(logPath, {encoding: "utf-8"});


    }

    write(...theArgs: string[]) {
        let message = theArgs.reduce((previous, current) => {
            return previous + current;
        })
        this.stream.write(message + "\r\n");
        console.log(message);
    }

    close() {
        this.stream.close();
    }

}