import { parameterType, functionType, valueType, deviceType, ClientBase } from "./ClientBase.jsx";
import { WebSocket, RawData } from "ws";// https://www.npmjs.com/package/ws

function generateUUID(): string {
    var a = new Date().getTime();// Timestamp
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
        var b = Math.random() * 16;// random number between 0 and 16
        b = (a + b) % 16 | 0;
        a = Math.floor(a / 16);
        return (c === "x" ? b : ((b & 0x3) | 0x8)).toString(16);
    });
}
class WsClient extends ClientBase {
    private ws: WebSocket|undefined;
    constructor(_name: string) {
        super(_name);
    }
    returnValueResolves: {[returnId: string]: (val: any)=> void} = {};
    protected open() {
        // initialize websocket and set callbacks
        this.ws = new WebSocket("ws://localhost:8080");
        this.ws.on("error", (function(this: WsClient, err: any) {
            if (err.code != "ECONNREFUSED")
                console.log("Connection error:", err);
            this.onError();
        }).bind(this));
        this.ws.on("open", this.onOpen.bind(this));
        this.ws.on("close", this.onClose.bind(this));
        this.ws.on("message", (function(this: WsClient, data: RawData) {
            const str: string = data.toString();
            const json: any = JSON.parse(str);
            if (json.type == "ping") {
                this.ws!.send(JSON.stringify({ type: "pong" })); return;
            } else if (json.type == "call")
                this.onCall([ json ], json.returnId);
            else if (json.type == "return") {
                this.returnValueResolves[json.returnId](json.value);
            }
        }).bind(this));
    }
    protected close() {
        this.ws!.close();
    }
    protected async sendCmd(cmd: string): Promise<any> {
        // generate id to receive return value with
        const id: string = generateUUID();
        // send command to server
        this.ws!.send(JSON.stringify({
            type: "call",
            cmd,
            returnId: id
        }));
        // wait for response
        const value: any = (await new Promise<any>((resolve: (val: any)=> void) => {
            this.returnValueResolves[id] = resolve;
        }));
        // parse response and return it
        if (value == "None") return undefined;
        else return JSON.parse(value);
    }
    protected connect() {
        // send device object to server
        this.ws!.send(JSON.stringify({
            type: "connection",
            device: this.self
        }));
        this.onConnect();
    }
    connectCallback: (()=> void)|undefined = undefined;
    public setOnConnect(callback: ()=> void) {
        this.connectCallback = callback;
    }
    protected afterConnect() {
        if (this.connectCallback) this.connectCallback();
    }
    protected returnValue(returnId: string, [ value ]: any[]) {
        this.ws!.send(JSON.stringify({
            type: "return",
            value,
            returnId
        }));
    }
}
const name: string = "WsDevice";
const client: WsClient = new WsClient(name);
client.addFunction("func1", [], "None", () => {
    console.log("func1()");
});
client.start();
client.setOnConnect(async () => {});