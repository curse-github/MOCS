//#region typeDefs
type mocsFunction = (client:Client,...parameters:(string|number|boolean|null)[])=>void;
type mocsParameter = string|number|boolean|null;
interface parameter {
    name:string;
    type:"string"|"number"|"boolean";
    nullable:boolean;
    public:boolean;
    defaultValue?:string|number|boolean;
}
function newParameter<T extends string|number|boolean>(name:string,nullable:boolean,public:boolean,defaultValue:T):parameter { return {
    "name":name,"type":(((typeof defaultValue).replace("bigint","number")) as ("string"|"number"|"boolean")),"nullable":nullable,"public":public,"defaultValue":defaultValue
};}
interface func {
    name:string;
    parameters:parameter[];
    public:boolean;
}
interface device {
    name:string;
    functions:func[];
    devices?:device[];
    public:boolean;
}
interface connMsg {
    type:"connection";
    data:device
}
class Client {
    WebSocket = require('ws');
    //static URL:string = "ws://mc.campbellsimpson.com:42069";
    static URL:string = "ws://192.168.1.37:42069";
    connectionMessage:connMsg = {
        type:"connection",
        data:{
            name:"Client",
            functions:[],
            public:true
        }
    }
    functions:{[key:string]:mocsFunction} = {};
    public get name():string { return this.connectionMessage.data.name; }
    public set name(v:string) { this.connectionMessage.data.name = v; }
    public get public():boolean { return this.connectionMessage.data.public; }
    public set public(v:boolean) { this.connectionMessage.data.public = v; }
    constructor(name:string,isPublic:boolean) { this.name = name; this.public=isPublic; }

    
    intervalId:number|ReturnType<typeof setTimeout>|null = null;
    ws:WebSocket|null;
    SetupWebsocket():Client {
        try {
            this.ws!.send(JSON.stringify(this.connectionMessage));
            this.ws!.onerror   = (err:any)=>{ console.log("Websocket error: \""+err+"\"."); };
            this.ws!.onmessage = (e  :any)=>{
                try {
                    var msg = JSON.parse(e.data);
                    if (msg.type != null) {
                        if (msg.type == "ping" && msg.data != null) {
                            this.ws!.send(JSON.stringify({type:"pong",data:msg.data}));
                        } else if (msg.type == "command" && msg.data != null) {
                            if (!msg.data.includes(".")) {
                                if(msg.parameters!=null&&msg.parameters.length>0){ this.functions[msg.data.toLowerCase()](this,...msg.parameters); }
                                else{ this.functions[msg.data.toLowerCase()](this); }
                            } else { console.log("Error, command sent to child device?..."); return this; }
                        } else if (msg.type == "reply") {
                            if (msg.statusCode != 200) {
                                console.log("Connection failed, status "+msg.status     );
                                console.log("Error message: \""    +msg.error +"\"");
                                console.log("Error id: \""         +msg.id    +"\"");
                            }
                        } else if (msg.type == "status") {
                            if (msg.statusCode != 200) {
                                console.log("Command fail, status "+msg.status     );
                                console.log("Error message: \""    +msg.error +"\"");
                                console.log("Error id: \""         +msg.id    +"\"");
                            }
                        }
                    } else console.log("Error, msg type is null.")
                } catch(err:any){ console.log(err); }
            };
            this.ws!.onclose = (e:any)=>{
                console.log("Lost connection to MOCS server.");
                this.ws = null;
                if(this.onclose!=null) this.onclose!();
                this.setReconnectInterval(true);
            };
        } catch (err) {
            console.log(err.stack);
        }
        return this;
    }
    attemts:number = 0;
    setReconnectInterval(reconnection?:boolean|null):Client {
        // attempt to connect every 20 seconds untill it works and then stop.
        this.tryReconnect(reconnection);
        this.intervalId = setInterval(()=>{
            this.tryReconnect(reconnection);
        }, 15000);
        return this;
    }
    tryReconnect(reconnection?:boolean|null):Client {
        if (this.ws != null){try{ this.ws!.close(); }catch(err:any){ console.log(err.stack); } this.ws=null; };
        this.attemts++;
        console.log("Attempt #"+this.attemts+" to connect to the MOCS server.");
        this.ws=new this.WebSocket(Client.URL);
        this.ws!.onerror=(e:any)=>{if(this.ws!=null){if(this.onclose!=null) this.onclose!(); try{ this.ws!.close(); }catch(err:any){ console.log(err.stack); } this.ws=null; }};
        this.ws!.onclose=(e:any)=>{if(this.ws!=null){if(this.onclose!=null) this.onclose!(); this.ws=null; }};
        this.ws!.onopen=()=>{
            this.stopInterval();// stop loop.
            console.clear();
            console.log((reconnection==true?"Rec":"C")+"onnected to MOCS server"+((this.attemts>1)?" after "+this.attemts+" attempts.":"."));
            this.attemts=0;
            this.SetupWebsocket();
        };
        return this;
    }
    stopInterval():Client {if(this.intervalId!=null){ clearInterval(this.intervalId); this.intervalId=null; }return this;}

    AddFunction(name:string,isPublic:boolean,parameters:parameter[],func:mocsFunction):Client {
        this.connectionMessage.data.functions.push({"name":name,"public":isPublic,"parameters":parameters});
        this.functions[name.toLowerCase()+"()"] = func;
        return this;
    }
    listen():Client {
        this.setReconnectInterval();
        return this;
    }
    onclose:(()=>void)|null = null;
}
//#endregion typeDefs

const spawn = require("child_process").spawn;
var lines:string[] = ["","","","","","","",""];
var subscriptions:any[] = [];


function line(lineNum:number, text:string) {
    const _lineNum = Math.min(Math.max(lineNum,0),5);
    lines[_lineNum+2] = ((text == null || text == "" || text == "null") ? " " : text);
    restore([lines[2],lines[3],lines[4],lines[5],lines[6],lines[7]])
}
function clear() {
    restore([" "," "," "," "," "," "]);
}
function restore(linesList:string[]) {
    for (var i = 0; i < (linesList.length < 6 ? linesList.length : 6); i++) {
        lines[i+2] = (((linesList[i] == null || linesList[i] == "" || linesList[i] == "null") ? " " : linesList[i]));
    }
    var lst = [lines[0],lines[1],lines[2],lines[3],lines[4],lines[5],lines[6],lines[7]];
    //console.log("sudo python /home/pi/restore.py " + lst.map(el=>"\""+el+"\"").join(" "));
    lst.unshift("/home/pi/restore.py");
    spawn("python",lst);
}
function subscribe(button:number, name:string, func:string, parameter:string) {
    if (subscriptions != null) {
        for (var i = 0; i < subscriptions.length; i++) {
            if (JSON.stringify(subscriptions[i]) == JSON.stringify({"button":button, "name":name, "function":func, "parameter":parameter})) {
                return;
            }
        }
        var found = false;
        for (var i = 0; i < subscriptions.length + 1; i++) {
            if (!found && subscriptions[i] == null) {
                found = true;
                subscriptions[i] = {"button":button, "name":name, "function":func, "parameter":parameter};
                return;
            }
        }
    }
}
clear();
function wasPressed(button:number, websocket:WebSocket) {
    for (var i = 0; i < subscriptions.length; i++) {
        if (subscriptions[i] != null) {
            if (button == subscriptions[i].button) {
                websocket.send(JSON.stringify({
                    type:"command",
                    data:{
                        device:subscriptions[i].name,
                        "function":subscriptions[i].function,
                        parameters:[((subscriptions[i].parameter != null) ? subscriptions[i].parameter : button)]
                    },
                    id:i
                }));
            }
        }
    }
}



const myClient:Client = new Client("NanoPi",true)
.AddFunction("Line"   ,true,[
    newParameter<number>("lineNum",false,true,1       ),
    newParameter<string>("text"   ,false,true,"string")
],(client:Client,lineNum:mocsParameter,text:mocsParameter)=>{
    line(lineNum as number,text as string);
})
.AddFunction("Clear"  ,true,[],(client:Client)=>{ clear(); })
.AddFunction("Restore",true,[
    newParameter<string>("line1",true,true,"-_-_-_-_-_-_-_-_"),
    newParameter<string>("line2",true,true,"-_-_-_-_-_-_-_-_"),
    newParameter<string>("line3",true,true,"-_-_-_-_-_-_-_-_"),
    newParameter<string>("line4",true,true,"-_-_-_-_-_-_-_-_"),
    newParameter<string>("line5",true,true,"-_-_-_-_-_-_-_-_"),
    newParameter<string>("line6",true,true,"-_-_-_-_-_-_-_-_")
],(client:Client,
    line1:mocsParameter,line2:mocsParameter,
    line3:mocsParameter,line4:mocsParameter,
    line5:mocsParameter,line6:mocsParameter)=>{
    restore([line1 as string,line2 as string,line3 as string,line4 as string,line5 as string,line6 as string]);
})
.AddFunction("Subscribe",false,[
    newParameter<number>("button"   ,false,true,1          ),
    newParameter<string>("name"     ,false,true,"name"     ),
    newParameter<string>("func"     ,false,true,"func"     ),
    newParameter<string>("parameter",false,true,"parameter")
],(client:Client,button:mocsParameter, name:mocsParameter, func:mocsParameter, parameter:mocsParameter)=>{
    subscribe(button as number,name as string,func as string,parameter as string);
})
.AddFunction("wasPressed"   ,true,[
    newParameter<number>("button",false,true,1)
],(client:Client,button:mocsParameter)=>{
    wasPressed(button as number,client.ws!);
})
.listen();

//#region Spotify
var intervalId2:number|ReturnType<typeof setTimeout>|null = null;
const http = require("http");
var spotify:string = "";
function setupSpotify() {
    intervalId2 = setInterval(()=>{
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
myClient.onclose=()=>{if(intervalId2!=null){ clearInterval(intervalId2); intervalId2=null; }}
//#endregion Spotify

setupSpotify();