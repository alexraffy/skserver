import {setupServer} from "./setupServer";

let databaseWasShutdown = false;
export function encryption_d(next: ()=> void) {

    console.log("TESTING EXISTING ENCRYPTED DB WITH NO ENCRYPTION KEY")
    let dbPath = "./db/step2";
    let encryptionKey = ""
    let port = 30001;
    setupServer(1, false,
        dbPath,
        encryptionKey,
        port,
        "",
        undefined,
        undefined,
        undefined,
        false,
        false,[
        {
            pattern: "Database is encrypted and no key was provided",
            callback: (child, pattern: string) => {
                databaseWasShutdown = true;
            }
        }
    ]).then((v) => {
        if (v.error !== null) {
            throw new Error("An error occurred for test1: " + v.error);
        }
        next();
    }).catch((r) => {

        throw new Error("An error occurred for test1: " + r);
    });

}
