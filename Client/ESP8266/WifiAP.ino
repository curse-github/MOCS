#include <ESP8266WiFi.h>
// code adapted from https://42bots.com/tutorials/esp8266-wifi-tutorial-arduino-ide/
// because even the actual exaples for this library dont work out of the box
bool apSucceeded = false;
bool wifiAPStatus() {
  return apSucceeded;
}
void wifiInitAP(const char* ssid, const char* password) {
  Serial.print("Configuring WiFi AP...");
  apSucceeded = WiFi.softAP(ssid, password);
  if (!apSucceeded) { myPrintln("Failed to initialize wifi AP."); return; }
  IPAddress myIP = WiFi.softAPIP();
#if _WIFI_DEBUG
  myPrintln("Successfully created wifi AP.");
  myPrint("WiFi network name: ");
  myPrintln(ssid);
  myPrint("WiFi network password: ");
  myPrintln(password);
  myPrint("Host IP Address: ");
  Serial.println(WiFi.localIP());
  myPrintln();
#endif
}
int getWifiAPConnections() {
  return WiFi.softAPgetStationNum();
}