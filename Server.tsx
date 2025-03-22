import { WebSocket, WebSocketServer, RawData } from "ws";// https://www.npmjs.com/package/ws
import * as express from "express";// https://www.npmjs.com/package/express
import { Application, Request, Response } from "express";// https://www.npmjs.com/package/@types/express
import { readFileSync, writeFileSync } from "fs";
import * as webpush from "web-push";
import * as http from "http";

// #region helpers
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
function sha256(ascii: any) {
    function rightRotate(value: any, amount: any) {
        return (value >>> amount) | (value << (32 - amount));
    }
    
    var mathPow: any = Math.pow;
    var maxWord: any = mathPow(2, 32);
    var i: any;
    var j: any; // Used as a counters across the whole file
    var result: any = "";

    var words: any = [];
    var asciiBitLength: any = ascii.length * 8;
    
    //* caching results is optional - remove/add slash from front of this line to toggle
    // Initial hash value: first 32 bits of the fractional parts of the square roots of the first 8 primes
    // (we actually calculate the first 64, but extra values are just ignored)
    var hash: any = [];
    // Round constants: first 32 bits of the fractional parts of the cube roots of the first 64 primes
    var k: any = [];
    var primeCounter: any = k.length;
    /* /
    var hash = [], k = [];
    var primeCounter = 0;
    //*/

    var isComposite: any = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
        if (!isComposite[candidate]) {
            for (i = 0; i < 313; i += candidate) {
                isComposite[i] = candidate;
            }
            hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
            k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
        }
    }
    
    ascii += "\x80"; // Append Ƈ' bit (plus zero padding)
    while ((ascii.length % 64) - 56) ascii += "\x00"; // More zero padding
    for (i = 0; i < ascii.length; i++) {
        j = ascii.charCodeAt(i);
        if (j >> 8) return; // ASCII check: only accept characters in range 0-255
        words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = ((asciiBitLength / maxWord) | 0);
    words[words.length] = (asciiBitLength);
    
    // process each chunk
    for (j = 0; j < words.length;) {
        var w: any = words.slice(j, j += 16); // The message is expanded into 64 words as part of the iteration
        var oldHash: any = hash;
        // This is now the undefinedworking hash", often labelled as variables a...g
        // (we have to truncate as well, otherwise extra entries at the end accumulate
        hash = hash.slice(0, 8);
        
        for (i = 0; i < 64; i++) {
            // Expand the message into 64 words
            // Used below if
            var w15: any = w[i - 15], w2 = w[i - 2];

            // Iterate
            var a: any = hash[0];
            var e: any = hash[4];
            var temp1: any = hash[7];
            temp1 += (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)); // S1
            temp1 += ((e & hash[5]) ^ ((~e) & hash[6])); // ch
            temp1 += k[i];
            // Expand the message schedule if needed
            temp1 += (w[i] = (i < 16) ? w[i] : (
                w[i - 16] + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10)) // s0+s1
            ) | 0);
            // This is only used once, so *could* be moved below, but it only saves 4 bytes and makes things unreadble
            var temp2: any = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)); // S0
            temp2 += ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2])); // maj
            
            hash = [ (temp1 + temp2) | 0 ].concat(hash); // We don't bother trimming off the extra ones, they're harmless as long as we're truncating when we do the slice()
            hash[4] = (hash[4] + temp1) | 0;
        }
        
        for (i = 0; i < 8; i++) {
            hash[i] = (hash[i] + oldHash[i]) | 0;
        }
    }
    
    for (i = 0; i < 8; i++) {
        for (j = 3; j + 1; j--) {
            var b: any = (hash[i] >> (j * 8)) & 255;
            result += ((b < 16) ? 0 : "") + b.toString(16);
        }
    }
    return result;
}

class ExpressWrapper {
    private app: Application;
    private port: number;
    public server: http.Server;
    constructor(_port: number) {
        this.port = _port;
        this.app = express();
        this.app.use(express.json());
        this.server = http.createServer(this.app);
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
            this.server.listen(this.port, function() {
                resolve();
            });
        });
    }
}
export function getCookies(req: Request): { [key: string]: string } {
    return ((req.headers.cookie == undefined) ? {} : (Object.fromEntries(req.headers.cookie!.split(";").map((el) => (el.trim().split("=").map(decodeURIComponent))))));
}

class WebsocketServerWrapper {
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
    constructor(server: any, path: string) {
        this.wss = new WebSocketServer({
            server,
            path: "/" + path,
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
    setOnConnection(callback: (this: WebsocketServerWrapper, connectionKey: string)=> void): void {
        this.onConnection = callback.bind(this);
    }
    setOnClose(callback: (this: WebsocketServerWrapper, connectionKey: string)=> void): void {
        this.onClose = callback.bind(this);
    }
    setOnMessage(callback: (this: WebsocketServerWrapper, connectionKey: string, data: RawData)=> void): void {
        this.msgMode = "Str";
        this.onMessage = callback.bind(this);
    }
    setOnStringMessage(callback: (this: WebsocketServerWrapper, connectionKey: string, data: string)=> void): void {
        this.msgMode = "Msg";
        this.onString = callback.bind(this);
    }
    setOnJsonMessage(callback: (this: WebsocketServerWrapper, connectionKey: string, data: any)=> void): void {
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
                let index: number = -1;
                for (let i: number = 0; i <= this.connections.length; i++) {
                    if (this.connections[i] == undefined) { index = i; break; }
                }
                this.connections[index] = ws;
                this.connectionKeys[index] = key;
                this.connectionIndexByKey[key] = index;
                // console.log("New connection with key \"" + key + "\"");
    
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
// #endregion helpers

// #region types
type parameterType = {
    type: "String"|"Number"|"Bool"|"Color",
    defaultValue?: string|number|boolean
};
export type functionType = {
    name: string,
    overloads: {
        visible: boolean,
        parameters: parameterType[],
        returnType: "String"|"Number"|"Bool"|"Color"|"None"
    }[]
};
type valueType = {
    name: string,
    type: "String"|"Number"|"Bool"|"Color",
    value: any
};
type deviceType = {
    name: string,
    functions?: functionType[],
    values?: valueType[],
    children?: deviceType[]
};

type notifSubType = {
    type: "webpush",
    endpoint: string,
    keys: {
        auth: string,
        p256dh: string
    }
};
type userType = {
    name: string,
    email: string,
    pass_hash: string,
    isAdmin: boolean,
    deviceAccess: string[],
    notifSub: notifSubType
};
// #endregion types

// #region type validation functions
function verifyParamOfType(param: string, paramFormat: "String" | "Number" | "Bool" | "Color"): [ boolean, any ] {
    if (param.length === 0) return [ false, undefined ];// empty string is not valid for any type
    param = param.trim();
    if (paramFormat != "String") param = param.toLowerCase();
    switch (paramFormat) {
        case "String":
            if (
                ((param[0] === "\"") && (param[param.length - 1] === "\""))
                || ((param[0] === "'") && (param[param.length - 1] === "'"))
            ) {
                // successfully parsed as a string
                return [ true, param.substring(1, param.length - 1) ];
            }
            break;
        case "Number":
            let paramParseNumNum: number = Number(param);
            if (paramParseNumNum.toString() === param) {
                // succesfully parsed as a number
                return [ true, paramParseNumNum ];
            } else if (
                ((param[0] === "\"") && (param[param.length - 1] === "\""))
                || ((param[0] === "'") && (param[param.length - 1] === "'"))
            ) {
                // parsed as string
                const paramParseNumStr: string = param.substring(1, param.length - 1).trim();
                // console.log("    -> \"" + paramParseNumStr + "\"");
                paramParseNumNum = Number(paramParseNumStr);
                if (paramParseNumNum.toString() === paramParseNumStr) {
                    // succesfully parsed as the string of a number
                    return [ true, paramParseNumNum ];
                }
            }
            break;
        case "Bool":
            if (param === "true") {
                // succesfully parsed as boolean
                return [ true, true ];
            } else if (param === "false") {
                // succesfully parsed as boolean
                return [ true, false ];
            } else if (
                ((param[0] === "\"") && (param[param.length - 1] === "\""))
                || ((param[0] === "'") && (param[param.length - 1] === "'"))
            ) {
                // parsed as string
                const paramParseBoolStr: string = param.substring(1, param.length - 1).trim();
                // console.log("    -> \"" + paramParseBoolStr + "\"");
                if (paramParseBoolStr === "true") {
                    // succesfully parsed as string of boolean
                    return [ true, true ];
                } else if (paramParseBoolStr === "false") {
                    // succesfully parsed as string of boolean
                    return [ true, false ];
                }
            }
            break;
        case "Color":
            if (
                ((param[0] === "\"") && (param[param.length - 1] === "\""))
                || ((param[0] === "'") && (param[param.length - 1] === "'"))
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
                return [ true, "#" + paramParseColorStr.toUpperCase() ];
            }
            break;
        default:
            break;
    }
    return [ false, undefined ];
}
function verifyReturnOfType(returnVal: any, returnType: "String" | "Number" | "Bool" | "Color" | "None"): [ boolean, any ] {
    if (returnType === "None") {
        if (returnVal == undefined) return [ true, "None" ];
        return [ false, undefined ];
    } else {
        return verifyParamOfType(JSON.stringify(returnVal), returnType);
    }
}
function verifyParameter(param: parameterType): [ boolean, string ] {
    if ((typeof param) != "object") return [ false, "Parameter specification is not of type object." ];
    if (
        (param.type !== "String") && (param.type !== "Number") && (param.type !== "Bool") && (param.type !== "Color")
    ) return [ false, "" ];
    if (param.defaultValue == undefined) {
        switch (param.type) {
            case "String":
                param.defaultValue = "";
                break;
            case "Number":
                param.defaultValue = 0;
                break;
            case "Bool":
                param.defaultValue = false;
                break;
            case "Color":
                param.defaultValue = "#000000";
                break;
            default:
                break;
        }
    } else {
        const [ verified, validValue ] = verifyParamOfType(JSON.stringify(param.defaultValue), param.type);
        if (!verified) return [ false, "Parameter default value to not match paramter type " + param.type + "." ];
        param.defaultValue = validValue;
    }
    return [ true, "" ];
}
function verifyOverload(overload: {visible: boolean, parameters: parameterType[], returnType: "String"|"Number"|"Bool"|"Color"|"None"}): [ boolean, string ] {
    if ((typeof overload) != "object") return [ false, "Overload specification is not of type object." ];
    if ((overload.visible !== true) && (overload.visible !== false)) return [ false, "Overload visible value is missing or has an invalid type." ];
    const invalidParameterReasons: string[] = overload.parameters.map(verifyParameter).filter(([ valid ]: [ boolean, string ]) => !valid).map(([ valid, reason ]: [ boolean, string ]) => reason);
    if (invalidParameterReasons.length > 0) return [ false, invalidParameterReasons.join(", ") ];
    switch (overload.returnType) {
        case "String":
        case "Number":
        case "Bool":
        case "Color":
        case "None":
            return [ true, "" ];
        default:
            return [ false, "Overload return type unknown." ];
    }
}
function verifyFunction(func: functionType): [ boolean, string ] {
    if ((typeof func) != "object") return [ false, "Function specification is not of type object." ];
    if ((typeof func.name) != "string") return [ false, "Function name value is of invalid type." ];
    if (func.name === "") return [ false, "Function name cannot be empty." ];
    if ((func.name === "get") || (func.name === "set")) return [ false, "Function name cannot \"get\" or \"set\"." ];
    const invalidOverloadReasons: string[] = func.overloads.map(verifyOverload).filter(([ valid ]: [ boolean, string ]) => !valid).map(([ valid, reason ]: [ boolean, string ]) => reason);
    if (invalidOverloadReasons.length > 0) return [ false, invalidOverloadReasons.join(", ") ];
    return [ true, "" ];
}
function verifyValue(value: valueType): [ boolean, string ] {
    if ((typeof value) != "object") return [ false, "Value specification is not of type object" ];
    if ((typeof value.name) != "string") return [ false, "Value name value is of invalid type." ];
    if (value.name === "") return [ false, "Value name cannot be empty." ];
    if (value.name.endsWith("Get") || value.name.endsWith("Set")) return [ false, "Value name cannot end in \"Get\" or \"Set\"." ];
    if (
        (value.type !== "String") && (value.type !== "Number") && (value.type !== "Bool") && (value.type !== "Color")
    ) return [ false, "Value type is unknown." ];
    
    const [ verified, validValue ] = verifyParamOfType(JSON.stringify(value.value), value.type);
    if (!verified) return [ false, "Value value field does not match type." ];
    value.value = validValue;
    return [ true, "" ];
}
function verifyDevice(device: deviceType): [ boolean, string ] {
    if ((typeof device) != "object") return [ false, "Device specification is not of type object." ];
    if ((typeof device.name) != "string") return [ false, "Device name value is of invalid type." ];
    if (device.name === "") return [ false, "Device name cannot be empty." ];
    let hasUse: boolean = false;
    if (device.functions != undefined) {
        if (!Array.isArray(device.functions)) return [ false, "Device specification functions element must be either a list or undefined." ];
        if (device.functions.length != 0) hasUse = true;
        const invalidFunctionReasons: string[] = device.functions.map(verifyFunction).filter(([ valid ]: [ boolean, string ]) => !valid).map(([ valid, reason ]: [ boolean, string ]) => reason);
        if (invalidFunctionReasons.length > 0) return [ false, invalidFunctionReasons.join(", ") ];
        let names: string[] = [];
        for (let i = 0; i < device.functions.length; i++)
            if (names.includes(device.functions[i].name))
                return [ false, "Device specification has duplicate function name." ];
            else
                names.push(device.functions[i].name);
    }
    if (device.values != undefined) {
        if (!Array.isArray(device.values)) return [ false, "Device specification values element must be either a list or undefined." ];
        if (device.values.length != 0) hasUse = true;
        const invalidValueReasons: string[] = device.values.map(verifyValue).filter(([ valid ]: [ boolean, string ]) => !valid).map(([ valid, reason ]: [ boolean, string ]) => reason);
        if (invalidValueReasons.length > 0) return [ false, invalidValueReasons.join(", ") ];
        let names: string[] = [];
        for (let i = 0; i < device.values.length; i++)
            if (names.includes(device.values[i].name))
                return [ false, "Device specification has duplicate value name." ];
            else
                names.push(device.values[i].name);
    }
    if (device.children != undefined) {
        if (!Array.isArray(device.children)) return [ false, "Device specification children element must be either a list or undefined." ];
        if (device.children.length != 0) hasUse = true;
        const invalidChildReasons: string[] = device.children.map(verifyDevice).filter(([ valid ]: [ boolean, string ]) => !valid).map(([ valid, reason ]: [ boolean, string ]) => reason);
        if (invalidChildReasons.length > 0) return [ false, invalidChildReasons.join(", ") ];
        let names: string[] = [];
        for (let i = 0; i < device.children.length; i++)
            if (names.includes(device.children[i].name))
                return [ false, "Device specification has duplicate child name." ];
            else
                names.push(device.children[i].name);
    }
    if (!hasUse) return [ false, "Device contains no functions, devices, or children." ];
    return [ true, "" ];
}
// #endregion type validation functions

const dbFilePath: string = __dirname + "/database.json";
const db: any = JSON.parse(readFileSync(dbFilePath).toString() || "{}");
var users: userType[] = db.users || [];
var sessionIdToUserName: { [id: string]: string } = db.sessionIdToUserName || {};
var userNameToSessionId: { [name: string]: string } = db.userNameToSessionId || {};
function saveDb() {
    writeFileSync(dbFilePath, JSON.stringify({ users, sessionIdToUserName, userNameToSessionId }, undefined, "    "));
}
const SESSION_LENGTH = 14 * 24 * 60 * 60 * 1000;// 14 days, theoretical max is 24.something days

const userIndexByName: {[name: string]: number} = {};
const userIndexByEmail: {[email: string]: number} = {};
for (let i = 0; i < users.length; i++) {
    const user = users[i];
    userIndexByName[user.name] = i;
    userIndexByEmail[user.email] = i;
}
const publicKey: string = readFileSync("public-key.txt").toString();
const privateKey: string = readFileSync("private-key.txt").toString();

webpush.setVapidDetails("mailto:curse@simpsoncentral.com", publicKey, privateKey);
function notifyUser(username: string, header: string, body: string, important: boolean) {
    const index: number|undefined = userIndexByName[username.toLowerCase()];
    if (index == undefined) { console.log("User not found."); return; }
    const user: userType = users[index];
    if (user == undefined) { console.log("User not found."); return; }
    if (user.notifSub == undefined) { console.log("User has not subbed to notifications."); return; }
    webpush.sendNotification(user.notifSub, JSON.stringify({ header, body, important }))
        .then((res: any) => {
            console.log(res);
        })
        .catch((error: any) => {
            console.log("Notification push to user \"" + username + "\" failed.", error);
        });
}

function assert(condition: boolean): asserts condition { // Asserts that "condition" is true
    if (!condition) throw new Error("condition not met");
    return;
}
function assertExists<T>(value?: T): asserts value { // Asserts that "condition" is true
    if (!value) throw new Error("value is undefined");
    return;
}
class ConnectionHandler {
    private wbsckt: WebsocketServerWrapper;
    private exprs: ExpressWrapper;
    private websocketConnectionKeys: string[] = [];
    private websocketWsLastPingTime: {[key: string]: number} = {};

    private devices: deviceType[] = [];
    private deviceNameToIndex: {[name: string]: number} = {};
    private localDevices: deviceType[] = [
        {
            name: "userNotif",
            functions: [
                {
                    name: "notify",
                    overloads: [
                        {
                            visible: true,
                            parameters: [
                                {
                                    type: "String",
                                    defaultValue: "curse"
                                },
                                {
                                    type: "String",
                                    defaultValue: "header"
                                },
                                {
                                    type: "String",
                                    defaultValue: "body"
                                }
                            ],
                            returnType: "None"
                        }
                    ]
                },
                {
                    name: "notifyImportant",
                    overloads: [
                        {
                            visible: true,
                            parameters: [
                                {
                                    type: "String",
                                    defaultValue: "curse"
                                },
                                {
                                    type: "String",
                                    defaultValue: "header"
                                },
                                {
                                    type: "String",
                                    defaultValue: "body"
                                }
                            ],
                            returnType: "None"
                        }
                    ]
                }
            ]
        }
    ];
    private localDeviceNameToIndex: {[name: string]: number} = {};
    private localDeviceCallbackMap: {[sig: string]: (...params: any[])=> any} = {
        "userNotif.notify": ([ user, header, body ]: any[]) => {
            notifyUser(user as string, header as string, body as string, false);
            return;
        },
        "userNotif.notifyImportant": ([ user, header, body ]: any[]) => {
            notifyUser(user as string, header as string, body as string, true);
            return;
        }
    };

    private deviceWsConnectionKey: (string|undefined)[] = [];
    private wsReturnResolves: {[key: string]: [string, (val: any)=> void]} = {};
    private deviceWsSubscriptions: string[] = [];

    private deviceHttpConnectionIds: (string|undefined)[] = [];
    private deviceHttpLastPingTime: {[id: string]: number} = {};
    private httpCmdQueue: {[id: string]: any[]} = {};
    private httpReturnResolveLists: {[id: string]: ((val: any)=> void)[]} = {};

    constructor(port: number) {
        for (let i = 0; i < this.localDevices.length; i++)
            this.localDeviceNameToIndex[this.localDevices[i].name] = i;

        this.exprs = new ExpressWrapper(port);
        this.wbsckt = new WebsocketServerWrapper(this.exprs.server, "ws");

        this.wbsckt.setOnConnection((function(this: ConnectionHandler, connectionKey: string) {
            for (let i = 0; i <= this.websocketConnectionKeys.length; i++) {
                if (this.websocketConnectionKeys[i] == undefined) {
                    this.websocketConnectionKeys[i] = connectionKey;
                    break;
                }
            }
            this.websocketWsLastPingTime[connectionKey] = (new Date()).getTime();
        }).bind(this));
        this.wbsckt.setOnClose((function(this: ConnectionHandler, connectionKey: string) {
            delete this.websocketConnectionKeys[this.websocketConnectionKeys.indexOf(connectionKey)];
            delete this.websocketWsLastPingTime[connectionKey];
            const deviceIndex = this.deviceWsConnectionKey.indexOf(connectionKey);
            for (let i = 0; i < this.deviceWsSubscriptions.length; i++) {
                if (this.deviceWsSubscriptions[i] == undefined) continue;
                const key: string = this.deviceWsSubscriptions[i];
                if (key == connectionKey) {
                    delete this.deviceWsSubscriptions[i];
                    break;
                }
            }
            if (deviceIndex !== -1) {
                const name: string = this.devices[deviceIndex].name;
                console.log("Device \"" + name + "\" disconnected.");
                delete this.devices[deviceIndex];
                delete this.deviceNameToIndex[name];
                delete this.deviceWsConnectionKey[deviceIndex];
                delete this.deviceHttpConnectionIds[deviceIndex];
                Object.entries(this.wsReturnResolves).forEach(([ returnId, [ conKey, resolve ] ]) => {
                    if (conKey === connectionKey) {
                        delete this.wsReturnResolves[returnId];
                        resolve("None");
                    }
                });
                
                for (let i = 0; i < this.deviceWsSubscriptions.length; i++) {
                    if (this.deviceWsSubscriptions[i] == undefined) continue;
                    const key: string = this.deviceWsSubscriptions[i];
                    const user: userType = users[i];
                    if (user.isAdmin) {
                        this.wbsckt.send(key, JSON.stringify({
                            type: "disconnection",
                            name
                        }));
                    } else if (user.deviceAccess.includes(name)) {
                        this.wbsckt.send(key, JSON.stringify({
                            type: "disconnection",
                            name
                        }));
                    }
                }
            }
            // console.log("Closed connection with key \"" + connectionKey + "\".");
        }).bind(this));
        this.wbsckt.setOnJsonMessage((function(this: ConnectionHandler, connectionKey: string, data: any) {
            if (data.type === "pong") {
                this.websocketWsLastPingTime[connectionKey] = (new Date()).getTime();
                return;
            } else if (data.type === "connection") {
                let [ verified, reason ] = verifyDevice(data.device);
                if (!verified) {
                    console.log("Device connection over WS failed.");
                    console.error(reason);
                    return;
                }
                if (this.deviceNameToIndex[data.device.name] != undefined) { // device name is taken
                    console.log("Device connection over WS failed.");
                    console.error("Device name is taken");
                    return;
                }
                // Device is valid and not already connected.
                console.log("Device \"" + data.device.name + "\" connected.");
                let index: number = -1;
                for (let i = 0; i <= this.devices.length; i++) {
                    if (this.devices[i] == undefined) { index = i; break; }
                }
                this.devices[index] = data.device;
                this.deviceNameToIndex[data.device.name] = index;
                this.deviceWsConnectionKey[index] = connectionKey;
                this.deviceHttpConnectionIds[index] = undefined;

                for (let i = 0; i < this.deviceWsSubscriptions.length; i++) {
                    if (this.deviceWsSubscriptions[i] == undefined) continue;
                    const key: string = this.deviceWsSubscriptions[i];
                    const user: userType = users[i];
                    if (user.isAdmin) {
                        this.wbsckt.send(key, JSON.stringify({
                            type: "connection",
                            devices: [ data.device ]
                        }));
                    } else if (user.deviceAccess.includes(data.device.name)) {
                        this.wbsckt.send(key, JSON.stringify({
                            type: "connection",
                            devices: [ data.device ]
                        }));
                    }
                }
            } else if (data.type === "call") {
                if (data.returnId == undefined) { console.error("Call command missing returnId"); return; }
                this.handleCallCmd(data).then((returnVal: any) => {
                    this.wbsckt.sendJson(connectionKey, {
                        type: "return",
                        value: returnVal,
                        returnId: data.returnId
                    });
                });
            } else if (data.type === "return") {
                if (data.returnId == undefined) { console.error("Return command missing returnId"); return; }
                const deviceIndex = this.deviceWsConnectionKey.indexOf(connectionKey);
                if (deviceIndex === -1) return;
                if (this.wsReturnResolves[data.returnId] == undefined) return;
                this.wsReturnResolves[data.returnId][1](data.value);
                delete this.wsReturnResolves[data.returnId];
            } else if (data.type === "updateValue") {
                const deviceIndex = this.deviceWsConnectionKey.indexOf(connectionKey);
                if (deviceIndex === -1) { console.log("This ws connection does not have a device."); return; }
                const device = this.devices[deviceIndex];
                const value: valueType|undefined = this.getValueObjOnDevice([ device.name ], data.name);
                if (value == undefined) { console.log("Value with that name was not found."); return; }
                const [ paramValid, validParamValue ] = verifyParamOfType(JSON.stringify(data.value), value.type);
                if (!paramValid) { console.log("Updated value did not match value type"); return; }
                if (value.value === validParamValue) return;
                this.setValueOnDevice([ device.name ], data.name, validParamValue);

                // call function on subscribers
                for (let i = 0; i < this.deviceWsSubscriptions.length; i++) {
                    if (this.deviceWsSubscriptions[i] == undefined) continue;
                    const key: string = this.deviceWsSubscriptions[i];
                    const user: userType = users[i];
                    if (user.isAdmin) {
                        this.wbsckt.send(key, JSON.stringify({
                            type: "update",
                            name: [ ...device.name.split("."), value.name ],
                            value: validParamValue
                        }));
                    } else if (user.deviceAccess.includes(data.device.name)) {
                        this.wbsckt.send(key, JSON.stringify({
                            type: "update",
                            name: [ ...device.name.split("."), value.name ],
                            value: validParamValue
                        }));
                    }
                }
                return;
            } else if (data.type === "subscribe") {
                if (
                    (data.sessionid == undefined) || (data.sessionid === "")
                ) {
                    // console.log("invalid session");
                    this.wbsckt.send(connectionKey, JSON.stringify({ type: "logout" }));
                    return;
                }
                const userName: string = sessionIdToUserName[data.sessionid];
                if (userName == undefined) {
                    // console.log("invalid session");
                    this.wbsckt.send(connectionKey, JSON.stringify({ type: "logout" }));
                    return;
                }
                const userIndex: number|undefined = userIndexByName[userName];
                if (userIndex == undefined) {
                    // console.log("invalid userindex");
                    this.wbsckt.send(connectionKey, JSON.stringify({ type: "logout" }));
                    return;
                }
                const oldConnectionKey: string = this.deviceWsSubscriptions[userIndex];
                if (oldConnectionKey != undefined) {
                    // console.log("duplicate subscription");
                    this.wbsckt.send(oldConnectionKey, JSON.stringify({ type: "logout" }));
                    this.wbsckt.closeConnection(oldConnectionKey);
                    delete this.deviceWsSubscriptions[userIndex];
                }
                this.deviceWsSubscriptions[userIndex] = connectionKey;

                const user = users[userIndex];
                if (user.isAdmin && ((this.devices.length > 0) || (this.localDevices.length > 0))) {
                    this.wbsckt.send(connectionKey, JSON.stringify({
                        type: "connection",
                        devices: [ ...this.devices, ...this.localDevices ]
                    }));
                } else {
                    let tmpDevices: deviceType[] = [];
                    for (let i = 0; i < this.devices.length; i++)
                        if (user.deviceAccess.includes(this.devices[i].name))
                            tmpDevices.push(this.devices[i]);
                    for (let i = 0; i < this.localDevices.length; i++)
                        if (user.deviceAccess.includes(this.localDevices[i].name))
                            tmpDevices.push(this.localDevices[i]);
                    this.wbsckt.send(connectionKey, JSON.stringify({
                        type: "connection",
                        devices: tmpDevices
                    }));
                }
            }
        }).bind(this));

        this.exprs.post("/connect", (function(this: ConnectionHandler, req: Request, res: Response) {
            let [ verified, reason ] = verifyDevice(req.body);
            if (!verified) { // invalid device object
                if (req.headers.accept === "application/json")// client requested json
                    res.status(200).json({ status: false, id: "" });
                else if (req.headers.accept === "application/text")// client requested text
                    res.status(200).send("Invalid");
                else
                    res.status(404).send("<html><body>404 Page Not Found</body></html>");
                console.log("Device connection over HTTP failed.");
                console.error(reason);
                console.log(req.body);
                return;
            }
            if (this.deviceNameToIndex[req.body.name] != undefined) { // device name is taken
                if (req.headers.accept === "application/json")// client requested json
                    res.status(200).json({ status: false, id: "" });
                else if (req.headers.accept === "application/text")// client requested text
                    res.status(200).send("Invalid");
                else
                    res.status(404).send("<html><body>404 Page Not Found</body></html>");
                console.log("Device connection over HTTP failed.");
                console.error("Device name is taken.");
                console.log(req.body.name);
                return;
            }
            console.log("Device \"" + req.body.name + "\" connected.");
            const connectionId: string = generateUUID();

            let index: number = -1;
            for (let i = 0; i <= this.devices.length; i++) {
                if (this.devices[i] == undefined) { index = i; break; }
            }
            this.devices[index] = req.body;
            this.deviceNameToIndex[req.body.name] = index;
            this.deviceWsConnectionKey[index] = undefined;
            this.deviceHttpConnectionIds[index] = connectionId;
            this.deviceHttpLastPingTime[connectionId] = (new Date()).getTime();
            this.httpCmdQueue[connectionId] = [];
            this.httpReturnResolveLists[connectionId] = [];
            if (req.headers.accept === "application/json")
                res.status(200).json({ status: true, id: connectionId });
            else if (req.headers.accept === "application/text")
                res.status(200).send(connectionId);
            else
                res.status(404).send("<html><body>404 Page Not Found</body></html>");

            for (let i = 0; i < this.deviceWsSubscriptions.length; i++) {
                if (this.deviceWsSubscriptions[i] == undefined) continue;
                const key: string = this.deviceWsSubscriptions[i];
                const user: userType = users[i];
                if (user.isAdmin) {
                    this.wbsckt.send(key, JSON.stringify({
                        type: "connection",
                        devices: [ req.body ]
                    }));
                } else if (user.deviceAccess.includes(req.body.name)) {
                    this.wbsckt.send(key, JSON.stringify({
                        type: "connection",
                        devices: [ req.body ]
                    }));
                }
            }
        }).bind(this));
        this.exprs.post("/keepAlive", (function(this: ConnectionHandler, req: Request, res: Response) {
            if (this.deviceHttpLastPingTime[req.body.id] == undefined) {
                if (req.headers.accept === "application/json")// client requested json
                    res.status(200).json({ status: false, commands: [] });
                else if (req.headers.accept === "application/text")// client requested text
                    res.status(200).send("Invalid");
                else
                    res.status(404).send("<html><body>404 Page Not Found</body></html>");
            } else {
                this.deviceHttpLastPingTime[req.body.id] = (new Date()).getTime();
                if (req.headers.accept === "application/json")// client requested json
                    res.status(200).json({ status: true, commands: this.httpCmdQueue[req.body.id] });
                else if (req.headers.accept === "application/text")// client requested text
                    res.status(200).send(this.httpCmdQueue[req.body.id].map((cmd: any) => {
                        let deviceName = cmd.device.join(".");
                        if (deviceName.length != 0) deviceName += ".";
                        return deviceName + cmd.func + "(" + cmd.parameters.map(JSON.stringify).join(",") + ")";
                    }).join("\n"));
                else
                    res.status(404).send("<html><body>404 Page Not Found</body></html>");
                this.httpCmdQueue[req.body.id] = [];
            }
        }).bind(this));
        this.exprs.post("/call", (function(this: ConnectionHandler, req: Request, res: Response) {
            this.handleCallCmd({ type: "call", cmd: req.body.cmd }).then((returnVal: string) => {
                if (req.headers.accept === "application/json")// client requested json
                    res.status(200).json({ status: true, value: returnVal });
                else if (req.headers.accept === "application/text")// client requested text
                    res.status(200).send(returnVal);
                else
                    res.status(404).send("<html><body>404 Page Not Found</body></html>");
            });
        }).bind(this));
        this.exprs.post("/return", (function(this: ConnectionHandler, req: Request, res: Response) {
            if (
                (this.httpReturnResolveLists[req.body.id] == undefined)
                || (this.httpReturnResolveLists[req.body.id].length === 0)
            ) {
                if (req.headers.accept === "application/json")// client requested json
                    res.status(200).json({ status: false });
                else if (req.headers.accept === "application/text")// client requested text
                    res.status(200).send("Invalid");
                else
                    res.status(404).send("<html><body>404 Page Not Found</body></html>");
            } else {
                if ((req.headers.accept != "application/json") && (req.headers.accept != "application/text")) {
                    res.status(404).send("<html><body>404 Page Not Found</body></html>");
                    return;
                }
                const values: any[] = req.body.values;
                this.deviceHttpLastPingTime[req.body.id] = (new Date()).getTime();
                if (this.httpReturnResolveLists[req.body.id].length >= values.length) {
                    for (let i = 0; i < values.length; i++)
                        this.httpReturnResolveLists[req.body.id].shift()!(values[i]);
                    if (req.headers.accept === "application/json") { // client requested json
                        res.status(200).json({ status: true });
                    } else if (req.headers.accept === "application/text") { // client requested text
                        res.status(200).send("Valid");
                    }
                } else {
                    if (req.headers.accept === "application/json") { // client requested json
                        res.status(200).json({ status: false });
                    } else if (req.headers.accept === "application/text") { // client requested text
                        res.status(200).send("Invalid");
                    }
                }
            }
        }).bind(this));
        this.exprs.post("/updateValue", (function(this: ConnectionHandler, req: Request, res: Response) {
            if (this.deviceHttpLastPingTime[req.body.id] == undefined) {
                if (req.headers.accept === "application/json")// client requested json
                    res.status(200).json({ status: false });
                else if (req.headers.accept === "application/text")// client requested text
                    res.status(200).send("Invalid");
                else
                    res.status(404).send("<html><body>404 Page Not Found</body></html>");
                return;
            }
            const deviceIndex: number = this.deviceHttpConnectionIds.indexOf(req.body.id);
            if (deviceIndex === -1) {
                if (req.headers.accept === "application/json")// client requested json
                    res.status(200).json({ status: false });
                else if (req.headers.accept === "application/text")// client requested text
                    res.status(200).send("Invalid");
                else
                    res.status(404).send("<html><body>404 Page Not Found</body></html>");
                return;
            }
            const device = this.devices[deviceIndex];
            const value: valueType|undefined = this.getValueObjOnDevice([ device.name ], req.body.name);
            if (value == undefined) {
                if (req.headers.accept === "application/json")// client requested json
                    res.status(200).json({ status: false });
                else if (req.headers.accept === "application/text")// client requested text
                    res.status(200).send("Invalid");
                else
                    res.status(404).send("<html><body>404 Page Not Found</body></html>");
                return;
            }
            const [ paramValid, validParamValue ] = verifyParamOfType(JSON.stringify(req.body.value), value.type);
            if (!paramValid) {
                console.error("Parameter passed to setter was invalid.");
                if (req.headers.accept === "application/json")// client requested json
                    res.status(200).json({ status: false });
                else if (req.headers.accept === "application/text")// client requested text
                    res.status(200).send("Invalid");
                else
                    res.status(404).send("<html><body>404 Page Not Found</body></html>");
                return;
            }
            if (value.value === validParamValue) {
                if (req.headers.accept === "application/json")// client requested json
                    res.status(200).json({ status: true });
                else if (req.headers.accept === "application/text")// client requested text
                    res.status(200).send("Valid");
                else
                    res.status(404).send("<html><body>404 Page Not Found</body></html>");
                return;
            }
            this.setValueOnDevice([ device.name ], req.body.name, validParamValue);
            // call function on subscribers
            for (let i = 0; i < this.deviceWsSubscriptions.length; i++) {
                if (this.deviceWsSubscriptions[i] == undefined) continue;
                const key: string = this.deviceWsSubscriptions[i];
                const user: userType = users[i];
                if (user.isAdmin) {
                    this.wbsckt.send(key, JSON.stringify({
                        type: "update",
                        name: [ ...device.name.split("."), value.name ],
                        value: validParamValue
                    }));
                } else if (user.deviceAccess.includes(device.name)) {
                    this.wbsckt.send(key, JSON.stringify({
                        type: "update",
                        name: [ ...device.name.split("."), value.name ],
                        value: validParamValue
                    }));
                }
            }

            if (req.headers.accept === "application/json")// client requested json
                res.status(200).json({ status: true });
            else if (req.headers.accept === "application/text")// client requested text
                res.status(200).send("Valid");
            else
                res.status(404).send("<html><body>404 Page Not Found</body></html>");
            return;
        }).bind(this));
        this.exprs.get("/login", (function(this: ConnectionHandler, req: Request, res: Response) {
            // if it has a session, clear it
            const cookies = getCookies(req);
            if (cookies.sessionid != undefined)
                res.clearCookie("sessionid");
            res.sendFile(__dirname + "/webpage/login.html", (err: Error) => {
                if (err == undefined) return;
                console.log("Couldnt find login.html page.", "\"" + err.name + "\": " + err.message);
                res.status(500).type("text").send("error 500, internal error");
            });
        }).bind(this));
        this.exprs.get("/tryLogin", (async function(this: ConnectionHandler, req: Request, res: Response) {
            const query: { [key: string]: (string|string[]|undefined) } = req.query as { [key: string]: (string|string[]|undefined) };
            if ((query.email == "") || (query.password == "")) { res.json(false); return; }
            const email: string = query.email as string;
            const pass_hash: string = query.password as string;
            const userIndex: number|undefined = userIndexByEmail[email.toLowerCase()];
            if (userIndex == undefined) { res.json(false); return; }
            const user: any = users[userIndex];
            if ((user == undefined) || (user.pass_hash != pass_hash)) { res.json(false); return; }
            // it is a valid login
            // delete old session
            const oldSessionId: string|undefined = userNameToSessionId[user.name];
            if (oldSessionId != undefined) {
                delete sessionIdToUserName[oldSessionId];
                delete userNameToSessionId[user.name];
            }
            // kick off old subscription
            const oldConnectionKey: string|undefined = this.deviceWsSubscriptions[userIndex];
            if (oldConnectionKey != undefined) {
                this.wbsckt.send(oldConnectionKey, JSON.stringify({ type: "logout" }));
                this.wbsckt.closeConnection(oldConnectionKey);
                delete this.deviceWsSubscriptions[userIndex];
            }
            // create a session
            const sessionId = generateUUID();
            sessionIdToUserName[sessionId] = user.name;
            userNameToSessionId[user.name] = sessionId;
            saveDb();
            // set their session id
            res.cookie("sessionid", sessionId, { maxAge: SESSION_LENGTH, httpOnly: false });
            // res.cookie("name", user.name);
            res.json(true);
            // console.log("User \"" + user.name + "\" logged in.");
        }).bind(this));

        const serveAuthenticated = (path: string, filePath: string) => {
            this.exprs.get(path, (async function(this: ConnectionHandler, req: Request, res: Response) {
                const cookies: any = getCookies(req);
                if (cookies.sessionid == undefined) { res.redirect("/login"); return; }
                if (sessionIdToUserName[cookies.sessionid] == undefined) { res.redirect("/login"); return; }
                res.sendFile(__dirname + filePath, (err: Error) => {
                    if (err == undefined) return;
                    console.log("Couldnt find " + path + " file.", "\"" + err.name + "\": " + err.message);
                    res.status(500).type("text").send("error 500, internal error");
                });
            }).bind(this));
        };
        const serveStatic = (path: string, filePath: string) => {
            this.exprs.get(path, (async function(this: ConnectionHandler, req: Request, res: Response) {
                res.sendFile(__dirname + filePath, (err: Error) => {
                    if (err == undefined) return;
                    console.log("Couldnt find " + path + " file.", "\"" + err.name + "\": " + err.message);
                    res.status(500).type("text").send("error 500, internal error");
                });
            }).bind(this));
        };
        serveAuthenticated("/index", "/webpage/index.html");
        serveAuthenticated("/index.css", "/webpage/index.css");
        serveAuthenticated("/lib.js", "/webpage/lib.js");
        serveAuthenticated("/index.js", "/webpage/index.js");
        serveAuthenticated("/notifications.js", "/webpage/notifications.js");
        serveAuthenticated("/sw.js", "/webpage/sw.js");
        serveStatic("/manifest.json", "/webpage/manifest.json");
        serveStatic("/favicon.ico", "/webpage/favicon.ico");
        serveStatic("/favicon.png", "/webpage/favicon.png");
        
        this.exprs.post("/notif/subscribe", (async function(this: ConnectionHandler, req: Request, res: Response) {
            const cookies: any = getCookies(req);
            if (cookies.sessionid == undefined) { res.redirect("/login"); return; }
            if (sessionIdToUserName[cookies.sessionid] == undefined) { res.redirect("/login"); return; }
            const username: string = sessionIdToUserName[cookies.sessionid];
            const { endpoint, keys } = req.body;
            users[userIndexByName[username]].notifSub = {
                type: "webpush",
                endpoint: (endpoint as string),
                keys: (keys as { auth: string, p256dh: string })
            };
            saveDb();
        }).bind(this));
        this.exprs.get("/", (req: Request, res: Response) => { res.redirect("/index"); });
    }

    getFunctionOverloadsOnDevice(devicePath: string[], funcName: string): ["None"|"Local"|"Remote", ({ visible: boolean, parameters: parameterType[], returnType: "String"|"Number"|"Bool"|"Color"|"None" }[])|undefined] {
        if (devicePath.length == 1) {
            let foundDevice: deviceType|undefined = undefined;
            const nextDeviceName = devicePath[0];
            for (let i = 0; i < this.localDevices.length; i++) {
                if (this.localDevices[i] == undefined) continue;
                const device: deviceType = this.localDevices[i];
                if (device.name === nextDeviceName)
                    foundDevice = device;
            }
            if (foundDevice != undefined) {
                const funcs: functionType[] = foundDevice.functions || [];
                // find function
                for (let j = 0; j < funcs.length; j++) {
                    const func: functionType = funcs[j];
                    if (func.name === funcName) {
                        return [ "Remote", func.overloads ];
                    }
                }
            }
        }
        let currDeviceList: deviceType[] = this.devices;
        for (let i = 0; i < devicePath.length - 1; i++) {
            const nextDeviceName = devicePath[i];
            let found: boolean = false;
            for (let j = 0; j < currDeviceList.length; j++) {
                if (currDeviceList[j] == undefined) continue;
                const device: deviceType = currDeviceList[j];
                if (device.name === nextDeviceName) {
                    currDeviceList = device.children || [];
                    found = true;
                }
            }
            if (!found) return [ "None", undefined ];
        }
        let foundDevice: deviceType|undefined = undefined;
        const nextDeviceName = devicePath[devicePath.length - 1];
        for (let j = 0; j < currDeviceList.length; j++) {
            if (currDeviceList[j] == undefined) continue;
            const device: deviceType = currDeviceList[j];
            if (device.name === nextDeviceName)
                foundDevice = device;
        }
        if (foundDevice == undefined) return [ "None", undefined ];
        const funcs: functionType[] = foundDevice.functions || [];
        // find function
        for (let j = 0; j < funcs.length; j++) {
            const func: functionType = funcs[j];
            if (func.name === funcName)
                return [ "Remote", func.overloads ];
        }
        return [ "None", undefined ];
    }
    getValueObjOnDevice(devicePath: string[], valueName: string): valueType|undefined {
        let currDeviceList: deviceType[] = this.devices;
        for (let i = 0; i < devicePath.length - 1; i++) {
            const nextDeviceName = devicePath[i];
            let found: boolean = false;
            for (let j = 0; j < currDeviceList.length; j++) {
                if (currDeviceList[j] == undefined) continue;
                const device: deviceType = currDeviceList[j];
                if (device.name === nextDeviceName) {
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
            if (device.name === nextDeviceName)
                foundDevice = device;
        }
        if (foundDevice == undefined) return undefined;
        const values: valueType[] = foundDevice.values || [];
        // find value
        for (let j = 0; j < values.length; j++) {
            const value: valueType = values[j];
            if (value.name === valueName)
                return value;
        }
        return undefined;
    }
    setValueOnDevice(devicePath: string[], valueName: string, value: any): valueType|undefined {
        let currDeviceList: deviceType[] = this.devices;
        for (let i = 0; i < devicePath.length - 1; i++) {
            const nextDeviceName = devicePath[i];
            let found: boolean = false;
            for (let j = 0; j < currDeviceList.length; j++) {
                if (currDeviceList[j] == undefined) continue;
                const device: deviceType = currDeviceList[j];
                if (device.name === nextDeviceName) {
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
            if (device.name === nextDeviceName)
                foundDevice = device;
        }
        if (foundDevice == undefined) return undefined;
        // find value
        for (let j = 0; j < foundDevice.values!.length; j++) {
            if (foundDevice.values![j].name === valueName)
                foundDevice.values![j].value = value;
        }
        return undefined;
    }
    async handleCallCmd({ type, cmd }: {type: "call", cmd: string }): Promise<any> {
        // cmd must have form "device.function(param)" or "device.function()"
        if ((typeof cmd) !== "string") { console.error("Command is not of type string."); return "None"; }
        const splt1: string[] = cmd.split("(");
        // must have something on both sides of a '(', and nothing after the ')'
        if (splt1.length != 2) { console.error("Command is invalid format."); return "None"; }
        const [ callSigStr, paramsStr1 ]: [string, string] = splt1 as [string, string];
        const paramsSplt: string[] = paramsStr1.split(")");
        if (paramsSplt.length != 2) { console.error("Command is invalid format."); return "None"; }
        if (paramsSplt[1].length != 0) { console.error("Command is invalid format."); return "None"; }
        const paramsStr2: string = paramsSplt[0];
        // must have at least a single device and function name
        const callSig: string[] = callSigStr.split(".");
        if (callSig.length < 2) { console.error("Command is invalid format."); return "None"; }
        const remoteDeviceIndex: number = this.deviceNameToIndex[callSig[0]];// the index of the device
        const localDeviceIndex: number = this.localDeviceNameToIndex[callSig[0]];// the index of the device
        if ((remoteDeviceIndex == undefined) && (localDeviceIndex == undefined)) { console.error("Command attempted to call function on non-existant device."); return "None"; }
        // get overloads of the function, or undefined if it does not exist
        const funcName: string = callSig.pop()!;
        if (funcName === "get") {
            if (callSig.length < 2) { console.error("Command is invalid format."); return "None"; }
            const value: string = callSig.pop()!;
            return await this.handleGetSetCmd(callSig, value, "get", paramsStr2.split(","));
        } else if (funcName === "set") {
            if (callSig.length < 2) { console.error("Command is invalid format."); return "None"; }
            const value: string = callSig.pop()!;
            return await this.handleGetSetCmd(callSig, value, "set", paramsStr2.split(","));
        }
        const [ functionType, overloads ]: ["None"|"Remote"|"Local", ({ visible: boolean, parameters: parameterType[], returnType: "String"|"Number"|"Bool"|"Color"|"None" }[])|undefined] = this.getFunctionOverloadsOnDevice(callSig, funcName);
        if (functionType === "None") { console.error("Command attempted to call non-existant function."); return "None"; }
        assertExists(overloads);
        // check each overload if it is valid for the given parameters
        const params: string[] = paramsStr2.split(",");
        let finalParams: any[] = [];
        for (let i = 0; i < overloads.length; i++) {
            const paramsFormat: parameterType[] = overloads[i].parameters;
            // check if every paramter has a valid match to its type in this overload
            let paramsValid: boolean = true;
            for (let j = 0; j < paramsFormat.length; j++) {
                const [ paramValid, value ] = verifyParamOfType(params[j], paramsFormat[j].type);
                finalParams.push(value);
                if (!paramValid) paramsValid = false;
            }
            if (paramsValid) {
                let returnVal: any = "None";
                if (functionType == "Remote") {
                    const func: ((...params: any[])=> void) = this.localDeviceCallbackMap[[ ...callSig, funcName ].join(".")];
                    if (func == undefined) { console.error("Server error, callback for local function missing."); return "None"; }
                    returnVal = func(finalParams);
                } else {
                    const key: string|undefined = this.deviceWsConnectionKey[remoteDeviceIndex];
                    const id: string|undefined = this.deviceHttpConnectionIds[remoteDeviceIndex];
                    if (key != undefined) {
                        // send data to websocket connection and await response
                        const returnId: string = generateUUID();
                        this.wbsckt.sendJson(key, {
                            type: "call",
                            device: callSig.slice(1),
                            func: funcName,
                            overload: i,
                            parameters: finalParams,
                            returnId
                        });
                        returnVal = await new Promise<any>((function(this: ConnectionHandler, resolve: (val: any)=> void) {
                            this.wsReturnResolves[returnId] = [ key, resolve ];
                        }).bind(this));
                    } else if (id != undefined) {
                        // send data to http queue and await response
                        this.httpCmdQueue[id].push({
                            type: "call",
                            device: callSig.slice(1),
                            func: funcName,
                            overload: i,
                            parameters: finalParams
                        });
                        returnVal = await new Promise<any>((function(this: ConnectionHandler, resolve: (val: any)=> void) {
                            this.httpReturnResolveLists[id] ||= [];
                            this.httpReturnResolveLists[id].push(resolve);
                        }).bind(this));
                    }
                }
                // forward response back to sender
                const [ isValid, validValue ]: [boolean, string] = verifyReturnOfType(returnVal, overloads[i].returnType);
                if (isValid) {
                    if (validValue === "None") return "None";
                    else return JSON.stringify(validValue);
                } else { console.error("Function value returned by callee was invalid"); return "None"; }
            }
        }
        console.error("No function overload found matching the command"); return "None";
    }
    async handleGetSetCmd(deviceCallSig: string[], valueName: string, type: "get" | "set", params: string[]): Promise<any> {
        const deviceIndex: number = this.deviceNameToIndex[deviceCallSig[0]];// the index of the device
        if (deviceIndex == undefined) { console.error("Command attempted to call function on non-existant device."); return "None"; }
        // get value 
        const value: valueType|undefined = this.getValueObjOnDevice(deviceCallSig, valueName);
        if (value == undefined) { console.error("Command attempted to " + type + " value of non-existant value."); return "None"; }
        // do action based on type
        if (type === "get") {
            if ((params.length != 0) && !((params.length === 1) && params[0] === "")) { console.error("Getters do not take arguments."); return "None"; }
            return JSON.stringify(value.value);
        } else {
            if (params.length === 0) { console.error("Paramter is required for setter function."); return "None"; }
            if (params.length > 1) { console.error("Too many parameters were passed for a setter function."); return "None"; }
            const [ paramValid, validParamValue ] = verifyParamOfType(params[0], value.type);
            if (!paramValid) { console.error("Parameter passed to setter was invalid."); return "None"; }
            if (value.value === validParamValue) return "None";// if the value you are setting it to is the same as the current value then dont bother setting it
            const key: string|undefined = this.deviceWsConnectionKey[deviceIndex];
            const id: string|undefined = this.deviceHttpConnectionIds[deviceIndex];
            if ((key == undefined) && (id == undefined)) return "None";
            let returnVal: any = "None";
            this.setValueOnDevice(deviceCallSig, valueName, validParamValue);
            if (key != undefined) {
                // send data to websocket connection and await response
                const returnId: string = generateUUID();
                this.wbsckt.sendJson(key, {
                    type: "call",
                    device: deviceCallSig.slice(1),
                    func: valueName + ".set",
                    parameters: [ validParamValue ],
                    returnId
                });
                returnVal = await new Promise<any>((function(this: ConnectionHandler, resolve: (val: any)=> void) {
                    this.wsReturnResolves[returnId] = [ key, resolve ];
                }).bind(this));
            } else if (id != undefined) {
                // send data to http queue and await response
                this.httpCmdQueue[id].push({
                    type: "call",
                    device: deviceCallSig.slice(1),
                    func: valueName + ".set",
                    parameters: [ validParamValue ]
                });
                returnVal = await new Promise<any>((function(this: ConnectionHandler, resolve: (val: any)=> void) {
                    this.httpReturnResolveLists[id] ||= [];
                    this.httpReturnResolveLists[id].push(resolve);
                }).bind(this));
            }
            // forward response back to sender
            const [ isValid, validValue ]: [boolean, string] = verifyReturnOfType(returnVal, "None");
            if (isValid) {
                if (validValue === "None") return "None";
                else return JSON.stringify(validValue);
            } else { console.error("Function value returned by callee was invalid"); return "None"; }
        }
    }
    start() {
        this.exprs.start().then(async () => {
            this.wbsckt.start().then(() => {
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
                            delete this.httpCmdQueue[id];
                            const returnResolveList: ((val: any)=> void)[] = this.httpReturnResolveLists[id];
                            for (let i = 0; i < returnResolveList.length; i++)
                                returnResolveList[i]("None");
                            delete this.httpReturnResolveLists[id];
                            
                            for (let i = 0; i < this.deviceWsSubscriptions.length; i++) {
                                if (this.deviceWsSubscriptions[i] == undefined) continue;
                                const key: string = this.deviceWsSubscriptions[i];
                                const user: userType = users[i];
                                if (user.isAdmin) {
                                    this.wbsckt.send(key, JSON.stringify({
                                        type: "disconnection",
                                        name
                                    }));
                                } else if (user.deviceAccess.includes(name)) {
                                    this.wbsckt.send(key, JSON.stringify({
                                        type: "disconnection",
                                        name
                                    }));
                                }
                            }
                        }
                    }
                }, intervalTime);
                console.clear();
                console.log("Server started.");
                console.log("Wss server on wss://mocs.campbellsimpson.com/ws.");
                console.log("ws server on ws://localhost:8080/ws.");
                console.log("Https server on https://mocs.campbellsimpson.com.");
                console.log("Http server on http://localhost:8080.");
            });
        });
    }
}

// create and start server
readConfig();
const port: number = Number(config.sec.port);
const server: ConnectionHandler = new ConnectionHandler(port);
server.start();