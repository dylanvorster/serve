var log4js = require("log4js");
/**
 * Set of Helper Tools
 */
module.exports = {
	loggers: [],
	
	/**
	 * Generate a Logger
	 * @param {type} name
	 * @returns {module.exports.getLogger.logger}
	 */
	getLogger: function(name){
		var logger = log4js.getLogger(name);
		this.loggers.push(logger);
		return logger;
	},
	
	/**
	 * Generates a random hash
	 * @returns {String}
	 */
	generateUID : function () {
		function s4() {
			return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
		}

		return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
	}
};