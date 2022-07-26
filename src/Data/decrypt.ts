import * as crypto from "crypto";
import {getServerState} from "../main";
import {decompress} from "sksql";


export function decrypt(data: ArrayBuffer, useSharedArrayBuffer: boolean): ArrayBuffer | SharedArrayBuffer {
    let iv = new DataView(data, 0, 16);
    let authTag = new DataView(data, 16, 16);
    let decipher = crypto.createDecipheriv('aes-256-gcm', getServerState().encryptionKey, iv, {authTagLength: 16});
    decipher.setAuthTag(authTag);
    let chunk = new DataView(data, 32);
    let result = Buffer.concat([decipher.update(chunk), decipher.final()]);
    let ab = new ArrayBuffer(result.byteLength);
    let dvAB = new DataView(ab);
    for (let i = 0; i < ab.byteLength; i++) {
        dvAB.setUint8(i,result[i]);
    }
    return decompress(ab, useSharedArrayBuffer);
}