#!/usr/bin/python

#https://github.com/martinohanlon/mcpi/blob/master/mcpi/minecraft.py
import sys
from mcpi.minecraft import Minecraft
def run():
    if (len(sys.argv) < 2):
        return
    # Initialize the LCD using the pins
    mc = Minecraft.create()
    mc.postToChat(sys.argv[1])
run()