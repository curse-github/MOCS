Modular online control system. The MOCS server can be connected to by any kind of device which has gives access to do and action or set a value and can then be controlled live through websocket, https POST request, or through the website/app. Users on the webserver can call functions and set values on the devices connected to the server.

example "fake-database.json" file shows the format of the actual database.json file needed for server to run

"public-key.txt" and "private-key.txt" files are needed for notification functionality
    run keys.bat to generate keys
    public key must also be put into the code of the /webpage/notifications.js file if changed