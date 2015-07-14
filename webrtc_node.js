'use strict';

var RemoteVideo = (function(){
  var SIGNALING_CHANNEL_HOST = "ws://localhost:5000/";


  var ServiceBase = function(key, options){
    var constraints = options['constraints'];
    var localVideoElement = options['localVideoElement'];
    var remoteVideoElement = options['remoteVideoElement'];

    this.signalingChannel = new RemoteVideo.SignalingChannel(key, 
      SIGNALING_CHANNEL_HOST);
    
    this.webRTCNode = new RemoteVideo.WebRTCNode(this.signalingChannel, {
      isMaster: this.isMaster,
      remoteVideoOutput: remoteVideoElement
    });

    this.signalingChannel.onconnected = function(){
      this.webRTCNode.init();

      getUserMedia(constraints, function (stream) {
        if(localVideoElement){
          localVideoElement.src = URL.createObjectURL(stream);
        }
        this.webRTCNode.addStream(stream);
      }.bind(this), logError);

    }.bind(this);

    return {
      start: function(){
        this.signalingChannel.open();
      }.bind(this)
    };
  };

  function ServiceMaster(key, options){
    this.isMaster = true;
    return this.ServiceBase(key, options);
  }
  ServiceMaster.prototype.ServiceBase = ServiceBase; 

  function ServiceSlave(key, options){
    this.isMaster = false;
    return this.ServiceBase(key, options);
  }
  ServiceSlave.prototype.ServiceBase = ServiceBase;


  function WebRTCNode(signalingChannel, options){
    var configuration = { "iceServers": [{ "url": "stun:stun.example.org" }] };

    var remoteVideoElement = options['remoteVideoOutput'];
    var isMaster = !!options['isMaster'];

    var _stream = null;
    var pc = null;

    signalingChannel.onmessage = function (evt) {
      if (!pc)
        init();

      var message = JSON.parse(evt.data);
      if(message.sdp){
        pc.setRemoteDescription(new RTCSessionDescription(message.sdp), function () {
          
          if (pc.remoteDescription.type == "offer")
            pc.createAnswer(_onLocalDescriptionCreate, _logError);

        }, logError);

      } else {
        pc.addIceCandidate(new RTCIceCandidate(message.candidate));
      }
    };

    function _onLocalDescriptionCreate(desc) {
      pc.setLocalDescription(desc, function () {
        signalingChannel.send(JSON.stringify({ 
          "type": "sdp",
          "sdp": pc.localDescription 
        }));
      }, _logError);
    }

    function _logError(error) {
      console.log(error);
    }

    function init() {
      if(pc)
        return;

      pc = new RTCPeerConnection(configuration);

      if(isMaster){
        pc.onnegotiationneeded = function () {
          pc.createOffer(_onLocalDescriptionCreate, _logError);
        }
      }

      pc.onaddstream = function (evt) {
        if(remoteVideoElement)
          remoteVideoElement.src = URL.createObjectURL(evt.stream);
      };

      pc.onremovestream = function(evt){
        if(remoteVideoElement)
          remoteVideoElement.src = null;
      };

      pc.onicecandidate = function (evt) {
        if (evt.candidate)
          signalingChannel.send(JSON.stringify({
           "type": "candidate",
           "candidate": evt.candidate 
          }));
      };

    }

    function addStream(stream){
      removeStream();
      _stream = stream;
      pc.addStream(stream);
    }

    function removeStream(){
      if(_stream){
        pc.removeStream(_stream);
        _stream = null;
      }
    }

    function close(){
      if(_stream)
        pc.removeStream(_stream);
    }

    return {
      init: init,
      addStream: addStream,
      removeStream: removeStream,
      close: close
    };
  }


  function SignalingChannel(key, url){
    var STATUS = {
      NONE: 0, 
      WAITING: 1,
      READY: 2
    };

    var socketConnection = new SocketConnection(url);
    var channelStatus = STATUS.NONE;
    var onconnected = null;
    var onmessage = null;
    var _key = key;

    function open(){
      socketConnection.connect();
      channelStatus = STATUS.WAITING;

      socketConnection.onconnected = function(evt){
        send('ctl::join');
      };

      socketConnection.onmessage = function(evt){
        if(channelStatus == STATUS.WAITING){
          if(evt.data == 'ctl::ready'){
            channelStatus = STATUS.READY;
            if(onconnected){
              onconnected(evt);
            }
          }
          return;
        }

        if(onmessage){
          onmessage(evt);
        }
      };
    }

    function send(msg){
      socketConnection.send(JSON.stringify({
        key: _key,
        msg: msg
      }));
    }

    function close(){
      socketConnection.disconnect();
    }

    return {
      set onconnected(func){
        onconnected = func;
      },
      set onmessage(func){
        onmessage = func;
      },
      send: send,
      open: open,
      close: close
    };
  }


  function SocketConnection(url){
    var websocket = null;

    var onconnected = null;
    var onmessage = null;
    var onclose = null;
    var onerror = null;

    function connect()
    {
      websocket = new WebSocket(url);

      websocket.onconnected = onconnected;
      websocket.onmessage = onmessage;
      websocket.onclose = onclose;
      websocket.onerror = onerror;
    }

    function send(message)
    {
      websocket.send(message);
    }


    function disconnect() {
      websocket.close();
    }


    return {
      set onconnected(func){
        if(websocket)
          websocket.onopen = func;
        onconnected = func;
      },
      set onmessage(func){
        if(websocket)
          websocket.onmessage = func;
        onmessage = func;
      },
      set onclose(func){
        if(websocket)
          websocket.onclose = func;
        onclose = func;
      },
      set onerror(func){
        if(websocket)
          websocket.onerror = func;
        onerror = func;
      },
      connect:connect,
      send:send,
      disconnect:disconnect
    };
  }

  function logError(error) {
    console.log(error);
  }

  return {
    ServiceMaster: ServiceMaster,
    ServiceSlave: ServiceSlave,
    WebRTCNode: WebRTCNode,
    SignalingChannel: SignalingChannel
  };
})();