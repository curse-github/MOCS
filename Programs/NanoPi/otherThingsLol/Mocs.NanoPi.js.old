const WebSocket = require('ws')
const http = require("http");

var intervalId = null;
var interval2 = null;
var attemts = 0;
var spotify = "";
var lines = ["","","","","","","",""];

const spawn = require("child_process").spawn;

var subscriptions = [];

function setupSpotify() {
    interval2 = setInterval(function () {
        try {
            var options = {
                host: 'mc.campbellsimpson.com',
                port: 8081,
                path: '/SpotifyStatus'
            }
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
                                            host: 'mc.campbellsimpson.com',
                                            port: 8081,
                                            path: '/SpotifySkipNext'
                                        }, function(response) {
                                            response.on('error', function (err) {
                                                console.log(err);
                                            });
                                        }).end();
                                    } catch (err) {
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
                                    } else {
                                        lines[0] = title.substring(0,13) + " -";
                                        setTimeout(() => {
                                            lines[1] = title.substring(13,13+15);
                                        }, 200);
                                    }
                                    setTimeout(() => {
                                        restore([lines[2],lines[3],lines[4],lines[5],lines[6]]);
                                    }, 250);
                                }
                            } else {
                                if (spotify != "") {
                                    spotify = "";
                                    lines[0] = " "; lines[1] = " ";
                                    restore([lines[2],lines[3],lines[4],lines[5],lines[6]]);
                                }
                            }
                        } else {
                            if (spotify != "Spotify not connected.") {
                                spotify = "Spotify not connected.";
                                lines[0] = "Spotify not connected."; lines[1] = "";
                                restore([lines[2],lines[3],lines[4],lines[5],lines[6]]);
                            }
                        }
                    } catch (err) {
                        console.log(err.stack);
                    }
                });
                response.on('error', function (err) {
                    console.log(err);
                });
            }).end();
        } catch (err) {
            console.log(err.stack);
        }
    }, 5000);
}


function SetupWebsocket() {
    try {
        var _line = "{\"name\":\"line\",\"parameters\":[{\"name\":\"lineNum\",\"type\":\"number\",\"nullable\":false,\"defaultValue\":1},{\"name\":\"text\",\"type\":\"string\",\"nullable\":true}]}";
        var _clear = "{\"name\":\"clear\",\"parameters\":[]}";
        var _restore = "{\"name\":\"restore\",\"parameters\":[" +
        "{\"name\":\"line1\",\"type\":\"string\",\"nullable\":true,\"defaultValue\":\"-_-_-_-_-_-_-_-_\"}," +
        "{\"name\":\"line2\",\"type\":\"string\",\"nullable\":true,\"defaultValue\":\"-_-_-_-_-_-_-_-_\"}," +
        "{\"name\":\"line3\",\"type\":\"string\",\"nullable\":true,\"defaultValue\":\"-_-_-_-_-_-_-_-_\"}," +
        "{\"name\":\"line4\",\"type\":\"string\",\"nullable\":true,\"defaultValue\":\"-_-_-_-_-_-_-_-_\"}," +
        "{\"name\":\"line5\",\"type\":\"string\",\"nullable\":true,\"defaultValue\":\"-_-_-_-_-_-_-_-_\"}," +
        "{\"name\":\"line6\",\"type\":\"string\",\"nullable\":true,\"defaultValue\":\"-_-_-_-_-_-_-_-_\"}]}";
        var _subscribe = "{\"name\":\"subscribe\",\"public\":false,\"parameters\":[{\"name\":\"button\",\"type\":\"number\",\"nullable\":false},{\"name\":\"name\",\"type\":\"string\",\"nullable\":false},{\"name\":\"function\",\"type\":\"string\",\"nullable\":false}]}";
        var _waspressed = "{\"name\":\"wasPressed\",\"parameters\":[{\"name\":\"button\",\"type\":\"number\",\"nullable\":false}]}";
        ws.send("{\"type\":\"connection\",\"data\":{\"name\":\"NanoPi\",\"functions\":{\"line\":" + _line + ",\"clear\":" + _clear + ",\"restore\":" + _restore + ",\"subscribe\":" + _subscribe + ",\"waspressed\":" + _waspressed + "},\"devices\":{}}}");
        ws.onerror = function (error) { console.log("{\"error\" : " + error + "}"); };
        ws.onmessage = function (event) {
            try {
                var msg = JSON.parse(event.data);
                if (msg.type != null) {
                    if (msg.type == "command" && msg.data != null) {
                        if (msg.data.split("(")[0].split(".").length == 1) {
                            var _switch = {
                                "line()" : function (parameters) {
                                    line(parameters[0], parameters[1], true);
                                },
                                "clear()": function () {
                                    clear(true);
                                },
                                "restore()": function (parameters) {
                                    restore(parameters, true);
                                },
                                "subscribe()": function (parameters) {
                                    subscribe(parameters[0], parameters[1], parameters[2], parameters[3]);
                                },
                                "waspressed()": function (parameters) {
                                    wasPressed(parameters[0], ws);
                                }
                            }
                            if (msg.parameters != null && msg.parameters.length > 0) { _switch[msg.data.toLowerCase()](msg.parameters); }
                            else { _switch[msg.data.toLowerCase()](); }
                        } else { return; }
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
            clearInterval(interval2);
            interval2 = null;
        }
        setupSpotify();
    } catch (err) {
        console.log(err.stack);
    }
}
var ws = new WebSocket("ws://192.168.1.37:42069");
ws.onerror = function (event) {
    console.log("Unable to connect to MOCS server.");
    tryReconnect();
    ws = null;
    clearInterval(interval2);
    interval2 = null;
}
ws.onopen = function () {
    SetupWebsocket();
};
function tryReconnect() {
    intervalId = setInterval(function () {
        if (ws == null) {
            attemts++;
            console.log("Attempt #" + attemts + " to connect to the MOCS server.");
            ws = new WebSocket("ws://192.168.1.37:42069")
            ws.onerror = function (event) { try {ws.close();} catch (err) {console.log(err.stack); } ws = null; };
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

function line(lineNum, text, bool) {
    _lineNum = Math.min(Math.max(Number.parseFloat(lineNum),0),5);
    lines[_lineNum+2] = ((text == null || text == "" || text == "null") ? " " : text);
    restore([lines[2],lines[3],lines[4],lines[5],lines[6],lines[7]])
}
function clear(bool) {
    restore([" "," "," "," "," "," "]);
}
function restore(linesList, bool) {
    for (var i = 0; i < (linesList.length < 6 ? linesList.length : 6); i++) {
        lines[i+2] = (((linesList[i] == null || linesList[i] == "" || linesList[i] == "null") ? " " : linesList[i]));
    }
    var lst = [lines[0],lines[1],lines[2],lines[3],lines[4],lines[5],lines[6],lines[7]];
    console.log("sudo python /home/pi/restore.py " + lst.map(el=>"\""+el+"\"").join(" "));
    lst.unshift("/home/pi/restore.py");
    spawn("python",lst);
}
function subscribe(button, name, _function, parameter) {
    if (subscriptions != null) {
        for (var i = 0; i < subscriptions.length; i++) {
            if (JSON.stringify(subscriptions[i]) == JSON.stringify({"button":button, "name":name, "function":_function, "parameter":parameter})) {
                return;
            }
        }
        var found = false;
        for (var i = 0; i < subscriptions.length + 1; i++) {
            if (!found && subscriptions[i] == null) {
                found = true;
                subscriptions[i] = {"button":button, "name":name, "function":_function, "parameter":parameter};
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
                command = "{\"type\":\"command\",\"data\":{\"device\":\"" + subscriptions[i].name + "\",\"function\":\"" + subscriptions[i].function + "\",\"parameters\":[" + ((subscriptions[i].parameter != null && subscriptions[i].parameter != "") ? subscriptions[i].parameter : button) + "]},\"id\":" + i + "}";
                websocket.send(command);
            }
        }
    }
}