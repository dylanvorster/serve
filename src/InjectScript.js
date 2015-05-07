var trumpet = require('trumpet');
var duplexer = require('duplexer');
var through = require('through');

module.exports = function inject(src, path) {
	if (path === undefined) {
		path = true;
	}
	var tr1 = trumpet();
	var tr2 = trumpet();
	var script = path ? '<script type=\"text/javascript\" src="' + src + '"><\/script>\n' : '<script>' + src + '</script>';
	var bodyTag = tr2.createStream('head');

	// insert the script before the closing </body> tag
	bodyTag
		.pipe(through(null,
			function () {
				this.queue(script);
				this.queue(null);
			}))
		.pipe(bodyTag);

	tr1.pipe(tr2);

	return duplexer(tr1, tr2);
};