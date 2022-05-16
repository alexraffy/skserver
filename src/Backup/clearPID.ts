import * as path from "path";
import * as fs from "fs";

export function clearPID() {
    let pidFile = path.normalize(process.env.PWD + "/" + "skserver.pid");
    if (fs.existsSync(pidFile)) {
        fs.rmSync(pidFile);
    }
}