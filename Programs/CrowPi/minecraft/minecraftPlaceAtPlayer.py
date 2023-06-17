#!/usr/bin/python

#https://github.com/martinohanlon/mcpi/blob/master/mcpi/minecraft.py
import sys
from mcpi.minecraft import Minecraft
def run():
    if (len(sys.argv) < 2):
        return
    blockid = sys.argv[1]
    if (not blockid.isdigit()):
        return
    blockid = int(blockid)

    mc = Minecraft.create()
    ptx, pty, ptz = mc.player.getTilePos()
    pos = (ptx,pty,ptz)
    if (len(sys.argv) >= 3):
        subtype = sys.argv[2]
        if (not subtype.isdigit()):
            return
        subtype = int(subtype)
        mc.setBlock(pos[0],pos[1],pos[2], blockid, subtype)
    else:
        mc.setBlock(pos[0],pos[1],pos[2], blockid)
run()