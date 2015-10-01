FROM node:4.1.1
WORKDIR /usr/src/myapp/
EXPOSE 8888
CMD node tests/server.js
