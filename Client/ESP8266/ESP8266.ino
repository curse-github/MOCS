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
const std::string self = "{ \"name\": \"esp8266\", \"functions\": [ { \"name\": \"toggle\", \"overloads\": [{ \"visible\": true, \"parameters\": [], \"returnType\": \"None\" }] } ] }";
WaitingOnEnum waitingOn = WaitingOnEnum::None;
std::string connectionId = "";
bool isMocsActive = false;
unsigned long lastKeepAliveTime = 0;
void setup() {
  serialInit();
  wifiInitConnection("CurseNet24", "simpsoncentral");
  sensorInit();
  outputInit();
  if (wifiClientStatus())
    if (startPostRequest("192.168.0.105",80,"/connect", self))
      waitingOn = WaitingOnEnum::Key;
}
void connectionClosed() {
  myPrintln("Mocs connection closed.");
  connectionId = "";
  isMocsActive = false;
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
  onButton(sensorRead());
}
void onButton(const char &button) {
  if (button=='E') return;
  switch(button) {
    case 'p':// Power
      toggle();
      break;
    case '^':// Up
      setState(true);
      break;
    case 'v':// Down
    case 'f':// FUNC/STOP
    case 's':// ST/REPT
      setState(false);
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