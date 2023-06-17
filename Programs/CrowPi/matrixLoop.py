#!/usr/bin/python
from luma.led_matrix.device import max7219
from luma.core.interface.serial import spi, noop
import PIL
import time

def pixel(image,x,y):
    image.paste(1, (x,y,x+1,y+1))
serial = spi(port=0, device=1, gpio=noop())
device = max7219(serial, cascaded=1, block_orientation=90, rotate=0)

stateString = open("./matrixState.txt", "r").read()
state = map(lambda x:list(x.replace("\r","")),stateString.split("\n"))
def run():
    print(state)
    image = PIL.Image.new(mode="1", size=(8, 8))
    for x,row in enumerate(state):
        for y,pix in enumerate(row):
            if (pix == "O"):
                pixel(image,x,y)
    device.display(image);
run()
try:
    while True:
        tmp = open("./matrixState.txt", "r").read()
        if (stateString!=tmp):
            stateString=tmp
            state = map(lambda x:list(x.replace("\r","")),stateString.split("\n"))
            run()
        time.sleep(0.1)
except KeyboardInterrupt:
    pass