// 2015/3/5 21:13:4
// CeJS library loader for node.js.
// ** This file is private.

/*

// command line usage:
cd /path/to/wiki_bot && node

require('./wiki loder.js');


*/

'use strict';


// only for node.js.
/** {String}user/bot name */
global.user_name = 'bot_name';


// ----------------------------------------------------------------------------
// For node.js loading. Copy/modified from "/_for include/node.loader.js".
// 載入泛用（非特殊目的使用）之功能。

(typeof CeL_path === 'string' ? CeL_path
		: '/path/to/library_root').split('|')
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

if (typeof CeL === 'undefined')
	try {
		// 若有則用之。
		require('cejs');
	} catch (e) {
		// No CeJS?
		// TODO: handle exception
	}

// ----------------------------------------------------------------------------

//CeL.env.no_catch = true;
//CeL.set_debug(3);
CeL.run([ 'interact.DOM', 'application.debug', 'application.net.wiki',
// Add color to console messages. 添加主控端報告的顏色。
'interact.console' ]);

// ----------------------------------------------------------------------------

/** {String}script name */
global.script_name = CeL.get_script_name()
// 去掉日期 prefix。
.replace(/^\d{4,8}[. ]/g, '')
// 去掉 version。
.replace(/[. ]v[\d.]+$/g, '');

/** {String}home directory */
global.home_directory = CeL.wiki.wmflabs ? '/data/project/' + user_name + '/'
		: '';
/** {String}bot base directory */
global.bot_directory = CeL.wiki.wmflabs ? home_directory + 'wikibot/' : '';

if (bot_directory)
	try {
		if (false) {
			console.log('wmflabs-project: '
					+ require('fs').existsSync('/etc/wmflabs-project')
					+ ', INSTANCENAME: ' + process.env.INSTANCENAME);
			console.log('wmflabs: ' + CeL.wiki.wmflabs + ', bot directory: '
					+ bot_directory);
			console.log(process.env);
		}
		// record original working directory.
		global.original_directory = process.cwd() + '/';
		// change to the bot directory.
		process.chdir(bot_directory);
	} catch (e) {
		// TODO: handle exception
	}

// ----------------------------------------------------------------------------

// Set default language. 改變預設之語言。
CeL.wiki.set_language('zh');

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
Function('return this')().prepare_directory = function(base_directory, clean) {
	function create_base() {
		CeL.fs_mkdir(base_directory);
	}
	if (clean)
		CeL.fs_remove(base_directory, create_base);
	else
		create_base();
};
