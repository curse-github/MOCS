#!/usr/bin/python

#https://github.com/adafruit/Adafruit_Python_LED_Backpack/blob/master/Adafruit_LED_Backpack/SevenSegment.py
import time
import sys
import datetime
from Adafruit_LED_Backpack import SevenSegment
segment = SevenSegment.SevenSegment(address=0x70)
segment.begin()
segment.clear()
segment.write_display()