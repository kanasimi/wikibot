// 2015/3/5 21:13:4
// CeJS library loader for node.js.
// ** This file is private.

/*

// command line usage:
cd /path/to/wiki_bot && node
cd ~/wikibot && node


// At .js file:

// Load CeJS library and modules.
require('./wiki loder.js');
// for CeL.wiki.cache(), CeL.fs_mkdir()
CeL.run('application.platform.nodejs');
// 在非 Windows 平台上避免 fatal 錯誤。
CeL.env.ignore_COM_error = true;
// load module for CeL.CN_to_TW('简体')
CeL.run('extension.zh_conversion');

// Set default language. 改變預設之語言。
set_language('ja');


 */

'use strict';

// only for node.js.
/** {String}user/bot name */
global.user_name = 'bot_name';


// ----------------------------------------------------------------------------
// Load CeJS library. For node.js loading. Copy/modified from "/_for include/node.loader.js".
// 載入泛用（非特殊目的使用）之功能。

(typeof CeL_path === 'string' ? CeL_path
		// '/path/to/library_root'
		: '/path/to/library_root|/data/project/'
				+ user_name + '/node_modules/cejs|../../lib/JS').split('|')
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
// Load module.

// CeL.env.no_catch = true;
// CeL.set_debug(3);
CeL.run([ 'interact.DOM', 'application.debug', 'application.net.wiki',
// Add color to console messages. 添加主控端報告的顏色。
'interact.console' ]);

// ----------------------------------------------------------------------------

// 自檔名取得 task 資訊。

/** {String}task date. 預設之緊急停止作業將檢測之章節標題/開始寫任務原始碼的日期/任務開始的日期。 */
global.check_section = '';
/** {String}預設之運作記錄存放頁面。 */
global.log_to = '';

/** {String}script name */
global.script_name = CeL.get_script_name()
// 去掉日期 prefix / task date。
.replace(/^(\d{4,8})[. ]/g, function($0, $1) {
	check_section = $1;
})
// 去掉 version。
.replace(/[. ]v[\d.]+$/g, '');

/** {String}預設之編輯摘要。總結報告。 */
global.summary = script_name;

if (check_section) {
	log_to = 'User:' + user_name + '/log/' + check_section;
} else {
	CeL.warn('No task date assigned! 未指定任務日期。');
}

/** {String}home directory */
global.home_directory = CeL.wiki.wmflabs ? '/data/project/' + user_name + '/'
		: '';
/** {String}bot base directory */
global.bot_directory = CeL.wiki.wmflabs ? home_directory + 'wikibot/' : '';
/** {String}預設之 base directory。 */
global.base_directory = '';

if (bot_directory) {
	base_directory = bot_directory + script_name + '/';
	// record original working directory.
	global.original_directory = process.cwd() + '/';

	if (false) {
		console.log('wmflabs-project: '
				+ require('fs').existsSync('/etc/wmflabs-project')
				+ ', INSTANCENAME: ' + process.env.INSTANCENAME);
		console.log('wmflabs: ' + CeL.wiki.wmflabs + ', bot directory: '
				+ bot_directory);
		console.log(process.env);
	}

	try {
		// change to the bot directory.
		process.chdir(bot_directory);
	} catch (e) {
		// TODO: handle exception
	}
}


// ----------------------------------------------------------------------------

/** {String}本次任務使用的語言。 */
global.use_language = '';

// Set default language. 改變預設之語言。
function set_language(language) {
	use_language = language;
	CeL.wiki.set_language(language);
}

set_language('zh');

// ----------------------------------------------------------------------------

/** Wiki() return {Object}wiki operator 操作子. */
Function('return this')().Wiki = (function() {
	var pw = 'pw';
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
