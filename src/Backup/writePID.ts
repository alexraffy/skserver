import * as path from "path";
import * as fs from "fs";


export function writePID() {
    let pidFile = path.normalize(process.env.PWD + "/" + "skserver.pid");
    fs.writeFileSync(pidFile, process.pid.toString());
}