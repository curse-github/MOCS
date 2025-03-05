void outputInit() {
  pinMode(outputPin, OUTPUT);
  setState(true);
}
bool state = false;
bool setState(bool _state) {
  state=_state;
  digitalWrite(outputPin,state?LOW:HIGH);
  return state;
}
bool toggle() {
  return setState(!state);
}
