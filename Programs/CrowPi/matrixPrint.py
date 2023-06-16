#!/usr/bin/env python

#https://github.com/rm-hull/luma.led_matrix/
import sys
from luma.led_matrix.device import max7219
from luma.core.interface.serial import spi, noop
from luma.core.legacy import show_message
from luma.core.legacy.font import proportional, CP437_FONT, TINY_FONT, SINCLAIR_FONT, LCD_FONT


def Broadcast(msg):
    # create matrix device
    serial = spi(port=0, device=1, gpio=noop())
    device = max7219(serial, cascaded=1, block_orientation=90, rotate=0)
    # print hello world on the matrix display
    try:
        show_message(device, msg, fill="white", font=proportional(LCD_FONT), scroll_delay=0.15)
    except KeyboardInterrupt:
        return
if (len(sys.argv) >= 2):
    Broadcast(sys.argv[1])
