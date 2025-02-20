@echo off
powershell "./fastBuild.bat" && echo  -- starting server && powershell "npm start"
pause