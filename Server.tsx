import { WebSocket, WebSocketServer, RawData } from 'ws';// https://www.npmjs.com/package/ws
import * as express from 'express';// https://www.npmjs.com/package/express
import { Application, Request, Response } from 'express';// https://www.npmjs.com/package/@types/express
import { readFileSync } from 'fs';

let config: {[sec: string]: {[key: string]: string}} = {};
function readConfig(): void {
    config = {};
    const configIni: string[] = readFileSync("./config.ini").toString()// read config file
        .split("\r")
        .join("")// remove carriage returns
        .split("\n");
    let sec: string = "";
    for (let i = 0; i < configIni.length; i++) {
        const line: string = configIni[i];
        if (line.startsWith("[")) { sec = line.split("[")[1].split("]")[0].trim(); continue; }
        if (line.startsWith(";")) continue;
        const lineSplt: string[] = line.split("=");
        const name: string = lineSplt.shift()!;
        const value: string = lineSplt.join("=").trim();
        config[sec] = config[sec] || [];
        config[sec][name] = value;
    }
}

function generateUUID(): string {
    var a = new Date().getTime();// Timestamp
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
        var b = Math.random() * 16;// random number between 0 and 16
        b = (a + b) % 16 | 0;
        a = Math.floor(a / 16);
        return (c === "x" ? b : ((b & 0x3) | 0x8)).toString(16);
    });
}
class ExpressWrapper {
    private app: Application;
    private port: number;
    constructor(_port: number = 80) {
        this.port = _port;
        this.app = express();
        this.app.use(express.json());
    }
    use(path:string, callback:(req:Request, res:Response)=>void): void {
        this.app.use(path,callback);
    }
    get(path:string, callback:(req:Request, res:Response)=>void) {
        this.app.get(path,callback);
    }
    post(path:string, callback:(req:Request, res:Response)=>void) {
        this.app.post(path,callback);
    }
    start(): Promise<void> {
        return new Promise<void>((resolve:()=>void)=>{
            this.get("*",(req:Request, res:Response)=>{
                res.status(404).send("<html><body>404 Page Not Found</body></html>");
            });
            const server:any = this.app.listen(this.port, function() {
                resolve();
            });
        });
    }
}

class WebsocketWrapper {
    private port: number;
    private wss: WebSocketServer;
    private onConnection: ((connectionKey:string)=>void)|undefined = undefined;
    private onClose: ((connectionKey:string)=>void)|undefined = undefined;
    private msgMode:"None"|"Msg"|"Str"|"Json" = "None";
    private onMessage: ((connectionKey:string, data: RawData)=>void)|undefined = undefined;
    private onString: ((connectionKey:string, data: string)=>void)|undefined = undefined;
    private onJson: ((connectionKey:string, data: any)=>void)|undefined = undefined;
    private connections: WebSocket[] = [];
    private connectionKeys:string[] = [];
    private connectionIndexByKey:{[key: string]: number} = {};
    constructor(_port: number = 8080) {
        this.port = _port;
        this.wss = new WebSocketServer({
            port: this.port,
            perMessageDeflate: {
                // Other options settable:
                clientNoContextTakeover: true, // Defaults to negotiated value.
                serverNoContextTakeover: true, // Defaults to negotiated value.
                serverMaxWindowBits: 10, // Defaults to negotiated value.
                // Below options specified as default values.
                concurrencyLimit: 10, // Limits zlib concurrency for perf.
                threshold: 1024 // Size (in bytes) below which messages
                // should not be compressed if context takeover is disabled.
            }
        });
    }

    //#region set callbacks
    setOnConnection(callback: (this: WebsocketWrapper, connectionKey:string)=>void): void {
        this.onConnection=callback.bind(this);
    }
    setOnClose(callback: (this: WebsocketWrapper, connectionKey:string)=>void): void {
        this.onClose=callback.bind(this);
    }
    setOnMessage(callback: (this: WebsocketWrapper, connectionKey:string, data: RawData)=>void): void {
        this.msgMode="Str";
        this.onMessage=callback.bind(this);
    }
    setOnStringMessage(callback: (this: WebsocketWrapper, connectionKey:string, data: string)=>void): void {
        this.msgMode="Msg";
        this.onString=callback.bind(this);
    }
    setOnJsonMessage(callback: (this: WebsocketWrapper, connectionKey:string, data: any)=>void): void {
        this.msgMode="Json";
        this.onJson=callback.bind(this);
    }
    //#endregion set callbacks

    //#region send funcs
    // send to single websocket
    send(key: string, data: string): void {
        // verify key and index
        if (key==undefined) return;
        if (this.connectionIndexByKey[key]==undefined) return;
        const index: number = this.connectionIndexByKey[key];
        // send string data
        this.connections[index].send(data);
        // console.log("Sending \"" + data + "\" to connection with key " + key)
    }
    sendJson(key: string, data:any): void {
        this.send(key, JSON.stringify(data))
    }
    // send single message to all websockets
    sendAll(data: string): void {
        for (let i = 0; i < this.connectionKeys.length; i++)
            if (this.connectionKeys[i] != undefined)
                this.send(this.connectionKeys[i], data);
    }
    sendJsonAll(data: any): void {
        for (let i = 0; i < this.connectionKeys.length; i++)
            if (this.connectionKeys[i] != undefined)
                this.sendJson(this.connectionKeys[i], data);
    }
    // send batch of messages based on key, msg ordered pair
    sendBatch(messages: [string, string][]): void {
        for (let i = 0; i < messages.length; i++) {
            const [key, data]: [string, string] = messages[i];
            this.send(key, data);
        }
    }
    sendJsonBatch(messages: [string, any][]): void {
        for (let i = 0; i < messages.length; i++) {
            const [key, data]: [string, string] = messages[i];
            this.sendJson(key, data);
        }
    }
    // send different messages to each websocket based on key.
    sendEach(generator: (key: string)=>string): void {
        for (let i = 0; i < this.connectionKeys.length; i++) {
            // verify key and index
            if (this.connectionKeys[i] == undefined) continue;
            const key: string = this.connectionKeys[i];
            this.send(key, generator(key));
        }
    }
    sendJsonEach(generator: (key: string)=>any): void {
        for (let i = 0; i < this.connectionKeys.length; i++) {
            // verify key and index
            if (this.connectionKeys[i] == undefined) continue;
            const key: string = this.connectionKeys[i];
            this.sendJson(key, generator(key));
        }
    }
    //#endregion send funcs

    closeConnection(key: string): void {
        // verify key and index
        if (key==undefined) return;
        if (this.connectionIndexByKey[key]==undefined) return;
        const index: number = this.connectionIndexByKey[key];
        // close connection
        this.connections[index].close();
    }
    start(): Promise<void> {
        return new Promise<void>((resolve:()=>void)=>{
            this.wss.on('connection', ((ws: WebSocket)=>{
                const key:string = generateUUID();
                this.connectionIndexByKey[key] = this.connections.length;
                this.connections.push(ws);
                this.connectionKeys.push(key);
                console.log("New connection with key \"" + key + "\"");
    
                ws.on('error', ((...data:any[])=>{
                    ws.close();
                    console.log(...data);
                }).bind(this));
    
                ws.on('message', ((data: RawData)=>{
                    switch (this.msgMode) {
                        case "Msg":
                            try {
                                this.onMessage!(key, data);
                            } catch (error) {
                                console.log("unknown error:",error);
                            }
                        case "Str":
                            try {
                                this.onString!(key, data.toString());
                            } catch (error) {
                                console.log("unknown error:",error);
                            }
                        case "Json":
                            let json = undefined;
                            let hadError = false;
                            try {
                                json = JSON.parse(data.toString());
                            } catch (error) {
                                hadError=true;
                                console.log("invalid json error:",error);
                            }
                            if (!hadError) {
                                try {
                                    this.onJson!(key, json);
                                } catch (error) {
                                    console.log("unknown error:",error);
                                }
                            }
                        case "None":
                        default:
                            break;
                    }
                }).bind(this));
    
                ws.on('close', ((code: number, reason: Buffer)=>{
                    const index: number = this.connectionIndexByKey[key];
                    delete this.connectionIndexByKey[key];
                    delete this.connectionKeys[index];
                    delete this.connections[index];
                    if (this.onClose) this.onClose(key);
                }).bind(this));
                if (this.onConnection) this.onConnection(key);
            }).bind(this));
            resolve();
        });
    }
}

//#region types
type parameterType = {
    type: "String"|"Number"|"Bool"|"Color",
    defaultValue?: string|number|boolean;
}
type functionType = {
    name: string,
    overloads: {
        visible: boolean,
        parameters: parameterType[]
    }[]
}
type valueType = {
    name: string,
    type: "String"|"Number"|"Bool"|"Color",
}
type clientType = {
    name: string,
    functions?: functionType[],
    values?: valueType[],
    children?: clientType[]
}
//#endregion types

//#region type validation functions
function verifyparameter(param: parameterType): boolean {
    if ((typeof param) != "object") return false;
    if (
        (param.type !== "String") &&
        (param.type !== "Number") &&
        (param.type !== "Bool") &&
        (param.type !== "Color")
    ) return false;
    if (param.defaultValue !== undefined) {
        switch(param.type) {
            case "String":
                if ((typeof param.defaultValue) !== "string") return false;
                break;
            case "Number":
                if ((typeof param.defaultValue) !== "number") {
                    if (Number(param.defaultValue).toString() != param.defaultValue) return false;
                }
                break;
            case "Bool":
                if ((typeof param.defaultValue) !== "boolean") {
                    if ((param.defaultValue !== "true") && (param.defaultValue !== "false")) return false;
                }
                break;
            case "Color":
                if ((typeof param.defaultValue) !== "string") return false;
                else {
                    // validate color
                }
                break;
            default:
                return false;
        }
    }
    return true;
}
function verifyOverload(overload: {visible: boolean, parameters: parameterType[]}): boolean {
    if ((typeof overload) != "object") return false;
    if ((overload.visible !== true) && (overload.visible !== false)) return false;
    if (!overload.parameters.map(verifyparameter).every((val: boolean)=>val)) return false;
    return true;
}
function verifyFunction(func: functionType): boolean {
    if ((typeof func) != "object") return false;
    if (func.name == "") return false;
    if (!func.overloads.map(verifyOverload).every((val: boolean)=>val)) return false;
    return true;
}
function verifyValue(value: valueType): boolean {
    if ((typeof value) != "object") return false;
    if (value.name == "") return false;
    if (
        (value.type !== "String") &&
        (value.type !== "Number") &&
        (value.type !== "Bool") &&
        (value.type !== "Color")
    ) return false;
    return true;
}
function verifyClient(client: clientType): boolean {
    if ((typeof client) != "object") return false;
    if (client.name == "") return false;
    let hasUse: boolean = false;
    if (client.functions != undefined) {
        if (!Array.isArray(client.functions)) return false;
        if (client.functions.length != 0) hasUse = true;
        if (!client.functions.map(verifyFunction).every((val: boolean)=>val)) return false;
    }
    if (client.values != undefined) {
        if (!Array.isArray(client.values)) return false;
        if (client.values.length != 0) hasUse = true;
        if (!client.values.map(verifyValue).every((val: boolean)=>val)) return false;
    }
    if (client.children != undefined) {
        if (!Array.isArray(client.children)) return false;
        if (client.children.length != 0) hasUse = true;
        if (!client.children.map(verifyClient).every((val: boolean)=>val)) return false;
    }
    if (!hasUse) return false;
    return true;
}
//#endregion type validation functions

class ConnectionHandler {
    private wbsckt: WebsocketWrapper;
    private exprs: ExpressWrapper;
    private websocketConnectionKeys: string[] = [];
    private websocketPingStatuses: {[key: string]: boolean} = {};

    private clients: clientType[] = [];
    private clientNameToIndex: {[name: string]: number} = {};
    private clientIndexToConnectionKey: string[] = [];
    constructor(websocketPort: number, httpPort: number) {
        this.wbsckt = new WebsocketWrapper(websocketPort);
        this.wbsckt.setOnConnection((function (this: ConnectionHandler, connectionKey: string) {
            this.websocketConnectionKeys.push(connectionKey);
            this.websocketPingStatuses[connectionKey] = false;
            this.wbsckt.sendJson(connectionKey, { key: connectionKey });
        }).bind(this));
        this.wbsckt.setOnClose((function (this: ConnectionHandler, connectionKey: string) {
            delete this.websocketConnectionKeys[this.websocketConnectionKeys.indexOf(connectionKey)];
            delete this.websocketPingStatuses[connectionKey];
            const clientIndex = this.clientIndexToConnectionKey.indexOf(connectionKey);
            if (clientIndex !== -1) {
                delete this.clientIndexToConnectionKey[clientIndex];
                const name: string = this.clients[clientIndex].name;
                delete this.clients[clientIndex];
                delete this.clientNameToIndex[name];
                console.log("Client \"" + name + "\" disconnected.");
            }
            console.log("Connection with key \"" + connectionKey + "\" closed.");
        }).bind(this));
        this.wbsckt.setOnJsonMessage((function (this: ConnectionHandler, connectionKey: string, data: any) {
            if (data.type == "pong") {
                this.websocketPingStatuses[connectionKey] = true;
                return;
            } else if (data.type == "connection") {
                if (!verifyClient(data.client)) return;
                console.log("Client \"" + data.client.name + "\" connected.");
                this.clientNameToIndex[data.client.name] = this.clients.length;
                this.clientIndexToConnectionKey.push(connectionKey);
                this.clients.push(data.client);
            } else if (data.type == "call") {
                const index: number = this.clientNameToIndex[data.client];
                if (index == undefined) return;
                const key: string = this.clientIndexToConnectionKey[index];
                if (key == undefined) return;
                this.wbsckt.sendJson(key, {
                    type: "call",
                    function: data.function,
                    parameters: data.parameters
                })
            }
        }).bind(this));

        this.exprs = new ExpressWrapper(httpPort);
        this.exprs.post("/connect", (function (this: ConnectionHandler, req:Request, res:Response) {
            console.log(req.body);
        }).bind(this));
        this.exprs.post("/keepAlive", (function (this: ConnectionHandler, req:Request, res:Response) {
            console.log(req.body);
        }).bind(this));
    }
    start() {
        Promise.all([this.wbsckt.start(), this.exprs.start()]).then(() => {
            setInterval(() => {
                for (let i = 0; i < this.websocketConnectionKeys.length; i++) {
                    if (this.websocketConnectionKeys[i] == undefined) continue;
                    this.websocketPingStatuses[this.websocketConnectionKeys[i]] = false;
                }
                this.wbsckt.sendJsonAll({type: "ping"});
                setTimeout(() => {
                    for (let i = 0; i < this.websocketConnectionKeys.length; i++) {
                        if (this.websocketConnectionKeys[i] == undefined) continue;
                        const key: string = this.websocketConnectionKeys[i];
                        if (!this.websocketPingStatuses[key]) {
                            // close connection and clear related data
                            this.wbsckt.closeConnection(key);
                        }// else console.log("Connection with key \"" + key + "\" is still open.");
                    }
                }, 1000);
            }, 7500);
            console.clear();
            console.log("Server started.");
            console.log("Websocket server on mocs.campbellsimpson.com:" + websocketPort + ".");
            console.log("Https server on mocs.campbellsimpson.com:" + httpPort + ".");
        });
    }
}

// create and start server
readConfig();
const websocketPort: number = Number(config.Ports.ws);
const httpPort: number = Number(config.Ports.http);
const server: ConnectionHandler = new ConnectionHandler(websocketPort, httpPort);
server.start();