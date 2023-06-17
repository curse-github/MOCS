#!/usr/bin/python
from luma.led_matrix.device import max7219
from luma.core.interface.serial import spi, noop
import PIL
import sys
import time

stateString = open("./matrixState.txt", "r").read()
state = map(lambda x:list(x.replace("\r","")),stateString.split("\n"))
def run():
    if (len(sys.argv) < 5):
        return
    x = sys.argv[1]
    y = sys.argv[2]
    s = sys.argv[3]
    v = sys.argv[4]
    if (not x.isdigit()):
        return
    x = int(x)
    if (not y.isdigit()):
        return
    y = int(y)
    if (not s.isdigit()):
        return
    s = int(s)
    if (not v.lower() == "true" and not v.lower()=="false"):
        return
    v = v.lower() == "true"
    for x1 in range(s):
        for y1 in range(s):
            if (v):
                state[x+x1][y+y1] = "O"
            else:
                state[x+x1][y+y1] = "X"
    open("./matrixState.txt", "w").write("\n".join(map(lambda x:"".join(x),state)))
run()