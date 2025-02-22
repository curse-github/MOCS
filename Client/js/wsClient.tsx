import { parameterType, functionType, valueType, deviceType, ClientBase } from "./ClientBase.jsx";
import { WebSocket, RawData } from "ws";// https://www.npmjs.com/package/ws

class WsClient extends ClientBase {
    private ws: WebSocket|undefined;
    constructor(_name: string) {
        super(_name);
    }
    protected open() {
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
                this.onCall(json.func, json.parameters);
        }).bind(this));
    }
    protected close() {
        console.log("closing");
        this.ws!.close();
    }
    protected sendCmd(cmd: string) {
        this.ws!.send(JSON.stringify({
            type: "call",
            cmd
        }));
    }
    protected connect() {
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
}

const client: WsClient = new WsClient("WsDevice");
client.addFunction("func1", [], () => {
    console.log("func1()");
});
client.addFunction("func2", [], () => {
    console.log("func2()");
});
client.addFunction("func3", [ "String", "Number", "Bool", "Color" ], (str: string, number: number, bool: boolean, color: string) => {
    console.log("func3(" + JSON.stringify(str) + ", " + JSON.stringify(number) + ", " + JSON.stringify(bool) + ", " + JSON.stringify(color) + ")");
});
client.start();
client.setOnConnect(() => {
    client.call("WsDevice.func1()");
    client.call("WsDevice.func2()");
    client.call("WsDevice.func3( \"test\", 1, true, \"#AAAAAA\" )");
    client.call("WsDevice.func3( 'test2', 2.34, false, '#000AAA' )");
    client.call("WsDevice.func3('test3', \"3\", \"false\", \"#000000\" )");
    client.call("WsDevice.func3(\"test4\", '4.56', 'true', \"#00FF0A\" )");
});