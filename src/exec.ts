import {exec} from "child_process";


export function exec_cmd(execstr: string): Promise<{content: string; error: string}> {
    return new Promise<{content: string; error: string}>( (resolve, reject) => {
        exec(execstr, (error, stdout, stderr) => {
            if (error) {
                return resolve({error: error.message, content: ""});
            }
            resolve({content: stdout, error: stderr});
        });
    });
}
