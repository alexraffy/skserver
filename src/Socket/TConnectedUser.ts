import {TAuthSession, TDateTime} from "sksql";


export interface TConnectedUser {
    id: string;
    user: TAuthSession;
    connection: any;
    out_msg_id: number;
    in_msg_id: number;
    remoteMode: boolean;
    token: string;
    rights: "RW" | "R" | "W" | "N";
    expiry: TDateTime;
}