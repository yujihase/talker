/**
 * talker.js v1
 *
 * © 2020 Yuji Hase
 *
 * Released under the MIT license.
 * see https://opensource.org/licenses/MIT
 */

const trickleice = true;

function TalkerRoom(roomId, selectors) {

  var thisRoom = this;

  var videos = document.querySelector(selectors);

  var peers = {};

  /**
   * Release media resources of removed video elements explicitly.
   * @param {*} mutationRecords
   */
  var releaseMediaResources = function(mutationRecords){
    mutationRecords.forEach(function(record){
      record.removedNodes.forEach(function(video){
        video.pause();
        video.srcObject.getTracks().forEach(function(track){
          track.stop();
        });
        video.srcObject = null;
      })
    });
  };

  var videosObserver = new MutationObserver(releaseMediaResources);
  videosObserver.observe(videos, { childList: true });

  var ws = new WebSocket("wss://your_server:3000/talker");
  ws.onopen = function(event){
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: {
        autoGainControl: true,
        echoCancellation: true,
        echoCancellationType: 'system',
        noiseSuppression: false
      }
    })
    .then(function(stream){
      thisRoom.localVideo = thisRoom.createVideoElement();
      thisRoom.localVideo.muted = true;
      thisRoom.localVideo.srcObject = stream;
      thisRoom.localVideo.play();

      thisRoom.send({ roomId: roomId, action: "hello" });
    })
    .catch(function(error){
      console.error(error);
    });
  };
  ws.onerror = function(error){
    console.error(error);
  };
  ws.onmessage = function(event){
    let m = JSON.parse(event.data);
    if ("sender" in m && m.action === "hello") {
      console.log("hello - " + m.sender);
      var peer = thisRoom.createPeer(m.sender);
      peer.createOffer()
      return;
    }
    if ("sender" in m && m.action === "bye") {
      console.log("bye - " + m.sender);
      var peer = peers[m.sender];
      delete peers[m.sender];
      peer.delete();
      return;
    }
    if ("sender" in m && "sdp" in m) {
      console.log("sdp - " + m.sender);
      var sessionDescription = new RTCSessionDescription(m.sdp);
      switch (m.sdp.type) {
      case 'offer':
        var peer = thisRoom.createPeer(m.sender);
        peer.setRemoteDescription(sessionDescription)
        .then(function(){
          peer.createAnswer();
        })
        .catch(function(error){
          console.error(error);
        });
        break;
      case 'answer':
        var peer = peers[m.sender];
        peer.setRemoteDescription(sessionDescription)
        .then(function(){
        })
        .catch(function(error){
          console.error(error);
        });
        break;
      }
      return;
    }
    if ("sender" in m && "candidate" in m) {
      console.log("candidate - " + m.sender);
      var peer = peers[m.sender];
      peer.addIceCandidate(new RTCIceCandidate(m.candidate));
    }
  };

  this.localVideo = null;

  /**
   * getRoomId
   */
  this.getRoomId = function(){
    return roomId;
  };

  /**
   * leave
   */
  this.leave = function(){
    ws.close();

    Object.values(peers).forEach(function(peer){
      peer.delete();
    });
    peers = null;

    videos.removeChild(thisRoom.localVideo);

    releaseMediaResources(videosObserver.takeRecords());
    videosObserver.disconnect();
  };

  /**
   * createVideoElement
   */
  this.createVideoElement = function(){
    var element = document.createElement("video");
    element.setAttribute("autoplay", "");
    element.setAttribute("playsinline", "");
    videos.appendChild(element);
    return element;
  };

  /**
   * createPeer
   */
  this.createPeer = function(peerId){
    var peer = new TalkerPeer(thisRoom, peerId);
    peers[peerId] = peer;
    return peer;
  };

  /**
   * send
   */
  this.send = function(data){
    ws.send(JSON.stringify(data));
  };
}

function TalkerPeer(room, peerId) {

  var video = room.createVideoElement();

  var connection = new RTCPeerConnection({ "iceServers": [] });
  connection.ontrack = function(event){
    video.srcObject = event.streams[0];
    video.play();
  };
  connection.onicecandidate = function(event){
    if (trickleice) {
      if (event.candidate !== null) {
        room.send({ recipient: peerId, candidate: event.candidate });
      }
    } else {
      if (event.candidate === null) {
        room.send({ recipient: peerId, sdp: connection.localDescription });
      }
    }
  };
  if (room.localVideo.srcObject) {
    var stream = room.localVideo.srcObject;
    connection.addTrack(stream.getVideoTracks()[0], stream);
    connection.addTrack(stream.getAudioTracks()[0], stream);
  }

  var createSdp = function(promise){
    promise
    .then(function(sessionDescription){
      connection.setLocalDescription(sessionDescription);
      if (trickleice) {
        room.send({ recipient: peerId, sdp: sessionDescription });
      }
    })
    .catch(function(error){
      console.error(error);
    });
  };

  /**
   * createOffer
   */
  this.createOffer = function(){
    createSdp(connection.createOffer());
  };

  /**
   * createAnswer
   */
  this.createAnswer = function(){
    createSdp(connection.createAnswer());
  };

  /**
   * addIceCandidate
   */
  this.addIceCandidate = function(candidate){
    connection.addIceCandidate(candidate);
  };

  /**
   * setRemoteDescription
   */
  this.setRemoteDescription = function(sessionDescription){
    return connection.setRemoteDescription(sessionDescription)
  };

  /**
   * delete
   */
  this.delete = function(){
    connection.close();
    connection = null;
    video.parentNode.removeChild(video);
  };
}