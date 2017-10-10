/*

Add topic list to talk page. 增加討論頁面主題列表。為議論增目錄。見やすい議題一覧の作成。

jstop cron-tools.cewbot-20170915.topic_list.zh;
jstop cron-tools.cewbot-20170915.topic_list.zh-classical;
jstop cron-tools.cewbot-20170915.topic_list.wikinews;
jstop cron-tools.cewbot-20170915.topic_list.ja;
jstop cron-tools.cewbot-20170915.topic_list.wikisource;

/usr/bin/jstart -N cron-tools.cewbot-20170915.topic_list.zh -mem 2g -once -quiet /usr/bin/node /data/project/cewbot/wikibot/20170915.topic_list.js use_language=zh
/usr/bin/jstart -N cron-tools.cewbot-20170915.topic_list.zh-classical -mem 2g -once -quiet /usr/bin/node /data/project/cewbot/wikibot/20170915.topic_list.js use_language=zh-classical
/usr/bin/jstart -N cron-tools.cewbot-20170915.topic_list.wikinews -mem 2g -once -quiet /usr/bin/node /data/project/cewbot/wikibot/20170915.topic_list.js use_project=wikinews
/usr/bin/jstart -N cron-tools.cewbot-20170915.topic_list.ja -mem 2g -once -quiet /usr/bin/node /data/project/cewbot/wikibot/20170915.topic_list.js use_language=ja
/usr/bin/jstart -N cron-tools.cewbot-20170915.topic_list.wikisource -mem 2g -once -quiet /usr/bin/node /data/project/cewbot/wikibot/20170915.topic_list.js use_project=wikisource


2017/9/10 22:31:46	開始計畫。
2017/9/16 12:33:6	初版試營運。
2017/9/24 13:56:48	use page_configurations
2017/10/10 16:17:28	完成。正式運用。


@see [[zh:模块:沙盒/逆襲的天邪鬼/talkpage]], [[User:WhitePhosphorus-bot/RFBA_Status]],
 https://zh.moegirl.org/Widget:TalkToc ($('#toc'))



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
get time via revisions information
自動計算投票票數

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
wiki = Wiki(true),

// Will get page title from wikidata
botop_sitelinks = {
	enwiki : {
		title : 'Category:Wikipedia bot operators'
	}
},
// 當標題過長，>max_title_length 時，縮小標題字型。
max_title_length = 40, max_title_display_width = '24em', max_date_length = 34,

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
		// 序號 Topics主題
		heads : '! # !! 話題 !! <small>發言</small> !! <small title="參與討論人數">參與</small> !! 最新發言 !! data-sort-type="isoDate" | 最後更新 UTC'
	// !! [[WP:ADM|管理員]]發言 !! data-sort-type="isoDate" | 管理員更新
	},
	'zh-classical' : {
		heads : '! data-sort-type="number" | <small>序</small> !! 議題 !! data-sort-type="number" | <small title="議論數">論</small> !! data-sort-type="number" | <small title="參議者數">參議</small> !! 末議者 !! data-sort-type="isoDate" | 新易 UTC'
	// !! [[WP:有秩|有秩]] !! data-sort-type="isoDate" | 有秩新易
	},
	ja : {
		// 質問や提案、議論
		heads : '! # !! 話題 !! <small>発言</small> !! <small title="議論に参加する人数">人数</small> !! 最終更新者 !! data-sort-type="isoDate" | <small>最終更新日時 UTC</small>'
	}
}[use_language];

Object.assign(general_page_configuration, localized_page_configuration);

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
		if (CeL.wiki.PATTERN_BOT_NAME.test(bot_name)
				|| (bot_name in special_users.bot)) {
			section.bot_name = bot_name;
		}

		// 申請人。
		var applicants = section.applicants = [], exit = this.each.exit;
		// 尋找標題之外的第一個bot使用者連結。
		this.each.call(section, 'link', function(token) {
			var user_name = CeL.wiki.parse.user(token.toString());
			if (user_name) {
				if (CeL.wiki.PATTERN_BOT_NAME.test(user_name)
						|| (user_name in special_users.bot)) {
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
					applicants.push(user_name);
					return exit;
				}
			}
		});

		if (false) {
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
},
// page configurations for all supported talk pages
page_configurations = {
	// TODO: Wikipedia:バグの報告 Wikipedia:管理者伝言板 Wikipedia:お知らせ
	'jawiki:Wikipedia:Bot/使用申請' : Object.assign({
		heads : '! # !! Bot使用申請 !! 進捗 !! <small>発言</small>'
				+ ' !! <small title="議論に参加する人数">人数</small>' + ' !! 最終更新者'
				+ ' !! data-sort-type="isoDate" | <small>最終更新日時 UTC</small>'
				// 審議者・決裁者
				+ ' !! <small>[[WP:BUR|決裁者]]更新</small>'
				+ ' !! data-sort-type="isoDate" | <small>決裁者最後更新 UTC</small>'
	}, default_BRFA_configurations),
	'jawiki:Wikipedia:Bot作業依頼' : {
		topic_page : general_topic_page,
		heads : '! # !! 依頼 !! 進捗 !! <small>発言</small> !! <small title="議論に参加する人数">人数</small> !! 最終更新者 !! data-sort-type="isoDate" | <small>最終更新日時 UTC</small> !! <small>[[Template:User bot owner|Bot運用者]]更新 UTC</small> !! data-sort-type="isoDate" | <small>Bot運用者更新日時</small>',
		columns : 'NO;title;status;discussions;participants;last_user_set;last_botop_set',
		// column operators
		operators : {
			status : check_BOTREQ_status
		}
	},
	// TODO: Template:井戸端から誘導
	'jawiki:Wikipedia:井戸端' : Object.assign({
		transclusion_target : function(token) {
			if (token.name === '井戸端サブページ' && token.parameters.title) {
				return 'Wikipedia:井戸端/subj/' + token.parameters.title;
			}
		}
	}, general_page_configuration),

	'zhwiki:Wikipedia:机器人/作业请求' : {
		topic_page : general_topic_page,
		heads : '! # !! 需求 !! 進度 !! <small>發言</small> !! <small title="參與討論人數">參與</small> !! 最新發言 !! data-sort-type="isoDate" | 最後更新 UTC !! <small>最新[[Template:User bot owner|機器人操作者]]</small> !! data-sort-type="isoDate" | <small>機器人操作者更新 UTC</small>',
		// first_user_set: 發起人與發起時間(Created)
		// last_user_set: 最後留言者與最後時間(Last editor) 最後編輯者+最後編輯於
		// last_admin_set: 特定使用者 special_users.admin 最後留言者與最後時間
		// last_BAG_set: 特定使用者 special_users.BAG 最後留言者與最後時間(Last BAG editor)
		// last_BAG_set: 最後BAG編輯者+BAG最後編輯於
		columns : 'NO;title;status;discussions;participants;last_user_set;last_botop_set',
		operators : {
			// 議體進度狀態
			status : check_BOTREQ_status
		}
	},
	'zhwiki:Wikipedia:机器人/申请' : Object.assign({
		heads : '! # !! 機器人申請 !! 進度 !! <small>發言</small>'
				+ ' !! <small title="參與討論人數">參與</small>'
				+ ' !! 最新發言 !! data-sort-type="isoDate" | 最後更新 UTC'
				+ ' !! <small>最新[[WP:BAG|BAG]]</small>'
				+ ' !! data-sort-type="isoDate" | <small>BAG最後更新 UTC</small>',
		// 要篩選的章節標題層級
		level_filter : [ 2, 3 ]
	}, default_BRFA_configurations),
	'zhwiki:Wikipedia:互助客栈/消息' : general_page_configuration,
	'zhwiki:Wikipedia:互助客栈/方针' : general_page_configuration,
	'zhwiki:Wikipedia:互助客栈/技术' : general_page_configuration,
	'zhwiki:Wikipedia:互助客栈/求助' : general_page_configuration,
	'zhwiki:Wikipedia:互助客栈/条目探讨' : general_page_configuration,
	'zhwiki:Wikipedia:互助客栈/其他' : general_page_configuration,

	'zhwikinews:Wikinews:茶馆' : general_page_configuration,

	'zhwikisource:Wikisource:写字间' : Object.assign({
		postfix : function(section_table) {
			section_table.unshift("'''關於為討論頁面增加主題列表的功能"
					+ "[[Wikisource:机器人#User:cewbot|正申請中]]，請提供意見，謝謝。'''");
			section_table.push('[[Category:维基文库]]');
		}
	}, general_page_configuration),

	'zh_classicalwiki:維基大典:會館' : general_page_configuration
};

// ----------------------------------------------------------------------------

// CeL.set_debug(6);

// main talk pages **of this wiki**
var main_talk_pages = [], sub_page_to_main = CeL.null_Object();

Object.keys(page_configurations).forEach(function(wiki_and_page_title) {
	var matched = wiki_and_page_title.match(/^([^:]+):(.+)$/),
	//
	project = CeL.wiki.site_name(wiki);
	if (matched[1] === project) {
		main_talk_pages.push(matched[2]);
		page_configurations[wiki_and_page_title].project = project;
	}
});
if (main_talk_pages.length > 0) {
	CeL.info(main_talk_pages.length + ' page(s) to listen for '
			+ CeL.wiki.site_name(wiki) + ': '
			+ main_talk_pages.map(function(title) {
				return CeL.wiki.title_link_of(title);
			}).join(', '));
} else {
	CeL.error('No talk page to process for ' + CeL.wiki.site_name(wiki) + '!');
}

var special_users;
function main_process(_special_users) {
	special_users = _special_users;

	// 首先生成一輪。
	main_talk_pages.forEach(function(page_title) {
		wiki.page(page_title, pre_fetch_sub_pages);
	});
	// return;

	wiki.listen(pre_fetch_sub_pages, {
		// start : new Date,

		// 延遲時間
		// delay : '0m',
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
	get_special_users(main_process, {
		botop_sitelinks : entity.sitelinks
	});
});

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
				// 排除掉所有機器人。
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
			if (user_name && !(user_name in special_users.bot)
					&& !CeL.wiki.PATTERN_BOT_NAME.test(user_name)) {
				special_users.BAG[user_name] = true;
			}
		}

		var matched,
		// 注意: 這個方法會把不活躍成員和離任成員也都列進去。
		PATTERN_template_user = /{{ *user *\| *([^#\|\[\]{}\/]+)/ig;

		while (matched = PATTERN_template_user.exec(content)) {
			var user_name = CeL.wiki.normalize_title(matched[1]);
			if (user_name && !(user_name in special_users.bot)
					&& !CeL.wiki.PATTERN_BOT_NAME.test(user_name)) {
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
				if (user_name && !(user_name in special_users.bot)
						&& !CeL.wiki.PATTERN_BOT_NAME.test(user_name)) {
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
		CeL.fs_write('special_users.' + CeL.wiki.site_name(wiki) + '.json',
				JSON.stringify(special_users));
		callback(special_users);
	});
}

// ----------------------------------------------
// status functions

function check_BOTREQ_status(section, section_index) {
	var status, to_exit = this.each.exit, project = this.page.page_configuration.project;
	this.each.call(section, 'template', function(token) {
		if (token.name in {
			Resolved : true,
			Solved : true,
			已解決 : true,
			解決済み : true
		}) {
			status = 'style="background-color:#efe;" | '
			// [[ja:Template:解決済み]]
			+ '[[File:Check mark.svg|20px|link=]] ' + token.name;
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
	});
	return status || '';
}

// [[Template:BAG_Tools]], [[Template:Status2]], [[Template:StatusBRFA]]
// 議體進度狀態(Status:Approved for trial/Trial complete/Approved/...)
function check_BRFA_status(section) {
	var status, to_exit = this.each.exit;
	this.each.call(section, 'template', function(token) {
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
			BotSpeedy : true,
			BotApproved : true
		}) {
			status = 'style="background-color:#ccf;" | ' + token;
		} else if (token.name in {
			BotWithdrawn : true,
			取り下げ : true,

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

/** {Number}一整天的 time 值。should be 24 * 60 * 60 * 1000 = 86400000. */
var ONE_DAY_LENGTH_VALUE = new Date(0, 0, 2) - new Date(0, 0, 1);

// for 討論議題列表可以挑選欄位: (特定)使用者(最後)留言時間
function add_user_name_and_date_set(section, user_and_date_index) {
	var user = '', date = '', additional_attributes;
	if (user_and_date_index >= 0) {
		var days = (new Date - section.dates[user_and_date_index])
				/ ONE_DAY_LENGTH_VALUE;
		date = section.dates[user_and_date_index];
		if (true) {
			// 採用短日期格式。
			date = date.format({
				format : '%Y-%2m-%2d <span style="color:blue;">%2H:%2M</span>',
				zone : 0
			});
			// 因為不確定閱覽者的時區，因此不能夠再做進一步的處理，例如 CeL.date.indicate_date_time() 。
		} else {
			// 採用簽名的日期格式。
			date = CeL.wiki.parse.date.to_String(date, wiki);
		}
		var date_too_long = date.display_width() > max_date_length;
		date = data_sort_attributes(section.dates[user_and_date_index]) + '| '
		//
		+ (date_too_long ? '<small>' + date + '</small>' : date);
		// 討論議題列表依狀態表現不同的顏色。
		additional_attributes
		// 超過一個月: 深灰色。
		= days > 31 ? 'style="background-color:#bbb;" '
		// 超過一禮拜到一個月: 淺灰色。
		: days > 7 ? 'style="background-color:#ddd;" '
		// 最近1小時內: 淺綠色。
		: 24 * days < 1 ? 'style="background-color:#efe;" '
		// 超過1小時到最近1日內: 淺藍色。
		: days < 1 ? 'style="background-color:#eef;" ' : '';
		user = section.users[user_and_date_index];
		// TODO: link to diff
		user = (additional_attributes ? '| ' : '')
		// 對於匿名IP用戶則顯示編輯紀錄。
		+ (CeL.wiki.parse.user.is_IP(user) ? '[[Special:Contributions/'
		//
		+ user + '|' + user + ']]' : '[[User:' + user + '|]]');
	} else {
		// 沒有發現此 user group 之發言。
		additional_attributes = 'style="background-color:#ffd;" | ';
	}

	return [ additional_attributes + user, additional_attributes + date ];
}

// 討論議題列表可以挑選的欄位。
var section_column_operators = {
	// function: .call(page_data, section, section_index)
	NO : function(section, section_index) {
		return local_number(section_index);
	},
	// 議題的標題
	title : function(section) {
		var title = section.section_title.title,
		// 當標題過長時，縮小標題字型。
		title_too_long = title.display_width() > max_title_length;
		// 限制標題欄的寬度。 [[Template:Small]]
		return (title_too_long ? 'style="max-width: ' + max_title_display_width
				+ ';" | <small>' : '')
				+ section.section_title.link
				+ (title_too_long ? '</small>' : '');
	},
	// discussions conversations, 發言次數, 発言数
	discussions : function(section) {
		return local_number(section.users.length,
				section.users.length >= 1 ? ''
						: 'style="background-color:#fcc;"');
	},
	// 參與討論人數
	participants : function(section) {
		return local_number(section.users.unique().length, section.users
				.unique().length >= 1 ? '' : 'style="background-color:#fcc;"');
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

// [[en:Help:Sorting#Specifying_a_sort_key_for_a_cell]]
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

var section_index_filter = CeL.wiki.parser.paser_prototype.each_section.index_filter;
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
						twist_filter ? twist_filter.call(this, section,
								user_group_filter) : user_group_filter,
						date_type);
			}

			return output_type === 'set' ? add_user_name_and_date_set(section,
					index)
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

	var parser = CeL.wiki.parser(page_data).parse();
	if (!parser) {
		return [
				CeL.wiki.edit.cancel,
				'No contents: ' + CeL.wiki.title_link_of(page_data)
						+ '! 沒有頁面內容！' ];
	}

	if (CeL.wiki.content_of(page_data) !== parser.toString()) {
		console.log(CeL.LCS(CeL.wiki.content_of(page_data), parser.toString(),
				'diff'));
		throw 'parser error';
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
	parser.each('transclusion', function(token, index, parent) {
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
				wikitext : page_data.use_wikitext = parser.toString()
			}).parse();
		}
		generate_topic_list(page_data);
	}, {
		multi : true,
		redirects : 1
	});
}

// ----------------------------------------------------------------------------

function generate_topic_list(page_data) {
	var parser = CeL.wiki.parser(page_data),
	//
	page_configuration = page_data.page_configuration,
	//
	section_table = [
			'<!-- This page will be auto-generated by bot. Please contact me to improve the tool. -->',
			// plainlinks
			'{| class="wikitable sortable collapsible"', '|-',
			page_configuration.heads ],
	//
	column_operators = get_column_operators(page_configuration),
	//
	topic_count = 0, new_topics = [];

	parser.each_section(function(section, section_index) {
		if (section_index === 0) {
			// 跳過頁首設定與公告區。
			return;
		}

		if (page_configuration.section_filter
				&& !page_configuration.section_filter.call(parser, section)) {
			return;
		}

		topic_count++;

		if (Date.now() - section.dates[section.last_update_index] < CeL
				.to_millisecond('1m')) {
			new_topics.push(section.section_title.title);
		}

		// console.log('#' + section.section_title);
		// console.log([ section.users, section.dates ]);
		var row = [];

		column_operators.forEach(function(operator) {
			var values = operator.call(parser, section, section_index);
			if (Array.isArray(values)) {
				row.append(values);
			} else {
				row.push(values);
			}
		});

		section_table.push('|-\n| ' + row.join(' || '));
	}, {
		get_users : true,
		level_filter : page_configuration.level_filter,
		// set options[KEY_SESSION] for parse_date()
		session : wiki
	});

	section_table.push('|}');
	if (page_configuration.postfix) {
		// {Array}section_table
		page_configuration.postfix(section_table);
	}

	// 討論議題列表放在另外一頁。
	var topic_page = page_configuration.topic_page;
	if (topic_page.startsWith('/')) {
		topic_page = page_data.title + topic_page;
	}

	if (0) {
		console.log(section_table.join('\n'));
		throw 'generate_topic_list: No edit';
	}

	wiki.page(topic_page)
	// TODO: CeL.wiki.array_to_table(section_table)
	.edit(section_table.join('\n'), {
		bot : 1,
		nocreate : 1,
		summary : 'generate topic list: '
		// -1: 跳過頁首設定與公告區。
		+ topic_count + ' topics'
		//
		+ (new_topics.length > 0 ? ', new: ' + new_topics.join('; ') : '')
	})
	// 更新主頁面。
	.purge(page_data.title);
}
