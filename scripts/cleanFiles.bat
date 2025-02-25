@echo off
echo  -- cleaning files
powershell -Command "del *.js"
powershell -Command "del *.jsx"
powershell -Command "del ./Client/js/*.js"
powershell -Command "del ./Client/js/*.jsx"
powershell -Command "del ./Client/cpp/*.exe"