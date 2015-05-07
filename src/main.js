var http			= require('http');
var fs				= require('fs');
var serveStatic		= require('serve-static');
var finalhandler	= require('finalhandler');
var SessionModule	= require("./SessionModule");

SessionModule.init({
	mappings:{
		"/index.html":		__dirname + "/../tests/index.html",
		"/*.js":			__dirname + "/../tests/js"
	}
});

var serve = serveStatic('.', {'index': ['index.html', 'index.htm']});
var app = http.createServer(function handler(request, response) {
	
	console.log("asked for file: ", request.url);
	
	//first try to intercept the index and the javascript
	if(	!SessionModule.handleIndex(request,response) && 
		!SessionModule.handleJavascript(request,response)){

			//failing which we just serve the file normally
			var done = finalhandler(request, response);
			serve(request, response, done);
	}
});

app.listen(8888);
console.info("http started on port: 8888");