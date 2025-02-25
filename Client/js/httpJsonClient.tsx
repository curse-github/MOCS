import { parameterType, functionType, valueType, deviceType, ClientBase } from "./ClientBase.jsx";
import fetch from "node-fetch";

async function httpReqJson(hostname: string, method: "GET"|"POST", body: string|undefined): Promise<string> {
    return (await fetch(hostname, {
        method,
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
        },
        body
    })).text();
}
async function postJson(hostname: string, body: any) {
    return httpReqJson(hostname, "POST", JSON.stringify(body));
}

class HttpJsonClient extends ClientBase {
    constructor(_name: string) {
        super(_name);
    }
    private interval: number = 0;
    protected open() {
        this.onOpen();
    }
    protected close() {
        this.connectionId = "";
        clearInterval(this.interval);
        this.onClose();
    }
    protected async sendCmd(cmd: string): Promise<any> {
        try {
            // send a command to the server and receive the response
            const raw: string = (await postJson("http://localhost:80/call", { cmd }));
            const value: any = JSON.parse(raw).value;
            if (value == "None") return undefined;
            else return JSON.parse(value);
        } catch (error) {
            return undefined;
        }
    }
    private connectionId: string = "";
    protected connect() {
        // send device object to server
        postJson("http://localhost:80/connect", this.self).then((function(this: HttpJsonClient, raw: string) {
            try {
                const data: { status: boolean, id: string } = JSON.parse(raw);
                if (!data.status) {
                    this.onClose();
                    return;
                }
                // save the connection id for other http requests
                this.connectionId = data.id;
                this.onConnect();
            } catch (err: any) {
                this.close();
            }
        }).bind(this));
    }
    private connectCallback: (()=> void)|undefined = undefined;
    public setOnConnect(callback: ()=> void) {
        this.connectCallback = callback;
    }
    protected afterConnect() {
        // set interval to do keep alive with the server every second
        this.interval = setInterval((function(this: HttpJsonClient) {
            postJson("http://localhost:80/keepAlive", {
                id: this.connectionId
            }).then((function(this: HttpJsonClient, raw: string) {
                try {
                    const data: { status: boolean, commands: any[] } = JSON.parse(raw);
                    if (!data.status) return;
                    this.onCall(data.commands, "");
                } catch (err: any) {
                    this.close();
                }
            }).bind(this));
        }).bind(this), 1000) as unknown as number;
        if (this.connectCallback) this.connectCallback();
    }
    protected returnValue(returnId: string, returnVals: any[]) {
        postJson("http://localhost:80/return", {
            id: this.connectionId,
            values: returnVals
        }).then((function(this: HttpJsonClient, raw: string) {
            try {
                const data: { status: boolean, commands: any[] } = JSON.parse(raw);
                if (!data.status) return;
            } catch (err: any) {
                this.close();
            }
        }).bind(this));
    }
}

const name: string = "HttpJsonDevice";
const client: HttpJsonClient = new HttpJsonClient(name);
client.addFunction("func1", [], "None", () => {
    console.log("func1()");
});
client.start();
client.setOnConnect(async () => {});