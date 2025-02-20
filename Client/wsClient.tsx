import { WebSocket, RawData } from 'ws';// https://www.npmjs.com/package/ws

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

class Client {
    private ws: WebSocket|undefined
    private status:"Open"|"Closed" = "Closed";
    private onStart: (()=> void)|undefined = undefined;
    private self: clientType = {
        name: "",
        functions: [],
        values: [],
        children: []
    }
    private funcNameToCallback: {[name: string]: (()=>void)} = {};
    constructor(_name: string) {
        this.self.name = _name;
    }
    connect() {
        if (this.status=="Open") return;
        this.ws = new WebSocket('ws://localhost:8080');
        this.ws.on('error', (function(this: Client, err: any) {
            if (err.code != "ECONNREFUSED")
                console.log("Connection error:",err);
            this.ws!.close();
            this.status="Closed";
            setTimeout(this.connect.bind(this), 5000);// try again after one second
        }).bind(this));
        this.ws.on('open', (function(this: Client) {
            this.status="Open";
            this.ws!.send(JSON.stringify({
                type: "connection",
                client: this.self
            }));
            this.ws!.send(JSON.stringify({
                type: "call",
                client: "ClientWS",
                function: "func1",
                parameters: []
            }));
            this.ws!.send(JSON.stringify({
                type: "call",
                client: "ClientWS",
                function: "func2",
                parameters: []
            }));
            this.ws!.send(JSON.stringify({
                type: "call",
                client: "ClientWS",
                function: "func2",
                parameters: []
            }));
            this.ws!.send(JSON.stringify({
                type: "call",
                client: "ClientWS",
                function: "func1",
                parameters: []
            }));
        }).bind(this));
        this.ws.on('close', (function(this: Client) {
            this.status="Closed";
            setTimeout(this.connect.bind(this), 5000);// try again after one second
        }).bind(this));
        this.ws.on('message', (function(this: Client, data: RawData) {
            const str: string = data.toString();
            const json: any = JSON.parse(str);
            if (json.type=="ping") { this.ws!.send(JSON.stringify({type: "pong"})); return; }
            else if (json.type == "call") {
                this.funcNameToCallback[json.function]();
            }
        }).bind(this));
    }
    private started: boolean = false;
    start() {
        if (!this.started) this.connect();
        this.started = true;
    }
    addFunction(name: string, callback:()=>void) {
        this.self.functions?.push({
            name:name,
            overloads:[
                {
                    visible: true,
                    parameters: []
                }
            ]
        });
        this.funcNameToCallback[name] = callback;
    }
}

const client: Client = new Client("ClientWS");
client.addFunction("func1", () => {
    console.log("func1 called.");
});
client.addFunction("func2", () => {
    console.log("func2 called.");
});
client.start();