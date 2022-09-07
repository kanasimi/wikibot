/*

Add topic list to talk page. 增加討論頁面主題列表。為議論增目錄。トピックリスト 見やすい議題一覧の作成。

jstop cron-20170915.topic_list.zh;
jstop cron-20170915.topic_list.zh-classical;
jstop cron-20170915.topic_list.wikinews;
jstop cron-20170915.topic_list.ja;
jstop cron-20170915.topic_list.en;
jstop cron-20170915.topic_list.wikisource;
jstop cron-20170915.topic_list.wikiversity;
jstop cron-20170915.topic_list.commons;
jstop cron-20170915.topic_list.moegirl;
jstop cron-20170915.topic_list.wiktionary;
jstop cron-20170915.topic_list.wikibooks;

/usr/bin/jstart -N cron-20170915.topic_list.zh -mem 2g -once -quiet /usr/bin/node /data/project/toc/wikibot/routine/20170915.topic_list.js use_language=zh
/usr/bin/jstart -N cron-20170915.topic_list.zh-classical -mem 2g -once -quiet /usr/bin/node /data/project/toc/wikibot/routine/20170915.topic_list.js use_language=zh-classical
/usr/bin/jstart -N cron-20170915.topic_list.wikinews -mem 2g -once -quiet /usr/bin/node /data/project/toc/wikibot/routine/20170915.topic_list.js use_project=wikinews
/usr/bin/jstart -N cron-20170915.topic_list.ja -mem 2g -once -quiet /usr/bin/node /data/project/toc/wikibot/routine/20170915.topic_list.js use_language=ja
/usr/bin/jstart -N cron-20170915.topic_list.en -mem 2g -once -quiet /usr/bin/node /data/project/toc/wikibot/routine/20170915.topic_list.js use_language=en
/usr/bin/jstart -N cron-20170915.topic_list.wikisource -mem 2g -once -quiet /usr/bin/node /data/project/toc/wikibot/routine/20170915.topic_list.js use_project=wikisource
/usr/bin/jstart -N cron-20170915.topic_list.wikiversity -mem 2g -once -quiet /usr/bin/node /data/project/toc/wikibot/routine/20170915.topic_list.js use_project=wikiversity
/usr/bin/jstart -N cron-20170915.topic_list.commons -mem 2g -once -quiet /usr/bin/node /data/project/toc/wikibot/routine/20170915.topic_list.js use_project=commons
/usr/bin/jstart -N cron-20170915.topic_list.moegirl -mem 2g -once -quiet /usr/bin/node /data/project/toc/wikibot/routine/20170915.topic_list.js use_project=zhmoegirl
/usr/bin/jstart -N cron-20170915.topic_list.wiktionary -mem 2g -once -quiet /usr/bin/node /data/project/toc/wikibot/routine/20170915.topic_list.js use_project=wiktionary
/usr/bin/jstart -N cron-20170915.topic_list.wikibooks -mem 2g -once -quiet /usr/bin/node /data/project/toc/wikibot/routine/20170915.topic_list.js use_project=zh.wikibooks

2017/9/10 22:31:46	開始計畫。
2017/9/16 12:33:6	初版試營運。
2017/9/24 13:56:48	using page_configurations
2017/10/10 16:17:28	完成。正式運用。
2019/4/22 10:17:2	分割頁面設定至 './special page configuration.js'。


@see [[w:zh:模块:沙盒/逆襲的天邪鬼/talkpage]], [[wikiversity:zh:模块:Talkpage]], [[w:zh:User:WhitePhosphorus-bot/RFBA_Status]],
 [[w:ja:Wikipedia:議論が盛んなノート]],
 https://zh.moegirl.org.cn/Widget:TalkToc ($('#toc'))
 https://meta.wikimedia.org/wiki/Tech/News/2018/13/zh	已被棄用的#toc和#toctitle CSS ID將會被移除。如果您的wiki仍在使用它們作為假目錄，那麼它們將失去應有樣式。如有需要可以替換為.toc和.toctitle CSS類。




計票機器人:
時間截止時先插入截止標示，預告何時結束選舉、開始計票(過1小時)。讓選民不再投票，開始檢查作業。等到人工檢查沒問題時，確認此段最後的編輯時間超過1小時，再close掉。
若是不想要由機器人處理，您可事先手動處理，或者回覆{{tl|Stop}}模板。
孵化期:提名超過1小時候，等待孵化才開始各種審查作業。
{{投票設定
|支持模板=
|反對模板=
|投票資格=autoconfirmed + 50 edits + registered 7 days <!-- [[en:Wikipedia:Protection policy]], 巡查員, 回退員, [[Wikipedia:人事任免投票資格]], 原作者則不能支持自己的作品 -->
|期限
|延長期=30,30 <!-- 日 -->
|通過處理=
|未通過處理= <!-- 存檔至頁面 存檔至提案條目的討論頁底部。移除替換標籤模板  -->
}}



TODO:
Flow 的問題是不支援繁簡轉換，沒有在大流量頁面嘗試過。長篇內容是否合適Flow還真不清楚。排版還是不夠靈活。難以處理需要修訂版本刪除的編輯。
https://commons.wikimedia.org/wiki/Commons:Bots/Work_requests
https://zh.moegirl.org.cn/Talk:%E8%AE%A8%E8%AE%BA%E7%89%88
'zhwiki:Wikipedia:机器人/提议'
https://zh.wikipedia.org/wiki/Wikipedia:%E6%9C%BA%E5%99%A8%E4%BA%BA/%E6%8F%90%E8%AE%AE
https://en.wikipedia.org/wiki/Wikipedia:Bots/Requests_for_approval
https://en.wikipedia.org/wiki/Wikipedia:Bot_requests


TODO:
討論議題列表可以放在另外一頁，也可以在當前頁面中。
可以在 __TOC__ , __NEWSECTIONLINK__ 之後才開始檢查 main_talk_pages
相關發言者訂閱功能 via ping
get 發言 time via revisions information
自動計算投票票數 [[模板:RFX count]]
[[Template:topic_list]]

archive topics:
可以依照指示存檔到不同的page
	存檔可以用編號為主或者以日期,"丁酉年"為主
	可以自動把文字分到新的子頁面
存檔完可以留下索引，等到特定的日子/特定的天數之後再刪除
存檔完可以直接刪除，只留下oldid

延遲應該在十數分鐘內。現行設定若寫入失敗2次，程式就會重啟。
已知無法解決問題：目前 MediaWiki 之 link anchor, display_text 尚無法接受"�"這個特殊字元。

@see [[w:zh:Module:Talkpage]] {{ #invoke:Talkpage | analyse | titlelevel=3 |WikiProject_talk:电子游戏 | type=topic | userlink=[[U:$USER|$USER]] }}
 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

/* eslint no-use-before-define: ["error", { "functions": false }] */
/* global CeL */
/* global Wiki */

login_options.configuration_adapter = adapt_configuration;

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),

/** {Object}設定頁面所獲得之手動設定 manual settings。 === wiki.latest_task_configuration */
configuration,

edit_tags = wiki.API_URL.includes('moegirl') ? 'Bot' : '',

// Will get page title from wikidata
botop_sitelinks = {
	enwiki : {
		title : 'Category:Wikipedia bot operators'
	}
}, max_date_length = 34;

// ----------------------------------------------

global.localized_page_configuration = {
	zh : {
		row_style : general_row_style
	}
};
global.localized_page_configuration =
// global.localized_page_configuration[CeL.wiki.site_name(wiki)] ||
global.localized_page_configuration[use_language];

function set_update_timer(page_title, time_ms, callback) {
	if (callback) {
		setTimeout(function() {
			wiki.page(page_title, pre_fetch_sub_pages).run(callback);
		}, time_ms);
	} else {
		setTimeout(wiki.page.bind(wiki, page_title, pre_fetch_sub_pages),
				time_ms);
	}
}
global.set_update_timer = set_update_timer;

global.FC_vote_configurations = {
	vote_closed_listener : function() {
		wiki.page(this.title, pre_fetch_sub_pages);
	},
};
Object.assign(global, require('../special page configuration.js'));

// ----------------------------------------------

function CSS_toString(CSS) {
	if (!CSS)
		return '';

	var style = [];
	if (CSS.style) {
		// e.g., "text-decoration: line-through"
		style.push(CSS.style);
	}

	for ( var attribute_name in {
		color : true,
		'background-color' : true
	}) {
		if (CSS[attribute_name])
			style.push(attribute_name + ': ' + CSS[attribute_name]);
	}

	return style.join('; ');
}

// 討論議題列表可以挑選的欄位。
var section_column_operators = {
	// function: .call(page_data, section, section_index)
	NO : function(section, section_index) {
		if (/* force */true || !(section_index >= 1)) {
			// e.g., [[w:zh:Wikipedia:机器人/申请]]
			// CeL.info('NO_counter: ' + this.page.NO_counter);
			if (!this.page.NO_counter)
				this.page.NO_counter = 0;
			// var section_title = section.section_title;
			// var page_configuration = this.page.page_configuration;
			// console.log([ section_index, section_title, page_configuration
			// ]);
			section_index = ++this.page.NO_counter;
			// section.section_index 序號可能因 section_filter，沒有連號。
			if (false && section.section_index >= 1)
				section_index = section.section_index;
		}
		return local_number(section_index);
	},
	// 議題的標題。
	title : function(section) {
		// [[Template:Small]]
		function small_title(title, set_small) {
			// call function section_link_toString(page_title, style)
			title = title.toString(null, CSS_toString(section.CSS));
			return set_small ? '<small>' + title + '</small>' : title;
		}

		var section_title = section.section_title;
		var title = section_title.link, adding_link;
		// 當標題過長時，縮小標題字型。
		var title_too_long = if_too_long(section.section_title.title), style = title_too_long;
		// console.trace(CeL.wiki.section_link(title));
		// console.trace(section.section_title);
		title = small_title(title, title_too_long);

		var page_configuration = this.page.page_configuration;

		// console.log(section);
		if (configuration.closed_style.show_subtopic
		// 顯示次級連結。
		&& (adding_link = section.adding_link)) {
			// console.log(adding_link);
			if (adding_link.type === 'section_title') {
				// 對於還沒完全結案的議題，箭頭指向還在討論的部分。
				title_too_long = if_too_long('→' + adding_link.title);
				adding_link = adding_link.link;
			} else {
				// 對於已經移動的議題，箭頭指向移動的目標頁面。
				// assert: is page title
				adding_link = adding_link.toString();
				if (!adding_link.includes('#')) {
					// 嘗試自動添加和章節標題相同的討論段落anchor。
					// [1]: hack
					// @see section_link_toString() @ CeL.wiki
					adding_link += '#' + section.section_title.link[1];
				}
				var display_text = adding_link.replace(/#.*$/, '');
				title_too_long = if_too_long(display_text);
				adding_link = CSS_toString(section.CSS) ? '[[' + adding_link
						+ '|<span style="' + CSS_toString(section.CSS) + '">'
						+ display_text + '</span>]]' : CeL.wiki.title_link_of(
						adding_link, display_text);
			}
			if (title_too_long) {
				style = true;
			}
			title += '<br />→' + small_title(adding_link, title_too_long);

		} else if (Array.isArray(page_configuration.level_filter)
				&& section_title.level > page_configuration.level_filter[0]) {
			title = '\n' + ':'.repeat(section_title.level
			// 處理次標題的 indent 縮進。
			- page_configuration.level_filter[0]) + ' ' + title;
		}

		if (style) {
			style = 'max-width: ' + (page_configuration.max_title_display_width
			// 限制標題欄的寬度。要考慮比較窄的螢幕。
			|| configuration.general.max_title_display_width || '24em');
		} else
			style = '';
		// style += CSS_toString(section.CSS);

		return (style ? 'style="' + style + '" | ' : '') + title;
	},
	// discussions conversations, 發言次數, 発言数
	discussions : function(section) {
		var sign_count = section.users.length;
		var page_configuration = this.page.page_configuration;
		// 其實是計算簽名與日期的數量。因此假如機器人等權限申請的部分多了一個簽名，就會造成多計算一次。
		// 發言數量固定減去此數。
		var discussion_minus = page_configuration.discussion_minus;
		if (sign_count > 0 && discussion_minus > 0) {
			sign_count = Math.max(0, sign_count - discussion_minus);
		}

		return local_number(sign_count,
		// 火熱的討論採用不同顏色。
		sign_count >= 10 ? 'style="background-color: #ffe;"' : section.archived
				|| section.moved || sign_count >= 2 ? ''
				: 'style="background-color: #fcc;"');
	},
	// 參與討論人數 participation
	participants : function(section) {
		return local_number(section.users.unique().length, section.archived
				|| section.moved || section.users.unique().length >= 2 ? ''
				: 'style="background-color: #fcc;"');
	},
	// reply, <small>回應</small>, <small>返答</small>, 返信数, 覆
	replies : function(section) {
		// 有不同的人回應才算上回應數。
		return local_number(section.replies, section.archived || section.moved
				|| section.replies >= 1 ? ''
				: 'style="background-color: #fcc;"');
	},
	created : function(section) {
		// TODO: the datetime the subpage created
	},
	// word count
	words : function(section) {
		return CeL.count_word(section.toString());
	}
};

function traversal_all_pages() {
	main_talk_pages.forEach(function(page_title) {
		wiki.page(page_title, pre_fetch_sub_pages);
	});
	if (false) {
		wiki.run(function() {
			CeL.info('traversal_all_pages:');
			console.log(main_talk_pages);
		});
	}
}

// ----------------------------------------------

var had_adapted;

// 讀入手動設定 manual settings。
function adapt_configuration(latest_task_configuration) {
	configuration = latest_task_configuration;
	// console.log(configuration);
	// console.log(wiki);
	adapt_configuration_to_page(configuration);

	// 一般設定
	var general = configuration.general
			|| (configuration.general = Object.create(null));
	if (!general) {
		CeL.info('No configuration.');
	}

	if (general.stop_working && general.stop_working !== 'false') {
		CeL.info('stop_working setted. exiting...');
		// 加入排程，避免運作到一半出問題的情況。
		wiki.run(function() {
			process.exit(2);
		});
		return;
	}

	// 檢查從網頁取得的設定，檢測數值是否合適。
	general.max_title_length |= 0;
	if (!(general.max_title_length > 4 && general.max_title_length < 80)) {
		delete general.max_title_length;
	}

	if (!/^\d{1,2}(?:em|en|%)$/.test(general.max_title_display_width)) {
		delete general.max_title_display_width;
	}

	var configuration_now = configuration.list_style
			|| (configuration.list_style = Object.create(null));
	for ( var attribute_name in configuration_now) {
		var style = configuration_now[attribute_name];
		if (!/^#?[\da-f]{3,6}$/i.test(style)) {
			delete configuration_now[attribute_name];
			continue;
		}
		if (attribute_name in short_to_long) {
			short_to_long[attribute_name] = style;
		} else if (attribute_name in long_to_short) {
			long_to_short[attribute_name] = style;
		}
	}

	configuration_now = configuration.closed_style
			|| (configuration.closed_style = Object.create(null));
	for ( var attribute_name in {
		link_color : true,
		link_backgroundColor : true
	}) {
		var style = configuration_now[attribute_name];
		if (!/^#?[\da-f]{3,6}$/i.test(style)) {
			delete configuration_now[attribute_name];
			continue;
		}
	}
	for ( var attribute_name in {
		line_CSS : true,
		link_CSS : true
	}) {
		var style = configuration_now[attribute_name];
		// 簡單的檢核，還不夠完善！
		if (style && style.includes('"')) {
			delete configuration_now[attribute_name];
			continue;
		}
	}
	if (configuration_now.show_subtopic === 'false') {
		configuration_now.show_subtopic = JSON
				.parse(configuration_now.show_subtopic);
	} else {
		configuration_now.show_subtopic = !!configuration_now.show_subtopic;
	}

	// setup_list_legend();

	function adapt_listen_to_page(page_title) {
		var page_config = configuration_now[page_title];
		var use_project = CeL.wiki.site_name(wiki);
		if (!page_title.startsWith(use_project))
			page_title = use_project + ':' + page_title;
		if (page_configurations[page_title]) {
			// Skip existed page.
			return;
		}

		// console.trace([ page_title, page_config, globalThis.use_project ]);
		if (page_config) {
			// e.g., {"need_time_legend":false}
			if (!global.special_page_configuration[page_config]) {
				if (!CeL.is_Object(page_config)) {
					CeL.error(
					//
					'adapt_configuration: Invalid page configuration for '
					//
					+ CeL.wiki.title_link_of(page_title) + ': ' + page_config);
					page_config = null;
				}
			}
		} else if (use_project in global.special_page_configuration) {
			page_config = use_project;
		}

		CeL.info('+ Listen to page: '
				+ CeL.wiki.title_link_of(page_title)
				+ (page_config ? ' using configuration plan: '
						+ (typeof page_config === 'string' ? page_config : JSON
								.stringify(page_config)) : ''));
		if (global.special_page_configuration[page_config]) {
			page_config = global.special_page_configuration[page_config];
		}
		// console.log(page_config);
		page_configurations[page_title] = page_config ? Object.assign(Object
				.create(null), general_page_configuration, page_config)
				: general_page_configuration;
	}

	// 顯示主題列表之頁面。
	configuration_now = configuration.listen_to_pages
			|| (configuration.listen_to_pages = Object.create(null));
	if (configuration_now) {
		Object.keys(configuration_now).forEach(adapt_listen_to_page);
	}

	CeL.log('Configuration:');
	console.log(configuration);

	if (had_adapted) {
		// 每次更改過設定之後重新生成一輪討論頁面主題列表。
		traversal_all_pages();
	} else {
		had_adapted = true;
	}
}

// ----------------------------------------------

// main talk pages / discussion pages **of this wiki**
var main_talk_pages = [], sub_page_to_main = Object.create(null);

var special_users;

// ----------------------------------------------------------------------------
// main

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
prepare_directory(base_directory);

// CeL.set_debug(6);

// 用戶相關功能，避免延遲回應以使用戶等待。
delete CeL.wiki.query.default_maxlag;

// 設定 `session.max_badtoken_count = 0` ，那麼只要登入一出問題就直接跳出。
wiki.max_badtoken_count = 0;

wiki.run(start_main_work);

function start_main_work() {
	// for debug: 僅處理此頁面
	if (false) {
		page_configurations = {
			'zhwiki:Wikipedia:互助客栈/技术' : general_page_configuration
		};
	}

	Object.keys(page_configurations).forEach(function(wiki_and_page_title) {
		var matched = wiki_and_page_title.match(/^([^:]+):(.+)$/),
		//
		use_project = CeL.wiki.site_name(wiki);
		if (matched[1] === use_project) {
			main_talk_pages.push(matched[2]);
			page_configurations[wiki_and_page_title].project = use_project;
		}
	});

	get_special_users.log_file_prefix = base_directory + 'special_users.';

	// for debug: 僅處理此頁面
	if (false) {
		main_talk_pages = [ 'Wikipedia:新条目推荐/候选', 'Wikipedia:典范条目评选/提名区',
				'Wikipedia:特色列表评选/提名区', 'Wikipedia:優良條目評選/提名區' ];
	}
	// main_talk_pages = [ 'Wikipedia:優良條目評選/提名區' ];
	// main_talk_pages = [ 'Wikipedia:新条目推荐/候选' ];
	// main_talk_pages = [ 'Wikipedia:特色列表评选/提名区' ];
	// main_talk_pages = [ 'Wikipedia:典范条目评选/提名区' ];
	// main_talk_pages = [ 'Wikipedia:特色圖片評選' ];
	// main_talk_pages = [ 'Wikipedia:井戸端' ];
	// main_talk_pages = [ 'Wikipedia:削除依頼/ログ/先週', 'Wikipedia:削除依頼/ログ/先々週' ];
	// main_talk_pages = [ 'Wikipedia:机器人/申请' ];
	// main_talk_pages = [ 'Wikipedia:已删除内容查询' ];
	// main_talk_pages = [ 'Wikipedia:互助客栈/其他' ];
	// main_talk_pages = [ 'Wikipedia:互助客栈/技术' ];
	// main_talk_pages = [ 'Wikipedia:互助客栈/条目探讨' ];
	// main_talk_pages = [ 'Wikipedia:Bot/使用申請' ];
	// main_talk_pages = [ '萌娘百科 talk:讨论版/页面相关' ];
	// main_talk_pages = [ 'Wikipedia:可靠来源/布告板' ];

	// ----------------------------------------------------

	// console.trace(main_talk_pages);
	if (main_talk_pages.length > 0) {
		CeL.info(main_talk_pages.length + ' page(s) to listen for '
				+ CeL.wiki.site_name(wiki) + ': '
				+ main_talk_pages.map(function(title) {
					return CeL.wiki.title_link_of(title);
				}).join(', '));
	} else {
		CeL.error('No talk page to process for ' + CeL.wiki.site_name(wiki)
				+ '!');
	}

	function main_process(_special_users) {
		special_users = global.special_users = _special_users;

		// 首先生成一輪討論頁面主題列表。
		traversal_all_pages();
		// return;

		wiki.listen(pre_fetch_sub_pages, {
			// start : new Date,

			// 延遲時間
			// [[Wikipedia‐ノート:井戸端#節ごとの発言数・参加者数・最終更新日時などの表(topic list)について]]
			// 検出後30秒ほどのタイムラグを設けて
			delay : CeL.wiki.site_name(wiki) === 'jawiki' ? '30s' : 0,
			// [[w:zh:WikiProject talk:电子游戏]]
			namespace : 'project|project talk|talk|WikiProject talk',
			filter : main_talk_pages,
			with_content : true,
			// language : use_language,
			// options.use_SQL: Try to use SQL. Use SQL as possibile.
			// commonswiki 得要使用 API 才不會漏。
			use_SQL : [ 'commonswiki', 'enwiki' ].includes(CeL.wiki
					.site_name(wiki)),
			parameters : {
				// 跳過機器人所做的編輯。
				// You need the "patrol" or "patrolmarks" right to request the
				// patrolled flag.
				// rcshow : '!bot',
				rcprop : 'title|ids|sizes|flags|user'
			},
			interval : '5s'
		});
	}

	new CeL.wiki(null, null, 'en').page(botop_sitelinks.enwiki, {
		redirects : 1
	}).data(function(entity) {
		// console.log(entity);
		// throw 'botop_sitelinks';
		get_special_users(main_process, {
			botop_sitelinks : entity.sitelinks
		});
	});

}

// ----------------------------------------------------------------------------

// TODO: 將此功能轉到 wiki.js 中。

// 取得特定使用者名單(hash): 當使用者權限變更時必須重新執行程式！
function get_special_users(callback, options) {
	var botop_sitelinks = options && options.botop_sitelinks;
	if (!botop_sitelinks) {
		throw new Error('No botop_sitelinks get!');
	}

	var special_users = Object.create(null), full_group_name = {
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

	function get_allusers(group_name, augroup, callback) {
		// reset
		special_users[group_name] = Object.create(null);
		wiki.allusers(function(list) {
			if (list.next_index) {
				throw 'Too many users so we do not get full list of '
						+ group_name + '!';
			}
			// console.log(list);
			list.forEach(function(user_data) {
				if (group_name === 'bot'
				// concrete users, 排除掉所有機器人。
				|| !user_data.groups.includes('bot')) {
					special_users[group_name][user_data.name] = user_data;
				}
			});
			note_special_users(group_name);
			if (callback) {
				callback();
			}
		}, {
			augroup : augroup || group_name,
			auprop : 'groups',
			// The parameters "augroup" and "auexcludegroup" cannot be used
			// together.
			// auexcludegroup : 'bot',
			limit : 'max'
		});
	}

	// 必須先取得bot這個群組以利後續檢查排除掉所有機器人。
	get_allusers('bot');
	get_allusers('bureaucrat', 'bureaucrat|steward|suppress', function() {
		// 行政員以上可利用[[Special:Makebot]]核可機器人權限，為當然成員。
		special_users.BAG = Object.clone(special_users.bureaucrat);
	});
	// 取得管理員列表。
	// https://www.mediawiki.org/w/api.php?action=help&modules=query%2Ballusers
	get_allusers('admin', 'sysop|bureaucrat|steward|suppress');

	// [[WP:BAG]], [[Wikipedia:Bot Approvals Group]], [[維基百科:機器人審核小組]]
	// TODO: 這裡的篩選方法會把頁面中所有的使用者都納入這個群體，包括不活躍與離職的。
	// TODO: using [[Template:BAG_topicon]]
	wiki.page('Project:BAG', function(page_data) {
		var title = CeL.wiki.title_of(page_data),
		/**
		 * {String}page content, maybe undefined. 條目/頁面內容 =
		 * CeL.wiki.revision_content(revision)
		 */
		content = CeL.wiki.content_of(page_data);

		if (!content) {
			// 沒有特別設置BAG群組。
			special_users.no_BAG = true;
			return;
		}

		var user_hash = CeL.wiki.parse.user.all(content);
		for ( var user_name in user_hash) {
			if (user_name && !is_bot_user(user_name, null, special_users)) {
				special_users.BAG[user_name] = true;
			}
		}

		var matched,
		// 注意: 這個方法會把不活躍成員和離任成員也都列進去。
		PATTERN_template_user = /{{ *user *\| *([^#\|\[\]{}\/]+)/ig;

		while (matched = PATTERN_template_user.exec(content)) {
			var user_name = CeL.wiki.normalize_title(matched[1]);
			if (user_name && !is_bot_user(user_name, null, special_users)) {
				special_users.BAG[user_name] = true;
			}
		}

		note_special_users('BAG');
	}, {
		redirects : 1
	});

	var botop_page = CeL.wiki.site_name(wiki);
	if (botop_page in CeL.wiki.api_URL.wikimedia) {
		// e.g., .site of 'commons' is 'commonswiki'
		botop_page += 'wiki';
	}
	botop_page = botop_sitelinks[botop_page];
	if (botop_page && (botop_page = botop_page.title)) {
		// reset
		special_users.botop = Object.create(null);
		// TODO: {{bot|bot operator}}, {{Infobox bot}}
		wiki.categorymembers(botop_page, function(list) {
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
				if (user_name && !is_bot_user(user_name, null, special_users)) {
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
		CeL.fs_write(get_special_users.log_file_prefix
				+ CeL.wiki.site_name(wiki) + '.json', JSON
				.stringify(special_users));
		callback(special_users);
	});
}

// ----------------------------------------------
// row_style functions

function general_row_style(section, section_index) {
	var style, to_exit = this.each.exit,
	// archived, move_to 兩者分開，避免{{Archive top}}中有{{Moveto}}
	archived = section.archived && 'archived', move_to = section.moved
			&& 'moved';

	// console.trace(section);
	this.each.call(section, function(token) {
		if (token.type === 'transclusion'
		// 本主題全部或部分段落文字，已移動至...
		&& (/^Moved? ?to$/i.test(token.name) || (token.name in {
			'Moved discussion to' : true,
			Switchto : true,
			移動至 : true
		}))) {
			move_to = 'moved';
			section.adding_link = token.parameters[1];
			return;
		}

		if (token.type === 'transclusion' && (token.name in {
			// zhmoegirl: 標記已完成討論串的模板別名列表
			MarkAsResolved : true,
			MAR : true,
			标记为完成 : true
		})) {
			// style = '';
			// 此模板代表一種決定性的狀態，可不用再檢查其他內容。
			return to_exit;
		}

		if (token.type === 'transclusion' && (token.name in {
			// zhwiki: 下列討論已經關閉，請勿修改。
			'Archive top' : true,
			// 本框內討論文字已關閉，相關文字不再存檔。
			TalkH : true,
			// 本討論已經結束。請不要對這個存檔做任何編輯。
			TalkendH : true,
			Talkendh : true
		})) {
			archived = 'start';
			delete section.adding_link;
			return;
		}

		if (archived === 'start'
		//
		&& token.type === 'transclusion' && (token.name in {
			// 下列討論已經關閉，請勿修改。
			'Archive bottom' : true,
			// 本框內討論文字已關閉，相關文字不再存檔。
			TalkF : true,
			// 本討論已經結束。請不要對這個存檔做任何編輯。
			TalkendF : true,
			Talkendf : true
		})) {
			archived = 'end' && 'archived';
			// 可能拆分為許多部分討論，但其中只有一小部分結案。繼續檢查。
			return;
		}

		if ((archived === 'archived' || move_to === 'moved')
				&& token.toString().trim()) {
			// console.log(token);
			if (move_to === 'moved') {
				move_to = 'extra';
				delete section.adding_link;
			}
			if (archived === 'archived') {
				// 在結案之後還有東西。重新設定。
				// console.log('在結案之後還有東西:');
				archived = 'extra';
				if (token.type === 'section_title') {
					section.adding_link = token;
				}
			}
			// 除了 {{save to}} 之類外，有多餘的 token 就應該直接跳出。
			// return to_exit;
		}

	}, 1);

	// console.log('archived: ' + archived);
	// console.log('move_to: ' + move_to);
	if (archived === 'archived' || move_to === 'moved') {
		section.CSS = {
			// 已移動或結案的議題，整行文字顏色。 現在已移動或結案的議題，整行會採用相同的文字顏色。
			style : configuration.closed_style.link_CSS,
			color : configuration.closed_style.link_color,
			'background-color' : configuration.closed_style.link_backgroundColor
		};

		// 已移動或結案的議題之顯示格式
		return configuration.closed_style.line_CSS ? 'style="'
				+ configuration.closed_style.line_CSS + '"' : '';

		// 把"下列討論已經關閉"的議題用深灰色顯示。
		'style="background-color: #ccc;"'
		// 話題加灰底會與「更新圖例」裡面的說明混淆
		&& 'style="text-decoration: line-through;"'
		// 將完成話題全灰. "!important": useless
		&& 'style="color: #888;"'
		// 一般來說，色塊填滿應該不會超出框線，而且也不會影響框線本身的顏色
		&& 'style="opacity: .8;"';
	}

	return style || '';
}

// ----------------------------------------------

// 討論議題列表依狀態表現不同的背景顏色。
// time → style
var short_to_long = {
	// 最近1小時內: 淺綠色。
	'1h' : 'efe',
	// 超過1小時到最近1日內: 淺藍色。
	'1d' : 'eef'
}, long_to_short = {
	// 超過一個月: 深灰色。
	'1 month' : 'bbb',
	// 超過一禮拜到一個月: 淺灰色。
	'1w' : 'ddd'
}, list_legend = {
	en : {
		header : 'Legend',
		'1h' : 'In the last hour',
		'1d' : 'In the last day',

		'' : 'In the last week',
		'1w' : 'In the last month',
		'1 month' : 'More than one month'
	},
	zh : {
		header : '發言更新圖例',
		'1h' : '最近一小時內',
		'1d' : '最近一日內',

		'' : '一週內',
		'1w' : '一個月內',
		'1 month' : '逾一個月'
	},
	ja : {
		header : '発言更新の凡例',
		'1h' : '一時間以内',
		'1d' : '一日以内',

		'' : '一週間以内',
		'1w' : '一ヶ月以内',
		'1 month' : '一ヶ月以上'
	}
};

// assert: 多次執行不會再改變其值
function normalize_time_style_hash(time_style_hash) {
	// console.log(time_style_hash);
	for ( var time_interval in time_style_hash) {
		var style = time_style_hash[time_interval];
		if (style.includes('style=')) {
			continue;
		}
		if (/^[\da-f]{3,6}$/i.test(style)) {
			// treat as RGB color code
			style = '#' + style;
		}
		if (style.startsWith('#')) {
			// treat as background-color
			time_style_hash[time_interval] = 'style="background-color: '
					+ style + ';" ';
		}
	}
	// console.log(time_style_hash);
}

function setup_list_legend_special_status(list_legend_used) {
	// @see general_row_style()
	var guide = configuration.closed_style.line_CSS ? '| ' + 'style="'
			+ configuration.closed_style.line_CSS + '" ' : '';

	// TODO: CSS_toString(section.CSS)
	if (configuration.closed_style.show_subtopic) {
		guide += '| 討論議題' + '<br />→'
		// 已移動至目標頁面
		+ '<small>已移至頁面/最新討論子項</small>';
	} else {
		guide += '| 已移動至其他頁面<br />或完成討論之議題';
	}

	guide = [ '! 特殊狀態', '|-', guide, '|-' ].join('\n');

	list_legend_used[list_legend_used.special_status_index] = guide;
}

function get_list_legend(page_configuration) {
	// Must run normalize_time_style_hash() for short_to_long, long_to_short
	// first!

	var localized_list_legend = list_legend[use_language]
	// e.g., 'zh-classical'
	|| use_language && use_language.startsWith('zh-') && list_legend.zh
	// e.g., 'commons'
	|| list_legend.en;
	// setup list_legend_used
	var list_legend_used = [
			'{| class="'
					+ (page_configuration.list_legend_class
							|| general_page_configuration.list_legend_class || '')
					+ '" style="'
					+ (page_configuration.list_legend_style
							|| general_page_configuration.list_legend_style || '')
					// {{#if:檢查字串|有值時輸出|無值時輸出}}
					+ ';{{#if:{{{no_time_legend|}}}|display:none;|}}' + '"',
			// TODO: .header 應該用 caption
			// title: 相對於機器人最後一次編輯
			'! title="From the latest bot edit" | '
					+ localized_list_legend.header, '|-' ];

	for ( var time_interval in localized_list_legend) {
		if (time_interval === 'header') {
			continue;
		}
		list_legend_used.push('| ' + (short_to_long[time_interval]
		//
		|| long_to_short[time_interval] || '') + ' |\n* '
				+ localized_list_legend[time_interval], '|-');
	}

	list_legend_used.special_status_index = list_legend_used.length;
	list_legend_used.push('');
	if (use_language === 'zh') {
		setup_list_legend_special_status(list_legend_used);
	}

	if (configuration.configuration_page_title) {
		// @see general_row_style()
		list_legend_used.push('! '
		//
		+ (use_language === 'zh' ? '手動設定' : 'Manual settings'), '|-',
		//
		'| style="max-width: 12em;" | <small>'
		//
		+ (use_language === 'zh' ? '當列表出現異常時，<br />請先檢查[['
		// 設定頁面
		+ configuration.configuration_page_title + '|設定]]是否有誤'
		//
		: 'When exceptions occur,<br />please check [['
		//
		+ configuration.configuration_page_title
		// the setting page
		+ '|the setting]] first.') + '</small>', '|-');
	}

	// {{clearright}}, {{-}}
	list_legend_used.push('|}');
	if (!page_configuration.no_tail_clear)
		list_legend_used.push('{{Clear}}');

	return list_legend_used;
}

// for 討論議題列表可以挑選欄位: (特定)使用者(最後)留言時間
// e.g., last_user_set, last_admin_set
function add_user_name_and_date_set(section, user_and_date_index) {
	var user_shown = '', date = '';
	if (user_and_date_index >= 0) {
		var parsed = this;
		date = section.dates[user_and_date_index];
		if (true) {
			// 採用短日期格式。
			date = date.format({
				format : (date.getFullYear() === (new Date).getFullYear()
				// Skip year?
				? '' || '%Y-' : '%Y-')
				//
				+ '%2m-%2d ' + (CSS_toString(section.CSS)
				// 已經設定整行 CSS 的情況下，就不另外表現 CSS。
				? '%2H:%2M' : '<span style="color: blue;">%2H:%2M</span>'),
				// 採用當個項目最多人所處的時區。
				zone : parsed.page.page_configuration.timezone || 0
			});
			// 因為不確定閱覽者的時區，因此不能夠再做進一步的處理，例如 CeL.date.indicate_date_time() 。
		} else {
			// 採用簽名的日期格式。
			date = CeL.wiki.parse.date.to_String(date, wiki);
		}
		var date_too_long = if_too_long(date);
		date = data_sort_attributes(section.dates[user_and_date_index]) + '| '
		// TODO: linking date to [[Special:Diff/]]
		+ (date_too_long ? '<small>' + date + '</small>' : date);

		// 討論議題列表依狀態表現不同的背景顏色。
		var additional_attributes = '', timevalue_diff = (new Date - section.dates[user_and_date_index]);
		for ( var time_interval in short_to_long) {
			if (timevalue_diff < CeL.to_millisecond(time_interval)) {
				// add style
				additional_attributes = short_to_long[time_interval];
				break;
			}
		}
		if (!additional_attributes) {
			for ( var time_interval in long_to_short) {
				if (timevalue_diff > CeL.to_millisecond(time_interval)) {
					// add style
					additional_attributes = long_to_short[time_interval];
					break;
				}
			}
		}

		var user_name = section.users[user_and_date_index];
		// 16: IPv4 user
		user_shown = user_name.length < 16 ? user_name
		// 縮小太長的使用者名稱。
		: '<small style="word-wrap: break-word; word-break: break-all;">'
		//
		+ (CeL.is_IP(user_name, true)
		// shorten IPv6 addresses.
		? user_name.replace(
		//
		/^([\da-f]{1,4}):[\da-f:]+:([\da-f]{1,4}:[\da-f]{1,4})$/i,
		//
		'$1...$2') : user_name) + '</small>';

		// TODO: link to diff
		user_shown = (additional_attributes ? '| ' : '')
		// 對於匿名IP用戶則顯示編輯紀錄。
		+ (CeL.is_IP(user_name)
		//
		? '[[Special:Contributions/' : '[[User:') + user_name + '|'
		//
		+ (CSS_toString(section.CSS) || CeL.is_IP(user_name)
		//
		? '<span style="'
		//
		+ (CeL.is_IP(user_name) ? 'color: #f82;' : '')
		//
		+ CSS_toString(section.CSS) + '">' + user_shown + '</span>'
		//
		: user_shown) + ']]';

	} else {
		// 沒有發現此 user group 之發言。
		additional_attributes = 'style="background-color: #ffd;" | ';
	}

	return [ additional_attributes + user_shown, additional_attributes + date ];
}

// cache
var section_index_filter = CeL.wiki.parser.parser_prototype.each_section.index_filter;
function get_column_operators(page_configuration) {
	var column_operators = page_configuration.column_operators;
	if (Array.isArray(column_operators)) {
		return column_operators;
	}

	column_operators = typeof page_configuration.columns === 'string'
	// 預防直接輸入{Array}。
	? page_configuration.columns.split(';') : page_configuration.columns;

	column_operators = column_operators.map(function(value_type) {
		// column operators
		var operator = page_configuration.operators
				&& page_configuration.operators[value_type]
				|| section_column_operators[value_type];
		if (operator) {
			return operator;
		}

		var matched = value_type.replace(/[ _]+/g, '_')
		// [ all, date type, user group filter, output type ]
		.match(/^(first|last)_(.*?)(?:_(set|name|date))?$/i),
		//
		user_group_name, user_group_filter;

		if (matched) {
			if (!matched[2] || matched[2].toLowerCase() === 'user') {
				user_group_name = 'user';
				// accept all users
				user_group_filter = true;
			} else {
				user_group_name = matched[2] in special_users
				// e.g., 'BAG'
				? matched[2] : matched[2].toLowerCase();
				user_group_filter = special_users[user_group_name];
			}
		}

		if (!user_group_filter) {
			throw 'get_column_operators: Unknown value type: ' + value_type;
		}

		var twist_filter = page_configuration.twist_filter
				&& page_configuration.twist_filter[user_group_name],
		//
		date_type = matched[1].toLowerCase(), output_type = matched[3]
				.toLowerCase();
		return function(section) {
			var index;
			if (date_type === 'last' && user_group_filter === true) {
				index = section.last_update_index;
			} else {
				index = section_index_filter(section,
				// this: parsed;
				// page_configuration = this.page.page_configuration;
				twist_filter ? twist_filter.call(this, section,
						user_group_filter) : user_group_filter, date_type);
			}

			if (output_type === 'set'
			//
			&& !('need_time_legend' in page_configuration)) {
				page_configuration.need_time_legend = true;
			}

			return output_type === 'set'
			// this: parsed
			? add_user_name_and_date_set.call(this, section, index)
			//
			: output_type === 'date' ? section.dates[index]
					: section.users[index];
		};
	});

	// cache
	page_configuration.column_operators = column_operators;
	return column_operators;
}

// ----------------------------------------------------------------------------

function pre_fetch_sub_pages(page_data, error) {
	CeL.debug((new Date).format() + ' 處理頁面 '
			+ CeL.wiki.title_link_of(page_data), 1, 'pre_fetch_sub_pages');
	if (!page_data) {
		console.trace(page_data);
	}
	if (page_data.title in sub_page_to_main) {
		CeL.debug('更改了子頁面，得要重新處理主要頁面。', 1, 'pre_fetch_sub_pages');
		wiki.page(sub_page_to_main[page_data.title], pre_fetch_sub_pages);
		return;
	}

	var page_configuration = page_data.page_configuration
	//
	= page_configurations[CeL.wiki.site_name(wiki) + ':' + page_data.title];

	if (page_configuration.update_at) {
		// 定時更新 Refresh page automatically
		var timezone = page_configuration.timezone;
		// 以 .timezone 為基準的時分秒 '0:0:0'
		timezone = timezone ? ' UTC'
				+ (timezone > 0 ? '+' + timezone : timezone) : '';
		var next_date = '%Y-%2m-%2d ' + page_configuration.update_at.time
				+ timezone;
		next_date = (new Date).format(next_date);
		var timeout = Date.parse(next_date) - Date.now();
		/** {Number}一整天的 time 值。should be 24 * 60 * 60 * 1000 = 86400000. */
		var ONE_DAY_LENGTH_VALUE = new Date(0, 0, 2) - new Date(0, 0, 1);
		if (timeout < 0) {
			timeout += ONE_DAY_LENGTH_VALUE;
		}
		CeL.debug('於 ' + CeL.age_of(0, timeout, {
			digits : 1
		}) + ' 後檢查 ' + CeL.wiki.title_link_of(page_data) + '。基準時間：' + next_date
				+ '（多在此時間後 ' + CeL.age_of(0, ONE_DAY_LENGTH_VALUE, {
					digits : 1
				}) + ' 檢查）', 1);
		setTimeout(function() {
			// 更新所嵌入的頁面。通常是主頁面。
			wiki.purge(page_configuration.purge_page || page_data.title);
			wiki.page(page_data.title, pre_fetch_sub_pages);
		}, timeout);
	}

	var parsed = CeL.wiki.parser(page_data, {
		preprocess_section_link_token
		//
		: page_configuration.preprocess_section_link_token,
		language : use_language
	}).parse();
	if (!parsed) {
		return [
				CeL.wiki.edit.cancel,
				'No contents: ' + CeL.wiki.title_link_of(page_data)
						+ '! 沒有頁面內容！' ];
	}

	if (CeL.wiki.content_of(page_data) !== parsed.toString()) {
		// debug 用. check parser, test if parser working properly.
		console.log(CeL.LCS(CeL.wiki.content_of(page_data), parsed.toString(),
				'diff'));
		throw new Error('Parser error: ' + CeL.wiki.title_link_of(page_data));
	}

	if (!page_configuration) {
		// for debug
		CeL.error('Cannot get page_configuration for '
				+ CeL.wiki.site_name(wiki) + ':' + page_data.title);
	}

	if (!page_configuration.transclusion_target) {
		generate_topic_list(page_data);
		return;
	}

	// console.log(page_data.parsed);

	// let page_configuration.transclusion_target get pages
	page_data.wiki = wiki;

	var task_list = [], token_list = [];
	// check transclusions
	parsed.each('transclusion', function(token, index, parent) {
		// transclusion page title
		var page_title_task = page_configuration.transclusion_target.call(
				page_data, token);
		if (!page_title_task) {
			return;
		}
		task_list.push(Promise.resolve(page_title_task));
		token.index = index;
		token.parent = parent;
		token_list.push(token);
	}, false,
	// Only check the first level. 只檢查第一層之 transclusion。
	1);

	Promise.all(task_list).then(detect_sub_pages_to_fetch.bind({
		page_data : page_data,
		token_list : token_list,
		transclusions : 0,

		// sub_pages_to_fetch[index] = page_title
		sub_pages_to_fetch : [],
		// insert_into_token[index] = token to insert sub_page
		insert_into_token : [],
		// transclusion_section[index] = section title of sub_page
		transclusion_section : [],
		// title_to_indexes[page_title] = [ index of sub_pages_to_fetch, ... ]
		title_to_indexes : Object.create(null)
	}));
}

function detect_sub_pages_to_fetch(page_title_list, error) {
	if (error) {
		CeL.error('detect_sub_pages_to_fetch: Error occurred.');
		CeL.error(error);
		return;
	}
	var _this = this;
	var sub_pages_to_fetch = this.sub_pages_to_fetch;
	var title_to_indexes = this.title_to_indexes;
	// console.log(page_title_list);

	function add_page_title(page_title, token, index) {
		var index = sub_pages_to_fetch.length;
		if (Array.isArray(page_title)) {
			// [ page_title, section_title ]
			var section_title = page_title[1];
			if (section_title) {
				_this.transclusion_section[index] = section_title;
			}
			page_title = page_title[0];
		}

		page_title = CeL.wiki.normalize_title(page_title);
		// CeL.log('add_page_title: ' + CeL.wiki.title_link_of(page_title));
		_this.insert_into_token.push(index >= 0 ? [ token, index ] : token);
		sub_pages_to_fetch.push(page_title);
		if (!title_to_indexes[page_title])
			title_to_indexes[page_title] = [ index ];
		else
			title_to_indexes[page_title].push(index);
	}

	page_title_list.forEach(function(page_title, index) {
		if (!page_title) {
			return;
		}

		var token = this.token_list[index];
		if (Array.isArray(page_title) && page_title.multi) {
			page_title.forEach(function(_page_title, index) {
				var normalized_page_title = CeL.wiki
						.normalize_title(_page_title);
				if (_page_title !== normalized_page_title) {
					// e.g., for Error: 取得了未設定的頁面:
					// [[Wikipedia:削除依頼/横浜市立十日市場中学校]]
					// @ [[Wikipedia:削除依頼/ログ/2019年10月29日]]
					page_title[index] = normalized_page_title;
				}
				add_page_title(normalized_page_title, token, index);
			});
		} else {
			add_page_title(page_title, token);
		}
	}, this);

	if (sub_pages_to_fetch.length === 0) {
		generate_topic_list(this.page_data);
		return;
	}

	// 處理要含入並且監視的頁面。
	CeL.debug(sub_pages_to_fetch.length + ' pages to load:\n'
			+ sub_pages_to_fetch.join('\n'), 1, 'pre_fetch_sub_pages');

	wiki.work({
		no_edit : true,
		log_to : null,
		redirects : 1,
		// insert page contents and re-parse
		each : for_each_sub_page.bind(this),
		last : insert_sub_pages.bind(this)
	}, Object.keys(title_to_indexes));
}

function listen_to_sub_page(sub_page_data, main_page_data) {
	var sub_page_title = CeL.wiki.title_of(sub_page_data);
	// assert: !!(sub_page_title && main_page_data) === true
	if (!sub_page_title || !main_page_data) {
		throw new Error(
				'listen_to_sub_page: Invalid sub_page_data or main_page_data!');
	}
	if (sub_page_title in sub_page_to_main) {
		return;
	}

	// 有嵌入其他議題/子頁面的，也得一併監視。
	main_talk_pages.push(sub_page_title);
	if (sub_page_title !== main_page_data.title) {
		sub_page_to_main[sub_page_title] = main_page_data.title;
		// CeL.debug('listen_to_sub_page: ' + 'sub_page_to_main: ');
		// console.log(sub_page_to_main);
	} else {
		CeL.warn('listen_to_sub_page: '
				+ 'The sub-page has the same name with its main-page: '
				+ CeL.wiki.title_link_of(sub_page_title));
	}
}

global.listen_to_sub_page = listen_to_sub_page;

function for_each_sub_page(sub_page_data/* , messages, config */) {
	var sub_page_title = sub_page_data.original_title || sub_page_data.title,
	//
	indexes = this.title_to_indexes[sub_page_title];
	if (!indexes) {
		// console.log(sub_page_data);
		// console.log(this.title_to_indexes);
		throw new Error('取得了未設定的頁面: ' + CeL.wiki.title_link_of(sub_page_data));
	}
	// CeL.info('for_each_sub_page: ' + CeL.wiki.title_link_of(sub_page_data));
	listen_to_sub_page(sub_page_data, this.page_data);

	this.sub_page_data = sub_page_data;
	this.sub_page_title = sub_page_title;
	indexes.forEach(for_each_sub_page_index, this);
	delete this.sub_page_data;
	delete this.sub_page_title;
}

function for_each_sub_page_index(index) {
	var token = this.insert_into_token[index];
	var insert_into_index;
	if (Array.isArray(token)) {
		insert_into_index = token[1];
		token = token[0];
	}

	var transclusion_section = this.transclusion_section[index];
	var content;
	if (transclusion_section) {
		// Support for section transclusion
		var parsed = CeL.wiki.parser(this.sub_page_data);
		parsed.each_section(function(section, section_index) {
			if (false) {
				console.log([ transclusion_section,
				//
				section.section_title && section.section_title.title ]);
			}
			if (section.section_title
			//
			&& section.section_title.title === transclusion_section) {
				content = section.section_title + section;
			}
		});
	} else {
		content = CeL.wiki.content_of(this.sub_page_data);
	}

	content = '\n{{Transclusion start|' + this.sub_page_title + '}}\n'
	// 其他提醒的格式可以參考
	// https://www.mediawiki.org/w/api.php?action=help&modules=expandtemplates
	// <!-- {{Template}} starts -->...<!-- {{Template}} end -->
	+ (content || '') + '\n{{Transclusion end|' + this.sub_page_title + '}}\n';

	var token_to_replace = token.parent[token.index];
	if (token_to_replace === token) {
		// 首次設定，直接取代。
		if (insert_into_index >= 0) {
			token = token.parent[token.index] = [];
			token.toString = function() {
				return this.join('');
			};
			// 照原先的次序插入。
			token[insert_into_index] = content;
		} else {
			token.parent[token.index] = content;
		}

	} else if (insert_into_index >= 0
			&& !(insert_into_index in token.parent[token.index])) {
		// 之前已經被變更過，照原先的次序插入。
		// assert: 單一 token 引入了多個頁面。
		// assert: (insert_into_index in token.parent[token.index]) === false
		token.parent[token.index][insert_into_index] = content;
	} else {
		throw new Error('原先的 token 已被變更過!');
	}

	this.transclusions++;
}

function insert_sub_pages() {
	if (false) {
		CeL.info('insert_sub_pages:');
		console.log(main_talk_pages);
	}

	// Run after all list got.
	var page_data = this.page_data;
	if (this.transclusions > 0) {
		// content changed. re-parse
		CeL.wiki.parser(page_data, {
			preprocess_section_link_token
			//
			: page_data.page_configuration.preprocess_section_link_token,
			wikitext : page_data.use_wikitext = page_data.parsed.toString()
		}).parse();
	}
	// console.trace(page_data.use_wikitext);

	generate_topic_list(page_data);
}

// ----------------------------------------------------------------------------
// 生成菜單的主函數

var exit_program_timer;

function generate_topic_list(page_data) {
	// setup_list_legend
	normalize_time_style_hash(short_to_long);
	normalize_time_style_hash(long_to_short);
	// console.log(page_configuration);
	// console.log(general_page_configuration);
	// console.trace(CeL.wiki.content_of(page_data));

	var parsed = CeL.wiki.parser(page_data),
	//
	page_configuration = page_data.page_configuration, TOC_list = [],
	//
	section_table = [
			page_configuration.page_header,
			'<!-- '
					+ (use_language
					// e.g., 'zh-classical'
					&& use_language.startsWith('zh') ? '本頁面由機器人自動更新。若要改進，請聯繫機器人操作者。'
							: 'This page is auto-generated by bot. Please contact the bot operator to improve the tool.')
					+ ' -->',
			'{| class="' + (page_configuration.header_class
			// plainlinks autocollapse
			|| 'wikitable sortable mw-collapsible') + '"  style="'
					+ (page_configuration.table_style || 'float:left;') + '"'
					+ (page_configuration.additional_header || ''), '|-',
			generate_headers(page_configuration) ],
	//
	column_operators = get_column_operators(page_configuration),
	//
	topic_count = 0, new_topics = [];

	if (false) {
		console.trace(parsed);
		console.trace(parsed.each_section());
		parsed.each_section(function(section, section_index) {
			CeL.info('generate_topic_list: ' + section.section_title);
		});
	}
	parsed.each_section(function(section, section_index) {
		// CeL.info('generate_topic_list: ' + section.section_title);
		// console.log(section.users);
		// console.log(section.dates);
		// console.log(section);
		if (section_index >= 12) {
			// console.log(section);
		}
		if (false && section.section_title
		//
		&& section.section_title.toString().includes('中文Vocaloid编辑团队')) {
			console.log(section);
		}

		if (!section.section_title) {
			// 跳過頁首設定與公告區。
			return;
		}

		if (page_configuration.section_filter
		// 篩選議題。亦可將此功能當作 page_configuration.section_preprocessor。
		// this: parsed;
		// page_configuration = this.page.page_configuration;
		&& !page_configuration.section_filter.call(parsed, section)) {
			return;
		}

		topic_count++;

		// console.log('#' + section.section_title);
		// console.log([ section.users, section.dates ]);
		var row = [], row_style = (
		//
		typeof page_configuration.row_style === 'function'
		//
		? page_configuration.row_style.call(parsed, section, section_index)
		//
		: page_configuration.row_style) || '';

		column_operators.forEach(function(operator) {
			// using this.page.page_configuration
			var values = operator.call(parsed, section, section_index);
			if (Array.isArray(values)) {
				row.append(values);
			} else {
				row.push(values);
			}
		});

		Object.assign(row, {
			style : row_style,
			section : section
		});
		TOC_list.push(row);

		// new_topics的操作放在最後，讓column_operators可以更改section.section_title.title。
		if (Date.now() - section.dates[section.last_update_index] < CeL
				.to_millisecond('1m')) {
			new_topics.push(section.section_title.title);
		}
	}, {
		get_users : true,
		level_filter : page_configuration.level_filter,
		// set options[KEY_SESSION] for parse_date()
		session : wiki
	});

	if (false) {
		parsed.each(function(token) {
			console.log(token);
		}, {
			modify : false,
			max_depth : 1
		});
	}

	if (page_configuration.sort_function)
		TOC_list.sort(page_configuration.sort_function);
	TOC_list.forEach(function(row) {
		section_table.push('|-' + row.style + '\n| '
		// 為了應付像處理次標題的 indent 縮進 的情況，不可用 `.join(' || '))`。
		+ row.join('\n| '));
	});
	section_table.push('|}');
	if (page_configuration.need_time_legend) {
		// 解説文を入れて 色違いが何を示しているのかがわかる
		section_table.append(get_list_legend(page_configuration));
	}

	if (page_configuration.postfix) {
		// {Array}section_table
		page_configuration.postfix(section_table);
	}

	// 討論議題列表放在另外一頁。
	var topic_page = page_configuration.topic_page;
	if (topic_page.startsWith('/')) {
		topic_page = page_data.title + topic_page;
	}

	if (false) {
		console.log(section_table.join('\n'));
		throw 'generate_topic_list: No edit';
	}

	if (new_topics.length < 3) {
		new_topics = new_topics.map(function(topic) {
			return CeL.wiki.title_link_of(
			//
			page_data.title + '#' + topic, topic);
		});
	}

	wiki.page(topic_page, {
		redirects : 1
	}).edit(
	// TODO: CeL.wiki.array_to_table(section_table)
	section_table.join('\n').trim(), {
		bot : 1,
		nocreate : 1,
		tags : edit_tags,
		summary : CeL.wiki.title_link_of(
		//
		configuration.configuration_page_title,
		// gettext_config:{"id":"generate-topic-list-$1-topics"}
		CeL.gettext('Generate topic list: %1 {{PLURAL:%1|topic|topics}}',
		// -1: 跳過頁首設定與公告區。
		topic_count))
		//
		+ (new_topics.length > 0
		//
		? '; new reply: ' + new_topics.join(', ') : '')
	}, function(data, error) {
		if (error)
			return;
		clearTimeout(exit_program_timer);
		exit_program_timer = setTimeout(function() {
			CeL.error('經過一整天都無成功的編輯！直接跳出！');
			process.exit();
		}, CeL.to_millisecond('1d'));
	})
	// 更新所嵌入的頁面。通常是主頁面。
	.purge(page_configuration.purge_page || page_data.title);
}
