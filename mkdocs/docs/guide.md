#Getting Started

The simplest way to get started with storm serve, is with the following directory structure:

## Directory structure

```
server.js
index.html
package.json

node_modules
	<moduleshere>
media
	logo.png
sass
	style.scss
modules
	main.js
```

### index.html
```html
<!DOCTYPE html>
<html>
    <head>
        <title>My First Storm Website</title>
		<meta charset="utf-8">
		<script src="main.js"></script>
		<link rel="stylesheet" href="main.scss"/>
    </head>
    <body>
		<img src="logo.png">
	</body>
</html>
```

### server.js

```javascript
var StormServe	= require("storm-serve");
var express		= require('express');

var app = express();

//serve javascript and index.html
app.use(StormServe.main({

	mappings:{
		"/index.html":	__dirname + "/index.html",
		"/*.js":		__dirname + "/javascript",
		"/*.scss":		__dirname + "/sass",
	},
}));
//serve css (that is converted from sass)
app.use(StormServe.scss());

//serve static files like images
app.use(express.static(path.resolve(__dirname+"/media")));

//start the server on port 80
app.listen(8080);
```

### main.js

```
var react = require("react")
window.onload = function(){
	React.render(React.DOM.h1(null,'Hello World!'),document.body)
}
```

### style.scss
```sass
*{
	margin: 0;
	padding: 0;
}

body{
	display: flex; //this is run through auto prefixer
}
```

## Next Steps

run this on your machine

```node server.js //this starts the web server```

and then open up your browser to 

```http://localhost:8080```

Now wait while storm serve, compiles your website, and then eventually loads. After that perform a refresh and the site should load blazingly fast.

### So what happened

In this order, your browser will:

- Serve the index file which will:
	* Be injected with a window-variable used to identify this instance of the browser tab
	* Inject a script which allows you to call window.loadModule
	* Rewrite the links of all your script assets to include the window-variable

- Request main.scss and this will be redirected internally to /sass/main.scss which will then:
	* Be converted to sass
	* Run through auto prefixer

- Request main.js and this will be redirected internally to /javascript/main.js which will then:
	* be run through a supercharged browserify pipeline
	* apply any source transformations
	* map the filenames to a hashed version of each files contents
	* rewrite the requires(), so that they point to the hashed filenames
	* serve the ES5 script to the browser