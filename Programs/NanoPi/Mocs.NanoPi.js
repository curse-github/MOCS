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
const spawn = require("child_process").spawn;
var lines = ["", "", "", "", "", "", "", ""];
var subscriptions = [];
function line(lineNum, text) {
    const _lineNum = Math.min(Math.max(lineNum, 0), 5);
    lines[_lineNum + 2] = ((text == null || text == "" || text == "null") ? " " : text);
    restore([lines[2], lines[3], lines[4], lines[5], lines[6], lines[7]]);
}
function clear() {
    restore([" ", " ", " ", " ", " ", " "]);
}
function restore(linesList) {
    for (var i = 0; i < (linesList.length < 6 ? linesList.length : 6); i++) {
        lines[i + 2] = (((linesList[i] == null || linesList[i] == "" || linesList[i] == "null") ? " " : linesList[i]));
    }
    var lst = [lines[0], lines[1], lines[2], lines[3], lines[4], lines[5], lines[6], lines[7]];
    //console.log("sudo python /home/pi/restore.py " + lst.map(el=>"\""+el+"\"").join(" "));
    lst.unshift("/home/pi/restore.py");
    spawn("python", lst);
}
function subscribe(button, name, func, parameter) {
    if (subscriptions != null) {
        for (var i = 0; i < subscriptions.length; i++) {
            if (JSON.stringify(subscriptions[i]) == JSON.stringify({ "button": button, "name": name, "function": func, "parameter": parameter })) {
                return;
            }
        }
        var found = false;
        for (var i = 0; i < subscriptions.length + 1; i++) {
            if (!found && subscriptions[i] == null) {
                found = true;
                subscriptions[i] = { "button": button, "name": name, "function": func, "parameter": parameter };
                return;
            }
        }
    }
}
clear();
function wasPressed(button, websocket) {
    for (var i = 0; i < subscriptions.length; i++) {
        if (subscriptions[i] != null) {
            if (button == subscriptions[i].button) {
                websocket.send(JSON.stringify({
                    type: "command",
                    data: {
                        device: subscriptions[i].name,
                        "function": subscriptions[i].function,
                        parameters: [((subscriptions[i].parameter != null) ? subscriptions[i].parameter : button)]
                    },
                    id: i
                }));
            }
        }
    }
}
const myClient = new Client("NanoPi", true)
    .AddFunction("Line", true, [
    newParameter("lineNum", false, true, 1),
    newParameter("text", false, true, "string")
], (client, lineNum, text) => {
    line(lineNum, text);
})
    .AddFunction("Clear", true, [], (client) => { clear(); })
    .AddFunction("Restore", true, [
    newParameter("line1", true, true, "-_-_-_-_-_-_-_-_"),
    newParameter("line2", true, true, "-_-_-_-_-_-_-_-_"),
    newParameter("line3", true, true, "-_-_-_-_-_-_-_-_"),
    newParameter("line4", true, true, "-_-_-_-_-_-_-_-_"),
    newParameter("line5", true, true, "-_-_-_-_-_-_-_-_"),
    newParameter("line6", true, true, "-_-_-_-_-_-_-_-_")
], (client, line1, line2, line3, line4, line5, line6) => {
    restore([line1, line2, line3, line4, line5, line6]);
})
    .AddFunction("Subscribe", false, [
    newParameter("button", false, true, 1),
    newParameter("name", false, true, "name"),
    newParameter("func", false, true, "func"),
    newParameter("parameter", false, true, "parameter")
], (client, button, name, func, parameter) => {
    subscribe(button, name, func, parameter);
})
    .AddFunction("wasPressed", true, [
    newParameter("button", false, true, 1)
], (client, button) => {
    wasPressed(button, client.ws);
})
    .listen();
//#region Spotify
var intervalId2 = null;
const http = require("http");
var spotify = "";
function setupSpotify() {
    intervalId2 = setInterval(() => {
        try {
            var options = {
                //host: 'mc.campbellsimpson.com',
                host: '192.168.1.37',
                port: 8081,
                path: '/SpotifyStatus'
            };
            http.request(options, (response) => {
                var str = '';
                response.on('data', function (chunk) {
                    str += chunk;
                });
                response.on('end', function () {
                    try {
                        var data = JSON.parse(str);
                        //console.log(str);
                        if (data[0] != "error") {
                            if (data[0] == true) {
                                if (data[1][1].toLowerCase().includes("taylor") && data[1][1].toLowerCase().includes("swift")) {
                                    try {
                                        http.request({
                                            //host: 'mc.campbellsimpson.com',
                                            host: '192.168.1.37',
                                            port: 8081,
                                            path: '/SpotifySkipNext'
                                        }, function (response) {
                                            response.on('error', function (err) {
                                                console.log(err);
                                            });
                                        }).end();
                                    }
                                    catch (err) {
                                        console.log(err.stack);
                                    }
                                }
                                if (spotify[0] != data[1][0]) {
                                    spotify = data[1];
                                    var title = data[1][0];
                                    if (title.length <= 15) {
                                        lines[0] = title;
                                        setTimeout(() => {
                                            lines[1] = " ";
                                        }, 200);
                                    }
                                    else {
                                        lines[0] = title.substring(0, 13) + " -";
                                        setTimeout(() => {
                                            lines[1] = title.substring(13, 13 + 15);
                                        }, 200);
                                    }
                                    setTimeout(() => {
                                        restore([lines[2], lines[3], lines[4], lines[5], lines[6]]);
                                    }, 250);
                                }
                            }
                            else {
                                if (spotify != "") {
                                    spotify = "";
                                    lines[0] = " ";
                                    lines[1] = " ";
                                    restore([lines[2], lines[3], lines[4], lines[5], lines[6]]);
                                }
                            }
                        }
                        else {
                            if (spotify != "Spotify not connected.") {
                                spotify = "Spotify not connected.";
                                lines[0] = "Spotify not connected.";
                                lines[1] = "";
                                restore([lines[2], lines[3], lines[4], lines[5], lines[6]]);
                            }
                        }
                    }
                    catch (err) {
                        console.log(err.stack);
                    }
                });
                response.on('error', function (err) {
                    console.log(err);
                });
            }).end();
        }
        catch (err) {
            console.log(err.stack);
        }
    }, 5000);
}
myClient.onclose = () => { if (intervalId2 != null) {
    clearInterval(intervalId2);
    intervalId2 = null;
} };
//#endregion Spotify
try {
    setupSpotify();
}
catch (err) { }
