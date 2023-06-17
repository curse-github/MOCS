var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
function newParameter(name, nullable, public, defaultValue, type) {
    return {
        "name": name, "type": (type || (typeof defaultValue).replace("bigint", "number")), "nullable": nullable, "public": public, "defaultValue": defaultValue
    };
}
var Client = /** @class */ (function () {
    function Client(name, isPublic) {
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
                    if (_this.ws == null)
                        return;
                    var msg = JSON.parse(e.data);
                    if (msg.type != null) {
                        if (msg.type == "ping" && msg.data != null) {
                            _this.ws.send(JSON.stringify({ type: "pong", data: msg.data }));
                        }
                        else if (msg.type == "command" && msg.data != null) {
                            var funcName = msg.data.toLowerCase();
                            if (_this.functions[funcName] == null) {
                                console.log("invalid command");
                                console.log(msg);
                                return;
                            }
                            if (msg.parameters != null && msg.parameters.length > 0) {
                                (_a = _this.functions)[funcName].apply(_a, __spreadArray([_this], msg.parameters, false));
                            }
                            else {
                                _this.functions[funcName](_this);
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
                _this.ws = null;
                if (_this.onclose != null)
                    try {
                        _this.onclose();
                    }
                    catch (err) { }
                _this.setReconnectInterval(true);
            };
        }
        catch (err) {
            console.log(err.stack);
        }
        return this;
    };
    Client.prototype.setReconnectInterval = function (reconnection) {
        var _this = this;
        // attempt to connect every 20 seconds untill it works and then stop.
        this.tryReconnect(reconnection);
        this.intervalId = setInterval(function () {
            _this.tryReconnect(reconnection);
        }, 15000);
        return this;
    };
    Client.prototype.tryReconnect = function (reconnection) {
        var _this = this;
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
        this.ws.onerror = function (e) { if (_this.ws != null) {
            if (_this.onclose != null)
                try {
                    _this.onclose();
                }
                catch (err) { }
            try {
                _this.ws.close();
            }
            catch (err) {
                console.log(err.stack);
            }
            _this.ws = null;
        } };
        this.ws.onclose = function (e) { if (_this.ws != null) {
            if (_this.onclose != null)
                try {
                    _this.onclose();
                }
                catch (err) { }
            _this.ws = null;
        } };
        this.ws.onopen = function () {
            _this.stopInterval(); // stop loop.
            console.clear();
            console.log((reconnection == true ? "Rec" : "C") + "onnected to MOCS server" + ((_this.attemts > 1) ? " after " + _this.attemts + " attempts." : "."));
            _this.attemts = 0;
            _this.SetupWebsocket();
        };
        return this;
    };
    Client.prototype.stopInterval = function () { if (this.intervalId != null) {
        clearInterval(this.intervalId);
        this.intervalId = null;
    } return this; };
    Client.prototype.AddFunction = function (name, isPublic, parameters, func) {
        this.connectionMessage.data.functions.push({ "name": name, "public": isPublic, "parameters": parameters });
        this.functions[name.toLowerCase() + "()"] = func;
        return this;
    };
    Client.prototype.AddChildFunction = function (devicename, devicePublic, functionName, functionPublic, parameters, func) {
        var devices = this.connectionMessage.data.devices;
        if (devices == null)
            devices = [];
        var index = devices.findIndex(function (el) { return el.name == devicename; });
        if (index == -1) {
            index = devices.length;
            devices.push({ name: devicename, "public": devicePublic, functions: [] });
        }
        devices[index].functions.push({ "name": functionName, "public": functionPublic, "parameters": parameters });
        this.connectionMessage.data.devices = devices;
        this.functions[devicename.toLowerCase() + "." + functionName.toLowerCase() + "()"] = func;
        return this;
    };
    Client.prototype.listen = function () {
        this.setReconnectInterval();
        return this;
    };
    //static URL:string = "ws://mc.campbellsimpson.com:42069";
    Client.URL = "ws://192.168.1.37:42069";
    return Client;
}());
//#endregion typeDefs
var spawn = require("child_process").spawn;
function pythonCmd(file, args) {
    var lst = __spreadArray([], args, true);
    lst.unshift(file);
    spawn("python", lst);
}
var myClient = new Client("CrowPi", true)
    .AddFunction("segmentTime", true, [
    newParameter("num", false, true, "1200")
], function (client, num) {
    pythonCmd(__dirname + "/segmentTime.py", [Math.floor(num)]);
})
    .AddFunction("segmentNumber", true, [
    newParameter("num", false, true, 98.76)
], function (client, num) {
    pythonCmd(__dirname + "/segmentNumber.py", [num]);
})
    .AddFunction("segmentClear", true, [], function (client) { pythonCmd(__dirname + "/segmentClear.py", []); })
    .AddFunction("matrixPixel", true, [
    newParameter("x", false, true, 0),
    newParameter("y", false, true, 0),
    newParameter("size", false, true, 1),
    newParameter("value", false, true, true)
], function (client, x, y, size, value) {
    pythonCmd(__dirname + "/matrixPixel.py", [x, y, size, value]);
})
    .AddFunction("matrixClear", true, [], function (client) { pythonCmd(__dirname + "/matrixPixel.py", [0, 0, 8, false]); })
    /*.AddFunction("matrixPrint"  , true,[
        newParameter<string>("input",false,true,"string")
    ],(client:Client,input:mocsParameter)=>{
        pythonCmd(__dirname+"/matrixPrint.py",[input as string]);
    })*/
    .AddFunction("lcdPrint", true, [
    newParameter("input", false, true, "string")
], function (client, input) {
    pythonCmd(__dirname + "/lcdPrint.py", [input]);
})
    .AddFunction("lcdClear", true, [], function (client) { pythonCmd(__dirname + "/lcdClear.py", []); })
    .AddFunction("buzz", true, [
    newParameter("time", false, true, 0.5)
], function (client, time) { pythonCmd(__dirname + "/buzzer.py", [time]); })
    .AddChildFunction("minecraft", true, "PlayerTeleport", true, [
    newParameter("x", false, true, 0),
    newParameter("y", false, true, 0),
    newParameter("z", false, true, 0)
], function (client, x, y, z) {
    pythonCmd(__dirname + "/minecraft/minecraftPlayerTeleport.py", [x, y, z]);
})
    .AddChildFunction("minecraft", true, "PlaceBlock", true, [
    newParameter("x", false, true, 0),
    newParameter("y", false, true, 0),
    newParameter("z", false, true, 0),
    newParameter("blockid", false, true, 0),
    newParameter("subtype", true, true, null, "number")
], function (client, x, y, z, blockid, subtype) {
    if (subtype != null)
        pythonCmd(__dirname + "/minecraft/minecraftPlaceBlock.py", [x, y, z, blockid, subtype]);
    else
        pythonCmd(__dirname + "/minecraft/minecraftPlaceBlock.py", [x, y, z, blockid]);
})
    .AddChildFunction("minecraft", true, "PlaceAtPlayer", true, [
    newParameter("blockid", false, true, 0),
    newParameter("subtype", true, true, null, "number")
], function (client, blockid, subtype) {
    if (subtype != null)
        pythonCmd(__dirname + "/minecraft/minecraftPlaceAtPlayer.py", [blockid, subtype]);
    else
        pythonCmd(__dirname + "/minecraft/minecraftPlaceAtPlayer.py", [blockid]);
})
    .AddChildFunction("minecraft", true, "PlayerMove", true, [
    newParameter("x", false, true, 0),
    newParameter("y", false, true, 0),
    newParameter("z", false, true, 0)
], function (client, x, y, z) {
    pythonCmd(__dirname + "/minecraft/minecraftPlayerMove.py", [x, y, z]);
})
    .AddChildFunction("minecraft", true, "PlaceRelToPlayer", true, [
    newParameter("x", false, true, 0),
    newParameter("y", false, true, 0),
    newParameter("z", false, true, 0),
    newParameter("blockid", false, true, 0),
    newParameter("subtype", true, true, null, "number")
], function (client, x, y, z, blockid, subtype) {
    if (subtype != null)
        pythonCmd(__dirname + "/minecraft/minecraftPlaceRelToPlayer.py", [x, y, z, blockid, subtype]);
    else
        pythonCmd(__dirname + "/minecraft/minecraftPlaceRelToPlayer.py", [x, y, z, blockid]);
})
    .AddChildFunction("minecraft", true, "Chat", true, [
    newParameter("input", false, true, "string")
], function (client, input) {
    pythonCmd(__dirname + "/minecraft/minecraftChat.py", [input]);
})
    .listen();
