import signal
import os
import time

def receive(signum, stack):
	nm = signal.Signals(signum).name
	if (nm == "SIGUSR1"):
		os.system("sudo node /home/pi/Mocs.SendButtonPress.js 1")
	if (nm == "SIGUSR2"):
		os.system("sudo node /home/pi/Mocs.SendButtonPress.js 2")
	if (nm == "SIGALRM"):
		os.system("sudo node /home/pi/Mocs.SendButtonPress.js 3")
signal.signal(signal.SIGUSR1,receive)
signal.signal(signal.SIGUSR2,receive)
signal.signal(signal.SIGALRM,receive)
while True:
	try:
		time.sleep(1)
	except KeyboardInterrupt:
		break