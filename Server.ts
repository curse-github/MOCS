/* To-DO
 * 
 * MAIN:
 * 
 * SIDE
 * 
 * device code for pi computer - runs on startup
 */
const WebSocket = require('ws') // npm install ws
const express = require("express"); // npm install express
import {Spotify} from "./Spotify";
import { cloneObject, getIp, assert, assertIsObject, assertIsString, Device, cmd, cmdData, command, Colors, printFakeFunction } from "./Lib"
console.clear();

import * as fs from "fs";
//try { fs.rmSync("out.txt"); } catch (err:any) { }
const Log:(...data: any[])=>void = console.log;
console.log = async(...data: any[])=>{
    Log(...data);
    Object.values(Colors).forEach((value:string)=>{
        for (let i = 0; i < data.length; i++) {
            data[i]=data[i].toString().split(value).join("");
        }
    })
    //fs.appendFileSync("out.txt",data.join("  ")+"\n");
};

var devices:{[key:string]:Device|null} = {
    "self": {
        name:"self",
        public:true,
        functions:{
            "authenticate"          :{name:"authenticate"          ,public:false,parameters:[{name:"username"  ,type:"string",nullable:false,public:false},{name:"password"          ,type:"string",nullable:false,public:false},{name:"createDevice"        ,type:"boolean",nullable:true ,public:false}]},
            "callback"              :{name:"callback"              ,public:false,parameters:[{name:"callback"  ,type:"number",nullable:false,public:false},{name:"returnVal"         ,type:"string",nullable:false,public:false}]},
            "subscribeconnection"   :{name:"subscribeConnection"   ,public:false,parameters:[{name:"deviceName",type:"string",nullable:false,public:false},{name:"callbackDeviceName",type:"string",nullable:false,public:false},{name:"callbackFunctionName",type:"string" ,nullable:false,public:false}]},
            "subscribedisconnection":{name:"subscribeDisconnection",public:false,parameters:[{name:"deviceName",type:"string",nullable:false,public:false},{name:"callbackDeviceName",type:"string",nullable:false,public:false},{name:"callbackFunctionName",type:"string" ,nullable:false,public:false}]},
            "clearconsole"          :{name:"clearConsole"          ,public:true,parameters:[]},
        },
        "devices": {}
    }
};
var Accounts:Array<{[key:string]:string}> = JSON.parse(fs.readFileSync(__dirname+"/logins.json"    , 'utf8'));

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
        const key:string = keys[i];
        if (key == "self") continue;
        pings[key] = false;
        const tmpWs:any = websockets[key];
        if (devices[key] != null && tmpWs != null) {
            tmpWs.send("{\"type\":\"ping\", \"data\":\"" + key + "\"}");
        }
    }
    setTimeout(() => {
        //after 100ms see which of the devices responded with a pong
        var keys2:Array<string> = Object.keys(devices);
        for(var i:number = 0; i < keys2.length; i++) {
            const key = keys2[i];
            if (key == "self") continue;
            const device:Device|null = devices[key];
            if (device == null) continue;
            if (pings[key] == true) continue;
            //and if they didnt count them as disconnected and remove them from the database
            if (websockets[key] != null) { websockets[key].close(); delete websockets[key]; }
            var oldDevice:any = {public:true,name:key}
            if (device != null) { oldDevice = device!; delete devices[key]; }

            //remove subscriptions made by that device
            const connectKeys = Object.keys(connectionSubscriptions);
            for (let j = 0; j < connectKeys.length; j++) {
                const key = connectKeys[j];
                const subs = connectionSubscriptions[key];
                let numSubs = subs.length;
                for (let k = 0; k < subs.length; k++) {
                    const name:string = subs[k][0].toLowerCase();
                    if (devices[name] != null && websockets[name] != null) continue;
                    numSubs--; delete connectionSubscriptions[key][k];
                }
                if (numSubs==0) delete connectionSubscriptions[key];
                else connectionSubscriptions[key] = subs.filter((el:any)=>el!=null)
            }
            const disconnectKeys = Object.keys(disconnectionSubscriptions);
            for (let j = 0; j < disconnectKeys.length; j++) {
                const key = disconnectKeys[j];
                const subs = disconnectionSubscriptions[key];
                let numSubs = subs.length
                for (let k = 0; k < subs.length; k++) {
                    const name:string = subs[k][0].toLowerCase();
                    if (devices[name] != null && websockets[name] != null) continue;
                    numSubs--; delete subs[k];
                }
                if (numSubs==0) delete disconnectionSubscriptions[key];
                else disconnectionSubscriptions[key] = subs.filter((el:any)=>el!=null);
            }

            if (key.startsWith("web")) continue;// if its a browser made device, skip next steps
            if (oldDevice.public) console.log(Colors.FgGr+"Device "+Colors.FgGre+"\"" + oldDevice.name + "\""+Colors.FgGr+" disconnected."+Colors.R);

            //send disconnection subscriptions
            var DisconnSubs:any = disconnectionSubscriptions[key.toLowerCase()];
            if (DisconnSubs != null && (typeof DisconnSubs) == "object" && Array.isArray(DisconnSubs)) {
                for(var j:number = 0; j < DisconnSubs.length; j++) {
                    handleCommand({type:"command",data:{device:DisconnSubs[j][0],function:DisconnSubs[j][1],parameters:[key]}});
                }
            }
            var anyDisconnSubs:any = disconnectionSubscriptions["any"];
            if (anyDisconnSubs != null && (typeof anyDisconnSubs) == "object" && Array.isArray(anyDisconnSubs)) {
                for(var j:number = 0; j < anyDisconnSubs.length; j++) {
                    const tmpWS:any = websockets[anyDisconnSubs[j][0]];
                    if (tmpWS == null) continue;
                    tmpWS.send(JSON.stringify({
                        type:"command",
                        data:anyDisconnSubs[j][1] + "()",
                        parameters:[key]
                    }));
                }
            }
        }
    }, 100);
}

const socketport:number = 42069;
var ws:any = new WebSocket.Server({ "port": socketport })
console.log(Colors.FgGr+"Websocket api is running at ws://"+ getIp() +Colors.FgGr+":"+Colors.FgYe+ socketport +Colors.R);
setInterval(() => {
    pingDevices();//ping devices
}, 30*1000);//30 seconds
ws.on('connection', (websocket:any) => {
    //ping all devices to see figure out which one disconnected
    websocket.on('close', function (reasonCode:number, description:string) { pingDevices(); });
    websocket.on('message', (message:string) => {
        try {
            var msg:cmd = JSON.parse(message);
            if (msg == null) { websocket.send(JSON.stringify({type:"status",status:false,statusCode:400,error:"Command is null"})); console.log(Colors.FgGr+"Invalid command:"+Colors.FgRe+" message is "+Colors.FgCy+"null"+Colors.FgGr+"."+Colors.R); return;}
            if (msg.type == null) { websocket.send(JSON.stringify({type:"status",status:false,statusCode:401,error:"Command type is null",id:msg.id})); console.log(Colors.FgGr+"Invalid command:"+Colors.FgRe+" message type is"+Colors.FgCy+" null"+Colors.FgGr+"."+Colors.R); return;}
            //find example messages in Lib.ts
            switch(msg.type) {
                case "connection": {
                    //check if valid data
                    //needs to have either nested objects or functions to call
                    const fail:()=>void = ()=>{
                        if (msg.data != null && msg.data.name != null) return;
                        console.log(Colors.FgGr+"invalid connection from "+Colors.FgGre+"\"unknown\""+Colors.FgGr+"."+Colors.R);
                    };
                    if (msg.data == null || msg.data.name == null) { fail(); websocket.send(JSON.stringify({type:"reply",status:false,statusCode:400,reply:"failure",id:msg.id,error:"Command data is null"})); break; }
                    let mapDevice = (device:any, parentName?:string|null) => {
                        const DisplayName:string = ((parentName!=null)?(parentName+"."):(""))+device.name;
                        const DisplayNameColor:string = ((parentName!=null)?(Colors.FgCy+parentName+Colors.FgGr+"."):(""))+Colors.FgCy+device.name;
                        var newDevice:any = {};
                        if ((typeof device.name) != "string") { websocket.send(JSON.stringify({type:"reply",status:false,statusCode:401,reply:"failure",id:msg.id,error:"device.name is not a string."})); console.log(Colors.FgGr+"invalid connection: "+((parentName!=null)?(Colors.FgCy+parentName+Colors.FgGr+"."):(""))+Colors.FgCy+"device"+Colors.FgGr+"."+Colors.FgCy+"name "+Colors.FgRe+"is not a string"+Colors.FgGr+"."+Colors.R); return false; }
                        newDevice.name   = device.name;
                        try { if ((typeof device.public) == "string") device.public = JSON.parse(device.public);
                        } catch (err:any) { websocket.send(JSON.stringify({type:"reply",status:false,statusCode:402,reply:"failure",id:msg.id,error:(((parentName!=null)?(parentName+"."):(""))+newDevice.name+".public is not a boolean.")})); console.log(Colors.FgGr+"invalid connection: "+DisplayNameColor+Colors.FgGr+"."+Colors.FgCy+"public"+Colors.FgRe+" is not a boolean"+Colors.FgGr+"."+Colors.R); return false; }
                        if ((typeof device.public) != "boolean" && device.public != null) { websocket.send(JSON.stringify({type:"reply",status:false,statusCode:403,reply:"failure",id:msg.id,error:(((parentName!=null)?(parentName+"."):(""))+newDevice.name+".public is not a boolean.")})); console.log(Colors.FgGr+"invalid connection: "+DisplayNameColor+Colors.FgGr+"."+Colors.FgCy+"public "+Colors.FgRe+"is not a boolean"+Colors.FgGr+"."+Colors.R); return false; }
                        newDevice.public = ((device.public!=null)?device.public:true);

                        if (device.functions != null) {
                            if ((typeof device.functions) != "object") { websocket.send(JSON.stringify({type:"reply",status:false,statusCode:405,reply:"failure",id:msg.id,error:(DisplayName+".functions is not an object.")})); console.log(Colors.FgGr+"invalid connection: "+DisplayNameColor+Colors.FgGr+"."+Colors.FgCy+"functions "+Colors.FgRe+"is not an object"+Colors.FgGr+"."+Colors.R); return false; }
                            newDevice.functions = {};
                            let mapParameters = (param:any,funcIndex:number|string,index:number) => {
                                const DisplayName:string = ((parentName!=null)?(parentName+"."):(""))+newDevice.name+".functions["+(((typeof funcIndex)=="number")?(funcIndex):("\""+funcIndex+"\""))+"].parameters["+index+"]";
                                const DisplayNameColor:string = ((parentName!=null)?(Colors.FgCy+parentName+Colors.FgGr+"."):(""))+Colors.FgCy+newDevice.name+Colors.FgGr+"."+Colors.FgCy+"functions"+Colors.FgGr+"["+(((typeof funcIndex)=="number")?(Colors.FgYe+funcIndex):(Colors.FgGre+"\""+funcIndex+"\""))+Colors.FgGr+"]"+Colors.FgGr+"."+Colors.FgCy+"parameters"+Colors.FgGr+"["+Colors.FgYe+index+Colors.FgGr+"]"+Colors.R;

                                if (param == null) { websocket.send(JSON.stringify({type:"reply",status:false,statusCode:406,reply:"failure",id:msg.id,error:(DisplayName+" is null")})); console.log(Colors.FgGr+"invalid connection: "+DisplayNameColor+Colors.FgRe+" is null"+Colors.FgGr+"."+Colors.R); return false; }
                                if ((typeof param.name) != "string") { websocket.send(JSON.stringify({type:"reply",status:false,statusCode:407,reply:"failure",id:msg.id,error:(DisplayName+".name is not a string.")})); console.log(Colors.FgGr+"invalid connection: "+DisplayNameColor+Colors.FgGr+"."+Colors.FgCy+"name "+Colors.FgRe+"is not a string"+Colors.FgGr+"."+Colors.R); return false; }
                                if ((typeof param.type) != "string") { websocket.send(JSON.stringify({type:"reply",status:false,statusCode:408,reply:"failure",id:msg.id,error:(DisplayName+".type is not a string.")})); console.log(Colors.FgGr+"invalid connection: "+DisplayNameColor+Colors.FgGr+"."+Colors.FgCy+"type "+Colors.FgRe+"is not a string"+Colors.FgGr+"."+Colors.R); return false; }
                                param.type = param.type.toLowerCase();
                                if (param.type != "string" && param.type != "number" && param.type != "bool" && param.type != "boolean") { websocket.send(JSON.stringify({type:"reply",status:false,statusCode:409,reply:"failure",id:msg.id,error:(DisplayName+".type is not a valid type.")})); console.log(Colors.FgGr+"invalid connection: "+DisplayNameColor+Colors.FgGr+"."+Colors.FgCy+"type "+Colors.FgRe+"is not a valid type"+Colors.FgGr+"."+Colors.R); return false; }
                                try { if ((typeof param.nullable) == "string") param.nullable = JSON.parse(param.nullable);
                                } catch (err:any) { websocket.send(JSON.stringify({type:"reply",status:false,statusCode:410,reply:"failure",id:msg.id,error:(DisplayName+".nullable is not a boolean.")})); console.log(Colors.FgGr+"invalid connection: "+DisplayNameColor+Colors.FgGr+"."+Colors.FgCy+"nullable "+Colors.FgRe+"is not a boolean"+Colors.FgGr+"."+Colors.R); return false; }
                                if ((typeof param.nullable) != "boolean" && param.nullable != null) { websocket.send(JSON.stringify({type:"reply",status:false,statusCode:411,reply:"failure",id:msg.id,error:(DisplayName+".nullable is not a boolean.")})); console.log(Colors.FgGr+"invalid connection: "+DisplayNameColor+Colors.FgGr+"."+Colors.FgCy+"nullable "+Colors.FgRe+"is not a boolean"+Colors.FgGr+"."+Colors.R); return false; }
                                //TEST THIS
                                
                                var out:any = {"name":param.name,"type":param.type,"nullable":((param.nullable!=null)?param.nullable:true)}
                                if (param.defaultValue != null) out.defaultValue = param.defaultValue;
                                return out;
                            }
                            let mapFunction = (func:any,index:number|string) => {
                                const DisplayName:string = ((parentName!=null)?(parentName+"."):(""))+newDevice.name+".functions["+(((typeof index) == "number")?(index):("\""+index+"\""))+"]";
                                const DisplayNameColor:string = ((parentName!=null)?(Colors.FgCy+parentName+Colors.FgGr+"."):(""))+Colors.FgCy+newDevice.name+Colors.FgGr+"."+Colors.FgCy+"functions"+(((typeof index) == "number")?(Colors.FgGr+"["+Colors.FgYe+index+Colors.FgGr+"]"):(Colors.FgGr+"["+Colors.FgGre+"\""+index+"\""+Colors.FgGr+"]"))+Colors.R;

                                if (func == null) { websocket.send(JSON.stringify({type:"reply",status:false,statusCode:412,reply:"failure",id:msg.id,error:(DisplayName+" is null")})); console.log(Colors.FgGr+"invalid connection: "+DisplayNameColor+Colors.FgRe+" is null"+Colors.FgGr+"."+Colors.R); return false; }
                                var newFunc:any = {};
                                if ((typeof func.name) != "string") { websocket.send(JSON.stringify({type:"reply",status:false,statusCode:413,reply:"failure",id:msg.id,error:(DisplayName+".name is not a string")})); console.log(Colors.FgGr+"invalid connection: "+DisplayNameColor+Colors.FgGr+"."+Colors.FgCy+"name "+Colors.FgRe+"is not a string"+Colors.FgGr+"."+Colors.R); return false; }
                                newFunc.name = func.name;
                                try { if ((typeof func.public) == "string") func.public = JSON.parse(func.public);
                                } catch (err:any) { websocket.send(JSON.stringify({type:"reply",status:false,statusCode:414,reply:"failure",id:msg.id,error:(DisplayName+".public is not a boolean")})); console.log(Colors.FgGr+"invalid connection: "+DisplayNameColor+Colors.FgGr+"."+Colors.FgCy+"public "+Colors.FgRe+"is not a boolean"+Colors.FgGr+"."+Colors.R); return false; }
                                if ((typeof func.public) != "boolean" && func.public != null) { websocket.send(JSON.stringify({type:"reply",status:false,statusCode:415,reply:"failure",id:msg.id,error:(DisplayName+".public is not a boolean")})); console.log(Colors.FgGr+"invalid connection: "+DisplayNameColor+Colors.FgGr+"."+Colors.FgCy+"public "+Colors.FgRe+"is not a boolean"+Colors.FgGr+"."+Colors.R); return false; }
                                newFunc.public = ((func.public!=null)?func.public:true);
                                if ((typeof func.parameters) != "object" || !Array.isArray(func.parameters)) { websocket.send(JSON.stringify({type:"reply",status:false,statusCode:416,reply:"failure",id:msg.id,error:(DisplayName+".parameters is not an object")})); console.log(Colors.FgGr+"invalid connection: "+DisplayNameColor+Colors.FgGr+"."+Colors.FgCy+"parameters "+Colors.FgRe+"is not an object"+Colors.FgGr+"."+Colors.R); return false; }
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
                            if ((typeof device.devices) != "object") { websocket.send(JSON.stringify({type:"reply",status:false,statusCode:417,reply:"failure",id:msg.id,error:(DisplayName+".devices is not an object")})); console.log(Colors.FgGr+"invalid connection: "+DisplayNameColor+Colors.FgGr+"."+Colors.R+Colors.FgCy+"devices "+Colors.FgRe+"is not an object"+Colors.FgGr+"."+Colors.R); return false; }
                            newDevice.devices = {};
                            if (Array.isArray(device.devices)) {
                                for (let i = 0; i < device.devices.length; i++) {
                                    const childDevice:any = device.devices[i];
                                    if (childDevice == null) { websocket.send(JSON.stringify({type:"reply",status:false,statusCode:420,reply:"failure",id:msg.id,error:(DisplayName+".\"device\" is null.")})); console.log(Colors.FgGr+"invalid connection: "+DisplayNameColor+Colors.FgGr+"."+Colors.R+Colors.FgCy+"device "+Colors.FgRe+"is null"+Colors.FgGr+"."+Colors.R); return false; }
                                    if ((typeof childDevice.name) != "string") { websocket.send(JSON.stringify({type:"reply",status:false,statusCode:419,reply:"failure",id:msg.id,error:(DisplayName+".\"device\".name is not an string")})); console.log(Colors.FgGr+"invalid connection: "+DisplayNameColor+Colors.FgGr+"."+Colors.R+Colors.FgCy+"device"+Colors.FgGr+"."+Colors.R+Colors.FgCy+"name "+Colors.FgRe+"is not a string"+Colors.FgGr+"."+Colors.R); return false; }
                                    const tmp:any = mapDevice(childDevice, ((parentName!=null)?(parentName+"."):(""))+device.name);
                                    if (tmp == false) { return false; }
                                    else newDevice.devices[childDevice.name.toLowerCase()] = tmp;
                                }
                            } else {
                                const funcKeys:string[] = Object.keys(device.devices);
                                for (let i = 0; i < funcKeys.length; i++) {
                                    const childDevice:any = device.devices[funcKeys[i]];
                                    if (childDevice == null) { websocket.send(JSON.stringify({type:"reply",status:false,statusCode:420,reply:"failure",id:msg.id,error:(DisplayName+".\"device\" is null.")})); console.log(Colors.FgGr+"invalid connection: "+DisplayNameColor+Colors.FgGr+"."+Colors.R+Colors.FgCy+"device "+Colors.FgRe+"is null"+Colors.FgGr+"."+Colors.R); return false; }
                                    if ((typeof childDevice.name) != "string") { websocket.send(JSON.stringify({type:"reply",status:false,statusCode:421,reply:"failure",id:msg.id,error:(DisplayName+".\"device\".name is not an string.")})); console.log(Colors.FgGr+"invalid connection: "+DisplayNameColor+Colors.FgGr+"."+Colors.R+Colors.FgCy+"device"+Colors.FgGr+"."+Colors.R+Colors.FgCy+"name "+Colors.FgRe+"is not a string"+Colors.FgGr+"."+Colors.R); return false; }
                                    const tmp:any = mapDevice(childDevice, ((parentName!=null)?(parentName+"."):(""))+device.name);
                                    if (tmp == false) return false;
                                    else newDevice.devices[childDevice.name.toLowerCase()] = tmp;
                                }
                            }
                        }
                        if ((device.devices   == null || Object.keys(device.devices  ).length <= 0) &&
                            (device.functions == null || Object.keys(device.functions).length <= 0)
                        ) { websocket.send(JSON.stringify({type:"reply",status:false,statusCode:418,reply:"failure",id:msg.id,error:"The server refuses to brew coffee because it is, permanently, a teapot."})); console.log(Colors.FgGr+"invalid connection: "+Colors.FgRe+"pointless device "+Colors.FgGre+"\"" + DisplayNameColor+Colors.FgGre+"\""+Colors.FgGr+"."+Colors.R); return false; }// status code 418
                        return newDevice;
                    }
                    const tmp:any = mapDevice(msg.data);
                    if (tmp == false) { fail(); break; }
                    const ogMsgId:string|number = msg.data.id;
                    msg.data = tmp;
                    if (websockets[msg.data.name.toLowerCase()] == null && devices[msg.data.name.toLowerCase()] == null) {
                        //add device data and websocket connection to lists
                        devices[msg.data.name.toLowerCase()] = msg.data;
                        websockets[msg.data.name.toLowerCase()] = websocket;
                        //response
                        websocket.send(JSON.stringify({type:"reply",status:true,statusCode:200,reply:"success",id:ogMsgId}));
                        if (msg.data.public) console.log(Colors.FgGr+"Device "+Colors.FgGre+"\"" + msg.data.name + "\""+Colors.FgGr+" conneced"+Colors.FgGr+"."+Colors.R);
                        //special things
                        if (msg.data.name.toLowerCase() == "nanopi") {
                            handleCommand("{\"type\":\"command\",\"data\":{\"device\":\"nanopi\",\"function\":\"Subscribe\",\"parameters\":[1,\"self.spotify\",\"skipprevious\",\""+Spotify.defaultAccount+"\"]}}");
                            handleCommand("{\"type\":\"command\",\"data\":{\"device\":\"nanopi\",\"function\":\"Subscribe\",\"parameters\":[2,\"self.spotify\",\"toggle\",\""+Spotify.defaultAccount+"\"]}}");
                            handleCommand("{\"type\":\"command\",\"data\":{\"device\":\"nanopi\",\"function\":\"Subscribe\",\"parameters\":[3,\"self.spotify\",\"skipnext\",\""+Spotify.defaultAccount+"\"]}}");
                        } else if (msg.data.name.toLowerCase() == "controller") {
                            handleCommand("{\"type\":\"command\",\"data\":{\"device\":\"controller\",\"function\":\"Subscribe\",\"parameters\":[7,\"self.spotify\",\"skipprevious\",\""+Spotify.defaultAccount+"\"]}}");
                            handleCommand("{\"type\":\"command\",\"data\":{\"device\":\"controller\",\"function\":\"Subscribe\",\"parameters\":[6,\"self.spotify\",\"toggle\",\""+Spotify.defaultAccount+"\"]}}");
                            handleCommand("{\"type\":\"command\",\"data\":{\"device\":\"controller\",\"function\":\"Subscribe\",\"parameters\":[5,\"self.spotify\",\"skipnext\",\""+Spotify.defaultAccount+"\"]}}");
                        }
                        //handle connection subs
                        const sub = connectionSubscriptions[msg.data.name.toLowerCase()];
                        if (sub != null && (typeof sub == "object" && Array.isArray(sub))) {
                            for(var i:number = 0; i < sub.length; i++) {
                                handleCommand(JSON.parse("{\"type\":\"command\",\"data\":{\"device\":\"" + sub[i][0] + "\",\"function\":\"" + sub[i][1] + "\",\"parameters\":[\"" + msg.data.name + "\"]}}"));
                            }
                        }
                        const anySub = connectionSubscriptions["any"];
                        if (anySub != null && (typeof anySub) == "object" && Array.isArray(anySub)) {
                            for(var i:number = 0; i < anySub.length; i++) {
                                if (websockets[anySub[i][0]] == null) continue;
                                websockets[anySub[i][0]].send(JSON.stringify({
                                    type:"command",
                                    data:anySub[i][1] + "()",
                                    parameters:[msg.data.name,msg.data]
                                }));
                            }
                        }
                    }
                    break;
                }
                case "command": {
                    //console.log("command: \n" + message + "\n");
                    if (msg.data            == null) { console.log(msg); websocket.send(JSON.stringify({type:"status",status:false,statusCode:402,error:"Command data is invalid"      ,id:msg.id})); console.log(Colors.FgGr+"Invalid command:"+Colors.FgGr+" Command"+Colors.FgRe+" missing command data"       +Colors.FgGr+"."+Colors.R); return; }
                    if (msg.data.device     == null) { console.log(msg); websocket.send(JSON.stringify({type:"status",status:false,statusCode:402,error:"Command device is invalid"    ,id:msg.id})); console.log(Colors.FgGr+"Invalid command:"+Colors.FgGr+" Command"+Colors.FgRe+" missing target device"      +Colors.FgGr+"."+Colors.R); return; }
                    if (msg.data.function   == null) { console.log(msg); websocket.send(JSON.stringify({type:"status",status:false,statusCode:403,error:"Command function is invalid"  ,id:msg.id})); console.log(Colors.FgGr+"Invalid command:"+Colors.FgGr+" Command"+Colors.FgRe+" missing target function"    +Colors.FgGr+"."+Colors.R); return; }
                    if (msg.data.parameters == null) { console.log(msg); websocket.send(JSON.stringify({type:"status",status:false,statusCode:405,error:"Command parameters is invalid",id:msg.id})); console.log(Colors.FgGr+"Invalid command:"+Colors.FgGr+" Command"+Colors.FgRe+" missing function parameters"+Colors.FgGr+"."+Colors.R); return; }

                    handleCommand(msg as command, websocket);
                    break;
                }
                case "pong": {
                    //when receiving back a ping call the callback after error checking
                    if (msg.data == null || (typeof msg.data) != "string") break;
                    pings[msg.data] = true;
                    break;
                }
                case "ping": {
                    if (msg.data != null) websocket.send("{\"type\":\"pong\",\"data\":\"" + msg.data + "\"}");
                    else if (msg.id != null) websocket.send("{\"type\":\"pong\",\"id\":\"" + msg.id + "\"}");
                    break;
                }
                default: { websocket.send(JSON.stringify({type:"status",status:false,statusCode:406,error:"Command type is invalid",id:msg.id})); console.log(Colors.FgGr+"Invalid command:"+Colors.FgRe+" Invalid message type"+Colors.FgGre+" \""+msg.type+"\""+Colors.FgGr+"."+Colors.R); }
            }
        } catch (err:any) { websocket.send(JSON.stringify({type:"status",status:false,statusCode:407,error:"Command invalid json",message:err.message})); console.log(Colors.FgGr+"Invalid command:"+Colors.FgRe+" Unable to parse json of message"+Colors.FgGr+"."+Colors.R); console.log(message); console.log(err.message); console.log(err.stack); }
    });
});
//continue here
function handleCommand(msg:string|command, websocket?:any) {
    if ((typeof msg) == "string") {
        assertIsString(msg);
        try {
            var json:command = JSON.parse(msg) as command;
            if (json != null) {
                handleCommand(json);
            } else { if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:408,error:"Command is null"})); } console.log(Colors.FgGr+"Invalid command:"+Colors.FgRe+" Command is"+Colors.FgCy+" null"+Colors.FgGr+"."+Colors.R); return; }
        } catch (err:any) { console.log(err.stack + "    ln310"); }
    } else if ((typeof msg) == "object"){
        assert(typeof msg == "object")
        if (msg.data.device.split(".")[0].toLowerCase() == "self") {
            var _switch:{[key:string]:Function} = {
                "authenticate()": function (parameters:[string,string,string|boolean]) {// used for web execution page
                    if (parameters.length < 2                       ) { if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:409,error:"self.authenticate parameters are invalid",id:msg.id}));     } console.log(Colors.FgGr+"Invalid command:"+Colors.FgGre+" \""+printFakeFunction("self.authenticate",parameters)+Colors.FgGre+"\""+Colors.FgGr+"."+Colors.R); return false; }
                    if (parameters[0] == null || parameters[0] == "") { if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:410,error:"self.authenticate \"username\" is invalid",id:msg.id}));     } console.log(Colors.FgGr+"Invalid command:"+Colors.FgGre+" \""+printFakeFunction("self.authenticate",parameters)+Colors.FgGre+"\""+Colors.FgGr+"."+Colors.R); return false; }
                    if (parameters[1] == null || parameters[1] == "") { if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:411,error:"self.authenticate \"password\" is invalid",id:msg.id})); } console.log(Colors.FgGr+"Invalid command:"+Colors.FgGre+" \""+printFakeFunction("self.authenticate",parameters)+Colors.FgGre+"\""+Colors.FgGr+"."+Colors.R); return false; }
                    if ((typeof parameters[0]) != "string"          ) { if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:410,error:"self.authenticate \"username\" is invalid",id:msg.id}));     } console.log(Colors.FgGr+"Invalid command:"+Colors.FgGre+" \""+printFakeFunction("self.authenticate",parameters)+Colors.FgGre+"\""+Colors.FgGr+"."+Colors.R); return false; }
                    if ((typeof parameters[1]) != "string"          ) { if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:411,error:"self.authenticate \"password\" is invalid",id:msg.id})); } console.log(Colors.FgGr+"Invalid command:"+Colors.FgGre+" \""+printFakeFunction("self.authenticate",parameters)+Colors.FgGre+"\""+Colors.FgGr+"."+Colors.R); return false; }
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
                        false
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
                                                public:false
                                            },
                                            "disconnect":{
                                                name:"disconnect",
                                                parameters:[ {name:"device",type:"string",nullable:false} ],
                                                public:false
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
                    return true;
                },
                "callback()": function (parameters:Array<number|string>) {
                    if (parameters.length < 2                       ) { if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:412,error:"self.callback not enough parameters",id:msg.id}));    } console.log(Colors.FgGr+"Invalid command:"+Colors.FgGre+" \""+printFakeFunction("self.callback",parameters)+Colors.FgGre+"\""+Colors.FgGr+"."+Colors.R); return false; }
                    if (parameters[0] == null || parameters[0] == "") { if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:413,error:"self.callback \"callback\" is invalid",id:msg.id}));  } console.log(Colors.FgGr+"Invalid command:"+Colors.FgGre+" \""+printFakeFunction("self.callback",parameters)+Colors.FgGre+"\""+Colors.FgGr+"."+Colors.R); return false; }
                    if (parameters[1] == null || parameters[1] == "") { if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:414,error:"self.callback \"returnVal\" is invalid",id:msg.id})); } console.log(Colors.FgGr+"Invalid command:"+Colors.FgGre+" \""+printFakeFunction("self.callback",parameters)+Colors.FgGre+"\""+Colors.FgGr+"."+Colors.R); return false; }

                    var callbackNum:number = Number(parameters[0]);
                    if (Number.isNaN(callbackNum)                   ) { if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:415,error:"self.callback \"callback\" is invalid",id:msg.id}));  } console.log(Colors.FgGr+"Invalid command:"+Colors.FgGre+" \""+printFakeFunction("self.callback",parameters)+Colors.FgGre+"\""+Colors.FgGr+"."+Colors.R); return false; }
                    if ((typeof parameters[1]) != "string"          ) { if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:416,error:"self.callback \"returnVal\" is invalid",id:msg.id})); } console.log(Colors.FgGr+"Invalid command:"+Colors.FgGre+" \""+printFakeFunction("self.callback",parameters)+Colors.FgGre+"\""+Colors.FgGr+"."+Colors.R); return false; }

                    callbacks[callbackNum](parameters[1],callbackNum);
                    delete callbacks[callbackNum];
                    return true;
                },
                "subscribeconnection()": function (parameters:[string,string,string]) {
                    if (parameters.length < 3                       ) { if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:417,error:"self.subscribeconnection not enough parameters",id:msg.id}));               } console.log(Colors.FgGr+"Invalid command:"+Colors.FgGre+" \""+printFakeFunction("self.subscribeconnection"   ,parameters)+Colors.FgGre+"\""+Colors.FgGr+"."+Colors.R); return false; }
                    if (parameters[0] == null || parameters[0] == "") { if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:418,error:"self.subscribeconnection \"deviceName\" is invalid",id:msg.id}));           } console.log(Colors.FgGr+"Invalid command:"+Colors.FgGre+" \""+printFakeFunction("self.subscribeconnection"   ,parameters)+Colors.FgGre+"\""+Colors.FgGr+"."+Colors.R); return false; }
                    if (parameters[1] == null || parameters[1] == "") { if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:419,error:"self.subscribeconnection \"callbackDeviceName\" is invalid",id:msg.id}));   } console.log(Colors.FgGr+"Invalid command:"+Colors.FgGre+" \""+printFakeFunction("self.subscribeconnection"   ,parameters)+Colors.FgGre+"\""+Colors.FgGr+"."+Colors.R); return false; }
                    if (parameters[2] == null || parameters[2] == "") { if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:420,error:"self.subscribeconnection \"callbackFunctionName\" is invalid",id:msg.id})); } console.log(Colors.FgGr+"Invalid command:"+Colors.FgGre+" \""+printFakeFunction("self.subscribeconnection"   ,parameters)+Colors.FgGre+"\""+Colors.FgGr+"."+Colors.R); return false; }
                    if ((typeof parameters[0]) != "string"          ) { if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:418,error:"self.subscribeconnection \"deviceName\" is invalid",id:msg.id}));           } console.log(Colors.FgGr+"Invalid command:"+Colors.FgGre+" \""+printFakeFunction("self.subscribeconnection"   ,parameters)+Colors.FgGre+"\""+Colors.FgGr+"."+Colors.R); return false; }
                    if ((typeof parameters[1]) != "string"          ) { if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:419,error:"self.subscribeconnection \"callbackDeviceName\" is invalid",id:msg.id}));   } console.log(Colors.FgGr+"Invalid command:"+Colors.FgGre+" \""+printFakeFunction("self.subscribeconnection"   ,parameters)+Colors.FgGre+"\""+Colors.FgGr+"."+Colors.R); return false; }
                    if ((typeof parameters[2]) != "string"          ) { if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:420,error:"self.subscribeconnection \"callbackFunctionName\" is invalid",id:msg.id})); } console.log(Colors.FgGr+"Invalid command:"+Colors.FgGre+" \""+printFakeFunction("self.subscribeconnection"   ,parameters)+Colors.FgGre+"\""+Colors.FgGr+"."+Colors.R); return false; }

                    const deviceName = parameters[0].toLowerCase();
                    if (websockets[deviceName] == null) {
                        connectionSubscriptions[deviceName] = connectionSubscriptions[deviceName]||[];
                        connectionSubscriptions[deviceName].push([parameters[1],parameters[2]]);
                    } else {// device is already connected
                        handleCommand(JSON.parse("{\"type\":\"command\",\"data\":{\"device\":\"" + parameters[1] + "\",\"function\":\"" + parameters[2] + "\",\"parameters\":[\"" + parameters[0] + "\"]}}"));
                    }
                    return true;
                },
                "subscribedisconnection()": function (parameters:[string,string,string]) {
                    if (parameters.length < 3                       ) { if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:421,error:"self.subscribedisconnection not enough parameters",id:msg.id}));               } console.log(Colors.FgGr+"Invalid command:"+Colors.FgGre+" \""+printFakeFunction("self.subscribedisconnection"   ,parameters)+Colors.FgGre+"\""+Colors.FgGr+"."+Colors.R); return false; }
                    if (parameters[0] == null || parameters[0] == "") { if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:422,error:"self.subscribedisconnection \"deviceName\" is invalid",id:msg.id}));           } console.log(Colors.FgGr+"Invalid command:"+Colors.FgGre+" \""+printFakeFunction("self.subscribedisconnection"   ,parameters)+Colors.FgGre+"\""+Colors.FgGr+"."+Colors.R); return false; }
                    if (parameters[1] == null || parameters[1] == "") { if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:423,error:"self.subscribedisconnection \"callbackDeviceName\" is invalid",id:msg.id}));   } console.log(Colors.FgGr+"Invalid command:"+Colors.FgGre+" \""+printFakeFunction("self.subscribedisconnection"   ,parameters)+Colors.FgGre+"\""+Colors.FgGr+"."+Colors.R); return false; }
                    if (parameters[2] == null || parameters[2] == "") { if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:424,error:"self.subscribedisconnection \"callbackFunctionName\" is invalid",id:msg.id})); } console.log(Colors.FgGr+"Invalid command:"+Colors.FgGre+" \""+printFakeFunction("self.subscribedisconnection"   ,parameters)+Colors.FgGre+"\""+Colors.FgGr+"."+Colors.R); return false; }
                    if ((typeof parameters[0]) != "string"          ) { if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:422,error:"self.subscribedisconnection \"deviceName\" is invalid",id:msg.id}));           } console.log(Colors.FgGr+"Invalid command:"+Colors.FgGre+" \""+printFakeFunction("self.subscribedisconnection"   ,parameters)+Colors.FgGre+"\""+Colors.FgGr+"."+Colors.R); return false; }
                    if ((typeof parameters[1]) != "string"          ) { if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:423,error:"self.subscribedisconnection \"callbackDeviceName\" is invalid",id:msg.id}));   } console.log(Colors.FgGr+"Invalid command:"+Colors.FgGre+" \""+printFakeFunction("self.subscribedisconnection"   ,parameters)+Colors.FgGre+"\""+Colors.FgGr+"."+Colors.R); return false; }
                    if ((typeof parameters[2]) != "string"          ) { if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:424,error:"self.subscribedisconnection \"callbackFunctionName\" is invalid",id:msg.id})); } console.log(Colors.FgGr+"Invalid command:"+Colors.FgGre+" \""+printFakeFunction("self.subscribedisconnection"   ,parameters)+Colors.FgGre+"\""+Colors.FgGr+"."+Colors.R); return false; }

                    const deviceName = parameters[0].toLowerCase();
                    disconnectionSubscriptions[deviceName] = disconnectionSubscriptions[deviceName]||[];
                    disconnectionSubscriptions[deviceName].push([parameters[1],parameters[2]]);
                    return true;
                },
                "clearconsole()": function (parameters:[string,string,string]) {
                    console.clear();
                    return true;
                }
            }
            Object.keys(localdevices).forEach((i) => {
                var temp:{[key:string]:Function} = Object.assign({}, _switch, localdevices[i].functions);
                _switch = temp;
            });
            
            var nm:string = (msg.data.device.includes(".") ? ((msg.data.device.substring(5)).toLowerCase()+".") : "") + msg.data.function.toLowerCase();
            if (_switch[nm+"()"] != null) {
                var out:boolean = _switch[nm+"()"](msg.data.parameters, websocket,msg.id);
                if (out) websocket.send(JSON.stringify({type:"status",status:true,statusCode:200,id:msg.id}));
                else { console.log(msg.data);console.log(""); }
            } else { if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:425,error:"Function \""+nm+"\" not found",id:msg.id})); } console.log(Colors.FgGr+"Invalid command:"+Colors.FgRe+" Function"+Colors.FgGre+" \""+nm+"\""+Colors.FgRe+" not found"+Colors.FgGr+"."+Colors.R); return; }
        } else {
            const out:([boolean]|[string,string]) = findFunction(devices,msg.data,websocket) as ([boolean]|[string,string]);
            if (out[0] != false) {
                const lst = out as [string,string];
                if (websockets[lst[0]] != null) {// console.log("sent: " + message);
                    assertIsString(lst[1]);
                    var message:string = lst[1];
                    websockets[lst[0]].send(message);
                    if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:true,statusCode:200,id:msg.id})); }
                } else {
                    if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:426,error:"Device \""+lst[0]+"\" not connected",id:msg.id})); } console.log(Colors.FgGr+"Invalid command:"+Colors.FgRe+" Device"+Colors.FgGre+" \""+lst[0]+"\""+Colors.FgRe+" not connected"+Colors.FgGr+"."+Colors.R);
                }
            } else { console.log(msg.data);console.log("") }
        }
    } else { console.log(Colors.FgGr+"Internal error:"+Colors.FgYe+" Message"+Colors.FgRe+" is not an object"+Colors.FgGr+"."+Colors.R); }
}
function findFunction(list:{[key:string]:Device|null},data:cmdData,websocket:any,type?:number) : ([boolean]|[{[key:string]:string|Array<string|number|boolean|null>}]|[string,string]){
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
                        } else { condition = false; failIndex=i; got=Colors.FgCy+"null"; break; } // invalid
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
                    } else { condition = false; failIndex=i; got=Colors.FgCy+"other"; break; } // invalid
                }
                if (!condition) {
                    if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:427,error:"Found function but parameter types do not match",id:data.id})); }
                    console.log(Colors.FgGr+"Invalid command:"+Colors.R+" Found function but"+Colors.FgRe+" parameter types do not match"+Colors.FgGr+"."+Colors.R);
                    console.log(Colors.FgGr+"parameter"+Colors.FgYe+"#"+failIndex+Colors.FgGr+", expected "+Colors.FgGre+type+Colors.FgGr+" but got "+Colors.FgGre+got+Colors.FgGr+"."+Colors.R);
                    return [false];
                }
                if (type == 2) {
                    return [{ type : "command", data : data.function + "()", "parameters" : data.parameters }];
                } else if (type == null || type == 1) {
                    return [deviceName.toLowerCase(), JSON.stringify({ type : "command", data : data.function + "()", "parameters" : data.parameters })];
                }
            } else {
                if (device == null) {
                    if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:428,error:"Device \""+deviceName+"\" not found",id:data.id}));      } console.log(Colors.FgGr+"Invalid command:"+Colors.FgRe+" Device"+Colors.FgGre+" \""+deviceName+"\""+Colors.FgRe+" not found"+Colors.FgGr+"."+Colors.R);
                } else if (Object.keys(device.functions).length <= 0 || device.functions[data.function.toLowerCase()] == null) {
                    if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:429,error:"Function \""+data.function+"\" not found",id:data.id})); } console.log(Colors.FgGr+"Invalid command:"+Colors.FgRe+" Device"+Colors.FgGre+" \""+deviceName+"\""+Colors.FgRe+" does not contain function"+Colors.FgGre+" \"" + data.function + "\""+Colors.FgGr+"."+Colors.R);
                }
                return [false];
            }
        } else {
            // if there is more than one call the function recursively untill it finds the data it was looking for, returning the first it finds
            const deviceNameSplit:string[] = deviceName.split(".");
            var shift:string = deviceNameSplit.shift()!.toLowerCase();//get string between beginning and first dot
            if (list[shift] != null && Object.keys(list[shift]!.devices!).length > 0) {
                var out:(string|boolean|{[key:string]:string|Array<string|number|boolean|null>}) = findFunction(list[shift]!.devices!, {device:deviceNameSplit.join("."),function:data.function,parameters:data.parameters},websocket, 2)[0];
                if (out != false) {
                    const message:{[key:string]:string} = out as {[key:string]:string};
                    assertIsObject(message);
                    message.data = deviceNameSplit.join(".").toLowerCase() + "." + message.data;
                    if (type==2) return [message]; else return [shift, JSON.stringify(message)];
                } else {
                    return [false];
                }
            } else {
                if (list[shift] == null) {
                    if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:428,error:"Device \""+shift+"\" not found",id:data.id}));                        } console.log(Colors.FgGr+"Invalid command:"+Colors.FgRe+" Device"+Colors.FgGre+" \""+shift+"\""+Colors.FgRe+" not found"+Colors.FgGr+"."+Colors.R);
                } else if (Object.keys(list[shift]!.devices!).length <= 0) {
                    if (websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:430,error:"Device does not have child \""+deviceNameSplit[0]+"\"",id:data.id})); } console.log(Colors.FgGr+"Invalid command:"+Colors.FgRe+" Device"+Colors.FgGre+" \""+shift+"\""+Colors.FgRe+" does not have child devices"+Colors.FgGr+"."+Colors.R);
                } else {
                    console.log("weird error ln551");
                }
                return [false];
            }
        }
    } else {
        if (list == null) {
            console.log(Colors.FgGr+"Internal error: list"+Colors.FgRe+" is"+Colors.FgCy+" null"+Colors.FgGr+"."+Colors.R);
        } else if ((typeof list) != "object") {
            console.log(Colors.FgGr+"Internal error: list"+Colors.FgRe+" is not an object"+Colors.FgGr+"."+Colors.R);
        } else if (Array.isArray(list)) {
            console.log(Colors.FgGr+"Internal error: list"+Colors.FgRe+" is an array"+Colors.FgGr+"."+Colors.R);
        } else {// data == null
            console.log(Colors.FgGr+"Internal error: data"+Colors.FgRe+" is"+Colors.FgCy+" null"+Colors.FgGr+"."+Colors.R);
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
                return true;
            },
            "spotify.play()"        : function (parameters:Array<string>,websocket:any,id:string|number|null) {
                if (parameters.length < 2                                      ) {if(websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:431,error:"Found function but parameters do not match","id":id}));    } return false; }
                if (parameters[0] == null || (typeof parameters[0]) != "string") {if(websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:432,error:"Found function but parameter types do not match","id":id}));    } return false; }
                if (parameters[1] == null || (typeof parameters[1]) != "string") {if(websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:432,error:"Found function but parameter types do not match","id":id}));    } return false; }
                Spotify.SpotifyPlay        (parameters[0]          ,null,parameters[1])
                .then((val:boolean) => {}).catch((err:number) => {});
                return true;
            },
            "spotify.pause()"       : function (parameters:Array<string>,websocket:any,id:string|number|null) {
                if (parameters.length < 1                                      ) {if(websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:433,error:"Found function but parameters do not match","id":id}));    } return false; }
                if (parameters[0] == null || (typeof parameters[0]) != "string") {if(websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:434,error:"Found function but parameter types do not match","id":id}));    } return false; }
                Spotify.SpotifyPause       (                             parameters[0])
                .then((val:boolean) => {}).catch((err:number) => {});
                return true;
            },
            "spotify.skipnext()"    : function (parameters:Array<string>,websocket:any,id:string|number|null) {
                if (parameters.length < 1                                      ) {if(websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:435,error:"Found function but parameters do not match","id":id}));    } return false; }
                if (parameters[0] == null || (typeof parameters[0]) != "string") {if(websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:436,error:"Found function but parameter types do not match","id":id}));    } return false; }
                Spotify.SpotifySkipNext    (                        null,parameters[0])
                .then((val:boolean) => {}).catch((err:number) => {});
                return true;
            },
            "spotify.skipprevious()": function (parameters:Array<string>,websocket:any,id:string|number|null) {
                if (parameters.length < 1                                      ) {if(websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:437,error:"Found function but parameters do not match","id":id}));    } return false; }
                if (parameters[0] == null || (typeof parameters[0]) != "string") {if(websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:438,error:"Found function but parameter types do not match","id":id}));    } return false; }
                Spotify.SpotifySkipPrevious(                        null,parameters[0])
                .then((val:boolean) => {}).catch((err:number) => {});
                return true;
            },
            "spotify.toggle()"      : function (parameters:Array<string>,websocket:any,id:string|number|null) {
                if (parameters.length < 1                                      ) {if(websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:439,error:"Found function but parameters do not match","id":id}));    } return false; }
                if (parameters[0] == null || (typeof parameters[0]) != "string") {if(websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:440,error:"Found function but parameter types do not match","id":id}));    } return false; }
                Spotify.SpotifyToggle      (                        null,parameters[0])
                .then((val:boolean) => {}).catch((err:number) => {});
                return true;
            },
            "spotify.volumeup()"    : function (parameters:Array<string|number>,websocket:any,id:string|number|null) {
                if (parameters.length < 2                                      ) {if(websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:441,error:"Found function but parameters do not match","id":id}));    } return false; }
                if (parameters[1] == null || (typeof parameters[1]) != "string") {if(websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:442,error:"Found function but parameter types do not match","id":id}));    } return false; }
                if (parameters[0] == null                                      ) {if(websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:442,error:"Found function but parameter types do not match","id":id}));    } return false; }
                if ((typeof parameters[0]) == "string") { try{parameters[0]=parseFloat(parameters[0]as string);}catch(err:any){if(websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:442,error:"Found function but parameter types do not match","id":id}));    } return false; } }
                if ((typeof parameters[0]) != "number") {if(websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:442,error:"Found function but parameter types do not match","id":id}));    } return false; }
                Spotify.SpotifyVolumeUp    (parameters[0] as number,null,parameters[1] as string)
                .then((           ) => {}).catch((err:number) => {});
                return true;
            },
            "spotify.volumedown()"  : function (parameters:Array<string|number>,websocket:any,id:string|number|null) {
                if (parameters.length < 2                                      ) {if(websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:443,error:"Found function but parameters do not match","id":id}));    } return false; }
                if (parameters[1] == null || (typeof parameters[1]) != "string") {if(websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:444,error:"Found function but parameter types do not match","id":id}));    } return false; }
                if ((typeof parameters[0]) == "string") { try{parameters[0]=parseFloat(parameters[0]as string);}catch(err:any){if(websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:444,error:"Found function but parameter types do not match","id":id}));    } return false; } }
                if ((typeof parameters[0]) != "number") {if(websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:444,error:"Found function but parameter types do not match","id":id}));    } return false; }
                Spotify.SpotifyVolumeDown  (parameters[0] as number,null,parameters[1] as string)
                .then((           ) => {}).catch((err:number) => {});
                return true;
            },
            "spotify.setvolume()"  : function (parameters:Array<string|number>,websocket:any,id:string|number|null) {
                if (parameters.length < 2                                      ) {if(websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:445,error:"Found function but parameters do not match","id":id}));    } return false; }
                if (parameters[1] == null || (typeof parameters[1]) != "string") {if(websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:446,error:"Found function but parameter types do not match","id":id}));    } return false; }
                if ((typeof parameters[0]) == "string") { try{parameters[0]=parseFloat(parameters[0]as string);}catch(err:any){if(websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:446,error:"Found function but parameter types do not match","id":id}));    } return false; } }
                if ((typeof parameters[0]) != "number") {if(websocket!=null){ websocket.send(JSON.stringify({type:"status",status:false,statusCode:446,error:"Found function but parameter types do not match","id":id}));    } return false; }
                Spotify.SpotifySetVolume   (parameters[0] as number,null,parameters[1] as string)
                .then((           ) => {}).catch((err:number) => {});
                return true;
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
                    console.log(Colors.FgGr+"Spotify token error:"+Colors.R+req.query.error);
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
                    } else { console.log(Colors.FgGr+"Internal error:"+Colors.FgYe+" Lamp"+Colors.FgCy+" is not connected"+Colors.FgGr+"."+Colors.R); res.send("error"); }
                } catch (err:any) { console.log(err); }
            },
            "/LampOff":function (req:any, res:any) {
                try {
                    if (websockets["lamp"] != null) { websockets["lamp"].send("{\"type\":\"command\",\"data\":\"turnoff()\",\"parameters\":[]}"); res.send("false"); }
                    else { console.log(Colors.FgGr+"Internal error:"+Colors.FgYe+" Lamp"+Colors.FgCy+" is not connected"+Colors.FgGr+"."+Colors.R); res.send("error"); }
                } catch (err:any) { console.log(err); }
            },
            "/LampOn":function (req:any, res:any) {
                try {
                    if (websockets["lamp"] != null) { websockets["lamp"].send("{\"type\":\"command\",\"data\":\"turnon()\",\"parameters\":[]}"); res.send("true"); }
                    else { console.log(Colors.FgGr+"Internal error:"+Colors.FgYe+" Lamp"+Colors.FgCy+" is not connected"+Colors.FgGr+"."+Colors.R); res.send("error"); }
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
                    } else { console.log(Colors.FgGr+"Internal error:"+Colors.FgYe+" Lamp"+Colors.FgCy+" is not connected"+Colors.FgGr+"."+Colors.R); res.send("error"); }
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
            console.log(Colors.FgGr+"Internal error:"+Colors.FgRe+"localDevice "+Colors.FgGre+"\"" + localdevices[i].device != undefined ? localdevices[i].device.name : "" + "\""+Colors.FgRe+" already exists"+Colors.FgGr+"."+Colors.R);
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
                    } catch (err:any) { console.log("err: " + err.stack + "  ln800") }
                });
            } else {
                console.log(Colors.FgGr+"Internal error:"+Colors.FgCy+"localdevices"+Colors.FgGr+"["+Colors.FgYe+i+Colors.FgGr+"]."+Colors.FgCy+"Rest"+Colors.FgGr+"["+Colors.FgYe+j+Colors.FgGr+"]"+Colors.FgRe+" is not of type "+Colors.FgGre+" function"+Colors.FgGr+"."+Colors.R+Colors.R);
            }
        });
    }
});
//#endregion

var server:any = app.listen(8081, function () {
    //var host:string = server.address().address;
    var port:number = server.address().port;
    console.log(Colors.FgGr+"Public web execution page is running at http://"+ getIp() +Colors.FgGr+":"+Colors.FgYe+ port +Colors.R);
});