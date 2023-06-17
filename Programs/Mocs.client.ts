//#region typeDefs
type mocsFunction = (client:Client,...parameters:(string|number|boolean|null)[])=>void;
type mocsParameter = string|number|boolean|null;
interface parameter {
    name:string;
    type:"string"|"number"|"boolean";
    nullable:boolean;
    public:boolean;
    defaultValue?:string|number|boolean|null;
}
function newParameter<T extends string|number|boolean>(name:string,nullable:boolean,public:boolean,defaultValue:T|null,type?:"string"|"number"|"boolean"):parameter { return {
    "name":name,"type":((type||(typeof defaultValue).replace("bigint","number")) as ("string"|"number"|"boolean")),"nullable":nullable,"public":public,"defaultValue":defaultValue
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
                    if (this.ws == null) return;
                    var msg = JSON.parse(e.data);
                    if (msg.type != null) {
                        if (msg.type == "ping" && msg.data != null) {
                            this.ws!.send(JSON.stringify({type:"pong",data:msg.data}));
                        } else if (msg.type == "command" && msg.data != null) {
                            const funcName:string = msg.data.toLowerCase();
                            if (this.functions[funcName] == null) {console.log("invalid command"); console.log(msg); return;}
                            if(msg.parameters!=null&&msg.parameters.length>0){ this.functions[funcName](this,...msg.parameters); }
                            else{ this.functions[funcName](this); }
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
                if(this.onclose!=null) try{this.onclose!();}catch(err:any){}
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
        this.ws!.onerror=(e:any)=>{if(this.ws!=null){if(this.onclose!=null) try{this.onclose!();}catch(err:any){} try{ this.ws!.close(); }catch(err:any){ console.log(err.stack); } this.ws=null; }};
        this.ws!.onclose=(e:any)=>{if(this.ws!=null){if(this.onclose!=null) try{this.onclose!();}catch(err:any){} this.ws=null; }};
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
    AddChildFunction(devicename:string,devicePublic:boolean,functionName:string,functionPublic:boolean,parameters:parameter[],func:mocsFunction):Client {
        var devices:device[]|undefined = this.connectionMessage.data.devices;
        if (devices == null) devices = [];
        var index:number = devices!.findIndex((el:device)=>{return el.name==devicename;})
        if (index == -1) { index = devices.length; devices!.push({name:devicename,"public":devicePublic,functions:[]}); }
        devices[index].functions.push({"name":functionName,"public":functionPublic,"parameters":parameters});
        this.connectionMessage.data.devices = devices;
        this.functions[devicename.toLowerCase()+"."+functionName.toLowerCase()+"()"] = func;
        return this;
    }
    listen():Client {
        this.setReconnectInterval();
        return this;
    }
    onclose:(()=>void)|null = null;
}
//#endregion typeDefs