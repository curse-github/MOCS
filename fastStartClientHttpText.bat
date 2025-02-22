@echo off
powershell "./fastBuild.bat" && echo  -- starting client && powershell "npm run startClientHttpText"
pause