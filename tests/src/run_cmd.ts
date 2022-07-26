import * as spawn from "cross-spawn";
import {exec, ChildProcess} from "child_process";

function resolveRun(exitCode, stdout, stderr) {
    stdout = stdout && stdout.toString();
    stderr = stderr && stderr.toString();

    if (exitCode !== 0) {
        return Object.assign(new Error(`Command failed, exited with code #${exitCode}`), {
            exitCode,
            stdout,
            stderr,
        });
    }

    return {
        stdout,
        stderr,
    };
}

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


export function run_cmd(exec: string, args: string[], envs: {}, patternMatch: {pattern: string, callback: (child: ChildProcess, string) => void}[]): Promise<{content: string; error: string}> {
    const child: ChildProcess = spawn(exec, args, { stdio: ["pipe", "pipe", "pipe", "ipc"], env: {...envs} });
    let promise = new Promise<{content: string; error: string}>( (resolve, reject) => {
        let stdout = null;
        let stderr = null;

        child.stdout && child.stdout.on('data', (data) => {
            stdout = stdout || new Buffer('');
            let d = data.toString();
            console.log(d);
            for (let i = 0; i < patternMatch.length; i++) {
                let p = patternMatch[i];
                if (d.indexOf(p.pattern) > -1) {
                    if (p.callback !== undefined) {
                        setTimeout(() => { p.callback(child, p); }, 10);
                    }
                }
            }

            stdout = Buffer.concat([stdout, data]);
        });

        child.stderr && child.stderr.on('data', (data) => {
            stderr = stderr || new Buffer('');
            console.log(data.toString());
            stderr = Buffer.concat([stderr, data]);
        });

        const cleanupListeners = () => {
            child.removeListener('error', onError);
            child.removeListener('close', onClose);
        };

        const onError = (err) => {
            cleanupListeners();
            reject(err);
        };

        const onClose = (code) => {
            cleanupListeners();

            const resolved = resolveRun(code, stdout, stderr);

            if (resolved instanceof Error) {
                reject(resolved);
            } else {
                resolve({content: resolved.stdout, error: resolved.stderr});
            }
        };

        child
            .on('error', onError)
            .on('close', onClose);
    });



    return promise;
}