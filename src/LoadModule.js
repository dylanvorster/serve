var loadScript = require("load-script");

window.loadModule = function(file,cb){
	loadScript(file+"?CACHE_ID="+window.CACHE_ID,cb);
};