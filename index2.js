'use strict';

var remoteVideo = document.querySelector('#remote');

var remoteVideoSlave = new RemoteVideo.ServiceSlave('key', {
  constraints: {audio: false, video: true},
  remoteVideoElement: remoteVideo,
});

remoteVideoSlave.start();