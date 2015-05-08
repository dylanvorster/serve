var url				= require("url");
var fs				= require("fs");
var replaceStream	= require('replacestream');
var minimatch		= require("minimatch");
var _merge			= require("lodash/object/merge");

var DepsModule		= require("./DepsModule");
var inject			= require("./InjectScript");

/**
 * Helper function
 * 
 * @param {type} suffix
 * @returns {Boolean}
 */
String.prototype.endsWith = function (suffix) {
	return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

/**
 * @author Dylan Vorster
 */
module.exports = {
	settings:{
		mappings: {
			"/LoadModule.js":	__dirname + "/LoadModule.js"
		}
	},
	init: function(options){
		_merge(this.settings,options);
	},
	sentFiles: {},
	generateUID: function () {
		function s4() {
			return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
		}
		return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
	},
	generateSession: function () {
		do {
			//keep generating a session key until we have a unique one
			var session = this.generateUID();
		} while (this.sentFiles[session] !== undefined);

		return session;
	},
	registerFile: function (sessionID, file) {
		if (this.sentFiles[sessionID] === undefined) {
			this.sentFiles[sessionID] = {};
		}
		this.sentFiles[sessionID][file] = file;
	},
	containsFile: function (sessionID, file) {
		if (this.sentFiles[sessionID] === undefined) {
			return false;
		}
		if (this.sentFiles[sessionID][file] === undefined) {
			return false;
		}
		return true;
	},
	handleIndex: function (request, response, options) {
		if(options === undefined){
			options = {};
		}
		if (request.url === "/" || request.url === '/index.html') {
			request.url = "/index.html";
			
			var stream = fs.createReadStream(this.getPath(request.url));
			stream.on('error', function (error) {
				console.error("Caught", error);
				response.writeHead(200);
				response.end();
			});

			//generate a unique session token that does not exist yet
			var sessionID = this.generateSession();
			
			//add the session ID to each script file
			stream = stream.pipe(replaceStream(/(<script[\w\s]+src=")([^"]+)("[^\>]*><\/script>)/g, '$1$2?CACHE_ID='+sessionID+'$3'));
			
			//this is the variable that will be the session ID
			stream = stream.pipe(inject("window.CACHE_ID = '" + sessionID + "'", false));
			
			//this is the file that you can use to load modules
			stream = stream.pipe(inject("LoadModule.js?CACHE_ID=" + sessionID,true));
			
			if(options.extraScripts){
				options.extraScripts.forEach(function(script){
					stream = stream.pipe(inject(script+"?CACHE_ID=" + sessionID,true));
				});
			}
			if(options.extraScript){
				options.extraScript.forEach(function(scriptSRC){
					stream = stream.pipe(inject(scriptSRC,false));
				});
			}
			
			stream.pipe(response);
			return true;
		}
		return false;
	},
	
	/**
	 * Browserifies the content and sends it to the server
	 * 
	 * @param {type} file
	 * @param {type} sessionID
	 * @param {type} response
	 * @returns {undefined}
	 */
	browserify: function(file,sessionID,response){
		DepsModule.scan(file, function (files) {
			var pack = require('browser-pack')({raw: true, hasExports: true});
			files.forEach(function (file) {
				if (!this.containsFile(sessionID, file.id)) {
					this.registerFile(sessionID, file.id);
					pack.write(file);
				} else {
				}
			}.bind(this));
			pack.pipe(response);
			pack.end();
		}.bind(this));
	},
	
	getPath: function(url){
		//check for a mapping
		for(var i in this.settings.mappings){
			if(minimatch(url,i)){
				try{
					if(fs.lstatSync(this.settings.mappings[i]).isFile()){
						return this.settings.mappings[i];
					}else{
						return this.settings.mappings[i] + "/" + url;
					}
				}catch(ex){
					return this.settings.mappings[i] + "/" + url;
				}
			}
		}
		return url;
	},
	
	handleJavascript: function (request, response) {

		//we only care about javascript files
		var queryObject = url.parse(request.url, true);
		if (!queryObject.pathname.endsWith('.js')) {
			return false;
		}
		
		var path = this.getPath(queryObject.pathname);
		
		//variables from this request
		var sessionID = queryObject.query.CACHE_ID;

		//browserify the file without checking for dependencies
		if (sessionID !== undefined) {
			this.browserify(path,sessionID,response);
			return true;
		}

		return false;
	}
};