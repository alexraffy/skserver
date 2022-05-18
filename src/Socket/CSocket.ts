

import * as ws from 'ws';
import {Logger} from "../Logger/Logger";
import {Timer} from "../Timer/Timer";

import {wsrSQL} from "./wsrSQL";
import {wsrDataRequest} from "./wsrDataRequest";
import {
    TSocketRequest,
    TSocketResponse,
    WSRAuthenticate,
    TWSRAuthenticateRequest,
    TWSRAuthenticateResponse,
    WSRON,
    TWSRON,
    TWSRSQL,
    TWSRDataRequest,
    WSRDataRequest,
    WSRSQL, WSRGNID,
    WSRAuthenticatePlease,
    TWSRAuthenticatePleaseResponse,
    TWSRGNID, SKSQL
} from "sksql";
import {TConnectedUser} from "./TConnectedUser";
import {wsrGetNextId} from "./wsrGetNextId";
import {getServerState} from "../main";


export class CSocket {
    private static _instance: CSocket = undefined;
    private clients: TConnectedUser[] = [];
    private db: SKSQL;

    constructor(db: SKSQL) {
        this.db = db;
    }



    broadcast(from: number, message: string, param: any) {
        for (let i = 0; i < this.clients.length; i++) {
            if (this.clients[i].id !== from && this.clients[i].remoteMode !== true) {
                this.clients[i].out_msg_id++;
                let payload: TSocketResponse = {
                    id: from,
                    msg_id: this.clients[i].out_msg_id,
                    prev_id: 0,
                    message: message,
                    param: param
                };
                (this.clients[i].connection as WebSocket).send(JSON.stringify(payload));
            }
        }
    }

    send(id: number, message: string, param: any) {
        for (let i = 0; i < this.clients.length; i += 1) {
            if (this.clients[i].id === id) {
                let payload: TSocketResponse = {
                    id: id,
                    msg_id: 0,
                    prev_id: 0,
                    message: message,
                    param: param
                };
                (this.clients[i].connection as WebSocket).send(JSON.stringify(payload));
                return;
            }
        }
    }

    closeAll() {
        for (let i = 0; i < this.clients.length; i++) {
            (this.clients[i].connection as WebSocket).close();
        }
    }
    setup(port: number) {
        var wsServer = new ws.Server({
            port: port,
            perMessageDeflate:false
        });
        wsServer.on("connection", (ws,request) => {
            if (getServerState().shutdownRequested === true) {
                return ws.close();
            }

            Logger.instance.write((new Date()) + ' Connection');
            let headersKeys = request.headers;
            for (let key in headersKeys) {
                //@ts-ignore
                Logger.instance.write(key, ": ", request.headers[key]);
            }
            let index = this.clients.push({
                id: this.clients.length + 1,
                user: undefined,
                out_msg_id: 0,
                in_msg_id: 0,
                connection: ws,
                remoteMode: false
            });

            ws.on("open", () => {
                console.log("Connection opened.");
            });
            ws.on("message", (data) => {
                if (getServerState().shutdownRequested === true) {
                    return false;
                }
                let content = data.toString();
                let payload: TSocketRequest;
                try {
                    payload = JSON.parse(content);
                } catch (errorParse) {
                    Logger.instance.write("Received gibberish: ", content);
                    return false;
                }
                console.log(payload.message);
                if (payload.message === WSRAuthenticate) {
                    let msg = payload.param as TWSRAuthenticateRequest;
                    let con_id = msg.id;
                    let info = msg.info;
                    if (con_id !== undefined && info !== undefined) {
                        let client = this.clients.find((c) => {
                            return c.id === con_id;
                        });
                        if (client !== undefined) {
                            client.remoteMode = msg.remoteMode;
                            client.user = info;
                            this.send(con_id, WSRAuthenticate, { con_id: con_id } as TWSRAuthenticateResponse);
                            // broadcast new user
                            for (let i = 0; i < this.clients.length; i++) {
                                let cl = this.clients[i];
                                if (cl.id !== client.id) {
                                    this.send(cl.id, WSRON, {id: client.id, name: client.user.name} as TWSRON)
                                }
                            }
                        }
                    }
                    return false;
                }
                let client = this.clients.find((c) => {
                    return c.id === index;
                });
                if (client === undefined) {
                    return false;
                }
                let requestEnv = client.user;
                Timer.instance.ping();
                switch (payload.message) {
///////////////////////// SQL query received
                    case WSRSQL:
                        return wsrSQL(this.db, requestEnv, this, client.id, (payload.param) as TWSRSQL, client.remoteMode);
                    case WSRDataRequest:
                        return wsrDataRequest(this.db, requestEnv, this, client.id, (payload.param) as TWSRDataRequest, client.remoteMode);
                    case WSRGNID:
                        return wsrGetNextId(this.db, requestEnv, this, client.id, (payload.param) as TWSRGNID);
///////////////////////// UNKNOWN MESSAGES
                    default: {
                        Logger.instance.write("Unknown message " + payload.message);
                        Logger.instance.write("Payload was " + JSON.stringify(payload));
                        break;
                    }
                }
            });
            this.send(index, WSRAuthenticatePlease, { id: index } as TWSRAuthenticatePleaseResponse)
        });


    }



}