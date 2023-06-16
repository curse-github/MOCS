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
  try:
    value = float(sys.argv[1])
    if  (value>9999):
      return
    elif(value>999.999):
      value = str(int(value))
      segment.print_number_str(value, False)
    elif(value>99.999 ):
      value = str(float(int(value*10  ))/10  ).ljust(5,"0")
      segment.print_number_str(value, False)
    elif(value>9.999  ):
      value = str(float(int(value*100 ))/100 ).ljust(5,"0")
      segment.print_number_str(value, False)
    else:
      value = str(float(int(value*1000))/1000).ljust(5,"0")
      segment.print_number_str(value, False)
  except ValueError:
    return
run()
segment.write_display()