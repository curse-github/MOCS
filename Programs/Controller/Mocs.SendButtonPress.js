const WebSocket = require('ws')

var ws = new WebSocket("ws://192.168.1.37:42069");
ws.onerror = function (event) { console.log("Unable to connect to MOCS server."); }
ws.onopen = function () {
    ws.send("{\"type\":\"command\",\"data\":{\"device\":\"controller\",\"function\":\"wasPressed\",\"parameters\":[" + process.argv.slice(2)[0] + "]}}");
    setTimeout(() => { ws.close(); }, 500);
};