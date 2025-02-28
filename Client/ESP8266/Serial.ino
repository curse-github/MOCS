void serialInit() {
#if _ALLOW_SERIAL
  Serial.begin(serialBaud);
  delay(5000);
  clearConsole();
  myPrintln("Serial Initialized");
#endif
}
void myPrintln() {
#if _ALLOW_SERIAL
  Serial.println();
#endif
}
void myPrintln(char chr) {
#if _ALLOW_SERIAL
  Serial.println(chr);
#endif
}
void myPrint(char chr) {
#if _ALLOW_SERIAL
  Serial.print(chr);
#endif
}
void myPrintln(const char* str) {
#if _ALLOW_SERIAL
  Serial.println(str);
#endif
}
void myPrint(const char* str) {
#if _ALLOW_SERIAL
  Serial.print(str);
#endif
}
void myPrintln(const int &num) {
#if _ALLOW_SERIAL
  Serial.println(num);
#endif
}
void myPrint(const int &num) {
#if _ALLOW_SERIAL
  Serial.print(num);
#endif
}
void myPrintln(const long &num) {
#if _ALLOW_SERIAL
  Serial.println(num, HEX);
#endif
}
void myPrint(const long &num) {
#if _ALLOW_SERIAL
  Serial.print(num, HEX);
#endif
}
void myPrintln(const unsigned int &num) {
#if _ALLOW_SERIAL
  Serial.println(num);
#endif
}
void myPrint(const unsigned int &num) {
#if _ALLOW_SERIAL
  Serial.print(num);
#endif
}
void myPrintln(const unsigned long &num) {
#if _ALLOW_SERIAL
  Serial.println(num, HEX);
#endif
}
void myPrint(const unsigned long &num) {
#if _ALLOW_SERIAL
  Serial.print(num, HEX);
#endif
}
void myPrintln(const float &num) {
#if _ALLOW_SERIAL
  Serial.println(num);
#endif
}
void myPrint(const float &num) {
#if _ALLOW_SERIAL
  Serial.print(num);
#endif
}
void myPrintln(const double &num) {
#if _ALLOW_SERIAL
  Serial.println(num);
#endif
}
void myPrint(const double &num) {
#if _ALLOW_SERIAL
  Serial.print(num);
#endif
}
void myPrintln(const std::string &str) {
  myPrintln(str.c_str());
}
void myPrint(const std::string &str) {
  myPrint(str.c_str());
}

void clearConsole() {
  myPrintln();
}