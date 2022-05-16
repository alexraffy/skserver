import path from "path";
import fs from "fs";

export function clearPID() {
    let pidFile = path.normalize(process.env.PWD + "/" + "skserver.pid");
    fs.rmSync(pidFile);
}