var url = require("url");
var fs = require("fs");
var replaceStream = require("replacestream");
var minimatch = require("minimatch");
var _ = require("lodash");
var logger = require("log4js").getLogger("Serve Module");
var send = require("send");
var path = require("path");
//var router = (require('express'))().Router();

//local imports
var DepsModule = require("./DepsModule");
var inject = require("./InjectScript");

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
		sentFiles    : {},

		//extra javascript
		extraScript  : [],

		//extra javascript files
		extraScripts: [],
		
			
		//these are first-class responders [function(){}] that are requested before the mappings are
		handlers: [],
		
		//glob for the file serve
		mappings: {
			"/LoadModule.js" : __dirname + "/LoadModule.js"
		},

		//must storm-serve try serve static files if it cant run its dynamic serve?
		serveStatic  : true,

		//aliases for module paths
		aliases      : {}
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
	registerFile    : function (sessionID, file) {
		if (this.settings.sentFiles[ sessionID ] === undefined) {
			this.settings.sentFiles[ sessionID ] = {};
		}
		this.settings.sentFiles[ sessionID ][ file ] = file;
	},
	containsFile    : function (sessionID, file) {
		if (this.settings.sentFiles[ sessionID ] === undefined) {
			return false;
		}
		if (this.settings.sentFiles[ sessionID ][ file ] === undefined) {
			return false;
		}
		return true;
	},
	
	/**
	 * Handles the serving of the index file
	 *
	 * @returns {Boolean}
	 */
	handleIndex : function (request, response) {
		if (request.url === "/" || request.url === '/index.html') {
			request.url = "/index.html";
			var stream = fs.createReadStream(this.getPath(request.url));
			stream.on('error', function (error) {
				console.error("Caught", error);
				response.writeHead(500);
				response.end();
			});

			//generate a unique session token that does not exist yet
			var sessionID = this.generateSession();

			//add the session ID to each script file
			stream =
				stream.pipe(replaceStream(/(<script[\w\s]+src=")([^"]+)("[^\>]*><\/script>)/g, '$1$2?CACHE_ID=' + sessionID +
				'$3'));

			//this is the variable that will be the session ID
			stream = stream.pipe(inject("window.CACHE_ID = '" + sessionID + "'", false));

			//this is the file that you can use to load modules
			stream = stream.pipe(inject("LoadModule.js?CACHE_ID=" + sessionID, true));

			if (this.settings.extraScripts) {
				this.settings.extraScripts.forEach(function (script) {
					stream = stream.pipe(inject(script + "?CACHE_ID=" + sessionID, true));
				});
			}
			if (this.settings.extraScript) {
				this.settings.extraScript.forEach(function (scriptSRC) {
					stream = stream.pipe(inject(scriptSRC, false));
				});
			}

			stream.pipe(response);
		}

	},

	/**
	 * Handles the serving of the javascript
	 *
	 * @param {type} request
	 * @param {type} response
	 * @returns {Boolean}
	 */
	handleJavascript : function (request, response) {

		//we only care about javascript files
		var queryObject = url.parse(request.url, true);
		if (path.extname(queryObject.pathname) != '.js') {
			//next()
			return false;
		}
		var pth = this.getPath(queryObject.pathname);

		//variables from this request
		var sessionID = queryObject.query.CACHE_ID;

		//browserify the file without checking for dependencies
		if (sessionID !== undefined) {
			DepsModule.scanJavascript(pth, function (files) {
				var pack = require('browser-pack')({
					raw        : true,
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
			}.bind(this), { aliases : this.settings.aliases });

		}
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
				if (typeof this.settings.mappings[i] === 'function') {
					logger.debug("using handler for: " + url);
					return this.settings.mappings[i](url);
				}
				
				//next check if it is an absolute path
				if(this.settings.mappings[i].match(/.*\.[^\.\/]*$/)){
					logger.debug("using absolute path for: " + url);
					return path.resolve(this.settings.mappings[i]);
				}
			}
		}
	
		//2nd in line is the path mapping
		for (var i in this.settings.mappings) {
			if (minimatch(url, i)) {
				var resolved =  path.resolve(this.settings.mappings[i] + "/" + url);
				logger.debug("resolved: "+url+" to: "+resolved);
				return resolved;
			}
		}
		return url;
	}
};

/**
 * Handy method for serving all javascript and index requests
 */
module.exports.main = function(options) {
	
	//merges in options
	_.merge(module.exports.settings, options || {});
	
	//sort the mappings accoring to absolute paths first
	logger.debug(module.exports.settings)
	return function (request, response, next) {
		//we only care about javascript files
		var pathname = url.parse(request.url, true).pathname;

		if (pathname === '/' || path.extname(pathname) == '.html') {
			logger.debug("trying to serve index: " + pathname);
			module.exports.handleIndex(request, response);
		} else if (path.extname(pathname) == '.js') {
			response.setHeader('Content-Type', 'application/javascript');
			logger.debug("trying to serve javascript: " + pathname);
			module.exports.handleJavascript(request, response)
		} else {
			next();
		}
	}
};

module.exports.scss = function (options) {
	options = options || {};
	var autoprefixer = require("autoprefixer-core"),
			postcss = require("postcss"),
			sass = require("node-sass"),
			defaults = {
				scss         : {},
				error        : function () {},
				autoprefixer : { browsers : [ '> 1%', 'IE 9' ] }
			};
	options = _.assign(defaults, options);
	return function (request, response, next) {
		var pathname = url.parse(request.url, true).pathname;
		if (path.extname(pathname) === '.scss') {
			response.setHeader('Content-Type', 'text/css');
			options.scss.file = module.exports.getPath(request.url);
			sass.render(options.scss, function (err, result) {
				if (err) {
					options.error(err, response);
					next();
					return false;
				}

				postcss()
					.use(autoprefixer(options.autoprefixer))
					.process(result.css)
					.then(function (res) {
						response.writeHead(200);
						response.write(res.css);
						response.end();
					});
			});
		} else {
			next();
		}
	}
}
