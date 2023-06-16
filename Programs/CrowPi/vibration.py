#!/usr/bin/python
import RPi.GPIO as GPIO
import time
import sys

vibration_pin = 27

def run():
    print(sys.argv)
    print(len(sys.argv))
    if (len(sys.argv) >= 2):
        try:
            GPIO.setmode(GPIO.BCM)
            GPIO.setup(vibration_pin, GPIO.OUT)
            GPIO.output(vibration_pin, GPIO.HIGH)
            time.sleep(float(sys.argv[1]))
            GPIO.output(vibration_pin, GPIO.LOW)
            GPIO.cleanup()
        except ValueError:
            return
    else:
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(vibration_pin, GPIO.OUT)
        GPIO.output(vibration_pin, GPIO.HIGH)
        time.sleep(0.5)
        GPIO.output(vibration_pin, GPIO.LOW)
        GPIO.cleanup()
run()