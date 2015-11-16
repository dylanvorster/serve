//library imports
var minimatch	= require("minimatch");
var Toolkit		= require("./Toolkit");
var path		= require("path");
var url			= require("url");
var fs			= require("fs");
var _			= require("lodash");
var serveStatic = require('connect-static-file');

//local imports
var DepsModule = require("./DepsModule");
var SessionModule = require("./SessionModule");

//get a logger
var logger = Toolkit.getLogger("Main Module");

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
		
		//session expiry time in minutes
		sessionExpire: 60,

		//extra javascript
		extraScript : [],

		//extra javascript files
		extraScripts : [],

		//these are first-class responders [function(queryObject){}] that are requested before the mappings are
		handlers : [],
		
		loglevel: 'INFO',
		
		//glob for the file serve
		mappings : {
			"/LoadModule.js" : __dirname + "/LoadModule.js"
		},

		//aliases for module paths
		aliases : {},
		
		//stuff passed into module deps
		deps:{
			bustCache: true,
			externalJSListener: {
				port: null,
				sockets: {}
			}
		}
	},

	/**
	 * Handles the serving of the index file
	 *
	 * @returns {Boolean}
	 */
	handleIndex : function (request, response, next) {
		
		//only handle the index
		var possibilities = ["/index.html","/index.htm","/"];
		if(possibilities.indexOf(request.url) === -1){
			next();
		}
		
		var content = fs.readFileSync(this.getPath(request.url)).toString();

		//generate a unique session token that does not exist yet
		var sessionID = SessionModule.generateSession();
		
		//templates for the scripts
		var generateExternalScript	= _.template('\n<script src="/${ file }?CACHE_ID=' + sessionID + '"></script>');
		var generateInlineScript	= _.template('\n<script>${ code }</script>');

		//these are scripts that get injected into the head
		var injectedScripts =
			//this is the variable that will be the session ID
			generateInlineScript({ code : 'window.CACHE_ID = "' + sessionID + '";' }) +
				//this is the file that you can use to load modules
			generateExternalScript({ file : 'LoadModule.js' });

		//extra script files to be injected
		injectedScripts += this.settings.extraScripts.reduce(function (prev, curr) {
			return prev + generateExternalScript({ file : curr });
		}, "");

		//extra script source code to be injected
		injectedScripts += this.settings.extraScript.reduce(function (prev, curr) {
			return prev + generateInlineScript({ code : curr });
		}, "");

		content =
			content.replace(/(<script[\w\s]+src=")([^"]+)("[^\>]*><\/script>)/g, '$1$2?CACHE_ID=' + sessionID +
			'$3');
		content = content.replace(/<head>/g, "<head>" + injectedScripts);

		//extra transforms for index.html's content
		if (this.settings.indexTransform) {
			content = this.settings.indexTransform(request, content);
		}
		response.write(content);
		response.end();
	},

	/**
	 * Handles the serving of the javascript
	 *
	 * @param {type} request
	 * @param {type} response
	 * @returns {Boolean}
	 */
	handleJavascript : function (request, response, queryObject) {
		var time = Date.now();
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
					if (!SessionModule.containsFile(sessionID, file.id)) {
						SessionModule.registerFile(sessionID, file.id);
						pack.write(file);
					}
				}.bind(this));

				logger.info("Serving: "+queryObject.pathname+" ("+(Date.now()-time)+"ms)");
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
	resolve : function (queryObject) {

		//first check the handlers to see if they can intercept
		for (var i = 0; i < this.settings.handlers.length; i++) {
			var data = this.settings.handlers[ i ](queryObject);
			if (data) {
				return data;
			}
		}

		//check the path mappings if the handlers could not deal with the request
		return this.getPath(queryObject.pathname);
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
		return false;
	}
};

/**
 * Handy method for serving all javascript and index requests
 */
module.exports.main = function (options) {

	//merges in options
	_.merge(module.exports.settings, options || {});
	
	Toolkit.loggers.forEach(function(logger){
		logger.setLevel(module.exports.settings.loglevel);
	});
	
	//start a thread to monitor sessions on the server and delete them if they expire
	setInterval(function(){
		SessionModule.purgeSessions(module.exports.settings.sessionExpire*1000*60);
	},1000*60);
	
	//start a middleware server to listen for host file changes
	if(module.exports.settings.deps.externalJSListener.port){
		logger.info("starting a cache busting port: "+module.exports.settings.deps.externalJSListener.port);
		var io = require('socket.io')(require('http').createServer());
		io.listen(module.exports.settings.deps.externalJSListener.port);
		module.exports.settings.deps.externalJSListener.io = io;
		
		io.on('connection',function(socket){
			logger.info('socket connected: '+socket.id);
			module.exports.settings.deps.externalJSListener.sockets[socket.id] = socket;

			socket.on('file-changed',function(file){
				delete DepsModule.moduleDepsCache[file];
				delete DepsModule.uglifyCache[file];
				logger.info(file+": changed");
			});
			
			socket.on('disconnect', function () {
				delete module.exports.settings.deps.externalJSListener.sockets[socket.id];
			});
		});
	}

	//sort the mappings according to absolute paths first
	return function (request, response, next) {

		if (request.method == "GET") {
			var parsedURL = url.parse(request.url, true),
			pathname = parsedURL.pathname,
			resolvedURL = module.exports.resolve(parsedURL);

			if (resolvedURL) {
				if ((resolvedURL.extname || path.extname(resolvedURL)) === '.html' || (resolvedURL.extname || path.extname(resolvedURL)) === '.htm') {
					logger.debug("trying to serve index: " + pathname);
					module.exports.handleIndex(request, response, next);
				} else if ((resolvedURL.extname || path.extname(resolvedURL)) === '.js') {
					response.setHeader('Content-Type', 'application/javascript');
					logger.debug("trying to serve javascript: " + pathname);
					module.exports.handleJavascript(request, response, parsedURL);
				} else if ((resolvedURL.extname || path.extname(resolvedURL)) === '.scss') {
					next()
				} else {
					logger.debug("trying to serve static file: " + pathname);
					serveStatic(resolvedURL, {})(request, response, next);
				}
			} else {
				next();
			}
		} else {
			next()
		}
	};
};

module.exports.processSCSS = function (options) {
	
	var autoprefixer = require("autoprefixer-core"),
		postcss = require("postcss"),
		sass = require("node-sass"),
		css = sass.renderSync(options.scss).css;
	return postcss([ autoprefixer ]).process(css).css;
};

module.exports.scss = function (options) {
	options = options || {};

	var defaults = {
		scss : {},
		error : function (err) {
			console.error(err);
		},
		autoprefixer : { browsers : [ '> 1%', 'IE 9' ] }
	};

	options = _.assign(defaults, options);
	return function (request, response, next) {
		var time = Date.now();
		var parsedURL = url.parse(request.url, true);
		var resolvedURL = module.exports.resolve(parsedURL);
		
		//only serve sass files
		if ((resolvedURL.extname || path.extname(resolvedURL)) === '.scss') {
			response.setHeader('Content-Type', 'text/css');
			logger.debug("Trying to serve SCSS: " + parsedURL.pathname);

			//file was requested
			if (typeof resolvedURL === 'string') {
				options.scss.file = resolvedURL;
			}
			//source code was given
			else {
				options.scss.data = resolvedURL.src;
			}

			var css = module.exports.processSCSS(options);

			//clean variables
			options.scss.file = null;
			options.scss.data = null;

			logger.info("Serving: "+parsedURL.pathname+" ("+(Date.now()-time)+"ms)");

			response.writeHead(200);
			response.write(css);
			response.end();
		} else {
			next();
		}
	};
};