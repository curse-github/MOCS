#include <ESP8266WiFi.h>
// code adapted from https://42bots.com/tutorials/esp8266-wifi-tutorial-arduino-ide/
// because even the actual exaples for this library dont work out of the box
bool clientSucceeded = false;
bool wifiClientStatus() {
  return clientSucceeded;
}

void wifiInitConnection(const char* ssid, const char* password) {
  // Setup wifi object
  WiFi.begin(ssid, password);
  // Begin trying to connect
#if _WIFI_DEBUG
  myPrintln("Connecting to network...");
#endif
  const unsigned long int connectStartTime = millis();
  for(int i=0; i<30; i++)
    if (WiFi.status()==WL_CONNECTED) { clientSucceeded=true; break; }
    else delay(500);
  if (!clientSucceeded) {
#if _WIFI_DEBUG
    myPrint("Failed to initialize network connection, timeout.");
#endif
    return;
  }
#if _WIFI_DEBUG
  myPrintln("Successfully connected.");
  // Print time to connect
  myPrint("Connection took ");
  myPrint(((float)(millis()-connectStartTime))/1000);
  myPrintln("s.");
  // Print IP
  myPrint("IP Address: ");
  Serial.println(WiFi.localIP());
  // Print your MAC address
  byte mac[6];
  WiFi.macAddress(mac);
  char buf[20];
  sprintf(buf, "%02X:%02X:%02X:%02X:%02X:%02X", mac[5], mac[4], mac[3], mac[2], mac[1], mac[0]);
  myPrint("MAC address: ");
  myPrintln(buf);
  myPrintln();
#endif
}

// code adapted from https://www.renesas.com/en/products/gadget-renesas/reference/gr-rose/library-wifiesp
WiFiClient client;
bool startedRecieving = false;
bool lastwasAvaliable = false;
bool finishedRecieving = true;
std::string data = "";
void clearVars() {
  startedRecieving = false;
  lastwasAvaliable = false;
  finishedRecieving = true;
  data = "";
}
bool startPostRequest(const char *host, const int &port, const char *path, const std::string &postData) {
  if (!wifiClientStatus()) return false;
  if (!finishedRecieving) return false;
#if _WIFI_DEBUG
  myPrintln();
  //myPrintln("Starting connection to server...");
#endif
  // if you get a connection, report back via serial
  if (client.connect(host, port)) {
#if _WIFI_DEBUG
    myPrint("Successfully connected to \"");
    myPrint(host);
    myPrint(':');
    myPrint(port);
    myPrint(path);
    myPrintln('"');
#endif
    // Make a HTTP request
    client.print("POST ");
    client.print(path);
    client.println(" HTTP/1.1");
    client.print("Host: ");
    client.println(host);
    client.println("Connection: close");
    client.println("Accept: application/text");
    client.println("Content-Type: application/json");
    client.print("Content-Length: ");
    client.println(postData.size());
    client.println();
    client.println(postData.c_str());
    
/*#if _WIFI_DEBUG
    myPrintln("Waiting until avaliable");
#endif*/
    startedRecieving = false;
    lastwasAvaliable = false;
    finishedRecieving = false;
    data = "";
    return true;
  } else {
#if _WIFI_DEBUG
    myPrint("Failed to connect to \"");
    myPrint(host);
    myPrintln("\"");
#endif
    return false;
  }
}
std::string continuePostRequest() {
  if (!wifiClientStatus()) return "";
  if (finishedRecieving) return "";
  if (!startedRecieving) {
    if (!client.available()) return "";
/*#if _WIFI_DEBUG
    myPrintln("Client is avaliable");
#endif*/
    startedRecieving=true;
    lastwasAvaliable=true;
  } else {
    if (client.available()) { data+=client.read(); return ""; }
    else {
      if (lastwasAvaliable) {
        lastwasAvaliable=false;
/*#if _WIFI_DEBUG
        myPrintln("Get Request finished.");
        myPrintln("Waiting until disconnected.");
#endif*/
      }
      if (client.connected()) return "";
      else {
        finishedRecieving=true;
#if _WIFI_DEBUG
        myPrintln("Stopping Client.");
#endif
        client.stop();
        std::string out = "";
        bool started = false;
        char last = data[0];
        for(int i = 1; i < data.size(); i++) {
          if (started)
            out += data[i];
          else {
            if ((last == '\n') && (data[i] == '\n')) started = true;
            else if (data[i] != '\r') last = data[i];
          }
        }
        return '-'+out;
      }
    }
  }
  return "";
}
bool isPostRequestDone() {
  return finishedRecieving;
}