export type parameterType = {
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
export type valueType = {
    name: string,
    type: "String"|"Number"|"Bool"|"Color",
    value: any
};
export type deviceType = {
    name: string,
    functions?: functionType[],
    values?: valueType[],
    children?: deviceType[]
};

export class ClientBase {
    private status: "Open"|"Closed" = "Closed";
    protected self: deviceType = {
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
        console.log("Disconnected from MOCS server");
        if (this.started)
            setTimeout((function(this: ClientBase) {
                if (this.status == "Open") return;
                console.log("Attempting to reconnect...");
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
    protected onCall(commands: { func: string, parameters: any[] }[], returnId: string) {
        // get return value of each call and 
        const returnVals: any[] = commands.map(({ func, parameters }: { func: string, parameters: any[] }) => this.funcNameToCallback[func](...parameters));
        this.returnValue(returnId, returnVals);
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
    public call(cmd: string): Promise<any>|undefined {
        if (!this.connected) {
            this.callQueue.push(cmd);
            return undefined;
        }
        return this.sendCmd(cmd);
    }
    public addFunction(name: string, params: ("String"|"Number"|"Bool"|"Color")[], returnType: "String"|"Number"|"Bool"|"Color"|"None", callback: (...params: any[])=> any) {
        if (this.started) return;
        this.self.functions!.push({
            name,
            overloads: [
                {
                    visible: true,
                    parameters: params.map((type: "String"|"Number"|"Bool"|"Color") => {
                        return { type, defaultValue: undefined };
                    }),
                    returnType
                }
            ]
        });
        this.funcNameToCallback[name] = callback;
    }
    public addValue(name: string, type: ("String"|"Number"|"Bool"|"Color"), value: any, setter: ((value: any)=> undefined) | ((value: string)=> undefined) | ((value: number)=> undefined) | ((value: boolean)=> undefined)) {
        if (this.started) return;
        this.self.values!.push({
            name,
            type,
            value
        });
        this.funcNameToCallback[name + ".set"] = setter;
    }
    public updateValue(name: string, value: any) {
        if (!this.started) return;
        for (let i = 0; i < this.self.values!.length; i++) {
            if (this.self.values![i].name == name) {
                this.actuallyUpdateValue(name, value);
                return;
            }
        }
        console.log("value with name \"" + name + "\" has not been created.");
        return;
    }

    protected open(): void {
        console.error("Not Implemented Yet.");
    }
    protected close(): void {
        console.error("Not Implemented Yet.");
    }
    protected async sendCmd(cmd: string): Promise<any> {
        console.error("Not Implemented Yet.");
        return undefined;
    }
    protected connect(): void {
        console.error("Not Implemented Yet.");
    }
    protected afterConnect() {
    }
    protected returnValue(returnId: string, returnVals: any[]): void {
        console.error("Not Implemented Yet.");
    }
    protected actuallyUpdateValue(name: string, value: any) {
        console.error("Not Implemented Yet.");
    }
}