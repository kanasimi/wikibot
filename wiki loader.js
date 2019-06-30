/**
 * @name CeJS wiki library loader for node.js.
 * @fileoverview ** This file is private.
 * 
 * <code>

// command line usage:
cd /path/to/wiki_bot && node
cd ~/wikibot && node
cd /d D:\USB\cgi-bin\program\wiki && node


// At .js file:

// Load CeJS library and modules.
require('./wiki loader.js');
// for CeL.wiki.cache(), CeL.fs_mkdir()
CeL.run('application.platform.nodejs');
// 在非 Windows 平台上避免 fatal 錯誤。
CeL.env.ignore_COM_error = true;
// load module for CeL.CN_to_TW('简体')
CeL.run('extension.zh_conversion');
// for CeL.application.net.archive.archive_org()
CeL.run('application.net.archive');

// Set default language. 改變預設之語言。 e.g., 'zh'
// 採用這個方法，而非 Wiki(true, 'ja')，才能夠連報告介面的語系都改變。
set_language('ja');

</code>
 * 
 * @since 2015/3/5 21:13:4
 */

'use strict';

var _global = Function('return this')();

// 警告： node.js 6.3.0 起，prompt 之 global, console 與 此處的 global, console 不同！
// 但 process 為同一個。
// @see https://github.com/es-shims/es7-shim/blob/master/es7-shim.js

// only for node.js.
/** {String}user/bot name */
_global.user_name = 'bot_name';
/** {String}user/bot owner name */
_global.owner_name = 'bot_owner_name';

user_name = owner_name = _global.process && process.env;
if (user_name) {
	owner_name = user_name.SUDO_USER;
	if (user_name = user_name.USER) {
		user_name = user_name.replace(/^tools\./, '');
	}
}

require('./wiki configuration.js');

// ----------------------------------------------------------------------------
// Load CeJS library.

// npm: 若有 CeJS module 則用之。
// global.use_cejs_mudule = true;

require('./_CeL.loader.nodejs.js');

// for i18n: define gettext() user domain resource location.
// gettext() will auto load (CeL.env.domain_location + language + '.js').
// e.g., resource/cmn-Hant-TW.js, resource/ja-JP.js
CeL.env.domain_location = CeL.env.resource_directory_name + '/';

// ----------------------------------------------------------------------------
// Load modules.

// CeL.env.no_catch = true;
// CeL.set_debug(3);
CeL.run([ 'interact.DOM', 'application.debug',
// 載入不同地區語言的功能 for wiki.work()。
'application.locale',
// 載入操作維基百科的主要功能。
'application.net.wiki',
// Add color to console messages. 添加主控端報告的顏色。
'interact.console',
// for 'application.platform.nodejs': CeL.env.arg_hash, CeL.wiki.cache(),
// CeL.fs_mkdir(), CeL.wiki.read_dump()
'application.storage' ]);

// ----------------------------------------------------------------------------

// 自檔名取得 task 資訊。

/** {String}task date. 預設之緊急停止作業 (Stop Task) 將檢測之章節標題/開始寫任務原始碼的日期/任務開始的日期。 */
_global.check_section = '';
/** {String}預設之運作記錄存放頁面。 */
_global.log_to = '';

/** {String}script name */
_global.script_name = CeL.get_script_name()
// 去掉日期 prefix / task date。
.replace(/^(\d{4,8})[. ]/, function($0, $1) {
	check_section = $1;
	return '';
})
// 去掉 version。
.replace(/[. ]v[\d.]+$/g, '');
// CeL.log('script_name: ' + CeL.get_script_name());

/** {String}預設之編輯摘要/reason。總結報告。編集内容の要約。 */
_global.summary = script_name;

if (check_section) {
	// 本工具將產生之記錄頁面。 log to page
	log_to = 'User:' + user_name + '/log/' + check_section;
} else if (script_name) {
	CeL.warn('No task date assigned! 未指定任務日期。');
}

/** {String}home directory */
_global.home_directory = CeL.wiki.wmflabs ? '/data/project/' + user_name + '/'
		: '';
/** {String}bot base directory */
_global.bot_directory = CeL.wiki.wmflabs ? home_directory + 'wikibot/' : '';
/** {String}預設之本任務獨有的 base directory。衍生檔案如記錄檔、cache 等將置放此目錄下。 */
_global.base_directory = '';

if (script_name) {
	if (typeof console === 'object') {
		console.time('task');
		// ↑ use console.timeEnd('task')
	}
	CeL.log('\n' + '-'.repeat(80) + '\nwiki loader: ' + (new Date).toISOString()
			+ ' Starting [' + CeL.get_script_name() + ']');

	base_directory = bot_directory + script_name + '/';
}

if (bot_directory) {
	// CeL.log('base_directory: ' + base_directory);
	// record original working directory.
	_global.original_directory = process.cwd().replace(/[\\\/]+$/) + '/';
	// e.g., '/shared/cache/', '/shared/dumps/', '~/dumps/'
	// 注意:此目錄可能因為系統整理等原因而消失。
	_global.dump_directory = '/shared/cache/';

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
_global.use_language = '';

// project = language_code.family
_global.use_project = CeL.env.arg_hash && CeL.env.arg_hash.use_project;

// Set default language. 改變預設之語言。 e.g., 'zh'
_global.set_language = function(language) {
	use_language = language;
	CeL.gettext.use_domain(language, true);
	// 因為 CeL.wiki.set_language() 會用到 gettext()，
	// 因此得置於 CeL.gettext.use_domain() 後。
	CeL.wiki.set_language(language);
};

set_language(CeL.env.arg_hash && CeL.env.arg_hash.use_language || 'zh');

// e.g., # node task.js debug=2
if (CeL.env.arg_hash && CeL.env.arg_hash.debug > 0) {
	CeL.set_debug(CeL.env.arg_hash.debug);
}

// ----------------------------------------------------------------------------

if (false) {
	/** {revision_cacher}記錄處理過的文章。 */
	_global.processed_data = new CeL.wiki.revision_cacher(base_directory
			+ 'processed.' + use_language + '.json');
}

/** Wiki() return {Object}wiki operator 操作子. */
_global.Wiki = function(login, API_URL) {
	var api = API_URL || CeL.env.arg_hash && CeL.env.arg_hash.API_URL
			|| use_project;
	if (!login) {
		return new CeL.wiki(null, null, api);
	}

	var un = user_name, pw = _global.user_password;
	// CeL.log('Wiki: login with [' + un + ']');
	// CeL.set_debug(3);
	var wiki = CeL.wiki.login(un, pw, {
		API_URL : api,
		preserve_password : true
	});
	if (typeof check_section === 'string') {
		wiki.check_options = {
			section : check_section
		};
	}

	if (!wiki.get_URL_options.headers) {
		wiki.get_URL_options.headers = Object.create(null);
	}
	if (CeL.get_script_name()) {
		// set User-Agent to use:
		// Special:ApiFeatureUsage&wpagent=CeJS script_name
		wiki.get_URL_options.headers['User-Agent'] = CeL.get_URL.default_user_agent
				// User-Agent 不可含有中文。
				+ ' ' + encodeURI(CeL.get_script_name());
	}

	return wiki;
};

// ----------------------------------------------------------------------------

// prepare directory: delete cache, reset base directory.
// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
// e.g., prepare_directory(base_directory);
// TODO: use move
_global.prepare_directory = function(directory, clean) {
	if (!directory && !(directory = base_directory)) {
		CeL.error(
		// No script_name, therefore no base_directory?
		'prepare_directory: No directory specified, and no script_name!!');
		return;
	}

	if (clean) {
		CeL.fs_remove(directory, true);
	}
	// CeL.nodejs.fs_mkdir(directory);
	CeL.fs_mkdir(directory);
};
