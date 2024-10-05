"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printFakeFunction = exports.Colors = exports.exampleConnection = exports.assert = exports.assertIsString = exports.assertIsObject = exports.cloneObject = exports.httpsRequestGetBufferPromise = exports.httpsRequestPromise = exports.getIp = void 0;
const { networkInterfaces } = require('os');
function getIp() {
    const nets = networkInterfaces();
    const results = Object.create(null);
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === "IPv4" && !net.internal) {
                if (!results[name]) {
                    results[name] = [];
                }
                results[name].push(net.address);
            }
        }
    }
    if (results["Ethernet"] != null && results["Ethernet"].length > 0) {
        return results["Ethernet"][0];
    }
    else if (results["Wi-Fi"] != null && results["Wi-Fi"].length > 0) {
        return results["Wi-Fi"][0];
    }
}
exports.getIp = getIp;
const https = require("https");
/** Requests or posts from a https server and returns output.
 * @param link Link to the server to request from.
 * @param path Filepath of the file you are accessing from the server.
 * @param method Request method e.g "GET","POST","PUT".
 * @param headers An object of headers.
 * @param data Data to send if method is post.
 * @returns A Promise which will return the data returned from the request. */
function httpsRequestPromise(link, path, method, headers, data) {
    return new Promise((resolve, reject) => {
        try {
            var curl = "";
            if (data != null) {
                //@ts-expect-error
                headers["Content-Length"] = data.length;
            }
            var options = {
                "host": link,
                "port": 443,
                "path": path,
                "method": method,
                "headers": headers
            };
            var req = https.request(options, (res) => {
                res.setEncoding('utf8');
                res.on("data", (chunk) => { curl += chunk; });
                res.on("close", () => { resolve(curl); });
            });
            req.on("error", (err) => { reject(err); });
            if (data != null) {
                req.write(data);
            }
            req.end();
        }
        catch (err) {
            reject(err);
        }
    });
}
exports.httpsRequestPromise = httpsRequestPromise;
/** Requests from a https server data in the form of a buffer
 * @param link Link to the server to request from.
 * @param path Filepath of the file you are accessing from the server.
 * @param headers An object of headers.
 * @returns A Promise which will return the Buffer object returned from the request.
 */
function httpsRequestGetBufferPromise(link, path, headers) {
    return new Promise((resolve, reject) => {
        try {
            var curl = [];
            var options = {
                "host": link,
                "port": 443,
                "path": path,
                "method": "GET",
                "headers": headers
            };
            var req = https.request(options, (res) => {
                res.on("data", (chunk) => { curl.push(Buffer.from(chunk)); });
                res.on("close", () => { resolve(Buffer.concat(curl)); });
            });
            req.on("error", (err) => { reject(err); });
            req.end();
        }
        catch (err) {
            reject(err);
        }
    });
}
exports.httpsRequestGetBufferPromise = httpsRequestGetBufferPromise;
/** Returns a clone of the object with a different memory address to the origional.
 * @param thing Object to clone
 * @returns The clone */
function cloneObject(thing) {
    if (thing != null && thing != undefined) {
        if ((typeof thing) == "object") {
            if (Array.isArray(thing)) {
                //list
                var clonedList = [];
                for (var i = 0; i < thing.length; i++) {
                    if (thing[i] != null) {
                        clonedList[i] = cloneObject(thing[i]);
                    }
                }
                return clonedList;
            }
            else {
                assertIsObject(thing);
                //object
                var keys = Object.keys(thing);
                var clonedObject = {};
                keys.forEach((i) => {
                    assert(typeof i == "string" || typeof i == "number");
                    if (thing[i] != null) {
                        var temp = cloneObject(thing[i]);
                        assert(temp != null);
                        clonedObject[i] = temp;
                    }
                });
                return clonedObject;
            }
        }
        else {
            return thing;
        }
    }
    else {
        return null;
    }
}
exports.cloneObject = cloneObject;
//#endregion
//assertions
/** Asserts that the "obj" is of type "object"
 * @param obj input */
function assertIsObject(obj) {
    if (typeof obj != "object") {
        throw new Error("failure to assert (typeof val = object)");
    }
}
exports.assertIsObject = assertIsObject;
/** Asserts that the "str" is of type "string"
 * @param str input */
function assertIsString(str) {
    if (typeof str != "string") {
        throw new Error("failure to assert (typeof val = string)");
    }
}
exports.assertIsString = assertIsString;
/**
 * Asserts that "condition" is true
 * @param condition input
 */
function assert(condition) {
    if (!condition) {
        throw new Error("condition not met");
    }
}
exports.assert = assert;
//#region examples
// sent as the first message after connecting to websocket, needs to be sent before it will receive any commands
exports.exampleConnection = {
    "type": "connection",
    "data": {
        name: "deviceName",
        functions: {
            "function1Name": {
                name: "function1Name",
                parameters: [
                    { name: "childDeviceParameter1Name", type: "string", nullable: false },
                    { name: "childDeviceParameter2Name", type: "bool", nullable: false },
                    { name: "childDeviceParameter3Name", type: "number", nullable: true }
                    //...
                ],
                public: true
            },
            //...
        },
        devices: {
            "childDeviceName": {
                name: "childDeviceName",
                functions: {
                    "childDeviceFunction1Name": {
                        name: "childDeviceFunction1Name",
                        parameters: [
                            { name: "childDeviceParameter1Name", type: "string", nullable: false },
                            { name: "childDeviceParameter2Name", type: "bool", nullable: false },
                            { name: "childDeviceParameter3Name", type: "number", nullable: true }
                            //...
                        ],
                        public: false
                    },
                    //...
                }
            },
            //...
        }
    }
};
var exampleConnectionJSON = {
    "type": "connection",
    "data": {
        "name": "deviceName",
        "functions": {
            "function1name": {
                "name": "Function1Name",
                "parameters": [
                    { "name": "deviceFunction1Parameter1Name", "type": "string", "nullable": false },
                    { "name": "deviceFunction1Parameter2Name", "type": "bool", "nullable": false },
                    { "name": "deviceFunction1Parameter3Name", "type": "number", "nullable": true }
                ],
                "public": true
            }
        },
        "devices": {
            "childname": {
                "name": "childName",
                "functions": {
                    "childfunction1name": {
                        "name": "childFunction1Name",
                        "parameters": [
                            { "name": "childFunction1Parameter1Name", "type": "string", "nullable": false },
                            { "name": "childFunction1Parameter2Name", "type": "bool", "nullable": false },
                            { "name": "childFunction1Parameter3Name", "type": "number", "nullable": true }
                        ],
                        "public": true
                    }
                }
            }
        }
    }
};
//sent as a client to call a function on a device
var exampleCommand = {
    type: "command",
    data: {
        device: "device1",
        function: "subscribeConnection",
        parameters: [
            123,
            "string",
            null,
            false
        ]
    }
};
var exampleCommandJSON = {
    "type": "command",
    "data": {
        "device": "self.Spotify",
        "function": "play",
        "parameters": [
            "",
            "Crs"
        ]
    }
};
var exampleCommandJSONSubscribeConn = {
    "type": "command",
    "data": {
        "device": "self",
        "function": "SubscribeConnection",
        "parameters": [
            "Nanopi",
            "self.Spotify",
            "Play"
        ]
    }
};
var exampleCommandJSONSubscribeDisconn = {
    "type": "command",
    "data": {
        "device": "self",
        "function": "SubscribeDisconnection",
        "parameters": [
            "Nanopi",
            "self.Spotify",
            "Play"
        ]
    }
};
// must be sent within half a second of ping message
var examplePong = {
    "type": "pong",
    "data": 2 // used as an id, needs to match the data sent in the ping message
};
//#endregion
class Colors {
}
exports.Colors = Colors;
Colors.Reset = "\x1b[0m";
Colors.Bright = "\x1b[1m";
Colors.Underscore = "\x1b[4m";
Colors.Reverse = "\x1b[7m";
//static Dim       :string = "\x1b[2m";//does not work at all
//static Blink     :string = "\x1b[5m";//does not work at all
//static Hidden    :string = "\x1b[8m";//does not work at all
Colors.R = "\x1b[0m";
Colors.B = "\x1b[1m";
Colors.U = "\x1b[4m";
Colors.Rev = "\x1b[7m";
Colors.FgBlack = "\x1b[30m";
Colors.FgRed = "\x1b[31m";
Colors.FgGreen = "\x1b[32m";
Colors.FgYellow = "\x1b[33m"; //does not work on powershell somehow
Colors.FgBlue = "\x1b[34m";
Colors.FgMagenta = "\x1b[35m";
Colors.FgCyan = "\x1b[36m";
Colors.FgWhite = "\x1b[37m";
Colors.FgGray = "\x1b[90m";
Colors.FgBl = "\x1b[30m";
Colors.FgRe = "\x1b[31m";
Colors.FgGre = "\x1b[32m";
Colors.FgYe = "\x1b[33m"; //does not work on powershell somehow
Colors.FgBlu = "\x1b[34m";
Colors.FgMa = "\x1b[35m";
Colors.FgCy = "\x1b[36m";
Colors.FgWh = "\x1b[37m";
Colors.FgGr = "\x1b[90m";
Colors.BgBlack = "\x1b[40m";
Colors.BgRed = "\x1b[41m";
Colors.BgGreen = "\x1b[42m";
Colors.BgYellow = "\x1b[43m";
Colors.BgBlue = "\x1b[44m";
Colors.BgMagenta = "\x1b[45m";
Colors.BgCyan = "\x1b[46m";
Colors.BgWhite = "\x1b[47m";
Colors.BgGray = "\x1b[100m";
Colors.BgBl = "\x1b[40m";
Colors.BgRe = "\x1b[41m";
Colors.BgGr = "\x1b[42m";
Colors.BgYe = "\x1b[43m";
Colors.BgBlu = "\x1b[44m";
Colors.BgMa = "\x1b[45m";
Colors.BgCy = "\x1b[46m";
Colors.BgWh = "\x1b[47m";
Colors.BgGra = "\x1b[100m";
function printFakeFunction(func, parameters) {
    return Colors.FgCyan + func.split(".").join(Colors.FgGray + "." + Colors.FgCyan) + Colors.FgGray + "(" + parameters.map((el) => { return ((((typeof el) == "string") ? Colors.FgGreen : Colors.FgYellow) + JSON.stringify(el)); }).join(Colors.FgGray + ", ") + Colors.FgGray + ")" + Colors.Reset;
}
exports.printFakeFunction = printFakeFunction;
