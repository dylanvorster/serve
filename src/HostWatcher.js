/**
 * This is software that you run on your host machine if you are having
 * problems developing with systems such as Docker or VM's where the cache is
 * not being busted when files change.
 * 
 * The reason for this is that those sytems tend to use NFS protocols
 * that dont update our file watchers which we use to bust cache while you
 * are developing. Therefore this software does the same thing, but connects
 * to the software running opn the remote host via socket.io
 * 
 * It also has support for loading docker-compose.yml file mappings right
 * out of the box. Usage:
 * 
 * 
 * @usage 
 *	node src/HostWatcher.js --host http://docker.local:9085 --dockerComposeFile docker-compose.yml --dockerComposeKey node
 * 
 * --host:				the URL of the remote server running inside storm-serve
 * --dockerComposeFile: the path to the docker-compose.yml file
 * --dockerComposeKey:	the key for the container that has the file mappings
 * 
 * @author Dylan Vorster
 */
var io			= require('socket.io-client');
var chokidar	= require('chokidar');
var path		= require('path');
var YAML		= require('yamljs');
var minimatch	= require("minimatch");
var argv		= require('optimist').demand(['host']).argv;

//arguments imported
var port	= argv.host;
var yml		= argv.dockerComposeFile;
var ymlKey	= argv.dockerComposeKey;

//globals
var mappings = {};
var amWatching = {};

//is there a docker file
if(yml){
	var nativeObject = YAML.load(yml);
	nativeObject[ymlKey]['volumes'].forEach(function(entry){
		var split = entry.split(':');
		mappings[split[0]] = split[1];
	});
}

console.log("Mappings: ");
console.log(mappings);

socket = io(port);
socket.on('connect', function (data) {
	console.log("Connected to middleware");
	socket.on("new-file",function(data){
		
		if(!amWatching[data]){
			amWatching[data] = true;
			
			//match remote
			for(var i in mappings){
				if(minimatch(data, mappings[i]+"/**/*")){
					var file = path.resolve(i+"/"+data.substring(mappings[i].length));
					console.log("watching: "+file);
					chokidar.watch(file).on('change',function(){
						console.log(file +" changed");
						socket.emit("file-changed",data);
					});
					break;
				}
			}
			
		}
	});
});
socket.on('disconnect', function (data) {
	console.log("Disconnected");
});
console.log("connecting to: "+port);