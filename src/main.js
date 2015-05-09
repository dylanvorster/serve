var http			= require('http');
var SessionModule	= require("./SessionModule");

SessionModule.init({
	mappings:{
		"/index.html":	__dirname + "/../tests/index.html",
		"/*.js":		__dirname + "/../tests/js",
		"/*.scss":		__dirname + "/../tests/sass"
	}
});

var app = http.createServer(function handler(request, response) {
	SessionModule.serve(request,response);
});

app.listen(8888);
console.info("http started on port: 8888");