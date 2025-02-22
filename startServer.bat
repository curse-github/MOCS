@echo off
powershell "./scripts/cleanFiles.bat"
powershell "./build.bat" && echo  -- starting server && powershell "npm start"
pause