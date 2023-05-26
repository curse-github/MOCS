sudo rm /usr/local/bin/oled-start
sudo chmod 777 /home/pi/run.sh
#install things
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y screen
sudo apt-get install -y curl
curl -sL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install ws
sudo npm install -g typescript
sudo npm install -g ts-node

sudo /bin/cp /home/pi/main.c /root/NanoHatOLED/Source/main.c
sudo /usr/bin/gcc /root/NanoHatOLED/Source/daemonize.c /root/NanoHatOLED/Source/main.c -lrt -lpthread -o /root/NanoHatOLED/NanoHatOLED
sudo rm /home/pi/main.c
sudo rm /home/pi/clear.py
sudo rm /home/pi/line.py
sudo rm /home/pi/Procedure.txt
sudo rm /home/pi/setup.sh
sudo reboot now