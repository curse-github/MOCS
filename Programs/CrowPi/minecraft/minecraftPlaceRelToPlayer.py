#!/usr/bin/python

#https://github.com/martinohanlon/mcpi/blob/master/mcpi/minecraft.py
import sys
from mcpi.minecraft import Minecraft
def run():
    if (len(sys.argv) < 5):
        return
    pos = (sys.argv[1],sys.argv[2],sys.argv[3])
    blockid = sys.argv[4]
    if (not blockid.isdigit()):
        return
    blockid = int(blockid)
    try:
        pos = (float(pos[0]),float(pos[1]),float(pos[2]))
    except ValueError:
        return

    mc = Minecraft.create()
    ptx, pty, ptz = mc.player.getTilePos()
    if (len(sys.argv) >= 6):
        subtype = sys.argv[5]
        if (not subtype.isdigit()):
            return
        mc = Minecraft.create()
        mc.setBlock(ptx+pos[0],pty+pos[1],ptz+pos[2], blockid, int(subtype))
    else:
        mc = Minecraft.create()
        mc.setBlock(ptx+pos[0],pty+pos[1],ptz+pos[2], blockid)
run()