# Handlers

In some cases, we need more than a file glob match to perform a function. For this purpose,
STORM Serve allows you to register handlers (for example):

``` javascript
handlers:[
	function (queryParams) {
		if (queryParams.pathname === 'somefile.js' && queryParams.query.ID) {
			return __dirname+"/somefile.js";
		}
	}
]
```

When working with handlers, you can return a file that will be served, or you can return an object containing
__src__ and __extname__ fields. Returning an object will allow you to return actual source code and specify what type of code it is.
This means you can return sass or javascript code directly, and it will be browserified or converted to sass.

## Why is this useful?

In some rare cases, you might find yourself having to return sass code that might be contained in a namespace (for example:)

``` javascript
handlers:[
	function (queryParams) {
		if (path.extname(queryParams.pathname) === '.scss' && queryParams.query.ID) {
			var code = fs.readFileSync(decodeURI(queryParams.pathname));

			//wrap the code in a class (browser requested namespaced css)
			return {
				src: '.' + queryParams.query.FACTORY_ID + '{' + code + "}",
				extname: '.scss'
			};
		}
	}
]
```

Whatever the reason, if a mapping is not good-enough, use a handler and do the checks on the queryParams yourself.

# Mappings

Mappings are like a simple way to use handlers (see above), there are a number of ways to use mappings:

```javascript
mappings : {
	//point a mapping to an absolute file
	"/index.html" : __dirname + "/../tests/index.html",

	//only allow a or d, (and then append the incoming request)
	"/+(a|d).js" : __dirname + "/../tests/js",

	//all sass files get send to the sass dir
	"/*.scss" : __dirname + "/../tests/sass",

	//use a handler for this file glob (works like the above handlers)
	"/test1.js"	  : function(url){
		return {src: "console.log('test1 worked');", extname:'.js'};
	}
},
```

# Index Transform / Isomorphic Websites

When building isomorphic applications, you will want to do server side rendering. 
In this case, provide an index transform, which is run just before STORM servers the __index__ file.

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
		<%= react %>
	</body>
</html>
```

```javascript
indexTransform: function(request,content){

	//required for react to work
	process.env.NODE_ENV = 'development';

	var data = {
		react: React.renderToString(React.DOM.h1(null,"Hello World"))
	};

	return (_.template(content))(data);
},
```

# Control the dependency tree

If you want to have tighter control over our custom browserify pipeline,
you can pass in options to the exposed services using the __deps__ key.

npm libraries that are exposed are:

* __uglify__ : Uglify JS
* __moduleDeps__ : Module Deps (Browserify)
* __chokidar__ : Chokidar (we use this for watching files to bust cache)


```javascript
deps : {
	//turn on/off uglify or pass in options
	uglify: false || { <optionsForUglifyJS> },
	
	//pass additional options to Module Deps (the browserify pipeline)
	moduleDeps:{
		noParse : ['react'],
	}
}
```

# Aliases

If you want to force STORM Serve to use a particular file when doing a require(), you can override this here.

```javascript
aliases: {
	"react/addons" : __dirname + "/../node_modules/react/dist/react-with-addons.js",
	"react" :		 __dirname + "/../node_modules/react/dist/react-with-addons.js",

	//this is useful if you want to simply call require("MyApplication"); anywhere within your app
	"MyApplication": __dirname + "/some/dir/app.js"
},
```

Aliases are useful for building sites that use plugins, or where there are many files, and you want to avoid require("../../../../")
Aliases are also useful if you want to prevent the Dependency engine from crawling a massive library like React. In this case,
its much more efficient to point "react" to the minified library.

# Docker / Remote Filesystems

Storm serve watches every javascript file that in the debs tree, and when the file changes, it busts the cache.
The problem is, on some remote file systems, this does not happen fast enough, because the filesystem does not trigger
the fs event required to bust the cache, While this is not a problem in production, this can make it complicated
to work with docker.

For this purposes, there is a standlone node script you can run on your host machine. The idea is to watch for changes on your host
machine and then remotely tell STORM Serve that the file has changed (Here we assume you are mounting the files into your remote file system using
something like NFS).


## Docker and docker-compose

Simply run:

```bash

node container-node/node_modules/storm-serve/src/HostWatcher.js \
	--host http://docker.local:8092 \
	--dockerComposeFile docker-compose.yml 
	--dockerComposeKey node
```

Where __host__ is the address and port of the middleware,
__dockerComposeFile__ is the name of your compose file and
__dockerComposeKey__ is the name of your container that is running storm-serve