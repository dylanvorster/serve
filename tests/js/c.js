var React = require("react");

module.exports = {
	fetchD: function(){
		window.onload = function(){
			window.loadModule("d.js");
		};
	},
	confirmDLoaded: function(){
		console.log("loaded d");
	}
};

console.log("loaded c");