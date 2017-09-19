/*

 Add topic list to talk page. 增加討論頁面主題列表。為議增目錄。

2017/9/10 22:31:46	開始計畫。
2017/9/16 12:33:6	初版試營運。
 完成。正式運用。


node 20170915.topic_list.js
node 20170915.topic_list.js use_language=zh-classical

@see [[zh:模块:沙盒/逆襲的天邪鬼/talkpage]], [[User:WhitePhosphorus-bot/RFBA_Status]]




TODO:
Flow 的問題是不支援繁簡轉換，沒有在大流量頁面嘗試過。長篇內容是否合適Flow還真不清楚。排版還是不夠靈活。難以處理需要修訂版本刪除的編輯。
https://ja.wikipedia.org/wiki/Wikipedia:Bot%E4%BD%9C%E6%A5%AD%E4%BE%9D%E9%A0%BC
https://ja.wikipedia.org/wiki/Wikipedia:%E4%BA%95%E6%88%B8%E7%AB%AF
https://commons.wikimedia.org/wiki/Commons:Bots/Work_requests
https://zh.moegirl.org/Talk:%E8%AE%A8%E8%AE%BA%E7%89%88
https://zh-classical.wikipedia.org/wiki/%E7%B6%AD%E5%9F%BA%E5%A4%A7%E5%85%B8:%E6%9C%83%E9%A4%A8
https://zh.wikipedia.org/wiki/Wikipedia:%E4%BA%92%E5%8A%A9%E5%AE%A2%E6%A0%88/%E6%8A%80%E6%9C%AF
https://zh.wikipedia.org/wiki/Wikipedia:%E6%9C%BA%E5%99%A8%E4%BA%BA/%E4%BD%9C%E4%B8%9A%E8%AF%B7%E6%B1%82
https://zh.wikipedia.org/wiki/Wikipedia:%E6%9C%BA%E5%99%A8%E4%BA%BA/%E6%8F%90%E8%AE%AE
https://zh.wikipedia.org/wiki/Wikipedia:%E6%9C%BA%E5%99%A8%E4%BA%BA/%E7%94%B3%E8%AF%B7
https://en.wikipedia.org/wiki/Wikipedia:Bots/Requests_for_approval
https://en.wikipedia.org/wiki/Wikipedia:Bot_requests
https://zh.wikinews.org/wiki/Wikinews:%E8%8C%B6%E9%A6%86

TODO:
討論議題列表可以放在另外一頁，也可以在當前頁面中。
討論議題列表可以挑選欄位:議題的標題，發起人與發起時間(Created)，最後留言者與最後時間(Last editor)，特定使用者最後留言與最後時間(e.g., Last BAG editor)，議體進度狀態(Status:Approved for trial/Trial complete/Approved/...)
可以在 __TOC__ , __NEWSECTIONLINK__ 之後才開始檢查
相關發言者訂閱功能


archive
可以依照指示存檔到不同的page
	存檔可以用編號為主或者以日期,"丁酉年"為主
	可以自動把文字分到新的子頁面
存檔完可以留下索引，等到特定的日子/特定的天數之後再刪除
存檔完可以直接刪除，只留下oldid



 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

/* eslint no-use-before-define: ["error", { "functions": false }] */
/* global CeL */
/* global Wiki */

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, use_language === 'zh-classical' ? undefined : 'wikinews');

var talk_page = use_language === 'zh-classical' ? '維基大典:會館' : 'Wikinews:茶馆',
// 討論議題列表放在另外一頁。
topic_postfix = '/topic list';

// TODO: get page from wikidata
var botop_page = {
	jawiki : 'Botを運用しているウィキペディアン',
	zhwiki : '維基百科機器人所有者',
	zhwikinews : '維基新聞機器人所有者',
	enwiki : 'Wikipedia bot operators'
};

// ----------------------------------------------------------------------------

// 特定使用者名單(hash): 當使用者權限變更時必須重新執行程式！
var special_users = CeL.null_Object(), full_group_name = {
	bureaucrat : 'bureaucrats',
	botop : 'bot operators',
	bot : 'bots',
	admin : 'administrators'
};

function note_special_users(group_name) {
	var user_name_list = Object.keys(special_users[group_name]).sort();
	CeL.log('All ' + user_name_list.length + ' '
			+ (full_group_name[group_name] || group_name) + ' confirmed: '
			+ user_name_list.join(', ') + '.');
}

function get_allusers(group_name, augroup) {
	// reset
	special_users[group_name] = CeL.null_Object();
	wiki.allusers(function(list) {
		if (list.next_index) {
			throw 'Too many users so we do not get full list of ' + group_name
					+ '!';
		}
		// console.log(list);
		list.forEach(function(user_data) {
			if (group_name === 'bot' || !user_data.groups.includes('bot')) {
				special_users[group_name][user_data.name] = user_data;
			}
		});
		note_special_users(group_name);
	}, {
		augroup : augroup || group_name,
		auprop : 'groups',
		// The parameters "augroup" and "auexcludegroup" can not be used
		// together.
		// auexcludegroup : 'bot',
		limit : 'max'
	});
}

get_allusers('bot');
get_allusers('bureaucrat', 'bureaucrat|steward|oversight');
// 取得管理員列表
// https://www.mediawiki.org/w/api.php?action=help&modules=query%2Ballusers
get_allusers('admin', 'sysop|bureaucrat|steward|oversight');

// [[WP:BAG]], [[Wikipedia:Bot Approvals Group]], [[維基百科:機器人審核小組]]
wiki.page('WP:BAG', function(page_data) {
	var title = CeL.wiki.title_of(page_data),
	/**
	 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
	 */
	content = CeL.wiki.content_of(page_data);

	if (!content) {
		// 行政員可利用[[Special:Makebot]]核可機器人權限。
		special_users.BAG = special_users.bureaucrat;
		special_users.no_BAG = true;
		return;
	}

	// reset
	special_users.BAG = CeL.null_Object()

	var user_hash = CeL.wiki.parse.user.all(content);
	for ( var user_name in user_hash) {
		if (user_name && !(user_name in special_users.bot)
				&& !/bot/i.test(user_name)) {
			special_users.BAG[user_name] = true;
		}
	}

	var matched, PATTERN_template_user = /{{ *user *\| *([^#\|\[\]{}\/]+)/ig;

	while (matched = PATTERN_template_user.exec(content)) {
		var user_name = CeL.wiki.normalize_title(matched[1]);
		if (user_name && !(user_name in special_users.bot)
				&& !/bot/i.test(user_name)) {
			special_users.BAG[user_name] = true;
		}
	}

	note_special_users('BAG');
}, {
	redirects : 1,
});

if (botop_page[CeL.wiki.site_name(wiki)]) {
	// reset
	special_users.botop = CeL.null_Object();
	// [[Category:Wikipedia bot operators]]
	// TODO: {{bot|bot operator}}, {{Infobox bot}}
	wiki.categorymembers(botop_page[CeL.wiki.site_name(wiki)], function(list) {
		if (list.next_index) {
			throw 'Too many users so we do not get full list!';
		}
		// console.log(list);
		var user_namespace = CeL.wiki.namespace('user');
		list.forEach(function(user_data) {
			if (user_data.ns !== user_namespace
					|| /[#\|\[\]{}\/]/.test(user_data.title)) {
				return;
			}
			var user_name = user_data.title.replace(/^[^:]+:/, '');
			if (user_name && !(user_name in special_users.bot)
					&& !/bot/i.test(user_name)) {
				special_users.botop[user_name] = user_data;
			}
		});
		note_special_users('botop');
	}, {
		limit : 'max'
	});
}

wiki.run(function() {
	// cache the special users
	CeL.fs_write('special_users.' + CeL.wiki.site_name(wiki) + '.json', JSON
			.stringify(special_users));
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

// [[en:Help:Sorting#Specifying_a_sort_key_for_a_cell]]
var table_heads = {
	'zh-classical' : '! data-sort-type="number" | 序 !! 議題 !! data-sort-type="number" | 覆 !! data-sort-type="number" | 參議 !! 末議者 !! data-sort-type="isoDate" | 新易 !! 有秩 !! data-sort-type="isoDate" | 有秩新易',
	// 序號 Topics主題 participants
	zh : '! # !! 話題 !! <small>回應</small> !! <small title="參與討論人數">參與</small> !! 最後發言 !! data-sort-type="isoDate" | 最後更新 !! 管理員發言 !! data-sort-type="isoDate" | 管理員更新'
};

function data_sort(key) {
	var type;
	if (typeof key === 'number') {
		type = 'number';
	} else if (CeL.is_Date(key)) {
		type = 'isoDate';
		key = key.toISOString();
	}

	key = 'data-sort-value="' + key + '" ';
	if (type) {
		key = 'data-sort-type="' + type + '" ' + key;
	}
	return key;
}

function local_number(number, attributes) {
	if (use_language === 'zh-classical') {
		return (attributes ? attributes + ' ' : '')
		//
		+ 'data-sort-value="' + number + '" | '
		// None, N/A
		+ (number === 0 ? '無' : CeL.to_Chinese_numeral(number));
	}
	return (attributes ? attributes + ' | ' : '') + number;
}

function generate_topic_list(page_data) {
	var parser = CeL.wiki.parser(page_data).parse();
	if (CeL.wiki.content_of(page_data) !== parser.toString()) {
		console.log(CeL.LCS(CeL.wiki.content_of(page_data), parser.toString(),
				'diff'));
		throw 'parser error';
	}

	var section_table = [ '{| class="wikitable sortable collapsible"', '|-',
			table_heads[use_language] ];

	parser.each_section(function(section, index) {
		function add_name_and_date(last_update_index) {
			var user = '', date = '', additional_attributes;
			if (last_update_index >= 0) {
				var days = (new Date - section.dates[last_update_index])
						/ ONE_DAY_LENGTH_VALUE;
				date = CeL.wiki.parse.date.to_String(
						section.dates[last_update_index], wiki);
				var date_too_long = date.display_width() > 34;
				date = data_sort(section.dates[last_update_index]) + '| '
				//
				+ (date_too_long ? '<small>' + date + '</small>' : date);
				additional_attributes
				// 討論議題列表依狀態表現不同的顏色
				= days > 31 ? 'style="background-color:#bbb;" '
				//
				: days > 7 ? 'style="background-color:#ddd;" '
				//
				: 24 * days < 1 ? 'style="background-color:#ddf;" ' : '';
				user = (additional_attributes ? '| ' : '') + '[[User:'
						+ section.users[last_update_index] + '|]]';
			} else {
				// 沒有發現此 user group 之發言。
				additional_attributes = 'style="background-color:#ff4;" | ';
			}
			row
					.push(additional_attributes + user, additional_attributes
							+ date);
		}

		if (index === 0) {
			// 跳過設定與公告區。
			return;
		}
		// console.log('#' + section.section_title);
		// console.log([ section.users, section.dates ]);
		var title = section.section_title.title,
		// 當標題過長時，縮小標題字型。
		title_too_long = title.display_width() > 40,
		//		
		row = [
				local_number(index),
				(title_too_long ? '<small>' : '') + '[[' + talk_page + '#'
						+ title + '|' + title + ']]'
						+ (title_too_long ? '</small>' : ''),
				local_number(section.replies, section.replies >= 1 ? ''
						: 'style="background-color:#fcc;"'),
				local_number(section.users.unique().length) ];
		// 發言次數: section.users.length
		// 發起人: section.users[0]

		add_name_and_date(section.last_update_index);

		add_name_and_date(parser.each_section.last_user_index(section,
				special_users.admin));

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
		summary : 'generate topic list: ' + parser.sections.length + ' topics'
	})
	// 更新主頁面。
	.purge(talk_page);
}
