var url = require("url");
var fs = require("fs");
var replaceStream = require("replacestream");
var minimatch = require("minimatch");
var _ = require("lodash");
var logger = require("log4js").getLogger("Serve Module");
var path = require("path");

//local imports
var DepsModule = require("./DepsModule");

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
	settings : {
		
		//cache for the sentFiles
		sentFiles : {},

		//extra javascript
		extraScript : [],

		//extra javascript files
		extraScripts : [],

		//these are first-class responders [function(queryObject){}] that are requested before the mappings are
		handlers : [],

		//glob for the file serve
		mappings : {
			"/LoadModule.js" : __dirname + "/LoadModule.js"
		},

		//must storm-serve try serve static files if it cant run its dynamic serve?
		serveStatic : true,

		//aliases for module paths
		aliases : {}
	},

	/**
	 * Generates a random hash
	 * @returns {String}
	 */
	generateUID : function () {
		function s4() {
			return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
		}

		return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
	},

	/**
	 * Generates a unique Session ID
	 * @returns {SessionModule_L49@call;generateUID}
	 */
	generateSession : function () {
		do {
			//keep generating a session key until we have a unique one
			var session = this.generateUID();
		} while (this.settings.sentFiles[ session ] !== undefined);

		logger.debug("generated session: " + session);

		return session;
	},
	registerFile : function (sessionID, file) {
		if (this.settings.sentFiles[ sessionID ] === undefined) {
			this.settings.sentFiles[ sessionID ] = {};
		}
		this.settings.sentFiles[ sessionID ][ file ] = file;
	},
	containsFile : function (sessionID, file) {
		if (this.settings.sentFiles[ sessionID ] === undefined) {
			return false;
		}
		return this.settings.sentFiles[ sessionID ][ file ] !== undefined;
		
	},

	/**
	 * Handles the serving of the index file
	 *
	 * @returns {Boolean}
	 */
	handleIndex : function (request, response, next) {
		if (request.url === "/" || request.url === '/index.html') {
			request.url = "/index.html";
			var content = fs.readFileSync(this.getPath(request.url)).toString();

			//generate a unique session token that does not exist yet
			var sessionID = this.generateSession(),
				generateExternalScript = _.template('\n<script src="${ file }?CACHE_ID='+sessionID+'"></script>'),
				generateInlineScript = _.template('\n<script>${ code }</script>'),
				injectedScripts =
					//this is the variable that will be the session ID
					generateInlineScript({code : 'window.CACHE_ID = "' + sessionID + '";'}) +
						//this is the file that you can use to load modules
					generateExternalScript({file : 'LoadModule.js'});

			//extra script files to be injected
			injectedScripts += this.settings.extraScripts.reduce(function (prev, curr) {
				return prev + generateExternalScript({file: curr});
			}, "");

			//extra script source code to be injected
			injectedScripts += this.settings.extraScript.reduce(function (prev, curr) {
				return prev + generateInlineScript({code: curr});
			}, "");


			content = content.replace(/(<script[\w\s]+src=")([^"]+)("[^\>]*><\/script>)/g, '$1$2?CACHE_ID=' + sessionID + '$3');
			content = content.replace(/<head>/g, "<head>"+injectedScripts);

			//extra transforms for index.html's content
			if(this.settings.indexTransform) {
				content = this.settings.indexTransform(content);
			}
			response.write(content);
			response.end();
			next();
		}
	},

	/**
	 * Handles the serving of the javascript
	 *
	 * @param {type} request
	 * @param {type} response
	 * @returns {Boolean}
	 */
	handleJavascript : function (request, response,queryObject) {

		//we only care about javascript files
		var resultingObject = this.resolve(queryObject);

		//now check the file
		if (typeof resultingObject === 'string') {
			try {
				fs.lstatSync(resultingObject);
			} catch (ex) {
				response.writeHead(404);
				response.end();
			}
		}

		//variables from this request
		var sessionID = queryObject.query.CACHE_ID;

		//browserify the file without checking for dependencies
		if (sessionID !== undefined) {
			
			DepsModule.scanJavascript(resultingObject, function (files) {
				var pack = require('browser-pack')({
					raw : true,
					hasExports : true
				});
				files.forEach(function (file) {
					if (!this.containsFile(sessionID, file.id)) {
						this.registerFile(sessionID, file.id);
						pack.write(file);
					}
				}.bind(this));

				pack.pipe(response);
				pack.end();
			}.bind(this), _.assign(this.settings.deps, { aliases : this.settings.aliases }));

		}
	},
	
	/**
	 * Resolves the queryObject through the handlers and the path mappings
	 * 
	 * @param {type} queryObject
	 */
	resolve: function(queryObject){
		var resultingObject = null;

		//first check the handlers to see if they can intercept
		for (var i = 0; i < this.settings.handlers.length; i++) {
			var data = this.settings.handlers[ i ](queryObject);
			if (data) {
				resultingObject = data;
				break;
			}
		}

		//check the path mappings if the handlers could not deal with the request
		if (resultingObject === null) {
			resultingObject = this.getPath(queryObject.pathname);
		}
		return resultingObject;
	},

	/**
	 * Helper function for getting the file requested, that might be linked to the
	 * path mappings defined in the init method.
	 * @param {String} url
	 * @returns {nm$_SessionModule.module.exports.settings.mappings|String}
	 */
	getPath : function (url) {

		//first responders are absolute paths or functions
		for (var i in this.settings.mappings) {

			if (minimatch(url, i)) {

				//first check if its a handler
				if (typeof this.settings.mappings[ i ] === 'function') {
					logger.debug("using handler for: " + url);
					return this.settings.mappings[ i ](url);
				}

				//next check if it is an absolute path
				if (this.settings.mappings[ i ].match(/.*\.[^\.\/]*$/)) {
					logger.debug("using absolute path for: " + url);
					return path.resolve(this.settings.mappings[ i ]);
				}
			}
		}

		//2nd in line is the path mapping
		for (var i in this.settings.mappings) {
			if (minimatch(url, i)) {
				var resolved = path.resolve(this.settings.mappings[ i ] + "/" + url);
				logger.debug("resolved: " + url + " to: " + resolved);
				return resolved;
			}
		}
		return url;
	}
};

/**
 * Handy method for serving all javascript and index requests
 */
module.exports.main = function (options) {

	//merges in options
	_.merge(module.exports.settings, options || {});

	//sort the mappings accoring to absolute paths first
	return function (request, response, next) {
		
		var parsedURL = url.parse(request.url, true);
		//we only care about javascript files
		var pathname = parsedURL.pathname;

		if (pathname === '/' || path.extname(pathname) === '.html') {
			logger.debug("trying to serve index: " + pathname);
			module.exports.handleIndex(request, response, next);
		} else if (path.extname(pathname) === '.js') {
			response.setHeader('Content-Type', 'application/javascript');
			logger.debug("trying to serve javascript: " + pathname);
			module.exports.handleJavascript(request, response, parsedURL);
		} else {
			next();
		}
	};
};

module.exports.scss = function (options) {
	options = options || {};
	
	var autoprefixer	= require("autoprefixer-core"),
		sass			= require("node-sass"),
		defaults = {
			scss : {},
			error : function (err) {
				console.error(err);
			},
			autoprefixer : { browsers : [ '> 1%', 'IE 9' ] }
		};
		
	options = _.assign(defaults, options);
	return function (request, response, next) {
		var parsedURL = url.parse(request.url, true);
		if (path.extname(parsedURL.pathname) === '.scss') {
			response.setHeader('Content-Type', 'text/css');
			
			
			var finalData = module.exports.resolve(parsedURL);
			
			//file was requested
			if(typeof finalData === 'string'){
				options.scss.file = finalData;
			}
			//source code was given
			else{
				options.scss.data = finalData.src;
			}
			var css = sass.renderSync(options.scss).css;
			css = autoprefixer.process(css, options.autoprefixer).css
			response.writeHead(200);
			response.write(css);
			response.end();
		} else {
			next();
		}
	};
};