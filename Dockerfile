FROM node:18
COPY ./Spotify/*.txt ./Spotify/
COPY ./Webserver/* ./Webserver/
COPY ./Lib.js .
COPY ./Spotify.js .
COPY ./Server.js .
COPY ./logins.json .
COPY ./package.json .
RUN npm install
ENTRYPOINT npm start