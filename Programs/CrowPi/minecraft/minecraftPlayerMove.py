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
    except ValueError:
        return
    mc = Minecraft.create()
    ptx, pty, ptz = mc.player.getTilePos()
    mc.player.setTilePos(ptx+pos[0],pty+pos[1],ptz+pos[2]);
run()