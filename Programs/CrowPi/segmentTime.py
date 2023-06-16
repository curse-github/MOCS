#!/usr/bin/python

#https://github.com/adafruit/Adafruit_Python_LED_Backpack/blob/master/Adafruit_LED_Backpack/SevenSegment.py
import time
import sys
import datetime
from Adafruit_LED_Backpack import SevenSegment
segment = SevenSegment.SevenSegment(address=0x70)
segment.begin()
segment.clear()
def run():
  if (len(sys.argv) < 2):
    return
  if (len(sys.argv[1])<4):
    return
  string = sys.argv[1]
  lst = [sys.argv[1][0:][:1],sys.argv[1][1:][:1],sys.argv[1][2:][:1],sys.argv[1][3:][:1]]
  print(lst)
  if (not string[0].isdigit()):
      return
  if (not string[1].isdigit()):
      return
  if (not string[2].isdigit()):
      return
  if (not string[3].isdigit()):
      return
  segment.set_digit(0, string[0])
  segment.set_digit(1, string[1])
  segment.set_digit(2, string[2])
  segment.set_digit(3, string[3])
  segment.set_colon(1)
  segment.write_display()
run()