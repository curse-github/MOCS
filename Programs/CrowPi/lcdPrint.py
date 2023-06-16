#!/usr/bin/env python

#https://github.com/adafruit/Adafruit_Python_CharLCD/blob/master/Adafruit_CharLCD/Adafruit_CharLCD.py
import sys
import Adafruit_CharLCD as LCD
def run():
    if (len(sys.argv) < 2):
        return
    # Define LCD column and row size for 16x2 LCD.
    lcd_columns = 16
    lcd_rows    = 2
    # Initialize the LCD using the pins
    lcd = LCD.Adafruit_CharLCDBackpack(address=0x21)
    lcd.set_backlight(0)
    lcd.clear()
    lcd.message(sys.argv[1])
run()