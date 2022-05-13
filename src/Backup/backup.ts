import {SKSQL} from "sksql";
import {exec_cmd} from "../exec";
import {Logger} from "../Logger/Logger";
import * as path from "path";


export function backup(folder: string, db: SKSQL, callback: (db: SKSQL, backupName: string, success: boolean) => void) {
    let backup_name = new Date().toISOString();
    Logger.instance.write("Backup in progress: " + backup_name);
    let zipFile = path.normalize(`${folder}/backups/${backup_name}.zip`);
    let source = path.normalize(`${folder}/db`);
    let command = `zip -r ${zipFile} ${source}`;
    exec_cmd(command).then((content) => {
        if (content.error !== undefined && content.error !== "") {
            Logger.instance.write("ERROR: ");
            Logger.instance.write(content.error);
            return callback(db, "", false);
        }
        callback(db, backup_name, true);
    }).catch((reason) => {
        Logger.instance.write("Error during backup: ", reason);
        callback(db, "", false);
    })


}