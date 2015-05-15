var moduleDeps	= require("module-deps");
var shasum		= require("shasum");
var insert		= require("insert-module-globals");
var unique		= require("lodash/array/uniq");
var UglifyJS	= require("uglify-js");
var gaze		= require("gaze");
var path		= require("path");
var _			= require("lodash");
var logger		= require('log4js').getLogger("Module Deps"); 
var resolve		= require("browser-resolve");
var fs			= require("fs");

process.env.NODE_ENV = "production";
/**
 * @author Dylan Vorster
 */
module.exports = {
	
	//caches
	gazeCache:		{},
	depsCache:		{},
	uglifyCache:	{},
	
	getKeyForRequest: function(req){
		if(typeof req === 'object'){
			return req.src;
		}
		return req;
	},
	
	scanJavascript: function(file,cb,opts){
		
		opts = opts || {};
		var key = this.getKeyForRequest(file);
		
		//first check the cache
		if(this.depsCache[key] !== undefined){
			logger.debug("using deps cache for: "+key);
			cb(this.depsCache[key]);
			return;
		}
		logger.debug("building deps tree for: "+key);
		var md = moduleDeps({
			transformKey: [ 'browserify', 'transform' ],
			globalTransform:[
				
				//insert globals
				function(file) {
					return insert(file);
				}
				//<-register other transforms here
			],
			
			//custom resolve function
			resolve: function(id,o,callback){
				
				//run through our mappings first
				for(var i in opts.aliases){
					if(id === i){
						logger.debug("Using alias: "+i+" => "+opts.aliases[i]);
						callback(false,opts.aliases[i]);
						return;
					}
				}
				resolve(id,o,callback);
			}
		});
		var files = [];
		var hashes = {};
		md.on('data',function(row){
			
			//only watch each file once
			if(this.gazeCache[row.id] === undefined){
				this.gazeCache[row.id] = true;
				gaze(row.id, function(err, watcher) {
					watcher.on('changed', function(filepath) {
						logger.info(filepath + ' was changed');
						
						//bust child files
						for( var i in this.depsCache){
							var index = _.findIndex(this.depsCache[i], 'filename', filepath);
							if(index !== -1){
								logger.debug("busting child and parent cache: "+i);
								delete this.depsCache[i];
							}
						}
						//bust parent file
						if(this.depsCache[filepath] !== undefined){
							logger.debug("busting parent cache: "+filepath);
							delete this.depsCache[filepath];
						}
						
						//bust the uglify cache
						if(this.uglifyCache[filepath] !== undefined){
							logger.debug("busting uglify cache: "+filepath);
							delete this.uglifyCache[filepath];
						}
						
					}.bind(this));
				}.bind(this));
			}
			row.filename = row.id;
			hashes[row.id] = shasum(row.source);
			files.push(row);
		}.bind(this));
		md.on('end',function(){
			
			//remove duplicates
			files = unique(files,'source');
			
			files.forEach(function(file){
				//if it isnt uglified, then uglify it
				if(this.uglifyCache[file.id] === undefined){
					logger.debug("Uglifying: "+file.id);
					this.uglifyCache[file.id] = UglifyJS.minify(file.source, {fromString:true}).code;
				}
				file.source = this.uglifyCache[file.id];
				
				//convert everything to hashes
				file.id = hashes[file.id];
				Object.keys(file.deps).forEach(function (key) {
					file.deps[key] = hashes[file.deps[key]];
				});
			}.bind(this));
			
			this.depsCache[key] = files;
			cb(files);
		}.bind(this));
		
		//source was piped in directly
		if(file.src){
			md.end({ file: file.src, source: file.src, entry: true});
		}
		//file
		else{
			md.end({ file: file});
		}
	}
};
