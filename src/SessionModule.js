var url				= require("url");
var fs				= require("fs");
var replaceStream	= require("replacestream");
var minimatch		= require("minimatch");
var _merge			= require("lodash/object/merge");
var autoprefixer	= require("autoprefixer-core");
var postcss			= require("postcss");
var logger			= require("log4js").getLogger("Serve Module"); 
var send			= require("send");
var path			= require("path");

//local imports
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
		//cache for the sentFiles
		sentFiles: {},
		
		//extra javascript
		extraScript: [],
		
		//extra javascript files
		extraScripts: [],
		
			
		//these are first-class responders [function(){}] that are requested before the mappings are
		handlers: [],
		
		//glob for the file serve
		mappings: {
			"/LoadModule.js":	__dirname + "/LoadModule.js"
		},
		
		//must storm-serve try serve static files if it cant run its dynamic serve?
		serveStatic: true,
		
		//aliases for module paths
		aliases: {},
	},
	
	/**
	 * Call this method to merge user settings with these settings
	 * 
	 * @param {type} options
	 * @returns {undefined}
	 */
	init: function(options){
		_merge(this.settings,options);
	},
	
	/**
	 * Generates a random hash
	 * @returns {String}
	 */
	generateUID: function () {
		function s4() {
			return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
		}
		return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
	},
	
	/**
	 * Generates a unique Session ID
	 * @returns {SessionModule_L49@call;generateUID}
	 */
	generateSession: function () {
		do {
			//keep generating a session key until we have a unique one
			var session = this.generateUID();
		} while (this.settings.sentFiles[session] !== undefined);
		
		logger.debug("generated session: "+session);

		return session;
	},
	registerFile: function (sessionID, file) {
		if (this.settings.sentFiles[sessionID] === undefined) {
			this.settings.sentFiles[sessionID] = {};
		}
		this.settings.sentFiles[sessionID][file] = file;
	},
	containsFile: function (sessionID, file) {
		if (this.settings.sentFiles[sessionID] === undefined) {
			return false;
		}
		if (this.settings.sentFiles[sessionID][file] === undefined) {
			return false;
		}
		return true;
	},
	
	/**
	 * Handy method for serving all sass, javascript and index requests
	 * @param {type} request
	 * @param {type} response
	 * @returns {Boolean}
	 */
	serve: function(request,response){
		
		//we only care about javascript files
		var pathname = url.parse(request.url, true).pathname;
		
		if(pathname === '/' || pathname.endsWith('.html')){
			logger.debug("trying to serve index: "+pathname);
			if(this.handleIndex(request,response)){
				return true;
			}
		}
		else if(pathname.endsWith('.scss')){
			logger.debug("trying to serve scss: "+pathname);
			if(this.handleSass(request,response)){
				return true;
			}
		}
		else if(pathname.endsWith('.js')){
			logger.debug("trying to serve javascript: "+pathname);
			if(this.handleJavascript(request,response)){
				return true;
			}
		}else if(this.settings.serveStatic){
			var newPath = this.getPath(pathname);
			logger.debug("trying to serve static: "+pathname +" => "+newPath);
			send(request, newPath)
				.on('error', function(err){
					logger.error("failed to serve static: "+err);
					response.statusCode = err.status || 500;
					response.end(err.message);
				})
				.pipe(response);
			return true;
		}
		return false;
	},
	
	/**
	 * Handles serving of the sass
	 * 
	 * @param {type} request
	 * @param {type} response
	 * @returns {undefined}
	 */
	handleSass: function(request,response){
		var sass = require('node-sass');
		sass.render({
		  file: this.getPath(request.url)
		}, function(err, result) {
			if(err){
				console.error(err);
				response.writeHead(500);
				response.end();
				return false;
			}
			
			//run it through autoprefixer
			postcss()
				.use( autoprefixer({ browsers: ['> 1%', 'IE 9'] }) )
				.process(result.css)
				.then(function(res){
					
					//stream it to the browser
					response.writeHead(200);
					response.write(res.css);
					response.end();
				});
			
		});
		return true;
	},
	/**
	 * Handles the serving of the index file
	 * 
	 * @param {type} request
	 * @param {type} response
	 * @param {type} options
	 * @returns {Boolean}
	 */
	handleIndex: function (request, response) {
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
			
			if(this.settings.extraScripts){
				this.settings.extraScripts.forEach(function(script){
					stream = stream.pipe(inject(script+"?CACHE_ID=" + sessionID,true));
				});
			}
			if(this.settings.extraScript){
				this.settings.extraScript.forEach(function(scriptSRC){
					stream = stream.pipe(inject(scriptSRC,false));
				});
			}
			
			stream.pipe(response);
			return true;
		}
		return false;
	},
	
	/**
	 * Handles the serving of the javascript
	 * 
	 * @param {type} request
	 * @param {type} response
	 * @returns {Boolean}
	 */
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
			DepsModule.scanJavascript(path, function (files) {
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
			}.bind(this),{aliases: this.settings.aliases });
			return true;
		}

		return false;
	},
	
	/**
	 * Helper function for getting the file requested, that might be linked to the
	 * path mappings defined in the init method.
	 * @param {type} url
	 * @returns {nm$_SessionModule.module.exports.settings.mappings|String}
	 */
	getPath: function(url){
		//check for a mapping
		for(var i in this.settings.mappings){
			if(minimatch(url,i)){
				var map = this.settings.mappings[i];
				
				//we have a handler
				if(typeof map === 'function'){
					logger.debug("using handler for: "+i);
					return map(url);
				}
				
				try{
					if(fs.lstatSync(map).isFile()){
						return path.resolve(map);
					}else{
						return path.resolve(map + "/" + url);
					}
				}catch(ex){
					return path.resolve(map + "/" + url);
				}
			}
		}
		return url;
	}
};