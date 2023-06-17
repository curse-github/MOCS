#!/usr/bin/python

#https://github.com/martinohanlon/mcpi/blob/master/mcpi/minecraft.py
import sys
from mcpi.minecraft import Minecraft
def run():
    if (len(sys.argv) < 4):
        return
    pos = (sys.argv[1],sys.argv[2],sys.argv[3])
    try:
        pos = (float(pos[0]),float(pos[1]),float(pos[2]))
        # create Minecraft Object
        mc = Minecraft.create()
        mc.player.setTilePos(pos[0],pos[1],pos[2]);
    except ValueError:
        return
run()