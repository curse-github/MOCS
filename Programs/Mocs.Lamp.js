const WebSocket = require('ws')
var intervalId;
var attemts = 0;
const spawn = require("child_process").spawn;

var isOn = false;

function SetupWebsocket() {
    console.clear();
    var _toggle = "{\"name\":\"toggle\",\"parameters\":[{\"name\":\"button\",\"type\":\"number\",\"nullable\":true,\"public\":false},{\"name\":\"CallbackFunction\",\"type\":\"string\",\"nullable\":true,\"public\":false}]}";
    var _turnOn = "{\"name\":\"turnOn\",\"parameters\":[]}";
    var _turnOff = "{\"name\":\"turnOff\",\"parameters\":[]}";
    var _status = "{\"name\":\"status\",\"parameters\":[{\"name\":\"CallbackFunction\",\"type\":\"string\",\"nullable\":true}],\"public\":false}";
    var _buttonConnect = "{\"name\":\"buttonConnect\",\"parameters\":[{\"name\":\"device\",\"type\":\"string\",\"nullable\":true}],\"public\":false}";
    ws.send("{\"type\":\"connection\",\"data\":{\"name\":\"Lamp\",\"functions\":{\"toggle\":" + _toggle + ",\"turnon\":" + _turnOn + ",\"turnoff\":" + _turnOff + ",\"status\":" + _status + ",\"buttonconnect\":" + _buttonConnect + "},\"devices\":{}}}");
    ws.send("{\"type\":\"command\",\"data\":{\"device\":\"self\",\"function\":\"subscribeConnection\",\"parameters\":[\"nanopi\",\"lamp\",\"buttonConnect\"]}}");
    ws.onerror = function (error) { console.log("{\"error\" : " + error + "}"); };
    ws.onmessage = function (event) {
        try {
            var msg = JSON.parse(event.data);
            if (msg.type != null) {
                if (msg.type == "command" && msg.data != null) {
                    if (msg.data.split("(")[0].split(".").length == 1) {
                        var _switch = {
                            "toggle()" : function (parameters) {
                                toggle(parameters);
                            },
                            "turnon()": function () {
                                turnOn();
                            },
                            "turnoff()": function () {
                                turnOff();
                            },
                            "status()": function (parameters) {
                                status(parameters[0]);
                            },
                            "buttonconnect()": function (parameters) {
                                ws.send("{\"type\":\"command\",\"data\":{\"device\":\"NanoPi\",\"function\":\"Subscribe\",\"parameters\":[1,\"lamp\",\"toggle\"]}}");
                            }
                        }
                        if (msg.parameters != null && msg.parameters.length > 0) { _switch[msg.data.toLowerCase()](msg.parameters); }
                        else { _switch[msg.data.toLowerCase()](); }
                    } else {}
                } else if (msg.type = "ping" && msg.data != null) {
                    ws.send("{\"type\":\"pong\",\"data\":\"" + msg.data + "\"}");
                }
            } else if (msg.status != null) {
                if (msg.status == "failure") {
                    if (msg.id != null && subscriptions[msg.id] != null) {
                        subscriptions[msg.id] = null;
                    }
                }
            }
        } catch (err) { console.log(err); }
    }
    ws.onclose = function (event) {
        console.log("Lost connection to MOCS server.");
        tryReconnect();
        ws = null;
    }
}
var ws = new WebSocket("ws://192.168.1.37:42069");
ws.onerror = function (event) { console.log("Unable to connect to MOCS server."); tryReconnect(); ws = null; }
ws.onopen = function () {
    SetupWebsocket();
};

function tryReconnect() {
    intervalId = setInterval(function () {
        if (ws == null) {
            attemts++;
            console.log("Attempt #" + attemts + " to connect to the MOCS server.");
            ws = new WebSocket("ws://192.168.1.37:42069")
            ws.onerror = function (event) { try {ws.close();} catch (err) {} ws = null; };
            ws.onopen = function () {
                stopInterval();
                attemts = 0;
                SetupWebsocket();
            };
        }
    }, 20000);
}

function stopInterval() {
    clearInterval(intervalId);
    intervalId = null;
}

function toggle(parameters) {
    try {
        if (isOn) {
            spawn("python3",["lamp_off.py"]);
            isOn = false;
        } else {
            spawn("python3",["lamp_on.py"]);
            isOn = true;
        }
        var returnFunction = parameters[1];
        if (returnFunction != null && returnFunction != undefined && returnFunction != "null" && returnFunction != "") {
            if (returnFunction.includes("(") && returnFunction.includes(")")) {
                var lst = returnFunction.split("(")[0].split(".")
                var pop = lst.pop();
                if (lst.length >= 1) {
                    ws.send("{\"type\":\"command\",\"data\":{\"device\":\"" + lst.join(".") + "\",\"function\":\"" + pop + "\",\"parameters\":[" + returnFunction.split("(")[1].split(")")[0].replace("RETURN","\"" + (isOn ? "true" : "false")) + "\"]}}")
                }
            }
        }
    }
    catch (err) { console.log(err)}
}

function turnOn() {
    if (!isOn) {
        try {
            spawn("python3",["lamp_on.py"]);
            isOn = true;
        } catch (err) { console.log(err)}
    }
}
function turnOff() {
    if (isOn) {
        try {
            spawn("python3",["lamp_off.py"]);
            isOn = false;
        } catch (err) { console.log(err)}
    }
}
function status(returnFunction) {
    try {
        if (returnFunction != null && returnFunction != undefined && returnFunction != "null" && returnFunction != "") {
            if (returnFunction.includes("(") && returnFunction.includes(")")) {
                var lst = returnFunction.split("(")[0].split(".")
                var pop = lst.pop();
                if (lst.length >= 1) {
                    ws.send("{\"type\":\"command\",\"data\":{\"device\":\"" + lst.join(".") + "\",\"function\":\"" + pop + "\",\"parameters\":[" + returnFunction.split("(")[1].split(")")[0].replace("RETURN","\"" + (isOn ? "true" : "false")) + "\"]}}")
                }
            }
        }
    }
    catch (err) { console.log(err)}
}