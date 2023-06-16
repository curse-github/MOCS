#!/usr/bin/python

#https://github.com/martinohanlon/mcpi/blob/master/mcpi/minecraft.py
import sys
from mcpi.minecraft import Minecraft
def run():
    if (len(sys.argv) < 4):
        return
    pos = (sys.argv[1],sys.argv[2],sys.argv[3])
    if ((not pos[0].isdigit()) and (not (pos[0].startswith("-") and pos[0][1:].isdigit()))):
        return
    if ((not pos[1].isdigit()) and (not (pos[1].startswith("-") and pos[1][1:].isdigit()))):
        return
    if ((not pos[2].isdigit()) and (not (pos[2].startswith("-") and pos[2][1:].isdigit()))):
        return
    pos = (int(pos[0]),int(pos[1]),int(pos[2]))
    # create Minecraft Object
    mc = Minecraft.create()
    mc.player.setPos(pos[0],pos[1],pos[2]);
run()