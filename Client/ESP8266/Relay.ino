void outputInit() {
  pinMode(outputPin, OUTPUT);
  setState(true);
}
bool state = false;
void setState(bool _state) {
  state=_state;
  digitalWrite(outputPin,state?LOW:HIGH);
}
void toggle() {
  setState(!state);
}
