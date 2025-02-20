@echo off
powershell "./build.bat" && echo  -- starting client && powershell "npm run startClientWs"
pause