"use strict";
function newParameter(name, nullable, public, defaultValue, type) {
    return {
        "name": name, "type": (type || (typeof defaultValue).replace("bigint", "number")), "nullable": nullable, "public": public, "defaultValue": defaultValue
    };
}
class Client {
    get name() { return this.connectionMessage.data.name; }
    set name(v) { this.connectionMessage.data.name = v; }
    get public() { return this.connectionMessage.data.public; }
    set public(v) { this.connectionMessage.data.public = v; }
    constructor(name, isPublic) {
        this.WebSocket = require('ws');
        this.connectionMessage = {
            type: "connection",
            data: {
                name: "Client",
                functions: [],
                public: true
            }
        };
        this.functions = {};
        this.intervalId = null;
        this.attemts = 0;
        this.onclose = null;
        this.name = name;
        this.public = isPublic;
    }
    SetupWebsocket() {
        try {
            this.ws.send(JSON.stringify(this.connectionMessage));
            this.ws.onerror = (err) => { console.log("Websocket error: \"" + err + "\"."); };
            this.ws.onmessage = (e) => {
                try {
                    if (this.ws == null)
                        return;
                    var msg = JSON.parse(e.data);
                    if (msg.type != null) {
                        if (msg.type == "ping" && msg.data != null) {
                            this.ws.send(JSON.stringify({ type: "pong", data: msg.data }));
                        }
                        else if (msg.type == "command" && msg.data != null) {
                            const funcName = msg.data.toLowerCase();
                            if (this.functions[funcName] == null) {
                                console.log("invalid command");
                                console.log(msg);
                                return;
                            }
                            if (msg.parameters != null && msg.parameters.length > 0) {
                                this.functions[funcName](this, ...msg.parameters);
                            }
                            else {
                                this.functions[funcName](this);
                            }
                        }
                        else if (msg.type == "reply") {
                            if (msg.statusCode != 200) {
                                console.log("Connection failed, status " + msg.status);
                                console.log("Error message: \"" + msg.error + "\"");
                                console.log("Error id: \"" + msg.id + "\"");
                            }
                        }
                        else if (msg.type == "status") {
                            if (msg.statusCode != 200) {
                                console.log("Command fail, status " + msg.status);
                                console.log("Error message: \"" + msg.error + "\"");
                                console.log("Error id: \"" + msg.id + "\"");
                            }
                        }
                    }
                    else
                        console.log("Error, msg type is null.");
                }
                catch (err) {
                    console.log(err);
                }
            };
            this.ws.onclose = (e) => {
                console.log("Lost connection to MOCS server.");
                this.ws = null;
                if (this.onclose != null)
                    try {
                        this.onclose();
                    }
                    catch (err) { }
                this.setReconnectInterval(true);
            };
        }
        catch (err) {
            console.log(err.stack);
        }
        return this;
    }
    setReconnectInterval(reconnection) {
        // attempt to connect every 20 seconds untill it works and then stop.
        this.tryReconnect(reconnection);
        this.intervalId = setInterval(() => {
            this.tryReconnect(reconnection);
        }, 15000);
        return this;
    }
    tryReconnect(reconnection) {
        if (this.ws != null) {
            try {
                this.ws.close();
            }
            catch (err) {
                console.log(err.stack);
            }
            this.ws = null;
        }
        ;
        this.attemts++;
        console.log("Attempt #" + this.attemts + " to connect to the MOCS server.");
        this.ws = new this.WebSocket(Client.URL);
        this.ws.onerror = (e) => { if (this.ws != null) {
            if (this.onclose != null)
                try {
                    this.onclose();
                }
                catch (err) { }
            try {
                this.ws.close();
            }
            catch (err) {
                console.log(err.stack);
            }
            this.ws = null;
        } };
        this.ws.onclose = (e) => { if (this.ws != null) {
            if (this.onclose != null)
                try {
                    this.onclose();
                }
                catch (err) { }
            this.ws = null;
        } };
        this.ws.onopen = () => {
            this.stopInterval(); // stop loop.
            console.clear();
            console.log((reconnection == true ? "Rec" : "C") + "onnected to MOCS server" + ((this.attemts > 1) ? " after " + this.attemts + " attempts." : "."));
            this.attemts = 0;
            this.SetupWebsocket();
        };
        return this;
    }
    stopInterval() { if (this.intervalId != null) {
        clearInterval(this.intervalId);
        this.intervalId = null;
    } return this; }
    AddFunction(name, isPublic, parameters, func) {
        this.connectionMessage.data.functions.push({ "name": name, "public": isPublic, "parameters": parameters });
        this.functions[name.toLowerCase() + "()"] = func;
        return this;
    }
    AddChildFunction(devicename, devicePublic, functionName, functionPublic, parameters, func) {
        var devices = this.connectionMessage.data.devices;
        if (devices == null)
            devices = [];
        var index = devices.findIndex((el) => { return el.name == devicename; });
        if (index == -1) {
            index = devices.length;
            devices.push({ name: devicename, "public": devicePublic, functions: [] });
        }
        devices[index].functions.push({ "name": functionName, "public": functionPublic, "parameters": parameters });
        this.connectionMessage.data.devices = devices;
        this.functions[devicename.toLowerCase() + "." + functionName.toLowerCase() + "()"] = func;
        return this;
    }
    listen() {
        this.setReconnectInterval();
        return this;
    }
}
//static URL:string = "ws://mc.campbellsimpson.com:42069";
Client.URL = "ws://192.168.1.37:42069";
//#endregion typeDefs
