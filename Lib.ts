const { networkInterfaces } = require('os');
export function getIp() {
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
	if (results["Ethernet"] != null && results["Ethernet"].length > 0) {
		return results["Ethernet"][0];
	} else if (results["Wi-Fi"] != null && results["Wi-Fi"].length > 0) {
		return results["Wi-Fi"][0];
	}
}

const https = require("https");
/** Requests or posts from a https server and returns output.
 * @param link Link to the server to request from.
 * @param path Filepath of the file you are accessing from the server.
 * @param method Request method e.g "GET","POST","PUT".
 * @param headers An object of headers.
 * @param data Data to send if method is post.
 * @returns A Promise which will return the data returned from the request. */
export function httpsRequestPromise(link:string,path:string,method:string,headers:{[key:string]:string},data:null|string) {
    return new Promise<string>((resolve,reject) => {
        try {
            var curl:string = "";
            if (data != null) {
                //@ts-expect-error
                headers["Content-Length"] = data.length;
            }
            var options = {
                "host": link,
                "port": 443,
                "path": path,
                "method": method,
                "headers": headers
            };
            var req = https.request(options, (res:any) => {
                //res.statusCode
                res.setEncoding('utf8');
                res.on("data", (chunk:string) => { curl += chunk; });
                res.on("close", () => { resolve(curl); });
            });
            req.on("error", (err:Error) => { reject(err); });
            if (data != null) { req.write(data); }
            req.end();
        } catch (err:any) { reject(err); }
    });
}

/** Returns a clone of the object with a different memory address to the origional.
 * @param thing Object to clone
 * @returns The clone */
export function cloneObject(thing:Array<any>|{[key:string|number]:any}|any): Array<any>|{[key:string|number]:any}|null {
    if (thing != null && thing != undefined) {
        if ((typeof thing) == "object") {
            if (Array.isArray(thing)) {
                //list
                var clonedList:Array<any> = [];
                for (var i:number = 0; i < thing.length; i++) {
                    if (thing[i] != null) { clonedList[i] = cloneObject(thing[i]); }
                }
                return clonedList;
            } else {
                assertIsObject(thing);
                //object
                var keys:Array<string> = Object.keys(thing);
                var clonedObject:{[key:string|number]:any} = {};
                keys.forEach((i:string|number) => {
                    assert(typeof i == "string" || typeof i == "number");
                    if (thing[i] != null) {
                        var temp:Array<any>|{[key:string|number]:any}|null = cloneObject(thing[i]);
                        assert(temp != null);
                        clonedObject[i] = temp;
                    }
                });
                return clonedObject;
            }
        } else {
            return thing;
        }
    } else { return null; }
}

//#region interfaces
/** Interface used the represent a Function.
 * @interface Func */
export interface Func{
    name:string
    parameters:Array<{//parameter
        name:string
        type:string
        nullable?:boolean
        public?:boolean
        defaultValue?:string
    }>
    public?:boolean
}
/** Interface used the represent a Device.
 * @interface Device */
export interface Device{
    name:string,
    functions:{ [key:string]:Func },
    devices?:{ [key:string]:Device|null }
    Rest?:{ [key:string]:Func },
    public?:boolean
}
/**
 * Interface used the represent data for a command.
 * @interface cmdData */
export interface cmdData{
    device:string,
    function:string,
    parameters:Array<any>
}
/**
 * Interface used the represent data from a connection.
 * @interface connData */
export interface connData{
    name:string,
    functions:{ [key:string]:Func },
    devices:{ [key:string]:Device }
}
/**
 * Underlying interface used for "command","connection", and "pingpong"
 * @interface cmd */
export interface cmd                    { type:string,        data:any,     id?:number}
/** Interface used the represent a command message from a client
 * @interface command */
export interface command    extends cmd { type:"command",     data:cmdData            }
/** Interface used the represent a connection message from a client
 * @interface connection */
export interface connection extends cmd { type:"connection",  data:connData           }
/** Interface used the represent a ping/pong message to/from a client
 * @interface pingpong */
export interface pingpong   extends cmd { type:"ping"|"pong", data:number             }
//#endregion
//assertions

/** Asserts that the "obj" is of type "object"
 * @param obj input */
export function assertIsObject(obj:any) {
    if (typeof obj != "object") {
        throw new Error("failure to assert (typeof val = object)");
    }
}
/** Asserts that the "str" is of type "string"
 * @param str input */
export function assertIsString(str:any): asserts str is string {
    if (typeof str != "string") {
        throw new Error("failure to assert (typeof val = string)");
    }
}
/**
 * Asserts that "condition" is true
 * @param condition input
 */
export function assert(condition:boolean): asserts condition {
    if (!condition) {
        throw new Error("condition not met");
    }
}

//#region examples
// sent as the first message after connecting to websocket, needs to be sent before it will receive any commands
export var exampleConnection:connection = {
    "type":"connection",
    "data":{
        name: "deviceName",
        functions:{
            "function1Name":{
                name:"function1Name",
                parameters:[
                    {name:"childDeviceParameter1Name",type:"string",nullable:false},
                    {name:"childDeviceParameter2Name",type:"bool",  nullable:false},
                    {name:"childDeviceParameter3Name",type:"number",nullable:true}
                    //...
                ],
                public:true
            },
            //...
        },
        devices: {
            "childDeviceName": {
                name:"childDeviceName",
                functions:{
                    "childDeviceFunction1Name":{
                        name:"childDeviceFunction1Name",
                        parameters:[
                            {name:"childDeviceParameter1Name",type:"string",nullable:false},
                            {name:"childDeviceParameter2Name",type:"bool",  nullable:false},
                            {name:"childDeviceParameter3Name",type:"number",nullable:true}
                            //...
                        ],
                        public:false
                    },
                    //...
                }
            },
            //...
        }
    }
};
var thing = {
    "type":"connection",
    "data":{
        "name": "deviceName",
        "functions":{
            "function1Name":{
                "name":"function1Name",
                "parameters":[
                    {"name":"childDeviceParameter1Name","type":"string","nullable":false},
                    {"name":"childDeviceParameter2Name","type":"bool",  "nullable":false},
                    {"name":"childDeviceParameter3Name","type":"number","nullable":true}
                ],
                "public":true
            }
        },
        "devices": {
            "childDeviceName": {
                "name":"childDeviceName",
                "functions":{
                    "childDeviceFunction1Name":{
                        "name":"childDeviceFunction1Name",
                        "parameters":[
                            {"name":"childDeviceParameter1Name","type":"string","nullable":false},
                            {"name":"childDeviceParameter2Name","type":"bool",  "nullable":false},
                            {"name":"childDeviceParameter3Name","type":"number","nullable":true}
                        ],
                        "public":false
                    }
                }
            }
        }
    }
};
//sent as a client to call a function on a device
var exampleCommand:command = { // this would represent device1.childDevice.functionName(123,"string",null,false);
    "type":"command",
    "data":{
        "device":"device1",
        "function":"subscribeConnection",
        "parameters":[
            123,
            "string",
            null,
            false
        ]
    }
};
// must be sent within half a second of ping message
var examplePong:pingpong = {
    "type":"pong",
    "data":2 // used as an id, needs to match the data sent in the ping message
};
//#endregion