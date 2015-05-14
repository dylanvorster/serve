var loadScript = require("load-script");
var _merge = require("lodash/object/merge");

window.loadModule = function(file,cb){
	var f = file;
	var params = {
		CACHE_ID:window.CACHE_ID
	};
	if(typeof file === 'object'){
		f = file.file;
		params = _merge(params,file.params);
	}
	var final = f+"?";
	for(var i in params){
		final+="&"+i+"="+params[i];
	}
	loadScript(final,cb);
};