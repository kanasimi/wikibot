﻿/**
 * @name CeJS wiki library loader for node.js.
 * @fileoverview ** This file is private.
 * 
 * <code>

// command line usage:
cd /path/to/wiki_bot && node
cd ~/wikibot && node
cd /d D:\USB\cgi-bin\program\wiki && node


// At .js file:

// 採用指定的 wiki project。Should use `login_options.API_URL = 'zh.wikinews';`
//globalThis.use_project = 'zh.wikinews';

// Load CeJS library and modules.
require('./wiki loader.js');

// Load modules.
CeL.run([
	// for CeL.assert()
	'application.debug.log',
]);
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

// 出來的是內部網路IP。
// console.trace(require('os').networkInterfaces());

var _global = typeof globalThis === 'object' && globalThis
		|| Function('return this')();

// 警告： node.js 6.3.0 起，prompt 之 global, console 與 此處的 global, console 不同！
// 但 process 為同一個。
// @see https://github.com/es-shims/es7-shim/blob/master/es7-shim.js

// login_options_for_project[DEFAULT_PROJECT_KEY] = { default project
// configuration }
_global.DEFAULT_PROJECT_KEY = '*';

// Should setup in `wiki configuration.js`
_global.login_options_for_project = Object.create(null);

var process_env = _global.process && process.env;
if (process_env) {
	// e.g., "cron-20170915.topic_list.zh"
	_global.task_name = process_env.JOB_NAME;
	login_options_for_project[DEFAULT_PROJECT_KEY] = {
		owner_name : process_env.SUDO_USER,
		user_name : process_env.USER
				&& process_env.USER.replace(/^tools\./, '')
	};
}

require('./wiki configuration.js');

// ----------------------------------------------------------------------------
// Load CeJS library.

// npm: 若有 CeJS module 則用之。
// globalThis.use_cejs_mudule = true;

try {
	require('./_CeL.loader.nodejs.js');
} catch (e) {
	require('cejs');
}

// for i18n: define gettext() user domain resources location.
// gettext() will auto load (CeL.env.domain_location + language + '.js').
// e.g., resources/cmn-Hant-TW.js, resources/ja-JP.js
CeL.env.domain_location = CeL.env.resources_directory_name + '/';

// ----------------------------------------------------------------------------
// Load modules.

// CeL.env.no_catch = true;
// CeL.set_debug(3);
CeL.run([ 'interact.DOM', 'application.debug',
// 載入不同地區語言的功能 for CeL.gettext(), wiki.work()。
'application.locale',
// 載入操作維基百科的主要功能。
'application.net.wiki',
// Optional 可選功能
'application.net.wiki.data', 'application.net.wiki.admin',
// Optional 可選功能
'application.net.wiki.cache',
// Add color to console messages. 添加主控端報告的顏色。
'interact.console',
// for 'application.platform.nodejs': CeL.env.arg_hash,
// CeL.wiki.cache(), CeL.fs_mkdir(), CeL.wiki.read_dump()
'application.storage' ]);

// ----------------------------------------------------------------------------

if (_global.on_load_CeL) {
	try {
		// e.g., in `./wiki configuration.js`
		_global.on_load_CeL();
	} catch (e) {
		// TODO: handle exception
	}
	delete _global.on_load_CeL;
}

if (!_global.Wikiapi) {
	try {
		// Load wikiapi module.
		_global.Wikiapi = require('wikiapi');
	} catch (e) {
		// TODO: handle exception
	}
}

// ----------------------------------------------------------------------------

// 自檔名取得 task 資訊。

/** {String}task date. 預設之緊急停止作業 (Stop Task) 將檢測之章節標題/開始寫任務原始碼的日期/任務開始的日期。 */
_global.check_section = '';

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

if (script_name) {
	if (typeof console === 'object') {
		console.time('task');
		// ↑ use console.timeEnd('task')
	}
	CeL.log('\n' + '-'.repeat(80) + '\nwiki loader: ' + (new Date).format()
			+ ' Starting [' + CeL.get_script_name() + ']');
}

/** {String}預設之編輯摘要/reason。總結報告。編集内容の要約。 */
_global.summary = script_name;

// ----------------------------------------------------------------------------

/** {String}本次任務使用的語言。 */
_global.use_language = '';

// project = language_code.family
_global.use_project = CeL.env.arg_hash && CeL.env.arg_hash.use_project
		|| _global.use_project;

function login_options_of_API_URL(API_URL) {
	if (API_URL && API_URL.API_URL) {
		API_URL = API_URL.API_URL;
	}
	var login_options = Object.assign({
		preserve_password : true
	// configuration_adapter : null
	}, login_options_for_project[API_URL]
			|| login_options_for_project[DEFAULT_PROJECT_KEY],
	// preserve _global.login_options.configuration_adapter
	_global.login_options);
	if (API_URL)
		login_options.API_URL = API_URL;

	if (!login_options.task_configuration_page) {
		/** {String}預設之運作記錄存放頁面。 */
		var log_to = '';
		if (check_section) {
			// 本工具將產生之記錄頁面。 log to page
			log_to = 'User:'
			// 設定頁面與記錄頁面所參考的使用者名稱。
			+ (login_options.user_name_referenced
			//
			|| CeL.wiki.extract_login_user_name(login_options.user_name))
					+ '/log/' + check_section;
			login_options.log_to = log_to;
			// wiki.latest_task_configuration.configuration_page_title
			login_options.task_configuration_page = log_to + '/configuration';
		} else if (script_name && !_global.no_task_date_warning) {
			CeL.warn('No task date assigned! 未指定任務日期。');
		}
	}

	var matched = (API_URL || '').match(
	//
	new RegExp(Object.keys(login_options_for_project).filter(function(key) {
		return key !== DEFAULT_PROJECT_KEY;
	}).join('|'), 'i'));
	if (matched) {
		matched = matched[0];
		var _login_options = login_options_for_project[matched];
		var API_URL = _login_options.API_URL;
		CeL.info('login_options_of_API_URL: Using options of ' + matched
				+ (API_URL ? ': ' + API_URL : ''));
		Object.assign(login_options, _login_options);
		// console.trace(login_options);
	}

	if (login_options.user_agent) {
		CeL.debug('login_options_of_API_URL: Using customization user agent: '
				+ login_options.user_agent, 1);
		CeL.get_URL.default_user_agent = login_options.user_agent;
	}

	return login_options;
}

// Set default language. 改變預設之語言。 e.g., 'zh'
_global.set_language = function set_language(language) {
	// assert: !!language === true
	if (CeL.wiki.is_wiki_API(language)) {
		language = language.language;
	}

	var API_URL = CeL.env.arg_hash && CeL.env.arg_hash.API_URL || use_project
			|| language;
	if (!API_URL) {
		// e.g., use_project=wikinews
		return;
	}

	// export
	_global.login_options = login_options_of_API_URL(API_URL);
	if (language) {
		use_language = language;
		CeL.gettext.use_domain(language === 'simple' ? 'en' : language, true);
		// 因為 CeL.wiki.set_language() 會用到 gettext()，
		// 因此得置於 CeL.gettext.use_domain() 後。
		CeL.wiki.set_language(language);
		// console.trace(language);
	}

	_global.log_to = _global.log_to || login_options.log_to || '';
	/** {String}home directory */
	var home_directory = CeL.env.home || CeL.wiki.wmflabs && '/data/project/'
			+ CeL.wiki.extract_login_user_name(login_options.user_name) + '/'
			|| '';
	/** {String}bot base directory */
	_global.bot_directory = CeL.wiki.wmflabs ? home_directory + 'wikibot/' : '';
	/** {String}預設之本任務獨有的 base directory。衍生檔案如記錄檔、cache 等將置放此目錄下。 */
	_global.base_directory = script_name ? bot_directory + script_name + '/'
			: '';

	var original_directory;
	_global.dump_directory = undefined;
	if (bot_directory) {
		// CeL.log('base_directory: ' + base_directory);
		// record original working directory.
		original_directory = process.cwd().replace(/[\\\/]+$/) + '/';
		// e.g., '/shared/cache/', '/shared/dumps/', '~/dumps/'
		// 注意:此目錄可能因為系統整理等原因而消失。
		dump_directory = '/shared/cache/';

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
};

set_language(CeL.env.arg_hash && CeL.env.arg_hash.use_language || 'zh');
// console.trace(login_options);

// e.g., # node task.js debug=2
if (CeL.env.arg_hash && (CeL.env.arg_hash.set_debug || CeL.env.arg_hash.debug)) {
	CeL.debug([ {
		// gettext_config:{"id":"debug-level"}
		T : 'debug level'
	}, ': ',
	//
	CeL.set_debug(CeL.env.arg_hash.set_debug || CeL.env.arg_hash.debug) ]);
}

// ----------------------------------------------------------------------------

if (false) {
	/** {revision_cacher}記錄處理過的文章。 */
	_global.processed_data = new CeL.wiki.revision_cacher(base_directory
			+ 'processed.' + use_language + '.json');
}

/** Wiki() return {Object}wiki operator 操作子. */
_global.Wiki = function new_wiki(do_login, API_URL) {
	var api = API_URL || CeL.env.arg_hash && CeL.env.arg_hash.API_URL
			|| use_project;
	// console.trace(api);
	var login_options = login_options_of_API_URL(api);
	// console.trace(login_options);
	var session = do_login ? CeL.wiki.login(login_options) : new CeL.wiki(
			login_options);
	// console.trace(session);
	set_language(session);
	if (!do_login) {
		return session;
	}

	// CeL.set_debug(3);
	if (typeof check_section === 'string') {
		session.check_options = {
			check_section : check_section
		};
	}

	if (false && !session.get_URL_options.headers) {
		session.get_URL_options.headers = Object.create(null);
	}
	if (CeL.get_script_name()) {
		// set User-Agent to use:
		// Special:ApiFeatureUsage&wpagent=CeJS script_name
		session.get_URL_options.headers['User-Agent'] = CeL.get_URL.default_user_agent
				// User-Agent 不可含有中文。
				+ ' ' + encodeURI(CeL.get_script_name());
	}

	check_routine_task(session);

	return session;
};

// ----------------------------------------------------------------------------

// prepare directory: delete cache, reset base directory.
// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
// e.g., prepare_directory(base_directory);
// TODO: use move
_global.prepare_directory = function prepare_directory(directory, clean) {
	if (!directory && !(directory = base_directory)) {
		CeL.error(
		// No script_name, therefore no base_directory?
		'prepare_directory: No directory specified, and no script_name!!');
		return;
	}

	if (clean) {
		CeL.remove_directory(directory, true);
	}
	CeL.create_directory(directory);
};

if (!_global.fetch) {
	_global.fetch = function fetch(url) {
		if (CeL.platform.is_interactive) {
			CeL.log_temporary('fetch ' + url);
		}
		return CeL.fetch(url);
	};
}

// ----------------------------------------------------------------------------

// TODO: yet test
var routine_task_log_file = 'routine_task_log.json';

function get_task_log() {
	if (!task_name)
		return;

	var all_task_log = CeL.get_JSON(routine_task_log_file);
	if (!all_task_log)
		return;

	if (!all_task_log[task_name]) {
		// 初始化
		all_task_log[task_name] = Object.create(null);
	}
	return all_task_log;
}

function check_routine_task(session) {
	var all_task_log = get_task_log();
	if (!all_task_log)
		return;

	var notice_list = [];
	for ( var task_id in all_task_log) {
		if (task_id === task_name) {
			// 跳過本身任務的提醒。
			continue;
		}

		var task_log = all_task_log[task_id], last_done = task_log.last_done;
		// 預設一個月未成功執行到最後就通報。
		var interval = CeL.to_millisecond(task_log.interval || '1 month');
		if (typeof last_done === 'string')
			last_done = Date.parse(task_log.last_done);
		if (!(interval > Date.now() - last_done))
			continue;

		task_log.id = task_id;
		notice_list.push(task_log);
	}

	if (notice_list.length === 0)
		return;

	session.page('User talk:' + session.token.login_user_name)
	// 任務太久沒執行則提醒使用者。
	.edit(function(page_data) {
		var title = CeL.wiki.title_of(page_data),
		/**
		 * {String}page content, maybe undefined. 條目/頁面內容 =
		 * CeL.wiki.revision_content(revision)
		 */
		content = CeL.wiki.content_of(page_data) || '';

		notice_list = notice_list.map(function(task_log) {
			var mark = '<!-- ' + task_log.id
			// 去掉已經提醒過的。
			+ '' + task_log.last_done + ' -->';
			if (content.includes(mark)) {
				return '* <code>' + task_id + '</code> 上次成功執行於 '
				//
				+ (new Date(task_log.last_done)).format() + '，距今已 '
				//
				+ CeL.age_of(task_log.last_done) + '。' + mark;
			}
		}).filter(function(log) {
			return !!log;
		});

		if (notice_list.length > 0) {
			return content + '\n\n== 任務太久未成功執行提醒 ==\n'
			//
			+ notice_list.join('\n') + ' --~~~~';
		}
	}, {
		redirects : 1
	});
}

/**
 * 紀錄/檢查與上次執行時間是否過久。
 * 
 * @param {String|Number}interval
 *            每隔 interval 就應該執行一次。
 */
function routine_task_done(interval) {
	CeL.info('routine_task_done: ' + (task_name || script_name) + ': '
			+ (new Date).format() + '	done.');
	var all_task_log = get_task_log();
	if (!all_task_log)
		return;

	var this_task_log = all_task_log[task_name];
	this_task_log.last_done = (new Date).toISOString();
	if (interval)
		this_task_log.interval = interval;
	CeL.write_file(routine_task_log_file, all_task_log);
	// process.exit(0);
}

_global.routine_task_done = routine_task_done;
