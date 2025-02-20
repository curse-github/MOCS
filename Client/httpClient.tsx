import fetch from "node-fetch";

async function httpReq(hostname: string, method: "GET"|"POST", body: string|undefined) {
    return (await fetch(hostname, {
        method,
        body
    })).text()
}
async function get(hostname: string) {
    return httpReq(hostname, "GET", undefined);
}
async function post(hostname: string, body: string) {
    return httpReq(hostname, "POST", body);
}
post("http://localhost:80/connect", JSON.stringify({ test: "test"}))