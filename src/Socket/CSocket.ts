

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
    TWSRGNID, SKSQL, TDateTimeCmp, TDateTime, generateV4UUID
} from "sksql";
import {TConnectedUser} from "./TConnectedUser";
import {wsrGetNextId} from "./wsrGetNextId";
import {getServerState} from "../main";
import {date_getutcdate} from "sksql/build/Functions/Date/date_getutcdate";


export class CSocket {
    private static _instance: CSocket = undefined;
    private clients: TConnectedUser[] = [];
    private db: SKSQL;

    constructor(db: SKSQL) {
        this.db = db;
    }



    broadcast(from: string, message: string, param: any) {
        Logger.instance.write("Broadcasting " + message + " to " + this.clients.length + " ")
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
                Logger.instance.write("broadcasting " + message + " to " + this.clients[i].user.name);
                (this.clients[i].connection as WebSocket).send(JSON.stringify(payload));
            }
        }
    }

    send(id: string, message: string, param: any) {
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
            let clientConnectionString = request.socket.remoteAddress  + ":" + request.socket.remotePort;
            Logger.instance.write(clientConnectionString + "\t" + 'Connection in progress');

            /*
            let headersKeys = request.headers;
            for (let key in headersKeys) {
                //@ts-ignore
                Logger.instance.write(key, ": ", request.headers[key]);
            }

             */
            let id = generateV4UUID();
            this.clients.push({
                id: id,
                user: undefined,
                out_msg_id: 0,
                in_msg_id: 0,
                connection: ws,
                remoteMode: false,
                token: "",
                rights: "N",
                expiry: undefined
            });

            ws.on("open", () => {
                console.log("Connection opened.");
            });
            ws.on("close", () => {
                let idx = this.clients.findIndex((v) => { return v.id === id;});
                if (idx > -1) {
                    this.clients.splice(idx, 1);
                }
            });
            ws.on("message", (data) => {
                if (getServerState().shutdownRequested === true) {
                    return false;
                }
                if (getServerState().shutdownTimer !== undefined) {
                    getServerState().shutdownTimer.ping();
                }

                let content = data.toString();
                let payload: TSocketRequest;
                try {
                    payload = JSON.parse(content);
                } catch (errorParse) {
                    Logger.instance.write(clientConnectionString + "\t" + "Received gibberish: ", content);
                    return false;
                }
                //console.log(payload.message);
                if (payload.message === WSRAuthenticate) {
                    let msg = payload.param as TWSRAuthenticateRequest;
                    let con_id = msg.id;
                    let info = msg.info;
                    if (con_id !== undefined && info !== undefined) {
                        let client = this.clients.find((c) => {
                            return c.id === con_id;
                        });
                        if (client !== undefined) {
                            client.remoteMode = msg.info.remoteOnly === true;
                            client.user = JSON.parse(JSON.stringify(info));
                            // is a token necessary?
                            if (getServerState().privateDB === true) {
                                const t = (client.user.token === undefined) ? "" : client.user.token.toUpperCase();
                                Logger.instance.write("Authenticating with token [" + t  + "]");
                                client.user.valid = false;
                                const tokens = getServerState().tokenList;
                                Logger.instance.write("Token List: " + tokens.length);
                                for (let i = 0; i < tokens.length; i++) {
                                    if (tokens[i].token.toUpperCase() === t) {
                                        // check the expiry
                                        let now = date_getutcdate(undefined) as TDateTime;
                                        if (TDateTimeCmp(now, tokens[i].expiry) === -1) {
                                            client.user.valid = true;
                                            Logger.instance.write("Token OK.");
                                            client.rights = tokens[i].rights as "RW" | "R" | "W" | "N";
                                            client.user.accessRights = tokens[i].rights;
                                            client.token = tokens[i].token;
                                            client.expiry = tokens[i].expiry;
                                        } else {
                                            Logger.instance.write("Token expired.");
                                        }
                                        break;
                                    }
                                }

                            } else {
                                client.user.valid = true;
                            }

                            if (getServerState().remoteOnly === true) {
                                client.user.remoteOnly = true;
                            }
                            if (getServerState().readOnly === true) {
                                client.user.readOnly = true;
                            }
                            this.send(con_id, WSRAuthenticate, { con_id: con_id, info: client.user } as TWSRAuthenticateResponse);
                            if (client.user.valid === true) {
                                Logger.instance.write(clientConnectionString + "\t" + 'Connection accepted');
                                // broadcast new user
                                for (let i = 0; i < this.clients.length; i++) {
                                    let cl = this.clients[i];
                                    if (cl.id !== client.id) {
                                        this.send(cl.id, WSRON, {id: client.id, name: client.user.name} as TWSRON)
                                    }
                                }
                            } else {
                                Logger.instance.write(clientConnectionString + "\t" + "Connection denied");
                                (client.connection as WebSocket).close(1000);
                                let idx = this.clients.findIndex((v) => { return v.id === id;});
                                if (idx > -1) {
                                    this.clients.splice(idx, 1);
                                }

                            }

                        }
                    }
                    return false;
                }
                let client = this.clients.find((c) => {
                    return c.id === id;
                });
                if (client === undefined) {
                    return false;
                }
                let requestEnv = client.user;

                switch (payload.message) {
///////////////////////// SQL query received
                    case WSRSQL:
                        return wsrSQL(this.db, requestEnv, this, client.id, (payload.param) as TWSRSQL, client.remoteMode, clientConnectionString);
                    case WSRDataRequest:
                        return wsrDataRequest(this.db, requestEnv, this, client.id, (payload.param) as TWSRDataRequest, client.remoteMode, clientConnectionString);
                    case WSRGNID:
                        return wsrGetNextId(this.db, requestEnv, this, client.id, (payload.param) as TWSRGNID, clientConnectionString);
///////////////////////// UNKNOWN MESSAGES
                    default: {
                        Logger.instance.write(clientConnectionString + "\t" + "Unknown message " + payload.message);
                        Logger.instance.write(clientConnectionString + "\t" + "Payload was " + JSON.stringify(payload));
                        break;
                    }
                }
            });
            this.send(id, WSRAuthenticatePlease, { id: id } as TWSRAuthenticatePleaseResponse)
        });


    }



}