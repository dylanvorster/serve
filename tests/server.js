var SessionModule = require("../"),
	compression = require('compression'),
	express = require('express'),
	fs = require('fs'),
	path = require('path'),
	app = express();

app.use(compression());
app.use(SessionModule.main({
	mappings : {
		"/index.html" : __dirname + "/../tests/index.html",
		"/+(a|d).js" : __dirname + "/../tests/js",
		"/*.scss" : __dirname + "/../tests/sass",
		"/test1.js"	  : function(url){
			return {src: "console.log('test1 worked');"};
		}
	},
	handlers: [
		function test2(queryObject){
			if(queryObject.pathname === '/test2.js'){
				return {src:"console.log('test2 worked');"};
			}
		},
		function test3(queryObject){
			if(queryObject.pathname === '/test3.js'){
				return __dirname+"/js2/test3.js";
			}
		}
	],
	aliases : {
		"react" : __dirname + "/../node_modules/react/dist/react.js"
	},
	deps : {
		uglify: {},
		moduleDeps : {
			//noParse : [ 'react', 'lodash' ]
		}
	}
}));
app.use(SessionModule.scss());
app.use(express.static(path.resolve(path.join(__dirname,'static'))));
app.listen(3000);
console.info("http started on port: 3000 from folder "+__dirname);