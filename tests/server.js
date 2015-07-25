var SessionModule = require("../"),
	compression = require('compression'),
	express = require('express'),
	fs = require('fs'),
	path = require('path'),
	app = express(),
	React = require("react"),
	_ = require("lodash");

app.use(compression());
app.use(SessionModule.main({
	/*
	 * @required
	 */
	mappings : {
		"/index.html" : __dirname + "/../tests/index.html",
		"/+(a|d).js" : __dirname + "/../tests/js",
		"/*.scss" : __dirname + "/../tests/sass",
		"/test1.js"	  : function(url){
			return {src: "console.log('test1 worked');", extname:'.js'};
		}
	},
	/*
	 * @optional
	 */
	indexTransform: function(request, content){
		
		//required for react to work
		process.env.NODE_ENV = 'development';
		var data = {
			react : React.renderToString(React.DOM.img({src:"logo.png"}))
		};
		return (_.template(content))(data);
	},
	/*
	 * @optional
	 */
	handlers: [
		function test2(queryObject){
			if(queryObject.pathname === '/test2.js'){
				return {src:"console.log('test2 worked');", extname: '.js'};
			}
		},
		function test3(queryObject){
			if(queryObject.pathname === '/test3.js'){
				return __dirname+"/js2/test3.js";
			}
		}
	],
	/*
	 * @optional
	 */
	aliases : {
//		"react" : __dirname + "/../node_modules/react/dist/react.js"
	},
	loglevel: 'DEBUG',
	/*
	 * @optional
	 */
	deps : {
		bustCache: false,
		externalJSListener: {
			port: 8889
		},
		
		uglify: {},
		moduleDeps : {}
	}
}));
app.use(SessionModule.scss());
app.use(express.static(path.resolve(path.join(__dirname,'static'))));

app.listen(8888);