import { parameterType, functionType, valueType, deviceType, ClientBase } from "./ClientBase.jsx";
import fetch from "node-fetch";

async function httpReq(hostname: string, method: "GET"|"POST", body: string|undefined): Promise<string> {
    return (await fetch(hostname, {
        method,
        body
    })).text();
}
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
async function post(hostname: string, body: string) {
    return httpReq(hostname, "POST", body);
}
async function postJson(hostname: string, body: any) {
    return httpReqJson(hostname, "POST", JSON.stringify(body));
}

class HttpClient extends ClientBase {
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
    protected sendCmd(cmd: string) {
        postJson("http://localhost:80/call", { cmd });
    }
    private connectionId: string = "";
    protected connect() {
        postJson("http://localhost:80/connect", this.self).then((function(this: HttpClient, raw: string) {
            try {
                const data: { status: boolean, id: string } = JSON.parse(raw);
                if (!data.status) {
                    this.onClose();
                    return;
                }
                this.connectionId = data.id;
                this.onConnect();
            } catch (err: any) {
                this.close();
            }
        }).bind(this));
    }
    connectCallback: (()=> void)|undefined = undefined;
    public setOnConnect(callback: ()=> void) {
        this.connectCallback = callback;
    }
    protected afterConnect() {
        this.interval = setInterval((function(this: HttpClient) {
            postJson("http://localhost:80/keepAlive", {
                id: this.connectionId
            }).then((function(this: HttpClient, raw: string) {
                try {
                    const data: { status: boolean, commands: any[] } = JSON.parse(raw);
                    if (!data.status) return;
                    for (let i = 0; i < data.commands.length; i++) {
                        const command: any = data.commands[i];
                        this.onCall(command.func, command.parameters);
                    }
                } catch (err: any) {
                    this.close();
                }
            }).bind(this));
        }).bind(this), 1000) as unknown as number;
        if (this.connectCallback) this.connectCallback();
    }
}

const client: HttpClient = new HttpClient("HttpJsonDevice");
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
    client.call("HttpJsonDevice.func1()");
    client.call("HttpJsonDevice.func2()");
    client.call("HttpJsonDevice.func3( \"test\", 1, true, \"#AAAAAA\" )");
    client.call("HttpJsonDevice.func3( 'test2', 2.34, false, '#000AAA' )");
    client.call("HttpJsonDevice.func3('test3', \"3\", \"false\", \"#000000\" )");
    client.call("HttpJsonDevice.func3(\"test4\", '4.56', 'true', \"#00FF0A\" )");
});