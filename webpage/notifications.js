navigator.serviceWorker.register("/sw.js");
function arrayBufferToBase64(buffer) {
    let binary = "";
    var bytes = new Uint8Array(buffer);
    let len = bytes.byteLength;
    for (let i = 0; i < len; i++)
        binary += String.fromCharCode(bytes[i]);
    return window.btoa(binary);
}
function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, "+")
        .replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++)
        outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
}

async function subscribe() {
    if (!("showNotification" in ServiceWorkerRegistration.prototype)) { console.log("Web push is not avaliable1."); return; }
    if (!("Notification" in window)) { console.log("Web push is not avaliable2."); return; }
    if ((await Notification.requestPermission()) != "granted") { console.log("Permission is not granted."); return; }

    const swReg = await navigator.serviceWorker.ready;
    const details = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: "BOakj3gFM-ZNSZBk-78feJcWpD1mPnej1G5bLa-QctKDrWuDnf9ynyy3pPGAZWPT8l2DdatqOeZkNemJGYbIdrg"
    });
    // console.log("Details:",details);
    fetch("/notif/subscribe", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            endpoint: details.endpoint,
            keys: {
                auth: arrayBufferToBase64(details.getKey("auth")),
                p256dh: arrayBufferToBase64(details.getKey("p256dh"))
            }
        })
    }).then((data) => {
        data.text().then((text) => {
            console.log(text);
        })
    })
}