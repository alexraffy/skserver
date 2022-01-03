

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
    WSRSQL,
    WSRAuthenticatePlease,
    TWSRAuthenticatePleaseResponse
} from "sksql";
import {TConnectedUser} from "./TConnectedUser";

export class CSocket {
    private static _instance: CSocket = undefined;
    private clients: TConnectedUser[] = [];


    static get instance(): CSocket {
        if (CSocket._instance === undefined) {
            CSocket._instance = new CSocket();
        }
        return CSocket._instance;
    }

    broadcast(from: number, message: string, param: any) {
        for (let i = 0; i < this.clients.length; i++) {
            if (this.clients[i].id !== from) {
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


    setup(port: number) {
        var wsServer = new ws.Server({
            port: port,
            perMessageDeflate:false
        });
        wsServer.on("connection", (ws,request) => {

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
                connection: ws
            });

            ws.on("open", () => {
                console.log("Connection opened.");
            });
            ws.on("message", (data) => {
                let content = data.toString();

                let payload: TSocketRequest = JSON.parse(content);

                if (payload.message === WSRAuthenticate) {
                    let msg = payload.param as TWSRAuthenticateRequest;
                    let con_id = msg.id;
                    let info = msg.info;
                    if (con_id !== undefined && info !== undefined) {
                        let client = this.clients.find((c) => {
                            return c.id === con_id;
                        });
                        if (client !== undefined) {
                            client.user = info;
                            this.send(con_id, WSRAuthenticate, { con_id: con_id } as TWSRAuthenticateResponse);
                            // broadcast new user
                            for (let i = 0; i < this.clients.length; i++) {
                                let cl = this.clients[i];
                                if (cl.id !== client.id) {
                                    this.send(cl.id, WSRON, {id: cl.id, name: cl.user.name} as TWSRON)
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
                        return wsrSQL(requestEnv, this, client.id, (payload.param) as TWSRSQL);
                    case WSRDataRequest:
                        return wsrDataRequest(requestEnv, this, client.id, (payload.param) as TWSRDataRequest);
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