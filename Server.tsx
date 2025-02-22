import { WebSocket, WebSocketServer, RawData } from "ws";// https://www.npmjs.com/package/ws
import * as express from "express";// https://www.npmjs.com/package/express
import { Application, Request, Response } from "express";// https://www.npmjs.com/package/@types/express
import { readFileSync } from "fs";

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
    use(path: string, callback: (req: Request, res: Response)=> void): void {
        this.app.use(path, callback);
    }
    get(path: string, callback: (req: Request, res: Response)=> void) {
        this.app.get(path, callback);
    }
    post(path: string, callback: (req: Request, res: Response)=> void) {
        this.app.post(path, callback);
    }
    start(): Promise<void> {
        return new Promise<void>((resolve: ()=> void) => {
            this.get("*", (req: Request, res: Response) => {
                res.status(404).send("<html><body>404 Page Not Found</body></html>");
            });
            const server: any = this.app.listen(this.port, function() {
                resolve();
            });
        });
    }
}

class WebsocketWrapper {
    private port: number;
    private wss: WebSocketServer;
    private onConnection: ((connectionKey: string)=> void)|undefined = undefined;
    private onClose: ((connectionKey: string)=> void)|undefined = undefined;
    private msgMode: "None"|"Msg"|"Str"|"Json" = "None";
    private onMessage: ((connectionKey: string, data: RawData)=> void)|undefined = undefined;
    private onString: ((connectionKey: string, data: string)=> void)|undefined = undefined;
    private onJson: ((connectionKey: string, data: any)=> void)|undefined = undefined;
    private connections: WebSocket[] = [];
    private connectionKeys: string[] = [];
    private connectionIndexByKey: {[key: string]: number} = {};
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

    // #region set callbacks
    setOnConnection(callback: (this: WebsocketWrapper, connectionKey: string)=> void): void {
        this.onConnection = callback.bind(this);
    }
    setOnClose(callback: (this: WebsocketWrapper, connectionKey: string)=> void): void {
        this.onClose = callback.bind(this);
    }
    setOnMessage(callback: (this: WebsocketWrapper, connectionKey: string, data: RawData)=> void): void {
        this.msgMode = "Str";
        this.onMessage = callback.bind(this);
    }
    setOnStringMessage(callback: (this: WebsocketWrapper, connectionKey: string, data: string)=> void): void {
        this.msgMode = "Msg";
        this.onString = callback.bind(this);
    }
    setOnJsonMessage(callback: (this: WebsocketWrapper, connectionKey: string, data: any)=> void): void {
        this.msgMode = "Json";
        this.onJson = callback.bind(this);
    }
    // #endregion set callbacks

    // #region send funcs
    // send to single websocket
    send(key: string, data: string): void {
        // verify key and index
        if (key == undefined) return;
        if (this.connectionIndexByKey[key] == undefined) return;
        const index: number = this.connectionIndexByKey[key];
        // send string data
        this.connections[index].send(data);
        // console.log("Sending \"" + data + "\" to connection with key " + key)
    }
    sendJson(key: string, data: any): void {
        this.send(key, JSON.stringify(data));
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
            const [ key, data ]: [string, string] = messages[i];
            this.send(key, data);
        }
    }
    sendJsonBatch(messages: [string, any][]): void {
        for (let i = 0; i < messages.length; i++) {
            const [ key, data ]: [string, string] = messages[i];
            this.sendJson(key, data);
        }
    }
    // send different messages to each websocket based on key.
    sendEach(generator: (key: string)=> string): void {
        for (let i = 0; i < this.connectionKeys.length; i++) {
            // verify key and index
            if (this.connectionKeys[i] == undefined) continue;
            const key: string = this.connectionKeys[i];
            this.send(key, generator(key));
        }
    }
    sendJsonEach(generator: (key: string)=> any): void {
        for (let i = 0; i < this.connectionKeys.length; i++) {
            // verify key and index
            if (this.connectionKeys[i] == undefined) continue;
            const key: string = this.connectionKeys[i];
            this.sendJson(key, generator(key));
        }
    }
    // #endregion send funcs

    closeConnection(key: string): void {
        // verify key and index
        if (key == undefined) return;
        if (this.connectionIndexByKey[key] == undefined) return;
        const index: number = this.connectionIndexByKey[key];
        // close connection
        this.connections[index].close();
    }
    start(): Promise<void> {
        return new Promise<void>((resolve: ()=> void) => {
            this.wss.on("connection", ((ws: WebSocket) => {
                const key: string = generateUUID();
                this.connectionIndexByKey[key] = this.connections.length;
                this.connections.push(ws);
                this.connectionKeys.push(key);
                console.log("New connection with key \"" + key + "\"");
    
                ws.on("error", ((...data: any[]) => {
                    ws.close();
                    console.log(...data);
                }).bind(this));
    
                ws.on("message", ((data: RawData) => {
                    switch (this.msgMode) {
                        case "Msg":
                            try {
                                this.onMessage!(key, data);
                            } catch (error) {
                                console.log("unknown error:", error);
                            }
                        case "Str":
                            try {
                                this.onString!(key, data.toString());
                            } catch (error) {
                                console.log("unknown error:", error);
                            }
                        case "Json":
                            let json = undefined;
                            let hadError = false;
                            try {
                                json = JSON.parse(data.toString());
                            } catch (error) {
                                hadError = true;
                                console.log("invalid json error:", error);
                            }
                            if (!hadError) {
                                try {
                                    this.onJson!(key, json);
                                } catch (error) {
                                    console.log("unknown error:", error);
                                }
                            }
                        case "None":
                        default:
                            break;
                    }
                }).bind(this));
    
                ws.on("close", ((code: number, reason: Buffer) => {
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

// #region types
type parameterType = {
    type: "String"|"Number"|"Bool"|"Color",
    defaultValue?: string|number|boolean
};
type functionType = {
    name: string,
    overloads: {
        visible: boolean,
        parameters: parameterType[]
    }[]
};
type valueType = {
    name: string,
    type: "String"|"Number"|"Bool"|"Color"
};
type deviceType = {
    name: string,
    functions?: functionType[],
    values?: valueType[],
    children?: deviceType[]
};
// #endregion types

// #region type validation functions
function verifyparameter(param: parameterType): boolean {
    if ((typeof param) != "object") return false;
    if (
        (param.type !== "String") && (param.type !== "Number") && (param.type !== "Bool") && (param.type !== "Color")
    ) return false;
    if (param.defaultValue !== undefined) {
        switch (param.type) {
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
    if (!overload.parameters.map(verifyparameter).every((val: boolean) => val)) return false;
    return true;
}
function verifyFunction(func: functionType): boolean {
    if ((typeof func) != "object") return false;
    if (func.name == "") return false;
    if (!func.overloads.map(verifyOverload).every((val: boolean) => val)) return false;
    return true;
}
function verifyValue(value: valueType): boolean {
    if ((typeof value) != "object") return false;
    if (value.name == "") return false;
    if (
        (value.type !== "String") && (value.type !== "Number") && (value.type !== "Bool") && (value.type !== "Color")
    ) return false;
    return true;
}
function verifyDevice(device: deviceType): boolean {
    if ((typeof device) != "object") return false;
    if (device.name == "") return false;
    let hasUse: boolean = false;
    if (device.functions != undefined) {
        if (!Array.isArray(device.functions)) return false;
        if (device.functions.length != 0) hasUse = true;
        if (!device.functions.map(verifyFunction).every((val: boolean) => val)) return false;
    }
    if (device.values != undefined) {
        if (!Array.isArray(device.values)) return false;
        if (device.values.length != 0) hasUse = true;
        if (!device.values.map(verifyValue).every((val: boolean) => val)) return false;
    }
    if (device.children != undefined) {
        if (!Array.isArray(device.children)) return false;
        if (device.children.length != 0) hasUse = true;
        if (!device.children.map(verifyDevice).every((val: boolean) => val)) return false;
    }
    if (!hasUse) return false;
    return true;
}
// #endregion type validation functions

class ConnectionHandler {
    private wbsckt: WebsocketWrapper;
    private exprs: ExpressWrapper;
    private websocketConnectionKeys: string[] = [];
    private websocketWsLastPingTime: {[key: string]: number} = {};

    private devices: deviceType[] = [];
    private deviceNameToIndex: {[name: string]: number} = {};

    private deviceWsConnectionKey: (string|undefined)[] = [];
    private deviceHttpConnectionIds: (string|undefined)[] = [];

    private deviceHttpLastPingTime: {[id: string]: number} = {};
    private httpConnectionCmdQueue: {[id: string]: any[]} = {};
    constructor(websocketPort: number, httpPort: number) {
        this.wbsckt = new WebsocketWrapper(websocketPort);
        this.wbsckt.setOnConnection((function(this: ConnectionHandler, connectionKey: string) {
            this.websocketConnectionKeys.push(connectionKey);
            this.websocketWsLastPingTime[connectionKey] = (new Date()).getTime();
            this.wbsckt.sendJson(connectionKey, { key: connectionKey });
        }).bind(this));
        this.wbsckt.setOnClose((function(this: ConnectionHandler, connectionKey: string) {
            delete this.websocketConnectionKeys[this.websocketConnectionKeys.indexOf(connectionKey)];
            delete this.websocketWsLastPingTime[connectionKey];
            const deviceIndex = this.deviceWsConnectionKey.indexOf(connectionKey);
            if (deviceIndex !== -1) {
                const name: string = this.devices[deviceIndex].name;
                console.log("Device \"" + name + "\" disconnected.");
                delete this.devices[deviceIndex];
                delete this.deviceNameToIndex[name];
                delete this.deviceWsConnectionKey[deviceIndex];
                delete this.deviceHttpConnectionIds[deviceIndex];
            }
            console.log("Closed connection with key \"" + connectionKey + "\".");
        }).bind(this));
        this.wbsckt.setOnJsonMessage((function(this: ConnectionHandler, connectionKey: string, data: any) {
            if (data.type == "pong") {
                this.websocketWsLastPingTime[connectionKey] = (new Date()).getTime();
                return;
            } else if (data.type == "connection") {
                if (!verifyDevice(data.device)) return;
                if (this.deviceNameToIndex[data.device.name] != undefined) return;// device name is taken
                console.log("Device \"" + data.device.name + "\" connected.");
                this.deviceNameToIndex[data.device.name] = this.devices.length;
                this.devices.push(data.device);
                this.deviceWsConnectionKey.push(connectionKey);
                this.deviceHttpConnectionIds.push(undefined);
            } else if (data.type == "call")
                this.handleCallCmd(data);
        }).bind(this));

        this.exprs = new ExpressWrapper(httpPort);
        this.exprs.post("/connect", (function(this: ConnectionHandler, req: Request, res: Response) {
            if (!verifyDevice(req.body)) {
                // invalid device object
                res.status(200).json({ status: false, id: "" });
                return;
            }
            if (this.deviceNameToIndex[req.body.name] != undefined) {
                // device name is taken
                res.status(200).json({ status: false, id: "" });
                return;
            }
            console.log("Device \"" + req.body.name + "\" connected.");
            const connectionId: string = generateUUID();
            this.deviceNameToIndex[req.body.name] = this.devices.length;
            this.devices.push(req.body);
            this.deviceWsConnectionKey.push(undefined);
            this.deviceHttpConnectionIds.push(connectionId);
            this.deviceHttpLastPingTime[connectionId] = (new Date()).getTime();
            this.httpConnectionCmdQueue[connectionId] = [];
            res.status(200).json({
                status: true,
                id: connectionId
            });
        }).bind(this));
        this.exprs.post("/keepAlive", (function(this: ConnectionHandler, req: Request, res: Response) {
            if (req.headers.accept == "application/json") {
                if (this.deviceHttpLastPingTime[req.body.id] == undefined) {
                    res.status(200).json({ status: true, commands: [] });
                } else {
                    res.status(200).json({ status: true, commands: this.httpConnectionCmdQueue[req.body.id] });
                    this.deviceHttpLastPingTime[req.body.id] = (new Date()).getTime();
                    this.httpConnectionCmdQueue[req.body.id] = [];
                }
            } else if (req.headers.accept == "application/text") {
                if (this.deviceHttpLastPingTime[req.body.id] == undefined) {
                    res.status(200).send("Invalid");
                } else {
                    res.status(200).send(this.httpConnectionCmdQueue[req.body.id].map((cmd: any) => {
                        let deviceName = cmd.device.join(".");
                        if (deviceName.length != 0) deviceName += ".";
                        return deviceName + cmd.func + "(" + cmd.parameters.map(JSON.stringify).join(",") + ")";
                    }).join("\n"));
                    this.deviceHttpLastPingTime[req.body.id] = (new Date()).getTime();
                    this.httpConnectionCmdQueue[req.body.id] = [];
                }
            } else {
                res.status(404).send("<html><body>404 Page Not Found</body></html>");
            }
        }).bind(this));
        this.exprs.post("/call", (function(this: ConnectionHandler, req: Request, res: Response) {
            this.handleCallCmd({ type: "call", cmd: req.body.cmd });
        }).bind(this));
    }

    getFunctionParamsOnDevice(devicePath: string[], funcName: string): ({ visible: boolean, parameters: parameterType[] }[])|undefined {
        let currDeviceList: deviceType[] = this.devices;
        for (let i = 0; i < devicePath.length - 1; i++) {
            const nextDeviceName = devicePath[i];
            let found: boolean = false;
            for (let j = 0; j < currDeviceList.length; j++) {
                if (currDeviceList[j] == undefined) continue;
                const device: deviceType = currDeviceList[j];
                if (device.name == nextDeviceName) {
                    currDeviceList = device.children || [];
                    found = true;
                }
            }
            if (!found) return undefined;
        }
        let foundDevice: deviceType|undefined = undefined;
        const nextDeviceName = devicePath[devicePath.length - 1];
        for (let j = 0; j < currDeviceList.length; j++) {
            if (currDeviceList[j] == undefined) continue;
            const device: deviceType = currDeviceList[j];
            if (device.name == nextDeviceName)
                foundDevice = device;
        }
        if (foundDevice == undefined) return undefined;
        const funcs: functionType[] = foundDevice.functions || [];
        // find function
        for (let j = 0; j < funcs.length; j++) {
            const func = funcs[j];
            if (func.name == funcName)
                return func.overloads;
        }
        return undefined;
    }
    handleCallCmd({ type, cmd }: {type: "call", cmd: string}) {
        // cmd must have form "device.function(param)" or "device.function()"
        if ((typeof cmd) !== "string") return;
        const splt1: string[] = cmd.split("(");
        // must have something on both sides of a '(', and nothing after the ')'
        if (splt1.length != 2) return;
        const [ callSigStr, paramsStr1 ]: [string, string] = splt1 as [string, string];
        const paramsSplt: string[] = paramsStr1.split(")");
        if (paramsSplt.length != 2) return;
        if (paramsSplt[1].length != 0) return;
        const paramsStr2: string = paramsSplt[0];
        // must have at least a single device and function name
        const callSig: string[] = callSigStr.split(".");
        if (callSig.length < 2) return;
        // get overloads of the function, or undefined if it does not exist
        const funcName: string = callSig.pop()!;
        const overloads: { visible: boolean, parameters: parameterType[] }[]|undefined = this.getFunctionParamsOnDevice(callSig, funcName);
        if (overloads == undefined) return;
        // check each overload if it is valid for the given parameters
        const params: string[] = paramsStr2.split(",");
        let finalParams: any[] = [];
        for (let i = 0; i < overloads.length; i++) {
            const paramsFormat: parameterType[] = overloads[i].parameters;
            let paramsValid: boolean = true;
            for (let j = 0; j < paramsFormat.length; j++) {
                let param: string = params[j].trim();
                if (param.length == 0) { paramsValid = false; continue; }// empty string is not valid for any type
                const paramFormat: "String" | "Number" | "Bool" | "Color" = paramsFormat[j].type;
                if (paramFormat != "String") param = param.toLowerCase();
                // console.log("param: " + param + " -> " + paramFormat);
                let paramValid: boolean = false;
                switch (paramFormat) {
                    case "String":
                        if (
                            ((param[0] == "\"") && (param[param.length - 1] == "\""))
                            || ((param[0] == "'") && (param[param.length - 1] == "'"))
                        ) {
                            // successfully parsed as a string
                            paramValid = true;
                            // console.log("    -> " + param.substring(1, param.length - 1));
                            finalParams.push(param.substring(1, param.length - 1));
                        }
                        break;
                    case "Number":
                        let paramParseNumNum: number = Number(param);
                        if (paramParseNumNum.toString() == param) {
                            // succesfully parsed as a number
                            paramValid = true;
                            // console.log("    -> " + paramParseNumNum);
                            finalParams.push(paramParseNumNum);
                        } else if (
                            ((param[0] == "\"") && (param[param.length - 1] == "\""))
                            || ((param[0] == "'") && (param[param.length - 1] == "'"))
                        ) {
                            // parsed as string
                            const paramParseNumStr: string = param.substring(1, param.length - 1).trim();
                            // console.log("    -> \"" + paramParseNumStr + "\"");
                            paramParseNumNum = Number(paramParseNumStr);
                            if (paramParseNumNum.toString() == paramParseNumStr) {
                                // succesfully parsed as the string of a number
                                paramValid = true;
                                // console.log("    -> " + paramParseNumNum);
                                finalParams.push(paramParseNumNum);
                            }
                        }
                        break;
                    case "Bool":
                        if (param == "true") {
                            // succesfully parsed as boolean
                            paramValid = true;
                            // console.log("    -> true");
                            finalParams.push(true);
                        } else if (param == "false") {
                            // succesfully parsed as boolean
                            paramValid = true;
                            // console.log("    -> false");
                            finalParams.push(false);
                        } else if (
                            ((param[0] == "\"") && (param[param.length - 1] == "\""))
                            || ((param[0] == "'") && (param[param.length - 1] == "'"))
                        ) {
                            // parsed as string
                            const paramParseBoolStr: string = param.substring(1, param.length - 1).trim();
                            // console.log("    -> \"" + paramParseBoolStr + "\"");
                            if (paramParseBoolStr == "true") {
                                // succesfully parsed as string of boolean
                                paramValid = true;
                                // console.log("    -> true");
                                finalParams.push(true);
                            } else if (paramParseBoolStr == "false") {
                                // succesfully parsed as string of boolean
                                paramValid = true;
                                // console.log("    -> false");
                                finalParams.push(false);
                            }
                        }
                        break;
                    case "Color":
                        if (
                            ((param[0] == "\"") && (param[param.length - 1] == "\""))
                            || ((param[0] == "'") && (param[param.length - 1] == "'"))
                        ) {
                            // parsed as string
                            let paramParseColorStr: string = param.substring(1, param.length - 1).trim();
                            // must have 6 characters following a "#" which does not contain spaces and is a valid hex number
                            if (paramParseColorStr[0] != "#") break;
                            paramParseColorStr = paramParseColorStr.substring(1);// remove "#" from string
                            if (paramParseColorStr.length != 6) break;
                            const tmp: string = paramParseColorStr.replace(/^0*/, "") || "0";// remove 0s from beginning of string, but keep at least one
                            // console.log("    -> " + tmp);
                            if (parseInt(tmp, 16).toString(16) != tmp) break;
                            // succesfully parsed as color
                            paramValid = true;
                            // console.log("    -> #" + paramParseColorStr);
                            finalParams.push("#" + paramParseColorStr.toUpperCase());
                        }
                        break;
                    default:
                        break;
                }
                if (!paramValid) paramsValid = false;
            }
            if (paramsValid) {
                const index: number = this.deviceNameToIndex[callSig[0]];
                if (index == undefined) return;
                const key: string|undefined = this.deviceWsConnectionKey[index];
                if (key != undefined) {
                    this.wbsckt.sendJson(key, {
                        type: "call",
                        device: callSig.slice(1),
                        func: funcName,
                        overload: i,
                        parameters: finalParams
                    });
                    return;
                }
                const id: string|undefined = this.deviceHttpConnectionIds[index];
                if (id != undefined) {
                    this.httpConnectionCmdQueue[id].push({
                        type: "call",
                        device: callSig.slice(1),
                        func: funcName,
                        overload: i,
                        parameters: finalParams
                    });
                    return;
                }
                return;
            }
        }
    }
    start() {
        Promise.all([ this.wbsckt.start(), this.exprs.start() ]).then(() => {
            const intervalTime: number = 5000;
            setInterval(() => {
                this.wbsckt.sendJsonAll({ type: "ping" });
                setTimeout(() => {
                    const currTime: number = (new Date()).getTime();
                    for (let i: number = 0; i < this.websocketConnectionKeys.length; i++) {
                        if (this.websocketConnectionKeys[i] == undefined) continue;
                        const key: string = this.websocketConnectionKeys[i];
                        if ((currTime - this.websocketWsLastPingTime[key]) > intervalTime) {
                            // close connection and clear related data
                            this.wbsckt.closeConnection(key);
                        }
                    }
                }, 1500);
                for (let i: number = 0; i < this.deviceHttpConnectionIds.length; i++) {
                    if (this.deviceHttpConnectionIds[i] == undefined) continue;
                    const id: string = this.deviceHttpConnectionIds[i] as string;
                    if (
                        ((new Date()).getTime() - this.deviceHttpLastPingTime[id]!) > intervalTime
                    ) {
                        const name: string = this.devices[i].name;
                        console.log("Device \"" + name + "\" disconnected.");
                        delete this.devices[i];
                        delete this.deviceNameToIndex[name];
                        delete this.deviceWsConnectionKey[i];
                        delete this.deviceHttpConnectionIds[i];
                        delete this.deviceHttpLastPingTime[id];
                        delete this.httpConnectionCmdQueue[id];
                    }
                }
            }, intervalTime);
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