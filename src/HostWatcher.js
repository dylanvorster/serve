var io			= require('socket.io-client');
var chokidar	= require('chokidar');
var path		= require('path');

var port = process.argv[2];
var remoteRoot = process.argv[3];
var localRoot = process.argv[4];

console.log("localroot: "+localRoot);
console.log("remoteRoot: "+remoteRoot);

var amWatching = {};

socket = io(process.argv[2]);
socket.on('connect', function (data) {
	console.log("Connected to middleware");
	socket.on("new-file",function(data){
		
		if(!amWatching[data]){
			amWatching[data] = true;
			var file = localRoot+"/"+data.substring(remoteRoot.length);
			console.log("watching: "+file);
			chokidar.watch(file).on('change',function(){
				console.log(file +" changed");
				socket.emit("file-changed",data);
			});
		}
	});
});
socket.on('disconnect', function (data) {
	console.log("Disconnected");
});
console.log("connecting to: "+process.argv[2]);