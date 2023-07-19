/*
(cd ~/wikibot && date && hostname && nohup time node 20170515.signature_check.js use_language=zh-classical; date) >> modify_link/log &

jstop cron-20170515.signature_check.wikinews
jstop cron-20170515.signature_check.zh
jstop cron-20170515.signature_check.zh-classical
jstop cron-20170515.signature_check.wikisource
jstop cron-20170515.signature_check.wikiversity
jstop cron-20170515.signature_check.wikibooks
jstop cron-20170515.signature_check.moegirl

/usr/bin/jstart -N cron-20170515.signature_check.zh -mem 4g -once -quiet /shared/bin/node /data/project/signature-checker/wikibot/routine/20170515.signature_check.js use_language=zh
/usr/bin/jstart -N cron-20170515.signature_check.zh-classical -mem 4g -once -quiet /shared/bin/node /data/project/signature-checker/wikibot/routine/20170515.signature_check.js use_language=zh-classical
/usr/bin/jstart -N cron-20170515.signature_check.wikinews -mem 4g -once -quiet /shared/bin/node /data/project/signature-checker/wikibot/routine/20170515.signature_check.js use_project=wikinews
/usr/bin/jstart -N cron-20170515.signature_check.wikisource -mem 4g -once -quiet /shared/bin/node /data/project/signature-checker/wikibot/routine/20170515.signature_check.js use_project=wikisource
/usr/bin/jstart -N cron-20170515.signature_check.wikiversity -mem 4g -once -quiet /shared/bin/node /data/project/signature-checker/wikibot/routine/20170515.signature_check.js use_project=wikiversity
/usr/bin/jstart -N cron-20170515.signature_check.wikibooks -mem 4g -once -quiet /shared/bin/node /data/project/signature-checker/wikibot/routine/20170515.signature_check.js use_project=zh.wikibooks
/usr/bin/jstart -N cron-20170515.signature_check.moegirl -mem 4g -once -quiet /shared/bin/node /data/project/signature-checker/wikibot/routine/20170515.signature_check.js use_project=zhmoegirl


node 20170515.signature_check.js use_language=simple

 2017/5/15 21:30:19	初版試營運。
 2017/8/18 23:50:52 完成。正式運用。

 移植時，需要準備好:
 {{Template:Unsigned}}
 {{Template:Uw-signlink}}
 {{Template:Uw-tilde}}
 [[User:Cewbot/log/20170515]]


 工作原理:
 # wiki.listen(): 監視最近更改的頁面。
 # wiki.listen(): 取得頁面資料。
 # filter_row(): 從頁面資訊做初步的篩選: 以討論頁面為主。
 # for_each_row(): 解析頁面結構。比較頁面修訂差異。
 # check_diff_pair(): 對於頁面每個修改的部分，都向後搜尋/檢查到章節末。
 # check_sections(): 檢查這一次的修訂中，是不是只添加、修改了模板、章節標題、格式排版或者沒有具體意義的文字。
 # check_sections(): 確保 to_diff_start_index, to_diff_end_index 這兩個分割點都在段落之間而非段落中間。
 # check_sections(): 檢查每一段的差異、提取出所有簽名，並且做出相應的處理。
 # for_each_row(): 將可能修改了他人文字的編輯寫進記錄頁面 log_to。
 # for_each_row(): 為沒有署名的編輯添加簽名標記。

 一般說來在討論頁留言的用途有:
 在條目的討論頁添加上維基專題、條目里程碑、維護、評級模板。
 當一次性大量加入連續的文字時，僅僅當做一次編輯。例如貼上文件備查。 [[w:zh:Special:Diff/45239349]]
 用戶在自己的討論頁添加上宣告或者維護模板。
 其他一般討論，應該加上署名。

 @see
 https://en.wikipedia.org/wiki/User:SineBot https://en.wikipedia.org/wiki/User:Anomie/unsignedhelper.js
 https://commons.wikimedia.org/wiki/Commons:Bots/Requests/SignBot
 https://en.wikipedia.org/wiki/User:SineBot/ChangeLog
 https://zh.wikipedia.org/wiki/User:Crystal-bot
 [[ja:User:Cpro/checksigniture.js]]
 [[fr:Utilisateur:Signature manquante (bot)]]
 optional:
 {{Template:Nosign}}

TODO:
跳過這一種把正文搬到討論區的情況. e.g., [[w:zh:Special:Diff/45401508]], [[w:zh:Special:Diff/45631002|Wikipedia talk:聚会/2017青島夏聚]]

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

login_options.configuration_adapter = adapt_configuration;

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),

gettext = CeL.gettext,

// for 萌娘百科 zh.moegirl.org.cn
edit_tags = wiki.API_URL.includes('moegirl') ? 'Bot' : '',
// moegirl don't use substitution.
using_subst = !wiki.API_URL.includes('moegirl');

// console.trace([ edit_tags, using_subst ]);

// ----------------------------------------------------------------------------
// 常用的主要設定

var
// for debug specified pages. 只處理此一頁面。 e.g., "User talk:Kanashimi"
test_the_page_only = "",
// true: 測試模式，將不會寫入簽名或者提醒。
test_mode = !!test_the_page_only,
// 回溯這麼多時間。最多約可回溯30天。用個一兩天可以避免 jstart 必須常常檢查。
time_back_to = test_mode ? '1h' : '2D',
// 檢查簽名的延遲時間: 檢測到未簽名的編輯後，機器人會等待 delay_time，以使用戶可以自行補簽。
// 若是等待時間過長，可能會有其他人插入留言回覆。 [[w:zh:Special:Diff/45941555]],
// [[w:zh:Special:Diff/46397467]]
delay_time = '2m',
// 用戶討論頁提示：如果進行了3次未簽名的編輯，通知使用者記得簽名。
notification_limit_count = 3,
//
project_name = CeL.wiki.site_name(wiki),
//
project_page_prefix = {
	zh_classicalwiki : '維基大典:',
	zhwikinews : 'Wikinews:',
	zhwikisource : 'Wikisource:'
}[project_name] || 'Wikipedia:',

// 注意: 因為本工具讀不懂文章，因此只要文章中有任何部分或規則為不需要簽名，那就不應該列入檢查。
// whitelist e.g., [[Wikipedia:頁面存廢討論/*]]
page_allowlist = [ 'Wikipedia:知识问答', 'Wikipedia:存廢覆核請求', 'Wikipedia talk:首页',
//
'Wikisource:写字间', 'Wikisource:机器人', 'Wikisource:導入者', 'Wikisource:管理员',
//
'維基大典:會館', 'Wikiversity:互助客栈',
// for 萌娘百科 zh.moegirl.org.cn
'Talk:讨论版', 'Talk:提问求助区' ],

// blacklist denylist blocklist 黑名單直接封殺。黑名單的優先度高於白名單。
// 謝謝您的提醒，已經將此頁加入黑名單。以後不會再對這種頁面補簽名。
// 因為發現有直接添加在首段的留言，發生次數也比更改說明的情況多，因此後來還是決定幫忙添加簽名。若是有說明的話，或許外面加個模板會比較好，這樣既美觀，而且也不會被當作是留言。
page_blocklist = [ 'Wikipedia:机器人/申请/审核小组成员指引', 'Wikipedia:机器人/申请/机械人申请指引',
		'Wikisource:管理员',
		// [[w:zh:Special:Diff/54719338]]
		// 請讓機器人不要在Module_talk:***/testcases下自動添加簽名。
		/Module_talk:.+\/testcases/, /萌娘百科 talk:提案\/讨论中提案\/.+/ ],

user_denylist = new Set,

// ----------------------------------------------------------------------------

// 為每個段落都補簽名。
// 除了在編輯維基專題、條目里程碑、維護、評級模板之外，每個段落至少要有一個簽名。
// 因為有些時候可能是把正文中許多段落的文字搬移到討論頁備存，因此預設並不開啟。 e.g., [[w:zh:Special:Diff/45239349]]
sign_each_section = false,
// 另可以破折號代替橫線。
more_separator = '...\n' + '⸻'.repeat(20) + '\n...',
// 只有ASCII符號。
PATTERN_symbol_only = /^[\t\n -@\[-`{-~]*$/,
// 只標示日期的存檔頁面標題。
PATTERN_date_archive = /\/[12]\d{3}年(?:1?\d(?:[\-~～]1?\d)?月(?:[\-~～](?:[12]\d{3}年)?1?\d月)?)?(?:\/|$)/,
// 跳過封存/存檔頁面: [[Template:Talk archive]] and all redirects。
PATTERN_archive = /{{ *(?:(?:Talk ?)?archive|存檔|(?:讨论页)?存档|Aan|来自已转换的wiki文本讨论页的存档)/i,
// 篩選編輯摘要。排除還原、自動的編輯。
// GlobalReplace: use tool
// https://commons.wikimedia.org/wiki/Commons:GlobalReplace
// "!nosign!": 已經參考、納入了一部分 [[commons:User:SignBot|]] 的做法。
// @see [[Wikipedia:Twinkle]] ([[WP:TW]])
PATTERN_revert_or_bot_summary = /還原|还原|revert|回退|撤銷|撤销|取消.*(编辑|編輯)|更改回|維護|维护|暫存|暂存|臨時保存|替换引用|!nosign!|!nobot!|Wikipedia:TW|Wikipedia:AWB|Project:AWB|AutoWikiBrowser|自動維基瀏覽器|自动维基浏览器|GlobalReplace/i,
// Ignore these tags
ignore_tags = [ 'AWB', 'twinkle',
// @ 萌娘百科
'Bot', 'Automation tool',
//
'WPCleaner', 'huggle', 'mw-new-redirect', 'mw-rollback', 'mw-reverted',
		'mw-undo', 'mw-manual-revert', 'mw-blank', 'mw-new-redirect',
		'mw-replace' ],
// 可以在頁面中加入 "{{NoAutosign}}" 來避免這個任務於此頁面添加簽名標記。
// 請機器人注意: 本頁面不採用補簽名。
PATTERN_ignore = /本頁面不.{0,3}補簽名/,
// unsigned_user_hash[user][page title] = unsigned count
unsigned_user_hash = Object.create(null),
// no_link_user_hash[user][page title] = unsigned count
no_link_user_hash = Object.create(null),
// 不可為頁面名稱。
KEY_COUNT = '#count',
/**
 * 非內容的元素。無正式具意義的
 * token.type。若是遇到這一些元素，就跳過、不算是正式內容。例如章節標題不能算成內文，我們也不會在章節標題之後馬上就簽名；因此處理的時候，去掉最末尾的章節標題。
 */
noncontent_type = {
	comment : true,

	section_title : true,
	category : true
},
// options to LCS() diff
with_diff = {
	LCS : true,
	// line : true,
	line : false,
	index : 2,
	with_list : true
};

if (test_mode) {
	page_allowlist.push('Wikipedia:沙盒');
}

function adapt_configuration(latest_task_configuration) {
	var general = wiki.latest_task_configuration.general
			|| (wiki.latest_task_configuration.general = Object.create(null));

	if (Array.isArray(general.trusted_user_groups))
		trusted_user_privileges = new Set(general.trusted_user_groups);

	console.trace(wiki.latest_task_configuration.general);
}

// CeL.set_debug(2);

function show_page(row) {
	CeL.log('* [[User:' + row.user + ']] 編輯了 [[Special:Diff/' + row.revid + '|'
			+ row.title + ']]');
}

// 從頁面資訊做初步的篩選。
function filter_row(row) {
	// console.log(row);
	if (CeL.is_debug(2)) {
		show_page(row);
	}

	// passed === true: 要繼續處理這個頁面。
	var passed;

	if (test_the_page_only) {
		// for test
		passed = row.title === test_the_page_only;

	} else if (ignore_tags.some(function(tag) {
		return row.tags.includes(tag);
	})) {
		// Ignore these tags

	} else if (row.user === wiki.token.login_user_name
	// 跳過機器人的編輯。為了某些編輯不加 bot flag 的 bot。
	|| CeL.wiki.PATTERN_BOT_NAME.test(row.user)
	// 篩選編輯摘要。
	|| PATTERN_revert_or_bot_summary.test(row.comment)) {
		;

	} else {
		passed = row.user !== 'MediaWiki message delivery'
		// 迴避 [[Wikipedia:Editnotice]] [[維基百科:編輯提示]]
		// e.g. [[Wikipedia:新条目推荐/候选/Editnotice]]子頁面
		&& !/\/Editnotice(\/|$)/i.test(row.title)
		// 迴避 [[Wikipedia:Preload]]
		&& !/\/Preload$/i.test(row.title)
		// 篩選頁面標題。跳過封存/存檔頁面。
		&& !/\/(?:archive|檔案|档案|沙盒)/i.test(row.title)
		// /舊?存檔|旧?存档/ e.g., [[Talk:台北車站/2005—2010年存檔]]
		&& !/存檔|存档/i.test(row.title)
		// 參考過去幾年的慣例，只要投票者有列明身分、對話頁和貢獻，不用四個波浪號並沒有問題。
		// e.g., [[Wikipedia_talk:動員令/第十六次動員令/投票]]
		&& !/^Wikipedia(?:[ _]talk)?:動員令\/.+?\/投票$/i.test(row.title)
		// 只標示日期的存檔
		&& !PATTERN_date_archive.test(row.title)
		// e.g., [[Wikipedia_talk:聚会/2017青島夏聚]]
		// || /^Wikipedia[ _]talk:聚会\//i.test(row.title)

		// 必須是白名單頁面，
		&& (page_allowlist.includes(row.title)
		// 或者討論頁面，
		|| CeL.wiki.is_talk_namespace(row.ns)
		// 或者只有維基百科的有額外的頁面、需要測試[[Wikipedia:]]。
		|| row.title.startsWith('Wikipedia:'))

		;
	}

	if (!passed) {
		CeL.debug('從頁面資訊做初步的篩選: 直接跳過這個編輯', 2, 'filter_row');
	}

	return passed;
}

function add_count(row, hash, get_count) {
	var pages_to_notify = hash[row.user];
	if (get_count) {
		return pages_to_notify ? pages_to_notify[KEY_COUNT] : 0;
	}

	if (!pages_to_notify) {
		// initialization
		pages_to_notify = hash[row.user] = Object.create(null);
		pages_to_notify[KEY_COUNT] = 0;
	}
	pages_to_notify[row.title] = (pages_to_notify[row.title] | 0) + 1;
	return ++pages_to_notify[KEY_COUNT];
}

function get_pages_to_notify(row, hash) {
	var pages_to_notify = Object.keys(hash[row.user]).filter(function(title) {
		return title !== KEY_COUNT;
	}).map(function(title) {
		return CeL.wiki.title_link_of(title);
	});
	CeL.debug('get_pages_to_notify: reset unsigned / no-link count of user ['
			+ row.user + ']');
	delete hash[row.user];
	return pages_to_notify;
}

// ----------------------------------------------------------------------------
// main process

wiki.run(main_process);

function main_process() {
	check_user_denylist();

	if (test_the_page_only) {
		CeL.info('處理單一頁面 ' + CeL.wiki.title_link_of(test_the_page_only)
				+ ': 先取得頁面資料。');
		wiki.page(test_the_page_only, function(page_data) {
			var revision = CeL.wiki.content_of.revision(page_data);
			// 解析頁面結構。
			CeL.wiki.parser(page_data).parse();
			// 模擬 wiki.listen() 這個函數的工作。
			// @see add_listener() @ CeL.application.net.wiki
			Object.assign(page_data, {
				user : revision.user,
				timestamp : revision.timestamp,
				revid : revision.revid,
				// The edit comment / summary.
				comment : revision.comment,
				from_parsed : CeL.wiki.parser(
						page_data.revisions.length > 1 ? CeL.wiki.content_of(
								page_data, -1) : '').parse()
			});

			page_data.diff = CeL.LCS(page_data.from_parsed.map(function(token) {
				return token.toString();
			}), page_data.parsed.map(function(token) {
				return token.toString();
			}), Object.assign({
				diff : true
			}, with_diff));

			// 處理單一頁面的時候開啟偵錯模式。
			// CeL.set_debug(2);
			if (CeL.is_debug(2))
				console.log(page_data);
			for_each_row(page_data);
		}, {
			rvprop : 'ids|timestamp|content|user|comment',
			rvlimit : 2
		});

	} else {
		CeL.info('檢查簽名的延遲時間: ' + delay_time);
		// CeL.set_debug(1);
		wiki.listen(for_each_row, {
			start : time_back_to,
			delay : delay_time,
			filter : filter_row,
			with_diff : with_diff,
			parameters : {
				// 跳過機器人所做的編輯。
				// You need the "patrol" or "patrolmarks" right
				// to request the patrolled flag.
				rcshow : '!bot',
				// 擷取資料的時候要加上filter_row()需要的資料，例如編輯摘要。
				rcprop : 'title|ids|sizes|flags|user|tags|comment'
			},
			interval : test_mode || time_back_to ? 500 : 60 * 1000
		});
	}
}

// ---------------------------------------------------------

function check_user_denylist() {
	wiki.embeddedin('Template:NoAutosign', function(page_data_list) {
		var new_user_denylist = new Set(page_data_list.filter(
				function(page_data) {
					return wiki.is_namespace(page_data, 'user');
				}).map(function(page_data) {
			return wiki.remove_namespace(page_data);
		}));
		if (user_denylist.size !== new_user_denylist.size) {
			CeL.info('check_user_denylist: user_denylist: '
					+ user_denylist.size + '→' + new_user_denylist.size);
		}
		user_denylist = new_user_denylist;
		// 每5分鐘檢查一次嵌入{{NoAutosign}}模板的頁面。
		setTimeout(check_user_denylist, CeL.date.to_millisecond('5min'));
	});
}

// ---------------------------------------------------------

// 篩選格式排版用。
// @see CeL.wiki.plain_text(wikitext)
function exclude_style(token_list) {
	var list_without_style = [];
	if (token_list) {
		token_list.forEach(function(token) {
			token = token.toString().replace(
			// HTML tags 標籤通常不能夠代表意義。
			/<\/?[a-z]+(\s[^<>]*)?>/g, '').split('\n');
			list_without_style.append(token);
		});
	}
	return list_without_style;
}

function get_parsed_time(row) {
	if (!row.parsed_time) {
		// 補簽的時間戳能不能跟標準簽名格式一樣，讓時間轉換的小工具起效用。
		row.parsed_time = CeL.wiki.parse.date.to_String(
				new Date(row.timestamp), wiki);
	}

	return row.parsed_time;
}

/** {Number}超過這個編輯距離才會視為有意義的編輯，否則視為錯字修正之類無需簽名之小修改。 */
var MIN_EDIT_DISTANCE = 10;

function get_diff_text(diff_array) {
	return diff_array ? diff_array.join('\n')
	// [[w:zh:Special:Diff/71275680]] 令編輯連結不列入計算。
	.replace(/\[\[.+?\]\]/g, '') : '';
}

var user_info_Map = new Map;
/** 受信任的使用者權限 */
var trusted_user_privileges = wiki.API_URL.includes('moegirl') ? new Set([
		'bot', 'staff', 'patroller', 'sysop' ]) : new Set([ 'bot',
		'extendedconfirmed', 'rollbacker', 'sysop' ]);

// for debug
var latest_revid = 0;
function for_each_row(row) {
	// console.trace(row.revid + ' ￩ ' + latest_revid);
	// console.log([ row.timestamp, get_parsed_time(row) ]);
	CeL.debug('revid = ' + row.revid, 1, 'for_each_row');
	if (false) {
		if (!(row.revid > latest_revid)) {
			throw new Error('for_each_row: revid error: ' + row.revid + ' ￩ '
					+ latest_revid);
		}
		latest_revid = row.revid;
	}

	// free
	delete row.row;

	// CeL.set_debug(2);
	if (false) {
		console.log(row);
		return;
		console.log(row.diff);
	}

	if (user_denylist.has(row.user)) {
		return;
	}

	var
	/** {String}page content, maybe undefined. */
	content = CeL.wiki.content_of(row, 0);

	CeL.debug('做初步的篩選: 以討論頁面為主。', 5);
	if (!row.diff
	// 跳過封存/存檔頁面。 e.g., [[Wikipedia talk:首页/header/preload]]
	|| /\/(?:archive|存檔|存档|檔案|档案|header|preload)/i.test(row.title)
	// e.g., [[Wikipedia_talk:聚会/2017青島夏聚]]
	// || /^Wikipedia[ _]talk:聚会\// i.test(row.title)

	// 黑名單直接封殺。黑名單的優先度高於白名單。
	|| page_blocklist.some(function(filter) {
		return CeL.is_RegExp(filter)
		//
		? filter.test(row.title) : filter === row.title;
	})
	// 白名單頁面可以省去其他的檢查。
	|| !page_allowlist.includes(row.title)
	//
	&& row.title.startsWith('Wikipedia:')
	// e.g., [[Wikipedia:机器人/申请/...]]
	// NG: [[Wikipedia:頁面存廢討論/*]], [[Wikipedia:模板消息/用戶討論命名空間]]
	// && !/(?:討論|讨论|申請|申请)\//.test(row.title)
	&& !row.title.startsWith('Wikipedia:机器人/申请/')
	//
	&& !row.title.startsWith('Wikipedia:互助客栈/')
	//
	&& !row.title.startsWith('Wikipedia:新条目推荐/候选')

	// 篩選頁面內容。
	|| !content
	// 跳過封存/存檔頁面。
	|| PATTERN_archive.test(content)
	// 跳過重定向頁。
	|| CeL.wiki.parse.redirect(content)
	// [[Project:SIGN]] 可以用 "{{Bots|optout=SIGN}}" 來避免這個任務添加簽名標記。
	|| CeL.wiki.edit.denied(row, wiki.token.login_user_name, 'SIGN')
	//
	|| PATTERN_ignore.test(content)) {
		return;
	}
	if (CeL.is_debug(4)) {
		row.revisions.forEach(function(revision) {
			// @see CeL.wiki.revision_content(revision)
			delete revision.slots ? revision.slots.main['*'] : revision['*'];
		});
		delete row.diff;
		console.log(row);
	}

	if (CeL.is_debug(2)) {
		CeL.info('='.repeat(75));
		show_page(row);
		console.log(row);
	}

	// 比較頁面修訂差異。
	// row.parsed, row.diff.to 的每一元素都是完整的 token；並且兩者的 index 相對應。
	// @see add_listener() @ CeL.application.net.wiki
	// row.diff.to[index] === row.parsed[index].toString();
	// TODO: 正常情況下 token 都是完整的；但是也要應對一些編輯錯誤或者故意編輯錯誤。
	var to = row.diff.to, to_length = to.length, all_lines = [],
	/** {Integer}第二個段落在row.parsed中的 index。 */
	second_section_index = row.parsed.length;

	row.parsed.some(function(token, index) {
		if (token.type === 'section_title') {
			second_section_index = index;
			return true;
		}
	});
	if (CeL.is_debug(2)) {
		CeL.info('second_section_index: ' + second_section_index + '/'
				+ row.diff.to.length + ', row.diff.length: ' + row.diff.length);
	}

	// -----------------------------------------------------

	// function get_user_info_via_cache(user_name)
	row.user_info = user_info_Map.get(row.user);

	if (!row.user_info) {
		return new Promise(function(resolve, reject) {
			wiki.users(row.user,
			// .userinfo('*',
			function(userinfo, error) {
				if (error) {
					reject(error);
					return;
				}
				if (Array.isArray(userinfo))
					userinfo = userinfo[0];
				// console.trace(userinfo);
				// console.trace(userinfo.groupmemberships);
				if (user_info_Map.size > 1e4 || 1) {
					var limit_time = Date.now()
					// 刪除超過12小時未編輯者。
					- CeL.date.to_millisecond('12 hour');
					Array.from(user_info_Map.keys()).filter(
							function(user_name) {
								return limit_time > user_info_Map
										.get(user_name).latest_edit_date;
							}).forEach(function(user_name) {
						user_info_Map['delete'](user_name);
					});
				}
				user_info_Map.set(row.user, userinfo);
				row.user_info = userinfo;
				try {
					for_each_row(row);
					resolve();
				} catch (e) {
					reject(e);
				}
			}, {
				// |implicitgroups
				usprop : 'editcount|groups'
			});
		});
	}

	// console.trace([ trusted_user_privileges, row.user_info.groups ]);
	row.user_info.latest_edit_date = Date.now();
	// 視您的編輯次數來判斷是否為您自動補簽。
	if (row.user_info.editcount > 10000
	// 跳過受信任的使用者以避免打擾。
	|| row.user_info.groups && row.user_info.groups.some(function(group) {
		return trusted_user_privileges.has(group);
	})) {
		if (!test_mode) {
			return;
		}
		CeL.warn('因為處於測試模式，不顧使用者是否受信任，強制補簽名。');
	}
	// console.trace(userinfo);

	// -----------------------------------------------------

	var check_log = [], added_signs_or_notice = 0, write_to_log = project_name !== 'simplewiki', last_processed_index, queued_start, is_no_link_user, is_unsigned_user;

	// 對於頁面每個修改的部分，比較頁面修訂差異。
	// 有些可能只是搬移，只要任何一行有簽名即可。
	row.diff.forEach(check_diff_pair);

	function check_diff_pair(diff_pair, diff_index) {
		if (CeL.is_debug(2)) {
			CeL.info('-'.repeat(75) + '\ncheck_diff_pair:');
			console.log(diff_pair);
		}

		diff_pair.from_text = get_diff_text(diff_pair[0]);
		diff_pair.to_text = get_diff_text(diff_pair[1]);
		// 小修改小變化不補簽名。
		if (Math.abs(diff_pair.from_text.length - diff_pair.to_text.length) < MIN_EDIT_DISTANCE
				// e.g., [[w:simple:Special:Diff/8146442]]
				&& CeL.edit_distance(diff_pair.from_text, diff_pair.to_text) < MIN_EDIT_DISTANCE) {
			CeL.debug('跳過: 這一段編輯差異過小，可能只是修改了錯字。', 2, 'check_diff_pair');
			return;
		}
		// 放寬跳過幫忙處理簽名的條件。
		// e.g., [[w:zh:Special:Diff/71112848]]
		// e.g., [[w:zh:Special:Diff/71112783]]
		if (/{{Unsigned(?:-before)?/.test(diff_pair.from_text)
				// e.g., [[w:simple:Special:Diff/8195561]]
				|| /<!-- Template:Unsigned(?:-before)? -->|在對話頁上簽名/
						.test(diff_pair.to_text)) {
			CeL.debug('跳過: 手動補簽名作業。', 2, 'check_diff_pair');
			return;
		}
		// TODO: 是否該跳過所有只編輯模板之類的小變更?
		// free
		delete diff_pair.from_text;
		delete diff_pair.to_text;

		// [ to_diff_start_index, to_diff_end_index ] = diff_pair.index[1]
		var to_diff_start_index = diff_pair.index[1];
		if (!to_diff_start_index) {
			CeL.debug('跳過: 這一段編輯僅刪除文字 / deleted。', 2, 'check_diff_pair');
			return;
		}
		var to_diff_end_index = to_diff_start_index[1];
		to_diff_start_index = to_diff_start_index[0];

		if (to_diff_end_index < last_processed_index) {
			CeL.debug('跳過: 這一段已經處理過。', 2, 'check_diff_pair');
			return;
		}

		// --------------------------------------
		// 前期篩選: 檢查這一次的修訂中，是不是只添加、修改了模板、章節標題、格式排版或者沒有具體意義的文字。

		// this edit paragraph within section
		var this_section_text = '';
		function this_section_text_may_skip() {
			var token_list = [];
			// 取得最頂端階層、模板之外的 wikitext 文字。
			for (var index = to_diff_start_index; index <= to_diff_end_index; index++) {
				var token = row.parsed[index];
				// 完全忽略註解。
				if (token.type === 'comment') {
					continue;
				}
				this_section_text += token;
				if (noncontent_type[token.type]) {
					continue;
				}
				// console.log([ previous_token, index, token ]);
				if (typeof token === 'string') {
					// 去掉魔術字 Magic words
					token = token.replace(/__[A-Z]{3,16}__/g, '');
				}
				token_list.push(token);
			}
			if (false) {
				// for e.g., "{{t1}}{{t2}}" in the same line.
				token_list = token_list.map(function(token) {
					token = token.toString()
					// 採用這個方法會更好。
					.replace_till_stable(/{{[^{}]+?}}/g, '');
					return token;
				});
			}

			// 去除格式排版。
			var from_without_style = exclude_style(diff_pair[0]);
			token_list = exclude_style(token_list);
			if (CeL.is_debug(2)) {
				CeL.info('-'.repeat(50));
				CeL.info('from_without_style:');
				console.log(from_without_style);
				CeL.info('to_without_style:');
				console.log(token_list);
			}
			// 篩選格式排版。
			token_list = token_list.filter(function(token) {
				// 在改變之前就已經有這一小段的話，就排除掉之。
				return !from_without_style.some(function(_token) {
					return _token.includes(token);
				});
			}).join('').trim();
			CeL.debug('本段篩選過的文字剩下 ' + JSON.stringify(token_list), 2,
					'this_section_text_may_skip');
			// 本段文字只有ASCII符號。
			return PATTERN_symbol_only.test(token_list);
		}

		if (row.ns === CeL.wiki.namespace('user_talk')) {
			CeL.debug('測試是不是用戶在自己的討論頁添加上宣告或者維護模板。', 2, 'check_diff_pair');
			// row.title.startsWith(row.user)
			if (CeL.wiki.parse.user(CeL.wiki.title_link_of(row), row.user)) {
				// 跳過自己編輯自己的對話頁。
				CeL.debug('跳過使用者編輯屬於自己的頁面。', 2, 'check_diff_pair');
				if (this_section_text_may_skip()) {
					// Skip return;
				}
				// 對於非宣告的情況，即使是在自己的討論頁中留言，也應該要簽名。
			}
			if (this_section_text_may_skip()) {
				if (/^{{(?:Talk ?archive|讨论页存档|存档页|存檔頁)}}$/i
						.test(this_section_text.trim())) {
					CeL.debug('跳過: 只幫忙加入存檔模板。', 2, 'check_diff_pair');
					return;
				}
				check_log
						.push([
								// gettext_config:{"id":"only-inserted-or-modified-templates-section-titles-non-specific-meaning-text"}
								gettext('Only inserted or modified templates / section titles / non-specific-meaning-text'),
								row.diff.to.slice(to_diff_start_index,
										to_diff_end_index + 1).join('') ]);
				return;
			}

		} else if (row.title.startsWith(project_page_prefix)
				|| CeL.wiki.is_talk_namespace(row.ns)) {
			CeL.debug('測試是不是在條目的討論頁添加上維基專題、條目里程碑、維護、評級模板。', 2,
					'check_diff_pair');
			if (this_section_text_may_skip()) {
				// Skip: 忽略僅增加模板的情況。去掉編輯模板的情況。
				// e.g., 增加 {{地鐵專題}} {{臺灣專題|class=Cat|importance=NA}}
				// {{香港專題|class=stub}} {{Maintained|}} {{translated page|}}
				// {{ArticleHistory|}}
				CeL.debug('跳過修改模板中參數的情況。', 1, 'check_diff_pair');
				return;
			}
		}
		// 可能會漏判。

		// --------------------------------------

		for (var to_index = to_diff_start_index; to_index <= to_diff_end_index; to_index++) {
			var token = row.parsed[to_index];
			if (to_diff_start_index === to_index) {
				if (typeof token === 'string' && !token.trim()) {
					CeL.debug('跳過一開始的空白。', 4);
					to_diff_start_index = to_index + 1;
				}

			} else if (!sign_each_section) {
				continue;

			} else if (token.type === 'section_title') {
				// assert: to_index > to_diff_start_index
				CeL.debug('這一小段編輯跨越了不同的段落。但是我們會檢查每個個別的段落，每個段落至少要有一個簽名。', 4,
						'check_diff_pair');
				check_sections(to_diff_start_index, to_index - 1, to_index,
						diff_pair, diff_index);
				// reset: 跳過之前的段落。但是之後的還是得繼續檢查。
				to_diff_start_index = to_index;
			}
		}

		if (to_diff_start_index > to_diff_end_index) {
			CeL.debug('跳過: 經過初始篩選，這一段已經不剩下任何內容。', 2, 'check_diff_pair');
			return;
		}

		var next_section_index = to_diff_end_index;
		CeL.debug('對於頁面每個修改的部分，都向後搜尋/檢查到章節末。', 4, 'check_diff_pair');
		while (++next_section_index < row.parsed.length) {
			var token = row.parsed[next_section_index];
			if (token.type === 'section_title') {
				break;
			}
		}
		// assert: next_section_index === row.parsed.length
		// || row.parsed[next_section_index].type === 'section_title'

		if (!sign_each_section
				&& next_section_index === (row.diff[diff_index + 1]
				// 假如兩段之間沒有段落或者只有空白字元，那將會把他們合併在一起處理。
				&& row.diff[diff_index + 1].index[1] && row.diff[diff_index + 1].index[1][0])) {
			if (!(queued_start >= 0))
				queued_start = to_diff_start_index;
			CeL.debug('合併段落 ' + [ diff_index, diff_index + 1 ]
					+ '，start index: ' + queued_start + '。', 2,
					'check_diff_pair');
			return;
		}

		if (queued_start >= 0) {
			CeL.debug('之前合併過段落，start index: ' + to_diff_start_index + '→'
					+ queued_start, 2, 'check_diff_pair');
			to_diff_start_index = queued_start;
			queued_start = undefined;
		}

		// console.log([ to_diff_end_index, next_section_index,
		// row.parsed.length ]);

		check_sections(to_diff_start_index, to_diff_end_index,
				next_section_index, diff_pair, diff_index);
		last_processed_index = next_section_index;
	}

	function check_sections(to_diff_start_index, to_diff_end_index,
			next_section_index, diff_pair, diff_index) {
		if (CeL.is_debug(2)) {
			CeL.info('-'.repeat(60) + '\ncheck_sections: to of '
					+ CeL.wiki.title_link_of(row) + ':');
			console.log(row.diff.to.slice(to_diff_start_index,
					to_diff_end_index + 1));
			CeL.info('-'.repeat(4) + ' ↑ diff part ↓ list to next section');
			console.log(row.diff.to.slice(to_diff_end_index + 1,
					next_section_index));
		}

		// --------------------------------------
		// 確保 to_diff_start_index, to_diff_end_index 這兩個分割點都在段落之間而非段落中間。

		// 若是差異開始的地方是在段落中間，那就把開始的index向前移到段落起始之處。
		// e.g., [[w:zh:Special:Diff/45631425]]
		while (!/\n\s*$/.test(row.diff.to[to_diff_start_index])
		// 分割點的前或者後應該要有換行。
		&& !/^\s*\n/.test(row.diff.to[to_diff_start_index - 1])
		//
		&& to_diff_start_index - 1 > 0) {
			CeL.debug('差異開始的地方是在段落中間，把留言開始的index向前移到段落起始之處: '
					+ to_diff_start_index + '→' + (to_diff_start_index - 1)
					+ '。', 2);
			to_diff_start_index--;
			// continue; 向後尋找剛好交界在換行的 token。
		}

		// 若是差異結束的地方是在段落中間，那就把結束的index向後移到段落結束之處。
		// e.g., [[w:zh:Special:Diff/45510337]]
		while (!/\n\s*$/.test(row.diff.to[to_diff_end_index])
		// 分割點的前或者後應該要有換行。
		&& !/^\s*\n/.test(row.diff.to[to_diff_end_index + 1])
		//
		&& to_diff_end_index + 1 < next_section_index) {
			CeL.debug('差異結束的地方是在段落中間，把留言結束的index向後移到段落結束之處: '
					+ to_diff_end_index + '→' + (to_diff_end_index + 1) + '。',
					2);
			to_diff_end_index++;
			// continue; 向後尋找剛好交界在換行的 token。
		}

		/** {Number}不去除掉模板的留言結束index */
		var to_diff_end_index__preserve_templates;
		while (to_diff_end_index >= to_diff_start_index) {
			var token = row.parsed[to_diff_end_index];
			if (typeof token === 'string') {
				if (token.trim())
					break;
				--to_diff_end_index;
				// continue; 向前去掉最末尾的空白字元。
			} else if (token.type === 'transclusion') {
				// e.g., [[w:zh:Special:Diff/45536065|Talk:青色]]
				if (!to_diff_end_index__preserve_templates) {
					to_diff_end_index__preserve_templates = to_diff_end_index;
				}
				--to_diff_end_index;
			} else if (noncontent_type[token.type]) {
				CeL.debug('這一次編輯，在最後加上了非內容的元素 ' + token + '。將會把簽名加在這之前。', 2);
				--to_diff_end_index;
				// continue; 向前去掉最末尾的非內容的元素。
			} else {
				// TODO: 向前去掉最末尾的 <br />
				break;
			}
		}

		// https://zh.moegirl.org.cn/index.php?oldid=5779684&diff=5779692
		if (to_diff_start_index > to_diff_end_index) {
			CeL.debug('跳過: 去掉最末尾的非內容的元素與模板之後，就沒有東西了。', 2);
			return;
		}

		// 假如不是只有無正式具意義的內容，那麼會在模板之後才補簽名。
		if (to_diff_end_index__preserve_templates) {
			to_diff_end_index = to_diff_end_index__preserve_templates;
		}

		// --------------------------------------
		// 檢查每一段的差異、提取出所有簽名，並且做出相應的處理。

		CeL.debug('** 當作其他一般討論，應該加上署名。', 2);

		// 從修改的地方開始，到第一個出現簽名的第一層token為止的文字。
		var section_wikitext = row.diff.to.slice(to_diff_start_index,
				to_diff_end_index + 1);

		for (var index = to_diff_end_index + 1; index < next_section_index; index++) {
			var token = row.diff.to[index];
			section_wikitext.push(token);
			// TODO: 應該使用 function for_each_subtoken()
			if (CeL.wiki.parse.user(token)) {
				break;
			}
		}

		section_wikitext = section_wikitext.join('');

		if (CeL.wiki.content_of.revision(row).length > 1
				&& CeL.wiki.content_of(row, -1).includes(
						section_wikitext.trim())) {
			// 可能需要人工手動檢查。可能是 diff 操作仍有可改善之處。寧可跳過漏報，不可錯殺。
			// e.g., [[w:zh:Special:Diff/45311637]]
			// gettext_config:{"id":"pre-existing-text"}
			check_log.push([ gettext('Pre-existing text'), section_wikitext ]);
			return;
		}

		if (PATTERN_symbol_only.test(section_wikitext)) {
			// @see [[w:zh:Special:Diff/45254729]]
			// gettext_config:{"id":"only-inserted-punctuation-symbols"}
			check_log.push([ gettext('Only inserted punctuation / symbols'),
					section_wikitext ]);
			return;
		}

		// TODO: 應該使用 function for_each_subtoken()
		var user_hash = CeL.wiki.parse.user.all(section_wikitext), user_list = Object
				.keys(user_hash);
		CeL.debug('row.user: [' + row.user + ']. 提取出所有簽名: '
				+ user_list.join(', '), 2);
		CeL.debug(section_wikitext, 4);

		// https://www.mediawiki.org/wiki/Transclusion
		var matched = section_wikitext
				.match(/<\/?(noinclude|onlyinclude|includeonly)([ >])/i);
		if (matched) {
			// 這些嵌入包含宣告應該使用在 template: 命名空間，若是要加上簽名，可能會有被含入時出現簽名的問題。
			if (user_list.length > 0
					&& CeL.wiki.parse.date(section_wikitext, wiki)) {
				CeL.debug('這段修改中有嵌入包含宣告<code>&lt;' + matched[1]
						+ '></code>，但是因為有發現簽名，因此不跳過。', 2);
			} else {
				// 但是既然加了，還是得提醒一下。
				check_log
						.push([
								gettext(
										// gettext_config:{"id":"skip-the-edit-for-including-wp-trans-transclusion-<code>&lt-$1&gt-<-code>"}
										'Skip the edit for including [[WP:TRANS|transclusion]] <code>&lt;%1&gt;</code>',
										matched[1]), section_wikitext ]);
				return;
			}
		}

		// --------------------------------------

		/** {Natural}下一個段落前最後一個不同之index。 */
		var last_diff_index_before_next_section = to_diff_end_index,
		// assert:to_next_diff_start_index >= 1
		to_next_diff_start_index = to_diff_end_index + 1;
		// 找出下一個段落前最後一個不同之處。
		for (var index = diff_index; ++index < row.diff.length;) {
			var to_diff_index = row.diff[index].index[1];
			if (!to_diff_index) {
				// 這一段變更只刪除了文字。
				continue;
			}
			to_next_diff_start_index = to_diff_index[1]
					|| to_next_diff_start_index;
			if (to_diff_index[1] >= next_section_index) {
				if (to_diff_index[0] < next_section_index) {
					// 下一段變更開始於段落標題之前。把簽名加在段落標題最前之前。
					last_diff_index_before_next_section = next_section_index - 1;
				}
				break;
			}
			if (to_diff_index[1] < next_section_index) {
				last_diff_index_before_next_section = to_diff_index[1];
				// 繼續檢查下一段變更。
			}
		}

		// --------------------------------------

		var last_token = row.diff.to[last_diff_index_before_next_section];

		// [[Wikipedia:签名]]: 簽名中必須至少包含該用戶的用戶頁、討論頁或貢獻頁其中一項的連結。
		if (user_list.length > 0) {
			if (user_list.includes(row.user)) {
				// has user link
				CeL.debug('直接跳過使用者 ' + row.user
						+ ' 編輯自己署名過的段落。但是這在編輯同一段落中其他人的發言時可能會漏判。', 2);
				return;
			}

			var from_user_hash = diff_pair[0] ? diff_pair[0].join('') : '';
			if (to_diff_end_index < last_diff_index_before_next_section) {
				// 加上到下一個段落之前相同的部分。但是請注意，這可能造成漏報。
				from_user_hash += row.diff.to.slice(to_next_diff_start_index,
						last_diff_index_before_next_section).join('');
			}
			from_user_hash = CeL.wiki.parse.user.all(from_user_hash);
			user_list = user_list.filter(function(user) {
				// 跳過對機器人的編輯做出的修訂。
				return !CeL.wiki.PATTERN_BOT_NAME.test(user)
				// 跳過搬移選舉結果。只有在原先文字中就存在的使用者，才可能是被修改到的。要不然就是本次編輯添加的，例如搬移選舉結果的情況。
				&& (user in from_user_hash);
			});
			// console.log([ from_user_hash, user_list ]);
			if (user_list.length > 0) {
				'%1'
				// [[mw:Extension:Echo#Usage]] e.g.,
				// "{{Ping|Name}}注意[[User:Name]]的此一編輯 --~~~~"
				// {{Ping}}模板通知必須搭配簽名（~~~~）
				+ ' 可能編輯了 %2'
				// e.g., 您創建的條目~~可能侵犯版權
				+ ' 署名的文字（也可能是用戶 %1'
				//
				+ ' 代簽名、幫忙修正錯誤格式、特意提及、搬移條目討論，或是還原/撤銷編輯）';

				check_log
						.push([
								gettext(
										// gettext_config:{"id":"maybe-user-$1-edit-text-signed-by-$2-or-$1-help-correcting-the-text"}
										'Maybe user %1 edit text signed by %2, or %1 help correcting the text',
										row.user, user_list.join(', ')),
								section_wikitext ]);
			} else {
				CeL.debug('在舊版的文字中並沒有發現簽名。或許是因為整段搬移貼上？', 2);
			}
			CeL.debug('終究是已經署名過了，因此不需要再處理。', 2);
			return;

		} else if (CeL.wiki.parse.user(CeL.wiki.title_link_of(row), row.user)) {
			CeL.debug('在編輯自己的用戶頁，並且沒有發現任何簽名的情況下就跳過。', 2);
			return;

		} else if (row.user.length >= (/^[ -\u007f]*$/.test(row.user) ? 4 : 2)
		// 有簽名，缺少連結。這項測試必須要用戶名稱夠長，以預防漏報。
		&& (new RegExp(CeL.to_RegExp_pattern(row.user)
		// e.g., [[w:zh:Special:Diff/45178923]]
		.replace(/[ _]/g, '[ _]'), 'i')).test(section_wikitext)
		// 測試假如有加入日期的時候。
		// {{Unsigned|user|2016年10月18日 (二) 00:04‎}}
		// {{Unsigned|1=user=user|2=2016年10月17日 (一) 23:45‎}}
		|| CeL.wiki.parse.date(last_token, wiki)) {
			// 但是若僅僅在文字中提及時，可能會被漏掉，因此加個警告做紀錄。
			check_log.push([ gettext(
			// gettext_config:{"id":"it-seems-the-user-$1-did-not-signed-with-link"}
			'It seems the user %1 did not signed with link.', row.user),
					section_wikitext ]);
			is_no_link_user = true;
			added_signs_or_notice++;
			return;
		}

		// --------------------------------------
		// 該簽名而未簽名。未簽補上簽名。

		added_signs_or_notice++;

		// 由使用者名稱來檢測匿名使用者/未註冊用戶 [[WP:IP]]
		// [[m:Special:MyLanguage/Tech/News/2021/05]]
		// 在diffs中，IPv6位址被寫成了小寫字母。這導致了死連結，因為Special:使用者貢獻只接受大寫的IP。這個問題已經被修正。
		var is_IP_user = CeL.is_IP(row.user);

		check_log
				.push([
						gettext(
								/([12]\d{3})年(1?\d)月([1-3]?\d)日 /
										.test(last_token) ?
								// gettext_config:{"id":"the-user-may-have-appended-date-and-signature-but-it-is-not-clear.-still-need-to-append-signature-for-$1-$2"}
								"The user may have appended date and signature, but it is not clear. Still '''need to append signature for %1 %2'''"
										// gettext_config:{"id":"need-to-append-signature-for-$1-$2"}
										: "'''Need to append signature for %1 %2'''",
								gettext(is_IP_user
								// gettext_config:{"id":"ip-user"}
								? 'IP user'
								// gettext_config:{"id":"user"}
								: 'user'),
								// <b>中不容許有另一個<b>，只能改成<span>。
								'<span style="color:blue">' + row.user
										+ '</span>')
						// 會有編輯動作時，特別加強色彩。可以只看著色的部分，這些才是真正會補簽名的。
						.replace(/'''(.+?)'''/,
								'<b style="color:orange">$1</b>'),
						// 一整段的文字。
						row.diff.to.slice(to_diff_start_index,
						//
						last_diff_index_before_next_section + 1).join('') ]);

		// 添加簽名。
		is_unsigned_user = true;

		// TODO: last_token 若為 URL 或 [[mw:Help:Magic links]]，則應該先空一格。
		// 但是因為 {{Unsigned}} 會從 HTML 標籤開始，因此就可以跳過這個步驟了。
		row.diff.to[last_diff_index_before_next_section] = last_token
		// {{subst:Unsigned|用戶名或IP|時間日期}}
		.replace(/([\s\n]*)$/, '{{' + (using_subst ? 'subst:' : '')
				+ 'Unsigned|' + row.user + '|' + get_parsed_time(row)
				+ (is_IP_user ? '|IP=1' : '') + '}}'
				// + '<!-- Autosigned by ' + wiki.token.login_user_name + ' -->'
				+ '$1');

		CeL.info('需要在最後補簽名的編輯: ' + CeL.wiki.title_link_of(row));
		console.log(row.diff.to.slice(to_diff_start_index,
				last_diff_index_before_next_section + 1).join(''));
		show_page(row);
		CeL.info('-'.repeat(75));
	}

	// -----------------------------------------------------
	// 處理有需要注意的頁面。

	if (check_log.length > 0) {
		if (CeL.is_debug()) {
			CeL.info(CeL.wiki.title_link_of(row) + ': 將可能修改了他人文字的編輯寫進記錄頁面 '
					+ CeL.wiki.title_link_of(log_to));
			CeL.info('-'.repeat(75));
		}
		check_log = check_log.map(function(log) {
			if (!Array.isArray(log)) {
				return log;
			}
			// 維基語法元素與包含換行的字串長
			log[0] += ' ' + gettext(
			// gettext_config:{"id":"($1-characters-modified)"}
			'(%1 {{PLURAL:%1|character|characters}} modified)', log[1].length)
					+ ':\n<pre><nowiki>';
			// 不需要顯示太多換行。
			log[1] = log[1].trim();
			var more = '';
			if (log[1].length > 80 * 2 + more_separator.length + 20) {
				more = more_separator + log[1].slice(-80);
				log[1] = log[1].slice(0, 80);
			}
			// escape
			return log[0] + log[1].replace(/</g, '&lt;')
			// 在<nowiki>中，-{}-仍有作用。
			.replace(/-{/g, '&#x2d;{') + more + '</nowiki></pre>';
		});
		check_log.unshift((row.revisions.length > 1
		// show diff link
		? '; [[Special:Diff/' + row.revid + '|' + row.title + ']]'
		// 新頁面
		: '; [[Special:Permalink/' + row.revid + '|' + row.title + ']] '
		// gettext_config:{"id":"(new-page)"}
		+ gettext('(new page)')
		//
		) + ': '
		// add [[Help:編輯摘要]]。
		+ (row.comment ? '<code><nowiki>' + row.comment
		//
		+ '</nowiki></code> ' : '')
		// add timestamp
		+ '--' + row.user + ' ' + get_parsed_time(row)
		//
		);

		if (write_to_log && added_signs_or_notice || test_mode) {
			// 有做動作的時候才記錄，避免記錄過於繁雜。
			wiki.page(log_to, {
				redirects : 1
			}).edit(check_log.join('\n* '), {
				section : 'new',
				sectiontitle : row.title,
				nocreate : 1,
				bot : 1,
				tags : edit_tags,
				summary : 'Signature check report of '
				// 在編輯摘要中加上使用者連結，似乎還不至於驚擾到使用者。
				+ '[[User:' + row.user + "]]'s edit in "
				//
				+ CeL.wiki.title_link_of(row.title)
				//
				+ ', [[Special:Diff/' + row.revid + ']].'
				//
				+ (added_signs_or_notice
				//
				? ' [[Need add sign or notice]]' : '')
			});
		}
	}

	if (!added_signs_or_notice) {
		CeL.debug('本次編輯不需要補上簽名或提醒。', 2);
		return;
	}

	if (test_mode) {
		CeL.debug('本次執行為測試模式，將不會寫入簽名或者提醒。', 0);
		return;
	}

	// -------------------------------------------

	if (is_no_link_user
			&& add_count(row, no_link_user_hash) >= notification_limit_count) {
		CeL.debug('用戶討論頁提示：如果留言者簽名沒有連結 ' + notification_limit_count
				+ ' 次以上，通知使用者記得要改變簽名。', 1);
		var pages_to_notify = get_pages_to_notify(row, no_link_user_hash);
		var message = '{{subst:'
				+ (project_name.startsWith('zh') ? 'Uw-signlink' : 'Uw-siglink')
				+ '|2='
				+ gettext(
						// gettext_config:{"id":"pages-that-are-not-linked-to-the-signature-such-as-$1.-thank-you-for-your-participation"}
						'Pages that are not linked to the signature, such as %1. Thank you for your participation.',
						pages_to_notify.join(', ')) + ' --~~~~}}';
		wiki
				.page('User talk:' + row.user, {
					redirects : 1
				})
				.edit(
						message,
						{
							// 若您不想接受機器人的通知、提醒或警告，請使用{{bots|optout=SIGN}}模板。
							notification_name : 'SIGN',
							section : 'new',
							sectiontitle : gettext(
							// gettext_config:{"id":"hi-maybe-you-can-change-the-format-of-your-signature"}
							'Hi, maybe you can change the format of your signature'),
							tags : edit_tags,
							summary : gettext(
									// gettext_config:{"id":"$1-remind-you-to-add-a-link-when-signing-such-as-the-$2-pages-listed-in-the-notification"}
									'[[%1|Remind you to add a link when signing]], such as the %2 {{PLURAL:%2|page|pages}} listed in the notification.',
									//
									log_to, pages_to_notify.length)
									// gettext_config:{"id":"if-you-have-updated-your-past-messages-please-add-a-signature-at-the-end"}
									+ gettext('If you have updated your past messages, please add a signature at the end.')
						});
	}

	// -------------------------------------------

	if (!is_unsigned_user) {
		return;
	}

	CeL.debug('為沒有署名的編輯添加簽名標記。', 2);
	// 若是row並非最新版，則會放棄編輯。
	wiki.page(row, {
		redirects : 1
	}).edit(row.diff.to.join(''), {
		// 若頁面不想有為署名的編輯添加簽名標記的功能。
		notification_name : 'SIGN',
		tags : edit_tags,
		nocreate : 1,
		minor : 1,
		// 補簽名的編輯加上bot flag，這樣可以不顯示討論頁面中次要編輯的新訊息提示 (nominornewtalk)。
		bot : 1,
		// TODO: add section_title
		// gettext_config:{"id":"$3-signing-special-diff-$1-comment-by-$2"}
		summary : gettext('[[%3|Signing]] [[Special:Diff/%1|comment by %2]].',
		//
		row.revid, row.user, log_to)
		// gettext_config:{"id":"this-tool-is-only-for-recording"}
		+ gettext('This tool is only for recording.')
		// gettext_config:{"id":"you-may-re-edit-the-text-whatever-you-want"}
		+ gettext('You may re-edit the text whatever you want.')
	});

	if (add_count(row, unsigned_user_hash) >= notification_limit_count) {
		CeL.debug('用戶討論頁提示：如果未簽名編輯了 ' + notification_limit_count
				+ ' 次，通知使用者記得簽名。', 1);
		var pages_to_notify = get_pages_to_notify(row, unsigned_user_hash);
		var message = '{{subst:'
				+ 'Uw-tilde'
				+ '|2='
				+ gettext(
						// gettext_config:{"id":"pages-that-may-require-a-signature-such-as-$1.-thank-you-for-your-participation"}
						'Pages that may require a signature, such as %1. Thank you for your participation.',
						pages_to_notify.join(', ')) + ' --~~~~}}';
		wiki.page('User talk:' + row.user, {
			redirects : 1
		}).edit(message, {
			// 若您不想接受機器人的通知、提醒或警告，請使用{{bots|optout=SIGN}}模板。
			notification_name : 'SIGN',
			section : 'new',
			sectiontitle : gettext(
			// gettext_config:{"id":"please-remember-to-sign-when-you-leave-messages"}
			'Please remember to sign when you leave messages'),
			tags : edit_tags,
			summary : gettext(
			// gettext_config:{"id":"$1-remind-to-sign-such-as-the-$2-pages-listed-in-the-notification"}
			'[[%1|Remind to sign]], such as the %2 pages listed in the notification.'
			//
			, log_to, pages_to_notify.length)
		});
	}

}
