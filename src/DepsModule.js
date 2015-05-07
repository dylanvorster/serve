var moduleDeps = require("module-deps");
var shasum = require("shasum");
process.env.NODE_ENV = "production";

module.exports = {
	cache: {},
	scan: function(file,cb){
		
		//first check the cache
		if(this.cache[file] !== undefined){
			cb(this.cache[file]);
			return;
		}
		
		
		var md = moduleDeps({transformKey: [ 'browserify', 'transform' ]});
		
		var files = [];
		var hashes = {};
		
		md.on('data',function(row){
			hashes[row.id] = shasum(row.source);
			files.push(row);
		});
		md.on('end',function(){
			files.forEach(function(file){
				file.id = hashes[file.id];

				Object.keys(file.deps).forEach(function (key) {
					file.deps[key] = hashes[file.deps[key]];
				});
			});
			this.cache[file] = files;
			cb(files);
		}.bind(this));
		md.end({ file: file});
	}
};