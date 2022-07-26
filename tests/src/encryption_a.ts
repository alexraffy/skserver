import {setupServer} from "./setupServer";

let databaseWasShutdown = false;

export function encryption_a( next: ()=> void) {
    console.log("TESTING EXISTING UNENCRYPTED DB WITH ENCRYPTION KEY")
    let dbPath = "./db/step1";
    let encryptionKey = "kYp2s5v8y/B?E(H+MbQeThWmZq4t7w9z"
    let port = 30001;
    setupServer(dbPath, encryptionKey, port, [
        {
            pattern: "Database is NOT encrypted and a key was provided",
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