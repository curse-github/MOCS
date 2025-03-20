#include <string>
#include <vector>

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
  Generic
};
bool isMocsActive = false;
const std::string self = "{ \"name\": \"ESP\", \"values\": [ { \"name\": \"lights\", \"type\": \"Bool\", \"value\": true } ] }";
std::string connectionId = "";
unsigned long lastKeepAliveTime = 0;
WaitingOnEnum waitingOn = WaitingOnEnum::None;
std::vector<std::string> msgQueuePage;
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
  msgQueuePage.clear();
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
              if (returnCmd.substr(0,11) == "lights.set(")
                setState(returnCmd.substr(11,4) == "true");
              returnCmd = "";
              numNewLines++;
            } else if (data[i] != '\r')
              returnCmd += data[i];
          }
          if (returnCmd.substr(0,11) == "lights.set(")
            setState(returnCmd.substr(11,4) == "true");
          // return list of null values
          returnCmd = "{\"id\":\"";
          returnCmd += connectionId;
          returnCmd += "\", \"values\":[null";
          for(int i = 0; i < numNewLines; i++)
            returnCmd += ",null";
          returnCmd += "]}";
          msgQueuePage.push_back("/return");
          msgQueueData.push_back(returnCmd);
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
        if (startPostRequest("192.168.0.105",80,"/keepAlive", msg))
          waitingOn = WaitingOnEnum::Cmd;
          else connectionClosed();
      } else if (msgQueuePage.size() > 0) {
        // do commands from the queue
        for(int i = 0; i < msgQueuePage.size(); i++) {
          if (msgQueuePage[i].size() == 0) continue;
          if (startPostRequest("192.168.0.105", 80, msgQueuePage[i].c_str(), msgQueueData[i])) {
            waitingOn = WaitingOnEnum::Generic;
            msgQueuePage[i] = "";
            msgQueueData[i] = "";
          } else connectionClosed();
        }
      }
    } else if ((millis() - lastKeepAliveTime) >= 1000) {
      // not connected to mocs
      // retry connection if it has been a seconds since it tried last
      lastKeepAliveTime = millis();
      if(startPostRequest("192.168.0.105",80,"/connect", self))
        waitingOn = WaitingOnEnum::Key;
      else connectionClosed();
    }
  } else if (!wifiClientStatus()) {
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
        msgQueuePage.push_back("/updateValue");
        msgQueueData.push_back(msg);
      }
      break;
    case '^':// Up
      setState(true);
      if (isMocsActive) {
        msg = "{\"id\":\"";
        msg += connectionId;
        msg += "\", \"name\": \"lights\", \"value\": true }";
        msgQueuePage.push_back("/updateValue");
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
        msg += "\", \"name\": \"lights\", \"value\": false }";
        msgQueuePage.push_back("/updateValue");
        msgQueueData.push_back(msg);
      }
      break;
    case 't':// toggle or play/pause
      newState = toggle();
      if (isMocsActive) {
        msg = "{\"id\":\"";
        msg += connectionId;
        msg += "\", \"name\": \"lights\", \"value\": ";
        msg += (newState?"true":"false");
        msg += " }";
        msgQueuePage.push_back("/updateValue");
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