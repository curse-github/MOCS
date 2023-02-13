const https = require("https");
const fs = require("fs");

const SpotifyClientID = "********************************";
const Link = "https://accounts.spotify.com/authorize?client_id=" + SpotifyClientID + "&response_type=code&redirect_uri=http://mc.campbellsimpson.com:8081/SetSpotifyToken&scope=user-modify-playback-state user-read-playback-position user-read-currently-playing user-read-recently-played user-read-playback-state"
const SpotifyClientSecret = "********************************";
function Request(link,path,method,headers,data,callback) {
    var curl = "";
    if (data != null) {
        headers["Content-Length"] = data.length;
    }
    var options = {
        "host": link,
        "port": 443,
        "path": path,
        "method": method,
        "headers": headers
    };
    var req = https.request(options, (res) => {
        //res.statusCode
        res.setEncoding('utf8');
        res.on("data", (chunk) => {
            curl += chunk
        });
        res.on("close", () => {
            callback(curl,null);
        });
    });
    req.on("error", (e) => {
        callback(null,e.message);
    });
    if (data != null) {
        req.write(data);
    }
    req.end();
}
//#region Spotify
function GetSpotifyToken(code) {
    //curlRequest('-d grant_type=authorization_code -d code=' + code + ' -d redirect_uri=http://localhost:8081/SetSpotifyToken -d client_id=' + SpotifyClientID + ' -d client_secret=' + SpotifyClientSecret + ' https://accounts.spotify.com/api/token', (curl,err) => {
    Request("accounts.spotify.com","/api/token","POST",{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},'grant_type=authorization_code&code=' + code + '&redirect_uri=http://mc.campbellsimpson.com:8081/SetSpotifyToken&client_id=' + SpotifyClientID + '&client_secret=' + SpotifyClientSecret, (curl,err) => {
        if (err == null) {
            try {
                if (JSON.parse(curl)) {
                    var json = JSON.parse(curl);
                    if (json.error != null) {
                        console.log("GetSpotifyTokenError1: " + json.error);
                    } else {
                        fs.writeFileSync("AccessToken" + "" + ".txt",json.access_token)
                        fs.writeFileSync("RefreshToken" + "" + ".txt",json.refresh_token)
                    }
                }
            } catch (err2) { console.log("GetSpotifyTokenError2: " + err2); }
        } else {
            console.log("GetSpotifyTokenError3: " + err);
        }
    });
}

function SpotifyPlay(callback, link, device, account) {
    var SpotifyAccessTokenPer = null;
    try { SpotifyAccessTokenPer = fs.readFileSync("AccessToken" + (account != null ? account : "") + ".txt", 'utf8');
    } catch (err) { callback(null,-1); console.log("SpotifyPlayFileError1: " + err); return; }
    
    if (SpotifyAccessTokenPer != null && SpotifyAccessTokenPer != "") {
        var data = null;
        if (link != null) {
            if (link.includes("open.spotify.com/") && (link.includes("playlist") || link.includes("album") || link.includes("show") || link.includes("track") || link.includes("artist") || link.includes("episode"))) {
                link = link.replace("https://",""); link = link.replace("open.","");
                link = link.replace(".com/",":"); link = link.replace("/",":");
                link = link.split("?")[0];
                data = { "context_uri": link };
            }
        }
        Request("api.spotify.com","/v1/me/player/play" + ((device == null || device == "") ? "" : "?device_id=" + device),"PUT",{"Accept":"application/json","Content-Type":"application/json","Authorization":"Bearer " + SpotifyAccessTokenPer},(data == null ? null : JSON.stringify(data)),(curl,err) => {
            if (err == null) {
                try {
                    if (JSON.parse(curl) != null) {
                        var json = JSON.parse(curl);
                        if (json.error != null) {
                            if (json.error.message == "The access token expired" || json.error.message == "Invalid access token") {
                                var SpotifyRefreshTokenPer = fs.readFileSync("RefreshToken" + (account != null ? account : "") + ".txt", 'utf8');
                                if (SpotifyRefreshTokenPer != null && SpotifyRefreshTokenPer != "") {
                                    Request("accounts.spotify.com","/api/token","POST",{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},"grant_type=refresh_token&refresh_token=" + SpotifyRefreshTokenPer + "&client_id=" + SpotifyClientID + "&client_secret=" + SpotifyClientSecret, (curl,err) => {
                                        if (err == null) {
                                            try {
                                                if (JSON.parse(curl)) {
                                                    var json = JSON.parse(curl);
                                                    if (json.error == null) {
                                                        //set refreshed token and retry function
                                                        fs.writeFileSync("AccessToken" + (account != null ? account : "") + ".txt",json.access_token);
                                                        SpotifyPlay(callback,link,device,account);
                                                    } else {
                                                        callback(null,1); console.log("SpotifyPlayJsonError1: " + json.error);
                                                    }
                                                }
                                            } catch (err2) {
                                                callback(null,2); console.log("SpotifyPlayTryCatchError1: " + err2);
                                            }
                                        } else {
                                            callback(null,3); console.log("SpotifyPlayRequestError1: " + err);
                                        }
                                    });
                                } else {
                                    callback(null,4); console.log("SpotifyPlayTokenError1: Spotify refresh token not found");
                                }
                            } else if (json.error.message == "Device not found") {
                                callback(null,6); console.log("That device is not avaliable to play music.");
                            } else if (json.error.reason == "NO_ACTIVE_DEVICE") {
                                //find device to play on
                                Request("api.spotify.com","/v1/me/player/devices","GET",{"Accept":"application/json","Content-Type":"application/json","Authorization":"Bearer " + SpotifyAccessTokenPer},null,(curl,err) => {
                                    if (err == null) {
                                        try {
                                            if (JSON.parse(curl)) {
                                                var json = JSON.parse(curl);
                                                if (json.error != null) {
                                                    if (json.error.message == "The access token expired") {
                                                        callback(null,7); console.log("SpotifyPlayError2: Spotify refresh token expired");
                                                    } else if (json.error.message == "Invalid access token") {
                                                        callback(null,8); console.log("Access token is invalid, Reauthentication is required.2");console.log(json.error.status);
                                                    } else {
                                                        callback(null,9); console.log("SpotifyPlayJsonError2: " + JSON.stringify(json.error));
                                                    }
                                                } else {
                                                    //play on first device
                                                    list = json.devices.filter((item)=>item.name!="32\" TCL Roku TV");
                                                    if (list.length > 0) {
                                                        console.log("Force playing on " + list[0].name);
                                                        SpotifyPlay(callback,link,list[0].id,account);
                                                    } else {
                                                        callback(false,10); console.log("No device is avaliable to play music.");
                                                    }
                                                }
                                            } else {
                                                callback(null,11); console.log("SpotifySkipPreviousJsonError: could not parse json");
                                            }
                                        } catch (err2) {
                                            callback(null,12); console.log("SpotifyPlayTryCatchError2: " + err2);
                                        }
                                    } else {
                                        callback(null,13); console.log("SpotifyPlayRequestError2: " + err);
                                    }
                                });
                            } else if (json.error.message == "Player command failed: Restriction violated") {
                                //console.log("That device is already playing music.");
                                callback(true,14);
                            } else if (json.error.message == "Invalid context uri") {
                                console.log("Invalid music link.");
                                SpotifyPlay(callback,null,device,account);
                            } else {
                                callback(null,15); console.log("SpotifyPlayJsonError3: " + JSON.stringify(json.error));
                            }
                        }
                    } else {
                        callback(null,16); console.log("SpotifyPlayJsonError4: could not parse json");
                    }
                } catch (err2) {
                    if (err2.toString() != "SyntaxError: Unexpected end of JSON input") {
                        callback(null,17); console.log("SpotifyPlayTryCatchError3: " + err2);
                    } else {
                        //play successful
                        callback(true,18,"true");
                    }
                }
            } else {
                callback(null,19); console.log("SpotifyPlayRequestError3: " + err);
            }
        });
    }
}
function SpotifyPause(callback, device, account) {
    var SpotifyAccessTokenPer = null;
    try { SpotifyAccessTokenPer = fs.readFileSync("AccessToken" + (account != null ? account : "") + ".txt", 'utf8');
    } catch (err) { callback(null,-1); console.log("SpotifyPauseFileError1: " + err); return; }
    if (SpotifyAccessTokenPer != null && SpotifyAccessTokenPer != "") {
        Request("api.spotify.com","/v1/me/player/pause" + ((device == null || device == "") ? "" : "?device_id=" + device),"PUT",{"Accept":"application/json","Content-Type":"application/json","Authorization":"Bearer " + SpotifyAccessTokenPer},null,(curl,err) => {
            if (err == null) {
                try {
                    if (JSON.parse(curl)) {
                        var json = JSON.parse(curl);
                        if (json.error.message == "The access token expired") {
                            //get the refreshtoken
                            var SpotifyRefreshTokenPer = fs.readFileSync("RefreshToken" + (account != null ? account : "") + ".txt", 'utf8');
                            if (SpotifyRefreshTokenPer != null && SpotifyRefreshTokenPer != "") {
                                //refresh the token
                                Request("accounts.spotify.com","/api/token","POST",{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},"grant_type=refresh_token&refresh_token=" + SpotifyRefreshTokenPer + "&client_id=" + SpotifyClientID + "&client_secret=" + SpotifyClientSecret, (curl,err) => {
                                    if (err == null) {
                                        try {
                                            if (JSON.parse(curl)) {
                                                var json = JSON.parse(curl);
                                                if (json.error == null) {
                                                    //set refreshed token and retry function
                                                    fs.writeFileSync("AccessToken" + (account != null ? account : "") + ".txt",json.access_token);
                                                    SpotifyPause(callback,account);
                                                } else {
                                                    callback(null,1); console.log("SpotifyPauseJsonError1: " + json.error);
                                                }
                                            }
                                        } catch (err2) {
                                            callback(null,2); console.log("SpotifyPauseTryCatchError1: " + err2);
                                        }
                                    } else {
                                        callback(null,3); console.log("SpotifyPauseRequestError1: " + err);
                                    }
                                });
                            } else {
                                callback(null,4); console.log("SpotifyPauseTokenError1: Spotify refresh token not found");
                            }
                        } else if (json.error.message == "Device not found") {
                            callback(null,5); console.log("That device is not avaliable to play music.");
                        } else if (json.error.message == "Invalid access token") {
                            callback(null,6); console.log("Access token is invalid, Reauthentication is required.");
                        } else if (json.error.reason == "NO_ACTIVE_DEVICE") {
                            callback(false,7); console.log("No device is currently playing music.");
                        } else if (json.error.message == "Player command failed: Restriction violated") {
                            callback(null,8);
                        } else {
                            callback(null,9); console.log("SpotifyPauseJsonError2: " + JSON.stringify(json.error));
                        }
                    } else {
                        callback(null,10); console.log("SpotifyPauseJsonError3: could not parse json");
                    }
                } catch (err2) {
                    if (err2.toString() != "SyntaxError: Unexpected end of JSON input") {
                        console.log("SpotifyPauseTryCatchError2: " + err2); callback(null,11);
                    } else {
                        //succesfully paused
                        callback(false,12,"false");
                    }
                }
            } else {
                callback(null,13); console.log("SpotifyPauseRequestError2: " + err);
            }
        });
    }
}
function SpotifyToggle(callback,device, account) {
    var SpotifyAccessTokenPer = null;
    try { SpotifyAccessTokenPer = fs.readFileSync("AccessToken" + (account != null ? account : "") + ".txt", 'utf8');
    } catch (err) { callback(null,-1); console.log("SpotifyToggleFileError1: " + err); return; }
    if (SpotifyAccessTokenPer != null && SpotifyAccessTokenPer != "") {
        //curlRequest('-X "GET" "https://api.spotify.com/v1/me/player" -H "Accept: application/json" -H "Content-Type: application/json" -H "Authorization: Bearer ' + SpotifyAccessToken + '"', (curl,err) => {
        Request("api.spotify.com","/v1/me/player","GET",{"Accept":"application/json","Content-Type":"application/json","Authorization":"Bearer " + SpotifyAccessTokenPer},null,(curl,err) => {
            if (err == null) {
                try {
                    if (JSON.parse(curl)) {
                        var json = JSON.parse(curl);
                        if (json.error != null) {
                            if (json.error.message == "The access token expired") {
                                var SpotifyRefreshTokenPer = fs.readFileSync("RefreshToken" + (account != null ? account : "") + ".txt", 'utf8');
                                if (SpotifyRefreshTokenPer != null && SpotifyRefreshTokenPer != "") {
                                    Request("accounts.spotify.com","/api/token","POST",{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},"grant_type=refresh_token&refresh_token=" + SpotifyRefreshTokenPer + "&client_id=" + SpotifyClientID + "&client_secret=" + SpotifyClientSecret, (curl,err) => {
                                        if (err == null) {
                                            try {
                                                if (JSON.parse(curl)) {
                                                    var json = JSON.parse(curl);
                                                    if (json.error == null) {
                                                        //set refreshed token and retry function
                                                        fs.writeFileSync("AccessToken" + (account != null ? account : "") + ".txt",json.access_token);
                                                        SpotifyToggle(callback,device,account);
                                                    } else {
                                                        callback(null,1); console.log("SpotifyToggleJsonError1: " + json.error);
                                                    }
                                                } else {
                                                    callback(null,2); console.log("SpotifyToggleJsonError2: could not parse json");
                                                }
                                            } catch (err2) {
                                                callback(null,3); console.log("SpotifyToggleTryCatchError1: " + err2);
                                            }
                                        } else {
                                            callback(null,4); console.log("SpotifyToggleRequestError1: " + err);
                                        }
                                    });
                                } else {
                                    callback(null,5); console.log("SpotifyToggleTokenError1: Spotify refresh token not found");
                                }
                            } else if (json.error.message == "Invalid access token") {
                                callback(null,6); console.log("Access token is invalid, Reauthentication is required.");
                            } else {
                                callback(null,7); console.log("SpotifyToggleJsonError3: " + JSON.stringify(json.error));
                            }
                        } else {
                            if (json.is_playing != null) {
                                if (json.is_playing == true) {
                                    SpotifyPause(callback,device,account);
                                } else {
                                    SpotifyPlay(callback,null,device,account);
                                }
                            } else {
                                callback(null,8); console.log("SpotifyToggleError1: IsPlaying == null");
                            }
                        }
                    } else {
                        callback(null,9); console.log("SpotifyToggleJsonError4: could not parse json");
                    }
                } catch (err2) {
                    if (err2.toString() != "SyntaxError: Unexpected end of JSON input") {
                        callback(null,10); console.log("SpotifyToggleTryCatchError2: " + err2);
                    } else {
                        SpotifyPlay(callback,null,device,account);
                    }
                }
            } else {
                callback(null,11); console.log("SpotifyToggleRequestError2: " + err);
            }
        });
    }
}
function SpotifyStatus(callback, account) {
    var SpotifyAccessTokenPer = null;
    try { SpotifyAccessTokenPer = fs.readFileSync("AccessToken" + (account != null ? account : "") + ".txt", 'utf8');
    } catch (err) { callback(null,-1,["",""]); console.log("SpotifyStatusFileError1: " + err); return; }
    if (SpotifyAccessTokenPer != null && SpotifyAccessTokenPer != "") {
        //curlRequest('-X "GET" "https://api.spotify.com/v1/me/player" -H "Accept: application/json" -H "Content-Type: application/json" -H "Authorization: Bearer ' + SpotifyAccessToken + '"', (curl,err) => {
        Request("api.spotify.com","/v1/me/player","GET",{"Accept":"application/json","Content-Type":"application/json","Authorization":"Bearer " + SpotifyAccessTokenPer},null,(curl,err) => {
            if (err == null) {
                try {
                    if (curl == "") {
                        callback(false,-1,["null","mull"]);
                    } else if (JSON.parse(curl)) {
                        var json = JSON.parse(curl);
                        if (json.error != null) {
                            console.log(json.error.status);
                            if (json.error.message == "The access token expired") {
                                var SpotifyRefreshTokenPer = fs.readFileSync("RefreshToken" + (account != null ? account : "") + ".txt", 'utf8');
                                if (SpotifyRefreshTokenPer != null && SpotifyRefreshTokenPer != "") {
                                    Request("accounts.spotify.com","/api/token","POST",{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},"grant_type=refresh_token&refresh_token=" + SpotifyRefreshTokenPer + "&client_id=" + SpotifyClientID + "&client_secret=" + SpotifyClientSecret, (curl,err) => {
                                        if (err == null) {
                                            try {
                                                if (JSON.parse(curl)) {
                                                    var json = JSON.parse(curl);
                                                    if (json.error == null) {
                                                        //set refreshed token and retry function
                                                        fs.writeFileSync("AccessToken" + (account != null ? account : "") + ".txt",json.access_token);
                                                        SpotifyStatus(callback,account);
                                                    } else {
                                                        callback(null,1,["",""]); console.log("SpotifyStatusJsonError1: " + json.error);
                                                    }
                                                } else {
                                                    callback(null,2,["",""]); console.log("SpotifyStatusJsonError2: could not parse json");
                                                }
                                            } catch (err2) {
                                                callback(null,3,["",""]); console.log("SpotifyStatusTryCatchError1: " + err2);
                                            }
                                        } else {
                                            callback(null,4,["",""]); console.log("SpotifyStatusRequestError1: " + err);
                                        }
                                    });
                                } else {
                                    callback(null,5,["",""]); console.log("SpotifyStatusTokenError1: Spotify refresh token not found");
                                }
                            } else if (json.error.message == "Invalid access token") {
                                callback(null,6,["",""]); console.log("Access token is invalid, Reauthentication is required.");
                            } else {
                                callback(null,7,["",""]); console.log("SpotifyStatusJsonError3: " + JSON.stringify(json.error));
                            }
                        } else {
                            if (json.is_playing != null) {
                                //console.log(JSON.stringify(json));
                                if (json.is_playing == true) {
                                    callback("true",8, [json.item.name, json.item.artists[0].name]);
                                } else {
                                    callback("false",9, ["",""]);
                                }
                            } else {
                                callback(null,9, ["",""]); console.log("SpotifyStatusError1: IsPlaying == null");
                            }
                        }
                    } else {
                        callback(null,10,["",""]); console.log("SpotifyStatusJsonError4: could not parse json");
                    }
                } catch (err2) {
                    if (err2.toString() != "SyntaxError: Unexpected end of JSON input") {
                        callback(null,11,["",""]); console.log("SpotifyStatusTryCatchError2: " + err2);
                    }
                }
            } else {
                callback(null,12,["",""]); console.log("SpotifyStatusRequestError2: " + err);
            }
        });
    }
}
function SpotifySkipNext(callback, device, account) {
    var SpotifyAccessTokenPer = null;
    try { SpotifyAccessTokenPer = fs.readFileSync("AccessToken" + (account != null ? account : "") + ".txt", 'utf8');
    } catch (err) { callback(null,-1); console.log("SpotifySkipNextFileError1: " + err); return; }
    if (SpotifyAccessTokenPer != null && SpotifyAccessTokenPer != "") {
        Request("api.spotify.com", "/v1/me/player/next" + ((device == null || device == "") ? "" : "?device_id=" + device),"POST",{"Accept":"application/json","Content-Type":"application/json","Authorization":"Bearer " + SpotifyAccessTokenPer},null,(curl,err) => {
            if (err == null) {
                try {
                    if (JSON.parse(curl) != null) {
                        var json = JSON.parse(curl);
                        if (json.error != null) {
                            if (json.error.message == "The access token expired") {
                                var SpotifyRefreshTokenPer = fs.readFileSync("RefreshToken" + (account != null ? account : "") + ".txt", 'utf8');
                                if (SpotifyRefreshTokenPer != null && SpotifyRefreshTokenPer != "") {
                                    Request("accounts.spotify.com","/api/token","POST",{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},"grant_type=refresh_token&refresh_token=" + SpotifyRefreshTokenPer + "&client_id=" + SpotifyClientID + "&client_secret=" + SpotifyClientSecret, (curl,err) => {
                                        if (err == null) {
                                            try {
                                                if (JSON.parse(curl)) {
                                                    var json = JSON.parse(curl);
                                                    if (json.error == null) {
                                                        //set refreshed token and retry function
                                                        fs.writeFileSync("AccessToken" + (account != null ? account : "") + ".txt",json.access_token);
                                                        SpotifySkipNext(callback,device,account);
                                                    } else {
                                                        callback(null,1); console.log("SpotifySkipNextJsonError1: " + json.error);
                                                    }
                                                } else {
                                                    callback(null,2); console.log("SpotifySkipNextJsonError2: could not parse json");
                                                }
                                            } catch (err2) {
                                                callback(null,3);console.log("SpotifySkipNextTryCatchError1: " + err2);
                                            }
                                        } else {
                                            callback(null,4); console.log("SpotifySkipNextRequestError1: " + err);
                                        }
                                    });
                                } else {
                                    callback(null,5); console.log("SpotifySkipNextTokenError: Spotify refresh token not found");
                                }
                            } else if (json.error.message == "Invalid access token") {
                                callback(null,6); console.log("Access token is invalid, Reauthentication is required.");
                            } else if (json.error.message == "Device not found") {
                                console.log("That device is not currently playing music.");
                                callback(null,7);
                            } else if (json.error.reason == "NO_ACTIVE_DEVICE") {
                                //find device to play on
                                Request("api.spotify.com","/v1/me/player/devices","GET",{"Accept":"application/json","Content-Type":"application/json","Authorization":"Bearer " + SpotifyAccessTokenPer},null,(curl,err) => {
                                    if (err == null) {
                                        try {
                                            if (JSON.parse(curl)) {
                                                var json = JSON.parse(curl);
                                                if (json.error != null) {
                                                    if (json.error.message == "The access token expired") {
                                                        callback(null,8); console.log("SpotifySkipNextError: Spotify refresh token expired");
                                                    } else if (json.error.message == "Invalid access token") {
                                                        callback(null,9); console.log("Access token is invalid, Reauthentication is required.");
                                                    } else {
                                                        callback(null,10); console.log("SpotifySkipNextJsonError3: " + JSON.stringify(json.error));
                                                    }
                                                } else {
                                                    //play on first device
                                                    list = json.devices.filter((item)=>item.name!="32\" TCL Roku TV");
                                                    if (list.length > 0) {
                                                        console.log("Force playing on " + list[0].name);
                                                        SpotifySkipNext(callback,list[0].id,account);
                                                    } else {
                                                        callback(false,11); console.log("No device is currently playing music.");
                                                    }
                                                }
                                            } else {
                                                callback(null,12); console.log("SpotifySkipNextJsonError4: could not parse json");
                                            }
                                        } catch (err2) {
                                            callback(null,13); console.log("SpotifySkipNextTryCatchError2: " + err2)
                                        }
                                    } else {
                                        callback(null,14); console.log("SpotifySkipNextRequestError2: " + err);
                                    }
                                });
                            } else if (json.error.message == "Player command failed: Restriction violated") {
                                console.log("No clue. ln454 Spotify.js");
                                callback(true,15);
                            } else {
                                callback(null,16); console.log("SpotifySkipNextJsonError5: " + JSON.stringify(json.error));
                            }
                        }
                    } else {
                        callback(null,17); console.log("SpotifySkipNextJsonError6: could not parse json");
                    }
                } catch (err2) {
                    if (err2.toString() != "SyntaxError: Unexpected end of JSON input") {
                        callback(null,18); console.log("SpotifySkipNextTryCatchError3: " + err2);
                    } else {
                        //success
                        callback(true,19);
                    }
                }
            } else {
                callback(null,20); console.log("SpotifySkipNextRequestError3: " + err);
            }
        });
    }
}
function SpotifySkipPrevious(callback, device, account) {
    var SpotifyAccessTokenPer = null;
    try { SpotifyAccessTokenPer = fs.readFileSync("AccessToken" + (account != null ? account : "") + ".txt", 'utf8');
    } catch (err) { callback(null,-1); console.log("SpotifySkipPreviousFileError1: " + err); return; }
    if (SpotifyAccessTokenPer != null && SpotifyAccessTokenPer != "") {
        Request("api.spotify.com", "/v1/me/player/previous" + ((device == null || device == "") ? "" : "?device_id=" + device),"POST",{"Accept":"application/json","Content-Type":"application/json","Authorization":"Bearer " + SpotifyAccessTokenPer},null,(curl,err) => {
            if (err == null) {
                try {
                    if (JSON.parse(curl) != null) {
                        var json = JSON.parse(curl);
                        if (json.error != null) {
                            if (json.error.message == "The access token expired") {
                                var SpotifyRefreshTokenPer = fs.readFileSync("RefreshToken" + (account != null ? account : "") + ".txt", 'utf8');
                                if (SpotifyRefreshTokenPer != null && SpotifyRefreshTokenPer != "") {
                                    Request("accounts.spotify.com","/api/token","POST",{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},"grant_type=refresh_token&refresh_token=" + SpotifyRefreshTokenPer + "&client_id=" + SpotifyClientID + "&client_secret=" + SpotifyClientSecret, (curl,err) => {
                                        if (err == null) {
                                            try {
                                                if (JSON.parse(curl)) {
                                                    var json = JSON.parse(curl);
                                                    if (json.error == null) {
                                                        //set refreshed token and retry function
                                                        fs.writeFileSync("AccessToken" + (account != null ? account : "") + ".txt",json.access_token);
                                                        SpotifySkipPrevious(callback,device,account);
                                                    } else {
                                                        callback(null,1); console.log("SpotifySkipPreviousJsonError1: " + json.error);
                                                    }
                                                } else {
                                                    callback(null,2); console.log("SpotifySkipPreviousJsonError2: could not parse json");
                                                }
                                            } catch (err2) {
                                                callback(null,3);console.log("SpotifySkipPreviousTryCatchError1: " + err2);
                                            }
                                        } else {
                                            callback(null,4); console.log("SpotifySkipPreviousRequestError1: " + err);
                                        }
                                    });
                                } else {
                                    callback(null,5); console.log("SpotifySkipPreviousTokenError: Spotify refresh token not found");
                                }
                            } else if (json.error.message == "Invalid access token") {
                                callback(null,6); console.log("Access token is invalid, Reauthentication is required.");
                            } else if (json.error.message == "Device not found") {
                                console.log("That device is not currently playing music.");
                                callback(null,7);
                            } else if (json.error.reason == "NO_ACTIVE_DEVICE") {
                                //find device to play on
                                Request("api.spotify.com","/v1/me/player/devices","GET",{"Accept":"application/json","Content-Type":"application/json","Authorization":"Bearer " + SpotifyAccessTokenPer},null,(curl,err) => {
                                    if (err == null) {
                                        try {
                                            if (JSON.parse(curl)) {
                                                var json = JSON.parse(curl);
                                                if (json.error != null) {
                                                    if (json.error.message == "The access token expired") {
                                                        callback(null,8); console.log("SpotifySkipPreviousError: Spotify refresh token expired");
                                                    } else if (json.error.message == "Invalid access token") {
                                                        callback(null,9); console.log("Access token is invalid, Reauthentication is required.");
                                                    } else {
                                                        callback(null,10); console.log("SpotifySkipPreviousJsonError3: " + JSON.stringify(json.error));
                                                    }
                                                } else {
                                                    //play on first device
                                                    list = json.devices.filter((item)=>item.name!="32\" TCL Roku TV");
                                                    if (list.length > 0) {
                                                        console.log("Force playing on " + list[0].name);
                                                        SpotifySkipPrevious(callback,list[0].id,account);
                                                    } else {
                                                        callback(false,11); console.log("No device is currently playing music.");
                                                    }
                                                }
                                            } else {
                                                callback(null,12); console.log("SpotifySkipPreviousJsonError4: could not parse json");
                                            }
                                        } catch (err2) { console.log("SpotifySkipPreviousTryCatchError2: " + err2); callback(null,13) }
                                    } else {
                                        callback(null,14); console.log("SpotifySkipPreviousRequestError2: " + err);
                                    }
                                });
                            } else if (json.error.message == "Player command failed: Restriction violated") {
                                console.log("No clue. ln553 Spotify.js");
                                callback(true,15);
                            } else {
                                callback(null,16); console.log("SpotifySkipPreviousJsonError5: " + JSON.stringify(json.error));
                            }
                        }
                    } else {
                        callback(null,17); console.log("SpotifySkipPreviousJsonError6: could not parse json");
                    }
                } catch (err2) {
                    if (err2.toString() != "SyntaxError: Unexpected end of JSON input") {
                        callback(null,18); console.log("SpotifySkipPreviousTryCatchError3: " + err2);
                    } else {
                        callback(true,19);
                    }
                }
            } else {
                callback(null,20); console.log("SpotifySkipPreviousRequestError3: " + err);
            }
        });
    }
}
module.exports = { GetSpotifyToken, SpotifyPlay, SpotifyPause, SpotifyToggle, SpotifyStatus, SpotifySkipNext, SpotifySkipPrevious, SpotifyClientID, Link, SpotifyClientSecret };
//#endregion