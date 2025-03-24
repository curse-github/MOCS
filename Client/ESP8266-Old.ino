#include <string>
#include <vector>

//https://m.media-amazon.com/images/I/71n5cYRJInL._AC_SL1500_.jpg
#define D6 12
#define D7 13
#define _ALLOW_SERIAL true
#define _WIFI_DEBUG false

const int serialBaud = 9600;// 9600 baud
const int outputPin = D6;// GPIO 12, D6 pin
const int sensorPin = D7;// GPIO 13, G7 pin

enum class WaitingOnEnum {
  None,
  Key,
  Cmd,
  Generic
};
bool isMocsActive = false;
const std::string self = "{ \"name\": \"ESP8266\", \"values\": [ { \"name\": \"fan\", \"type\": \"Bool\", \"value\": true, \"readonly\":false }, { \"name\": \"ir\", \"type\": \"String\", \"value\": \"\", \"readonly\":true } ] }";
std::string connectionId = "";
unsigned long lastKeepAliveTime = 0;
WaitingOnEnum waitingOn = WaitingOnEnum::None;
std::vector<std::string> msgQueueData;
void setup() {
  serialInit();
  while (!wifiClientStatus())
    wifiInitConnection("CurseNet24", "simpsoncentral");
  sensorInit();
  outputInit();
}
void connectionClosed() {
  myPrintln("Mocs connection closed.");
  // set mocs vars
  isMocsActive = false;
  connectionId = "";
  waitingOn = WaitingOnEnum::None;
  lastKeepAliveTime = 0;
  msgQueueData.clear();
  // set http vars
  clearVars();
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
          lastKeepAliveTime = millis();
          waitingOn = WaitingOnEnum::None;
          if (data == "") break;
          // parse the commands
          for (int i = 0; i < data.size(); i++) {
            if (data[i] == '\n') {
              if (returnCmd.substr(0,11) == "fan.set(")
                setState(returnCmd[8] == 't');
              returnCmd = "";
              numNewLines++;
            } else if (data[i] != '\r')
              returnCmd += data[i];
          }
          if (returnCmd.substr(0,11) == "fan.set(")
            setState(returnCmd[8] == 't');
          // return list of null values
          returnCmd = "{\"id\":\"";
          returnCmd += connectionId;
          returnCmd += "\", \"values\":[null";
          for(int i = 0; i < numNewLines; i++)
            returnCmd += ",null";
          returnCmd += "]}";
          if (startPostRequest("192.168.0.105", 8080, "/return", returnCmd)) {
            waitingOn = WaitingOnEnum::Generic;
          } else connectionClosed();
          break;
        case WaitingOnEnum::Generic:
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
  if (wifiClientStatus() && isPostRequestDone() && (waitingOn == WaitingOnEnum::None)) {
    if (isMocsActive) {
      // connected to mocs
      if ((millis() - lastKeepAliveTime) >= 1000) {
        // send the keepalive
        std::string msg = "{\"id\":\"";
        msg += connectionId;
        msg += "\"}";
        if (startPostRequest("192.168.0.105",8080,"/keepAlive", msg))
          waitingOn = WaitingOnEnum::Cmd;
          else connectionClosed();
      } else if (msgQueueData.size() > 0) {
        // do commands from the queue
        for(int i = 0; i < msgQueueData.size(); i++) {
          if (msgQueueData[i].size() == 0) continue;
          if (startPostRequest("192.168.0.105", 8080, "/updateValue", msgQueueData[i])) {
            waitingOn = WaitingOnEnum::Generic;
            msgQueueData[i] = "";
          } else connectionClosed();
        }
        msgQueueData.clear();
      }
    } else if ((millis() - lastKeepAliveTime) >= 5000) {
      // not connected to mocs
      // retry connection if it has been a seconds since it tried last
      lastKeepAliveTime = millis();
      if(startPostRequest("192.168.0.105",8080,"/connect", self))
        waitingOn = WaitingOnEnum::Key;
      else connectionClosed();
    }
  } else if (!wifiClientStatus()) {
    wifiInitConnection("CurseNet24", "simpsoncentral");
  }
  onButton(sensorRead());
}
std::string msg = "";
void onButton(const int &code) {
  if (isMocsActive) {
    msg = "{\"id\":\"";
    msg += connectionId;
    msg += "\", \"name\": \"ir\", \"value\": \"";
    msg += code;
    msg += "\" }";
    msgQueueData.push_back(msg);
  }
  if (code==0) return;
  myPrintln(code);
  const char button = encode(code);
  bool newState = false;
  switch(button) {
    case 'p':// Power
      newState = toggle();
      if (isMocsActive) {
        msg = "{\"id\":\"";
        msg += connectionId;
        msg += "\", \"name\": \"fan\", \"value\": ";
        msg += (newState?"true":"false");
        msg += " }";
        msgQueueData.push_back(msg);
      }
      break;
    case '^':// Up
      setState(true);
      if (isMocsActive) {
        msg = "{\"id\":\"";
        msg += connectionId;
        msg += "\", \"name\": \"fan\", \"value\": true }";
        msgQueueData.push_back(msg);
      }
      break;
    case 'v':// Down
    case 'f':// FUNC/STOP
    case 's':// ST/REPT
      setState(false);
      if (isMocsActive) {
        msg = "{\"id\":\"";
        msg += connectionId;
        msg += "\", \"name\": \"fan\", \"value\": false }";
        msgQueueData.push_back(msg);
      }
      break;
    case 't':// toggle or play/pause
      newState = toggle();
      if (isMocsActive) {
        msg = "{\"id\":\"";
        msg += connectionId;
        msg += "\", \"name\": \"fan\", \"value\": ";
        msg += (newState?"true":"false");
        msg += " }";
        msgQueueData.push_back(msg);
      }
      break;
    case '>':
      break;
    case '<':
      break;
    default:
      return;
  }
}