import { ClientBase } from "./ClientBase.jsx";
import { WebSocket, RawData } from "ws";// https://www.npmjs.com/package/ws

function generateUUID(): string {
    let a = new Date().getTime();// Timestamp
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
        let b = Math.random() * 16;// random number between 0 and 16
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
    private returnValueResolves: {[returnId: string]: (val: any)=> void} = {};
    protected open(): void {
        // initialize websocket and set callbacks
        this.ws = new WebSocket("wss://mocs.campbellsimpson.com/ws");
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
    protected close(): void {
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
    protected connect(): void {
        // send device object to server
        this.ws!.send(JSON.stringify({
            type: "connection",
            device: this.self
        }));
        this.onConnect();
    }
    private connectCallback: (()=> void)|undefined = undefined;
    public setOnConnect(callback: ()=> void): void {
        this.connectCallback = callback;
    }
    protected afterConnect(): void {
        if (this.connectCallback) this.connectCallback();
    }
    protected returnValue(returnId: string, [ value ]: any[]): void {
        this.ws!.send(JSON.stringify({
            type: "return",
            value,
            returnId
        }));
    }
    protected actuallyUpdateValue(name: string, value: any): void {
        this.ws!.send(JSON.stringify({
            type: "updateValue",
            name,
            value
        }));
    }
}
const name: string = "WsDevice";
const client: WsClient = new WsClient(name);
client.addFunction("func1")!
    .addOverload(true, "none", () => {
        console.log("func1()");
    });
client.addFunction("func2")!
    .addOverload(true, "none", (str: string) => {
        console.log("func2(\"" + str + "\")");
    })
    .addStringParameter("start");
client.addFunction("func3")!
    .addOverload(true, "none", (float1: number, float2: number) => {
        console.log("func3(" + float1 + ", " + float2 + ")");
    })
    .addNumberParameter("float", 0.5, "normal", [ 0, 1 ])
    .addNumberParameter("float", 0.5, "slider", [ 0, 1 ]);
client.addFunction("func4")!
    .addOverload(true, "none", (int1: number, int2: number) => {
        console.log("func4(" + int1 + ", " + int2 + ")");
    })
    .addNumberParameter("integer", 1, "normal", [ 0, 5 ])
    .addNumberParameter("integer", 1, "slider", [ 0, 5 ]);
client.addFunction("func5")!
    .addOverload(true, "none", (bool: boolean) => {
        console.log("func5(" + (bool ? "true" : "false") + ")");
    })
    .addBoolParameter(false);
client.addFunction("func6")!
    .addOverload(true, "none", (int: number) => {
        console.log("func6(" + int + ")");
    })
    .addColorParameter("#FF00FF");
client.addStringValue("val1", "start", false, (value: string) => {
    console.log("val1 = \"" + value + "\"");
});
client.addNumberValue("val2", "float", 0.5, false, "decimal", (value: number) => {
    console.log("val2 = " + value);
}, [ 0, 1 ]);
client.addNumberValue("val3", "float", 0.5, false, "slider", (value: number) => {
    console.log("val3 = " + value);
}, [ 0, 1 ]);
client.addNumberValue("val4", "integer", 1, false, "decimal", (value: number) => {
    console.log("val4 = " + value);
}, [ 0, 5 ]);
client.addNumberValue("val5", "integer", 1, false, "slider", (value: number) => {
    console.log("val5 = " + value);
}, [ 0, 255 ]);
client.addBooleanValue("val6", false, false, (value: boolean) => {
    console.log("val6 = " + (value ? "true" : "false"));
});
client.addColorValue("val7", "#00FFFF", false, (value: `#${string}`) => {
    console.log("val7 = " + value);
});
client.addNumberValue("val8", "float", 17.2, true, "hex", (value: number) => {}, [ 0, 1 ]);
client.addNumberValue("val9", "float", 17.2, true, "decimal", (value: number) => {}, [ 0, 1 ]);
client.addNumberValue("val10", "float", 17.2, true, "binary", (value: number) => {}, [ 0, 1 ]);
client.addNumberValue("val11", "float", 17.2, true, "slider", (value: number) => {}, [ 0, 20 ]);
client.addNumberValue("val12", "integer", 17, true, "hex", (value: number) => {}, [ 0, 1 ]);
client.addNumberValue("val13", "integer", 17, true, "decimal", (value: number) => {}, [ 0, 1 ]);
client.addNumberValue("val14", "integer", 17, true, "binary", (value: number) => {}, [ 0, 1 ]);
client.addNumberValue("val15", "integer", 17, true, "slider", (value: number) => {}, [ 0, 20 ]);
client.start();
client.setOnConnect(async () => {
    /* setInterval(() => {
        lastVal3 = !lastVal3;
        client.updateValue("val3", lastVal3);
    }, 1500);*/
});