
const fs = require("fs");
import {httpsRequestPromise} from "./Lib";

const SpotifyClientID = fs.readFileSync("Spotify/ClientID.txt", 'utf8');
const SpotifyClientSecret = fs.readFileSync("Spotify/AccessToken.txt", 'utf8');
const redirectLink = fs.readFileSync("Spotify/Redirect.txt", 'utf8');
const Link = "https://accounts.spotify.com/authorize?client_id=" + SpotifyClientID + "&response_type=code&redirect_uri=" + redirectLink + "/SetSpotifyToken&scope=user-modify-playback-state user-read-playback-position user-read-currently-playing user-read-recently-played user-read-playback-state";
function GetSpotifyToken(code:string) {
    httpsRequestPromise("api.spotify.com","/api/token","POST",{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},"grant_type=authorization_code&code=" + code + "&redirect_uri=" + redirectLink + "/SetSpotifyToken&client_id=" + SpotifyClientID + "&client_secret=" + SpotifyClientSecret)
    .then((curl:string) => {
        try {
            if (JSON.parse(curl)) {
                var json:any = JSON.parse(curl);
                if (json.error != null) {
                    console.log("SpotifyGetTokenError1: " + json.error);
                } else {
                    fs.writeFileSync("Spotify/AccessToken" + "Test" + ".txt",json.access_token)
                    fs.writeFileSync("Spotify/RefreshToken" + "Test" + ".txt",json.refresh_token)
                }
            }
        } catch (err:any) { console.log("SpotifyGetTokenError2: " + err); }
    }).catch((err:any) => {
        if (err.toString() != "SyntaxError: Unexpected end of JSON input") {
            console.log("SpotifyGetTokenError3: " + err);
        }
    });
}

/**
 * Starts spotify playback on account selected
 * @param [link] A link to the song, playlist, album, (.etc) you want to play(optional)
 * @param [device] The device you want to play on(optional)
 * @param [account] The keyword for the account to play on(optional)
 * @returns none
 */
function SpotifyPlay(link?:null|string, device?:string|null, account?:string|null) {
    return new Promise<boolean>((resolve, reject) => {
        var SpotifyAccessTokenPer:null|string = null;
        try { SpotifyAccessTokenPer = fs.readFileSync("Spotify/AccessToken" + (account != null ? account : "") + ".txt", 'utf8');
        } catch (err) { reject(1); console.log("SpotifyPlayFileError1: " + err); return; }
        
        if (SpotifyAccessTokenPer != null && SpotifyAccessTokenPer != "") {
            var data:Object = {};
            if (link != null) {
                if (link.includes("open.spotify.com/") && (link.includes("playlist") || link.includes("album") || link.includes("show") || link.includes("track") || link.includes("artist") || link.includes("episode"))) {
                    link = link.replace("https://",""); link = link.replace("open.","");
                    link = link.replace(".com/",":"); link = link.replace("/",":");
                    link = link.split("?")[0];
                    data = { "context_uri": link };
                }
            }
            httpsRequestPromise("api.spotify.com","/v1/me/player/play" + ((device == null || device == "") ? "" : "?device_id=" + device),"PUT",{"Accept":"application/json","Content-Type":"application/json","Authorization":"Bearer " + SpotifyAccessTokenPer},((Object.keys(data).length === 0) ? null : JSON.stringify(data)))
            .then((curl:string) => {
                try {
                    if (JSON.parse(curl) != null) {
                        var json:any = JSON.parse(curl);
                        if (json.error != null) {
                            if (json.error.message == "The access token expired" || json.error.message == "Invalid access token") {
                                var SpotifyRefreshTokenPer:null|string = fs.readFileSync("Spotify/RefreshToken" + (account != null ? account : "") + ".txt", 'utf8');
                                if (SpotifyRefreshTokenPer != null && SpotifyRefreshTokenPer != "") {
                                    httpsRequestPromise("accounts.spotify.com","/api/token","POST",{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},"grant_type=refresh_token&refresh_token=" + SpotifyRefreshTokenPer + "&client_id=" + SpotifyClientID + "&client_secret=" + SpotifyClientSecret)
                                    .then((curl:string) => {
                                        try {
                                            if (JSON.parse(curl)) {
                                                var json:any = JSON.parse(curl);
                                                if (json.error == null) {
                                                    //set refreshed token and retry function
                                                    fs.writeFileSync("Spotify/AccessToken" + (account != null ? account : "") + ".txt",json.access_token);
                                                    SpotifyPlay(link,device,account).then(resolve).catch(reject);
                                                } else {
                                                    reject(2); console.log("SpotifyPlayJsonError1: " + json.error);
                                                }
                                            }
                                        } catch (err:any) {
                                            reject(3); console.log("SpotifyPlayTryCatchError1: " + err);
                                        }
                                    }).catch((err:Error) => {
                                        reject(4); console.log("SpotifyPlayhttpsRequestError1: " + err);
                                    });
                                } else {
                                    reject(5); console.log("SpotifyPlayTokenError1: Spotify refresh token not found");
                                }
                            } else if (json.error.message == "Device not found") {
                                reject(6); console.log("That device is not avaliable to play music.");
                            } else if (json.error.reason == "NO_ACTIVE_DEVICE") {
                                //find device to play on
                                httpsRequestPromise("accounts.spotify.com","/v1/me/player/devices","GET",{"Accept":"application/json","Content-Type":"application/json","Authorization":"Bearer " + SpotifyAccessTokenPer},null)
                                .then((curl:string) => {
                                    try {
                                        if (JSON.parse(curl)) {
                                            var json:any = JSON.parse(curl);
                                            if (json.error != null) {
                                                if (json.error.message == "The access token expired") {
                                                    reject(7); console.log("SpotifyPlayError2: Spotify refresh token expired");
                                                } else if (json.error.message == "Invalid access token") {
                                                    reject(8); console.log("Access token is invalid, Reauthentication is required.2");console.log(json.error.status);
                                                } else {
                                                    reject(9); console.log("SpotifyPlayJsonError2: " + JSON.stringify(json.error));
                                                }
                                            } else {
                                                //play on first device
                                                var list:Array<any> = json.devices.filter((item:any)=>item.name!="32\" TCL Roku TV");
                                                if (list.length > 0) {
                                                    console.log("Force playing on " + list[0].name);
                                                    SpotifyPlay(link,list[0].id,account).then(resolve).catch(reject);
                                                } else {
                                                    resolve(false); console.log("No device is avaliable to play music.");
                                                }
                                            }
                                        } else {
                                            reject(10); console.log("SpotifySkipPreviousJsonError: could not parse json");
                                        }
                                    } catch (err:any) {
                                        reject(11); console.log("SpotifyPlayTryCatchError2: " + err);
                                    }
                                }).catch((err:Error) => {
                                    //special error cases
                                    if (("" + err).startsWith("Error: getaddrinfo ENOTFOUND ")) {
                                        reject(12); console.log("SpotifyPlayhttpsRequestError2: " + (""+err).slice("Error: getaddrinfo ENOTFOUND ".length) + " address info not found.");
                                    } else if (("" + err).startsWith("Error: connect ETIMEDOUT ")) {
                                        reject(13); console.log("SpotifyPlayhttpsRequestError3: " + (""+err).slice("Error: connect ETIMEDOUT ".length) + " connection timed out.");
                                    } else {
                                        reject(14); console.log("SpotifyPlayhttpsRequestError4: " + err);
                                    }
                                });
                            } else if (json.error.message == "Player command failed: Restriction violated") {
                                resolve(true); //console.log("That device is already playing music.");
                            } else if (json.error.message == "Invalid context uri") {
                                console.log("Invalid music link.");
                                SpotifyPlay(null,device,account).then(resolve).catch(reject);
                            } else {
                                if (json.error.status == 502) {
                                    reject(15); console.log("SpotifyPlayJsonError3: \"Bad gateway.\"");
                                } else {
                                    reject(16); console.log("SpotifyPlayJsonError4: " + JSON.stringify(json.error));
                                }
                            }
                        }
                    } else {
                        reject(17); console.log("SpotifyPlayJsonError4: could not parse json");
                    }
                } catch (err:any) {
                    if (err.toString() != "SyntaxError: Unexpected end of JSON input") {
                        reject(18); console.log("SpotifyPlayTryCatchError5: " + err);
                        console.log("\n" + curl);
                    }
                    else { resolve(true); /*play successful*/ }
                }
            }).catch((err:Error) => {
                if (("" + err).startsWith("Error: getaddrinfo ENOTFOUND ")) {
                    reject(19); console.log("SpotifyPlayhttpsRequestError5: " + (""+err).slice("Error: getaddrinfo ENOTFOUND ".length) + " address info not found.");
                } else if (("" + err).startsWith("Error: connect ETIMEDOUT ")) {
                    reject(20); console.log("SpotifyPlayhttpsRequestError6: " + (""+err).slice("Error: connect ETIMEDOUT ".length) + " connection timed out.");
                } else {
                    reject(21); console.log("SpotifyPlayhttpsRequestError7: " + err);
                }
            });
        }
    });
}

/**
 * Stops spotify playback on account selected
 * @param [account] The keyword for the account to stop playback on(optional)
 * @returns none
 */
function SpotifyPause(account?:string|null) {
    return new Promise<boolean>((resolve,reject) => {
        var SpotifyAccessTokenPer:null|string = null;
        try { SpotifyAccessTokenPer = fs.readFileSync("Spotify/AccessToken" + (account != null ? account : "") + ".txt", 'utf8');
        } catch (err) { reject(1); console.log("SpotifyPauseFileError1: " + err); return; }
        if (SpotifyAccessTokenPer != null && SpotifyAccessTokenPer != "") {
            httpsRequestPromise("api.spotify.com","/v1/me/player/pause","PUT",{"Accept":"application/json","Content-Type":"application/json","Authorization":"Bearer " + SpotifyAccessTokenPer},null)
            .then((curl:string) => {
                try {
                    if (JSON.parse(curl)) {
                        var json:any = JSON.parse(curl);
                        if (json.error.message == "The access token expired") {
                            //get the refreshtoken
                            var SpotifyRefreshTokenPer:null|string = fs.readFileSync("Spotify/RefreshToken" + (account != null ? account : "") + ".txt", 'utf8');
                            if (SpotifyRefreshTokenPer != null && SpotifyRefreshTokenPer != "") {
                                //refresh the token
                                httpsRequestPromise("accounts.spotify.com","/api/token","POST",{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},"grant_type=refresh_token&refresh_token=" + SpotifyRefreshTokenPer + "&client_id=" + SpotifyClientID + "&client_secret=" + SpotifyClientSecret)
                                .then((curl:string) => {
                                    try {
                                        if (JSON.parse(curl)) {
                                            var json:any = JSON.parse(curl);
                                            if (json.error == null) {
                                                //set refreshed token and retry function
                                                fs.writeFileSync("Spotify/AccessToken" + (account != null ? account : "") + ".txt",json.access_token);
                                                SpotifyPause(account).then(resolve).catch(reject);
                                            } else {
                                                reject(2); console.log("SpotifyPauseJsonError1: " + json.error);
                                            }
                                        }
                                    } catch (err:any) {
                                        reject(3); console.log("SpotifyPauseTryCatchError1: " + err);
                                    }
                                }).catch((err:Error) => {
                                    reject(4); console.log("SpotifyPausehttpsRequestError1: " + err);
                                });
                            } else {
                                reject(5); console.log("SpotifyPauseTokenError1: Spotify refresh token not found");
                            }
                        } else if (json.error.message == "Device not found") {
                            reject(6); console.log("That device is not avaliable to play music.");
                        } else if (json.error.message == "Invalid access token") {
                            reject(7); console.log("Access token is invalid, Reauthentication is required.");
                        } else if (json.error.reason == "NO_ACTIVE_DEVICE") {
                            resolve(false); console.log("No device is currently playing music.");
                        } else if (json.error.message == "Player command failed: Restriction violated") {
                            reject(8);
                        } else {
                            reject(9); console.log("SpotifyPauseJsonError2: " + JSON.stringify(json.error));
                        }
                    } else {
                        reject(10); console.log("SpotifyPauseJsonError3: could not parse json");
                    }
                } catch (err:any) {
                    if (err.toString() != "SyntaxError: Unexpected end of JSON input") {
                        console.log("SpotifyPauseTryCatchError2: " + err); reject(11);
                    } else {
                        //succesfully paused
                        resolve(false);
                    }
                }
            }).catch((err:Error) => {
                reject(12); console.log("SpotifyPausehttpsRequestError2: " + err);
            });
        }
    });
}

/**
 * Toggles if playback is playing or paused on account selected
 * @param [device] The device you want to play on if there is not currently playback(optional)
 * @param [account] The keyword for the account to toggle playback on(optional)
 * @returns none
 */
function SpotifyToggle(device?:string|null, account?:string|null) {
    return new Promise<boolean>((resolve,reject) => {
        var SpotifyAccessTokenPer:null|string = null;
        try { SpotifyAccessTokenPer = fs.readFileSync("Spotify/AccessToken" + (account != null ? account : "") + ".txt", 'utf8');
        } catch (err) { reject(1); console.log("SpotifyToggleFileError1: " + err); return; }
        if (SpotifyAccessTokenPer != null && SpotifyAccessTokenPer != "") {
            httpsRequestPromise("api.spotify.com","/v1/me/player","GET",{"Accept":"application/json","Content-Type":"application/json","Authorization":"Bearer " + SpotifyAccessTokenPer},null)
            .then((curl:string) => {
                try {
                    if (JSON.parse(curl)) {
                        var json:any = JSON.parse(curl);
                        if (json.error != null) {
                            if (json.error.message == "The access token expired") {
                                var SpotifyRefreshTokenPer:null|string = fs.readFileSync("Spotify/RefreshToken" + (account != null ? account : "") + ".txt", 'utf8');
                                if (SpotifyRefreshTokenPer != null && SpotifyRefreshTokenPer != "") {
                                    httpsRequestPromise("accounts.spotify.com","/api/token","POST",{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},"grant_type=refresh_token&refresh_token=" + SpotifyRefreshTokenPer + "&client_id=" + SpotifyClientID + "&client_secret=" + SpotifyClientSecret)
                                    .then((curl:string) => {
                                        try {
                                            if (JSON.parse(curl)) {
                                                var json:any = JSON.parse(curl);
                                                if (json.error == null) {
                                                    //set refreshed token and retry function
                                                    fs.writeFileSync("Spotify/AccessToken" + (account != null ? account : "") + ".txt",json.access_token);
                                                    SpotifyToggle(device,account).then(resolve).catch(reject);
                                                } else {
                                                    reject(2); console.log("SpotifyToggleJsonError1: " + json.error);
                                                }
                                            } else {
                                                reject(3); console.log("SpotifyToggleJsonError2: could not parse json");
                                            }
                                        } catch (err) {
                                            reject(4); console.log("SpotifyToggleTryCatchError1: " + err);
                                        }
                                    }).catch((err:Error) => {
                                        reject(5); console.log("SpotifyTogglehttpsRequestError1: " + err);
                                    });
                                } else {
                                    reject(6); console.log("SpotifyToggleTokenError1: Spotify refresh token not found");
                                }
                            } else if (json.error.message == "Invalid access token") {
                                reject(7); console.log("Access token is invalid, Reauthentication is required.");
                            } else {
                                reject(8); console.log("SpotifyToggleJsonError3: " + JSON.stringify(json.error));
                            }
                        } else {
                            if (json.is_playing != null) {
                                if (json.is_playing == true) {
                                    SpotifyPause(account).then((val:boolean) => {
                                        resolve(val);
                                    }).catch((err:number) => {
                                        reject(err+12);
                                    });
                                } else {
                                    SpotifyPlay(null,device,account).then((val:boolean) => {
                                        resolve(val);
                                    }).catch((err:number) => {
                                        reject(err+12);
                                    });
                                }
                            } else {
                                reject(9); console.log("SpotifyToggleError1: IsPlaying == null");
                            }
                        }
                    } else {
                        reject(10); console.log("SpotifyToggleJsonError4: could not parse json");
                    }
                } catch (err:any) {
                    if (err.toString() != "SyntaxError: Unexpected end of JSON input") {
                        reject(11); console.log("SpotifyToggleTryCatchError2: " + err);
                    } else {
                        SpotifyPlay(null,device,account).then((val:boolean) => {
                            resolve(val);
                        }).catch((err:number) => {
                            reject(err+12);
                        });
                    }
                }
            }).catch((err:string) => {
                reject(12); console.log("SpotifyTogglehttpsRequestError2: " + err);
            });
        }
    });
}

/**
 * Gets the playback status of the account selected
 * @param [account] The keyword for the account to get status of(optional)
 * @returns A promise which supplies if there is currently playback, what the song name is, and the artist/album name
 */
function SpotifyStatus(account?:string|null) {
    return new Promise<Array<any>>((resolve, reject) => {
        var SpotifyAccessTokenPer:null|string = null;
        try { SpotifyAccessTokenPer = fs.readFileSync("Spotify/AccessToken" + (account != null ? account : "") + ".txt", 'utf8');
        } catch (err) { reject(1); console.log("SpotifyStatusFileError1: " + err); return; }
        if (SpotifyAccessTokenPer != null && SpotifyAccessTokenPer != "") {
            httpsRequestPromise("api.spotify.com","/v1/me/player","GET",{"Accept":"application/json","Content-Type":"application/json","Authorization":"Bearer " + SpotifyAccessTokenPer},null)
            .then((curl:string) => {
                try {
                    if (curl == "") {
                        resolve([false,"",""]);
                    } else if (JSON.parse(curl)) {
                        var json:any = JSON.parse(curl);
                        if (json.error != null) {
                            if (json.error.message == "The access token expired") {
                                var SpotifyRefreshTokenPer:null|string = fs.readFileSync("Spotify/RefreshToken" + (account != null ? account : "") + ".txt", 'utf8');
                                if (SpotifyRefreshTokenPer != null && SpotifyRefreshTokenPer != "") {
                                    httpsRequestPromise("accounts.spotify.com","/api/token","POST",{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},"grant_type=refresh_token&refresh_token=" + SpotifyRefreshTokenPer + "&client_id=" + SpotifyClientID + "&client_secret=" + SpotifyClientSecret)
                                    .then((curl:string) => {
                                        try {
                                            if (JSON.parse(curl)) {
                                                var json:any = JSON.parse(curl);
                                                if (json.error == null) {
                                                    //set refreshed token and retry function
                                                    fs.writeFileSync("Spotify/AccessToken" + (account != null ? account : "") + ".txt",json.access_token);
                                                    SpotifyStatus(account).then(resolve).catch(reject);
                                                } else {
                                                    reject(2); console.log("SpotifyStatusJsonError1: " + json.error);
                                                }
                                            } else {
                                                reject(3); console.log("SpotifyStatusJsonError2: could not parse json");
                                            }
                                        } catch (err:any) {
                                            reject(4); console.log("SpotifyStatusTryCatchError1: " + err);
                                        }
                                    }).catch((err:Error) => {
                                        reject(5); console.log("SpotifyStatushttpsRequestError1: " + err);
                                    });
                                } else {
                                    reject(6); console.log("SpotifyStatusTokenError1: Spotify refresh token not found");
                                }
                            } else if (json.error.message == "Invalid access token") {
                                reject(7); console.log("Access token is invalid, Reauthentication is required.");
                            } else {
                                reject(8); console.log("SpotifyStatusJsonError3: " + JSON.stringify(json.error));
                            }
                        } else {
                            if (json.is_playing != null) {
                                if (json.is_playing == true) {
                                    if (json.item != null && json.item.name != null && json.item.artists[0].name != null) {
                                        resolve([true, json.item.name, json.item.artists[0].name]);
                                    } else {
                                        resolve([true, "", ""]);
                                    }
                                } else {
                                    resolve([false, "", ""]);
                                }
                            } else {
                                reject(9); console.log("SpotifyStatusError1: IsPlaying == null");
                            }
                        }
                    } else {
                        reject(10); console.log("SpotifyStatusJsonError4: could not parse json");
                    }
                } catch (err:any) {
                    if (err.toString() != "SyntaxError: Unexpected end of JSON input") {
                        reject(11); console.log("SpotifyStatusTryCatchError2: " + err);
                    }
                }
            }).catch((err:Error) => {
                reject(12); console.log("SpotifyStatushttpsRequestError2: " + err);
            });
        }
    });
}

/**
 * Skips to the next song on account selected
 * @param [device] The device you want to skip on(optional)
 * @param [account] The keyword for the account to skip on(optional)
 * @returns none
 */
function SpotifySkipNext(device?:string|null, account?:string|null) {
    return new Promise<boolean>((resolve,reject) => {
        var SpotifyAccessTokenPer:null|string = null;
        try { SpotifyAccessTokenPer = fs.readFileSync("Spotify/AccessToken" + (account != null ? account : "") + ".txt", 'utf8');
        } catch (err) { reject(1); console.log("SpotifySkipNextFileError1: " + err); return; }
        if (SpotifyAccessTokenPer != null && SpotifyAccessTokenPer != "") {
            httpsRequestPromise("api.spotify.com", "/v1/me/player/next" + ((device == null || device == "") ? "" : "?device_id=" + device),"POST",{"Accept":"application/json","Content-Type":"application/json","Authorization":"Bearer " + SpotifyAccessTokenPer},null)
            .then((curl:string) => {
                try {
                    if (JSON.parse(curl) != null) {
                        var json:any = JSON.parse(curl);
                        if (json.error != null) {
                            if (json.error.message == "The access token expired") {
                                var SpotifyRefreshTokenPer:null|string = fs.readFileSync("Spotify/RefreshToken" + (account != null ? account : "") + ".txt", 'utf8');
                                if (SpotifyRefreshTokenPer != null && SpotifyRefreshTokenPer != "") {
                                    httpsRequestPromise("accounts.spotify.com","/api/token","POST",{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},"grant_type=refresh_token&refresh_token=" + SpotifyRefreshTokenPer + "&client_id=" + SpotifyClientID + "&client_secret=" + SpotifyClientSecret)
                                    .then((curl:string) => {
                                        try {
                                            if (JSON.parse(curl)) {
                                                var json:any = JSON.parse(curl);
                                                if (json.error == null) {
                                                    //set refreshed token and retry function
                                                    fs.writeFileSync("Spotify/AccessToken" + (account != null ? account : "") + ".txt",json.access_token);
                                                    SpotifySkipNext(device,account);
                                                } else {
                                                    reject(2); console.log("SpotifySkipNextJsonError1: " + json.error);
                                                }
                                            } else {
                                                reject(3); console.log("SpotifySkipNextJsonError2: could not parse json");
                                            }
                                        } catch (err:any) {
                                            reject(4);console.log("SpotifySkipNextTryCatchError1: " + err);
                                        }
                                    }).catch((err:Error) => {
                                        reject(5); console.log("SpotifySkipNexthttpsRequestError1: " + err);
                                    });
                                } else {
                                    reject(6); console.log("SpotifySkipNextTokenError: Spotify refresh token not found");
                                }
                            } else if (json.error.message == "Invalid access token") {
                                reject(7); console.log("Access token is invalid, Reauthentication is required.");
                            } else if (json.error.message == "Device not found") {
                                console.log("That device is not currently playing music.");
                                reject(8);
                            } else if (json.error.reason == "NO_ACTIVE_DEVICE") {
                                //find device to play on
                                httpsRequestPromise("accounts.spotify.com","/v1/me/player/devices","GET",{"Accept":"application/json","Content-Type":"application/json","Authorization":"Bearer " + SpotifyAccessTokenPer},null)
                                .then((curl:string) => {
                                    try {
                                        if (JSON.parse(curl)) {
                                            var json:any = JSON.parse(curl);
                                            if (json.error != null) {
                                                if (json.error.message == "The access token expired") {
                                                    reject(9); console.log("SpotifySkipNextError: Spotify refresh token expired");
                                                } else if (json.error.message == "Invalid access token") {
                                                    reject(10); console.log("Access token is invalid, Reauthentication is required.");
                                                } else {
                                                    reject(11); console.log("SpotifySkipNextJsonError3: " + JSON.stringify(json.error));
                                                }
                                            } else {
                                                //play on first device
                                                var list:Array<any> = json.devices.filter((item:any)=>item.name!="32\" TCL Roku TV");
                                                if (list.length > 0) {
                                                    console.log("Force playing on " + list[0].name);
                                                    SpotifySkipNext(list[0].id,account);
                                                } else {
                                                    resolve(false); console.log("No device is currently playing music.");
                                                }
                                            }
                                        } else {
                                            reject(12); console.log("SpotifySkipNextJsonError4: could not parse json");
                                        }
                                    } catch (err:any) {
                                        reject(13); console.log("SpotifySkipNextTryCatchError2: " + err)
                                    }
                                }).catch((err:Error) => {
                                    reject(14); console.log("SpotifySkipNexthttpsRequestError2: " + err);
                                });
                            } else if (json.error.message == "Player command failed: Restriction violated") {
                                console.log("No clue. ln454 Spotify.js");
                                resolve(true);
                            } else {
                                reject(15); console.log("SpotifySkipNextJsonError5: " + JSON.stringify(json.error));
                            }
                        }
                    } else {
                        reject(16); console.log("SpotifySkipNextJsonError6: could not parse json");
                    }
                } catch (err:any) {
                    if (err.toString() != "SyntaxError: Unexpected end of JSON input") {
                        reject(17); console.log("SpotifySkipNextTryCatchError3: " + err);
                    } else {
                        //success
                        resolve(true);
                    }
                }
            }).catch((err:Error) => {
                reject(18); console.log("SpotifySkipNexthttpsRequestError3: " + err);
            });
        }
    });
}

/**
 * Skips to the previous song on account selected
 * @param [device] the device you want to skip on(optional)
 * @param [account] the keyword for the account to skip on(optional)
 * @returns none
 */
function SpotifySkipPrevious(device?:string|null, account?:string|null) {
    return new Promise<boolean>((resolve,reject) => {
        var SpotifyAccessTokenPer:null|string = null;
        try { SpotifyAccessTokenPer = fs.readFileSync("Spotify/AccessToken" + (account != null ? account : "") + ".txt", 'utf8');
        } catch (err) { reject(1); console.log("SpotifySkipPreviousFileError1: " + err); return; }
        if (SpotifyAccessTokenPer != null && SpotifyAccessTokenPer != "") {
            httpsRequestPromise("spotify.com", "/v1/me/player/previous" + ((device == null || device == "") ? "" : "?device_id=" + device),"POST",{"Accept":"application/json","Content-Type":"application/json","Authorization":"Bearer " + SpotifyAccessTokenPer},null)
            .then((curl:string) => {
                try {
                    if (JSON.parse(curl) != null) {
                        var json:any = JSON.parse(curl);
                        if (json.error != null) {
                            if (json.error.message == "The access token expired") {
                                var SpotifyRefreshTokenPer:null|string = fs.readFileSync("Spotify/RefreshToken" + (account != null ? account : "") + ".txt", 'utf8');
                                if (SpotifyRefreshTokenPer != null && SpotifyRefreshTokenPer != "") {
                                    httpsRequestPromise("spotify.com","/api/token","POST",{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},"grant_type=refresh_token&refresh_token=" + SpotifyRefreshTokenPer + "&client_id=" + SpotifyClientID + "&client_secret=" + SpotifyClientSecret)
                                    .then((curl:string) => {
                                        try {
                                            if (JSON.parse(curl)) {
                                                var json:any = JSON.parse(curl);
                                                if (json.error == null) {
                                                    //set refreshed token and retry function
                                                    fs.writeFileSync("Spotify/AccessToken" + (account != null ? account : "") + ".txt",json.access_token);
                                                    SpotifySkipPrevious(device,account);
                                                } else {
                                                    reject(2); console.log("SpotifySkipPreviousJsonError1: " + json.error);
                                                }
                                            } else {
                                                reject(3); console.log("SpotifySkipPreviousJsonError2: could not parse json");
                                            }
                                        } catch (err:any) {
                                            reject(4);console.log("SpotifySkipPreviousTryCatchError1: " + err);
                                        }
                                    }).catch((err:Error) => {
                                        reject(5); console.log("SpotifySkipPrevioushttpsRequestError1: " + err);
                                    });
                                } else {
                                    reject(6); console.log("SpotifySkipPreviousTokenError: Spotify refresh token not found");
                                }
                            } else if (json.error.message == "Invalid access token") {
                                reject(7); console.log("Access token is invalid, Reauthentication is required.");
                            } else if (json.error.message == "Device not found") {
                                console.log("That device is not currently playing music.");
                                reject(8);
                            } else if (json.error.reason == "NO_ACTIVE_DEVICE") {
                                //find device to play on
                                httpsRequestPromise("spotify.com","/v1/me/player/devices","GET",{"Accept":"application/json","Content-Type":"application/json","Authorization":"Bearer " + SpotifyAccessTokenPer},null)
                                .then((curl:string) => {
                                    try {
                                        if (JSON.parse(curl)) {
                                            var json:any = JSON.parse(curl);
                                            if (json.error != null) {
                                                if (json.error.message == "The access token expired") {
                                                    reject(9); console.log("SpotifySkipPreviousError: Spotify refresh token expired");
                                                } else if (json.error.message == "Invalid access token") {
                                                    reject(10); console.log("Access token is invalid, Reauthentication is required.");
                                                } else {
                                                    reject(11); console.log("SpotifySkipPreviousJsonError3: " + JSON.stringify(json.error));
                                                }
                                            } else {
                                                //play on first device
                                                var list:Array<any> = json.devices.filter((item:any)=>item.name!="32\" TCL Roku TV");
                                                if (list.length > 0) {
                                                    console.log("Force playing on " + list[0].name);
                                                    SpotifySkipPrevious(list[0].id,account);
                                                } else {
                                                    resolve(false); console.log("No device is currently playing music.");
                                                }
                                            }
                                        } else {
                                            reject(12); console.log("SpotifySkipPreviousJsonError4: could not parse json");
                                        }
                                    } catch (err:any) {
                                        reject(13); console.log("SpotifySkipPreviousTryCatchError2: " + err)
                                    }
                                }).catch((err:Error) => {
                                    reject(14); console.log("SpotifySkipPrevioushttpsRequestError2: " + err);
                                });
                            } else if (json.error.message == "Player command failed: Restriction violated") {
                                console.log("No clue. ln454 Spotify.js");
                                resolve(true);
                            } else {
                                reject(15); console.log("SpotifySkipPreviousJsonError5: " + JSON.stringify(json.error));
                            }
                        }
                    } else {
                        reject(16); console.log("SpotifySkipPreviousJsonError6: could not parse json");
                    }
                } catch (err:any) {
                    if (err.toString() != "SyntaxError: Unexpected end of JSON input") {
                        reject(17); console.log("SpotifySkipPreviousTryCatchError3: " + err);
                    } else {
                        //success
                        resolve(true);
                    }
                }
            }).catch((err:Error) => {
                reject(18); console.log("SpotifySkipPrevioushttpsRequestError3: " + err);
            });
        }
    });
}
var Spotify = {
    SpotifyClientID,
    SpotifyClientSecret,
    Link,
    GetSpotifyToken,
    SpotifyPlay,
    SpotifyPause,
    SpotifyToggle,
    SpotifyStatus,
    SpotifySkipNext,
    SpotifySkipPrevious
}
export {Spotify};