import * as path from "path";
import * as fs from "fs";




let pidFile = path.normalize(process.env.PWD + "/" + "skserver.pid");
if (fs.existsSync(pidFile)) {
    let pidData = fs.readFileSync(pidFile);
    let pidString = pidData.toString();
    let pid = parseInt(pidString);
    console.log("Sending SIGTERM to process " + pid);
    process.kill(pid, "SIGTERM");
    process.exit(0);
} else {
    console.log("No PID File.");
    process.exit(0);
}


