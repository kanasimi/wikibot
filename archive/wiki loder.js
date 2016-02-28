// 2015/3/5 21:13:4
// ** This file is private.

/*

// command line usage:
cd /d D:\USB\cgi-bin\program\wiki && node

// var CeL_path = 'S:\\cgi-bin\\lib\\JS';
require('./wiki loder.js');

*/

'use strict';

// ----------------------------------------------------------------------------

// https://wikitech.wikimedia.org/wiki/Help:Tool_Labs#How_can_I_detect_if_I.27m_running_in_Labs.3F_And_which_project_.28tools_or_toolsbeta.29.3F
// only for node.js.
global.wmflabs = require('fs').existsSync('/etc/wmflabs-project') && process.env.INSTANCENAME;


// ----------------------------------------------------------------------------
// For node.js loading. Copy/modified from "/_for include/node.loader.js".
// 載入泛用（非特殊目的使用）之功能。

(typeof CeL_path === 'string' ? CeL_path
		: 'C:\\USB\\cgi-bin\\lib\\JS|/home/www/cgi-bin/lib/JS')
//
.split('|')
//
.some(function(path) {
	if (path.charAt(0) !== '#' && require('fs').existsSync(path)) {
		var loader = '/_for include/node.loader.js';
		require(path
		//
		+ (path.indexOf('/') !== -1 ? loader : loader.replace(/\//g, '\\')));
		return true;
	}
});

if (typeof CeL === 'undefined' && wmflabs)
	require('cejs');

// ----------------------------------------------------------------------------

// CeL.set_debug(3);
CeL.run([ 'interact.DOM', 'application.debug', 'application.net.wiki' ]);

// ----------------------------------------------------------------------------

/** return {Object}wiki 操作子. */
Function('return this')().Wiki = function(login, API_URL) {
	if (!login)
		return new CeL.wiki(null, null, API_URL);

	// CeL.set_debug(3);
	var wiki = CeL.wiki.login('bot', '', {
		API_URL : API_URL,
		preserve_password : true
	});
	if (typeof check_section === 'string')
		wiki.check_options = {
			section : check_section
		};
	return wiki;
};

// ----------------------------------------------------------------------------
