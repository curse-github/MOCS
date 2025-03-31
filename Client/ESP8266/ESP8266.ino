#include <string>
#include <vector>

struct updateValueStr {
  std::string name;
  unsigned int valueNum;
  bool valueBool;
};

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
const char *ip = "192.168.0.105";
const char *ssid = "CurseNet24";
const char *password = "simpsoncentral";
const char *self = "{\"name\":\"ESP8266\",\"functions\":[{\"name\":\"toggle\",\"overloads\":[{\"visible\":false,\"parameters\":[],\"returnType\":\"none\"}]}],\"values\":[{\"name\":\"fan\",\"type\":\"bool\",\"value\":true,\"readonly\":false},{\"name\":\"ir\",\"type\":\"integer\",\"value\":0,\"readonly\":true,\"displayType\":\"hex\"}],\"children\":[]}";
std::string connectionId = "";
unsigned long lastKeepAliveTime = 0;
WaitingOnEnum waitingOn = WaitingOnEnum::None;
std::vector<updateValueStr> updateQueue;
void setup() {
  serialInit();
  while (!wifiClientStatus())
    wifiInitConnection(ssid, password);
  sensorInit();
  outputInit();
}
void handleCmd(const std::string &cmd) {
  if (cmd.substr(0,8) == "fan.set(")
    setState(cmd[8] == 't');
  else if (cmd.substr(0,7) == "toggle(") {
    bool newState = toggle();
    updateQueue.push_back({ "fan",0,newState });
  }
}
std::string workingStr = "";
void executeUpdateValue(const updateValueStr &str) {
  workingStr = "{\"id\":\"";
  workingStr += connectionId;
  workingStr += "\",\"name\":\"";
  workingStr += str.name;
  workingStr += "\",\"value\":";
  if (str.name[0]=='f') {
    workingStr += (str.valueBool?"true":"false");
  } else if (str.name[0]=='i') {
    workingStr += std::to_string(str.valueNum);
  } else return;
  workingStr += '}';
  waitingOn = WaitingOnEnum::Generic;
  if (!startPostRequest(ip, 8080, "/updateValue", workingStr))
    mocsConnectionClosed();
  workingStr = "";
}
void mocsConnectionClosed() {
  myPrintln("Mocs connection closed.");
  // set mocs vars
  isMocsActive = false;
  connectionId = "";
  waitingOn = WaitingOnEnum::None;
  lastKeepAliveTime = 0;
  updateQueue.clear();
  // set http vars
  clearVars();
}
void mocsLoop() {
  // myPrint(ESP.getFreeHeap());
  // myPrintln(" bytes");
  if (wifiClientStatus() && !isPostRequestDone()) {
    std::string data = continuePostRequest();
    if (data != "") {
      data.erase(0, 1);// remove the first character.
      if (data == "Invalid") { mocsConnectionClosed(); return; }
      // allocate variables up here
      unsigned int numNewLines = 0;// num commands is the number of new lines plus one
      // switch based on what the program is expecting
      switch (waitingOn) {
        case WaitingOnEnum::Key:
          waitingOn = WaitingOnEnum::None;
          if (data == "") break;// failed to connect
          myPrintln("Mocs connection opened.");
          connectionId = data;
          isMocsActive = true;
          waitingOn = WaitingOnEnum::None;
          break;
        case WaitingOnEnum::Cmd:
          lastKeepAliveTime = millis();
          waitingOn = WaitingOnEnum::None;
          if (data == "") break;
          // parse commands
          for (int i = 0; i < data.size(); i++) {
            if (data[i] == '\r') continue;
            if (data[i] == '\n') {
              handleCmd(workingStr);
              workingStr = "";
              numNewLines++;
            } else workingStr += data[i];
          }
          if (workingStr.size()>0) handleCmd(workingStr);
          // create return statement
          workingStr = "{\"id\":\"";
          workingStr += connectionId;
          workingStr += "\",\"values\":[null";
          for(int i = 0; i < numNewLines; i++)
            workingStr += ",null";
          workingStr += "]}";
          // do post request
          waitingOn = WaitingOnEnum::Generic;
          if (!startPostRequest(ip, 8080, "/return", workingStr))
            mocsConnectionClosed();
          workingStr = "";
          break;
        case WaitingOnEnum::Generic:
          waitingOn = WaitingOnEnum::None;
          break;
        default:
          myPrintln("ERROR");
          break;
      }
    }
  } else if (!wifiClientStatus()) {
    while (!wifiClientStatus())
      wifiInitConnection(ssid, password);
  } else if (isPostRequestDone()) {
    if (!isMocsActive && ((millis() - lastKeepAliveTime) >= 10000) ) {
      lastKeepAliveTime = millis();
      waitingOn = WaitingOnEnum::Key;
      if(!startPostRequest(ip,8080,"/connect", self))
        mocsConnectionClosed();
    }
    if (!isMocsActive) return;
    // connected to mocs
    if ((millis() - lastKeepAliveTime) >= 1000) {
      // send the keepalive if it has been longer than a second
      workingStr = "{\"id\":\"";
      workingStr += connectionId;
      workingStr += "\"}";
      waitingOn = WaitingOnEnum::Cmd;
      if (!startPostRequest(ip,8080,"/keepAlive", workingStr))
        mocsConnectionClosed();
      workingStr = "";
    } else if (updateQueue.size() > 0) {
      // do commands from the queue
      for(int i = 0; i < updateQueue.size(); i++) {
        if (updateQueue[i].name.size() == 0) continue;
        executeUpdateValue(updateQueue[i]);
        updateQueue[i].name = "";
        return;
      }
      updateQueue.clear();
    }
  }
}
void loop() {
  mocsLoop();
  onButton(sensorRead());
}
void onButton(const int &code) {
  if (code==0) return;
  updateQueue.push_back({ "ir",static_cast<unsigned int>(code),false });
  const char button = encode(code);
  if (button == 'E') return;
  bool newState = false;
  switch(button) {
    case 'p':// Power
      newState = toggle();
      updateQueue.push_back({ "fan",0,newState });
      break;
    case '^':// Up
      setState(true);
      updateQueue.push_back({ "fan",0,true });
      break;
    case 'v':// Down
    case 'f':// FUNC/STOP
    case 's':// ST/REPT
      setState(false);
      updateQueue.push_back({ "fan",0,false });
      break;
    case 't':// toggle or play/pause
      newState = toggle();
      updateQueue.push_back({ "fan",0,newState });
      break;
    case '>':
      break;
    case '<':
      break;
    default:
      return;
  }
}