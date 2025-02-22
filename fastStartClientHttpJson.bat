@echo off
powershell "./fastBuild.bat" && echo  -- starting client && powershell "npm run startClientHttpJson"
pause