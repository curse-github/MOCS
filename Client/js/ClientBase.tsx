export type parameterType = {
    type: "String"|"Number"|"Bool"|"Color",
    defaultValue?: string|number|boolean
};
export type functionType = {
    name: string,
    overloads: {
        visible: boolean,
        parameters: parameterType[]
    }[]
};
export type valueType = {
    name: string,
    type: "String"|"Number"|"Bool"|"Color"
};
export type deviceType = {
    name: string,
    functions?: functionType[],
    values?: valueType[],
    children?: deviceType[]
};

export class ClientBase {
    private status: "Open"|"Closed" = "Closed";
    public self: deviceType = {
        name: "",
        functions: [],
        values: [],
        children: []
    };
    private funcNameToCallback: {[name: string]: ((...params: any[])=> void)} = {};
    constructor(_name: string) {
        this.self.name = _name;
    }
    protected onError() {
        this.close();
    }
    protected onOpen() {
        this.status = "Open";
        this.connect();
        console.clear();
        console.log("Connected to MOCS server.");
    }
    protected onClose() {
        this.connected = false;
        this.status = "Closed";
        if (this.started)
            setTimeout((function(this: ClientBase) {
                if (this.status == "Open") return;
                this.open();
            }).bind(this), 5000);// try again after one second
    }
    private connected: boolean = false;
    protected onConnect() {
        this.connected = true;
        this.afterConnect();
        for (let i = 0; i < this.callQueue.length; i++) {
            this.sendCmd(this.callQueue[i]);
        }
        this.callQueue = [];
    }
    protected onCall(func: string, parameters: any[]) {
        this.funcNameToCallback[func](...parameters);
    }
    private started: boolean = false;
    public start() {
        if (this.status == "Open") return;
        if (!this.started) {
            this.started = true;
            this.open();
        }
    }
    public stop() {
        this.started = false;
        this.close();
    }
    private callQueue: string[] = [];
    public call(cmd: string) {
        if (!this.connected) {
            this.callQueue.push(cmd);
            return;
        }
        this.sendCmd(cmd);
    }
    public addFunction(name: string, params: ("String"|"Number"|"Bool"|"Color")[], callback: (...params: any[])=> void) {
        if (this.started) return;
        this.self.functions?.push({
            name: name,
            overloads: [
                {
                    visible: true,
                    parameters: params.map((type: "String"|"Number"|"Bool"|"Color") => {
                        return { type, defaultValue: undefined };
                    })
                }
            ]
        });
        this.funcNameToCallback[name] = callback;
    }

    protected open() {
        console.error("Not Implemented Yet.");
    }
    protected close() {
        console.error("Not Implemented Yet.");
    }
    protected sendCmd(cmd: string) {
        console.error("Not Implemented Yet.");
    }
    protected connect() {
        console.error("Not Implemented Yet.");
    }
    protected afterConnect() {
    }
}