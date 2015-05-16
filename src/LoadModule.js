var loadScript = require("load-script");
var _merge = require("lodash/object/merge");

/**
 * Loads Javascript modules into the browser
 * @param {type} file
 * @param {type} cb
 * @returns {undefined}
 */
window.loadModule = function(file,cb){
	var f = file;
	var params = {
		CACHE_ID:window.CACHE_ID
	};
	if(typeof file === 'object'){
		f = file.file;
		params = _merge(file.params,params);
	}
	var final = f+"?";
	for(var i in params){
		final += "&"+i+"="+params[i];
	}
	loadScript(final,cb);
};