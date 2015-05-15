var http          = require('http'),
	SessionModule = require("../"),
	compression   = require('compression'),
	express       = require('express'),
	app           = express();

app.use(compression());
app.use(SessionModule.main({
	mappings : {
		"/index.html" : __dirname + "/../tests/index.html",
		"/*.js"       : __dirname + "/../tests/js",
		"/*.scss"     : __dirname + "/../tests/sass",
		"/test1.js"	  : function(url){
			return {src: "console.log('test1 worked');"};
		}
	},
	handlers: [
		function test2(queryObject){
			if(queryObject.pathname === '/test2.js'){
				return {src:"console.log('test2 worked');"};
			}
		}
	],
	aliases  : {
		"react" : __dirname + "/../node_modules/react/dist/react.js"
	}
}));
app.use(SessionModule.scss());
app.listen(3000);
console.info("http started on port: 3000");