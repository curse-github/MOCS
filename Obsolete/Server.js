const WebSocket = require('ws') // npm install ws
const express = require("express"); // npm install express
const { networkInterfaces } = require('os');
const fs = require('fs');
const Spotify = require("./Spotify.js");
console.clear();

var devices = {
    "self": {
        "name":"self", "functions":{
            "authenticate":{"name":"authenticate","parameters":[{"name":"username","type":"string","nullable":"false"}, {"name":"password","type":"string","nullable":"false"}],"public":false},
            "callback":{"name":"callback","parameters":[{"name":"callback","type":"number","nullable":"false"}, {"name":"returnVal","type":"string","nullable":"false"}],"public":false},
            "subscribeConnection":{"name":"subscribeConnection","parameters":[{"name":"deviceName","type":"string","nullable":"false"},{"name":"callbackDeviceName","type":"string","nullable":"false"},{"name":"callbackFunctionName","type":"string","nullable":"false"}],"public":false},
            "doorToggle":{"name":"doorToggle","parameters":[{"name":"buttonId","type":"number","nullable":"true","public":true}]},
        },
        "devices": {}
    }
};
var Accounts = [ {"username":"CamRS", "password":"Crs9503!"}, {"username":"SpotifyLogin", "password":"Password"}, {"username":"NanoLogin", "password":"Password"} ];
var pings = {};
var websockets = {};
var connectionSubscriptions = [];
var callbacks = [];

function cloneObject(thing) {
    if (thing != null && thing != undefined) {
        if ((typeof thing) == "object") {
            if (Array.isArray(thing)) {
                //list
                var clonedList = [];
                for (var i = 0; i < thing.length; i++) {
                    clonedList[i] = cloneObject(thing[i]);
                }
                return clonedList;
            } else {
                //object
                var keys = Object.keys(thing);
                var clonedObject = {};
                keys.forEach((i) => {
                    clonedObject[i] = cloneObject(thing[i]);
                });
                return clonedObject;
            }
        } else {
            return thing;
        }
    } else { return null; }
}
function pingDevices() {
    //send every device a "ping" message
    pings = [];
    var keys = Object.keys(devices);
    for(var i = 1; i < keys.length; i++) {
        pings[keys[i]] = false;
        if (devices[keys[i]] != null && websockets[keys[i]] != null && keys[i] != "self") {
            websockets[keys[i]].send("{\"type\":\"ping\", \"data\":\"" + keys[i] + "\"}");
        }
    }
    setTimeout(() => {
        //after half a second see which of the devices responded with a pong
        var keys2 = Object.keys(devices);
        for(var i = 0; i < keys2.length; i++) {
            if (devices[keys2[i]] != null && keys2[i] != "self") {
                if (!pings[keys2[i]]) {
                    //and if they didnt count them as disconnected and remove them from the database
                    console.log("Device \"" + keys2[i] + "\" disconnected.");
                    if (websockets[keys2[i]] != null) { websockets[keys2[i]].close(); websockets[keys2[i]] = null; }
                    var number = 1;
                    devices[keys2[i]] = null;
                }
            }
        }
    }, 500);
}

const socketport = "42069";
ws = new WebSocket.Server({ port: socketport })
console.log("Websocket api is running on ws://" + getIp() + ":" + socketport);
ws.on('connection', websocket => {
    //ping all devices to see figure out which one disconnected
    websocket.on('close', function (reasonCode, description) { pingDevices(); });
    websocket.on('message', (message) => {
        //#region examples
        // sent as the first message after connecting to websocket, needs to be sent before it will receive any commands
        var exampleConnection = {
            "type":"connection",
            "data":{
                "name":"deviceName",
                "functions":{
                    "function1Name":{
                        "name":"function1Name",
                        "parameters":[
                            {"name":"parameter1name","type":"string","nullable":false},
                            {"name":"parameter2name","type":"bool","nullable":false},
                            {"name":"parameter3name","type":"number","nullable":true}
                            //...
                        ],
                        "public":true
                    }
                    //...
                },
                "devices":{
                    "childDeviceName":{
                        "name":"childDeviceName",
                        "functions":{
                            "childDeviceFunction1Name":{
                                "name":"childDeviceFunction1Name",
                                "parameters":[
                                    {"name":"childDeviceParameter1Name","type":"string","nullable":false},
                                    {"name":"childDeviceParameter2Name","type":"bool","nullable":false},
                                    {"name":"childDeviceParameter3Name","type":"number","nullable":true}
                                    //...
                                ],
                                "public":false
                            }
                            //...
                        },
                        "devices":{
                            //...
                        }
                    }
                    //...
                }
            }
        };
        //sent as a client to call a function on a device
        var exampleCommand = { // this would represent device1.childDevice.functionName(123,"string",null,false);
            "type":"command",
            "data":{
                "device":"device1.childDevice",
                "function":"functionName",
                "parameters":[
                    123,
                    "string",
                    null,
                    false
                ]
            }
        };
        // must be sent within half a second of ping message
        var examplePong = {
            "type":"pong",
            "data":2 // used as an id, needs to match the data sent in the ping message
        };
        //#endregion
        try {
            var msg = JSON.parse(message);
            if (msg.type != null) {
                var switch1 = {
                    "connection": function() {
                        //check if valid data
                        //needs to have either nested objects or functions to call
                        var connected = false;
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
                                        handleCommand("{\"type\":\"command\",\"data\":{\"device\":\"nanopi\",\"function\":\"Subscribe\",\"parameters\":[1,\"self.spotify\",\"skipprevious\",\"\\\"Test\\\"\"]}}");
                                        handleCommand("{\"type\":\"command\",\"data\":{\"device\":\"nanopi\",\"function\":\"Subscribe\",\"parameters\":[2,\"self.spotify\",\"toggle\",\"\\\"Test\\\"\"]}}");
                                        handleCommand("{\"type\":\"command\",\"data\":{\"device\":\"nanopi\",\"function\":\"Subscribe\",\"parameters\":[3,\"self.spotify\",\"skipnext\",\"\\\"Test\\\"\"]}}");
                                    }

                                    if (connectionSubscriptions[msg.data.name.toLowerCase()] != null && (typeof connectionSubscriptions[msg.data.name.toLowerCase()]) == "object" && Array.isArray(connectionSubscriptions[msg.data.name.toLowerCase()])) {
                                        for(var i = 0; i < connectionSubscriptions[msg.data.name.toLowerCase()].length; i++) {
                                            handleCommand(JSON.parse("{\"type\":\"command\",\"data\":{\"device\":\"" + connectionSubscriptions[msg.data.name.toLowerCase()][i][0] + "\",\"function\":\"" + connectionSubscriptions[msg.data.name.toLowerCase()][i][1] + "\",\"parameters\":[\"" + msg.data.name + "\"]}}"));
                                        }
                                    }

                                }
                            }
                        }
                        if (!connected) {
                            if (msg.data.name != null) { console.log("invalid device connection from \"" + msg.data.name + "\"");
                            } else { console.log("invalid device connection from \"unknown\""); }
                        }
                    },
                    "command": function() {
                        //console.log("command: \n" + message + "\n");
                        if (msg.data != null) {
                            if (msg.data.device != null && msg.data.function != null && msg.data.parameters != null) {
                                handleCommand(msg, websocket);
                            } else { console.log("invalid command.    ln208"); console.log(msg); }
                        }
                    },
                    "pong": function() {
                        //when receiving back a ping call the callback after error checking
                        if (msg.data != null && (typeof msg.data) == "string") {
                            pings[msg.data] = true;
                        }
                    }
                }
                //code for the equivilent of a switch statement in nodejs
                if (switch1[msg.type] != null) {
                    switch1[msg.type]();
                } else {
                    console.log("unknown message type: " + msg.type + "    ln222");
                }
            }
        } catch (err) { console.log(message); console.log(err.stack + "    ln225");}
    });
});
function handleCommand(msg, websocket) {
    if ((typeof msg) == "string") {
        var json = null;
        try {
            json = JSON.parse(msg);
            if (json != null) {
                handleCommand(json);
            }
        } catch (err) { console.log(err.stack + "    ln233"); }
    } else if ((typeof msg) == "object"){
        if (msg.data.device.split(".")[0].toLowerCase() == "self") {
            var _switch = {
                "authenticate()": function (parameters) { //used for web execution page
                    if (parameters != null && parameters.length > 1) {
                        var condition2 = false
                        for (let i = 0; i < Accounts.length; i++) {
                            if (Accounts[i].username == parameters[0] && Accounts[i].password == parameters[1]) {
                                condition2 = true;
                                break;
                            }
                        }
                        if (condition2) {//login is valid
                            var devicesClone = cloneObject(devices);
                            var callback = function() {}
                            callback = function(objIn) {
                                var obj = cloneObject(objIn);
                                Object.keys(obj).forEach((i) => {
                                    if (obj[i] != null) {
                                        if (obj[i].devices != null) { obj[i].devices = callback(obj[i].devices); }
                                        Object.keys(obj[i].functions).forEach((j) => {
                                            if (obj[i].functions[j].public == false || obj[i].functions[j].public == "false") {
                                                obj[i].functions[j] = null;
                                            }
                                        });
                                    }
                                });
                                return obj;
                            }
                            devicesClone = callback(devicesClone);
                            websocket.send("{\"type\":\"authentication\",\"status\":true,\"data\":" + JSON.stringify(devicesClone) + (msg.id != null ? ",\"id\":" + msg.id : "") + "}")
                        } else {
                            var list = [ "hint: html", "hint: It's not that.", "hint: Try something else.", "Maybe next time.", "You really thought it would be that?" ];
                            if (((parameters[0].toLowerCase() == "root" && parameters[1].toLowerCase() == "root") || (parameters[1].toLowerCase() == "admin" && parameters[0].toLowerCase() == "admin") || parameters[1].toLowerCase() == "password" || parameters[1].toLowerCase() == "1234" || parameters[1].toLowerCase() == "password1234")) { list = ["Nice try."] }
                            var string = list[Math.round(Math.random()*(list.length-1))];
                            websocket.send("{\"type\":\"authentication\",\"status\":false,\"data\":\"" + string + "\"" + (msg.id != null ? ",\"id\":" + msg.id : "") + "}");
                        }
                    }
                },
                "callback()": function (parameters) {
                    callbacks[Number(parameters[0])](parameters[1],Number(parameters[0]));
                    callbacks[Number(parameters[0])] = null;
                },
                "subscribeconnection()": function (parameters) {
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
                "doortoggle()": function (parameters) {
                    DoorStatus = !DoorStatus;
                }
            }
            Object.keys(localdevices).forEach((i) => {
                var temp = Object.assign({}, _switch, localdevices[i].functions);
                _switch = temp;
            });
            var nm = (msg.data.device.substring(5)).toLowerCase() + (((msg.data.device.substring(5)) != "") ? "." : "") + msg.data.function.toLowerCase() + "()"
            if (_switch[nm] != null) {
                _switch[nm](msg.data.parameters, websocket);
            } else { console.log(nm + "    ln335") }
        } else {
            var lst = findFunction(devices,msg.data);
            var websocket, message;
            websocket = lst[0];
            message = lst[1];
            if (websockets[websocket] != null && websocket != false) {
                //console.log("sent:  " + message);
                websockets[websocket].send(message);
            } else {
                console.log("invalid command    ln345");
                console.log(msg.data);
            }
        }
    }
    
}
function findFunction(list,data,type) {
    if (list != null && (typeof list) == "object" && !Array.isArray(list) && data != null) {
        var splt = data.device.split(".");
        var len = splt.length;
        if (len == 0){ console.log("input err    ln356"); return [false]; }
        else if (len == 1) {
            // if there is only one level deep, find it and its function, and call it
            splt = splt[0].toLowerCase();
            data.function = data.function.toLowerCase();
            if ((list[splt] != null && Object.keys(list[splt].functions).length > 0) && (list[splt].functions[data.function] != null && websockets[splt] != null)) {
                var condition = true;
                for (var i = 0; i < list[splt].functions[data.function].parameters.length; i++) {
                    // check that parameter type matches expected type
                    if (data.parameters[i] == null || data.parameters[i] == "null") {
                        if (list[splt].functions[data.function].parameters[i].nullable == true || list[splt].functions[data.function].parameters[i].nullable == "true") {
                            if (data.parameters[i] == "null") { data.parameters[i] = null; }
                            continue;
                        } else { condition = false; break; } // invalid
                    } else if ((typeof data.parameters[i]) == "number" || (typeof data.parameters[i]) == "bigint") {
                        if (list[splt].functions[data.function].parameters[i].type == "number") { continue;
                        } else { condition = false; break; } // invalid
                    } else if ((typeof data.parameters[i]) == "string") {
                        if (list[splt].functions[data.function].parameters[i].type == "string") { continue;
                        } else if (list[splt].functions[data.function].parameters[i].type == "bool" || list[splt].functions[data.function].parameters[i].type == "boolean") {
                            //if the type is string but it expected boolean check id its the string "true" or "false".
                            if (data.parameters[i].toLowerCase() == "true") {
                                data.parameters[i] = true; continue;
                            } else if (data.parameters[i].toLowerCase() == "false") {
                                data.parameters[i] = false; continue;
                            } else { condition = false; break; } // invalid
                        } else { condition = false; break; } // invalid
                    } else if ((typeof data.parameters[i]) == "boolean") {
                        if (list[splt].functions[data.function].parameters[i].type == "bool" || list[splt].functions[data.function].parameters[i].type == "boolean") { continue;
                        } else { condition = false; break; } // invalid
                    }
                }
                if (condition) {
                    if (type == 2) {
                        return [{ "type" : "command", "data" : data.function + "()", "parameters" : JSON.stringify(data.parameters) }];
                    } else if (type == null || type == 1) {
                        return [splt, "{\"type\":\"command\",\"data\":\"" + data.function + "()\", \"parameters\":" + JSON.stringify(data.parameters) + "}"];
                    }
                } else { console.log("function parameters to not match"); return [false]; }// invalid command
            } else {
                if (list[splt] == null) {
                    console.log("device not found");
                } else if (Object.keys(list[splt].functions).length <= 0) {
                    console.log("device does not contain functions");
                } else if (list[splt].functions[data.function] == null) {
                    console.log("function not found in device");
                }
                return [false];
            }// invalid command
        } else {
            // if there is more than one call the function recursively untill it finds the data it was looking for, returning the first it finds
            var shift = splt.shift();
            if (list[shift] != null && Object.keys(list[shift].devices).length > 0 && websockets[shift] != null) {
                if (type == 2) {
                    var message = findFunction(list[shift].devices, splt, 2)[0];
                    if (message != false) {
                        message.data = shift + message.data;
                        return [message];
                    } else {
                        return [false];
                    }
                } else if (type == null || type == 1) {
                    var message = findFunction(devices, splt, 2)[0];
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
	if (results["Ethernet"] != null) {
		return results["Ethernet"][0];
	} else if (results["Wi-Fi"] != null) {
		return results["Wi-Fi"][0];
	}
}
var app = express();
app.get("/", function (req, res) {
	res.send(fs.readFileSync("C:/Users/Curse/Desktop/programming/nodejs/Mocs 2.0/Webserver/index.html", "utf8"));
});
["/index.html","/index.js"].forEach((i) => {
    app.get(i, function (req, res) {
        res.send(fs.readFileSync("C:/Users/Curse/Desktop/programming/nodejs/Mocs 2.0/Webserver" + i, "utf8"));
    });
});
//#region LocalDevices
var localdevices = {
    "Spotify":{
        "device":{
            "name":"Spotify",
            "functions":{
                "toggle":{"name":"Toggle","parameters":[{"name":"device","type":"string","nullable":"true","defaultValue":"Test"}],"public":true},
                "play":{"name":"Play","parameters":[{"name":"link","type":"string","nullable":"true","defaultValue":""},{"name":"device","type":"string","nullable":"true","defaultValue":"Test"}],"public":true},
                "pause":{"name":"Pause","parameters":[{"name":"device","type":"string","nullable":"true","defaultValue":"Test"}],"public":true},
                "skipNext":{"name":"SkipNext","parameters":[{"name":"device","type":"string","nullable":"true","defaultValue":"Test"}],"public":true},
                "skipPrevious":{"name":"SkipPrevious","parameters":[{"name":"device","type":"string","nullable":"true","defaultValue":"Test"}],"public":true},
                "authenticate":{"name":"Authenticate","parameters":[],"public":true}
            },
            "devices":[]
        },
        "functions":{
            "spotify.authenticate()": function (parameters, websocket) {
                websocket.send("{\"type\":\"redirect\",\"data\":\"" + Spotify.Link + "\"}");
            },
            "spotify.play()": function (parameters) {
                Spotify.SpotifyPlay(parameters[0],null,parameters[1]).then((val) => { }).catch((err) => {});
            },
            "spotify.pause()": function (parameters) {
                Spotify.SpotifyPause(null,parameters[0]).then((val) => {}).catch((err) => {});
            },
            "spotify.toggle()": function (parameters) {
                Spotify.SpotifyToggle(null,parameters[0]).then((val) => {}).catch((err) => {});
            },
            "spotify.skipnext()": function (parameters) {
                Spotify.SpotifySkipNext(null,parameters[0]).then((val) => {}).catch((err) => {});
            },
            "spotify.skipprevious()": function (parameters) {
                Spotify.SpotifySkipPrevious(null,parameters[0]).then((val) => {}).catch((err) => {});
            }
        },
        "Rest":{
            "/SetSpotifyToken":function (req, res) {
                if (req.query.error == null) {
                    if (req.query.code != null) {
                        res.send("<html><script>function func() { window.location.href = 'http://mc.campbellsimpson.com:8081' } func();</script></html>");
                        Spotify.GetSpotifyToken(req.query.code);
                    }
                } else {
                    console.log("spotify token error: " + req.query.error);
                }
            },
            "/SpotifyPlay":function (req, res) {
                Spotify.SpotifyPlay(null,null,"Test").then((val) => { res.send(val); }).catch((err) => { res.send("null") });
            },
            "/SpotifySkipNext":function (req, res) {
                Spotify.SpotifySkipNext(null, "Test").then((val) => { res.send(val); }).catch((err) => { res.send("null") });
            },
            "/SpotifySkipPrevious":function (req, res) {
                Spotify.SpotifySkipPrevious(null, "Test").then((val) => { res.send(val); }).catch((err) => { res.send("null") });
            },
            "/SpotifyPause":function (req, res) {
                Spotify.SpotifyPause(null,"Test").then((val) => { res.send(val); }).catch((err) => { res.send("null") });
            }, 
            "/SpotifyToggle":function (req, res) {
                Spotify.SpotifyToggle(null, "Test").then((val) => { res.send(val); }).catch((err) => { res.send("null") });
            },
            "/SpotifyStatus":function (req, res) {
                Spotify.SpotifyStatus("Test").then((val) => { res.send("["+val[0]+", [\""+val[1]+"\", \""+val[2]+"\"]]"); }).catch((err) => {res.send("[\"error\", []]") });;
            }
        }
    },
    "Lamp":{
        "Rest":{
            "/LampToggle":function (req, res) {
                try {
                    if (websockets["lamp"] != null) {
                        for(var i = 0; i <= callbacks.length; i++) {
                            if (callbacks[i] == null) {
                                callbacks[i] = function(Return,callbackID) {
                                    callbacks[callbackID] = null;
                                    res.send(Return);
                                }
                                websockets["lamp"].send("{\"type\":\"command\",\"data\":\"toggle()\",\"parameters\":[1,\"self.callback(" + i + ",RETURN)\"]}");
                                return;
                            }
                        }
                    } else { console.log("Lamp not connected"); res.send("error"); }
                } catch (err) { console.log(err); }
            },
            "/LampOff":function (req, res) {
                try {
                    if (websockets["lamp"] != null) { websockets["lamp"].send("{\"type\":\"command\",\"data\":\"turnoff()\",\"parameters\":[]}"); res.send("false"); }
                    else { console.log("Lamp not connected"); res.send("error"); }
                } catch (err) { console.log(err); }
            },
            "/LampOn":function (req, res) {
                try {
                    if (websockets["lamp"] != null) { websockets["lamp"].send("{\"type\":\"command\",\"data\":\"turnon()\",\"parameters\":[]}"); res.send("true"); }
                    else { console.log("Lamp not connected"); res.send("error"); }
                } catch (err) { console.log(err); }
            },
            "/LampStatus":function (req, res) {
                try {
                    if (websockets["lamp"] != null) {
                        for(var i = 0; i < callbacks.length + 1; i++) {
                            if (callbacks[i] == null) {
                                callbacks[i] = function(Return,callbackID) {
                                    callbacks[callbackID] = null;
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
        if (devices.self.devices[localdevices[i].device.name.toLowerCase()] == null) {
            devices.self.devices[localdevices[i].device.name.toLowerCase()] = localdevices[i].device
        } else {
            console.log("device \"" + localdevices[i].device.name + "\" already exists.");
        }
    }
});
//add localdevices to rest
Object.keys(localdevices).forEach((i) => {
    if (localdevices[i].Rest != null) {
        Object.keys(localdevices[i].Rest).forEach((j) => {
            if ((typeof localdevices[i].Rest[j]) == "function") {
                app.get(j,function(req, res) {
                    try { localdevices[i].Rest[j](req, res);
                    } catch (err) { console.log("err: " + err.stack + "  ln603") }
                });
            } else {
                console.log("error localdevices[" + i + "].Rest[" + j + "]");
            }
        });
    }
});
//#endregion

var server = app.listen(8081, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log("Public web execution page is running at http://" + getIp() + ":" + port);
 });