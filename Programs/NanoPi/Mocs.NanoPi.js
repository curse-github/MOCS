var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
function newParameter(name, nullable, public, defaultValue) {
    return {
        "name": name, "type": ((typeof defaultValue).replace("bigint", "number")), "nullable": nullable, "public": public, "defaultValue": defaultValue
    };
}
var Client = /** @class */ (function () {
    function Client(name, isPublic) {
        this.WebSocket = require('ws');
        //http = require("http");
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
    Object.defineProperty(Client.prototype, "name", {
        get: function () { return this.connectionMessage.data.name; },
        set: function (v) { this.connectionMessage.data.name = v; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Client.prototype, "public", {
        get: function () { return this.connectionMessage.data.public; },
        set: function (v) { this.connectionMessage.data.public = v; },
        enumerable: false,
        configurable: true
    });
    Client.prototype.SetupWebsocket = function () {
        var _this = this;
        try {
            this.ws.send(JSON.stringify(this.connectionMessage));
            this.ws.onerror = function (err) { console.log("Websocket error: \"" + err + "\"."); };
            this.ws.onmessage = function (e) {
                var _a;
                try {
                    var msg = JSON.parse(e.data);
                    if (msg.type != null) {
                        if (msg.type == "ping" && msg.data != null) {
                            _this.ws.send(JSON.stringify({ type: "pong", data: msg.data }));
                        }
                        else if (msg.type == "command" && msg.data != null) {
                            if (!msg.data.includes(".")) {
                                if (msg.parameters != null && msg.parameters.length > 0) {
                                    (_a = _this.functions)[msg.data.toLowerCase()].apply(_a, __spreadArray([_this], msg.parameters, false));
                                }
                                else {
                                    _this.functions[msg.data.toLowerCase()](_this);
                                }
                            }
                            else {
                                console.log("Error, command sent to child device?...");
                                return;
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
            this.ws.onclose = function (e) {
                console.log("Lost connection to MOCS server.");
                _this.tryReconnect();
                _this.ws = null;
                if (onclose != null)
                    _this.onclose();
            };
        }
        catch (err) {
            console.log(err.stack);
        }
    };
    Client.prototype.tryReconnect = function () {
        var _this = this;
        // attempt to connect every 20 seconds untill it works and then stop.
        this.intervalId = setInterval(function () {
            if (_this.ws == null) {
                _this.attemts++;
                console.log("Attempt #" + _this.attemts + " to connect to the MOCS server.");
                _this.ws = new WebSocket(Client.URL);
                _this.ws.onerror = function (e) { if (_this.ws != null) {
                    try {
                        _this.ws.close();
                    }
                    catch (err) {
                        console.log(err.stack);
                    }
                    _this.ws = null;
                    if (onclose != null)
                        _this.onclose();
                } };
                _this.ws.onopen = function () {
                    _this.stopInterval(); // stop loop.
                    _this.attemts = 0;
                    _this.SetupWebsocket();
                };
            }
        }, 20000);
        return this;
    };
    Client.prototype.stopInterval = function () { if (this.intervalId != null) {
        clearInterval(this.intervalId);
        this.intervalId = null;
    } };
    Client.prototype.AddFunction = function (name, isPublic, parameters, func) {
        this.connectionMessage.data.functions.push({ "name": name, "public": isPublic, "parameters": parameters });
        this.functions[name.toLowerCase() + "()"] = func;
    };
    Client.prototype.listen = function () {
        var _this = this;
        this.ws = new this.WebSocket(Client.URL);
        this.ws.onerror = function (e) {
            console.log("Unable to connect to MOCS server.");
            _this.tryReconnect();
            _this.ws = null;
            if (onclose != null)
                _this.onclose();
        };
        this.ws.onopen = function () {
            _this.SetupWebsocket();
        };
        return this;
    };
    Client.URL = "ws://mc.campbellsimpson.com:42069";
    return Client;
}());
//#endregion
var spawn = require("child_process").spawn;
var lines = ["", "", "", "", "", "", "", ""];
var subscriptions = [];
function line(lineNum, text) {
    var _lineNum = Math.min(Math.max(lineNum, 0), 5);
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
var myClient = new Client("NanoPi", true);
myClient.AddFunction("Line", true, [
    newParameter("lineNum", false, true, 1),
    newParameter("text", false, true, "string")
], function (client, lineNum, text) {
    line(lineNum, text);
});
myClient.AddFunction("Clear", true, [], function (client) { clear(); });
myClient.AddFunction("Restore", true, [
    newParameter("line1", true, true, "-_-_-_-_-_-_-_-_"),
    newParameter("line2", true, true, "-_-_-_-_-_-_-_-_"),
    newParameter("line3", true, true, "-_-_-_-_-_-_-_-_"),
    newParameter("line4", true, true, "-_-_-_-_-_-_-_-_"),
    newParameter("line5", true, true, "-_-_-_-_-_-_-_-_"),
    newParameter("line6", true, true, "-_-_-_-_-_-_-_-_")
], function (client, line1, line2, line3, line4, line5, line6) {
    restore([line1, line2, line3, line4, line5, line6]);
});
myClient.AddFunction("Subscribe", false, [
    newParameter("button", false, true, 1),
    newParameter("name", false, true, "name"),
    newParameter("func", false, true, "func"),
    newParameter("parameter", false, true, "parameter")
], function (client, button, name, func, parameter) {
    subscribe(button, name, func, parameter);
});
myClient.AddFunction("wasPressed", true, [
    newParameter("button", false, true, 1)
], function (client, button) {
    wasPressed(button, client.ws);
});
//#region Spotify
var intervalId2 = null;
var http = require("http");
var spotify = "";
function setupSpotify() {
    intervalId2 = setInterval(function () {
        try {
            var options = {
                host: 'mc.campbellsimpson.com',
                port: 8081,
                path: '/SpotifyStatus'
            };
            http.request(options, function (response) {
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
                                            host: 'mc.campbellsimpson.com',
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
                                        setTimeout(function () {
                                            lines[1] = " ";
                                        }, 200);
                                    }
                                    else {
                                        lines[0] = title.substring(0, 13) + " -";
                                        setTimeout(function () {
                                            lines[1] = title.substring(13, 13 + 15);
                                        }, 200);
                                    }
                                    setTimeout(function () {
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
myClient.onclose = function () { if (intervalId2 != null) {
    clearInterval(intervalId2);
    intervalId2 = null;
} };
//#endregion Spotify
myClient.listen();
setupSpotify();
