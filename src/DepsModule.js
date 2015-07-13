var moduleDeps	= require('module-deps');
var shasum		= require('shasum');
var insert		= require('insert-module-globals');
var unique		= require('lodash/array/uniq');
var UglifyJS	= require('uglify-js');
var chokidar	= require('chokidar');
var _			= require('lodash');
var logger		= require('log4js').getLogger('Module Deps');
var resolve		= require('browser-resolve');
var path		= require('path');


/**
 * @author Dylan Vorster
 */
module.exports = {

	//caches
	gazeCache:		{},
	uglifyCache:	{},
	cache:			{},
	watcher:		null,

	scanJavascript : function (file, cb, opts) {
		opts = opts || {};
		
		process.env.NODE_ENV = (opts.production === false) ? 'development' : 'production';
		
		var moduleDepsDefaults = {
			cache:				this.cache,
			transformKey :		['browserify', 'transform'],
			globalTransform :	[
				//insert globals
				function (file) {  
					return insert(file); 
				}
				//<-register other transforms here
			],

			//custom resolve function
			resolve : function (id, o, callback) {

				//run through our mappings first
				for (var i in opts.aliases) {
					if (id === i) {
						logger.debug("Using alias: " + i + " => " + path.resolve(opts.aliases[ i ]));
						callback(false, path.resolve(opts.aliases[ i ]));
						return;
					}
				}
				resolve(id, o, callback);
			}
		};
		
		var chokidarDefaults = {
			ignored:		/[\/\\]\./,
			persistent:		true,
			usePolling:		true,
			interval:		700,
			useFsEvents:	false,
			ignoreInitial:	true
		};
		
		//merge in the options
		_.merge(moduleDepsDefaults, opts.moduleDeps);
		_.merge(chokidarDefaults, opts.chokidar);
		
		logger.debug("building deps tree for: " + file);
		var md = moduleDeps(moduleDepsDefaults);
		
		var files	= [];
		var hashes	= {};
		md.on('data', function (row) {
			var id			= row.id;
			this.cache[id]	= _.clone(row,true);
			
			//only watch each file once
			if (this.gazeCache[row.id] === undefined) {
				this.gazeCache[row.id] = true;
				
				if (!this.watcher) {
					this.watcher = chokidar.watch(row.id, chokidarDefaults);
					
					this.watcher.on('change', function (path) {
						logger.info(path + ' was changed');
						delete this.cache[path];
						delete this.uglifyCache[path];
					}.bind(this));
				} else {
					this.watcher.add(row.id);
				}
			}
			
			row.filename		= row.id;
			hashes[ row.id ]	= shasum(row.source);
			files.push(row);
		}.bind(this));
		
		md.on('end', function () {
			
			//remove duplicates
			files = unique(files, 'source');
			files.forEach(function (file) {
				
				//json needs this
				if(path.extname(file.filename) === '.json'){
					file.source = 'module.exports = '+file.source;
				}
				
				if (opts.uglify) {
					
					//if it isnt uglified, then uglify it
					if (this.uglifyCache[ file.id ] === undefined) {
						logger.debug("Uglifying: " + file.id);
						//var uglifyOptions = _.assign({ fromString : true }, typeof opts.uglify == 'Object' ?
						// opts.uglify : {})
						var uglifyOptions = { fromString : true };
						this.uglifyCache[ file.id ] = UglifyJS.minify(file.source, uglifyOptions).code;
					}
					file.source = this.uglifyCache[ file.id ];
				}

				//convert everything to hashes
				file.id = hashes[ file.id ];
				Object.keys(file.deps).forEach(function (key) {
					file.deps[ key ] = hashes[ file.deps[ key ] ];
				});
			}.bind(this));
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
