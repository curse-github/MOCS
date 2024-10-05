call tsc
docker stop mocs-2-running
docker rm mocs-2-running
docker rmi mocs-2
docker build -t mocs-2 .
docker run --name mocs-2-running -d -p 42069:42069 -p 8081:8081 mocs-2
pause