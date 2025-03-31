type colorType = `#${string}`;
type parameterType = {
    type: "string",
    defaultValue: string
}|{
    type: "bool",
    defaultValue: boolean
}|{
    type: "float"|"integer",
    defaultValue: number,
    range?: [ number, number ],
    displayType: "normal"|"slider"
}|{
    type: "color",
    defaultValue: colorType
};
type overloadType = {
    visible: boolean,
    parameters: parameterType[],
    returnType: "string"|"float"|"integer"|"bool"|"color"|"none"
};
type functionType = {
    name: string,
    overloads: overloadType[]
};
type valueType = {
    name: string,
    type: "string",
    value: string,
    readonly: boolean
}|{
    name: string,
    type: "float"|"integer",
    value: number,
    readonly: boolean,
    range?: [ number, number ],
    displayType: "hex"|"decimal"|"binary"|"slider"
}|{
    name: string,
    type: "bool",
    value: boolean,
    readonly: boolean
}|{
    name: string,
    type: "color",
    value: colorType,
    readonly: boolean
};
type deviceType = {
    name: string,
    functions: functionType[],
    values: valueType[],
    children: deviceType[]
};

export class ClientBase {
    private status: "Open"|"Closed" = "Closed";
    protected self: deviceType = {
        name: "",
        functions: [],
        values: [],
        children: []
    };
    public funcNameToCallback: {[name: string]: ((...params: any[])=> any)[]} = {};

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
    protected onCall(commands: { func: string, overload: number, parameters: any[] }[], returnId: string) {
        // get return value of each call and
        const returnVals: any[] = commands.map(
            ({ func, overload, parameters }: { func: string, overload: number, parameters: any[] }): any => {
                return this.funcNameToCallback[func][overload](...parameters);
            }
        );
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
    public addFunction(name: string): ClientBase.FunctionClass|undefined {
        if (this.started) return;
        const obj: functionType = {
            name,
            overloads: []
        };
        this.self.functions!.push(obj);
        return new ClientBase.FunctionClass(this, obj);
    }
    public addStringValue(name: string, value: string, readonly: boolean, setter: (value: any)=> void) {
        if (this.started) return;
        this.self.values!.push({
            name,
            type: "string",
            value,
            readonly
        });
        if (!readonly) this.funcNameToCallback[name + ".set"] = [ setter ];
    }
    public addNumberValue(name: string, type: "float"|"integer", value: number, readonly: boolean, displayType: "hex"|"decimal"|"binary"|"slider", setter: (value: number)=> void, range?: [ number, number ]) {
        if (this.started) return;
        this.self.values!.push({
            name,
            type,
            value,
            readonly,
            range,
            displayType
        });
        if (!readonly) this.funcNameToCallback[name + ".set"] = [ setter ];
    }
    public addBooleanValue(name: string, value: boolean, readonly: boolean, setter: (value: boolean)=> void) {
        if (this.started) return;
        this.self.values!.push({
            name,
            type: "bool",
            value,
            readonly
        });
        if (!readonly) this.funcNameToCallback[name + ".set"] = [ setter ];
    }
    public addColorValue(name: string, value: colorType, readonly: boolean, setter: (value: colorType)=> void) {
        if (this.started) return;
        this.self.values!.push({
            name,
            type: "color",
            value,
            readonly
        });
        if (!readonly) this.funcNameToCallback[name + ".set"] = [ setter ];
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
export namespace ClientBase {
    export class FunctionClass {
        private client: ClientBase;
        private function: functionType;
        constructor(_client: ClientBase, _function: functionType) {
            this.client = _client;
            this.function = _function;
        }
        public addOverload(
            visible: boolean,
            returnType: "string"|"float"|"integer"|"bool"|"color"|"none",
            callback: (...params: any[])=> any
        ): ClientBase.FunctionClass.Overload {
            this.client.funcNameToCallback[this.function.name] ||= [];
            this.client.funcNameToCallback[this.function.name].push(callback);
            const overload: overloadType = {
                visible,
                parameters: [],
                returnType
            };
            this.function.overloads.push(overload);
            return new ClientBase.FunctionClass.Overload(overload);
        }
    }
    export namespace FunctionClass {
        export class Overload {
            private overload: overloadType;
            constructor(_overload: overloadType) {
                this.overload = _overload;
            }
            public addStringParameter(
                defaultValue: string
            ): ClientBase.FunctionClass.Overload {
                this.overload.parameters.push({
                    type: "string",
                    defaultValue
                });
                return this;
            }
            public addNumberParameter(
                type: "float"|"integer",
                defaultValue: number,
                displayType: "normal"|"slider",
                range?: [ number, number ]
            ): ClientBase.FunctionClass.Overload {
                this.overload.parameters.push({
                    type,
                    defaultValue,
                    range,
                    displayType
                });
                return this;
            }
            public addBoolParameter(
                defaultValue: boolean
            ): ClientBase.FunctionClass.Overload {
                this.overload.parameters.push({
                    type: "bool",
                    defaultValue
                });
                return this;
            }
            public addColorParameter(
                defaultValue: colorType
            ): ClientBase.FunctionClass.Overload {
                this.overload.parameters.push({
                    type: "color",
                    defaultValue
                });
                return this;
            }
        }
    }
}