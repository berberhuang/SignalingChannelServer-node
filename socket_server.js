var WebSocketServer = require("ws").Server
var http = require("http")
var express = require("express")
var app = express()
var port = process.env.PORT || 5000

app.use(express.static(__dirname + "/"))

var server = http.createServer(app)
server.listen(port)

console.log("http server listening on %d", port)

var wss = new WebSocketServer({server: server})
console.log("websocket server created")

var clients = {};

wss.on("connection", function(ws) {
  console.log("websocket connection open")
  var key = null;
  var group = null;

  ws.on("message", function(msg){
    var mObj = JSON.parse(msg);
    if(mObj.msg == 'ctl::join'){
      // First stage
      key = mObj.key;
      if(clients[key]){
        group = clients[key];
        group.push(ws);

        for(i in group){
          group[i].send('ctl::ready');
        }
      }else{
        clients[key] = [ws];
        group = clients[key];
      }
    }else{
      // Second stage
      for(i in group){
        if(group[i] != ws){
          group[i].send(mObj.msg);
        }
      }
    }
  });

  ws.on("close", function() {
    group.splice(group.indexOf(ws), 1);
    
    console.log("websocket connection close")
  })
})
