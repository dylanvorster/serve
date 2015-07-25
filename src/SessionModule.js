var Toolkit = require("./Toolkit");
var logger = Toolkit.getLogger("Serve Module");
/**
 * This module is responsible for storing Sessions and working with them
 * 
 * @author Dylan Vorster
 */
module.exports = {
	
	//variables
	sessions: {},
	
	purgeSessions: function(expiryTime){
		logger.debug("Running Session Purge");
		var now = Date.now();
		Object.keys(this.sessions).forEach(function(key){
			if(now - this.sessions[key].timestamp > expiryTime){
				delete this.sessions[key];
				logger.info("Session Expired: "+key);
			}
		}.bind(this));
	},

	/**
	 * creates a session
	 * @returns {String}
	 */
	generateSession : function () {
		do {
			//keep generating a session key until we have a unique one
			var session = Toolkit.generateUID();
		} while (this.sessions[session] !== undefined);

		//put the session in the DB
		this.sessions[session] = {files: {},timestamp : Date.now()};

		logger.debug("generated session: " + session);

		return session;
	},
	getSession: function(sessionID){
		if(this.sessions[sessionID]){
			return this.sessions[sessionID];
		}
		return null;
	},
	touchSession: function(sessionID){
		var session = this.getSession(sessionID);
		if (session) {
			session.timestamp = Date.now();
		}
	},
	registerFile : function (sessionID, file) {
		var session = this.getSession(sessionID);
		if (session) {
			session.files[file] = file;
		}
	},
	containsFile : function (sessionID, file) {
		var session = this.getSession(sessionID);
		if (session) {
			return this.sessions[sessionID].files[file] !== undefined;
		}
		return false;
	}
};