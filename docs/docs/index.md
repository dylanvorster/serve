# Welcome to STORM Serve

STORM Serve is a web server written in Node that solves a lot of problems associated
with building javascript web applications.

## STORM serve can do the following:

* Serve sass that is auto-prefixed
* Serve Javascript modules and track dependencies of a site per browser tab
* Uglify resulting javascript for high performance websites
* Provide Aliases for code in module files, allowing for plugin based architecture in your application
* Allow for the creation of Isomorphic Websites via the use of an indexTransform
* Automatically watch Javascript files and bust modules which have already been compiled.
* Provide simple glob matching to redirect requests to paths, or to custom handlers (see below)
* Allow you to create custom handlers that can be run on compiled Javascript and SASS code before it is served.

## Whoa thats a lot of stuff, break it down for me!

In a nuthshell, STORM Serve is like __browserify on steroids as middleware for express__ with the ability to track which files you have already been served.
Traditionaly, when using browserify, you generate static files, and your entire application is served in one go. But what happens
when you need to build much larger sites, and you would prefer to live-load that code as the user starts browsing?

Well thats where you would usually turn to libraries like browserify-factorify to sperate your code into chunks. This in itself is problematic
and is not a good solution to the problem esepcially when you are building modular software and are not sure what plugins/modules are going to be loaded.
Take this directory structure for example:

```
site core
	page1.js (react)
	page2.js (react,D3)
	page3.js (react,D3)
	page4.js (react)

plugins
	plugin1
		page5.js (react)
		page6.js (react,D3,angular)
	plugin2
		page7.js (react)
		page8.js (react,D3)
```

In the above example, we have the core site, which has its pages that all use react, but we also have some plugins that use react.
Ontop of that, page 6 in plugin 1 uses angular, and that page might only be loaded if you are an admin.

Therefore we can make some assumptions:

* It is not a good idea to browserify the entire site into one big bundle, because we send unnesesary amounts of possibly large code
* We still want to be able to write in modules, and use require("react") in every page
* We dont want to send over react every single time the user loads a different page (ReactClass) 