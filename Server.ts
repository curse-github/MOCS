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
import { cloneObject, getIp, assert, assertIsObject, assertIsString, Func, Device, cmd, cmdData, command, connection } from "./Lib"
console.clear();

var devices:{[key:string]:Device|null} = {
    "self": {
        "name":"self",
        "functions":{
            "authenticate":{"name":"authenticate","parameters":[{"name":"username","type":"string","nullable":false}, {"name":"password","type":"string","nullable":false},{"name":"createDevice","type":"bool","nullable":true,"public":false}],"public":false},
            "callback":{"name":"callback","parameters":[{"name":"callback","type":"number","nullable":false}, {"name":"returnVal","type":"string","nullable":false}],"public":false},
            "subscribeConnection":{"name":"subscribeConnection","parameters":[{"name":"deviceName","type":"string","nullable":false},{"name":"callbackDeviceName","type":"string","nullable":false},{"name":"callbackFunctionName","type":"string","nullable":false}],"public":false},
            "subscribeDisconnection":{"name":"subscribeDisconnection","parameters":[{"name":"deviceName","type":"string","nullable":false},{"name":"callbackDeviceName","type":"string","nullable":false},{"name":"callbackFunctionName","type":"string","nullable":false}],"public":false},
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
    keys = keys.filter((item) => { return !item.startsWith("web"); })
    for(var i:number = 1; i < keys.length; i++) {
        pings[keys[i]] = false;
        if (devices[keys[i]] != null && websockets[keys[i]] != null && keys[i] != "self") {
            websockets[keys[i]].send("{\"type\":\"ping\", \"data\":\"" + keys[i] + "\"}");
        }
    }
    setTimeout(() => {
        //after half a second see which of the devices responded with a pong
        var keys2:Array<string> = Object.keys(devices);
        keys2 = keys2.filter((item) => { return !item.startsWith("web"); })
        for(var i:number = 0; i < keys2.length; i++) {
            if (devices[keys2[i]] != null && keys2[i] != "self") {
                if (!pings[keys2[i]]) {
                    //and if they didnt count them as disconnected and remove them from the database
                    if (!keys2[i].startsWith("web")) { console.log("Device \"" + keys2[i] + "\" disconnected."); }
                    if (websockets[keys2[i]] != null) { websockets[keys2[i]].close(); delete websockets[keys2[i]]; }
                    delete devices[keys2[i]];

                    if (disconnectionSubscriptions[keys2[i].toLowerCase()] != null && (typeof disconnectionSubscriptions[keys2[i].toLowerCase()]) == "object" && Array.isArray(disconnectionSubscriptions[keys2[i].toLowerCase()])) {
                        for(var j:number = 0; j < disconnectionSubscriptions[keys2[i].toLowerCase()].length; j++) {
                            handleCommand(JSON.parse("{\"type\":\"command\",\"data\":{\"device\":\"" + disconnectionSubscriptions[keys2[i].toLowerCase()][j][0] + "\",\"function\":\"" + disconnectionSubscriptions[keys2[i].toLowerCase()][j][1] + "\",\"parameters\":[\"" + keys2[i] + "\"]}}"));
                        }
                    }
                    if (disconnectionSubscriptions["any"] != null && (typeof disconnectionSubscriptions["any"]) == "object" && Array.isArray(disconnectionSubscriptions["any"])) {
                        for(var j:number = 0; j < disconnectionSubscriptions["any"].length; j++) {
                            if (websockets[disconnectionSubscriptions["any"][j][0]] != null) {
                                websockets[disconnectionSubscriptions["any"][j][0]].send(JSON.stringify({
                                    type:"command",
                                    data:disconnectionSubscriptions["any"][j][1] + "()",
                                    parameters:[keys2[i]]
                                }));
                            }
                        }
                    }
                    break;
                }
            }
        }
    }, 100);
}

const socketport:number = 42069;
var ws:any = new WebSocket.Server({ "port": socketport })
console.log("Websocket api is running on ws://" + getIp() + ":" + socketport);
setInterval(() => {
    pingDevices();//ping devices
}, 30*1000);//30 seconds
ws.on('connection', (websocket:any) => {
    //ping all devices to see figure out which one disconnected
    websocket.on('close', function (reasonCode:number, description:string) { pingDevices(); });
    websocket.on('message', (message:string) => {
        try {
            var msg:cmd = JSON.parse(message);
            if (msg.type != null) {
                //find example messages in Lib.ts
                switch(msg.type) {
                    case "connection": {
                        //check if valid data
                        //needs to have either nested objects or functions to call
                        var connected:boolean = false;
                        if (msg.data != null && msg.data.name != null) {
                            if ((msg.data.devices != null && Object.keys(msg.data.devices).length > 0) || 
                            (msg.data.functions != null && Object.keys(msg.data.functions).length > 0)) {
                                if (websockets[msg.data.name.toLowerCase()] == null && devices[msg.data.name.toLowerCase()] == null) {
                                    //add device data to list
                                    devices[msg.data.name.toLowerCase()] = msg.data;
                                    //add websocket connection to list
                                    websockets[msg.data.name.toLowerCase()] = websocket;
                                    //response
                                    websocket.send("{\"reply\" : \"succes\"" + (msg.id != null ? ", \"id\" : " + msg.id : "") + "}");
                                    console.log("Device \"" + msg.data.name + "\" conneced.");
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
                            if (msg.data.name != null) { console.log("invalid device connection from \"" + msg.data.name + "\"");
                            } else { console.log("invalid device connection from \"unknown\""); }
                        }
                        break;
                    }
                    case "command": {
                        //console.log("command: \n" + message + "\n");
                        if (msg.data != null) {
                            if (msg.data.device != null && msg.data.function != null && msg.data.parameters != null) {
                                var cmd:command = msg as command;
                                handleCommand(cmd, websocket);
                            } else { console.log("invalid command.    ln208"); console.log(msg); }
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
                    default: { console.log("unknown message type: " + msg.type + "    ln222"); }
                }
            }
        } catch (err:any) { console.log(message); console.log(err.stack + "    ln225");}
    });
});
function handleCommand(msg:string|command, websocket?:any) {
    if ((typeof msg) == "string") {
        assertIsString(msg);
        var json:command;
        try {
            json = JSON.parse(msg);
            if (json != null) {
                handleCommand(json);
            }
        } catch (err:any) { console.log(err.stack + "    ln233"); }
    } else if ((typeof msg) == "object"){
        assert(typeof msg == "object")
        if (msg.data.device.split(".")[0].toLowerCase() == "self") {
            var _switch:{[key:string]:Function} = {
                "authenticate()": function (parameters:Array<string>) { //used for web execution page
                    if (parameters != null && parameters.length > 1) {
                        var condition2:boolean = false
                        for (let i = 0; i < Accounts.length; i++) {
                            if (Accounts[i].username == parameters[0] && Accounts[i].password == parameters[1]) {
                                condition2 = true;
                                break;
                            }
                        }
                        if (condition2) {//login is valid
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
                            if (parameters[2]) {
                                setTimeout(() => {
                                    for(var i = 0; i < 10; i++) {
                                        if (devices["web" + i] == null) {
                                            websocket.send("{\"type\":\"authentication\",\"status\":true,\"deviceId\":\"" + "web" + i + "\",\"data\":" + JSON.stringify(devicesClone) + (msg.id != null ? ",\"id\":" + msg.id : "") + "}")
                                            websockets["web" + i] = websocket;
                                            devices["web" + i] = {
                                                name: "web" + i,
                                                functions:{
                                                    "connect":{
                                                        name:"connect",
                                                        parameters:[
                                                            {name:"device",type:"string",nullable:false}
                                                        ],
                                                        public:true
                                                    },
                                                    "disconnect":{
                                                        name:"disconnect",
                                                        parameters:[
                                                            {name:"device",type:"string",nullable:false}
                                                        ],
                                                        public:true
                                                    }
                                                },
                                                devices: {},
                                                public:false
                                            }
                                            break;
                                        }
                                    }
                                }, 125);
                            } else {
                                websocket.send("{\"type\":\"authentication\",\"status\":true,\"data\":" + JSON.stringify(devicesClone) + (msg.id != null ? ",\"id\":" + msg.id : "") + "}")
                            }
                        } else {
                            var string:string|null = null
                            if (((parameters[0].toLowerCase() == "root" && parameters[1].toLowerCase() == "root") || (parameters[1].toLowerCase() == "admin" && parameters[0].toLowerCase() == "admin") || parameters[1].toLowerCase() == "password" || parameters[1].toLowerCase() == "1234" || parameters[1].toLowerCase() == "password1234")) { string = "Nice try."; }
                            else {
                                var hints:Array<string> = [ "hint: html", "hint: It's not that.", "hint: Try something else.", "Maybe next time.", "You really thought it would be that?" ];
                                string = hints[Math.round(Math.random()*(hints.length-1))];
                            }
                            websocket.send("{\"type\":\"authentication\",\"status\":false,\"data\":\"" + string + "\"" + (msg.id != null ? ",\"id\":" + msg.id : "") + "}");
                        }
                    }
                },
                "callback()": function (parameters:Array<number|string>) {
                    if (callbacks[Number(parameters[0])] != null) {
                        callbacks[Number(parameters[0])](parameters[1],Number(parameters[0]));
                        delete callbacks[Number(parameters[0])];
                    }
                },
                "subscribeconnection()": function (parameters:Array<string>) {
                    if (parameters != null && parameters.length > 1) {
                        if (websockets[parameters[0].toLowerCase()] == null) {
                            if (connectionSubscriptions[parameters[0].toLowerCase()] == null) {
                                connectionSubscriptions[parameters[0].toLowerCase()] = [];
                            }
                            connectionSubscriptions[parameters[0].toLowerCase()].push([parameters[1],parameters[2]]);
                        } else {
                            handleCommand(JSON.parse("{\"type\":\"command\",\"data\":{\"device\":\"" + parameters[1] + "\",\"function\":\"" + parameters[2] + "\",\"parameters\":[\"" + parameters[0] + "\"]}}"));
                        }
                    } else { console.log("error"); }
                },
                "subscribedisconnection()": function (parameters:Array<string>) {
                    if (parameters != null && parameters.length > 1) {
                        if (websockets[parameters[0].toLowerCase()] == null) {
                            if (disconnectionSubscriptions[parameters[0].toLowerCase()] == null) {
                                disconnectionSubscriptions[parameters[0].toLowerCase()] = [];
                            }
                            disconnectionSubscriptions[parameters[0].toLowerCase()].push([parameters[1],parameters[2]]);
                        } else {
                            handleCommand(JSON.parse("{\"type\":\"command\",\"data\":{\"device\":\"" + parameters[1] + "\",\"function\":\"" + parameters[2] + "\",\"parameters\":[\"" + parameters[0] + "\"]}}"));
                        }
                    } else { console.log("error"); }
                }
            }
            Object.keys(localdevices).forEach((i) => {
                var temp:{[key:string]:Function} = Object.assign({}, _switch, localdevices[i].functions);
                _switch = temp;
            });
            var nm:string = (msg.data.device.substring(5)).toLowerCase() + (((msg.data.device.substring(5)) != "") ? "." : "") + msg.data.function.toLowerCase() + "()"
            if (_switch[nm] != null) {
                _switch[nm](msg.data.parameters, websocket);
            } else { console.log(nm + "    ln335") }
        } else {
            var lst:Array<boolean|string|{[key:string]:string}> = findFunction(devices,msg.data);
            var websocket:any;
            var message:string;
            websocket = lst[0];
            if (websockets[websocket] != null && websocket != false) {
                //console.log("sent:  " + message);
                assertIsString(lst[1]);
                message = lst[1];
                websockets[websocket].send(message);
            } else {
                console.log("invalid command    ln345");
                console.log(msg.data);
            }
        }
    }
}
function findFunction(list:{[key:string]:Device|null},data:cmdData,type?:number) : Array<boolean|string|{[key:string]:string}>{
    if (list != null && (typeof list) == "object" && !Array.isArray(list) && data != null) {
        var deviceName:string = data.device;
        if (!data.device.includes(".")) {
            // if there is only one level deep, find it and its function, and call it
            const device:Device = list[deviceName.toLowerCase()]!;
            data.function    = data.function.toLowerCase();
            if ((device != null && Object.keys(device.functions).length > 0) && (device.functions[data.function] != null && websockets[deviceName.toLowerCase()] != null)) {
                const funcParams:{//parameter
                    name:string
                    type:string
                    nullable?:boolean
                    public?:boolean
                    defaultValue?:string
                }[] = device.functions[data.function]!.parameters;
                var condition:boolean = true;
                for (var i:number = 0; i <funcParams.length; i++) {
                    // check that parameter type matches expected type
                    if (data.parameters[i] == null || data.parameters[i] == "null") {
                        if (funcParams[i].nullable == true || funcParams[i].nullable == true) {
                            if (data.parameters[i] == "null") { data.parameters[i] = null; }
                            continue;
                        } else { condition = false; break; } // invalid
                    } else if ((typeof data.parameters[i]) == "number" || (typeof data.parameters[i]) == "bigint") {
                        if (funcParams[i].type == "number") { continue;
                        } else { condition = false; break; } // invalid
                    } else if ((typeof data.parameters[i]) == "string") {
                        if (funcParams[i].type == "string") { continue;
                        } else if (funcParams[i].type == "bool" || funcParams[i].type == "boolean") {
                            //if the type is string but it expected boolean check id its the string "true" or "false".
                            if (data.parameters[i].toLowerCase() == "true") {
                                data.parameters[i] = true; continue;
                            } else if (data.parameters[i].toLowerCase() == "false") {
                                data.parameters[i] = false; continue;
                            } else { condition = false; break; } // invalid
                        } else { condition = false; break; } // invalid
                    } else if ((typeof data.parameters[i]) == "boolean") {
                        if (funcParams[i].type == "bool" || funcParams[i].type == "boolean") { continue;
                        } else { condition = false; break; } // invalid
                    }
                }
                if (condition) {
                    if (type == 2) {
                        return [{ "type" : "command", "data" : data.function + "()", "parameters" : JSON.stringify(data.parameters) }];
                    } else if (type == null || type == 1) {
                        return [deviceName, "{\"type\":\"command\",\"data\":\"" + data.function + "()\", \"parameters\":" + JSON.stringify(data.parameters) + "}"];
                    }
                } else { console.log("function parameters to not match"); return [false]; }// invalid command
            } else {
                if (device == null) {
                    console.log("device not found");
                } else if (Object.keys(device.functions).length <= 0) {
                    console.log("device does not contain functions");
                } else if (device.functions[data.function] == null) {
                    console.log("function not found in device");
                }
                return [false];
            }// invalid command
        } else {
            // if there is more than one call the function recursively untill it finds the data it was looking for, returning the first it finds
            var deviceSplt:Array<string> = deviceName.split(".");
            var shift:string|undefined = deviceSplt.shift();
            if (shift != undefined && list[shift] != null && Object.keys(list[shift]!.devices!).length > 0 && websockets[shift] != null) {
                if (type == 2) {
                    var message:boolean|string|Object|any = findFunction(list[shift]!.devices!, {device:shift,function:data.function,parameters:data.parameters}, 2)[0];
                    if (message != false) {
                        message.data = shift + message.data;
                        return [message];
                    } else {
                        return [false];
                    }
                } else if (type == null || type == 1) {
                    var message:boolean|string|Object|any = findFunction(devices, {device:shift,function:data.function,parameters:data.parameters}, 2)[0];
                    if (message != false) {
                        return [shift, JSON.stringify(message)]
                    } else {
                        return [false];
                    }
                }
            }
            console.log("invalid command    ln426");
            return [false];
        }
    }
    console.log("input invalid");
    return [false];
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
                "toggle"      :{name:"Toggle"      ,parameters:[                                                               {name:"device",type:"string",nullable:true,defaultValue:Spotify.defaultAccount}],public:true},
                "play"        :{name:"Play"        ,parameters:[{name:"link"  ,type:"string",nullable:true ,defaultValue:""  },{name:"device",type:"string",nullable:true,defaultValue:Spotify.defaultAccount}],public:true},
                "pause"       :{name:"Pause"       ,parameters:[                                                               {name:"device",type:"string",nullable:true,defaultValue:Spotify.defaultAccount}],public:true},
                "skipnext"    :{name:"SkipNext"    ,parameters:[                                                               {name:"device",type:"string",nullable:true,defaultValue:Spotify.defaultAccount}],public:true},
                "skipprevious":{name:"SkipPrevious",parameters:[                                                               {name:"device",type:"string",nullable:true,defaultValue:Spotify.defaultAccount}],public:true},
                "volumeup"    :{name:"VolumeUp"    ,parameters:[{name:"amount",type:"number",nullable:false,defaultValue:"10"},{name:"device",type:"string",nullable:true,defaultValue:Spotify.defaultAccount}],public:true},
                "volumedown"  :{name:"VolumeDown"  ,parameters:[{name:"amount",type:"number",nullable:false,defaultValue:"10"},{name:"device",type:"string",nullable:true,defaultValue:Spotify.defaultAccount}],public:true},
                "setvolume"   :{name:"SetVolume"   ,parameters:[{name:"volume",type:"number",nullable:false,defaultValue:"50"},{name:"device",type:"string",nullable:true,defaultValue:Spotify.defaultAccount}],public:true},
                "authenticate":{name:"Authenticate",parameters:[                                                                                                                                              ],public:true}
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
            "spotify.toggle()"      : function (parameters:Array<string>) {
                Spotify.SpotifyToggle      (                        null,parameters[0])
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
                    console.log("spotify token error: " + req.query.error);
                }
            },
            "/SpotifyPlay"              :function (req:any, res:any) {
                Spotify.SpotifyPlay        (null                       , null, Spotify.defaultAccount).then((val:boolean           ) => { res.send(val                  ); }).catch((err:number) => { res.send("error"+err                 ); });
            },
            "/SpotifySkipNext"          :function (req:any, res:any) {
                Spotify.SpotifySkipNext    (                             null, Spotify.defaultAccount).then((val:boolean           ) => { res.send(val                  ); }).catch((err:number) => { res.send("error"+err                 ); });
            },
            "/SpotifySkipPrevious"      :function (req:any, res:any) {
                Spotify.SpotifySkipPrevious(                             null, Spotify.defaultAccount).then((val:boolean           ) => { res.send(val                  ); }).catch((err:number) => { res.send("error"+err                 ); });
            },
            "/SpotifyPause"             :function (req:any, res:any) {
                Spotify.SpotifyPause       (                                   Spotify.defaultAccount).then((val:boolean           ) => { res.send(val                  ); }).catch((err:number) => { res.send("error"+err                 ); });
            }, 
            "/SpotifyToggle"            :function (req:any, res:any) {
                Spotify.SpotifyToggle      (                             null, Spotify.defaultAccount).then((val:boolean           ) => { res.send(val                  ); }).catch((err:number) => { res.send("error"+err                 ); });
            },
            "/SpotifyStatus"            :function (req:any, res:any) {
                Spotify.SpotifyStatus      (                                   Spotify.defaultAccount).then((val:[boolean,string[]]) => { res.send(JSON.stringify(val)  ); }).catch((err:number) => { res.send("[\"error" + err + "\", []]"); });
            },
            "/SpotifyVolumeUp"          :function (req:any, res:any) {
                Spotify.SpotifyVolumeUp    (null                       , null, Spotify.defaultAccount).then((val:boolean           ) => { res.send(val                  ); }).catch((err:number) => { res.send("error"+err                 ); });
            },
            "/SpotifyVolumeDown"        :function (req:any, res:any) {
                Spotify.SpotifyVolumeDown  (null                       , null, Spotify.defaultAccount).then((val:boolean           ) => { res.send(val                  ); }).catch((err:number) => { res.send("error"+err                 ); });
            },
            "/SpotifyVolumeUp/:amount"  :function (req:any, res:any) {
                Spotify.SpotifyVolumeUp    (parseInt(req.params.amount), null, Spotify.defaultAccount).then((val:boolean           ) => { res.send(val                  ); }).catch((err:number) => { res.send("error"+err                 ); });
            },
            "/SpotifyVolumeDown/:amount":function (req:any, res:any) {
                Spotify.SpotifyVolumeDown  (parseInt(req.params.amount), null, Spotify.defaultAccount).then((val:boolean           ) => { res.send(val                  ); }).catch((err:number) => { res.send("error"+err                 ); });
            },
            "/SpotifySetVolume/:volume":function (req:any, res:any) {
                Spotify.SpotifySetVolume   (parseInt(req.params.volume), null, Spotify.defaultAccount).then((val:boolean           ) => { res.send(val                  ); }).catch((err:number) => { res.send("error"+err                 ); });
            },
            "/SpotifyGetVolume":function (req:any, res:any) {
                Spotify.SpotifyGetVolume   (                                   Spotify.defaultAccount).then((val:number            ) => { res.send(val.toString()       ); }).catch((err:number) => { res.send("error"+err                 ); });
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
                    } else { console.log("Lamp not connected"); res.send("error"); }
                } catch (err:any) { console.log(err); }
            },
            "/LampOff":function (req:any, res:any) {
                try {
                    if (websockets["lamp"] != null) { websockets["lamp"].send("{\"type\":\"command\",\"data\":\"turnoff()\",\"parameters\":[]}"); res.send("false"); }
                    else { console.log("Lamp not connected"); res.send("error"); }
                } catch (err:any) { console.log(err); }
            },
            "/LampOn":function (req:any, res:any) {
                try {
                    if (websockets["lamp"] != null) { websockets["lamp"].send("{\"type\":\"command\",\"data\":\"turnon()\",\"parameters\":[]}"); res.send("true"); }
                    else { console.log("Lamp not connected"); res.send("error"); }
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
                    } else { console.log("Lamp not connected"); res.send("error"); }
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
            console.log("device \"" + localdevices[i].device != undefined ? localdevices[i].device.name : "" + "\" already exists.");
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
                    } catch (err:any) { console.log("err: " + err.stack + "  ln603") }
                });
            } else {
                console.log("error localdevices[" + i + "].Rest[" + j + "]");
            }
        });
    }
});
//#endregion

var server:any = app.listen(8081, function () {
    var host:string = server.address().address;
    var port:number = server.address().port;
    console.log("Public web execution page is running at http://" + getIp() + ":" + port);
 });