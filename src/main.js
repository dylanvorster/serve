var http          = require('http'),
		SessionModule = require("./SessionModule"),
		compression   = require('compression'),
		express       = require('express'),
		app           = express();

app.use(compression());
app.use(SessionModule.main({
	mappings : {
		"/index.html" : __dirname + "/../tests/index.html",
		"/*.js"       : __dirname + "/../tests/js",
		"/*.scss"     : __dirname + "/../tests/sass"
	},
	aliases  : {
		"react" : __dirname + "/../node_modules/react/dist/react.js"
	}
}));
app.use(SessionModule.scss());
app.listen(3000);
console.info("http started on port: 8888");