import { readFileSync, writeFileSync } from "fs";
import fetch from "node-fetch";
import { Response } from "node-fetch";
const SpotifyID: string = readFileSync(__dirname + "/spotify-id.txt", "utf8");
const SpotifySecret: string = readFileSync(__dirname + "/spotify-secret.txt", "utf8");
let SpotifyAccessToken: string = readFileSync(__dirname + "/spotify-access-token.txt", "utf8");
let SpotifyRefreshToken: string = readFileSync(__dirname + "/spotify-refresh-token.txt", "utf8");
const redirectLink: string = "https://mocs.campbellsimpson.com/SetSpotifyToken";
export const authorizeLink: string = "https://accounts.spotify.com/authorize?client_id=" + SpotifyID + "&response_type=code&redirect_uri=" + redirectLink + "&scope=user-modify-playback-state%20user-read-playback-position%20user-read-currently-playing%20user-read-recently-played%20user-read-playback-state";
async function SpotifyURIRequest(method: "GET"|"POST"|"PUT", subdomain: "accounts"|"api", path: string, body: {[key: string]: string}, authorization: string): Promise<any> {
    let headers: {[key: string]: string} = {
        "Content-type": "application/x-www-form-urlencoded",
        Accept: "application/json"
    };
    if (authorization.length > 0)
        headers.Authorization = authorization;
    const res: void | Response = await fetch("https://" + subdomain + ".spotify.com" + path, {
        method,
        headers,
        body: Object.entries(body).map((entry: string[]) => entry[0] + "=" + encodeURIComponent(entry[1])).join("&")// {one: "thing1", two: "thing2"} -> one=thing1&two=thing2
    }).catch((err: any) => {
        console.log(err);
    });
    if (!res) return { error: { status: 404, message: "Request failed." } };
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (err: any) {
        console.log("failed to parse json \"" + text + "\"");
        return { error: { status: res.status, message: "Failed to parse json." } };
    }
}
async function SpotifyJSONRequestSimple(method: "GET"|"POST"|"PUT", subdomain: "accounts"|"api", path: string, body: any, authorization: string): Promise<any> {
    let headers: {[key: string]: string} = {
        "Content-type": "application/json",
        Accept: "application/json"
    };
    if (authorization.length > 0)
        headers.Authorization = authorization;
    const res: void | Response = await fetch("https://" + subdomain + ".spotify.com" + path, {
        method,
        headers,
        body: JSON.stringify(body)// {one: "thing1", two: "thing2"} -> one=thing1&two=thing2
    }).catch((err: any) => {
        console.log(err);
    });
    if (!res) return { error: { status: 404, message: "Request failed." } };
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (err: any) {
        return { error: { status: res.status, message: "Failed to parse json." } };
    }
}
async function SpotifyRequestRefresh(method: "GET"|"POST"|"PUT", subdomain: "accounts"|"api", path: string, body: any): Promise<any> {
    if (SpotifyAccessToken.length == 0) return;
    const data: any = await SpotifyJSONRequestSimple(method, subdomain, path, body, "Bearer " + SpotifyAccessToken);
    if (data.error && (data.error.status == 401) && (data.error.message == "The access token expired")) {
        const refreshData: any = await SpotifyURIRequest("POST", "accounts", "/api/token", {
            grant_type: "refresh_token",
            refresh_token: SpotifyRefreshToken
        }, "Basic " + Buffer.from(SpotifyID + ":" + SpotifySecret).toString("base64"));
        if (refreshData.error) {
            return refreshData;
        } else {
            if (refreshData.access_token) {
                writeFileSync(__dirname + "/spotify-access-token.txt", refreshData.access_token);
                SpotifyAccessToken = refreshData.access_token;
                // try again with new access token
                return await SpotifyJSONRequestSimple(method, subdomain, path, body, "Bearer " + SpotifyAccessToken);
            } else {
                return { error: { status: 500, message: "Request failed." } };
            }
        }
    } else
        return data;
}
async function SpotifyApiPutRequest(path: string, body: any): Promise<any> {
    return await SpotifyRequestRefresh("PUT", "api", path, body);
}
async function SpotifyApiPostRequest(path: string, body: any): Promise<any> {
    return await SpotifyRequestRefresh("POST", "api", path, body);
}
// actual functions
export async function GetToken(code: string): Promise<void> {
    const data: any = await SpotifyURIRequest("POST", "accounts", "/api/token", {
        grant_type: "authorization_code",
        redirect_uri: redirectLink,
        code
    }, "Basic " + Buffer.from(SpotifyID + ":" + SpotifySecret).toString("base64"));
    if (data.error) {
        if (data.error.status == 500)
            console.log("Error#" + data.error.status + ": \"" + data.error.message + "\"");
        else
            console.log("Spotify Error#" + data.error.status + ": \"" + data.error.message + "\""); return;
    } else {
        if (data.access_token && data.refresh_token) {
            writeFileSync(__dirname + "/spotify-access-token.txt", data.access_token);
            writeFileSync(__dirname + "/spotify-refresh-token.txt", data.refresh_token);
            SpotifyAccessToken = data.access_token;
            SpotifyRefreshToken = data.refresh_token;
        } else {
            console.log("Error#500: \"Request failed.");
        }
    }
}
export async function Start(): Promise<void> {
    const data: any = await SpotifyApiPutRequest("/v1/me/player/play", {});
    if (data.error) {
        if (data.error.status == 200)
            return;
        else if ((data.error.status == 403) && (data.error.message == "Player command failed: Restriction violated"))
            console.log("Spotify is already playing.");
        else if (data.error.status == 500)
            console.log("Error#" + data.error.status + ": \"" + data.error.message + "\"");
        else
            console.log("Spotify Error#" + data.error.status + ": \"" + data.error.message + "\""); return;
    } else
        console.log("Started playback.");
    return;
}
export async function Pause(): Promise<void> {
    const data: any = await SpotifyApiPutRequest("/v1/me/player/pause", {});
    if (data.error) {
        if (data.error.status == 200)
            return;
        else if ((data.error.status == 403) && (data.error.message == "Player command failed: Restriction violated"))
            console.log("Spotify is already paused.");
        else if (data.error.status == 500)
            console.log("Error#" + data.error.status + ": \"" + data.error.message + "\"");
        else
            console.log("Spotify Error#" + data.error.status + ": \"" + data.error.message + "\""); return;
    } else {
        console.log("Paused playback.");
    }
    return;
}
export async function SkipNext(): Promise<void> {
    const data: any = await SpotifyApiPostRequest("/v1/me/player/next", {});
    if (data.error) {
        if (data.error.status == 200)
            return;
        else if (data.error.status == 500)
            console.log("Error#" + data.error.status + ": \"" + data.error.message + "\"");
        else
            console.log("Spotify Error#" + data.error.status + ": \"" + data.error.message + "\""); return;
    } else {
        console.log("Skipped to next song.");
    }
    return;
}
export async function SkipPrevious(): Promise<void> {
    const data: any = await SpotifyApiPostRequest("/v1/me/player/previous", {});
    if (data.error) {
        if (data.error.status == 200)
            return;
        else if (data.error.status == 500)
            console.log("Error#" + data.error.status + ": \"" + data.error.message + "\"");
        else
            console.log("Spotify Error#" + data.error.status + ": \"" + data.error.message + "\""); return;
    } else {
        console.log("Skipped to previous song.");
    }
    return;
}