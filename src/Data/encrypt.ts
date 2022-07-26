import {compressAB} from "sksql";
import * as crypto from "crypto";
import {getServerState} from "../main";


export function encrypt(data: ArrayBuffer | SharedArrayBuffer): ArrayBuffer {
    let compressed: ArrayBuffer = compressAB(data);
    let dvCompressed = new DataView(compressed);

    let iv = Buffer.alloc(16, crypto.randomBytes(16));
    let cipher = crypto.createCipheriv('aes-256-gcm', getServerState().encryptionKey, iv, { authTagLength: 16 });
    let encoded = Buffer.concat([cipher.update(dvCompressed), cipher.final()]);
    const authTag = cipher.getAuthTag();
    let result = Buffer.concat([iv, authTag, encoded]);
    cipher.destroy();
    let resultArrayBuffer = new ArrayBuffer(result.byteLength);
    let resultDV = new DataView(resultArrayBuffer);
    for (let i = 0; i < result.byteLength; i++) {
        resultDV.setUint8(i, result[i]);
    }
    return resultArrayBuffer;
}