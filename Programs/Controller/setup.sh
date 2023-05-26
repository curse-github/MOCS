sudo rm /usr/local/bin/oled-start
sudo chmod 777 /home/pi/run.sh
#install things
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y screen
sudo apt-get install -y curl
curl -sL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo apt-get install -y python-dev
sudo apt-get install -y libusb-1.0-0-dev
sudo apt-get install -y libudev-dev
sudo apt-get install -y software-properties-common
sudo apt-get install -y python-software-properties
sudo tar -xvf Python-3.9.9.tgz
cd Python-3.9.9
sudo ./configure --enable-optimizations
wget https://www.python.org/ftp/python/3.9.9/Python-3.9.9.tgz
sudo make -j8
sudo make install
sudo apt-get update -y
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
sudo rm /home/pi/getHid.py
sudo reboot now