
import * as fs from "fs";


export function getPackageJSONVersion(path: string) {
    try {
        let data = fs.readFileSync(path).toString();
        let json = JSON.parse(data);
        return json["version"];
    } catch (e) {
        return "";
    }
}