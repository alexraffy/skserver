import {TAuthSession} from "sksql";


export interface TConnectedUser {
    id: number;
    user: TAuthSession;
    connection: any;
    out_msg_id: number;
    in_msg_id: number;
    remoteMode: boolean;
}