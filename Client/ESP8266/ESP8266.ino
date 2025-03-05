#include <string>

//https://m.media-amazon.com/images/I/71n5cYRJInL._AC_SL1500_.jpg
#define D6 12
#define D7 13
#define _ALLOW_SERIAL false
#define _WIFI_DEBUG false

const int serialBaud = 9600;// 9600 baud
const int outputPin = D6;// GPIO 12, D6 pin
const int sensorPin = D7;// GPIO 13, G7 pin

enum class WaitingOnEnum {
  None,
  Key,
  Cmd,
  ReturnRes,
  Return
};
bool isMocsActive = false;
const std::string self = "{ \"name\": \"ESP\", \"values\": [ { \"name\": \"lights\", \"type\": \"Bool\", \"value\": true } ] }";
std::string connectionId = "";
unsigned long lastKeepAliveTime = 0;
WaitingOnEnum waitingOn = WaitingOnEnum::None;
void setup() {
  serialInit();
  wifiInitConnection("CurseNet24", "simpsoncentral");
  while (!wifiClientStatus()) {
    wifiInitConnection("CurseNet24", "simpsoncentral");
  }
  sensorInit();
  outputInit();
  while (!startPostRequest("192.168.0.105",80,"/connect", self)&&wifiClientStatus()) {}
  waitingOn = WaitingOnEnum::Key;
}
void connectionClosed() {
  myPrintln("Mocs connection closed.");
  isMocsActive = false;
  connectionId = "";
  waitingOn = WaitingOnEnum::None;
  lastKeepAliveTime = 0;
}
void loop() {
  if (wifiClientStatus() && !isPostRequestDone()) {
    std::string data = continuePostRequest();
    if (data != "") {
      data.erase(0, 1);// remove the first character.
      if (data == "Invalid") { connectionClosed(); return; }
      unsigned int numNewLines = 0;// num commands is the number of new lines plus one
      std::string returnCmd = "";
      switch (waitingOn) {
        case WaitingOnEnum::Key:
          if (data == "") { waitingOn = WaitingOnEnum::None; break; }
          myPrintln("Mocs connection opened.");
          connectionId = data;
          isMocsActive = true;
          waitingOn = WaitingOnEnum::None;
          break;
        case WaitingOnEnum::Cmd:
          if (data == "") { waitingOn = WaitingOnEnum::None; break; }
          for (int i = 0; i < data.size(); i++) if (data[i] == '\n') numNewLines++;
          if ((numNewLines%2) == 0)
            toggle();
          returnCmd = "{\"id\":\"";
          returnCmd += connectionId;
          returnCmd += "\", \"values\":[null";
          for(int i = 0; i < numNewLines; i++)
            returnCmd += ",null";
          returnCmd += "]}";
          if (startPostRequest("192.168.0.105",80,"/return", returnCmd))
            waitingOn = WaitingOnEnum::ReturnRes;
          else { connectionClosed(); return; }
          break;
        case WaitingOnEnum::ReturnRes:
          waitingOn = WaitingOnEnum::None;
          break;
        case WaitingOnEnum::Return:
          waitingOn = WaitingOnEnum::None;
          break;
        case WaitingOnEnum::None:
          myPrintln("ERROR");
          break;
        default:
          myPrintln("ERROR");
          break;
      }
      //myPrintln(data);
    }
  }
  if (wifiClientStatus() && isPostRequestDone() && ((millis() - lastKeepAliveTime) >= 1000) && (waitingOn == WaitingOnEnum::None)) {
    if (isMocsActive) {
      std::string msg = "{\"id\":\"";
      msg += connectionId;
      msg += "\"}";
      if (startPostRequest("192.168.0.105",80,"/keepAlive", msg))
        waitingOn = WaitingOnEnum::Cmd;
        else { connectionClosed(); return; }
    } else {
      if(startPostRequest("192.168.0.105",80,"/connect", self))
        waitingOn = WaitingOnEnum::Key;
      else { connectionClosed(); return; }
    }
    lastKeepAliveTime = millis();
  }
  if (!wifiClientStatus()) {
    wifiInitConnection("CurseNet24", "simpsoncentral");
    if (wifiClientStatus()) {
      while (!startPostRequest("192.168.0.105",80,"/connect", self)&&wifiClientStatus()) {}
      waitingOn = WaitingOnEnum::Key;
    }
  }
  onButton(sensorRead());
}
void onButton(const char &button) {
  if (button=='E') return;
  bool newState = false;
  std::string msg = "";
  switch(button) {
    case 'p':// Power
      newState = toggle();
      if (isMocsActive) {
        msg = "{\"id\":\"";
        msg += connectionId;
        msg += "\", \"name\": \"lights\", \"value\": ";
        msg += (newState?"true":"false");
        msg += " }";
        if (startPostRequest("192.168.0.105",80,"/updateValue", msg))
          waitingOn = WaitingOnEnum::ReturnRes;
        else { connectionClosed(); return; }
      }
      break;
    case '^':// Up
      setState(true);
      if (isMocsActive) {
        msg = "{\"id\":\"";
        msg += connectionId;
        msg += "\", \"name\": \"lights\", \"value\": true }";
        if (startPostRequest("192.168.0.105",80,"/updateValue", msg))
          waitingOn = WaitingOnEnum::ReturnRes;
        else { connectionClosed(); return; }
      }
      break;
    case 'v':// Down
    case 'f':// FUNC/STOP
    case 's':// ST/REPT
      setState(false);
      if (isMocsActive) {
        msg = "{\"id\":\"";
        msg += connectionId;
        msg += "\", \"name\": \"lights\", \"value\": false }";
        if (startPostRequest("192.168.0.105",80,"/updateValue", msg))
          waitingOn = WaitingOnEnum::ReturnRes;
        else { connectionClosed(); return; }
      }
      break;
    case 't':// toggle or play/pause
      break;
    case '>':
      break;
    case '<':
      break;
    default:
      return;
  }
}