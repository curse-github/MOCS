//https://github.com/crankyoldgit/IRremoteESP8266
#include <IRremote.hpp>

void sensorInit() {
  IrReceiver.begin(sensorPin);
}
bool didDecode = false;
char sensorRead() {
  if (didDecode) IrReceiver.resume();
  didDecode = IrReceiver.decode();
  if (didDecode)
    return recode(IrReceiver.decodedIRData.decodedRawData);
  else
    return 'E';
}

char recode(int code) {
  switch(code) {
    case 0xBA45FF00:// Power
      return 'p';
    case 0xB946FF00:// volume up
      return '^';
    case 0xB847FF00:// FUNC/STOP
      return 'f';
    //case 0x:// left
    case 0xBB44FF00:// rewind
      return '<';
    case 0xBF40FF00:// toggle or play/pause
      return 't';
    //case 0x:// right
    case 0xBC43FF00:// fast forward
      return '>';
    case 0xF807FF00:// down
      return 'v';
    case 0xEA15FF00:// volume down
      return 'v';
    case 0xF609FF00:// up
      return '^';
    case 0xE916FF00:
      return '0';
    case 0xE619FF00:// EQ
      return 'e';
    case 0xF20DFF00:// ST/REPT
      return 's';
    case 0xF30CFF00:
      return '1';
    case 0xE718FF00:
      return '2';
    case 0xA15EFF00:
      return '3';
    case 0xF708FF00:
      return '4';
    case 0xE31CFF00:
      return '5';
    case 0xA55AFF00:
      return '6';
    case 0xBD42FF00:
      return '7';
    case 0xAD52FF00:
      return '8';
    case 0xB54AFF00:
      return '9';
    default:
      return 'E';
  }
  return 'E';
}