@echo off
powershell "./install.bat" && echo  -- compiling typescript && powershell "tsc --jsx preserve"