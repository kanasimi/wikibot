/*

 topic list

2017/9/16 12:33:6	初版試營運。
 完成。正式運用。

@see [[zh:模块:沙盒/逆襲的天邪鬼/talkpage]], [[User:WhitePhosphorus-bot/RFBA_Status]]

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

/* eslint no-use-before-define: ["error", { "functions": false }] */
/* global CeL */
/* global Wiki */

// Set default language. 改變預設之語言。 e.g., 'zh'
// 採用這個方法，而非 Wiki(true, 'ja')，才能夠連報告介面的語系都改變。
// set_language('ja');
// set_language('en');
set_language('zh-classical');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, use_language === 'zh-classical' ? undefined : 'wikinews');

var talk_page = use_language === 'zh-classical' ? '維基大典:會館' : 'Wikinews:茶馆', topic_postfix = '/topic list';

// ----------------------------------------------------------------------------

// 當管理員的名單變更時需要重新執行!
var sysop_hash = CeL.null_Object();
wiki.allusers(function(list) {
	if (list.next_index) {
		throw 'Too many users so we do not get full list!';
	}
	// console.log(list);
	var sysop_list = [];
	list.forEach(function(user) {
		if (!user.groups.includes('bot')) {
			sysop_hash[user.name] = user.userid;
			sysop_list.push(user.name);
		}
	});
	CeL.log('All ' + sysop_list.length + ' sysops confirmed: '
			+ sysop_list.join(', ') + '.');
}, {
	// 取得管理員列表
	// https://www.mediawiki.org/w/api.php?action=help&modules=query%2Ballusers
	augroup : 'sysop|bureaucrat|steward|oversight',
	// The parameters "augroup" and "auexcludegroup" can not be used together.
	// auexcludegroup : 'bot',
	auprop : 'groups',
	limit : 'max'
});

// ----------------------------------------------------------------------------

if (false) {
	CeL.info('處理單一頁面 ' + CeL.wiki.title_link_of(talk_page) + ': 先取得頁面資料。');
	wiki.page(talk_page, generate_topic_list);
} else {
	wiki.page(talk_page, generate_topic_list);
	wiki.listen(generate_topic_list, {
		// start : new Date,

		// 延遲時間: 檢測到未簽名的編輯後，機器人會等待 .delay，以使用戶可以自行補簽。
		// 若是等待時間過長，可能會有其他人插入留言回覆。 [[Special:Diff/45941555]]
		delay : '0m',
		filter : talk_page,
		with_content : true,
		parameters : {
			// 跳過機器人所做的編輯。
			// You need the "patrol" or "patrolmarks" right
			// to request the patrolled flag.
			rcshow : '!bot',
			rcprop : 'title|ids|sizes|flags|user'
		},
		interval : '5s'
	});
}

/** {Number}一整天的 time 值。should be 24 * 60 * 60 * 1000 = 86400000. */
var ONE_DAY_LENGTH_VALUE = new Date(0, 0, 2) - new Date(0, 0, 1);

function local_number(number) {
	return use_language === 'zh-classical' ? number === 0 ? '無' : CeL
			.to_Chinese_numeral(number) : number;
}

function generate_topic_list(page_data) {
	var parser = CeL.wiki.parser(page_data).parse();
	if (CeL.wiki.content_of(page_data) !== parser.toString()) {
		console.log(CeL.LCS(CeL.wiki.content_of(page_data), parser.toString(),
				'diff'));
		throw 'parser error';
	}

	var section_table = [
			'{| class="wikitable sortable collapsible"',
			'|-',
			use_language === 'zh-classical' ? '! 序 !! 議題 !! 覆 !! 用戶 !! 近易 !! 有秩 !! 有秩近易'
					// 序號 Topics
					: '! # !! 話題 !! 回應 !! 最後發言 !! 最後更新 !! 管理員發言 !! 管理員更新' ];
	parser.each_section(function(section, index) {
		function show_name_dates(last_update_index) {
			// None, N/A
			var user = '', date = '', style;
			if (last_update_index >= 0) {
				var days = (new Date - section.dates[last_update_index])
						/ ONE_DAY_LENGTH_VALUE;
				style = days > 7 ? 'background-color:#bbb;' : '';
				user = section.users[last_update_index];
				date = CeL.wiki.parse.date.to_String(
						section.dates[last_update_index], wiki);
			} else {
				style = 'background-color:#ff4;';
			}
			style = style ? 'style="' + style + '" | ' : '';
			row.push(style + user, style + date);
		}

		if (index === 0) {
			// 跳過設定與公告區。
			return;
		}
		// console.log('#' + section.section_title);
		// console.log([ section.users, section.dates ]);
		var row = [ local_number(index) ];
		row.push('| [[' + talk_page + '#' + section.section_title.title + '|'
				+ section.section_title.title + ']]',
		//
		section.replies ? local_number(section.replies)
				: 'style="background-color:#f44;" | ' + local_number(0));

		show_name_dates(section.last_update_index);

		show_name_dates(parser.each_section
				.last_user_index(section, sysop_hash));

		section_table.push('|-\n| ' + row.join(' || '));
	}, {
		get_users : true,
		// set options[KEY_SESSION] for parse_date()
		session : wiki
	});

	section_table.push('|}');

	wiki.page(talk_page + topic_postfix)
	// TODO: CeL.wiki.array_to_table(section_table)
	.edit(section_table.join('\n'), {
		bot : 1,
		nocreate : 1,
		summary : 'generate topic list'
	})
	// 更新主頁面。
	.purge(talk_page);
}
