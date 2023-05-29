const fs:any = require("fs");
import {assert, httpsRequestPromise, httpsRequestGetBufferPromise} from "./Lib";
const SpotifyClientID    :string = fs.readFileSync(__dirname+"/Spotify/ClientID.txt"    , 'utf8');
const SpotifyClientSecret:string = fs.readFileSync(__dirname+"/Spotify/ClientSecret.txt", 'utf8');
const redirectLink       :string = fs.readFileSync(__dirname+"/Spotify/Redirect.txt"    , 'utf8');
const Link               :string = "https://accounts.spotify.com/authorize?client_id=" + SpotifyClientID + "&response_type=code&redirect_uri=" + redirectLink + "&scope=user-modify-playback-state user-read-playback-position user-read-currently-playing user-read-recently-played user-read-playback-state";
const defaultAccount     :string = "Crs"
//#region library
function SpotifyGetToken(code:string) {
    httpsRequestPromise("accounts.spotify.com","/api/token","POST",{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},"grant_type=authorization_code&code=" + code + "&redirect_uri=" + redirectLink + "&client_id=" + SpotifyClientID + "&client_secret=" + SpotifyClientSecret)
    .then((curl:string) => {
        try {
            if (curl == "") { return; }
            else if (JSON.parse(curl)) {
                var json:any = JSON.parse(curl);
                if (json.error != null) {
                    console.log("SpotifyGetTokenError1: " + JSON.stringify(json.error)); return;
                } else {
                    fs.writeFileSync(__dirname+"/Spotify/AccessToken"  + defaultAccount + ".txt",json.access_token)
                    fs.writeFileSync(__dirname+"/Spotify/RefreshToken" + defaultAccount + ".txt",json.refresh_token)
                }
            }
        } catch (err:any) { console.log("SpotifyGetTokenError2: " + err); return; }
    }).catch((err:any) => {
        if (err.toString() != "SyntaxError: Unexpected end of JSON input") {
            console.log("SpotifyGetTokenError3: " + err);
        }
    });
}

function SpotifyTokenRequest  (functionName:string,account?:string|null) {
    return new Promise<[boolean,string,string]>(async( resolve:((value?:any)=>void), reject:((reason?:any)=>void) )=>{
        var SpotifyRefreshTokenTmp:null|string = null;
        try { SpotifyRefreshTokenTmp = fs.readFileSync(__dirname+"/Spotify/RefreshToken" + (account||defaultAccount) + ".txt", 'utf8');
        } catch (err) { reject(1); console.log("Spotify"+functionName+"FileError1: " + err); return; }

        if (SpotifyRefreshTokenTmp != null && SpotifyRefreshTokenTmp != "") {
            httpsRequestPromise("accounts.spotify.com","/api/token","POST",{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},"grant_type=refresh_token&refresh_token=" + SpotifyRefreshTokenTmp + "&client_id=" + SpotifyClientID + "&client_secret=" + SpotifyClientSecret)
            .then ((curl:string) => {
                try {
                    if (curl == "") { reject([2]); }
                    else if (JSON.parse(curl)) {
                        var json:any = JSON.parse(curl);
                        if (json.error == null) {
                            //set refreshed token and retry function
                            try {
                                fs.writeFileSync("Spotify/AccessToken" + (account||defaultAccount) + ".txt",json.access_token);
                                resolve();
                            } catch (err:any) {
                                reject(3); //console.log("Spotify"+functionName+"TryCatchError1: " + err);
                            }
                        } else {
                            reject(4); console.log("Spotify"+functionName+"ServerError1: " + JSON.stringify(json));
                        }
                    } else {
                        reject(5); console.log("Spotify"+functionName+"JsonError1: could not parse json");
                    }
                } catch (err) {
                    reject(6); console.log("Spotify"+functionName+"TryCatchError2: " + err);
                }
            }).catch((err:Error) => {
                reject(7); console.log("Spotify"+functionName+"HttpsRequestError1: " + err);
            });
        } else {
            reject(8); console.log("Spotify"+functionName+"TokenError4: Spotify refresh token not found");
        }
    });
}

/**
 * makes a request to the spotify api, handles errors, and resolves with the json output
 * @date 5/26/2023
 *
 * @param {string} functionName used to display errors
 * @param {(string|null)} account
 * @param {string} path path to put after "/v1/me/player"
 * @param {("GET"|"POST"|"PUT")} method https request method to be used
 * @param {(string|null)} data POST/PUSH data
 * @param {(()=>void)} onrefresh function called after refreshing token if needed
 * 
 * @example
 * rejects with codes 1-15
 * general json error code is 13
 */
function SpotifyMeRequest     (functionName:string, account:string|null, path:string, method:"GET"|"POST"|"PUT", data:string|null, refresh:boolean=false, onrefresh?:(()=>void)):Promise<any> {
    return new Promise<any>(async( resolve:((value?:any)=>void), reject:((reason?:any)=>void) )=>{
        var SpotifyAccessTokenTmp:null|string = null;
        try { SpotifyAccessTokenTmp = fs.readFileSync(__dirname+"/Spotify/AccessToken" + (account||defaultAccount) + ".txt", 'utf8');
        } catch (err) { reject([1]); console.log("Spotify"+functionName+"FileError2: " + err); return; }//error code 1  or error code 19

        httpsRequestPromise("api.spotify.com","/v1/me/player"+path,method,{"Accept":"application/json","Content-Type":"application/json","Authorization":"Bearer " + SpotifyAccessTokenTmp},data)
        .then ((curl:string) => {
            try {
                if (curl == "") { reject([2]); }//error code 2  or error code 20
                else if (JSON.parse(curl)) {
                    var json:any = JSON.parse(curl);
                    if (json.error != null) {
                        if (refresh) {
                            if (json.error.message == "The access token expired" || json.error.message == "Invalid access token") {
                                SpotifyTokenRequest(functionName,account)
                                .then(onrefresh||(()=>{}))
                                .catch(async(reason:number)=>{ reject([reason+2]); });//maps errors 1-8 into 3-10
                            } else {
                                reject([13,json.error]); //console.log("Spotify"+functionName+"JsonError2: " + JSON.stringify(json.error));//error code 13 or error code 31
                            }
                        }else {
                            if (json.error.message == "The access token expired") {
                                reject([11]); console.log("Spotify"+functionName+"TokenError5: Spotify refresh token expired.");//error code 11 or error code 29
                            } else if (json.error.message == "Invalid access token") {
                                reject([12]); console.log("Spotify"+functionName+"TokenError6: Access token is invalid, Reauthentication is required.");//error code 12 or error code 30
                            } else {
                                reject([13,json.error]); //console.log("Spotify"+functionName+"JsonError3: " + JSON.stringify(json.error));//error code 13 or error code 31
                            }
                        }
                    } else {
                        resolve(json);
                    }
                } else {
                    reject([14]); console.log("Spotify"+functionName+"JsonError4: could not parse json");//error code 14 or error code 32
                }
            } catch (err:any) {
                if (err.toString() != "SyntaxError: Unexpected end of JSON input") {
                    reject([15]); console.log("Spotify"+functionName+"TryCatchError3: " + err);//error code 15 or error code 33
                } else {console.log(err);}
            }
        }).catch((err:Error) => {
            if (("" + err).startsWith("Error: getaddrinfo ENOTFOUND "   )) {
                reject([16]); console.log("Spotify"+functionName+"HttpsRequestError2: " + (""+err).slice(29) + " address info not found.");//error code 16 or error code 34
            } else if (("" + err).startsWith("Error: connect ETIMEDOUT ")) {
                reject([17]); console.log("Spotify"+functionName+"HttpsRequestError3: " + (""+err).slice(25) + " connection timed out."  );//error code 17 or error code 35
            } else {
                reject([18]); console.log("Spotify"+functionName+"HttpsRequestError4: " + err);//error code 18 or error code 36
            }
        });
    });
}

/**
 * makes a request to the spotify api, handles errors, and resolves with the json output
 * @date 5/26/2023
 *
 * @param {string} functionName used to display errors
 * @param {(string|null)} account
 * @param {string} path path to put after "/v1/me/player"
 * @param {("GET"|"POST"|"PUT")} method https request method to be used
 * @param {(string|null)} data POST/PUSH data
 * 
 * @example
 * rejects with codes 1-36
 * 
 * codes 1 and 11-18 are from the initial request
 * codes   3-10         are from refressing the token
 * codes  19-36         are from the request after refressing
 * 
 * general json error codes are 13 and 31
 */
function SpotifyMeRequestRetry(functionName:string, account:string|null, path:string, method:"GET"|"POST"|"PUT", data:string|null) {
    return new Promise<any>(async( resolve:((value?:any)=>void), reject:((reason?:any)=>void) )=>{
        SpotifyMeRequest(functionName,account,path,method,data,true,async()=>{
            //onrefresh function
            SpotifyMeRequest(functionName,account,path,method,data)
            .then (resolve)
            .catch((out:[number,any])=>{reject([out[0]+18,out[1]])});//maps errors 1-18 into 19-36
        })
        .then(resolve)
        .catch(reject);
    });
}

/**
 * makes a request to the spotify api, handles errors, and resolves with the json output
 * @date 5/26/2023
 *
 * @param {string} functionName used to display errors
 * @param {(string|null)} account
 * 
 * @example
 * rejects with codes 1-36
 * 
 * codes 1, 2 and 11-18 are from the initial request
 * codes   3-10         are from refressing the token
 * codes  19-36         are from the request after refressing
 * 
 * general json error codes are 13 and 31
 */
function getSpotifyDevices  (functionName:string,                    account:string|null):Promise<string[]          > {
    return new Promise<string[]>(async( resolve:((value?:any)=>void), reject:((reason?:any)=>void) )=>{
        SpotifyMeRequest(functionName,account,"/devices","GET",null)
        .then ((json:any)=>{
            //play on first device
            var list:any[] = json.devices.filter((item:any)=>item.name!="32\" TCL Roku TV");//fuck you roku, lol
            resolve(list);
        })
        .catch(reject);
    });
}
//#endregion

/**
 * plays spotify
 * @date 5/26/2023
 *
 * @param {(string|null)} link
 * @param {(string|null)} device
 * @param {(string|null)} account
 * 
 * @example
 * rejects with codes 1-195
 *  
 * codes 1, 2 and 11-18 are from the initial request
 * codes   3-10         are from refressing the token
 * codes  19-36         are from the request after refressing
 * codes  37-39         are from SpotifyPlay specifically
 * codes  40-78         are from trying again after an invalid link was passed into the function
 * codes  79-117        are from getting the devices on account if no device is found
 * codes 118-195        are from trying to play again after chosing an avaliable device
 */ 
function SpotifyPlay        (link  :string|null, device:string|null, account:string|null):Promise<boolean           > {
    return new Promise<boolean>(async( resolve:((value?:any)=>void), reject:((reason?:any)=>void) )=>{
        var data:string = "";
        if (link != null) {
            if (link.includes("open.spotify.com/") && (link.includes("playlist") || link.includes("album") || link.includes("show") || link.includes("artist") || link.includes("track") || link.includes("episode"))) {
                var linkTmp = link; linkTmp = linkTmp.replace("https://","" );    linkTmp = linkTmp.split  ("?")[0]        ;
                    linkTmp = linkTmp.replace("open.spotify.com/"   ,"spotify:"); linkTmp = linkTmp.replace("/"       ,":");
                console.log(linkTmp)
                if (link.includes("playlist") || link.includes("album") || link.includes("show") || link.includes("artist")) {
                    data = JSON.stringify({context_uri:linkTmp});
                } else {
                    data = JSON.stringify({uris:[linkTmp]});
                }
            }
        }
        SpotifyMeRequestRetry("Play",account,"/play"+((device==null||device=="")?"": "?device_id="+device ),"PUT",data||null)
        .then (()=>{console.log();})//nothing needed
        .catch(async(out:[number,any])=>{
            if (out[0]==13||out[0]==31) {
                var [reason,err]:[number,any] = out;
                assert(err != null);
                if (err.message == "Device not found") {
                    reject(37); console.log("That device is not avaliable to play music.");
                } else if (err.reason == "NO_ACTIVE_DEVICE") {
                    getSpotifyDevices("Play",account)//find device to play on
                    .then(async(list:any)=>{
                        if (list.length > 0) {
                            console.log("Force playing on " + list[0].name);
                            SpotifyPlay(link,list[0].id,account)
                            .then(resolve)
                            .catch((out:[number,any])=>{reject(out[0]+117)});//maps errors 1-78 into 118-156
                        } else { console.log("No device is avaliable to play music."); }
                    })
                    .catch((out:[number,any])=>{reject(out[0]+78)});//maps errors 1-39 into 79-117
                } else if (err.message == "Player command failed: Restriction violated") {
                    resolve(true); //console.log("That device is already playing music.");
                } else if (err.message == "Invalid context uri") {
                    console.log("SpotifyPlayInputError1: Invalid music link.");
                    SpotifyPlay(null,device,account).then(resolve).catch((out:[number,any])=>{reject(out[0]+39)});//maps errors 1-39 into 40-78
                } else if (err.status == 502) {
                    reject(38); console.log("SpotifyPlayHttpsError1: \"Bad gateway.\"");
                } else {
                    reject(39); console.log("SpotifyPlayJsonError5: " + JSON.stringify(err));
                }
            } else if (out[0] == 2) {
                resolve(true);
            } else reject(out[0]);
        });
    });
}

/**
 * pauses spotify
 * @date 5/26/2023
 *
 * @param {(string|null)} account
 * 
 * @example
 * rejects with codes 1-40
 *  
 * codes 1, 2 and 11-18 are from the initial request
 * codes   3-10         are from refressing the token
 * codes  19-36         are from the request after refressing
 * codes  37-40         are from SpotifyPause specifically
 */ 
function SpotifyPause       (                                        account:string|null):Promise<boolean           > {
    return new Promise<boolean>(async( resolve:((value?:any)=>void), reject:((reason?:any)=>void) )=>{
        SpotifyMeRequestRetry("Pause",account,"/pause","PUT",null)
        .then ((json:any)=>{console.log("paused");console.log(json);})//nothing needed
        .catch(async(out:[number,any])=>{
            if (out[0]==13||out[0]==31) {
                var [reason,err]:[number,any] = out;
                assert(err != null);
                if (err.message == "Device not found") {
                    reject(37); console.log("That device is not avaliable to play music.");
                } else if (err.reason == "NO_ACTIVE_DEVICE") {
                    resolve(false); console.log("No device is currently playing music.");
                } else if (err.message == "Player command failed: Restriction violated") {
                    reject(38); console.log("SpotifyPauseError1: \"Restriction violated.\"");
                } else if (err.status == 502) {
                    reject(39); console.log("SpotifyPauseHttpsError2: \"Bad gateway.\"");
                } else {
                    reject(40); console.log("SpotifyPauseJsonError6: " + JSON.stringify(err));
                }
            } else if (out[0] == 2) {
                resolve(false);
            } else reject(out[0]);
        });
    });
}

/**
 * toggles spotify on/off
 * @date 5/26/2023
 *  
 * @param {(string|null)} device
 * @param {(string|null)} account
 *  
 * @example
 * rejects with codes 1-269
 *  
 * codes 1 and 11-18 are from the initial request
 * codes   3-10         are from refressing the token
 * codes  19-36         are from the request after refressing
 * code     37           is from SpotifyToggle specifically
 * codes  38-74         are from SpotifyPause
 * codes  75-269        are from SpotifyPlay
 */ 
function SpotifyToggle      (                    device:string|null, account:string|null):Promise<boolean           > {
    return new Promise<boolean>(async( resolve:((value?:any)=>void), reject:((reason?:any)=>void) )=>{
        SpotifyMeRequestRetry("Toggle",account,"","GET",null)
        .then (async(json:any)=>{
            if (json.is_playing != null) {
                if (json.is_playing == true) {
                    SpotifyPause(account).then((val:boolean) => {
                        resolve(val);
                    }).catch((reason:number)=>{ reject(reason+37); });//maps errors 1-40 into 38-74
                } else {
                    SpotifyPlay(null,device,account).then((val:boolean) => {
                        resolve(val);
                    }).catch((reason:number)=>{ reject(reason+74); });//maps errors 1-195 into 75-269
                }
            } else {
                reject(37); console.log("SpotifyToggleError1: IsPlaying == null");
            }
        })
        .catch((out:[number,any])=>reject(out[0]));
    });
}

/**
 * gets status of spotify playback
 * @date 5/26/2023
 *  
 * @param {(string|null)} account
 *  
 * @example
 * rejects with codes 1-37
 *  
 * codes 1, 2 and 11-18 are from the initial request
 * codes   3-10         are from refressing the token
 * codes  19-36         are from the request after refressing
 * code     37           is from SpotifyStatus specifically
 */ 
function SpotifyStatus      (                                        account:string|null):Promise<[boolean,string[]]> {
    return new Promise<[boolean,string[]]>(async( resolve:((value?:any)=>void), reject:((reason?:any)=>void) )=>{
        SpotifyMeRequestRetry("Status",account,"","GET",null)
        .then (async(json:any)=>{
            if (json.is_playing == null) { reject(37); console.log("SpotifyStatusError1: IsPlaying == null"); return; }
            if (json.is_playing == true) {
                if (json.item != null && json.item.name != null && json.item.artists[0].name != null) {
                    resolve([true, [json.item.name, ...(json.item.artists.map((artist:any)=>artist.name))]]);
                } else {
                    resolve([true, ["", ""]]);
                }
            } else {
                resolve([false, ["", ""]]);
            }
        })
        .catch((out:[number,any])=>reject(out[0]));
    });
}

/**
 * skips to next song
 * @date 5/26/2023
 *  
 * @param {(string|null)} device
 * @param {(string|null)} account
 *  
 * @example
 * rejects with codes 1-158
 *  
 * codes 1, 2 and 11-18 are from the initial request
 * codes   3-10         are from refressing the token
 * codes  19-36         are from the request after refressing
 * codes  38-40         are from SpotifyStatus specifically
 * codes  41-79         are from getting the devices on account if no device is found
 * codes  80-158        are from trying to skip again after chosing an avaliable device
 */ 
function SpotifySkipNext    (                    device:string|null, account:string|null):Promise<boolean           > {
    return new Promise<boolean>(async( resolve:((value?:any)=>void), reject:((reason?:any)=>void) )=>{
        SpotifyMeRequestRetry("SkipNext",account,"/next"+((device==null||device=="")?"": "?device_id="+device ),"POST",null)
        .then(()=>{console.log();})//nothing needed
        .catch(async(out:[number,any])=>{
            if (out[0]==13||out[0]==31) {
                var [reason,err]:[number,any] = out;
                assert(err != null);
                if (err.message == "Device not found") {
                    reject(37); console.log("That device is not avaliable to play music.");
                } else if (err.reason == "NO_ACTIVE_DEVICE") {
                    getSpotifyDevices("SkipNext",account)//find device to play on
                    .then(async(list:any)=>{
                        if (list.length > 0) {
                            console.log("Force playing on " + list[0].name);
                            SpotifySkipNext(list[0].id,account).then(resolve)
                            .catch((out:[number,any])=>{reject(out[0]+79)});//maps errors 1-79 into 80-158
                        } else { console.log("No device is avaliable to play music."); }
                    })
                    .catch((out:[number,any])=>{reject(out[0]+40)});//maps errors 1-39 into 41-79
                } else if (err.message == "Player command failed: Restriction violated") {
                    reject(38); console.log("No clue. ln454 Spotify.js");
                } else if (err.status == 502) {
                    reject(39); console.log("SpotifySkipNextHttpsError3: \"Bad gateway.\"");
                } else {
                    reject(40); console.log("SpotifySkipNextJsonError7: " + JSON.stringify(err));
                }
            } else if (out[0] == 2) {
                resolve(true);
            } else reject(out[0]);
        });
    });
}

/**
 * skips to previous song
 * @date 5/26/2023
 *  
 * @param {(string|null)} device
 * @param {(string|null)} account
 *  
 * @example
 * rejects with codes 1-158
 *  
 * codes 1, 2 and 11-18 are from the initial request
 * codes   3-10         are from refressing the token
 * codes  19-36         are from the request after refressing
 * codes  38-40         are from SpotifyStatus specifically
 * codes  41-79         are from getting the devices on account if no device is found
 * codes  80-158        are from trying to skip again after chosing an avaliable device
 */ 
function SpotifySkipPrevious(                    device:string|null, account:string|null):Promise<boolean           > {
    return new Promise<boolean>(async( resolve:((value?:any)=>void), reject:((reason?:any)=>void) )=>{
        SpotifyMeRequestRetry("SkipPrevious",account,"/previous"+((device==null||device==null||device=="")?"": "?device_id="+device ),"POST",null)
        .then(()=>{console.log();})//nothing needed
        .catch(async(out:[number,any])=>{
            if (out[0]==13||out[0]==31) {
                var [reason,err]:[number,any] = out;
                assert(err != null);
                if (err.message == "Device not found") {
                    reject(37); console.log("That device is not avaliable to play music.");
                } else if (err.reason == "NO_ACTIVE_DEVICE") {
                    getSpotifyDevices("SkipPrevious",account)//find device to play on
                    .then(async(list:any)=>{
                        if (list.length > 0) {
                            console.log("Force playing on " + list[0].name);
                            SpotifySkipPrevious(list[0].id,account).then(resolve)
                            .catch((out:[number,any])=>{reject(out[0]+79)});//maps errors 1-79 into 80-158
                        } else { console.log("No device is avaliable to play music."); }
                    })
                    .catch((out:[number,any])=>{reject(out[0]+40)});//maps errors 1-39 into 41-79
                } else if (err.message == "Player command failed: Restriction violated") {
                    reject(38); console.log("No clue. ln454 Spotify.js");
                } else if (err.status == 502) {
                    reject(39); console.log("SpotifySkipPreviousHttpsError4: \"Bad gateway.\"");
                } else {
                    reject(40); console.log("SpotifySkipPreviousJsonError8: " + JSON.stringify(err));
                }
            } else if (out[0] == 2) {
                resolve(true);
            } else reject(out[0]);
        });
    });
}

/**
 * raises volume
 * @date 5/26/2023
 *  
 * @param {(number|null)} amount
 * @param {(string|null)} device
 * @param {(string|null)} account
 *  
 * @example
 * rejects with codes 1-74
 *  
 * codes 1, 2 and 11-18 are from the first request
 * codes   3-10         are from refressing the token
 * codes  19-36         are from the request after refressing
 * code   37-38         are from SpotifyVolumeUp specifically
 * code   39-74         are from "/volume" request
 */ 
function SpotifyVolumeUp    (amount:number|null, device:string|null, account:string|null):Promise<boolean           > {
    return new Promise<boolean>(async( resolve:((value?:any)=>void), reject:((reason?:any)=>void) )=>{
        SpotifyMeRequestRetry("VolumeUp",account,"","GET",null)
        .then(async(json:any)=>{
            if (json.device                == null) { reject(37); console.log("SpotifyVolumeUpError1: device                == null"); return; }
            if (json.device.volume_percent == null) { reject(38); console.log("SpotifyVolumeUpError2: device.volume_percent == null"); return; }
            console.log(json.device.volume_percent,(amount||10),(Math.min(100,json.device.volume_percent+(amount||10))))
            SpotifyMeRequestRetry("VolumeUp",account,"/volume?volume_percent="+(Math.min(100,json.device.volume_percent+(amount||10))).toString()+((device==null||device=="")?"": "&device_id="+device ),"PUT",null)
            .then ((json:any)=>{
                console.log("SpotifyVolumeUp");
                console.log(json);
                resolve(true);
            })
            .catch((out:[number,any])=>{
                if (out[0] == 2) {
                    resolve(true);
                } else reject(out[0]+38);//maps errors 1-36 into 39-74
            });
        }).catch((out:[number,any])=>reject(out[0]));
    });
}

/**
 * lowers volume
 * @date 5/26/2023
 *  
 * @param {(number|null)} amount
 * @param {(string|null)} device
 * @param {(string|null)} account
 *  
 * @example
 * rejects with codes 1-74
 *  
 * codes 1, 2 and 11-18 are from the first request
 * codes   3-10         are from refressing the token
 * codes  19-36         are from the request after refressing
 * code   37-38         are from SpotifyVolumeUp specifically
 * code   39-74         are from "/volume" request
 */ 
function SpotifyVolumeDown  (amount:number|null, device:string|null, account:string|null):Promise<boolean           > {
    return new Promise<boolean>(async( resolve:((value?:any)=>void), reject:((reason?:any)=>void) )=>{
        SpotifyMeRequestRetry("VolumeDown",account,"","GET",null)
        .then(async(json:any)=>{
            if (json.device                == null) { reject(37); console.log("SpotifyVolumeDownError1: device == null"               ); return; }
            if (json.device.volume_percent == null) { reject(38); console.log("SpotifyVolumeDownError2: device.volume_percent == null"); return; }
            console.log(json.device.volume_percent,(amount||10),(Math.max(0,json.device.volume_percent-(amount||10))))
            SpotifyMeRequestRetry("VolumeDown",account,"/volume?volume_percent="+(Math.max(0,json.device.volume_percent-(amount||10))).toString()+((device==null||device=="")?"": "&device_id="+device ),"PUT",null)
            .then ((json:any)=>{
                console.log("SpotifyVolumeDown");
                console.log(json);
                resolve(true);
            })
            .catch((out:[number,any])=>{
                if (out[0] == 2) {
                    resolve(true);
                } else reject(out[0]+38);//maps errors 1-36 into 39-74
            });
        }).catch((out:[number,any])=>reject(out[0]));
    });
}

/**
 * set volume
 * @date 5/27/2023
 *  
 * @param {(number)}      volume
 * @param {(string|null)} device
 * @param {(string|null)} account
 *  
 * @example
 * rejects with codes 1-36
 *  
 * codes 1 and 11-18 are from the first request
 * codes   3-10      are from refressing the token
 * codes  19-36      are from the request after refressing
 */ 
function SpotifySetVolume   (volume:number,      device:string|null, account:string|null):Promise<boolean           > {
    return new Promise<boolean>(async( resolve:((value?:any)=>void), reject:((reason?:any)=>void) )=>{
        SpotifyMeRequestRetry("SetVolume",account,"/volume?volume_percent="+(Math.min(100,Math.max(0,volume)))+((device==null||device=="")?"": "&device_id="+device ),"PUT",null)
        .then ((json:any)=>{
            console.log("SpotifySetVolume");
            console.log(json);
            resolve(true);
        })
        .catch((out:[number,any])=>{
            if (out[0] == 2) {
                resolve(true);
            } else reject(out[0]);
        });
    });
}

/**
 * returns volume
 * @date 5/26/2023
 *  
 * @param {(number|null)} amount
 * @param {(string|null)} device
 * @param {(string|null)} account
 *  
 * @example
 * rejects with codes 1-38
 *  
 * codes 1, 2 and 11-18 are from the first request
 * codes   3-10         are from refressing the token
 * codes  19-36         are from the request after refressing
 * code   37-38         are from SpotifyGetVolume specifically
 */ 
function SpotifyGetVolume       (                                    account:string|null):Promise<number            > {

    return new Promise<number >(async( resolve:((value?:any)=>void), reject:((reason?:any)=>void) )=>{
        SpotifyMeRequestRetry("GetVolume",account,"","GET",null)
        .then(async(json:any)=>{
            if (json.device                == null) { reject(37); console.log("SpotifyGetVolumeError1: device == null"               ); return; }
            if (json.device.volume_percent == null) { reject(38); console.log("SpotifyGetVolumeError2: device.volume_percent == null"); return; }
            resolve(json.device.volume_percent)
        }).catch((out:[number,any])=>reject(out[0]));
    });
}

/**
 * returns volume
 * @date 5/26/2023
 *  
 * @param {(number|null)} amount
 * @param {(string|null)} device
 * @param {(string|null)} account
 *  
 * @example
 * rejects with codes 1-42
 *  
 * codes 1, 2 and 11-18 are from the first request
 * codes   3-10         are from refressing the token
 * codes  19-36         are from the request after refressing
 * code   37-42         are from SpotifyGetThumbnail specifically
 */ 
function SpotifyGetThumbnail(                                        account:string|null):Promise<Buffer            > {
    return new Promise<Buffer >(async( resolve:((value?:any)=>void), reject:((reason?:any)=>void) )=>{
        SpotifyMeRequestRetry("GetThumbnail",account,"","GET",null)
        .then(async(json:any)=>{
            if (json.item                     == null) { reject(37); console.log("SpotifyGetThumbnailError1: item == null"                    ); return; }
            if (json.item.album               == null) { reject(38); console.log("SpotifyGetThumbnailError2: item.album == null"              ); return; }
            if (json.item.album.images        == null) { reject(39); console.log("SpotifyGetThumbnailError3: item.album.images == null"       ); return; }
            if (json.item.album.images[0]     == null) { reject(40); console.log("SpotifyGetThumbnailError4: item.album.images[0] == null"    ); return; }
            if (json.item.album.images[0].url == null) { reject(41); console.log("SpotifyGetThumbnailError5: item.album.images[0].url == null"); return; }
            const url:string[] = json.item.album.images[0].url.replace("http://","").replace("https://","").split("/");
            const domain:string = url.shift()!;
            const path:string = "/"+url.join("/");
            console.log(domain+path)
            httpsRequestGetBufferPromise(domain,path,{})
            .then((buff:Buffer) => {
                resolve(buff);
            }).catch((err:any) => {
                reject(42); console.log("SpotifyGetThumbnailHttpsError5: " + err);
            });
        }).catch((out:[number,any])=>reject(out[0]));
    });
}

var Spotify = {
    SpotifyClientID,
    SpotifyClientSecret,
    Link,
    defaultAccount,

    SpotifyGetToken,
    getSpotifyDevices,

    SpotifyPlay,
    SpotifyPause,
    SpotifyToggle,
    SpotifySkipNext,
    SpotifySkipPrevious,
    SpotifyStatus,

    SpotifyVolumeUp,
    SpotifyVolumeDown,
    SpotifySetVolume,
    SpotifyGetVolume,

    SpotifyGetThumbnail
}
export {Spotify};