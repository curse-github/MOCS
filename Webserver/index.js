//Nothing here either
var login = "";
var connected = false;
var connecting = false;
//const url = "mc.campbellsimpson.com";
const url = "192.168.1.37";
const tabSize = 20;
function append(parent,type,content,attributes) {
	var thing;
	if (type != null) { thing = document.createElement(type); } else { document.createElement("div"); }
	if (content != null) { thing.innerHTML = content; }
	Object.keys(attributes).forEach((i) => {
		thing.setAttribute(i, attributes[i]);
	});
	parent.appendChild(thing);
	return thing;
}
setInterval(() => {
	if ((ws == null || ws.readyState != ws.OPEN) && connecting == false) {
		//console.log("disconnected");
		document.body.innerHTML = "<h2>Server disconnected</h2>";
		connected = false;
		connecting = true;
		ws = new WebSocket("ws://" + url + ":42069");
		setup();
	}
}, 500);//0.5 seconds
var ws = new WebSocket("ws://" + url + ":42069");
//console.log("started connection");
connecting = true;
var data = {};
function setup() {
	ws.onopen = () => {
		connected = true;
		connecting = false;
		console.clear();
		console.log("connected");
		ws.onmessage = function (event) {
			if (JSON.parse(event.data) != null) {
				var msg = JSON.parse(event.data);
				if (msg.type == "authentication") {
					//console.log("received responce");
					if (msg.status == true) {
						document.body.innerHTML = "";
						var page = append(document.body,"p","",{
							id:"page",
							class:"mx-4 my-4"
						});
						append(page,"input","",{
							type:"button",
							value:"Collapse all",
							class:"collapseButton btn border rounded-0 text-white my-2",
							onclick:"collapseAll()"
						});

						data = msg.data;
						Object.keys(data).forEach((i) => {
							if (data[i] != null && (data[i].public == true)) {
								processDevice(page,data[i], i, 0, false);
							}
						});

						var date = new Date();
						date.setTime(date.getTime() + (1000*60*60));
						document.cookie = "login=" + login + "; expires=" + date.toUTCString() + "; path=/"
						send(JSON.stringify({
							type:"command", data:{
								device:"self",
								function:"subscribeConnection",
								parameters:[ "any", msg.deviceId, "connect" ]
							}
						}));
						send(JSON.stringify({
							type:"command", data:{
								device:"self",
								function:"subscribeDisconnection",
								parameters:[ "any", msg.deviceId, "disconnect" ]
							}
						}));
					} else { document.getElementById("div1").innerHTML = msg.data; }
				} else if (msg.type == "ping" && msg.data != null) {
					send("{\"type\":\"pong\",\"data\":\"" + msg.data + "\"}");
				} else if (msg.type == "redirect") {
					var date = new Date();
					date.setTime(date.getTime() + (10000));
					document.cookie = "login=" + login + "; expires=" + date.toUTCString() + "; path=/"
					window.location.href = msg.data;
				} else if (msg.type == "command") {
					cmd = msg.data;
					if (cmd.toLowerCase() == "connect()") {
						if (msg.parameters[1] != null && (msg.parameters[1].public == true)) {
							processDevice(document.body, msg.parameters[1], msg.parameters[0].toLowerCase(), 1, true);
							setTimeout(() => {
								document.getElementById(msg.parameters[1].name.toLowerCase() + "-P").setAttribute("deleted",false);
							}, 25);
						}
					} else if (cmd.toLowerCase() == "disconnect()") {
						let element = document.getElementById(msg.parameters[0].toLowerCase() + "-P");
						if (element) {
							element.setAttribute("deleted",true);
							setTimeout(() => {
								element.parentNode.removeChild(element);
							}, 300);
						}
					}
				} else if (msg.type == "pong") {
					//console.log("pong");
				} else {
					console.log(event.data);
				}
			}
		}
		callback = () => {
			var nameEQ = "login=";
			var ca = document.cookie.split(';');
			for(var i=0;i < ca.length;i++) {
				var c = ca[i];
				if (c.startsWith("login=")) {
					login=c.substring(6)
					window.location.href = window.location.search + "?username=" + login.split("/")[0] + "&password=" + login.split("/")[1];
				}
			}
		};
		if (window.location.search != null && window.location.search != "") {
			var parsedUrl = parseUrl(window.location.search);
			if (parsedUrl.password != null && parsedUrl.username != null) {
				login = parsedUrl.username + "/" + parsedUrl.password;
				send(JSON.stringify({ "type":"command", "data":{ "device":"self", "function":"authenticate", "parameters": [ parsedUrl.username, parsedUrl.password, true ] }, "id":2 } ));
				//console.log("sent authentication");
			} else if (document.cookie != null && document.cookie != "") { callback(); }
		} else if (document.cookie != null && document.cookie != "") { callback(); }
	};
	ws.onerror = (error) => {
		//console.log("disconnected");
		connected = false; connecting = false;
		document.body.innerHTML = "<h2>Server disconnected</h2>";
		if (ws.readyState == ws.OPEN) { ws.close(); }
		ws = null;
		//console.log("WebSocket error: " + JSON.stringify(error, ["message", "arguments", "type", "name"]));
	};
}
setup();

function processDevice(parent,device,deviceName, tabs, startDeleted) {
	if ((device.functions != null && Object.keys(device.functions).length > 0) || (device.devices != null && Object.keys(device.devices).length > 0)) {
		var p = append(parent,"p", device.name + "   ", {id:device.name.toLowerCase() + "-P", deleted:(startDeleted == false || startDeleted == null) ? false : true, style:"margin-left: " + tabSize + "px;padding-top:0;margin-bottom:0;margin-top:0;"});
		append(p, "button", "^", {
			class:"btn btn-collapser border rounded-0 text-white",
			onclick:"document.getElementById(\"" + device.name.toLowerCase() + "\").setAttribute(\"collapsed\",!(document.getElementById(\"" + device.name.toLowerCase() + "\").getAttribute(\"collapsed\") === \"true\")); this.innerText = (document.getElementById(\"" + device.name.toLowerCase() + "\").getAttribute(\"collapsed\") === \"true\") ? \"v\" : \"^\";"
		});
		var collapseDiv = append(p,"div","",{
			collapsed:false,
			id:device.name.toLowerCase(),
			class:"div-collapsable",
			style:"margin-left:"+tabSize+"px"
		});
		Object.entries(device.functions).forEach((j) => {
			if (j != null && j[1] != null && j[1].public != false) {
				i = j[1];
				var deviceP = append(collapseDiv,"p","",{
					class:"my-1"
				});
				var onclick = 'send("{\\\"type\\\":\\\"command\\\",\\\"data\\\":{\\\"device\\\":\\\"' + deviceName + "\\\",\\\"function\\\":\\\"" + i.name + '\\\",\\\"parameters\\\":[';
				if (i.parameters != null && i.parameters.length > 0) {
					if (i.parameters[0].type == "string") {onclick += '\\\"';}
					onclick += '" + ';
					for (var l = 0; l < i.parameters.length; l++) {
						if (i.parameters[l].public == false || i.parameters[l].public == "false") {
							if (i.parameters[l].nullable) {
								onclick += '"null"';
							} else {
								onclick += '""';
							}
						} else if (i.parameters[l].name.split(".")[0] == "url") {
							onclick += 'parseUrl(window.location.search).' + i.parameters[l].name.split(".")[1];
						} else {
							onclick += 'document.getElementById("' + deviceName + "." + i.name + "." + i.parameters[l].name + '").value';
						}
						onclick += (l != (i.parameters.length - 1) ? ' + "' + (i.parameters[l].type == "string" ? "\\\"" : "") + "," + (i.parameters[l + 1] != null && i.parameters[l + 1].type == "string" ? "\\\"" : "") + '" + ' : ' + "' + (i.parameters[l].type == "string" ? "\\\"" : ""));
					}
				}
				onclick += ']}}")';
				//1console.log(deviceName + "." + i.name + "()")
				append(deviceP,"input","",{
					type:"button",
					value:deviceName + "." + i.name + "()",
					onclick:onclick,
					class:"mybtn btn text-white w-auto border rounded-0 d-inline align-middle",
				});
				if (i.parameters != null && i.parameters.length > 0) {
					for (var l = 0; l < i.parameters.length; l++) {
						if (i.parameters[l].public == true || i.parameters[l].public == true || i.parameters[l].public == null || i.parameters[l].public == "null") {
							let input = append(deviceP,"input","",{
								id: deviceName + "." + i.name + "." + i.parameters[l].name,
								class:"form-control form-control-input text-white w-auto border rounded-0 d-inline align-middle",
							});
							if (i.parameters[l].defaultValue != null) {
								input.setAttribute("value",i.parameters[l].defaultValue);
							} else {
								switch (i.parameters[l].type) {
									case "string":
										input.setAttribute("value","string");
										break;
									case "bool":
										input.setAttribute("value","true");
										break;
									case "number":
										input.setAttribute("value","1");
										break;
									default:
										input.setAttribute("value","unknown");
										break;
								}
							}
						}
					}
				}
			}
		});
		if (device.devices != null) {
			Object.entries(device.devices).forEach((j) => {
				if (j != null && j[1] != null && (j[1].public == true || j[1].public == null)) { processDevice(collapseDiv, j[1], deviceName + "." + j[1].name, tabs + 1, false); }
			});
		}
	}
}
function parseUrl(url) {
	var list = url.split("?")[1].split("&");
	var object = {}
	for(var i = 0; i < list.length; i++) {
		object[list[i].split("=")[0]] = list[i].split("=")[1];
	}
	return object;
}


function send(string) {
	if ((ws != null && ws.readyState === ws.OPEN)) {
		ws.send(decodeURIComponent(string));
	} else if (connecting == false) {
		//console.log("disconnected");
		document.body.innerHTML = "<h2>Server disconnected</h2>";
		connected = false;
		connecting = true;
		ws = new WebSocket("ws://" + url + ":42069");
		setup();
	}
}
function loginFunc() {
	login = document.getElementById('username').value + '/' + document.getElementById('password').value;
	send(JSON.stringify({
		"type":"command",
		"data":{
			"device":"self",
			"function":"authenticate",
			"parameters":
				[
					document.getElementById('username').value,
					document.getElementById('password').value,
					true
				]
			},
			"id":2
		}
	));
}
function collapseAll() {
	l1 = [].slice.call(document.getElementsByClassName("btn-collapser"));
	l2 = [].slice.call(document.getElementsByClassName("div-collapsable"));
	for (var i = 0; i < l1.length; i++){
		l2[i].setAttribute("collapsed",true);
		l1[i].innerText = "v";
	}
}