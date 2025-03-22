function generateUUID() {
    let a = new Date().getTime();// Timestamp
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
        let b = Math.random() * 16;// random number between 0 and 16
        b = (a + b) % 16 | 0;
        a = Math.floor(a / 16);
        return (c === "x" ? b : ((b & 0x3) | 0x8)).toString(16);
    });
}
const url = "mocs.campbellsimpson.com";
let ws = null;
let connected = false;
let connecting = false;
let returnIdToCallback = {};
let callQueue = [];
let numConnectedDevices = 0;
let updateCallbacks = {};
function setup() {
    connecting = true;
    messageElement.innerText = "Connecting to MOCS.";
    ws = new WebSocket("wss://" + url + "/ws");
    ws.onclose = () => {
        console.log("Websocket closed.");
        connected = false;
        ws = null;
        containerElement.innerText = "";
        messageElement.innerText = "MOCS server is not reachable.";
        numConnectedDevices = 0;
        setup();
    }
    ws.onerror = () => {
        console.log("Websocket error.");
        if (ws.readyState == ws.OPEN)
            ws.close();
    }
    ws.onopen = () => {
        console.clear();
        console.log("Websocket connected.")
        connecting = false;
        connected = true;
        for (let i = 0; i < callQueue.length; i++) {
            const [ returnId, cmd ] = callQueue[i];
            ws.send(JSON.stringify({ type: "call", cmd, returnId }));
        }
        messageElement.innerText = "None of your devices are currently connected.";
        const cookies = Object.fromEntries(document.cookie.split(";").map((str) => str.trim().split("=")));
        ws.send(JSON.stringify({ type: "subscribe", sessionid: cookies.sessionid }));
        ws.onmessage = (message) => {
            const raw = message.data;
            try {
                const data = JSON.parse(raw);
                if (data.type == "ping") {
                    ws.send(JSON.stringify({ type: "pong" }));
                    return;
                } else if (data.type == "return") {
                    if (returnIdToCallback[data.returnId] != undefined)
                        returnIdToCallback[data.returnId](data.value);
                    return;
                } else if (data.type == "connection") {
                    data.devices.forEach((device) => {
                        numConnectedDevices++;
                        const tmpParent = addDiv(containerElement, device.name);
                        tmpParent.className = "device";
                        tmpParent.innerHTML = "<div class='deviceName'>"+device.name+"</div>";
                        processDevice(tmpParent, "", device);
                        addBr(containerElement);
                    });
                    messageElement.innerText = "";
                    return;
                } else if (data.type == "disconnection") {
                    processDeviceDisconnection(data.name);
                    return;
                } else if (data.type == "update") {
                    console.log(data.name.join(".") + " = " + JSON.stringify(data.value));
                    updateCallbacks[data.name.join(".")](data.value);
                    return;
                } else if (data.type == "logout") {
                    window.location.pathname = "/login"
                    return;
                } else {
                    console.log(data);
                    return;
                }
            } catch (err) {}
        };
    }
}
let containerElement = undefined;
let messageElement = undefined;
document.addEventListener("DOMContentLoaded", async () => {
    containerElement = document.getElementById("container");
    messageElement = document.getElementById("message");
    setup();
});
async function call(cmd) {
    const returnId = generateUUID();
    if (connected)
        ws.send(JSON.stringify({ type: "call", cmd, returnId }));
    else
        callQueue.push([ returnId, cmd ]);
    const returnVal = await (new Promise((resolve) => {
        returnIdToCallback[returnId] = resolve;
    }));
    if (returnVal == "None") return undefined;
    else return JSON.parse(returnVal);
}