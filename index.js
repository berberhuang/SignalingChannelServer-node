'use strict';

var remoteVideo = document.querySelector('#remote');

var remoteVideoMaster = new RemoteVideo.ServiceMaster('key', {
  constraints: {audio: false, video: true},
  remoteVideoElement: remoteVideo
});

remoteVideoMaster.start();