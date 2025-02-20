@echo off
echo  -- cleaning dependencies
powershell -Command "del -Recurse node_modules"
powershell -Command "del package-lock.json"