/*

Add topic list to talk page. 增加討論頁面主題列表。為議論增目錄。見やすい議題一覧の作成。

jstop cron-tools.cewbot-20170915.topic_list.zh;
jstop cron-tools.cewbot-20170915.topic_list.zh-classical;
jstop cron-tools.cewbot-20170915.topic_list.wikinews;
jstop cron-tools.cewbot-20170915.topic_list.ja;
jstop cron-tools.cewbot-20170915.topic_list.wikisource;
jstop cron-tools.cewbot-20170915.topic_list.wikiversity;

/usr/bin/jstart -N cron-tools.cewbot-20170915.topic_list.zh -mem 2g -once -quiet /usr/bin/node /data/project/cewbot/wikibot/20170915.topic_list.js use_language=zh
/usr/bin/jstart -N cron-tools.cewbot-20170915.topic_list.zh-classical -mem 2g -once -quiet /usr/bin/node /data/project/cewbot/wikibot/20170915.topic_list.js use_language=zh-classical
/usr/bin/jstart -N cron-tools.cewbot-20170915.topic_list.wikinews -mem 2g -once -quiet /usr/bin/node /data/project/cewbot/wikibot/20170915.topic_list.js use_project=wikinews
/usr/bin/jstart -N cron-tools.cewbot-20170915.topic_list.ja -mem 2g -once -quiet /usr/bin/node /data/project/cewbot/wikibot/20170915.topic_list.js use_language=ja
/usr/bin/jstart -N cron-tools.cewbot-20170915.topic_list.wikisource -mem 2g -once -quiet /usr/bin/node /data/project/cewbot/wikibot/20170915.topic_list.js use_project=wikisource
/usr/bin/jstart -N cron-tools.cewbot-20170915.topic_list.wikiversity -mem 2g -once -quiet /usr/bin/node /data/project/cewbot/wikibot/20170915.topic_list.js use_project=wikiversity


2017/9/10 22:31:46	開始計畫。
2017/9/16 12:33:6	初版試營運。
2017/9/24 13:56:48	use page_configurations
2017/10/10 16:17:28	完成。正式運用。


@see [[w:zh:模块:沙盒/逆襲的天邪鬼/talkpage]], [[wikiversity:zh:模块:Talkpage]], [[w:zh:User:WhitePhosphorus-bot/RFBA_Status]],
 [[w:ja:Wikipedia:議論が盛んなノート]],
 https://zh.moegirl.org/Widget:TalkToc ($('#toc'))
 https://meta.wikimedia.org/wiki/Tech/News/2018/13/zh	已被棄用的#toc和#toctitle CSS ID將會被移除。如果您的wiki仍在使用它們作為假目錄，那麼它們將失去應有樣式。如有需要可以替換為.toc和.toctitle CSS類。



TODO:
Flow 的問題是不支援繁簡轉換，沒有在大流量頁面嘗試過。長篇內容是否合適Flow還真不清楚。排版還是不夠靈活。難以處理需要修訂版本刪除的編輯。
https://commons.wikimedia.org/wiki/Commons:Bots/Work_requests
https://zh.moegirl.org/Talk:%E8%AE%A8%E8%AE%BA%E7%89%88
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

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

/* eslint no-use-before-define: ["error", { "functions": false }] */
/* global CeL */
/* global Wiki */

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),

/** {String}設定頁面標題。 e.g., "User:bot/設定" */
configuration_page_title = 'User:' + user_name + '/討論頁面主題列表設定',
/** {Object}設定頁面所獲得之手動設定 manual settings。 */
configuration,

edit_tags = CeL.env.arg_hash && CeL.env.arg_hash.API_URL
// API_URL=https://zh.moegirl.org/api.php
&& CeL.env.arg_hash.API_URL.includes('moegirl') && 'Bot' || '',

// Will get page title from wikidata
botop_sitelinks = {
	enwiki : {
		title : 'Category:Wikipedia bot operators'
	}
}, max_date_length = 34,

// 一般用討論頁面設定。
// need to add {{/topic list}} to {{/header}}
general_topic_page = '/topic list', general_page_configuration = {
	topic_page : general_topic_page,
	// general_page_columns
	columns : 'NO;title;discussions;participants;last_user_set'
// 不應該列出管理員那兩欄，似乎暗示著管理員與其他用戶不是平等的。
// + ';last_admin_set'
}, localized_page_configuration = {
	zh : {
		timezone : 8,
		// 序號 Topics主題
		headers : '! # !! 話題 !! <small title="發言數/發言人次(實際上為簽名數)">發言</small> !! <small title="參與討論人數/發言人數">參與</small> !! 最新發言 !! data-sort-type="isoDate" | <small>最後更新(UTC+8)</small>'
		// !! [[WP:ADM|管理員]]發言 !! data-sort-type="isoDate" | 管理員更新(UTC+8)
		,
		row_style : general_row_style
	},
	'zh-classical' : {
		timezone : 8,
		headers : '! data-sort-type="number" | <small>序</small> !! 議題 !! data-sort-type="number" | <small title="議論數">論</small> !! data-sort-type="number" | <small title="參議者數">參議</small> !! 末議者 !! data-sort-type="isoDate" | 新易(UTC+8)'
	// !! [[WP:有秩|有秩]] !! data-sort-type="isoDate" | 有秩新易(UTC+8)
	},
	ja : {
		timezone : 9,
		// 質問や提案、議論
		headers : '! # !! 話題 !! <small title="発言数">発言</small> !! <small title="議論に参加する人数">人数</small> !! 最終更新者 !! data-sort-type="isoDate" | <small>最終更新日時(UTC+9)</small>'
	}
}[use_language];

Object.assign(general_page_configuration, localized_page_configuration);

function is_bot_user(user_name, section, using_special_users) {
	// TODO: using section for [[w:ja:Wikipedia:Bot/使用申請]]
	return (user_name in (using_special_users || special_users).bot)
			|| CeL.wiki.PATTERN_BOT_NAME.test(user_name);
}

// default configurations for BRFA 機器人申請
var default_BRFA_configurations = {
	topic_page : general_topic_page,
	columns : 'NO;title;status;discussions;participants;last_user_set;last_BAG_set',
	// 要含入並且監視的頁面。
	// e.g., {{Wikipedia:Bot/使用申請/InternetArchiveBot}}
	transclusion_target : function(token) {
		if (/\/(?:header|ヘッダ)$/i.test(token.name)) {
			// 跳過標頭。
			return;
		}

		if (token.name.startsWith('/')) {
			return this.title + token.name;
		}
		if (token.name.startsWith(this.title + '/')) {
			return token.name;
		}
		// for zhwiki
		if (/^(?:維基百科|维基百科|Wikipedia|Project):(?:機器人|机器人)\/(?:申請|申请)\//i
				.test(token.name)) {
			return token.name;
		}
	},
	// 篩選章節標題。
	section_filter : function(section) {

		// [[Wikipedia:机器人/申请/preload2]]
		// get bot name from link in section title.
		var bot_name = CeL.wiki.parse.user(section.section_title.toString());
		if (is_bot_user(bot_name, section)) {
			section.bot_name = bot_name;
		}
		// console.log(section);

		// 申請人。
		var applicants = section.applicants = [], to_exit = this.each.exit;

		// TODO: jawiki 必須尋找{{UserG|JJMC89}}

		// 尋找標題之外的第一個bot使用者連結。
		if (applicants.length === 0) {
			this.each.call(section, 'link', function(token) {
				var user_name = CeL.wiki.parse.user(token.toString());
				// console.log(user_name);
				if (user_name) {
					if (is_bot_user(user_name, section)) {
						if (!section.bot_name) {
							// 可能只是文章中的討論，因此不做設定。
							// section.bot_name = user_name;
						} else if (section.bot_name !== user_name) {
							CeL.warn(section.section_title.title
									+ ': Find 2 bots: ' + section.bot_name
									+ ' !== ' + user_name);
							// console.log(special_users.bot);
						}
					} else {
						// console.log(token);
						applicants.push(user_name);
						// console.log(to_exit);
						return to_exit;
					}
				}
			});
		}

		// for debug
		if (false) {
			console.log('-'.repeat(80));
			console.log([ section.bot_name, applicants,
					section.section_title.toString(), section.section_title ]);
			console.log(section.toString());
		}

		return section.bot_name && applicants.length > 0;
	},
	twist_filter : {
		// 帶有審核意味的討論，審查者欄位應該去掉申請人。
		BAG : function(section, user_group_filter) {
			var new_filter = CeL.null_Object();
			for ( var user_name in user_group_filter) {
				if (!section.applicants.includes(user_name)
						&& section.bot_name !== user_name) {
					new_filter[user_name] = true;
				}
			}
			return new_filter;

			// for {Array}user_group_filter
			return user_group_filter.map(function(user_name) {
				return !section.applicants.includes(user_name);
			});
		}
	},
	// column operators
	operators : {
		title : function(section) {
			var attributes = '';

			section.section_title.link[2]
			// [2]: display_text
			= section.section_title.link[2]
			//
			.replace(/^(.+[^\d])(\d{1,3})$/, function(all, front, NO) {
				NO = NO | 0;
				attributes = data_sort_attributes(front + ' ' + NO.pad(3))
						+ '| ';
				return front.trimEnd() + ' <sub>' + NO + '</sub>';
			});

			return attributes + section.section_title.link;
		},
		bot_name : function(section) {
			return section.bot_name;
		},
		// 操作者/申請人
		applicants : function(section) {
			return section.applicants.join(', ');
		},
		status : check_BRFA_status
	}
};

// ----------------------------------------------

// page configurations for all supported talk pages
var page_configurations = {
	// TODO: Wikipedia:バグの報告 Wikipedia:管理者伝言板 Wikipedia:お知らせ
	'jawiki:Wikipedia:Bot/使用申請' : Object.assign({
		timezone : 9,
		// 僅會顯示包含"bot"的標題
		// @see is_bot_user(user_name, section)
		headers : '! # !! Bot使用申請 !! 進捗 !! <small>発言</small>'
				+ ' !! <small title="議論に参加する人数">人数</small>' + ' !! 最終更新者'
				+ ' !! data-sort-type="isoDate" | <small>最終更新日時(UTC+9)</small>'
				// 審議者・決裁者
				+ ' !! <small>[[WP:BUR|決裁者]]更新</small>'
				+ ' !! data-sort-type="isoDate"'
				+ ' | <small>決裁者最後更新(UTC+9)</small>'
	}, default_BRFA_configurations),
	'jawiki:Wikipedia:Bot作業依頼' : {
		topic_page : general_topic_page,
		timezone : 9,
		headers : '! # !! 依頼 !! 進捗 !! <small>発言</small> !! <small title="議論に参加する人数">人数</small> !! 最終更新者 !! data-sort-type="isoDate" | <small>最終更新日時(UTC+9)</small> !! <small>[[Template:User bot owner|Bot運用者]]更新</small> !! data-sort-type="isoDate" | <small>Bot運用者更新日時(UTC+9)</small>',
		columns : 'NO;title;status;discussions;participants;last_user_set;last_botop_set',
		// column operators
		operators : {
			status : check_BOTREQ_status
		}
	},
	// TODO: Template:井戸端から誘導
	// 被認為無用
	'jawiki:Wikipedia:井戸端' : Object.assign({
		// [[Wikipedia‐ノート:井戸端#節ごとの発言数・参加者数・最終更新日時などの表(topic list)について]]
		// 初期設定は折り畳んだ状態で (collapsed)
		// [[Wikipedia:議論が盛んなノート]]の更新Botをフッタに対応させ、
		// [[Wikipedia:井戸端/topic list]]を取り込んでみました。こちらでは表示の折り畳みは不要かと思われます
		header_class : 'wikitable sortable collapsible',
		additional_header : 'style="float:left"',
		timezone : 9,
		transclusion_target : function(token) {
			if (token.name === '井戸端サブページ' && token.parameters.title) {
				return 'Wikipedia:井戸端/subj/' + token.parameters.title;
			}
		},
		postfix : function(section_table) {
			// 早見表
			if (false)
				section_table.push("↑'''この議題一覧表に関する議論は現在[[Wikipedia‐ノート:井戸端"
						+ "#節ごとの発言数・参加者数・最終更新日時などの表(topic list)について"
						+ "|ノートページ]]で行われています。皆様のご意見をお願いいたします。'''");
		},
		purge_page : 'Wikipedia:議論が盛んなノート'
	}, general_page_configuration),

	'zhwiki:Wikipedia:机器人/作业请求' : {
		topic_page : general_topic_page,
		timezone : 8,
		headers : '! # !! 需求 !! 進度 !! <small title="發言數/發言人次(實際上為簽名數)">發言</small> !! <small title="參與討論人數">參與</small> !! 最新發言 !! data-sort-type="isoDate" | <small>最後更新(UTC+8)</small> !! <small>最新[[Template:User bot owner|機器人操作者]]</small> !! data-sort-type="isoDate" | <small>機器人操作者更新(UTC+8)</small>',
		// first_user_set: 發起人與發起時間(Created)
		// last_user_set: 最後留言者與最後時間(Last editor) 最後編輯者+最後編輯於
		// last_admin_set: 特定使用者 special_users.admin 最後留言者與最後時間
		// last_BAG_set: 特定使用者 special_users.BAG 最後留言者與最後時間(Last BAG editor)
		// last_BAG_set: 最後BAG編輯者+BAG最後編輯於
		columns : 'NO;title;status;discussions;participants;last_user_set;last_botop_set',
		operators : {
			// 議體進度狀態。
			status : check_BOTREQ_status
		}
	},
	'zhwiki:Wikipedia:机器人/申请' : Object.assign({
		timezone : 8,
		headers : '! # !! 機器人申請 !! 進度'
				+ ' !! <small title="發言數/發言人次(實際上為簽名數)">發言</small>'
				+ ' !! <small title="參與討論人數">參與</small>' + ' !! 最新發言'
				+ ' !! data-sort-type="isoDate" | <small>最後更新(UTC+8)</small>'
				+ ' !! <small>最新[[WP:BAG|BAG]]發言</small>'
				+ ' !! data-sort-type="isoDate"'
				+ ' | <small>BAG最後更新(UTC+8)</small>',
		// 要篩選的章節標題層級。
		level_filter : [ 2, 3 ]
	}, default_BRFA_configurations),
	'zhwiki:Wikipedia:机器用户/申请' : Object.assign({
		timezone : 8,
		headers : '! # !! 機器用戶申請 !! 進度'
				+ ' !! <small title="發言數/發言人次(實際上為簽名數)">發言</small>'
				+ ' !! <small title="參與討論人數">參與</small>' + ' !! 最新發言'
				+ ' !! data-sort-type="isoDate" | <small>最後更新(UTC+8)</small>'
				+ ' !! <small>最新[[WP:BAG|BAG]]發言</small>'
				+ ' !! data-sort-type="isoDate"'
				+ ' | <small>BAG最後更新(UTC+8)</small>',
		// 要篩選的章節標題層級。
		level_filter : 3
	}, Object.assign(CeL.null_Object(), default_BRFA_configurations, {
		transclusion_target : null,
		section_filter : function(section) {

			// [[Wikipedia:机器人/申请/preload2]]
			// get bot name from link in section title.
			var applicants_name = CeL.wiki.parse.user(section.section_title
					.toString());
			if (applicants_name) {
				section.bot_name = applicants_name;
			}

			// 申請人。
			var applicants = section.applicants = [], to_exit = this.each.exit;

			// TODO: jawiki 必須尋找{{UserG|JJMC89}}

			// 尋找標題之外的第一個bot使用者連結。
			if (applicants.length === 0) {
				this.each.call(section, 'link', function(token) {
					// console.log(token);
					var user_name = CeL.wiki.parse.user(token.toString());
					if (user_name) {
						applicants.push(user_name);
						return to_exit;
					}
				});
			}

			// for debug
			if (false) {
				console.log('-'.repeat(80));
				console
						.log([ section.bot_name, applicants,
								section.section_title.toString(),
								section.section_title ]);
				console.log(section.toString());
			}

			// console.log(section.bot_name && applicants.length);
			return section.bot_name && applicants.length > 0;
		}
	})),
	'zhwiki:Wikipedia:互助客栈/消息' : general_page_configuration,
	'zhwiki:Wikipedia:互助客栈/方针' : general_page_configuration,
	'zhwiki:Wikipedia:互助客栈/技术' : general_page_configuration,
	'zhwiki:Wikipedia:互助客栈/求助' : general_page_configuration,
	'zhwiki:Wikipedia:互助客栈/条目探讨' : general_page_configuration,
	'zhwiki:Wikipedia:互助客栈/其他' : general_page_configuration,

	'zhwikinews:Wikinews:茶馆' : Object.assign({
		timezone : 8
	}, general_page_configuration),

	'zhwikiversity:Wikiversity:互助客栈' : Object.assign({
		timezone : 8
	}, general_page_configuration),

	'zhwikisource:Wikisource:写字间' : Object.assign({
		timezone : 8,
		// 維基文庫沒有"collapsible"，改為"mw-collapsible"。兩者並用會造成兩個都顯示。
		// 加上「metadata」class，這樣在移動版頁面中將不再顯示主題列表。
		// /「metadata」樣式改為「navbox」樣式，這樣起到的作用是一樣的...?
		// https://zh.m.wikisource.org/wiki/Wikisource:%E5%86%99%E5%AD%97%E9%97%B4
		header_class : 'wikitable sortable mw-collapsible metadata',
		postfix : function(section_table) {
			if (false)
				section_table.unshift("'''關於為討論頁面增加主題列表的功能"
						+ "[[Wikisource:机器人#User:" + user_name
						+ "|正申請中]]，請提供意見，謝謝。'''");
			section_table.push('[[Category:维基文库]]');
		}
	}, general_page_configuration),

	'zh_classicalwiki:維基大典:會館' : general_page_configuration
};

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
}, list_legend_used;

// ----------------------------------------------

// 討論議題列表可以挑選的欄位。
var section_column_operators = {
	// function: .call(page_data, section, section_index)
	NO : function(section, section_index) {
		return local_number(section_index);
	},
	// 議題的標題
	title : function(section) {
		// [[Template:Small]]
		function small_title(title, set_small) {
			title = title.toString(null,
					section.CSS && section.CSS.color ? 'color: '
							+ section.CSS.color : '');
			return set_small ? '<small>' + title + '</small>' : title;
		}

		var title = section.section_title.link, adding_link = section.adding_link,
		// 當標題過長時，縮小標題字型。
		title_too_long = if_too_long(section.section_title.title), style = title_too_long;
		title = small_title(title, title_too_long);

		// console.log(section);
		if (adding_link) {
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
					adding_link += '#' + section.section_title.link[1];
				}
				title_too_long = if_too_long(adding_link.replace(/#.*$/, ''));
				adding_link = section.CSS && section.CSS.color ? '[['
						+ adding_link + '|<span style="color: '
						+ section.CSS.color + ';">'
						+ adding_link.replace(/#.*$/, '') + '</span>]]'
						: CeL.wiki.title_link_of(adding_link);
			}
			if (title_too_long) {
				style = true;
			}
			title += '<br />→' + small_title(adding_link, title_too_long);
		}

		if (style) {
			style = 'max-width: '
			// 限制標題欄的寬度。要考慮比較窄的螢幕。
			+ (configuration.general.max_title_display_width || '24em');
		} else
			style = '';
		if (section.CSS && section.CSS.color) {
			// for <a>... useless
			style += '; color: ' + section.CSS.color
			// + ' !important;'
			;
		}

		return (style ? 'style="' + style + '" | ' : '') + title;
	},
	// discussions conversations, 發言次數, 発言数
	discussions : function(section) {
		// TODO: 其實是計算簽名與日期的數量。因此假如機器人等權限申請的部分多了一個簽名，就會造成多計算一次。
		return local_number(section.users.length, section.users.length >= 2
		// 火熱的討論採用不同顏色。
		? section.users.length >= 10 ? 'style="background-color:#ffe;' : ''
				: 'style="background-color:#fcc;"');
	},
	// 參與討論人數
	participants : function(section) {
		return local_number(section.users.unique().length, section.users
				.unique().length >= 2 ? '' : 'style="background-color:#fcc;"');
	},
	// reply, <small>回應</small>, <small>返答</small>, 返信数, 覆
	replies : function(section) {
		// 有不同的人回應才算上回應數。
		return local_number(section.replies, section.replies >= 1 ? ''
				: 'style="background-color:#fcc;"');
	},
	created : function(section) {
		// TODO: the datetime the subpage created
	},
	// word count
	words : function(section) {
		return CeL.count_word(section.toString());
	}
};

// ----------------------------------------------

// main talk pages **of this wiki**
var main_talk_pages = [], sub_page_to_main = CeL.null_Object();

var special_users;

// ----------------------------------------------------------------------------
// main

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
prepare_directory(base_directory);

// CeL.set_debug(6);

wiki.page(configuration_page_title, start_main_work);

function parse_configuration_table(table) {
	var configuration = CeL.null_Object();
	if (Array.isArray(table)) {
		table.forEach(function(line) {
			configuration[line[0]] = line[1];
		});
	}
	// console.log(configuration);
	return configuration;
}

function start_main_work(page_data) {
	// 讀入手動設定 manual settings。
	configuration = CeL.wiki.parse_configuration(page_data);
	// console.log(configuration);

	// 檢查從網頁取得的設定。

	// 一般設定
	var general
	// 設定必要的屬性。
	= configuration.general = parse_configuration_table(configuration.general);

	general.max_title_length |= 0;
	if (!(general.max_title_length > 0 && general.max_title_length < 900)) {
		delete general.max_title_length;
	}

	if (!/^\d{1,2}(?:em|en|%)$/.test(general.max_title_display_width)) {
		delete general.max_title_display_width;
	}

	var configuration_now = configuration.list_style = parse_configuration_table(configuration.list_style);
	for ( var name in configuration_now) {
		var style = configuration_now[name];
		if (!/^#?[\da-f]{3,6}$/i.test(style)) {
			delete configuration_now[name];
			return;
		}
		if (name in short_to_long) {
			short_to_long[name] = style;
		} else if (name in long_to_short) {
			long_to_short[name] = style;
		}
	}

	console.log(configuration);

	// ----------------------------------------------------

	// for debug
	if (false) {
		page_configurations = {
			'zhwiki:Wikipedia:互助客栈/技术' : general_page_configuration
		};
	}

	Object.keys(page_configurations).forEach(function(wiki_and_page_title) {
		var matched = wiki_and_page_title.match(/^([^:]+):(.+)$/),
		//
		project = CeL.wiki.site_name(wiki);
		if (matched[1] === project) {
			main_talk_pages.push(matched[2]);
			page_configurations[wiki_and_page_title].project = project;
		}
	});

	get_special_users.log_file_prefix = base_directory + 'special_users.';

	set_list_legend();

	// for debug
	// main_talk_pages = [ 'Wikipedia:互助客栈/技术' ];
	// main_talk_pages = [ 'Wikipedia:Bot/使用申請' ];

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
		special_users = _special_users;

		// 首先生成一輪討論頁面主題列表。
		main_talk_pages.forEach(function(page_title) {
			wiki.page(page_title, pre_fetch_sub_pages);
		});
		// return;

		wiki.listen(pre_fetch_sub_pages, {
			// start : new Date,

			// 延遲時間
			// [[Wikipedia‐ノート:井戸端#節ごとの発言数・参加者数・最終更新日時などの表(topic list)について]]
			// 検出後30秒ほどのタイムラグを設けて
			delay : CeL.wiki.site_name(wiki) === 'jawiki' ? '30s' : 0,
			filter : main_talk_pages,
			with_content : true,
			parameters : {
				// 跳過機器人所做的編輯。
				// You need the "patrol" or "patrolmarks" right to request the
				// patrolled flag.
				rcshow : '!bot',
				rcprop : 'title|ids|sizes|flags|user'
			},
			interval : '5s'
		});
	}

	new CeL.wiki(null, null, 'en').page(botop_sitelinks.enwiki)
	//
	.data(function(entity) {
		// console.log(entity);
		get_special_users(main_process, {
			botop_sitelinks : entity.sitelinks
		});
	});

}

// ----------------------------------------------------------------------------

// 取得特定使用者名單(hash): 當使用者權限變更時必須重新執行程式！
function get_special_users(callback, options) {
	var botop_sitelinks = options && options.botop_sitelinks;
	if (!botop_sitelinks) {
		TODO;
	}

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

	function get_allusers(group_name, augroup, callback) {
		// reset
		special_users[group_name] = CeL.null_Object();
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
			// The parameters "augroup" and "auexcludegroup" can not be used
			// together.
			// auexcludegroup : 'bot',
			limit : 'max'
		});
	}

	// 必須先取得bot這個群組以利後續檢查排除掉所有機器人。
	get_allusers('bot');
	get_allusers('bureaucrat', 'bureaucrat|steward|oversight', function() {
		// 行政員以上可利用[[Special:Makebot]]核可機器人權限，為當然成員。
		special_users.BAG = Object.clone(special_users.bureaucrat);
	});
	// 取得管理員列表。
	// https://www.mediawiki.org/w/api.php?action=help&modules=query%2Ballusers
	get_allusers('admin', 'sysop|bureaucrat|steward|oversight');

	// [[WP:BAG]], [[Wikipedia:Bot Approvals Group]], [[維基百科:機器人審核小組]]
	// TODO: 這裡的篩選方法會把頁面中所有的使用者都納入這個群體，包括不活躍與離職的。
	// TODO: using [[Template:BAG_topicon]]
	wiki.page('Project:BAG', function(page_data) {
		var title = CeL.wiki.title_of(page_data),
		/**
		 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
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

	var botop_page = botop_sitelinks[CeL.wiki.site_name(wiki)];
	if (botop_page && (botop_page = botop_page.title)) {
		// reset
		special_users.botop = CeL.null_Object();
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
	var status, to_exit = this.each.exit, archived;
	// console.log(section);
	this.each.call(section, function(token) {
		if (token.type === 'transclusion' && (token.name in {
			// 本主題全部或部分段落文字，已移動至...
			Moveto : true,
			Movedto : true,
			'Moved to' : true,
			'Moved discussion to' : true,
			Switchto : true,
			移動至 : true
		})) {
			archived = 'moved';
			section.adding_link = token.parameters[1];

		} else if (token.type === 'transclusion' && (token.name in {
			// 下列討論已經關閉，請勿修改。
			'Archive top' : true
		})) {
			archived = 'start';

		} else if (archived === 'start'
		//
		&& token.type === 'transclusion' && (token.name in {
			// 下列討論已經關閉，請勿修改。
			'Archive bottom' : true
		})) {
			archived = 'end';
			// 可能拆分為許多部分討論，但其中只有一小部分結案。繼續檢查。

		} else if ((!archived || archived === 'end' || archived === 'moved')
				&& token.toString().trim()) {
			// console.log('在結案之後還有東西:');
			// console.log(token);
			// 在結案之後還有東西。重新設定。
			if (archived === 'end' && token.type === 'section_title') {
				section.adding_link = token;
			}
			archived = 'extra';
			// 除了{{save to}}之類外，有多餘的token就應該直接跳出。
			// return to_exit;
		}

	}, 1);

	// console.log('archived: ' + archived);
	if (archived === 'end' || archived === 'moved') {
		section.CSS = {
			// 已移動或結案的議題，整行文字顏色。 現在已移動或結案的議題，整行會採用相同的文字顏色。
			color : configuration.list_style.archived_text_color || '#111'
		};

		// 把"下列討論已經關閉"的議題用深灰色顯示。
		return 'style="background-color: #ccc;"'
		// 話題加灰底會與「更新圖例」裡面的說明混淆
		&& 'style="text-decoration: line-through;"'
		// 將完成話題全灰. "!important": useless
		&& 'style="color: #888;"'
		// 一般來說，色塊填滿應該不會超出框線，而且也不會影響框線本身的顏色
		&& 'style="opacity: .8;"' && '';
	}

	return status || '';
}

// ----------------------------------------------
// status functions

function check_BOTREQ_status(section, section_index) {
	var status, to_exit = this.each.exit, project = this.page.page_configuration.project;
	this.each.call(section, 'template', function(token) {
		if (token.name in {
			Resolved : true,
			Solved : true,
			済み : true,
			已解決 : true,
			解決済み : true
		}) {
			// 這個做法可以去掉模板中的簽名。
			status = 'style="background-color:#efe;" | '
			// [[ja:Template:解決済み]]
			+ '{{ ' + token.name + '}}';
			// 此模板代表一種決定性的狀態，可不用再檢查其他內容。
			return to_exit;
		}

		if (token.name in {
			未解決 : true,
			失効 : true
		}) {
			// 這個做法可以去掉模板中的簽名。
			status = 'style="background-color:#fdd;" | ' + '{{ ' + token.name
					+ '}}';
			// 此模板代表一種決定性的狀態，可不用再檢查其他內容。
			return to_exit;
		}

		if (token.name in {
			スタック : true
		}) {
			// 這個做法可以去掉模板中的簽名。
			status = 'style="background-color:#ffc;" | ' + '{{ ' + token.name
					+ '}}';
			// 此模板代表一種決定性的狀態，可不用再檢查其他內容。
			return to_exit;
		}

		if (token.name === 'BOTREQ') {
			// [[Template:BOTREQ]]
			status = (token[1] || '').toString().toLowerCase().trim();
			if (status === 'done' || status === '完了') {
				status = 'style="background-color:#dfd;" | ' + token;
				if (project === 'jawiki') {
					// 「完了」と「解決済み」は紛らわしいから、もうちょっと説明を加えて。
					status += '、確認待ち';
				}
			} else if (status) {
				status = token.toString();
			}

		} else if (token.name in {
			Doing : true,
			處理中 : true,
			Working : true,
			工作中 : true,

			// --------------

			'Partly done' : true,
			部分完成 : true,

			// --------------

			Done : true,
			完成 : true,
			済 : true,

			Completed : true,
			已完成 : true,
			完了 : true,

			Finish : true,

			// --------------

			Confirmed : true,
			確認 : true,
			已確認 : true
		}) {
			status = 'style="background-color:#dfd;" | ' + token;
			if (project === 'jawiki'
			// 「完了」と「解決済み」は紛らわしいから、もうちょっと説明を加えて。
			&& token.name === '完了') {
				status += '、確認待ち';
			}

		} else if (token.name in {
			Undone : true,
			'Not done' : true,
			未完成 : true,
			中止 : true,

			'On hold' : true,
			OnHold : true,
			擱置 : true,
			搁置 : true,
			保留 : true,

			Withdrawn : true,
			撤回請求 : true,
			撤回 : true,

			Cancelled : true,
			取消 : true,
			已取消 : true,

			除去 : true,
			取り下げ : true,
			終了 : true,
			失効 : true,
			自動失効 : true,
			依頼無効 : true,

			Declined : true,
			駁回 : true,
			'Thrown out' : true,
			却下 : true,

			Invalid : true,
			無效 : true
		}) {
			status = 'style="background-color:#fbb;" | ' + token;
		}

		// TODO: [[Template:Moved discussion to]], [[模板:移動至]]
		// {{移動至|Namespace:Pagename#Topic}}

	});
	return status || '';
}

// 議體進度狀態(Status:Approved for trial/Trial complete/Approved/...)
function check_BRFA_status(section) {
	var status, to_exit = this.each.exit;
	this.each.call(section, 'template', function(token) {
		// [[w:zh:Template:StatusBRFA]]
		if (token.name === 'StatusBRFA') {
			// 狀態模板提供「prefix」參數，可以此參數隱去「狀態」二字。
			status = token.toString().replace(/(}})$/, '|prefix=$1');
			var BRFA_status = token.parameters[1] || 'new';
			if (/^(?:tri|tiral|測試|测试)$/.test(BRFA_status)) {
				status = 'style="background-color:#cfc;" | ' + status;
			} else if (/^(?:new|tric|trial complete|測試完成|测试完成)$/
			//
			.test(BRFA_status)) {
				status = 'style="background-color:#ffc;" | ' + status;
			} else if (/^(?:\+|app|approved|批准)$/.test(BRFA_status)) {
				status = 'style="background-color:#ccf;" | ' + status;
			} else if (
			//
			/^(?:\-|den|deny|denied|拒絕|拒绝|wit|withdraw|撤回|rev|revoke|revoked|撤銷|撤销)$/
			//
			.test(BRFA_status)) {
				status = 'style="background-color:#fcc;" | ' + status;
			} else if (/^(?:exp|expire|expired|過期|过期|\?|dis|discuss|討論|讨论)$/
			//
			.test(BRFA_status)) {
				status = 'style="background-color:#ddd;" | ' + status;
			}
			// 此模板代表一種決定性的狀態，可不用再檢查其他內容。
			return to_exit;
		}

		if (token.name in {
			'Rfp/status' : true,
			Status2 : true,
			Donestatus : true
		}) {
			// 狀態模板提供「prefix」參數，可以此參數隱去「狀態」二字。
			status = token.toString().replace(/(}})$/, '|prefix=$1');
			var BRFA_status = token.parameters[1] || 'new';
			if (/^(?:\+|Done|done|完成)$/.test(BRFA_status)) {
				status = 'style="background-color:#ccf;" | ' + status;
			} else if (
			//
			/^(?:\-|Not done|not done|拒絕|拒绝|驳回|駁回|未完成)$/
			//
			.test(BRFA_status)) {
				status = 'style="background-color:#fcc;" | ' + status;
			} else if (/^(?:on hold|擱置|搁置|等待|等待中|OH|oh|hold|Hold|\*|\?)$/
			//
			.test(BRFA_status)) {
				status = 'style="background-color:#ddd;" | ' + status;
			}
			// 此模板代表一種決定性的狀態，可不用再檢查其他內容。
			return to_exit;
		}

		// [[Template:BAG_Tools]], [[Template:Status2]]
		if (token.name in {
			BotTrial : true,
			BotExtendedTrial : true
		}) {
			status = 'style="background-color:#cfc;" | ' + token;
		} else if (token.name in {
			BotTrialComplete : true,
			OperatorAssistanceNeeded : true,
			BAGAssistanceNeeded : true
		}) {
			status = 'style="background-color:#ffc;" | ' + token;
		} else if (token.name in {
			対処 : true,

			BotSpeedy : true,
			BotApproved : true
		}) {
			status = 'style="background-color:#ccf;" | ' + token;
		} else if (token.name in {
			BotWithdrawn : true,
			Withdrawn : true,
			取り下げ : true,
			却下 : true,
			'×' : true,

			BotExpired : true,
			BotRevoked : true,
			BotDenied : true
		}) {
			status = 'style="background-color:#fcc;" | ' + token;
		} else if (token.name in {
			BotOnHold : true,

			'On hold' : true,
			OnHold : true,
			擱置 : true,
			搁置 : true
		}) {
			status = 'style="background-color:#ccc;" | ' + token;
		} else if (token.name in {
			BotStatus : true,
			BotComment : true,
			BOTREQ : true
		}) {
			status = token.toString();
		}
	});
	// TODO: 提醒申請者
	return status || '';
}

// ----------------------------------------------

function normalize_time_style_hash(time_style_hash) {
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
			time_style_hash[time_interval] = 'style="background-color:' + style
					+ ';" ';
		}
	}
}

function set_list_legend() {
	normalize_time_style_hash(short_to_long);
	normalize_time_style_hash(long_to_short);

	var _list_legend = list_legend[use_language]
	// e.g., 'zh-classical'
	|| list_legend['zh'];
	list_legend_used = [
			// collapsed
			'{| class="wikitable collapsible metadata" style="float:left;margin-left:.5em;"',
			// TODO: .header 應該用 caption
			// title: 相對於機器人最後一次編輯
			'! title="From the latest bot edit" | ' + _list_legend.header, '|-' ];

	for ( var time_interval in _list_legend) {
		if (time_interval === 'header') {
			continue;
		}
		list_legend_used.push('| ' + (short_to_long[time_interval]
		//
		|| long_to_short[time_interval] || '') + ' |\n* '
				+ _list_legend[time_interval], '|-');
	}

	if (use_language === 'zh') {
		// @see general_row_style()
		list_legend_used.push('! 特殊狀態', '|-', '| 討論議題' + '<br />→'
		// 已移動至目標頁面
		+ '<small>已移至頁面/最新討論子項</small>', '|-');
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
	list_legend_used.push('|}', '{{Clear}}');
	// Release memory. 釋放被占用的記憶體.
	list_legend = null;
}

// for 討論議題列表可以挑選欄位: (特定)使用者(最後)留言時間
function add_user_name_and_date_set(section, user_and_date_index) {
	var user = '', date = '';
	if (user_and_date_index >= 0) {
		var parsed = this;
		date = section.dates[user_and_date_index];
		if (true) {
			// 採用短日期格式。
			date = date.format({
				format : section.CSS && section.CSS.color
				// 已經設定整行CSS的情況下，就不另外表現CSS。
				? '%Y-%2m-%2d %2H:%2M'
				//
				: '%Y-%2m-%2d <span style="color:blue;">%2H:%2M</span>',
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
		//
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
		if (section.CSS && section.CSS.color) {
			additional_attributes += ' style="color: ' + section.CSS.color
					+ ';"';
		}

		user = section.users[user_and_date_index];
		// TODO: link to diff
		user = (additional_attributes ? '| ' : '')
		// 對於匿名IP用戶則顯示編輯紀錄。
		+ (CeL.wiki.parse.user.is_IP(user)
		//
		? '[[Special:Contributions/' : '[[User:') + user + '|'
		//
		+ (section.CSS && section.CSS.color ? '<span style="color:'
		//
		+ section.CSS.color + ';">' + user + '</span>' : user) + ']]';
	} else {
		// 沒有發現此 user group 之發言。
		additional_attributes = 'style="background-color:#ffd;" | ';
	}

	return [ additional_attributes + user, additional_attributes + date ];
}

function if_too_long(title) {
	return title
	// remove HTML tags
	.replace(/<\/?[a-z][^<>]*>?/g, '')
	// remove styles
	.replace(/'''?/g, '').display_width() >
	// 當標題過長，大於 max_title_length 時，縮小標題字型。
	(configuration.general.max_title_length || 40);
}

// [[w:en:Help:Sorting#Specifying_a_sort_key_for_a_cell]]
function data_sort_attributes(key) {
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
				+ data_sort_attributes(number) + ' | '
				// None, N/A
				+ (number === 0 ? '無' : CeL.to_Chinese_numeral(number));
	}

	var style = 'text-align:right;';
	if (!attributes) {
		if (!style) {
			return number;
		}
		attributes = 'style="' + style + '"';
	} else if (!attributes.includes('style="')) {
		attributes += ' style="' + style + '"';
	} else {
		attributes = attributes.replace('style="', 'style="' + style);
	}
	return attributes + ' | ' + number;
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
				// this: parsed
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
	if (page_data.title in sub_page_to_main) {
		// 更改了子頁面，得要重新處理主要頁面。
		wiki.page(sub_page_to_main[page_data.title], pre_fetch_sub_pages);
		return;
	}

	var parsed = CeL.wiki.parser(page_data).parse();
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
		throw 'Parser error: ' + CeL.wiki.title_link_of(page_data);
	}

	var page_configuration = page_data.page_configuration
	//
	= page_configurations[CeL.wiki.site_name(wiki) + ':' + page_data.title];

	if (!page_configuration) {
		// for debug
		CeL.error('Can not get page_configuration for '
				+ CeL.wiki.site_name(wiki) + ':' + page_data.title);
	}

	if (!page_configuration.transclusion_target) {
		generate_topic_list(page_data);
		return;
	}

	var sub_pages_to_fetch = [], sub_pages_to_fetch_hash = CeL.null_Object();
	// check transclusions
	parsed.each('transclusion', function(token, index, parent) {
		// transclusion page title
		var page_title = page_configuration.transclusion_target.call(page_data,
				token);
		if (!page_title) {
			return;
		}

		page_title = CeL.wiki.normalize_title(page_title);
		token.index = index;
		token.parent = parent;
		sub_pages_to_fetch_hash[page_title] = token;
		sub_pages_to_fetch.push(page_title);
	}, false,
	// Only check the first level. 只檢查第一層之 transclusion。
	1);

	if (sub_pages_to_fetch.length === 0) {
		generate_topic_list(page_data);
		return;
	}

	// 處理要含入並且監視的頁面。
	CeL.debug(sub_pages_to_fetch.length + ' pages to load:\n'
			+ sub_pages_to_fetch.join('\n'), 1, 'pre_fetch_sub_pages');

	wiki.page(sub_pages_to_fetch, function(page_data_list) {
		// @see main_work @ wiki_API.prototype.work
		if (page_data_list.length !== sub_pages_to_fetch.length) {
			throw 'Fetch pages error!';
		}

		var transclusions = 0;
		// insert page contents and re-parse
		page_data_list.forEach(function(sub_page_data) {
			var title = sub_page_data.original_title || sub_page_data.title,
			//
			token = sub_pages_to_fetch_hash[title];
			if (!token) {
				throw '取得了未設定的頁面: ' + CeL.wiki.title_link_of(sub_page_data);
			}
			if (!(sub_page_data.title in sub_page_to_main)) {
				// 有嵌入其他議題/子頁面的，也得一併監視。
				main_talk_pages.push(sub_page_data.title);
				sub_page_to_main[sub_page_data.title] = page_data.title;
			}
			// 直接取代。
			// 其他提醒的格式可以參考
			// https://www.mediawiki.org/w/api.php?action=help&modules=expandtemplates
			// <!-- {{Template}} starts -->...<!-- {{Template}} end -->
			token.parent[token.index] = '\n{{Transclusion start|' + title
					+ '}}\n' + CeL.wiki.content_of(sub_page_data)
					+ '\n{{Transclusion end|' + title + '}}\n';
			transclusions++;
		});

		if (transclusions > 0) {
			// re-parse
			CeL.wiki.parser(page_data, {
				wikitext : page_data.use_wikitext = parsed.toString()
			}).parse();
		}
		generate_topic_list(page_data);
	}, {
		multi : true,
		redirects : 1
	});
}

// ----------------------------------------------------------------------------
// 生成菜單的主函數

function generate_topic_list(page_data) {
	var parsed = CeL.wiki.parser(page_data),
	//
	page_configuration = page_data.page_configuration,
	//
	section_table = [
			'<!-- This page will be auto-generated by bot. Please contact me to improve the tool. 本頁面由機器人自動更新。若要改進，請聯繫機器人操作者。 -->',
			'{| class="' + (page_configuration.header_class
			// plainlinks
			|| 'wikitable sortable collapsible') + '"  style="float:left;"'
					+ (page_configuration.additional_header || ''), '|-',
			page_configuration.headers ],
	//
	column_operators = get_column_operators(page_configuration),
	//
	topic_count = 0, new_topics = [];

	parsed.each_section(function(section, section_index) {
		if (false) {
			console.log('' + section.section_title);
			if (section_index >= 12)
				console.log(section);
		}

		if (section_index === 0) {
			// 跳過頁首設定與公告區。
			return;
		}

		if (page_configuration.section_filter
		// 篩選議題。
		&& !page_configuration.section_filter.call(parsed, section)) {
			return;
		}

		topic_count++;

		if (Date.now() - section.dates[section.last_update_index] < CeL
				.to_millisecond('1m')) {
			new_topics.push(section.section_title.title);
		}

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
			var values = operator.call(parsed, section, section_index);
			if (Array.isArray(values)) {
				row.append(values);
			} else {
				row.push(values);
			}
		});

		section_table.push('|-' + row_style + '\n| ' + row.join(' || '));
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

	section_table.push('|}');
	if (page_configuration.need_time_legend) {
		// 解説文を入れて 色違いが何を示しているのかがわかる
		section_table.append(list_legend_used);
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

	wiki.page(topic_page)
	// TODO: CeL.wiki.array_to_table(section_table)
	.edit(section_table.join('\n'), {
		bot : 1,
		nocreate : 1,
		tags : edit_tags,
		summary : 'generate topic list: '
		// -1: 跳過頁首設定與公告區。
		+ topic_count + ' topics'
		//
		+ (new_topics.length > 0
		//
		? ', new reply: ' + new_topics.join('; ') : '')
	})
	// 更新所嵌入的頁面。通常是主頁面。
	.purge(page_configuration.purge_page || page_data.title);
}
