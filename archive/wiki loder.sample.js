// 2015/3/5 21:13:4
// ** This file is private.

/*

 // command line usage:
 cd /d D:\USB\cgi-bin\program\wiki && node

 require('./wiki loder.js');

 */

'use strict';

// ----------------------------------------------------------------------------

// only for node.js.

/** {String}user/bot name */
global.user_name = '';

// https://wikitech.wikimedia.org/wiki/Help:Tool_Labs#How_can_I_detect_if_I.27m_running_in_Labs.3F_And_which_project_.28tools_or_toolsbeta.29.3F
/** {String}Tool Labs name */
global.wmflabs = require('fs').existsSync('/etc/wmflabs-project')
		&& process.env.INSTANCENAME;
/** {String}home directory */
global.home_directory = wmflabs ? '/data/project/' + user_name + '/' : '';
/** {String}bot base directory */
global.bot_directory = wmflabs ? home_directory + 'wikibot/' : '';

// ----------------------------------------------------------------------------
// For node.js loading. Copy/modified from "/_for include/node.loader.js".
// 載入泛用（非特殊目的使用）之功能。

(typeof CeL_path === 'string' ? CeL_path
		: 'D:\\USB\\cgi-bin\\lib\\JS|/home/www/cgi-bin/lib/JS|/data/project/'
				+ user_name + '/node_modules/cejs')
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
	// 若有則用之。
	require('cejs');

// ----------------------------------------------------------------------------

// CeL.set_debug(3);
CeL.run([ 'interact.DOM', 'application.debug', 'application.net.wiki' ]);

// ----------------------------------------------------------------------------

/** Wiki() return {Object}wiki 操作子. */
Function('return this')().Wiki = (function() {
	var pw = '';
	return function(login, API_URL) {
		if (!login)
			return new CeL.wiki(null, null, API_URL);

		// CeL.set_debug(3);
		var wiki = CeL.wiki.login(user_name, pw, {
			API_URL : API_URL,
			preserve_password : true
		});
		if (typeof check_section === 'string')
			wiki.check_options = {
				section : check_section
			};
		return wiki;
	};
})();

// ----------------------------------------------------------------------------

// prepare directory: delete cache, reset base directory.
// TODO: use move
function prepare_directory(clean) {
	function create_base() {
		CeL.fs_mkdir(base_directory);
	}
	if (clean)
		CeL.fs_remove(base_directory, create_base);
	else
		create_base();
}

