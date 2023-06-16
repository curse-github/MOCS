#!/usr/bin/python
# -*- coding: utf-8 -*-
# http://elecrow.com/

import RPi.GPIO as GPIO
import time
import sys

buzzer_pin = 18

def run():
    if (len(sys.argv) >= 2):
        try:
            GPIO.setmode(GPIO.BCM)
            GPIO.setup(buzzer_pin, GPIO.OUT)
            GPIO.output(buzzer_pin, GPIO.HIGH)
            time.sleep(float(sys.argv[1]))
            GPIO.output(buzzer_pin, GPIO.LOW)
            GPIO.cleanup()
        except ValueError:
            return
    else:
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(buzzer_pin, GPIO.OUT)
        GPIO.output(buzzer_pin, GPIO.HIGH)
        time.sleep(0.5)
        GPIO.output(buzzer_pin, GPIO.LOW)
        GPIO.cleanup()
run()