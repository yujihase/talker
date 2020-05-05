/**
 * talkerd.js v1
 *
 * © 2020 Yuji Hase
 *
 * Released under the MIT license.
 * see https://opensource.org/licenses/MIT
 */

"use strict";

const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

var rooms = {};
var peers = {};
var roomIds = new Map();

var wss = new WebSocket.Server({
  server: https.createServer({
    cert: fs.readFileSync('cert.pem'),
    ca: fs.readFileSync('chain.pem'),
    key: fs.readFileSync('privkey.pem')
  }).listen(3000),
  path: "/talker",
  clientTracking: false
});
wss.on('connection', (socket, request) => {

  const peerId = uuidv4();
  peers[peerId] = socket;
  console.log("connected (" + peerId + ")");

  socket.on('close', (code, reason) => {
    console.log("closed (" + peerId + ")");

    const roomId = roomIds.get(socket);

    if (roomId !== undefined && roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter(s => s !== socket);
      rooms[roomId].forEach(s => send(s, { sender: peerId, action: "bye" }))
    }

    delete peers[peerId];
    roomIds.delete(socket);
  });

  socket.on('message', function(data){

    const m = JSON.parse(data);

    if ("roomId" in m && m.action === "hello") {
      console.log("hello " + m.roomId + " (" + peerId + ")");

      const roomId = roomIds.get(socket);

      if (roomId !== undefined && roomId in rooms) {
        rooms[roomId] = rooms[roomId].filter(s => s !== socket);
      }

      rooms[m.roomId] = rooms[m.roomId] || [];
      if (!rooms[m.roomId].includes(socket)) {
        rooms[m.roomId].forEach(s => send(s, { sender: peerId, action: "hello" }))
        rooms[m.roomId].push(socket);
      }

      roomIds.set(socket, m.roomId);
      return;
    }

    if ("recipient" in m && "sdp" in m) {
      console.log("sdp " + m.recipient + " (" + peerId + ")");

      const recipient = peers[m.recipient];
      send(recipient, { sender: peerId, sdp: m.sdp });
      return;
    }

    if ("recipient" in m && "candidate" in m) {
      console.log("candidate " + m.recipient + " (" + peerId + ")");

      const recipient = peers[m.recipient];
      send(recipient, { sender: peerId, candidate: m.candidate });
      return;
    }

    console.log("received (" + peerId + ")");
  });
});

function send(socket, data) {
  if (socket !== undefined && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
  }
}