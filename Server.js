"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/* To-DO
 *
 * MAIN:
 *
 * SIDE
 *
 * device code for pi computer - runs on startup
 */
const WebSocket = require('ws'); // npm install ws
const express = require("express"); // npm install express
const Spotify_1 = require("./Spotify");
const Lib_1 = require("./Lib");
console.clear();
const fs = __importStar(require("fs"));
//try { fs.rmSync("out.txt"); } catch (err:any) { }
const Log = console.log;
console.log = (...data) => __awaiter(void 0, void 0, void 0, function* () {
    Log(...data);
    Object.values(Lib_1.Colors).forEach((value) => {
        for (let i = 0; i < data.length; i++) {
            data[i] = data[i].toString().split(value).join("");
        }
    });
    //fs.appendFileSync("out.txt",data.join("  ")+"\n");
});
var devices = {
    "self": {
        name: "self",
        public: true,
        functions: {
            "authenticate": { name: "authenticate", public: false, parameters: [{ name: "username", type: "string", nullable: false, public: false }, { name: "password", type: "string", nullable: false, public: false }, { name: "createDevice", type: "boolean", nullable: true, public: false }] },
            "callback": { name: "callback", public: false, parameters: [{ name: "callback", type: "number", nullable: false, public: false }, { name: "returnVal", type: "string", nullable: false, public: false }] },
            "subscribeconnection": { name: "subscribeConnection", public: false, parameters: [{ name: "deviceName", type: "string", nullable: false, public: false }, { name: "callbackDeviceName", type: "string", nullable: false, public: false }, { name: "callbackFunctionName", type: "string", nullable: false, public: false }] },
            "subscribedisconnection": { name: "subscribeDisconnection", public: false, parameters: [{ name: "deviceName", type: "string", nullable: false, public: false }, { name: "callbackDeviceName", type: "string", nullable: false, public: false }, { name: "callbackFunctionName", type: "string", nullable: false, public: false }] },
            "clearconsole": { name: "clearConsole", public: true, parameters: [] },
        },
        "devices": {}
    }
};
var Accounts = JSON.parse(fs.readFileSync(__dirname + "/logins.json", 'utf8'));
var pings = {};
var websockets = {};
var connectionSubscriptions = {};
var disconnectionSubscriptions = {};
var callbacks = [];
function pingDevices() {
    //send every device a "ping" message
    pings = {};
    var keys = Object.keys(devices);
    for (var i = 1; i < keys.length; i++) {
        const key = keys[i];
        if (key == "self")
            continue;
        pings[key] = false;
        const tmpWs = websockets[key];
        if (devices[key] != null && tmpWs != null) {
            tmpWs.send("{\"type\":\"ping\", \"data\":\"" + key + "\"}");
        }
    }
    setTimeout(() => {
        //after 100ms see which of the devices responded with a pong
        var keys2 = Object.keys(devices);
        for (var i = 0; i < keys2.length; i++) {
            const key = keys2[i];
            if (key == "self")
                continue;
            const device = devices[key];
            if (device == null)
                continue;
            if (pings[key] == true)
                continue;
            //and if they didnt count them as disconnected and remove them from the database
            if (websockets[key] != null) {
                websockets[key].close();
                delete websockets[key];
            }
            var oldDevice = { public: true, name: key };
            if (device != null) {
                oldDevice = device;
                delete devices[key];
            }
            //remove subscriptions made by that device
            const connectKeys = Object.keys(connectionSubscriptions);
            for (let j = 0; j < connectKeys.length; j++) {
                const key = connectKeys[j];
                const subs = connectionSubscriptions[key];
                let numSubs = subs.length;
                for (let k = 0; k < subs.length; k++) {
                    const name = subs[k][0].toLowerCase();
                    if (devices[name] != null && websockets[name] != null)
                        continue;
                    numSubs--;
                    delete connectionSubscriptions[key][k];
                }
                if (numSubs == 0)
                    delete connectionSubscriptions[key];
                else
                    connectionSubscriptions[key] = subs.filter((el) => el != null);
            }
            const disconnectKeys = Object.keys(disconnectionSubscriptions);
            for (let j = 0; j < disconnectKeys.length; j++) {
                const key = disconnectKeys[j];
                const subs = disconnectionSubscriptions[key];
                let numSubs = subs.length;
                for (let k = 0; k < subs.length; k++) {
                    const name = subs[k][0].toLowerCase();
                    if (devices[name] != null && websockets[name] != null)
                        continue;
                    numSubs--;
                    delete subs[k];
                }
                if (numSubs == 0)
                    delete disconnectionSubscriptions[key];
                else
                    disconnectionSubscriptions[key] = subs.filter((el) => el != null);
            }
            if (key.startsWith("web"))
                continue; // if its a browser made device, skip next steps
            if (oldDevice.public)
                console.log(Lib_1.Colors.FgGr + "Device " + Lib_1.Colors.FgGre + "\"" + oldDevice.name + "\"" + Lib_1.Colors.FgGr + " disconnected." + Lib_1.Colors.R);
            //send disconnection subscriptions
            var DisconnSubs = disconnectionSubscriptions[key.toLowerCase()];
            if (DisconnSubs != null && (typeof DisconnSubs) == "object" && Array.isArray(DisconnSubs)) {
                for (var j = 0; j < DisconnSubs.length; j++) {
                    handleCommand({ type: "command", data: { device: DisconnSubs[j][0], function: DisconnSubs[j][1], parameters: [key] } });
                }
            }
            var anyDisconnSubs = disconnectionSubscriptions["any"];
            if (anyDisconnSubs != null && (typeof anyDisconnSubs) == "object" && Array.isArray(anyDisconnSubs)) {
                for (var j = 0; j < anyDisconnSubs.length; j++) {
                    const tmpWS = websockets[anyDisconnSubs[j][0]];
                    if (tmpWS == null)
                        continue;
                    tmpWS.send(JSON.stringify({
                        type: "command",
                        data: anyDisconnSubs[j][1] + "()",
                        parameters: [key]
                    }));
                }
            }
        }
    }, 100);
}
const socketport = 42069;
var ws = new WebSocket.Server({ "port": socketport });
console.log(Lib_1.Colors.FgGr + "Websocket api is running at ws://" + (0, Lib_1.getIp)() + Lib_1.Colors.FgGr + ":" + Lib_1.Colors.FgYe + socketport + Lib_1.Colors.R);
setInterval(() => {
    pingDevices(); //ping devices
}, 30 * 1000); //30 seconds
ws.on('connection', (websocket) => {
    //ping all devices to see figure out which one disconnected
    websocket.on('close', function (reasonCode, description) { pingDevices(); });
    websocket.on('message', (message) => {
        try {
            var msg = JSON.parse(message);
            if (msg == null) {
                websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 400, error: "Command is null" }));
                console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgRe + " message is " + Lib_1.Colors.FgCy + "null" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                return;
            }
            if (msg.type == null) {
                websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 401, error: "Command type is null", id: msg.id }));
                console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgRe + " message type is" + Lib_1.Colors.FgCy + " null" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                return;
            }
            //find example messages in Lib.ts
            switch (msg.type) {
                case "connection": {
                    //check if valid data
                    //needs to have either nested objects or functions to call
                    const fail = () => {
                        if (msg.data != null && msg.data.name != null)
                            return;
                        console.log(Lib_1.Colors.FgGr + "invalid connection from " + Lib_1.Colors.FgGre + "\"unknown\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                    };
                    if (msg.data == null || msg.data.name == null) {
                        fail();
                        websocket.send(JSON.stringify({ type: "reply", status: false, statusCode: 400, reply: "failure", id: msg.id, error: "Command data is null" }));
                        break;
                    }
                    let mapDevice = (device, parentName) => {
                        const DisplayName = ((parentName != null) ? (parentName + ".") : ("")) + device.name;
                        const DisplayNameColor = ((parentName != null) ? (Lib_1.Colors.FgCy + parentName + Lib_1.Colors.FgGr + ".") : ("")) + Lib_1.Colors.FgCy + device.name;
                        var newDevice = {};
                        if ((typeof device.name) != "string") {
                            websocket.send(JSON.stringify({ type: "reply", status: false, statusCode: 401, reply: "failure", id: msg.id, error: "device.name is not a string." }));
                            console.log(Lib_1.Colors.FgGr + "invalid connection: " + ((parentName != null) ? (Lib_1.Colors.FgCy + parentName + Lib_1.Colors.FgGr + ".") : ("")) + Lib_1.Colors.FgCy + "device" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.FgCy + "name " + Lib_1.Colors.FgRe + "is not a string" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                            return false;
                        }
                        newDevice.name = device.name;
                        try {
                            if ((typeof device.public) == "string")
                                device.public = JSON.parse(device.public);
                        }
                        catch (err) {
                            websocket.send(JSON.stringify({ type: "reply", status: false, statusCode: 402, reply: "failure", id: msg.id, error: (((parentName != null) ? (parentName + ".") : ("")) + newDevice.name + ".public is not a boolean.") }));
                            console.log(Lib_1.Colors.FgGr + "invalid connection: " + DisplayNameColor + Lib_1.Colors.FgGr + "." + Lib_1.Colors.FgCy + "public" + Lib_1.Colors.FgRe + " is not a boolean" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                            return false;
                        }
                        if ((typeof device.public) != "boolean" && device.public != null) {
                            websocket.send(JSON.stringify({ type: "reply", status: false, statusCode: 403, reply: "failure", id: msg.id, error: (((parentName != null) ? (parentName + ".") : ("")) + newDevice.name + ".public is not a boolean.") }));
                            console.log(Lib_1.Colors.FgGr + "invalid connection: " + DisplayNameColor + Lib_1.Colors.FgGr + "." + Lib_1.Colors.FgCy + "public " + Lib_1.Colors.FgRe + "is not a boolean" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                            return false;
                        }
                        newDevice.public = ((device.public != null) ? device.public : true);
                        if (device.functions != null) {
                            if ((typeof device.functions) != "object") {
                                websocket.send(JSON.stringify({ type: "reply", status: false, statusCode: 405, reply: "failure", id: msg.id, error: (DisplayName + ".functions is not an object.") }));
                                console.log(Lib_1.Colors.FgGr + "invalid connection: " + DisplayNameColor + Lib_1.Colors.FgGr + "." + Lib_1.Colors.FgCy + "functions " + Lib_1.Colors.FgRe + "is not an object" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                                return false;
                            }
                            newDevice.functions = {};
                            let mapParameters = (param, funcIndex, index) => {
                                const DisplayName = ((parentName != null) ? (parentName + ".") : ("")) + newDevice.name + ".functions[" + (((typeof funcIndex) == "number") ? (funcIndex) : ("\"" + funcIndex + "\"")) + "].parameters[" + index + "]";
                                const DisplayNameColor = ((parentName != null) ? (Lib_1.Colors.FgCy + parentName + Lib_1.Colors.FgGr + ".") : ("")) + Lib_1.Colors.FgCy + newDevice.name + Lib_1.Colors.FgGr + "." + Lib_1.Colors.FgCy + "functions" + Lib_1.Colors.FgGr + "[" + (((typeof funcIndex) == "number") ? (Lib_1.Colors.FgYe + funcIndex) : (Lib_1.Colors.FgGre + "\"" + funcIndex + "\"")) + Lib_1.Colors.FgGr + "]" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.FgCy + "parameters" + Lib_1.Colors.FgGr + "[" + Lib_1.Colors.FgYe + index + Lib_1.Colors.FgGr + "]" + Lib_1.Colors.R;
                                if (param == null) {
                                    websocket.send(JSON.stringify({ type: "reply", status: false, statusCode: 406, reply: "failure", id: msg.id, error: (DisplayName + " is null") }));
                                    console.log(Lib_1.Colors.FgGr + "invalid connection: " + DisplayNameColor + Lib_1.Colors.FgRe + " is null" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                                    return false;
                                }
                                if ((typeof param.name) != "string") {
                                    websocket.send(JSON.stringify({ type: "reply", status: false, statusCode: 407, reply: "failure", id: msg.id, error: (DisplayName + ".name is not a string.") }));
                                    console.log(Lib_1.Colors.FgGr + "invalid connection: " + DisplayNameColor + Lib_1.Colors.FgGr + "." + Lib_1.Colors.FgCy + "name " + Lib_1.Colors.FgRe + "is not a string" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                                    return false;
                                }
                                if ((typeof param.type) != "string") {
                                    websocket.send(JSON.stringify({ type: "reply", status: false, statusCode: 408, reply: "failure", id: msg.id, error: (DisplayName + ".type is not a string.") }));
                                    console.log(Lib_1.Colors.FgGr + "invalid connection: " + DisplayNameColor + Lib_1.Colors.FgGr + "." + Lib_1.Colors.FgCy + "type " + Lib_1.Colors.FgRe + "is not a string" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                                    return false;
                                }
                                param.type = param.type.toLowerCase();
                                if (param.type != "string" && param.type != "number" && param.type != "bool" && param.type != "boolean") {
                                    websocket.send(JSON.stringify({ type: "reply", status: false, statusCode: 409, reply: "failure", id: msg.id, error: (DisplayName + ".type is not a valid type.") }));
                                    console.log(Lib_1.Colors.FgGr + "invalid connection: " + DisplayNameColor + Lib_1.Colors.FgGr + "." + Lib_1.Colors.FgCy + "type " + Lib_1.Colors.FgRe + "is not a valid type" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                                    return false;
                                }
                                try {
                                    if ((typeof param.nullable) == "string")
                                        param.nullable = JSON.parse(param.nullable);
                                }
                                catch (err) {
                                    websocket.send(JSON.stringify({ type: "reply", status: false, statusCode: 410, reply: "failure", id: msg.id, error: (DisplayName + ".nullable is not a boolean.") }));
                                    console.log(Lib_1.Colors.FgGr + "invalid connection: " + DisplayNameColor + Lib_1.Colors.FgGr + "." + Lib_1.Colors.FgCy + "nullable " + Lib_1.Colors.FgRe + "is not a boolean" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                                    return false;
                                }
                                if ((typeof param.nullable) != "boolean" && param.nullable != null) {
                                    websocket.send(JSON.stringify({ type: "reply", status: false, statusCode: 411, reply: "failure", id: msg.id, error: (DisplayName + ".nullable is not a boolean.") }));
                                    console.log(Lib_1.Colors.FgGr + "invalid connection: " + DisplayNameColor + Lib_1.Colors.FgGr + "." + Lib_1.Colors.FgCy + "nullable " + Lib_1.Colors.FgRe + "is not a boolean" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                                    return false;
                                }
                                //TEST THIS
                                var out = { "name": param.name, "type": param.type, "nullable": ((param.nullable != null) ? param.nullable : true) };
                                if (param.defaultValue != null)
                                    out.defaultValue = param.defaultValue;
                                return out;
                            };
                            let mapFunction = (func, index) => {
                                const DisplayName = ((parentName != null) ? (parentName + ".") : ("")) + newDevice.name + ".functions[" + (((typeof index) == "number") ? (index) : ("\"" + index + "\"")) + "]";
                                const DisplayNameColor = ((parentName != null) ? (Lib_1.Colors.FgCy + parentName + Lib_1.Colors.FgGr + ".") : ("")) + Lib_1.Colors.FgCy + newDevice.name + Lib_1.Colors.FgGr + "." + Lib_1.Colors.FgCy + "functions" + (((typeof index) == "number") ? (Lib_1.Colors.FgGr + "[" + Lib_1.Colors.FgYe + index + Lib_1.Colors.FgGr + "]") : (Lib_1.Colors.FgGr + "[" + Lib_1.Colors.FgGre + "\"" + index + "\"" + Lib_1.Colors.FgGr + "]")) + Lib_1.Colors.R;
                                if (func == null) {
                                    websocket.send(JSON.stringify({ type: "reply", status: false, statusCode: 412, reply: "failure", id: msg.id, error: (DisplayName + " is null") }));
                                    console.log(Lib_1.Colors.FgGr + "invalid connection: " + DisplayNameColor + Lib_1.Colors.FgRe + " is null" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                                    return false;
                                }
                                var newFunc = {};
                                if ((typeof func.name) != "string") {
                                    websocket.send(JSON.stringify({ type: "reply", status: false, statusCode: 413, reply: "failure", id: msg.id, error: (DisplayName + ".name is not a string") }));
                                    console.log(Lib_1.Colors.FgGr + "invalid connection: " + DisplayNameColor + Lib_1.Colors.FgGr + "." + Lib_1.Colors.FgCy + "name " + Lib_1.Colors.FgRe + "is not a string" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                                    return false;
                                }
                                newFunc.name = func.name;
                                try {
                                    if ((typeof func.public) == "string")
                                        func.public = JSON.parse(func.public);
                                }
                                catch (err) {
                                    websocket.send(JSON.stringify({ type: "reply", status: false, statusCode: 414, reply: "failure", id: msg.id, error: (DisplayName + ".public is not a boolean") }));
                                    console.log(Lib_1.Colors.FgGr + "invalid connection: " + DisplayNameColor + Lib_1.Colors.FgGr + "." + Lib_1.Colors.FgCy + "public " + Lib_1.Colors.FgRe + "is not a boolean" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                                    return false;
                                }
                                if ((typeof func.public) != "boolean" && func.public != null) {
                                    websocket.send(JSON.stringify({ type: "reply", status: false, statusCode: 415, reply: "failure", id: msg.id, error: (DisplayName + ".public is not a boolean") }));
                                    console.log(Lib_1.Colors.FgGr + "invalid connection: " + DisplayNameColor + Lib_1.Colors.FgGr + "." + Lib_1.Colors.FgCy + "public " + Lib_1.Colors.FgRe + "is not a boolean" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                                    return false;
                                }
                                newFunc.public = ((func.public != null) ? func.public : true);
                                if ((typeof func.parameters) != "object" || !Array.isArray(func.parameters)) {
                                    websocket.send(JSON.stringify({ type: "reply", status: false, statusCode: 416, reply: "failure", id: msg.id, error: (DisplayName + ".parameters is not an object") }));
                                    console.log(Lib_1.Colors.FgGr + "invalid connection: " + DisplayNameColor + Lib_1.Colors.FgGr + "." + Lib_1.Colors.FgCy + "parameters " + Lib_1.Colors.FgRe + "is not an object" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                                    return false;
                                }
                                newFunc.parameters = [];
                                for (let i = 0; i < func.parameters.length; i++) {
                                    const parameter = func.parameters[i];
                                    const tmp = mapParameters(parameter, index, i);
                                    if (tmp == false) {
                                        return false;
                                    }
                                    newFunc.parameters.push(tmp);
                                }
                                return newFunc;
                            };
                            if (Array.isArray(device.functions)) {
                                for (let i = 0; i < device.functions.length; i++) {
                                    const func = device.functions[i];
                                    const tmp = mapFunction(func, i);
                                    if (tmp == false) {
                                        return false;
                                    }
                                    else
                                        newDevice.functions[func.name.toLowerCase()] = tmp;
                                }
                            }
                            else {
                                const funcKeys = Object.keys(device.functions);
                                for (let i = 0; i < funcKeys.length; i++) {
                                    const func = device.functions[funcKeys[i]];
                                    const tmp = mapFunction(func, funcKeys[i]);
                                    if (tmp == false) {
                                        return false;
                                    }
                                    else
                                        newDevice.functions[func.name.toLowerCase()] = tmp;
                                }
                            }
                        }
                        if (device.devices != null) {
                            if ((typeof device.devices) != "object") {
                                websocket.send(JSON.stringify({ type: "reply", status: false, statusCode: 417, reply: "failure", id: msg.id, error: (DisplayName + ".devices is not an object") }));
                                console.log(Lib_1.Colors.FgGr + "invalid connection: " + DisplayNameColor + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R + Lib_1.Colors.FgCy + "devices " + Lib_1.Colors.FgRe + "is not an object" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                                return false;
                            }
                            newDevice.devices = {};
                            if (Array.isArray(device.devices)) {
                                for (let i = 0; i < device.devices.length; i++) {
                                    const childDevice = device.devices[i];
                                    if (childDevice == null) {
                                        websocket.send(JSON.stringify({ type: "reply", status: false, statusCode: 420, reply: "failure", id: msg.id, error: (DisplayName + ".\"device\" is null.") }));
                                        console.log(Lib_1.Colors.FgGr + "invalid connection: " + DisplayNameColor + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R + Lib_1.Colors.FgCy + "device " + Lib_1.Colors.FgRe + "is null" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                                        return false;
                                    }
                                    if ((typeof childDevice.name) != "string") {
                                        websocket.send(JSON.stringify({ type: "reply", status: false, statusCode: 419, reply: "failure", id: msg.id, error: (DisplayName + ".\"device\".name is not an string") }));
                                        console.log(Lib_1.Colors.FgGr + "invalid connection: " + DisplayNameColor + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R + Lib_1.Colors.FgCy + "device" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R + Lib_1.Colors.FgCy + "name " + Lib_1.Colors.FgRe + "is not a string" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                                        return false;
                                    }
                                    const tmp = mapDevice(childDevice, ((parentName != null) ? (parentName + ".") : ("")) + device.name);
                                    if (tmp == false) {
                                        return false;
                                    }
                                    else
                                        newDevice.devices[childDevice.name.toLowerCase()] = tmp;
                                }
                            }
                            else {
                                const funcKeys = Object.keys(device.devices);
                                for (let i = 0; i < funcKeys.length; i++) {
                                    const childDevice = device.devices[funcKeys[i]];
                                    if (childDevice == null) {
                                        websocket.send(JSON.stringify({ type: "reply", status: false, statusCode: 420, reply: "failure", id: msg.id, error: (DisplayName + ".\"device\" is null.") }));
                                        console.log(Lib_1.Colors.FgGr + "invalid connection: " + DisplayNameColor + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R + Lib_1.Colors.FgCy + "device " + Lib_1.Colors.FgRe + "is null" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                                        return false;
                                    }
                                    if ((typeof childDevice.name) != "string") {
                                        websocket.send(JSON.stringify({ type: "reply", status: false, statusCode: 421, reply: "failure", id: msg.id, error: (DisplayName + ".\"device\".name is not an string.") }));
                                        console.log(Lib_1.Colors.FgGr + "invalid connection: " + DisplayNameColor + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R + Lib_1.Colors.FgCy + "device" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R + Lib_1.Colors.FgCy + "name " + Lib_1.Colors.FgRe + "is not a string" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                                        return false;
                                    }
                                    const tmp = mapDevice(childDevice, ((parentName != null) ? (parentName + ".") : ("")) + device.name);
                                    if (tmp == false)
                                        return false;
                                    else
                                        newDevice.devices[childDevice.name.toLowerCase()] = tmp;
                                }
                            }
                        }
                        if ((device.devices == null || Object.keys(device.devices).length <= 0) &&
                            (device.functions == null || Object.keys(device.functions).length <= 0)) {
                            websocket.send(JSON.stringify({ type: "reply", status: false, statusCode: 418, reply: "failure", id: msg.id, error: "The server refuses to brew coffee because it is, permanently, a teapot." }));
                            console.log(Lib_1.Colors.FgGr + "invalid connection: " + Lib_1.Colors.FgRe + "pointless device " + Lib_1.Colors.FgGre + "\"" + DisplayNameColor + Lib_1.Colors.FgGre + "\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                            return false;
                        } // status code 418
                        return newDevice;
                    };
                    const tmp = mapDevice(msg.data);
                    if (tmp == false) {
                        fail();
                        break;
                    }
                    const ogMsgId = msg.data.id;
                    msg.data = tmp;
                    if (websockets[msg.data.name.toLowerCase()] == null && devices[msg.data.name.toLowerCase()] == null) {
                        //add device data and websocket connection to lists
                        devices[msg.data.name.toLowerCase()] = msg.data;
                        websockets[msg.data.name.toLowerCase()] = websocket;
                        //response
                        websocket.send(JSON.stringify({ type: "reply", status: true, statusCode: 200, reply: "success", id: ogMsgId }));
                        if (msg.data.public)
                            console.log(Lib_1.Colors.FgGr + "Device " + Lib_1.Colors.FgGre + "\"" + msg.data.name + "\"" + Lib_1.Colors.FgGr + " conneced" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        //special things
                        if (msg.data.name.toLowerCase() == "nanopi") {
                            handleCommand("{\"type\":\"command\",\"data\":{\"device\":\"nanopi\",\"function\":\"Subscribe\",\"parameters\":[1,\"self.spotify\",\"skipprevious\",\"" + Spotify_1.Spotify.defaultAccount + "\"]}}");
                            handleCommand("{\"type\":\"command\",\"data\":{\"device\":\"nanopi\",\"function\":\"Subscribe\",\"parameters\":[2,\"self.spotify\",\"toggle\",\"" + Spotify_1.Spotify.defaultAccount + "\"]}}");
                            handleCommand("{\"type\":\"command\",\"data\":{\"device\":\"nanopi\",\"function\":\"Subscribe\",\"parameters\":[3,\"self.spotify\",\"skipnext\",\"" + Spotify_1.Spotify.defaultAccount + "\"]}}");
                        }
                        else if (msg.data.name.toLowerCase() == "controller") {
                            handleCommand("{\"type\":\"command\",\"data\":{\"device\":\"controller\",\"function\":\"Subscribe\",\"parameters\":[7,\"self.spotify\",\"skipprevious\",\"" + Spotify_1.Spotify.defaultAccount + "\"]}}");
                            handleCommand("{\"type\":\"command\",\"data\":{\"device\":\"controller\",\"function\":\"Subscribe\",\"parameters\":[6,\"self.spotify\",\"toggle\",\"" + Spotify_1.Spotify.defaultAccount + "\"]}}");
                            handleCommand("{\"type\":\"command\",\"data\":{\"device\":\"controller\",\"function\":\"Subscribe\",\"parameters\":[5,\"self.spotify\",\"skipnext\",\"" + Spotify_1.Spotify.defaultAccount + "\"]}}");
                        }
                        //handle connection subs
                        const sub = connectionSubscriptions[msg.data.name.toLowerCase()];
                        if (sub != null && (typeof sub == "object" && Array.isArray(sub))) {
                            for (var i = 0; i < sub.length; i++) {
                                handleCommand(JSON.parse("{\"type\":\"command\",\"data\":{\"device\":\"" + sub[i][0] + "\",\"function\":\"" + sub[i][1] + "\",\"parameters\":[\"" + msg.data.name + "\"]}}"));
                            }
                        }
                        const anySub = connectionSubscriptions["any"];
                        if (anySub != null && (typeof anySub) == "object" && Array.isArray(anySub)) {
                            for (var i = 0; i < anySub.length; i++) {
                                if (websockets[anySub[i][0]] == null)
                                    continue;
                                websockets[anySub[i][0]].send(JSON.stringify({
                                    type: "command",
                                    data: anySub[i][1] + "()",
                                    parameters: [msg.data.name, msg.data]
                                }));
                            }
                        }
                    }
                    break;
                }
                case "command": {
                    //console.log("command: \n" + message + "\n");
                    if (msg.data == null) {
                        console.log(msg);
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 402, error: "Command data is invalid", id: msg.id }));
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGr + " Command" + Lib_1.Colors.FgRe + " missing command data" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return;
                    }
                    if (msg.data.device == null) {
                        console.log(msg);
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 402, error: "Command device is invalid", id: msg.id }));
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGr + " Command" + Lib_1.Colors.FgRe + " missing target device" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return;
                    }
                    if (msg.data.function == null) {
                        console.log(msg);
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 403, error: "Command function is invalid", id: msg.id }));
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGr + " Command" + Lib_1.Colors.FgRe + " missing target function" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return;
                    }
                    if (msg.data.parameters == null) {
                        console.log(msg);
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 405, error: "Command parameters is invalid", id: msg.id }));
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGr + " Command" + Lib_1.Colors.FgRe + " missing function parameters" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return;
                    }
                    handleCommand(msg, websocket);
                    break;
                }
                case "pong": {
                    //when receiving back a ping call the callback after error checking
                    if (msg.data == null || (typeof msg.data) != "string")
                        break;
                    pings[msg.data] = true;
                    break;
                }
                case "ping": {
                    if (msg.data != null)
                        websocket.send("{\"type\":\"pong\",\"data\":\"" + msg.data + "\"}");
                    else if (msg.id != null)
                        websocket.send("{\"type\":\"pong\",\"id\":\"" + msg.id + "\"}");
                    break;
                }
                default: {
                    websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 406, error: "Command type is invalid", id: msg.id }));
                    console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgRe + " Invalid message type" + Lib_1.Colors.FgGre + " \"" + msg.type + "\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                }
            }
        }
        catch (err) {
            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 407, error: "Command invalid json", message: err.message }));
            console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgRe + " Unable to parse json of message" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
            console.log(message);
            console.log(err.message);
            console.log(err.stack);
        }
    });
});
//continue here
function handleCommand(msg, websocket) {
    if ((typeof msg) == "string") {
        (0, Lib_1.assertIsString)(msg);
        try {
            var json = JSON.parse(msg);
            if (json != null) {
                handleCommand(json);
            }
            else {
                if (websocket != null) {
                    websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 408, error: "Command is null" }));
                }
                console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgRe + " Command is" + Lib_1.Colors.FgCy + " null" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                return;
            }
        }
        catch (err) {
            console.log(err.stack + "    ln310");
        }
    }
    else if ((typeof msg) == "object") {
        (0, Lib_1.assert)(typeof msg == "object");
        if (msg.data.device.split(".")[0].toLowerCase() == "self") {
            var _switch = {
                "authenticate()": function (parameters) {
                    if (parameters.length < 2) {
                        if (websocket != null) {
                            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 409, error: "self.authenticate parameters are invalid", id: msg.id }));
                        }
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGre + " \"" + (0, Lib_1.printFakeFunction)("self.authenticate", parameters) + Lib_1.Colors.FgGre + "\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return false;
                    }
                    if (parameters[0] == null || parameters[0] == "") {
                        if (websocket != null) {
                            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 410, error: "self.authenticate \"username\" is invalid", id: msg.id }));
                        }
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGre + " \"" + (0, Lib_1.printFakeFunction)("self.authenticate", parameters) + Lib_1.Colors.FgGre + "\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return false;
                    }
                    if (parameters[1] == null || parameters[1] == "") {
                        if (websocket != null) {
                            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 411, error: "self.authenticate \"password\" is invalid", id: msg.id }));
                        }
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGre + " \"" + (0, Lib_1.printFakeFunction)("self.authenticate", parameters) + Lib_1.Colors.FgGre + "\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return false;
                    }
                    if ((typeof parameters[0]) != "string") {
                        if (websocket != null) {
                            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 410, error: "self.authenticate \"username\" is invalid", id: msg.id }));
                        }
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGre + " \"" + (0, Lib_1.printFakeFunction)("self.authenticate", parameters) + Lib_1.Colors.FgGre + "\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return false;
                    }
                    if ((typeof parameters[1]) != "string") {
                        if (websocket != null) {
                            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 411, error: "self.authenticate \"password\" is invalid", id: msg.id }));
                        }
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGre + " \"" + (0, Lib_1.printFakeFunction)("self.authenticate", parameters) + Lib_1.Colors.FgGre + "\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return false;
                    }
                    let validAccount = false;
                    for (let i = 0; i < Accounts.length; i++) {
                        if (Accounts[i].username == parameters[0] && Accounts[i].password == parameters[1]) {
                            validAccount = true;
                            break;
                        }
                    }
                    if (!validAccount) {
                        var string = null;
                        if (parameters[0].toLowerCase() == "root" && parameters[1].toLowerCase() == "root" ||
                            parameters[1].toLowerCase() == "admin" && parameters[0].toLowerCase() == "admin" ||
                            parameters[1].toLowerCase() == "password" ||
                            parameters[1].toLowerCase() == "1234" ||
                            parameters[1].toLowerCase() == "password1234") {
                            string = "Nice try.";
                        }
                        else {
                            var hints = ["hint: html", "hint: It's not that.", "hint: Try something else.", "Maybe next time.", "You really thought it would be that?"];
                            string = hints[Math.round(Math.random() * (hints.length - 1))];
                        }
                        websocket.send(JSON.stringify({ type: "authentication", status: false, data: string, id: msg.id }));
                        false;
                    }
                    //login is valid
                    var tmp = (0, Lib_1.cloneObject)(devices);
                    (0, Lib_1.assert)(tmp != null && typeof tmp == "object");
                    var devicesClone = tmp;
                    var callback = function (objIn) {
                        var obj = (0, Lib_1.cloneObject)(objIn);
                        Object.keys(obj).forEach((i) => {
                            if (typeof obj[i] == "object" && obj[i] != null) {
                                if (obj[i].devices != null) {
                                    obj[i].devices = callback(obj[i].devices);
                                }
                                Object.keys(obj[i].functions).forEach((j) => {
                                    if (obj[i].functions[j].public == false || obj[i].functions[j].public == "false" || obj[i].name.includes("web")) {
                                        delete obj[i].functions[j];
                                    }
                                });
                            }
                        });
                        return obj;
                    };
                    devicesClone = callback(devicesClone);
                    if (parameters[2] != null && (((typeof parameters[2]) == "boolean" && parameters[2] == true) || ((typeof parameters[2]) == "string" && parameters[2].toLowerCase() == "true"))) {
                        setTimeout(() => {
                            for (var i = 0; i < 10; i++) {
                                if (devices["web" + i] == null) {
                                    websocket.send(JSON.stringify({ type: "authentication", status: true, deviceId: ("web" + i), data: devicesClone, id: msg.id }));
                                    websockets["web" + i] = websocket;
                                    devices["web" + i] = {
                                        name: "web" + i,
                                        functions: {
                                            "connect": {
                                                name: "connect",
                                                parameters: [{ name: "device", type: "string", nullable: false }],
                                                public: false
                                            },
                                            "disconnect": {
                                                name: "disconnect",
                                                parameters: [{ name: "device", type: "string", nullable: false }],
                                                public: false
                                            }
                                        },
                                        devices: {}, public: false
                                    };
                                    break;
                                }
                            }
                        }, 125);
                    }
                    else {
                        websocket.send(JSON.stringify({ type: "authentication", status: true, data: devicesClone, id: msg.id }));
                    }
                    return true;
                },
                "callback()": function (parameters) {
                    if (parameters.length < 2) {
                        if (websocket != null) {
                            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 412, error: "self.callback not enough parameters", id: msg.id }));
                        }
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGre + " \"" + (0, Lib_1.printFakeFunction)("self.callback", parameters) + Lib_1.Colors.FgGre + "\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return false;
                    }
                    if (parameters[0] == null || parameters[0] == "") {
                        if (websocket != null) {
                            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 413, error: "self.callback \"callback\" is invalid", id: msg.id }));
                        }
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGre + " \"" + (0, Lib_1.printFakeFunction)("self.callback", parameters) + Lib_1.Colors.FgGre + "\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return false;
                    }
                    if (parameters[1] == null || parameters[1] == "") {
                        if (websocket != null) {
                            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 414, error: "self.callback \"returnVal\" is invalid", id: msg.id }));
                        }
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGre + " \"" + (0, Lib_1.printFakeFunction)("self.callback", parameters) + Lib_1.Colors.FgGre + "\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return false;
                    }
                    var callbackNum = Number(parameters[0]);
                    if (Number.isNaN(callbackNum)) {
                        if (websocket != null) {
                            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 415, error: "self.callback \"callback\" is invalid", id: msg.id }));
                        }
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGre + " \"" + (0, Lib_1.printFakeFunction)("self.callback", parameters) + Lib_1.Colors.FgGre + "\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return false;
                    }
                    if ((typeof parameters[1]) != "string") {
                        if (websocket != null) {
                            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 416, error: "self.callback \"returnVal\" is invalid", id: msg.id }));
                        }
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGre + " \"" + (0, Lib_1.printFakeFunction)("self.callback", parameters) + Lib_1.Colors.FgGre + "\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return false;
                    }
                    callbacks[callbackNum](parameters[1], callbackNum);
                    delete callbacks[callbackNum];
                    return true;
                },
                "subscribeconnection()": function (parameters) {
                    if (parameters.length < 3) {
                        if (websocket != null) {
                            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 417, error: "self.subscribeconnection not enough parameters", id: msg.id }));
                        }
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGre + " \"" + (0, Lib_1.printFakeFunction)("self.subscribeconnection", parameters) + Lib_1.Colors.FgGre + "\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return false;
                    }
                    if (parameters[0] == null || parameters[0] == "") {
                        if (websocket != null) {
                            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 418, error: "self.subscribeconnection \"deviceName\" is invalid", id: msg.id }));
                        }
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGre + " \"" + (0, Lib_1.printFakeFunction)("self.subscribeconnection", parameters) + Lib_1.Colors.FgGre + "\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return false;
                    }
                    if (parameters[1] == null || parameters[1] == "") {
                        if (websocket != null) {
                            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 419, error: "self.subscribeconnection \"callbackDeviceName\" is invalid", id: msg.id }));
                        }
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGre + " \"" + (0, Lib_1.printFakeFunction)("self.subscribeconnection", parameters) + Lib_1.Colors.FgGre + "\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return false;
                    }
                    if (parameters[2] == null || parameters[2] == "") {
                        if (websocket != null) {
                            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 420, error: "self.subscribeconnection \"callbackFunctionName\" is invalid", id: msg.id }));
                        }
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGre + " \"" + (0, Lib_1.printFakeFunction)("self.subscribeconnection", parameters) + Lib_1.Colors.FgGre + "\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return false;
                    }
                    if ((typeof parameters[0]) != "string") {
                        if (websocket != null) {
                            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 418, error: "self.subscribeconnection \"deviceName\" is invalid", id: msg.id }));
                        }
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGre + " \"" + (0, Lib_1.printFakeFunction)("self.subscribeconnection", parameters) + Lib_1.Colors.FgGre + "\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return false;
                    }
                    if ((typeof parameters[1]) != "string") {
                        if (websocket != null) {
                            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 419, error: "self.subscribeconnection \"callbackDeviceName\" is invalid", id: msg.id }));
                        }
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGre + " \"" + (0, Lib_1.printFakeFunction)("self.subscribeconnection", parameters) + Lib_1.Colors.FgGre + "\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return false;
                    }
                    if ((typeof parameters[2]) != "string") {
                        if (websocket != null) {
                            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 420, error: "self.subscribeconnection \"callbackFunctionName\" is invalid", id: msg.id }));
                        }
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGre + " \"" + (0, Lib_1.printFakeFunction)("self.subscribeconnection", parameters) + Lib_1.Colors.FgGre + "\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return false;
                    }
                    const deviceName = parameters[0].toLowerCase();
                    if (websockets[deviceName] == null) {
                        connectionSubscriptions[deviceName] = connectionSubscriptions[deviceName] || [];
                        connectionSubscriptions[deviceName].push([parameters[1], parameters[2]]);
                    }
                    else { // device is already connected
                        handleCommand(JSON.parse("{\"type\":\"command\",\"data\":{\"device\":\"" + parameters[1] + "\",\"function\":\"" + parameters[2] + "\",\"parameters\":[\"" + parameters[0] + "\"]}}"));
                    }
                    return true;
                },
                "subscribedisconnection()": function (parameters) {
                    if (parameters.length < 3) {
                        if (websocket != null) {
                            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 421, error: "self.subscribedisconnection not enough parameters", id: msg.id }));
                        }
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGre + " \"" + (0, Lib_1.printFakeFunction)("self.subscribedisconnection", parameters) + Lib_1.Colors.FgGre + "\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return false;
                    }
                    if (parameters[0] == null || parameters[0] == "") {
                        if (websocket != null) {
                            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 422, error: "self.subscribedisconnection \"deviceName\" is invalid", id: msg.id }));
                        }
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGre + " \"" + (0, Lib_1.printFakeFunction)("self.subscribedisconnection", parameters) + Lib_1.Colors.FgGre + "\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return false;
                    }
                    if (parameters[1] == null || parameters[1] == "") {
                        if (websocket != null) {
                            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 423, error: "self.subscribedisconnection \"callbackDeviceName\" is invalid", id: msg.id }));
                        }
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGre + " \"" + (0, Lib_1.printFakeFunction)("self.subscribedisconnection", parameters) + Lib_1.Colors.FgGre + "\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return false;
                    }
                    if (parameters[2] == null || parameters[2] == "") {
                        if (websocket != null) {
                            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 424, error: "self.subscribedisconnection \"callbackFunctionName\" is invalid", id: msg.id }));
                        }
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGre + " \"" + (0, Lib_1.printFakeFunction)("self.subscribedisconnection", parameters) + Lib_1.Colors.FgGre + "\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return false;
                    }
                    if ((typeof parameters[0]) != "string") {
                        if (websocket != null) {
                            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 422, error: "self.subscribedisconnection \"deviceName\" is invalid", id: msg.id }));
                        }
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGre + " \"" + (0, Lib_1.printFakeFunction)("self.subscribedisconnection", parameters) + Lib_1.Colors.FgGre + "\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return false;
                    }
                    if ((typeof parameters[1]) != "string") {
                        if (websocket != null) {
                            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 423, error: "self.subscribedisconnection \"callbackDeviceName\" is invalid", id: msg.id }));
                        }
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGre + " \"" + (0, Lib_1.printFakeFunction)("self.subscribedisconnection", parameters) + Lib_1.Colors.FgGre + "\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return false;
                    }
                    if ((typeof parameters[2]) != "string") {
                        if (websocket != null) {
                            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 424, error: "self.subscribedisconnection \"callbackFunctionName\" is invalid", id: msg.id }));
                        }
                        console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgGre + " \"" + (0, Lib_1.printFakeFunction)("self.subscribedisconnection", parameters) + Lib_1.Colors.FgGre + "\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        return false;
                    }
                    const deviceName = parameters[0].toLowerCase();
                    disconnectionSubscriptions[deviceName] = disconnectionSubscriptions[deviceName] || [];
                    disconnectionSubscriptions[deviceName].push([parameters[1], parameters[2]]);
                    return true;
                },
                "clearconsole()": function (parameters) {
                    console.clear();
                    return true;
                }
            };
            Object.keys(localdevices).forEach((i) => {
                var temp = Object.assign({}, _switch, localdevices[i].functions);
                _switch = temp;
            });
            var nm = (msg.data.device.includes(".") ? ((msg.data.device.substring(5)).toLowerCase() + ".") : "") + msg.data.function.toLowerCase();
            if (_switch[nm + "()"] != null) {
                var out = _switch[nm + "()"](msg.data.parameters, websocket, msg.id);
                if (out)
                    websocket.send(JSON.stringify({ type: "status", status: true, statusCode: 200, id: msg.id }));
                else {
                    console.log(msg.data);
                    console.log("");
                }
            }
            else {
                if (websocket != null) {
                    websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 425, error: "Function \"" + nm + "\" not found", id: msg.id }));
                }
                console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgRe + " Function" + Lib_1.Colors.FgGre + " \"" + nm + "\"" + Lib_1.Colors.FgRe + " not found" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                return;
            }
        }
        else {
            const out = findFunction(devices, msg.data, websocket);
            if (out[0] != false) {
                const lst = out;
                if (websockets[lst[0]] != null) { // console.log("sent: " + message);
                    (0, Lib_1.assertIsString)(lst[1]);
                    var message = lst[1];
                    websockets[lst[0]].send(message);
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: true, statusCode: 200, id: msg.id }));
                    }
                }
                else {
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 426, error: "Device \"" + lst[0] + "\" not connected", id: msg.id }));
                    }
                    console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgRe + " Device" + Lib_1.Colors.FgGre + " \"" + lst[0] + "\"" + Lib_1.Colors.FgRe + " not connected" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                }
            }
            else {
                console.log(msg.data);
                console.log("");
            }
        }
    }
    else {
        console.log(Lib_1.Colors.FgGr + "Internal error:" + Lib_1.Colors.FgYe + " Message" + Lib_1.Colors.FgRe + " is not an object" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
    }
}
function findFunction(list, data, websocket, type) {
    if (list != null && (typeof list) == "object" && !Array.isArray(list) && data != null) {
        var deviceName = data.device;
        if (!data.device.includes(".")) {
            // if there is only one level deep, find it and its function, and call it
            const device = list[deviceName.toLowerCase()];
            if ((device != null && Object.keys(device.functions).length > 0) && (device.functions[data.function.toLowerCase()] != null)) {
                const funcParams = device.functions[data.function.toLowerCase()].parameters;
                var condition = true;
                var failIndex = -1;
                var got = "";
                for (var i = 0; i < funcParams.length; i++) {
                    // check that parameter type matches expected type
                    if (data.parameters[i] == null || data.parameters[i] == "null") {
                        if (funcParams[i].nullable == true) {
                            if (data.parameters[i] == "null") {
                                data.parameters[i] = null;
                            }
                            continue; // valid
                        }
                        else {
                            condition = false;
                            failIndex = i;
                            got = Lib_1.Colors.FgCy + "null";
                            break;
                        } // invalid
                    }
                    else if ((typeof data.parameters[i]) == "number" || (typeof data.parameters[i]) == "bigint") {
                        if (funcParams[i].type == "number")
                            continue; // valid
                        else {
                            condition = false;
                            failIndex = i;
                            got = "number";
                            break;
                        } // invalid
                    }
                    else if ((typeof data.parameters[i]) == "boolean") {
                        if (funcParams[i].type == "bool" || funcParams[i].type == "boolean")
                            continue; // valid
                        else {
                            condition = false;
                            failIndex = i;
                            got = "boolean";
                            break;
                        } // invalid
                    }
                    else if ((typeof data.parameters[i]) == "string") {
                        if (funcParams[i].type == "string")
                            continue; // valid
                        else {
                            try {
                                (0, Lib_1.assertIsString)(data.parameters[i]);
                                var parsed = JSON.parse(data.parameters[i]);
                                if ((typeof parsed) == "number" || (typeof parsed) == "bigint") {
                                    if (funcParams[i].type == "number")
                                        continue; // valid
                                    else {
                                        condition = false;
                                        failIndex = i;
                                        got = "number";
                                        break;
                                    } // invalid
                                }
                                else if ((typeof parsed) == "boolean") {
                                    if (funcParams[i].type == "bool" || funcParams[i].type == "boolean")
                                        continue; // valid
                                    else {
                                        condition = false;
                                        failIndex = i;
                                        got = "boolean";
                                        break;
                                    } // invalid
                                }
                            }
                            catch (err) {
                                condition = false;
                                failIndex = i;
                                got = "error";
                                break;
                            } // invalid
                        }
                    }
                    else {
                        condition = false;
                        failIndex = i;
                        got = Lib_1.Colors.FgCy + "other";
                        break;
                    } // invalid
                }
                if (!condition) {
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 427, error: "Found function but parameter types do not match", id: data.id }));
                    }
                    console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.R + " Found function but" + Lib_1.Colors.FgRe + " parameter types do not match" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                    console.log(Lib_1.Colors.FgGr + "parameter" + Lib_1.Colors.FgYe + "#" + failIndex + Lib_1.Colors.FgGr + ", expected " + Lib_1.Colors.FgGre + type + Lib_1.Colors.FgGr + " but got " + Lib_1.Colors.FgGre + got + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                    return [false];
                }
                if (type == 2) {
                    return [{ type: "command", data: data.function + "()", "parameters": data.parameters }];
                }
                else if (type == null || type == 1) {
                    return [deviceName.toLowerCase(), JSON.stringify({ type: "command", data: data.function + "()", "parameters": data.parameters })];
                }
            }
            else {
                if (device == null) {
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 428, error: "Device \"" + deviceName + "\" not found", id: data.id }));
                    }
                    console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgRe + " Device" + Lib_1.Colors.FgGre + " \"" + deviceName + "\"" + Lib_1.Colors.FgRe + " not found" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                }
                else if (Object.keys(device.functions).length <= 0 || device.functions[data.function.toLowerCase()] == null) {
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 429, error: "Function \"" + data.function + "\" not found", id: data.id }));
                    }
                    console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgRe + " Device" + Lib_1.Colors.FgGre + " \"" + deviceName + "\"" + Lib_1.Colors.FgRe + " does not contain function" + Lib_1.Colors.FgGre + " \"" + data.function + "\"" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                }
                return [false];
            }
        }
        else {
            // if there is more than one call the function recursively untill it finds the data it was looking for, returning the first it finds
            const deviceNameSplit = deviceName.split(".");
            var shift = deviceNameSplit.shift().toLowerCase(); //get string between beginning and first dot
            if (list[shift] != null && Object.keys(list[shift].devices).length > 0) {
                var out = findFunction(list[shift].devices, { device: deviceNameSplit.join("."), function: data.function, parameters: data.parameters }, websocket, 2)[0];
                if (out != false) {
                    const message = out;
                    (0, Lib_1.assertIsObject)(message);
                    message.data = deviceNameSplit.join(".").toLowerCase() + "." + message.data;
                    if (type == 2)
                        return [message];
                    else
                        return [shift, JSON.stringify(message)];
                }
                else {
                    return [false];
                }
            }
            else {
                if (list[shift] == null) {
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 428, error: "Device \"" + shift + "\" not found", id: data.id }));
                    }
                    console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgRe + " Device" + Lib_1.Colors.FgGre + " \"" + shift + "\"" + Lib_1.Colors.FgRe + " not found" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                }
                else if (Object.keys(list[shift].devices).length <= 0) {
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 430, error: "Device does not have child \"" + deviceNameSplit[0] + "\"", id: data.id }));
                    }
                    console.log(Lib_1.Colors.FgGr + "Invalid command:" + Lib_1.Colors.FgRe + " Device" + Lib_1.Colors.FgGre + " \"" + shift + "\"" + Lib_1.Colors.FgRe + " does not have child devices" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                }
                else {
                    console.log("weird error ln551");
                }
                return [false];
            }
        }
    }
    else {
        if (list == null) {
            console.log(Lib_1.Colors.FgGr + "Internal error: list" + Lib_1.Colors.FgRe + " is" + Lib_1.Colors.FgCy + " null" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
        }
        else if ((typeof list) != "object") {
            console.log(Lib_1.Colors.FgGr + "Internal error: list" + Lib_1.Colors.FgRe + " is not an object" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
        }
        else if (Array.isArray(list)) {
            console.log(Lib_1.Colors.FgGr + "Internal error: list" + Lib_1.Colors.FgRe + " is an array" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
        }
        else { // data == null
            console.log(Lib_1.Colors.FgGr + "Internal error: data" + Lib_1.Colors.FgRe + " is" + Lib_1.Colors.FgCy + " null" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
        }
        return [false];
    }
    return [false]; //should not occur
}
var app = express();
app.get("/", function (req, res) {
    res.redirect("/index.html");
});
["/index.html", "/index.js", "/index.css", "/favicon.ico", "/favicon.png"].forEach((i) => {
    app.get(i, function (req, res) {
        res.sendFile(__dirname + "/Webserver" + i, "utf8");
    });
});
var localdevices = {
    "Spotify": {
        device: {
            name: "Spotify",
            functions: {
                "authenticate": { name: "Authenticate", parameters: [], public: true },
                "play": { name: "Play", parameters: [{ name: "link", type: "string", nullable: true, defaultValue: "" }, { name: "device", type: "string", nullable: true, defaultValue: Spotify_1.Spotify.defaultAccount }], public: true },
                "pause": { name: "Pause", parameters: [{ name: "device", type: "string", nullable: true, defaultValue: Spotify_1.Spotify.defaultAccount }], public: true },
                "skipnext": { name: "SkipNext", parameters: [{ name: "device", type: "string", nullable: true, defaultValue: Spotify_1.Spotify.defaultAccount }], public: true },
                "skipprevious": { name: "SkipPrevious", parameters: [{ name: "device", type: "string", nullable: true, defaultValue: Spotify_1.Spotify.defaultAccount }], public: true },
                "toggle": { name: "Toggle", parameters: [{ name: "device", type: "string", nullable: true, defaultValue: Spotify_1.Spotify.defaultAccount }], public: true },
                "volumeup": { name: "VolumeUp", parameters: [{ name: "amount", type: "number", nullable: false, defaultValue: "10" }, { name: "device", type: "string", nullable: true, defaultValue: Spotify_1.Spotify.defaultAccount }], public: true },
                "volumedown": { name: "VolumeDown", parameters: [{ name: "amount", type: "number", nullable: false, defaultValue: "10" }, { name: "device", type: "string", nullable: true, defaultValue: Spotify_1.Spotify.defaultAccount }], public: true },
                "setvolume": { name: "SetVolume", parameters: [{ name: "volume", type: "number", nullable: false, defaultValue: "50" }, { name: "device", type: "string", nullable: true, defaultValue: Spotify_1.Spotify.defaultAccount }], public: true }
            },
            devices: {}
        },
        functions: {
            "spotify.authenticate()": function (parameters, websocket) {
                websocket.send("{\"type\":\"redirect\",\"data\":\"" + Spotify_1.Spotify.Link + "\"}");
                return true;
            },
            "spotify.play()": function (parameters, websocket, id) {
                if (parameters.length < 2) {
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 431, error: "Found function but parameters do not match", "id": id }));
                    }
                    return false;
                }
                if (parameters[0] == null || (typeof parameters[0]) != "string") {
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 432, error: "Found function but parameter types do not match", "id": id }));
                    }
                    return false;
                }
                if (parameters[1] == null || (typeof parameters[1]) != "string") {
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 432, error: "Found function but parameter types do not match", "id": id }));
                    }
                    return false;
                }
                Spotify_1.Spotify.SpotifyPlay(parameters[0], null, parameters[1])
                    .then((val) => { }).catch((err) => { });
                return true;
            },
            "spotify.pause()": function (parameters, websocket, id) {
                if (parameters.length < 1) {
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 433, error: "Found function but parameters do not match", "id": id }));
                    }
                    return false;
                }
                if (parameters[0] == null || (typeof parameters[0]) != "string") {
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 434, error: "Found function but parameter types do not match", "id": id }));
                    }
                    return false;
                }
                Spotify_1.Spotify.SpotifyPause(parameters[0])
                    .then((val) => { }).catch((err) => { });
                return true;
            },
            "spotify.skipnext()": function (parameters, websocket, id) {
                if (parameters.length < 1) {
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 435, error: "Found function but parameters do not match", "id": id }));
                    }
                    return false;
                }
                if (parameters[0] == null || (typeof parameters[0]) != "string") {
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 436, error: "Found function but parameter types do not match", "id": id }));
                    }
                    return false;
                }
                Spotify_1.Spotify.SpotifySkipNext(null, parameters[0])
                    .then((val) => { }).catch((err) => { });
                return true;
            },
            "spotify.skipprevious()": function (parameters, websocket, id) {
                if (parameters.length < 1) {
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 437, error: "Found function but parameters do not match", "id": id }));
                    }
                    return false;
                }
                if (parameters[0] == null || (typeof parameters[0]) != "string") {
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 438, error: "Found function but parameter types do not match", "id": id }));
                    }
                    return false;
                }
                Spotify_1.Spotify.SpotifySkipPrevious(null, parameters[0])
                    .then((val) => { }).catch((err) => { });
                return true;
            },
            "spotify.toggle()": function (parameters, websocket, id) {
                if (parameters.length < 1) {
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 439, error: "Found function but parameters do not match", "id": id }));
                    }
                    return false;
                }
                if (parameters[0] == null || (typeof parameters[0]) != "string") {
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 440, error: "Found function but parameter types do not match", "id": id }));
                    }
                    return false;
                }
                Spotify_1.Spotify.SpotifyToggle(null, parameters[0])
                    .then((val) => { }).catch((err) => { });
                return true;
            },
            "spotify.volumeup()": function (parameters, websocket, id) {
                if (parameters.length < 2) {
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 441, error: "Found function but parameters do not match", "id": id }));
                    }
                    return false;
                }
                if (parameters[1] == null || (typeof parameters[1]) != "string") {
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 442, error: "Found function but parameter types do not match", "id": id }));
                    }
                    return false;
                }
                if (parameters[0] == null) {
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 442, error: "Found function but parameter types do not match", "id": id }));
                    }
                    return false;
                }
                if ((typeof parameters[0]) == "string") {
                    try {
                        parameters[0] = parseFloat(parameters[0]);
                    }
                    catch (err) {
                        if (websocket != null) {
                            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 442, error: "Found function but parameter types do not match", "id": id }));
                        }
                        return false;
                    }
                }
                if ((typeof parameters[0]) != "number") {
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 442, error: "Found function but parameter types do not match", "id": id }));
                    }
                    return false;
                }
                Spotify_1.Spotify.SpotifyVolumeUp(parameters[0], null, parameters[1])
                    .then(() => { }).catch((err) => { });
                return true;
            },
            "spotify.volumedown()": function (parameters, websocket, id) {
                if (parameters.length < 2) {
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 443, error: "Found function but parameters do not match", "id": id }));
                    }
                    return false;
                }
                if (parameters[1] == null || (typeof parameters[1]) != "string") {
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 444, error: "Found function but parameter types do not match", "id": id }));
                    }
                    return false;
                }
                if ((typeof parameters[0]) == "string") {
                    try {
                        parameters[0] = parseFloat(parameters[0]);
                    }
                    catch (err) {
                        if (websocket != null) {
                            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 444, error: "Found function but parameter types do not match", "id": id }));
                        }
                        return false;
                    }
                }
                if ((typeof parameters[0]) != "number") {
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 444, error: "Found function but parameter types do not match", "id": id }));
                    }
                    return false;
                }
                Spotify_1.Spotify.SpotifyVolumeDown(parameters[0], null, parameters[1])
                    .then(() => { }).catch((err) => { });
                return true;
            },
            "spotify.setvolume()": function (parameters, websocket, id) {
                if (parameters.length < 2) {
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 445, error: "Found function but parameters do not match", "id": id }));
                    }
                    return false;
                }
                if (parameters[1] == null || (typeof parameters[1]) != "string") {
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 446, error: "Found function but parameter types do not match", "id": id }));
                    }
                    return false;
                }
                if ((typeof parameters[0]) == "string") {
                    try {
                        parameters[0] = parseFloat(parameters[0]);
                    }
                    catch (err) {
                        if (websocket != null) {
                            websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 446, error: "Found function but parameter types do not match", "id": id }));
                        }
                        return false;
                    }
                }
                if ((typeof parameters[0]) != "number") {
                    if (websocket != null) {
                        websocket.send(JSON.stringify({ type: "status", status: false, statusCode: 446, error: "Found function but parameter types do not match", "id": id }));
                    }
                    return false;
                }
                Spotify_1.Spotify.SpotifySetVolume(parameters[0], null, parameters[1])
                    .then(() => { }).catch((err) => { });
                return true;
            }
        },
        "Rest": {
            "/SetSpotifyToken": function (req, res) {
                if (req.query.error == null) {
                    if (req.query.code != null) {
                        res.send("<html><script>function func() { window.location.href = 'http://mc.campbellsimpson.com:8081' } func();</script></html>");
                        Spotify_1.Spotify.SpotifyGetToken(req.query.code);
                    }
                }
                else {
                    console.log(Lib_1.Colors.FgGr + "Spotify token error:" + Lib_1.Colors.R + req.query.error);
                }
            },
            "/SpotifyPlay": function (req, res) {
                Spotify_1.Spotify.SpotifyPlay(null, null, Spotify_1.Spotify.defaultAccount).then((val) => { res.send(val); }).catch((err) => { res.send("error" + err); });
            },
            "/SpotifyPause": function (req, res) {
                Spotify_1.Spotify.SpotifyPause(Spotify_1.Spotify.defaultAccount).then((val) => { res.send(val); }).catch((err) => { res.send("error" + err); });
            },
            "/SpotifySkipNext": function (req, res) {
                Spotify_1.Spotify.SpotifySkipNext(null, Spotify_1.Spotify.defaultAccount).then((val) => { res.send(val); }).catch((err) => { res.send("error" + err); });
            },
            "/SpotifySkipPrevious": function (req, res) {
                Spotify_1.Spotify.SpotifySkipPrevious(null, Spotify_1.Spotify.defaultAccount).then((val) => { res.send(val); }).catch((err) => { res.send("error" + err); });
            },
            "/SpotifyStatus": function (req, res) {
                Spotify_1.Spotify.SpotifyStatus(Spotify_1.Spotify.defaultAccount).then((val) => { res.send(JSON.stringify(val)); }).catch((err) => { res.send("[\"error" + err + "\", []]"); });
            },
            "/SpotifyToggle": function (req, res) {
                Spotify_1.Spotify.SpotifyToggle(null, Spotify_1.Spotify.defaultAccount).then((val) => { res.send(val); }).catch((err) => { res.send("error" + err); });
            },
            "/SpotifyVolumeUp": function (req, res) {
                Spotify_1.Spotify.SpotifyVolumeUp(null, null, Spotify_1.Spotify.defaultAccount).then((val) => { res.send(val); }).catch((err) => { res.send("error" + err); });
            },
            "/SpotifyVolumeUp/:amount": function (req, res) {
                Spotify_1.Spotify.SpotifyVolumeUp(parseInt(req.params.amount), null, Spotify_1.Spotify.defaultAccount).then((val) => { res.send(val); }).catch((err) => { res.send("error" + err); });
            },
            "/SpotifyVolumeDown": function (req, res) {
                Spotify_1.Spotify.SpotifyVolumeDown(null, null, Spotify_1.Spotify.defaultAccount).then((val) => { res.send(val); }).catch((err) => { res.send("error" + err); });
            },
            "/SpotifyVolumeDown/:amount": function (req, res) {
                Spotify_1.Spotify.SpotifyVolumeDown(parseInt(req.params.amount), null, Spotify_1.Spotify.defaultAccount).then((val) => { res.send(val); }).catch((err) => { res.send("error" + err); });
            },
            "/SpotifyGetVolume": function (req, res) {
                Spotify_1.Spotify.SpotifyGetVolume(Spotify_1.Spotify.defaultAccount).then((val) => { res.send(val.toString()); }).catch((err) => { res.send("error" + err); });
            },
            "/SpotifySetVolume/:volume": function (req, res) {
                Spotify_1.Spotify.SpotifySetVolume(parseInt(req.params.volume), null, Spotify_1.Spotify.defaultAccount).then((val) => { res.send(val); }).catch((err) => { res.send("error" + err); });
            },
            "/SpotifyGetThumbnail": function (req, res) {
                Spotify_1.Spotify.SpotifyGetThumbnail(Spotify_1.Spotify.defaultAccount).then((val) => { res.type("jpeg"); res.send(val); }).catch((err) => { res.send("error" + err); });
            }
        }
    },
    "Lamp": {
        device: {
            name: "LampRest",
            functions: {},
            devices: {},
            public: false
        },
        functions: {},
        Rest: {
            "/LampToggle": function (req, res) {
                try {
                    if (websockets["lamp"] != null) {
                        for (var i = 0; i <= callbacks.length; i++) {
                            if (callbacks[i] == null) {
                                callbacks[i] = function (Return, callbackID) {
                                    //delete callbacks[callbackID];
                                    res.send(Return);
                                };
                                websockets["lamp"].send("{\"type\":\"command\",\"data\":\"toggle()\",\"parameters\":[1,\"self.callback(" + i + ",RETURN)\"]}");
                                return;
                            }
                        }
                    }
                    else {
                        console.log(Lib_1.Colors.FgGr + "Internal error:" + Lib_1.Colors.FgYe + " Lamp" + Lib_1.Colors.FgCy + " is not connected" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        res.send("error");
                    }
                }
                catch (err) {
                    console.log(err);
                }
            },
            "/LampOff": function (req, res) {
                try {
                    if (websockets["lamp"] != null) {
                        websockets["lamp"].send("{\"type\":\"command\",\"data\":\"turnoff()\",\"parameters\":[]}");
                        res.send("false");
                    }
                    else {
                        console.log(Lib_1.Colors.FgGr + "Internal error:" + Lib_1.Colors.FgYe + " Lamp" + Lib_1.Colors.FgCy + " is not connected" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        res.send("error");
                    }
                }
                catch (err) {
                    console.log(err);
                }
            },
            "/LampOn": function (req, res) {
                try {
                    if (websockets["lamp"] != null) {
                        websockets["lamp"].send("{\"type\":\"command\",\"data\":\"turnon()\",\"parameters\":[]}");
                        res.send("true");
                    }
                    else {
                        console.log(Lib_1.Colors.FgGr + "Internal error:" + Lib_1.Colors.FgYe + " Lamp" + Lib_1.Colors.FgCy + " is not connected" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        res.send("error");
                    }
                }
                catch (err) {
                    console.log(err);
                }
            },
            "/LampStatus": function (req, res) {
                try {
                    if (websockets["lamp"] != null) {
                        for (var i = 0; i < callbacks.length + 1; i++) {
                            if (callbacks[i] == null) {
                                callbacks[i] = function (Return, callbackID) {
                                    //delete callbacks[callbackID];
                                    res.send(Return);
                                };
                                websockets["lamp"].send("{\"type\":\"command\",\"data\":\"status()\",\"parameters\":[\"self.callback(" + i + ",RETURN)\"]}");
                                return;
                            }
                        }
                    }
                    else {
                        console.log(Lib_1.Colors.FgGr + "Internal error:" + Lib_1.Colors.FgYe + " Lamp" + Lib_1.Colors.FgCy + " is not connected" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
                        res.send("error");
                    }
                }
                catch (err) {
                    console.log(err);
                }
            }
        }
    }
};
//add localdevices to device list
Object.keys(localdevices).forEach((i) => {
    if (localdevices[i].device != null) {
        if (localdevices[i].device != undefined && devices.self.devices[localdevices[i].device.name.toLowerCase()] == null) {
            devices.self.devices[localdevices[i].device.name.toLowerCase()] = localdevices[i].device;
        }
        else {
            console.log(Lib_1.Colors.FgGr + "Internal error:" + Lib_1.Colors.FgRe + "localDevice " + Lib_1.Colors.FgGre + "\"" + localdevices[i].device != undefined ? localdevices[i].device.name : "" + "\"" + Lib_1.Colors.FgRe + " already exists" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R);
        }
    }
});
//add localdevices to rest
Object.keys(localdevices).forEach((i) => {
    if (localdevices[i].Rest != null) {
        Object.keys(localdevices[i].Rest).forEach((j) => {
            if ((typeof localdevices[i].Rest[j]) == "function") {
                app.get(j, function (req, res) {
                    try {
                        localdevices[i].Rest[j](req, res);
                    }
                    catch (err) {
                        console.log("err: " + err.stack + "  ln800");
                    }
                });
            }
            else {
                console.log(Lib_1.Colors.FgGr + "Internal error:" + Lib_1.Colors.FgCy + "localdevices" + Lib_1.Colors.FgGr + "[" + Lib_1.Colors.FgYe + i + Lib_1.Colors.FgGr + "]." + Lib_1.Colors.FgCy + "Rest" + Lib_1.Colors.FgGr + "[" + Lib_1.Colors.FgYe + j + Lib_1.Colors.FgGr + "]" + Lib_1.Colors.FgRe + " is not of type " + Lib_1.Colors.FgGre + " function" + Lib_1.Colors.FgGr + "." + Lib_1.Colors.R + Lib_1.Colors.R);
            }
        });
    }
});
//#endregion
var server = app.listen(8081, function () {
    //var host:string = server.address().address;
    var port = server.address().port;
    console.log(Lib_1.Colors.FgGr + "Public web execution page is running at http://" + (0, Lib_1.getIp)() + Lib_1.Colors.FgGr + ":" + Lib_1.Colors.FgYe + port + Lib_1.Colors.R);
});
