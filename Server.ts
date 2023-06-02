/* To-DO
 * Create GitHub!!
 * 
 * MAIN:
 * 
 * SIDE
 * 
 * device code for pi computer - runs on startup
 */
const WebSocket = require('ws') // npm install ws
const express = require("express"); // npm install express
const fs = require('fs');
import {Spotify} from "./Spotify";
import { cloneObject, getIp, assert, assertIsObject, assertIsString, Device, cmd, cmdData, command, Colors, printFakeFunction } from "./Lib"
console.clear();

var devices:{[key:string]:Device|null} = {
    "self": {
        name:"self",
        public:true,
        functions:{
            "authenticate"          :{name:"authenticate"          ,public:false,parameters:[{name:"username"  ,type:"string",nullable:false,public:false},{name:"password"          ,type:"string",nullable:false,public:false},{name:"createDevice"        ,type:"boolean",nullable:true ,public:false}]},
            "callback"              :{name:"callback"              ,public:false,parameters:[{name:"callback"  ,type:"number",nullable:false,public:false},{name:"returnVal"         ,type:"string",nullable:false,public:false}]},
            "subscribeconnection"   :{name:"subscribeConnection"   ,public:false,parameters:[{name:"deviceName",type:"string",nullable:false,public:false},{name:"callbackDeviceName",type:"string",nullable:false,public:false},{name:"callbackFunctionName",type:"string" ,nullable:false,public:false}]},
            "subscribedisconnection":{name:"subscribeDisconnection",public:false,parameters:[{name:"deviceName",type:"string",nullable:false,public:false},{name:"callbackDeviceName",type:"string",nullable:false,public:false},{name:"callbackFunctionName",type:"string" ,nullable:false,public:false}]},
        },
        "devices": {}
    }
};
var Accounts:Array<{[key:string]:string}> = [ {"username":"CamRS", "password":"Crs9503!"}, {"username":"SpotifyLogin", "password":"Password"}, {"username":"NanoLogin", "password":"Password"} ];
var pings:{[key:string]:boolean} = {};
var websockets:any = {};
var connectionSubscriptions:{[key:string]:Array<Array<string>>} = {};
var disconnectionSubscriptions:{[key:string]:Array<Array<string>>} = {};
var callbacks:Array<Function> = [];

function pingDevices() {
    //send every device a "ping" message
    pings = {};
    var keys:Array<string> = Object.keys(devices);
    for(var i:number = 1; i < keys.length; i++) {
        const key = keys[i];
        if (key == "self") continue;
        pings[key] = false;
        if (devices[key] != null && websockets[key] != null) {
            websockets[key].send("{\"type\":\"ping\", \"data\":\"" + key + "\"}");
        }
    }
    setTimeout(() => {
        //after 100ms see which of the devices responded with a pong
        var keys2:Array<string> = Object.keys(devices);
        for(var i:number = 0; i < keys2.length; i++) {
            const key = keys2[i];
            if (devices[key] != null && key != "self") {
                if (!pings[key]) {
                    //and if they didnt count them as disconnected and remove them from the database
                    if (websockets[key] != null) { websockets[key].close(); delete websockets[key]; }
                    var oldDevice:any = {public:true,name:key}
                    if (devices[key]) { oldDevice = devices[key]!;
                    delete devices[key]; }

                    //remove subscriptions made by that device
                    const connectKeys = Object.keys(connectionSubscriptions);
                    for (let i = 0; i < connectKeys.length; i++) {
                        const key = connectKeys[i];
                        const subs = connectionSubscriptions[key];
                        let numSubs = subs.length
                        for (let j = 0; j < subs.length; j++) {
                            if (devices[subs[j][0].toLowerCase()] != null && websockets[subs[j][0].toLowerCase()] != null) continue;
                            numSubs--; delete subs[j];
                        }
                        if (numSubs==0) delete connectionSubscriptions[key];
                        else connectionSubscriptions[key] = subs.filter((el:any)=>el!=null)
                    }
                    const disconnectKeys = Object.keys(disconnectionSubscriptions);
                    for (let i = 0; i < disconnectKeys.length; i++) {
                        const key = disconnectKeys[i];
                        const subs = disconnectionSubscriptions[key];
                        let numSubs = subs.length
                        for (let j = 0; j < subs.length; j++) {
                            if (devices[subs[j][0].toLowerCase()] != null && websockets[subs[j][0].toLowerCase()] != null) continue;
                            numSubs--; delete subs[j];
                        }
                        if (numSubs==0) delete disconnectionSubscriptions[key];
                        else disconnectionSubscriptions[key] = subs.filter((el:any)=>el!=null)
                    }

                    if (key.startsWith("web")) { continue; }// if its a browser made device, skip next steps
                    if (oldDevice.public) console.log(Colors.FgGray+"Device "+Colors.FgGreen+"\"" + oldDevice.name + "\""+Colors.FgGray+" disconnected."+Colors);

                    //send disconnection subscriptions
                    var DisconnSubs:any = disconnectionSubscriptions[key.toLowerCase()];
                    if (DisconnSubs != null && (typeof DisconnSubs) == "object" && Array.isArray(DisconnSubs)) {
                        for(var j:number = 0; j < DisconnSubs.length; j++) {
                            handleCommand(JSON.parse("{\"type\":\"command\",\"data\":{\"device\":\"" + DisconnSubs[j][0] + "\",\"function\":\"" + DisconnSubs[j][1] + "\",\"parameters\":[\"" + key + "\"]}}"));
                        }
                    }
                    var anyDisconnSubs:any = disconnectionSubscriptions["any"];
                    if (anyDisconnSubs != null && (typeof anyDisconnSubs) == "object" && Array.isArray(anyDisconnSubs)) {
                        for(var j:number = 0; j < anyDisconnSubs.length; j++) {
                            if (websockets[anyDisconnSubs[j][0]] != null) {
                                websockets[anyDisconnSubs[j][0]].send(JSON.stringify({
                                    type:"command",
                                    data:anyDisconnSubs[j][1] + "()",
                                    parameters:[key]
                                }));
                            }
                        }
                    }
                }
            }
        }
    }, 100);
}

const socketport:number = 42069;
var ws:any = new WebSocket.Server({ "port": socketport })
console.log(Colors.FgGray+"Websocket api is running at ws://"+ getIp() +Colors.FgGray+":"+Colors.FgYellow+ socketport +Colors.Reset);
setInterval(() => {
    pingDevices();//ping devices
}, 30*1000);//30 seconds
ws.on('connection', (websocket:any) => {
    //ping all devices to see figure out which one disconnected
    websocket.on('close', function (reasonCode:number, description:string) { pingDevices(); });
    websocket.on('message', (message:string) => {
        try {
            var msg:cmd = JSON.parse(message);
            if (msg.type == null) { console.log(Colors.FgGray+"Invalid command:"+Colors.FgRed+" message type is"+Colors.FgCyan+" null"+Colors.FgGray+"."+Colors.Reset); return;}
            //find example messages in Lib.ts
            switch(msg.type) {
                case "connection": {
                    //check if valid data
                    //needs to have either nested objects or functions to call
                    var connected:boolean = false;
                    if (msg.data != null && msg.data.name != null) {
                        function mapDevice(device:any, parentName?:string|null) {
                            var newDevice:any = {};
                            if ((typeof device.name) != "string") { console.log(Colors.FgGray+"invalid connection: "+((parentName!=null)?(Colors.FgCyan+parentName+Colors.FgGray+"."+Colors.Reset):(""))+Colors.FgCyan+"device"+Colors.FgGray+"."+Colors.Reset+Colors.FgCyan+"name "+Colors.FgRed+"is not a string"+Colors.FgGray+"."+Colors.Reset); return false; }
                            newDevice.name   = device.name;
                            try { if ((typeof device.public) == "string") device.public = JSON.parse(device.public);
                            } catch (err:any) { console.log(Colors.FgGray+"invalid connection: "+((parentName!=null)?(Colors.FgCyan+parentName+Colors.FgGray+"."+Colors.Reset):(""))+Colors.FgCyan+newDevice.name+Colors.FgGray+"."+Colors.Reset+Colors.FgCyan+"public "+Colors.FgRed+"is not a boolean"+Colors.FgGray+"."+Colors.Reset); return false; }
                            if ((typeof device.public) != "boolean" && device.public != null) { console.log(Colors.FgGray+"invalid connection: "+((parentName!=null)?(Colors.FgCyan+parentName+Colors.FgGray+"."+Colors.Reset):(""))+Colors.FgCyan+newDevice.name+Colors.FgGray+"."+Colors.Reset+Colors.FgCyan+"public "+Colors.FgRed+"is not a boolean"+Colors.FgGray+"."+Colors.Reset); return false; }
                            newDevice.public = ((device.public!=null)?device.public:true);

                            if (device.functions != null) {
                                if ((typeof device.functions) != "object") { console.log(Colors.FgGray+"invalid connection: "+((parentName!=null)?(Colors.FgCyan+parentName+Colors.FgGray+"."+Colors.Reset):(""))+Colors.FgCyan+newDevice.name+Colors.FgGray+"."+Colors.Reset+Colors.FgCyan+"functions "+Colors.FgRed+"is not an object"+Colors.FgGray+"."+Colors.Reset); return false; }
                                newDevice.functions = {};
                                function mapParameters(param:any,funcIndex:number|string,index:number) {
                                    if ((typeof param.name) != "string") { console.log(Colors.FgGray+"invalid connection: "+((parentName!=null)?(Colors.FgCyan+parentName+Colors.FgGray+"."+Colors.Reset):(""))+Colors.FgCyan+newDevice.name+Colors.FgGray+"."+Colors.Reset+Colors.FgCyan+"functions"+(((typeof funcIndex) == "number")?(Colors.FgGray+"["+Colors.FgYellow+funcIndex+Colors.FgGray+"]"):(Colors.FgGray+"["+Colors.FgGreen+"\""+funcIndex+"\""+Colors.FgGray+"]"))+Colors.FgGray+"."+Colors.Reset+Colors.FgCyan+"parameters"+Colors.FgGray+"["+Colors.FgYellow+index+Colors.FgGray+"]."+Colors.FgCyan+"name "+Colors.FgRed+"is not a string"+Colors.FgGray+"."+Colors.Reset); return false; }
                                    if ((typeof param.type) != "string") { console.log(Colors.FgGray+"invalid connection: "+((parentName!=null)?(Colors.FgCyan+parentName+Colors.FgGray+"."+Colors.Reset):(""))+Colors.FgCyan+newDevice.name+Colors.FgGray+"."+Colors.Reset+Colors.FgCyan+"functions"+(((typeof funcIndex) == "number")?(Colors.FgGray+"["+Colors.FgYellow+funcIndex+Colors.FgGray+"]"):(Colors.FgGray+"["+Colors.FgGreen+"\""+funcIndex+"\""+Colors.FgGray+"]"))+Colors.FgGray+"."+Colors.Reset+Colors.FgCyan+"parameters"+Colors.FgGray+"["+Colors.FgYellow+index+Colors.FgGray+"]."+Colors.FgCyan+"type "+Colors.FgRed+"is not a string"+Colors.FgGray+"."+Colors.Reset); return false; }
                                    param.type = param.type.toLowerCase();
                                    if (param.type != "string" && param.type != "number" && param.type != "bool" && param.type != "boolean") { console.log(Colors.FgGray+"invalid connection: "+((parentName!=null)?(Colors.FgCyan+parentName+Colors.FgGray+"."+Colors.Reset):(""))+Colors.FgCyan+newDevice.name+Colors.FgGray+"."+Colors.Reset+Colors.FgCyan+"functions"+(((typeof funcIndex) == "number")?(Colors.FgGray+"["+Colors.FgYellow+funcIndex+Colors.FgGray+"]"):(Colors.FgGray+"["+Colors.FgGreen+"\""+funcIndex+"\""+Colors.FgGray+"]"))+Colors.FgGray+"."+Colors.Reset+Colors.FgCyan+"parameters"+Colors.FgGray+"["+Colors.FgYellow+index+Colors.FgGray+"]."+Colors.FgCyan+"type "+Colors.FgRed+"is not a valid type"+Colors.FgGray+"."+Colors.Reset); return false; }
                                    try { if ((typeof param.nullable) == "string") param.nullable = JSON.parse(param.nullable);
                                    } catch (err:any) { console.log(Colors.FgGray+"invalid connection: "+((parentName!=null)?(Colors.FgCyan+parentName+Colors.FgGray+"."+Colors.Reset):(""))+Colors.FgCyan+newDevice.name+Colors.FgGray+"."+Colors.Reset+Colors.FgCyan+"functions"+(((typeof funcIndex) == "number")?(Colors.FgGray+"["+Colors.FgYellow+funcIndex+Colors.FgGray+"]"):(Colors.FgGray+"["+Colors.FgGreen+"\""+funcIndex+"\""+Colors.FgGray+"]"))+Colors.FgGray+"."+Colors.Reset+Colors.FgCyan+"parameters"+Colors.FgGray+"["+Colors.FgYellow+index+Colors.FgGray+"]."+Colors.FgCyan+"nullable "+Colors.FgRed+"is not a boolean"+Colors.FgGray+"."+Colors.Reset); return false; }
                                    if ((typeof param.nullable) != "boolean") { console.log(Colors.FgGray+"invalid connection: "+((parentName!=null)?(Colors.FgCyan+parentName+Colors.FgGray+"."+Colors.Reset):(""))+Colors.FgCyan+newDevice.name+Colors.FgGray+"."+Colors.Reset+Colors.FgCyan+"functions"+(((typeof funcIndex) == "number")?(Colors.FgGray+"["+Colors.FgYellow+funcIndex+Colors.FgGray+"]"):(Colors.FgGray+"["+Colors.FgGreen+"\""+funcIndex+"\""+Colors.FgGray+"]"))+Colors.FgGray+"."+Colors.Reset+Colors.FgCyan+"parameters"+Colors.FgGray+"["+Colors.FgYellow+index+Colors.FgGray+"]."+Colors.FgCyan+"nullable "+Colors.FgRed+"is not a boolean"+Colors.FgGray+"."+Colors.Reset); return false; }
                                    var out:any = {"name":param.name,"type":param.type,"nullable":param.nullable||false}
                                    if (param.defaultValue != null) out.defaultValue = param.defaultValue;
                                    return out;
                                }
                                function mapFunction(func:any,index:number|string) {
                                    var newFunc:any = {};
                                    if ((typeof device.name) != "string") { console.log(Colors.FgGray+"invalid connection: "+((parentName!=null)?(Colors.FgCyan+parentName+Colors.FgGray+"."+Colors.Reset):(""))+Colors.FgCyan+newDevice.name+Colors.FgGray+"."+Colors.Reset+Colors.FgCyan+"functions"+(((typeof index) == "number")?(Colors.FgGray+"["+Colors.FgYellow+index+Colors.FgGray+"]"):(Colors.FgGray+"["+Colors.FgGreen+"\""+index+"\""+Colors.FgGray+"]"))+Colors.FgGray+"."+Colors.Reset+Colors.FgCyan+"name "+Colors.FgRed+"is not a string"+Colors.FgGray+"."+Colors.Reset); return false; }
                                    newFunc.name = func.name;
                                    try { if ((typeof func.public) == "string") func.public = JSON.parse(func.public);
                                    } catch (err:any) { console.log(Colors.FgGray+"invalid connection: "+((parentName!=null)?(Colors.FgCyan+parentName+Colors.FgGray+"."+Colors.Reset):(""))+Colors.FgCyan+newDevice.name+Colors.FgGray+"."+Colors.Reset+Colors.FgCyan+"functions"+(((typeof index) == "number")?(Colors.FgGray+"["+Colors.FgYellow+index+Colors.FgGray+"]"):(Colors.FgGray+"["+Colors.FgGreen+"\""+index+"\""+Colors.FgGray+"]"))+Colors.FgGray+"."+Colors.Reset+Colors.FgCyan+"public "+Colors.FgRed+"is not a boolean"+Colors.FgGray+"."+Colors.Reset); return false; }
                                    if ((typeof func.public) != "boolean" && func.public != null) { console.log(Colors.FgGray+"invalid connection: "+((parentName!=null)?(Colors.FgCyan+parentName+Colors.FgGray+"."+Colors.Reset):(""))+Colors.FgCyan+newDevice.name+Colors.FgGray+"."+Colors.Reset+Colors.FgCyan+"functions"+(((typeof index) == "number")?(Colors.FgGray+"["+Colors.FgYellow+index+Colors.FgGray+"]"):(Colors.FgGray+"["+Colors.FgGreen+"\""+index+"\""+Colors.FgGray+"]"))+Colors.FgGray+"."+Colors.Reset+Colors.FgCyan+"public "+Colors.FgRed+"is not a boolean"+Colors.FgGray+"."+Colors.Reset); return false; }
                                    newFunc.public = ((func.public!=null)?func.public:true);
                                    if ((typeof func.parameters) != "object" || !Array.isArray(func.parameters)) { console.log(Colors.FgGray+"invalid connection: "+((parentName!=null)?(Colors.FgCyan+parentName+Colors.FgGray+"."+Colors.Reset):(""))+Colors.FgCyan+newDevice.name+Colors.FgGray+"."+Colors.Reset+Colors.FgCyan+"functions"+(((typeof index) == "number")?(Colors.FgGray+"["+Colors.FgYellow+index+Colors.FgGray+"]"):(Colors.FgGray+"["+Colors.FgGreen+"\""+index+"\""+Colors.FgGray+"]"))+Colors.FgGray+"."+Colors.Reset+Colors.FgCyan+"parameters "+Colors.FgRed+"is not an object"+Colors.FgGray+"."+Colors.Reset); return false; }
                                    newFunc.parameters = [];
                                    for (let i = 0; i < func.parameters.length; i++) {
                                        const parameter = func.parameters[i];
                                        const tmp:any = mapParameters(parameter,index,i);
                                        if (tmp == false) { return false; }
                                        newFunc.parameters.push(tmp);
                                    }
                                    return newFunc
                                }
                                if (Array.isArray(device.functions)) {
                                    for (let i = 0; i < device.functions.length; i++) {
                                        const func:any = device.functions[i];
                                        const tmp:any = mapFunction(func,i);
                                        if (tmp == false) { return false; }
                                        else newDevice.functions[func.name.toLowerCase()] = tmp;
                                    }
                                } else {
                                    const funcKeys:string[] = Object.keys(device.functions);
                                    for (let i = 0; i < funcKeys.length; i++) {
                                        const func:any = device.functions[funcKeys[i]];
                                        const tmp:any = mapFunction(func,funcKeys[i]);
                                        if (tmp == false) { return false; }
                                        else newDevice.functions[func.name.toLowerCase()] = tmp;
                                    }
                                }
                            }
                            if (device.devices != null) {
                                if ((typeof device.devices) != "object") { console.log(Colors.FgGray+"invalid connection: "+((parentName!=null)?(Colors.FgCyan+parentName+Colors.FgGray+"."+Colors.Reset):(""))+Colors.FgCyan+newDevice.name+Colors.FgGray+"."+Colors.Reset+Colors.FgCyan+"devices "+Colors.FgRed+"is not an object"+Colors.FgGray+"."+Colors.Reset); return false; }
                                newDevice.devices = {};
                                if (Array.isArray(device.devices)) {
                                    for (let i = 0; i < device.devices.length; i++) {
                                        const childDevice:any = device.devices[i];
                                        if ((typeof childDevice.name) != "string") { console.log(Colors.FgGray+"invalid connection: "+((parentName!=null)?(Colors.FgCyan+parentName+Colors.FgGray+"."+Colors.Reset):(""))+Colors.FgCyan+device.name+Colors.FgGray+"."+Colors.Reset+Colors.FgCyan+"device"+Colors.FgGray+"."+Colors.Reset+Colors.FgCyan+"name "+Colors.FgRed+"is not a string"+Colors.FgGray+"."+Colors.Reset); return false; }
                                        const tmp:any = mapDevice(childDevice, ((parentName!=null)?(device+"."):(""))+device.name);
                                        if (tmp == false) { return false; }
                                        else newDevice.devices[childDevice.name.toLowerCase()] = tmp;
                                    }
                                } else {
                                    const funcKeys:string[] = Object.keys(device.devices);
                                    for (let i = 0; i < funcKeys.length; i++) {
                                        const childDevice:any = device.devices[funcKeys[i]];
                                        if ((typeof childDevice.name) != "string") { console.log(Colors.FgGray+"invalid connection: "+((parentName!=null)?(Colors.FgCyan+parentName+Colors.FgGray+"."+Colors.Reset):(""))+Colors.FgCyan+device.name+Colors.FgGray+"."+Colors.Reset+Colors.FgCyan+"device"+Colors.FgGray+"."+Colors.Reset+Colors.FgCyan+"name "+Colors.FgRed+"is not a string"+Colors.FgGray+"."+Colors.Reset); return false; }
                                        const tmp:any = mapDevice(childDevice, ((parentName!=null)?(parentName+"."):(""))+device.name);
                                        if (tmp == false) { return false; }
                                        else newDevice.devices[childDevice.name.toLowerCase()] = tmp;
                                    }
                                }
                            }
                            if ((device.devices == null || Object.keys(device.devices).length <= 0) &&
                                (device.functions == null || Object.keys(device.functions).length <= 0)
                            ) { console.log(Colors.FgGray+"invalid connection: "+Colors.FgRed+"pointless device "+Colors.FgGreen+"\"" + ((parentName!=null)?(Colors.FgCyan+parentName+Colors.FgGray+"."+Colors.Reset):(""))+Colors.FgCyan+device.name+Colors.FgGreen+"\""+Colors.FgGray+"."+Colors.Reset); return false; }// status code 418
                            return newDevice;
                        }
                        const tmp:any = mapDevice(msg.data);
                        if (tmp != false) {
                            msg.data = tmp;
                            if (websockets[msg.data.name.toLowerCase()] == null && devices[msg.data.name.toLowerCase()] == null) {
                                //add device data to list
                                devices[msg.data.name.toLowerCase()] = msg.data;
                                //add websocket connection to list
                                websockets[msg.data.name.toLowerCase()] = websocket;
                                //response
                                websocket.send("{\"reply\" : \"succes\"" + (msg.id != null ? ", \"id\" : " + msg.id : "") + "}");
                                if (msg.data.public) console.log(Colors.FgGray+"Device "+Colors.FgGreen+"\"" + msg.data.name + "\""+Colors.FgGray+" conneced"+Colors.FgGray+"."+Colors.Reset);
                                connected = true;

                                if (msg.data.name.toLowerCase() == "nanopi") {
                                    handleCommand("{\"type\":\"command\",\"data\":{\"device\":\"nanopi\",\"function\":\"Subscribe\",\"parameters\":[1,\"self.spotify\",\"skipprevious\",\"\\\""+Spotify.defaultAccount+"\\\"\"]}}");
                                    handleCommand("{\"type\":\"command\",\"data\":{\"device\":\"nanopi\",\"function\":\"Subscribe\",\"parameters\":[2,\"self.spotify\",\"toggle\",\"\\\""+Spotify.defaultAccount+"\\\"\"]}}");
                                    handleCommand("{\"type\":\"command\",\"data\":{\"device\":\"nanopi\",\"function\":\"Subscribe\",\"parameters\":[3,\"self.spotify\",\"skipnext\",\"\\\""+Spotify.defaultAccount+"\\\"\"]}}");
                                }
                                if (msg.data.name.toLowerCase() == "controller") {
                                    handleCommand("{\"type\":\"command\",\"data\":{\"device\":\"controller\",\"function\":\"Subscribe\",\"parameters\":[7,\"self.spotify\",\"skipprevious\",\"\\\""+Spotify.defaultAccount+"\\\"\"]}}");
                                    handleCommand("{\"type\":\"command\",\"data\":{\"device\":\"controller\",\"function\":\"Subscribe\",\"parameters\":[6,\"self.spotify\",\"toggle\",\"\\\""+Spotify.defaultAccount+"\\\"\"]}}");
                                    handleCommand("{\"type\":\"command\",\"data\":{\"device\":\"controller\",\"function\":\"Subscribe\",\"parameters\":[5,\"self.spotify\",\"skipnext\",\"\\\""+Spotify.defaultAccount+"\\\"\"]}}");
                                }
                                if (connectionSubscriptions[msg.data.name.toLowerCase()] != null && (typeof connectionSubscriptions[msg.data.name.toLowerCase()]) == "object" && Array.isArray(connectionSubscriptions[msg.data.name.toLowerCase()])) {
                                    for(var i:number = 0; i < connectionSubscriptions[msg.data.name.toLowerCase()].length; i++) {
                                        handleCommand(JSON.parse("{\"type\":\"command\",\"data\":{\"device\":\"" + connectionSubscriptions[msg.data.name.toLowerCase()][i][0] + "\",\"function\":\"" + connectionSubscriptions[msg.data.name.toLowerCase()][i][1] + "\",\"parameters\":[\"" + msg.data.name + "\"]}}"));
                                    }
                                }
                                if (connectionSubscriptions["any"] != null && (typeof connectionSubscriptions["any"]) == "object" && Array.isArray(connectionSubscriptions["any"])) {
                                    for(var i:number = 0; i < connectionSubscriptions["any"].length; i++) {
                                        if (websockets[connectionSubscriptions["any"][i][0]] != null) {
                                            websockets[connectionSubscriptions["any"][i][0]].send(JSON.stringify({
                                                type:"command",
                                                data:connectionSubscriptions["any"][i][1] + "()",
                                                parameters:[msg.data.name,msg.data]
                                            }));
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (!connected) {
                        if (msg.data == null || msg.data.name == null) { console.log(Colors.FgGray+"invalid connection from "+Colors.FgGreen+"\"unknown\""+Colors.FgGray+"."+Colors.Reset); }
                    }
                    break;
                }
                case "command": {
                    //console.log("command: \n" + message + "\n");
                    if (msg.data != null) {
                        if (msg.data.device     == null) { console.log(msg); console.log(Colors.FgGray+"Invalid command:"+Colors.FgGray+" Command"+Colors.FgRed+" missing target device"+Colors.FgGray+"."+Colors.Reset); return; }
                        if (msg.data.function   == null) { console.log(msg); console.log(Colors.FgGray+"Invalid command:"+Colors.FgGray+" Command"+Colors.FgRed+" missing target function"+Colors.FgGray+"."+Colors.Reset); return; }
                        if (msg.data.parameters == null) { console.log(msg); console.log(Colors.FgGray+"Invalid command:"+Colors.FgGray+" Command"+Colors.FgRed+" missing function parameters"+Colors.FgGray+"."+Colors.Reset); return; }

                        handleCommand(msg as command, websocket);
                    }
                    break;
                }
                case "pong": {
                    //when receiving back a ping call the callback after error checking
                    if (msg.data != null && (typeof msg.data) == "string") {
                        pings[msg.data] = true;
                    }
                    break;
                }
                case "ping": {
                    if (msg.data != null) {
                        websocket.send("{\"type\":\"pong\",\"data\":\"" + msg.data + "\"}");
                    } else if (msg.id != null) {
                        websocket.send("{\"type\":\"pong\",\"id\":\"" + msg.id + "\"}");
                    }
                    break;
                }
                default: { console.log(Colors.FgGray+"Invalid command:"+Colors.FgRed+" Invalid message type"+Colors.FgGreen+" \""+msg.type+"\""+Colors.FgGray+"."+Colors.Reset); }
            }
        } catch (err:any) { console.log(message); console.log(Colors.FgGray+"Invalid command:"+Colors.FgRed+" Unable to parse json of message"+Colors.FgGray+"."+Colors.Reset); console.log(err); }
    });
});
function handleCommand(msg:string|command, websocket?:any) {
    if ((typeof msg) == "string") {
        assertIsString(msg);
        try {
            var json:command = JSON.parse(msg) as command;
            if (json != null) {
                handleCommand(json);
            } else { console.log(Colors.FgGray+"Invalid command:"+Colors.FgRed+" Command is"+Colors.FgCyan+" null"+Colors.FgGray+"."+Colors.Reset); return; }
        } catch (err:any) { console.log(err.stack + "    ln233"); }
    } else if ((typeof msg) == "object"){
        assert(typeof msg == "object")
        if (msg.data.device.split(".")[0].toLowerCase() == "self") {
            var _switch:{[key:string]:Function} = {
                "authenticate()": function (parameters:[string,string,string|boolean]) { //used for web execution page
                    if (parameters.length < 2                       ) { console.log(Colors.FgGray+"Invalid command:"+Colors.FgGreen+" \""+printFakeFunction("self.authenticate"          ,parameters)+Colors.FgGreen+"\""+Colors.FgGray+"."+Colors.Reset); return; }
                    if (parameters[0] == null || parameters[0] == "") { console.log(Colors.FgGray+"Invalid command:"+Colors.FgGreen+" \""+printFakeFunction("self.authenticate"          ,parameters)+Colors.FgGreen+"\""+Colors.FgGray+"."+Colors.Reset); return; }
                    if (parameters[1] == null || parameters[1] == "") { console.log(Colors.FgGray+"Invalid command:"+Colors.FgGreen+" \""+printFakeFunction("self.authenticate"          ,parameters)+Colors.FgGreen+"\""+Colors.FgGray+"."+Colors.Reset); return; }
                    let validAccount:boolean = false
                    for (let i = 0; i < Accounts.length; i++) {
                        if (Accounts[i].username == parameters[0] && Accounts[i].password == parameters[1]) {
                            validAccount = true;
                            break;
                        }
                    }
                    if (!validAccount) {
                        var string:string|null = null
                        if (parameters[0].toLowerCase() == "root"  && parameters[1].toLowerCase() == "root"  ||
                            parameters[1].toLowerCase() == "admin" && parameters[0].toLowerCase() == "admin" ||
                            parameters[1].toLowerCase() == "password"     ||
                            parameters[1].toLowerCase() == "1234"         ||
                            parameters[1].toLowerCase() == "password1234"
                        ) { string = "Nice try."; } else {
                            var hints:Array<string> = [ "hint: html", "hint: It's not that.", "hint: Try something else.", "Maybe next time.", "You really thought it would be that?" ];
                            string = hints[Math.round(Math.random()*(hints.length-1))];
                        }
                        websocket.send(JSON.stringify({type:"authentication",status:false,data:string, id:msg.id}));
                        return
                    }

                    //login is valid
                    var tmp:Array<any>|{[key:string|number]:any}|null = cloneObject(devices);
                    assert(tmp != null && typeof tmp == "object");
                    var devicesClone:{ [key:string]:Device|null } = tmp! as { [key:string]:Device|null };
                    var callback:Function = function(objIn:{ [key:string]:Device|null }) {
                        var obj:any = cloneObject(objIn);
                        Object.keys(obj!).forEach((i) => {
                            if (typeof obj![i] == "object" && obj![i] != null) {
                                if (obj![i].devices != null) { obj![i].devices = callback(obj![i].devices); }
                                Object.keys(obj![i].functions).forEach((j) => {
                                    if (obj![i].functions[j].public == false || obj![i].functions[j].public == "false" || obj![i].name.includes("web")) {
                                        delete obj![i].functions[j];
                                    }
                                });
                            }
                        });
                        return obj!;
                    }
                    devicesClone = callback(devicesClone);
                    if (parameters[2] != null && (((typeof parameters[2]) == "boolean" && parameters[2] == true) || ((typeof parameters[2]) == "string" && (parameters[2] as string).toLowerCase() == "true"))) {
                        setTimeout(() => {
                            for(var i = 0; i < 10; i++) {
                                if (devices["web" + i] == null) {
                                    websocket.send(JSON.stringify({type:"authentication", status:true, deviceId:("web"+i), data:devicesClone, id:msg.id}))
                                    websockets["web" + i] = websocket;
                                    devices["web" + i] = {
                                        name: "web" + i,
                                        functions:{
                                            "connect":{
                                                name:"connect",
                                                parameters:[ {name:"device",type:"string",nullable:false} ],
                                                public:true
                                            },
                                            "disconnect":{
                                                name:"disconnect",
                                                parameters:[ {name:"device",type:"string",nullable:false} ],
                                                public:true
                                            }
                                        },
                                        devices: {}, public:false
                                    }
                                    break;
                                }
                            }
                        }, 125);
                    } else {
                        websocket.send(JSON.stringify({type:"authentication", status:true, data:devicesClone, id:msg.id}))
                    }
                },
                "callback()": function (parameters:Array<number|string>) {
                    if (parameters.length < 2                       ) { console.log(Colors.FgGray+"Invalid command:"+Colors.FgGreen+" \""+printFakeFunction("self.callback"              ,parameters)+Colors.FgGreen+"\""+Colors.FgGray+"."+Colors.Reset); return; }
                    if (parameters[0] == null || parameters[0] == "") { console.log(Colors.FgGray+"Invalid command:"+Colors.FgGreen+" \""+printFakeFunction("self.callback"              ,parameters)+Colors.FgGreen+"\""+Colors.FgGray+"."+Colors.Reset); return; }
                    var callbackNum:number = Number(parameters[0]);
                    if (Number.isNaN(callbackNum)                   ) { console.log(Colors.FgGray+"Invalid command:"+Colors.FgGreen+" \""+printFakeFunction("self.callback"              ,parameters)+Colors.FgGreen+"\""+Colors.FgGray+"."+Colors.Reset); return; }
                    if (parameters[1] == null || parameters[1] == "") { console.log(Colors.FgGray+"Invalid command:"+Colors.FgGreen+" \""+printFakeFunction("self.callback"              ,parameters)+Colors.FgGreen+"\""+Colors.FgGray+"."+Colors.Reset); return; }

                    callbacks[callbackNum](parameters[1],callbackNum);
                    delete callbacks[callbackNum];
                },
                "subscribeconnection()": function (parameters:[string,string,string]) {
                    if (parameters.length < 3                       ) { console.log(Colors.FgGray+"Invalid command:"+Colors.FgGreen+" \""+printFakeFunction("self.subscribeconnection"   ,parameters)+Colors.FgGreen+"\""+Colors.FgGray+"."+Colors.Reset); return; }
                    if (parameters[0] == null || parameters[0] == "") { console.log(Colors.FgGray+"Invalid command:"+Colors.FgGreen+" \""+printFakeFunction("self.subscribeconnection"   ,parameters)+Colors.FgGreen+"\""+Colors.FgGray+"."+Colors.Reset); return; }
                    if (parameters[1] == null || parameters[1] == "") { console.log(Colors.FgGray+"Invalid command:"+Colors.FgGreen+" \""+printFakeFunction("self.subscribeconnection"   ,parameters)+Colors.FgGreen+"\""+Colors.FgGray+"."+Colors.Reset); return; }
                    if (parameters[2] == null || parameters[2] == "") { console.log(Colors.FgGray+"Invalid command:"+Colors.FgGreen+" \""+printFakeFunction("self.subscribeconnection"   ,parameters)+Colors.FgGreen+"\""+Colors.FgGray+"."+Colors.Reset); return; }

                    const deviceName = parameters[0].toLowerCase();
                    if (websockets[deviceName] == null) {
                        connectionSubscriptions[deviceName] = connectionSubscriptions[deviceName]||[];
                        connectionSubscriptions[deviceName].push([parameters[1],parameters[2]]);
                    } else {// device is already connected
                        handleCommand(JSON.parse("{\"type\":\"command\",\"data\":{\"device\":\"" + parameters[1] + "\",\"function\":\"" + parameters[2] + "\",\"parameters\":[\"" + parameters[0] + "\"]}}"));
                    }
                },
                "subscribedisconnection()": function (parameters:[string,string,string]) {
                    if (parameters.length < 3                       ) { console.log(Colors.FgGray+"Invalid command:"+Colors.FgGreen+" \""+printFakeFunction("self.subscribedisconnection"   ,parameters)+Colors.FgGreen+"\""+Colors.FgGray+"."+Colors.Reset); return; }
                    if (parameters[0] == null || parameters[0] == "") { console.log(Colors.FgGray+"Invalid command:"+Colors.FgGreen+" \""+printFakeFunction("self.subscribedisconnection"   ,parameters)+Colors.FgGreen+"\""+Colors.FgGray+"."+Colors.Reset); return; }
                    if (parameters[1] == null || parameters[1] == "") { console.log(Colors.FgGray+"Invalid command:"+Colors.FgGreen+" \""+printFakeFunction("self.subscribedisconnection"   ,parameters)+Colors.FgGreen+"\""+Colors.FgGray+"."+Colors.Reset); return; }
                    if (parameters[2] == null || parameters[2] == "") { console.log(Colors.FgGray+"Invalid command:"+Colors.FgGreen+" \""+printFakeFunction("self.subscribedisconnection"   ,parameters)+Colors.FgGreen+"\""+Colors.FgGray+"."+Colors.Reset); return; }

                    const deviceName = parameters[0].toLowerCase();
                    disconnectionSubscriptions[deviceName] = disconnectionSubscriptions[deviceName]||[];
                    disconnectionSubscriptions[deviceName].push([parameters[1],parameters[2]]);
                }
            }
            Object.keys(localdevices).forEach((i) => {
                var temp:{[key:string]:Function} = Object.assign({}, _switch, localdevices[i].functions);
                _switch = temp;
            });
            
            var nm:string = (msg.data.device.includes(".") ? ((msg.data.device.substring(5)).toLowerCase()+".") : "") + msg.data.function.toLowerCase() + "()"
            if (_switch[nm] != null) {
                _switch[nm](msg.data.parameters, websocket);
            } else { console.log(Colors.FgGray+"Invalid command:"+Colors.FgRed+" Command"+Colors.FgGreen+" \""+nm+"\""+Colors.FgRed+" not found"+Colors.FgGray+"."+Colors.Reset); return; }
        } else {
            var lst:Array<boolean|string|{[key:string]:string}> = findFunction(devices,msg.data);
            if (lst[0] != false) {
                if (websockets[websocket] != null) {// console.log("sent:  " + message);
                    websocket = lst[0];
                    assertIsString(lst[1]);
                    var message:string = lst[1];
                    websockets[websocket].send(message);
                } else {
                    console.log(Colors.FgGray+"Invalid command:"+Colors.FgRed+" Device"+Colors.FgGreen+" \""+websocket+"\""+Colors.FgRed+" not connected"+Colors.FgGray+"."+Colors.Reset);
                }
            } else console.log(msg.data);
        }
    } else { console.log(Colors.FgGray+"Internal error:"+Colors.FgYellow+" Message"+Colors.FgRed+" is not an object"+Colors.FgGray+"."+Colors.Reset); }
}
function findFunction(list:{[key:string]:Device|null},data:cmdData,type?:number) : Array<boolean|string|{[key:string]:string}>{
    if (list != null && (typeof list) == "object" && !Array.isArray(list) && data != null) {
        var deviceName:string = data.device;
        if (!data.device.includes(".")) {
            // if there is only one level deep, find it and its function, and call it
            const device:Device = list[deviceName.toLowerCase()]!;
            if ((device != null && Object.keys(device.functions).length > 0) && (device.functions[data.function.toLowerCase()] != null)) {
                const funcParams:{//parameter
                    name:string
                    type:string
                    nullable?:boolean
                    public?:boolean
                    defaultValue?:string
                }[] = device.functions[data.function.toLowerCase()]!.parameters;
                var condition:boolean = true;
                var failIndex:number = -1;
                var got:string = "";
                for (var i:number = 0; i < funcParams.length; i++) {
                    // check that parameter type matches expected type
                    if (data.parameters[i] == null || data.parameters[i] == "null") {
                        if (funcParams[i].nullable == true) {
                            if (data.parameters[i] == "null") { data.parameters[i] = null; } continue;// valid
                        } else { condition = false; failIndex=i; got="null"; break; } // invalid
                    } else if ((typeof data.parameters[i]) == "number" || (typeof data.parameters[i]) == "bigint") {
                        if (funcParams[i].type == "number") continue;// valid
                        else { condition = false; failIndex=i; got="number"; break; } // invalid
                    } else if ((typeof data.parameters[i]) == "boolean") {
                        if (funcParams[i].type == "bool" || funcParams[i].type == "boolean") continue;// valid
                        else { condition = false; failIndex=i; got="boolean"; break; } // invalid
                    } else if ((typeof data.parameters[i]) == "string") {
                        if (funcParams[i].type == "string") continue;// valid
                        else {
                            try {
                                assertIsString(data.parameters[i]);
                                var parsed:any = JSON.parse(data.parameters[i] as string);
                                if ((typeof parsed) == "number" || (typeof parsed) == "bigint") {
                                    if (funcParams[i].type == "number") continue;// valid
                                    else { condition = false; failIndex=i; got="number"; break; } // invalid
                                } else if ((typeof parsed) == "boolean") {
                                    if (funcParams[i].type == "bool" || funcParams[i].type == "boolean") continue;// valid
                                    else { condition = false; failIndex=i; got="boolean"; break; } // invalid
                                }
                            } catch (err:any) { condition = false; failIndex=i; got="error"; break; }// invalid
                        }
                    }
                }
                if (!condition) {
                    console.log(Colors.FgGray+"Invalid command:"+Colors.Reset+" Found function but"+Colors.FgRed+" parameter types do not match"+Colors.FgGray+"."+Colors.Reset);
                    console.log(Colors.FgGray+"parameter"+Colors.FgYellow+"#"+failIndex+Colors.FgGray+", expected "+Colors.FgGreen+type+Colors.FgGray+" but got "+Colors.FgGreen+got+Colors.FgGray+"."+Colors.Reset);
                    return [false];
                }
                if (type == 2) {
                    return [{ type : "command", data : data.function + "()", "parameters" : JSON.stringify(data.parameters) }];
                } else if (type == null || type == 1) {
                    return [deviceName.toLowerCase(), "{\"type\":\"command\",\"data\":\"" + data.function + "()\", \"parameters\":" + JSON.stringify(data.parameters) + "}"];
                }
            } else {
                if (device == null) {
                    console.log(Colors.FgGray+"Invalid command:"+Colors.FgRed+" Device"+Colors.FgGreen+" \""+deviceName+"\""+Colors.FgRed+" not found"+Colors.FgGray+"."+Colors.Reset);
                } else if (Object.keys(device.functions).length <= 0 || device.functions[data.function.toLowerCase()] == null) {
                    console.log(Colors.FgGray+"Invalid command:"+Colors.FgRed+" Device"+Colors.FgGreen+" \""+deviceName+"\""+Colors.FgRed+" does not contain function"+Colors.FgGreen+" \"" + data.function + "\""+Colors.FgGray+"."+Colors.Reset);
                }
                return [false];
            }
        } else {
            // if there is more than one call the function recursively untill it finds the data it was looking for, returning the first it finds
            const deviceNameSplit:string[] = deviceName.split(".");
            var shift:string = deviceNameSplit.shift()!.toLowerCase();//get string between beginning and first dot
            if (list[shift] != null && Object.keys(list[shift]!.devices!).length > 0) {
                var out:boolean|string|{[key:string]:string} = findFunction(list[shift]!.devices!, {device:deviceNameSplit.join("."),function:data.function,parameters:data.parameters}, 2)[0];
                if (out != false) {
                    const message:{[key:string]:string} = out as {[key:string]:string};
                    assertIsObject(message);
                    message.data = shift + "." + message.data;
                    if (type==2) return [message]; else return [shift, JSON.stringify(message)];
                } else {
                    return [false];
                }
            } else {
                if (list[shift] == null) {
                    console.log(Colors.FgGray+"Invalid command:"+Colors.FgRed+" Device"+Colors.FgGreen+" \""+shift+"\""+Colors.FgRed+" not found"+Colors.FgGray+"."+Colors.Reset);
                } else if (Object.keys(list[shift]!.devices!).length <= 0) {
                    console.log(Colors.FgGray+"Invalid command:"+Colors.FgRed+" Device"+Colors.FgGreen+" \""+shift+"\""+Colors.FgRed+" does not have child devices"+Colors.FgGray+"."+Colors.Reset);
                } else {
                    console.log("weird error ln531");
                }
                return [false];
            }
        }
    } else {
        if (list == null) {
            console.log(Colors.FgGray+"Internal error: list"+Colors.FgRed+" is"+Colors.FgCyan+" null"+Colors.FgGray+"."+Colors.Reset);
        } else if ((typeof list) != "object") {
            console.log(Colors.FgGray+"Internal error: list"+Colors.FgRed+" is not an object"+Colors.FgGray+"."+Colors.Reset);
        } else if (Array.isArray(list)) {
            console.log(Colors.FgGray+"Internal error: list"+Colors.FgRed+" is an array"+Colors.FgGray+"."+Colors.Reset);
        } else {// data == null
            console.log(Colors.FgGray+"Internal error: data"+Colors.FgRed+" is"+Colors.FgCyan+" null"+Colors.FgGray+"."+Colors.Reset);
        }
        return [false];
    }
    return [false];//should not occur
}

var app:any = express();
app.get("/", function (req:any, res:any) {
	res.redirect("/index.html");
});
["/index.html","/index.js","/index.css","/favicon.ico","/favicon.png"].forEach((i) => {
    app.get(i, function (req:any, res:any) {
        res.sendFile(__dirname + "/Webserver" + i, "utf8");
    });
});
//#region LocalDevices

interface LocalDevice{
    device:Device,
    functions:{ [key:string]:Function },
    Rest:{ [key:string]:Function }
}
var localdevices:{ [key:string]:LocalDevice } = {
    "Spotify":{
        device:{
            name:"Spotify",
            functions:{
                "authenticate":{name:"Authenticate",parameters:[                                                                                                                                              ],public:true},
                "play"        :{name:"Play"        ,parameters:[{name:"link"  ,type:"string",nullable:true ,defaultValue:""  },{name:"device",type:"string",nullable:true,defaultValue:Spotify.defaultAccount}],public:true},
                "pause"       :{name:"Pause"       ,parameters:[                                                               {name:"device",type:"string",nullable:true,defaultValue:Spotify.defaultAccount}],public:true},
                "skipnext"    :{name:"SkipNext"    ,parameters:[                                                               {name:"device",type:"string",nullable:true,defaultValue:Spotify.defaultAccount}],public:true},
                "skipprevious":{name:"SkipPrevious",parameters:[                                                               {name:"device",type:"string",nullable:true,defaultValue:Spotify.defaultAccount}],public:true},
                "toggle"      :{name:"Toggle"      ,parameters:[                                                               {name:"device",type:"string",nullable:true,defaultValue:Spotify.defaultAccount}],public:true},
                "volumeup"    :{name:"VolumeUp"    ,parameters:[{name:"amount",type:"number",nullable:false,defaultValue:"10"},{name:"device",type:"string",nullable:true,defaultValue:Spotify.defaultAccount}],public:true},
                "volumedown"  :{name:"VolumeDown"  ,parameters:[{name:"amount",type:"number",nullable:false,defaultValue:"10"},{name:"device",type:"string",nullable:true,defaultValue:Spotify.defaultAccount}],public:true},
                "setvolume"   :{name:"SetVolume"   ,parameters:[{name:"volume",type:"number",nullable:false,defaultValue:"50"},{name:"device",type:"string",nullable:true,defaultValue:Spotify.defaultAccount}],public:true}
            },
            devices:{}
        },
        functions:{
            "spotify.authenticate()": function (parameters:null, websocket:any) {
                websocket.send("{\"type\":\"redirect\",\"data\":\"" + Spotify.Link + "\"}");
            },
            "spotify.play()"        : function (parameters:Array<string>) {
                Spotify.SpotifyPlay        (parameters[0]          ,null,parameters[1])
                .then((val:boolean) => {}).catch((err:number) => {});
            },
            "spotify.pause()"       : function (parameters:Array<string>) {
                Spotify.SpotifyPause       (                             parameters[0])
                .then((val:boolean) => {}).catch((err:number) => {});
            },
            "spotify.skipnext()"    : function (parameters:Array<string>) {
                Spotify.SpotifySkipNext    (                        null,parameters[0])
                .then((val:boolean) => {}).catch((err:number) => {});
            },
            "spotify.skipprevious()": function (parameters:Array<string>) {
                Spotify.SpotifySkipPrevious(                        null,parameters[0])
                .then((val:boolean) => {}).catch((err:number) => {});
            },
            "spotify.toggle()"      : function (parameters:Array<string>) {
                Spotify.SpotifyToggle      (                        null,parameters[0])
                .then((val:boolean) => {}).catch((err:number) => {});
            },
            "spotify.volumeup()"    : function (parameters:Array<string>) {
                Spotify.SpotifyVolumeUp    (parseInt(parameters[0]),null,parameters[1])
                .then((           ) => {}).catch((err:number) => {});
            },
            "spotify.volumedown()"  : function (parameters:Array<string>) {
                Spotify.SpotifyVolumeDown  (parseInt(parameters[0]),null,parameters[1])
                .then((           ) => {}).catch((err:number) => {});
            },
            "spotify.setvolume()"  : function (parameters:Array<string>) {
                Spotify.SpotifySetVolume   (parseInt(parameters[0]),null,parameters[1])
                .then((           ) => {}).catch((err:number) => {});
            }
        },
        "Rest":{
            "/SetSpotifyToken":function (req:any, res:any) {
                if (req.query.error == null) {
                    if (req.query.code != null) {
                        res.send("<html><script>function func() { window.location.href = 'http://mc.campbellsimpson.com:8081' } func();</script></html>");
                        Spotify.SpotifyGetToken(req.query.code);
                    }
                } else {
                    console.log(Colors.FgGray+"Spotify token error:"+Colors.Reset+req.query.error);
                }
            },
            "/SpotifyPlay"              :function (req:any, res:any) {
                Spotify.SpotifyPlay        (null                       , null, Spotify.defaultAccount).then((val:boolean           ) => { res.send(val                  ); }).catch((err:number) => { res.send("error"+err                 ); });
            },
            "/SpotifyPause"             :function (req:any, res:any) {
                Spotify.SpotifyPause       (                                   Spotify.defaultAccount).then((val:boolean           ) => { res.send(val                  ); }).catch((err:number) => { res.send("error"+err                 ); });
            }, 
            "/SpotifySkipNext"          :function (req:any, res:any) {
                Spotify.SpotifySkipNext    (                             null, Spotify.defaultAccount).then((val:boolean           ) => { res.send(val                  ); }).catch((err:number) => { res.send("error"+err                 ); });
            },
            "/SpotifySkipPrevious"      :function (req:any, res:any) {
                Spotify.SpotifySkipPrevious(                             null, Spotify.defaultAccount).then((val:boolean           ) => { res.send(val                  ); }).catch((err:number) => { res.send("error"+err                 ); });
            },
            "/SpotifyStatus"            :function (req:any, res:any) {
                Spotify.SpotifyStatus      (                                   Spotify.defaultAccount).then((val:[boolean,string[]]) => { res.send(JSON.stringify(val)  ); }).catch((err:number) => { res.send("[\"error" + err + "\", []]"); });
            },
            "/SpotifyToggle"            :function (req:any, res:any) {
                Spotify.SpotifyToggle      (                             null, Spotify.defaultAccount).then((val:boolean           ) => { res.send(val                  ); }).catch((err:number) => { res.send("error"+err                 ); });
            },
            "/SpotifyVolumeUp"          :function (req:any, res:any) {
                Spotify.SpotifyVolumeUp    (null                       , null, Spotify.defaultAccount).then((val:boolean           ) => { res.send(val                  ); }).catch((err:number) => { res.send("error"+err                 ); });
            },
            "/SpotifyVolumeUp/:amount"  :function (req:any, res:any) {
                Spotify.SpotifyVolumeUp    (parseInt(req.params.amount), null, Spotify.defaultAccount).then((val:boolean           ) => { res.send(val                  ); }).catch((err:number) => { res.send("error"+err                 ); });
            },
            "/SpotifyVolumeDown"        :function (req:any, res:any) {
                Spotify.SpotifyVolumeDown  (null                       , null, Spotify.defaultAccount).then((val:boolean           ) => { res.send(val                  ); }).catch((err:number) => { res.send("error"+err                 ); });
            },
            "/SpotifyVolumeDown/:amount":function (req:any, res:any) {
                Spotify.SpotifyVolumeDown  (parseInt(req.params.amount), null, Spotify.defaultAccount).then((val:boolean           ) => { res.send(val                  ); }).catch((err:number) => { res.send("error"+err                 ); });
            },
            "/SpotifyGetVolume":function (req:any, res:any) {
                Spotify.SpotifyGetVolume   (                                   Spotify.defaultAccount).then((val:number            ) => { res.send(val.toString()       ); }).catch((err:number) => { res.send("error"+err                 ); });
            },
            "/SpotifySetVolume/:volume":function (req:any, res:any) {
                Spotify.SpotifySetVolume   (parseInt(req.params.volume), null, Spotify.defaultAccount).then((val:boolean           ) => { res.send(val                  ); }).catch((err:number) => { res.send("error"+err                 ); });
            },
            "/SpotifyGetThumbnail":function (req:any, res:any) {
                Spotify.SpotifyGetThumbnail(                                   Spotify.defaultAccount).then((val:Buffer            ) => { res.type("jpeg"); res.send(val); }).catch((err:number) => { res.send("error"+err                 ); });
            }
        }
    },
    "Lamp":{
        device:{
            name:"LampRest",
            functions:{},
            devices:{},
            public:false
        },
        functions:{},
        Rest:{
            "/LampToggle":function (req:any, res:any) {
                try {
                    if (websockets["lamp"] != null) {
                        for(var i:number = 0; i <= callbacks.length; i++) {
                            if (callbacks[i] == null) {
                                callbacks[i] = function(Return:any,callbackID:number) {
                                    //delete callbacks[callbackID];
                                    res.send(Return);
                                }
                                websockets["lamp"].send("{\"type\":\"command\",\"data\":\"toggle()\",\"parameters\":[1,\"self.callback(" + i + ",RETURN)\"]}");
                                return;
                            }
                        }
                        
                    } else { console.log(Colors.FgGray+"Internal error:"+Colors.FgYellow+" Lamp"+Colors.FgCyan+" is not connected"+Colors.FgGray+"."+Colors.Reset); res.send("error"); }
                } catch (err:any) { console.log(err); }
            },
            "/LampOff":function (req:any, res:any) {
                try {
                    if (websockets["lamp"] != null) { websockets["lamp"].send("{\"type\":\"command\",\"data\":\"turnoff()\",\"parameters\":[]}"); res.send("false"); }
                    else { console.log(Colors.FgGray+"Internal error:"+Colors.FgYellow+" Lamp"+Colors.FgCyan+" is not connected"+Colors.FgGray+"."+Colors.Reset); res.send("error"); }
                } catch (err:any) { console.log(err); }
            },
            "/LampOn":function (req:any, res:any) {
                try {
                    if (websockets["lamp"] != null) { websockets["lamp"].send("{\"type\":\"command\",\"data\":\"turnon()\",\"parameters\":[]}"); res.send("true"); }
                    else { console.log(Colors.FgGray+"Internal error:"+Colors.FgYellow+" Lamp"+Colors.FgCyan+" is not connected"+Colors.FgGray+"."+Colors.Reset); res.send("error"); }
                } catch (err:any) { console.log(err); }
            },
            "/LampStatus":function (req:any, res:any) {
                try {
                    if (websockets["lamp"] != null) {
                        for(var i:number = 0; i < callbacks.length + 1; i++) {
                            if (callbacks[i] == null) {
                                callbacks[i] = function(Return:any,callbackID:number) {
                                    //delete callbacks[callbackID];
                                    res.send(Return);
                                }
                                websockets["lamp"].send("{\"type\":\"command\",\"data\":\"status()\",\"parameters\":[\"self.callback(" + i + ",RETURN)\"]}");
                                return;
                            }
                        }
                    } else { console.log(Colors.FgGray+"Internal error:"+Colors.FgYellow+" Lamp"+Colors.FgCyan+" is not connected"+Colors.FgGray+"."+Colors.Reset); res.send("error"); }
                } catch (err) { console.log(err); }
            }
        }
    }
}
//add localdevices to device list
Object.keys(localdevices).forEach((i) => {
    if (localdevices[i].device != null) {
        if (localdevices[i].device != undefined && devices.self!.devices![localdevices[i].device.name.toLowerCase()] == null) {
            devices.self!.devices![localdevices[i].device.name.toLowerCase()] = localdevices[i].device
        } else {
            console.log(Colors.FgGray+"Internal error:"+Colors.FgRed+"localDevice "+Colors.FgGreen+"\"" + localdevices[i].device != undefined ? localdevices[i].device.name : "" + "\""+Colors.FgRed+" already exists"+Colors.FgGray+"."+Colors.Reset);
        }
    }
});
//add localdevices to rest
Object.keys(localdevices).forEach((i) => {
    if (localdevices[i].Rest != null) {
        Object.keys(localdevices[i].Rest).forEach((j) => {
            if ((typeof localdevices[i].Rest[j]) == "function") {
                app.get(j,function(req:any, res:any) {
                    try { localdevices[i].Rest[j](req, res);
                    } catch (err:any) { console.log("err: " + err.stack + "  ln747") }
                });
            } else {
                console.log(Colors.FgGray+"Internal error:"+Colors.FgCyan+"localdevices"+Colors.FgGray+"["+Colors.FgYellow+i+Colors.FgGray+"]."+Colors.FgCyan+"Rest"+Colors.FgGray+"["+Colors.FgYellow+j+Colors.FgGray+"]"+Colors.FgRed+" is not of type "+Colors.FgGreen+" function"+Colors.FgGray+"."+Colors.Reset+Colors.Reset);
            }
        });
    }
});
//#endregion

var server:any = app.listen(8081, function () {
    //var host:string = server.address().address;
    var port:number = server.address().port;
    console.log(Colors.FgGray+"Public web execution page is running at http://"+ getIp() +Colors.FgGray+":"+Colors.FgYellow+ port +Colors.Reset);
 });