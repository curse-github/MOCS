import { ClientBase } from "./ClientBase.jsx";
import fetch from "node-fetch";

async function httpReq(hostname: string, method: "GET"|"POST", body: string|undefined): Promise<string> {
    return (await fetch(hostname, {
        method,
        headers: {
            Accept: "application/text",
            "Content-Type": "application/json"
        },
        body
    })).text();
}
async function post(hostname: string, body: any) {
    return httpReq(hostname, "POST", JSON.stringify(body));
}

class HttpTextClient extends ClientBase {
    constructor(_name: string) {
        super(_name);
    }
    private interval: number = 0;
    protected open(): void {
        this.onOpen();
    }
    protected close(): void {
        this.connectionId = "";
        clearInterval(this.interval);
        this.onClose();
    }
    protected async sendCmd(cmd: string): Promise<any> {
        const val: any = await post("https://mocs.campbellsimpson.com/call", { cmd });
        if (val == "None") return undefined;
        else return JSON.parse(val);
    }
    private connectionId: string = "";
    protected connect(): void {
        post("https://mocs.campbellsimpson.com/connect", this.self).then((function(this: HttpTextClient, data: string) {
            if (data == "Invalid") { this.close(); return; }
            this.connectionId = data;
            this.onConnect();
        }).bind(this));
    }
    private connectCallback: (()=> void)|undefined = undefined;
    public setOnConnect(callback: ()=> void): void {
        this.connectCallback = callback;
    }
    protected afterConnect(): void {
        this.interval = setInterval((function(this: HttpTextClient) {
            post("https://mocs.campbellsimpson.com/keepAlive", {
                id: this.connectionId
            }).then((function(this: HttpTextClient, data: string) {
                if (data == "Invalid") this.close();
                else {
                    if (data == "") return;
                    data.split("\n").forEach((line: string) => {
                        const lineSplt: string[] = line.split("(");
                        const func: string = lineSplt[0];
                        let parameters: any = lineSplt[1].split(")")[0];
                        if (parameters.split(",")[0] == "") parameters = [];// has no paramters
                        else parameters = parameters.split(",").map((str: string) => JSON.parse(str.trim()));
                        this.onCall([ { func, overload: 0, parameters } ], "");
                    });
                }
            }).bind(this));
        }).bind(this), 1000) as unknown as number;
        if (this.connectCallback) this.connectCallback();
    }
    protected returnValue(returnId: string, returnVals: any[]): void {
        post("https://mocs.campbellsimpson.com/return", {
            id: this.connectionId,
            values: returnVals
        }).then((function(this: HttpTextClient, data: string) {
            if (data == "Invalid") this.close();
        }).bind(this));
    }
    protected actuallyUpdateValue(name: string, value: any): void {
        post("https://mocs.campbellsimpson.com/updateValue", {
            id: this.connectionId,
            name,
            value
        }).then((function(this: HttpTextClient, data: string) {
            if (data == "Invalid") this.close();
        }).bind(this));
    }
}

const name: string = "HttpTextDevice";
const client: HttpTextClient = new HttpTextClient(name);
client.addFunction("func1")!
    .addOverload(true, "none", () => {
        console.log("func1()");
    });
client.start();
client.setOnConnect(async () => {});