/**
 * demo.js v1
 *
 * © 2020 Yuji Hase
 *
 * Released under the MIT license.
 * see https://opensource.org/licenses/MIT
 */

var room;

document.querySelector("#entrance").addEventListener("submit", function(event){
  event.preventDefault();
  var roomIdField = document.querySelector("#roomIdField");
  var roomId = roomIdField.value.trim();
  if (roomId == "") {
    roomIdField.value = "";
    roomIdField.placeholder = "Fill in the room name!";
    roomIdField.focus();
    return;
  }
  console.log("enter room - " + roomId);
  room = new TalkerRoom(roomId, "#videos");
  document.querySelector("#roomId").innerText = roomId;
  document.querySelector("#entrance").style.display = "none";
  document.querySelector("#room").style.display = "block";
});

document.querySelector("#leave").addEventListener("click", function(event){
  console.log("leave room - " + room.getRoomId());
  room.leave();
  room = null;
  document.querySelector("#entrance").style.display = "block";
  document.querySelector("#room").style.display = "none";
});

var ua = window.navigator.userAgent.toLowerCase();
if (ua.indexOf('msie') != -1 || ua.indexOf('trident') != -1) {
  document.querySelector("#caution").innerText = "Internet Explorer is not supported.";
  document.querySelector("#roomIdField").disabled = true;
  document.querySelector("#enter").disabled = true;
}