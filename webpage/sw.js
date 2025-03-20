self.addEventListener("push", (event) => {
    const json = event.data.json();
    // if its marked as important, just send it
    if (json.important) {
        self.registration.showNotification(json.header, {
            body: json.body,
            icon: "/favicon.ico"
        });
        return;
    }
    // otherwise only send it if the app is not open
    const thing = async () => {
        const windows = await clients.matchAll({ includeUncontrolled: true, type: "window" });
        for (let i = 0; i < windows.length; i++)
            if (windows[i].focused && (windows[i].url == url)) return;
        self.registration.showNotification(json.header, {
            body: json.body,
            icon: "/favicon.ico"
        });
    }
    event.waitUntil(thing());
});
const url = "https://mocs.campbellsimpson.com/index";
self.addEventListener("notificationclick", (event) => {
    const thing = async () => {
        event.notification.close();
        const windows = await clients.matchAll({ includeUncontrolled: true, type: "window" });
        for (let i = 0; i < windows.length; i++) {
            if (windows[i].url == url) {
                windows[i].focus();
                return;
            }
        }
        clients.openWindow("/");
        return;
    }
    event.waitUntil(thing());
});