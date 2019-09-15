/**
 * @fileoverview 本檔案包含了特殊頁面的設定。
 */

'use strict';

// Load CeJS library and modules.
require('./wiki loader.js');

/* eslint no-use-before-define: ["error", { "functions": false }] */
/* global CeL */
/* global Wiki */

var
/** {Number}未發現之index。 const: 基本上與程式碼設計合一，僅表示名義，不可更改。(=== -1) */
NOT_FOUND = ''.indexOf('_');

var
/** {Object}設定頁面所獲得之手動設定 manual settings。 */
configuration;

function adapt_configuration_to_page(_configuration) {
	configuration = _configuration;
}

// ================================================================================================

// 一般用討論頁面列表設定。

// column_to_header[column] = header used
var localized_column_to_header = {
	// TODO: using https://translatewiki.net/wiki/Translating:MediaWiki
	// @see https://zh.wikipedia.org/wiki/Wikipedia:用戶介面翻譯/MessagesZh_hant.php
	// e.g., {{int:filehist-user}} {{int:filehist-datetime}}
	zh : {
		// 序號 Topics主題
		title : '話題',
		discussions : '<small title="發言數/發言人次 (實際上為計算簽名數)">發言</small>',
		participants : '<small title="參與討論人數/發言人數">參與</small>',
		// first_user_set: 發起人與發起時間(Created)

		// last_user_set: 最後留言者與最後時間(Last editor) 最後編輯者+最後編輯於
		last_user_set : '最新發言 !! data-sort-type="isoDate" | <small>最後更新(UTC+8)</small>',

		// last_admin_set: 特定使用者 special_users.admin 最後留言者與最後時間
		last_admin_set : '[[WP:ADM|管理員]]發言 !! data-sort-type="isoDate" | 管理員更新(UTC+8)',

		// last_BAG_set: 特定使用者 special_users.BAG 最後留言者與最後時間(Last BAG editor)
		// last_BAG_set: 最後BAG編輯者+BAG最後編輯於
		last_BAG_set : '<small>最新[[WP:BAG|BAG]]發言</small> !! data-sort-type="isoDate" | <small>BAG最後更新(UTC+8)</small>',

		last_botop_set : '<small>最新[[Template:User bot owner|機器人操作者]]</small> !! data-sort-type="isoDate" | <small>機器人操作者更新(UTC+8)</small>'
	},
	'zh-classical' : {
		NO : 'data-sort-type="number" | <small>序</small>',
		title : '議題',
		discussions : 'data-sort-type="number" | <small title="議論數">論</small>',
		participants : 'data-sort-type="number" | <small title="參議者數">參議</small>',
		last_user_set : '末議者 !! data-sort-type="isoDate" | 新易(UTC+8)',
		last_admin_set : '[[WP:有秩|有秩]] !! data-sort-type="isoDate" | 有秩新易(UTC+8)'
	},
	ja : {
		// 質問や提案、議論
		title : '話題',
		discussions : '<small title="発言数">発言</small>',
		participants : '<small title="議論に参加する人数">人数</small>',
		last_user_set : '最終更新者 !! data-sort-type="isoDate" | <small>最終更新日時(UTC+9)</small>',
		// 審議者・決裁者
		last_BAG_set : '<small>[[WP:BUR|決裁者]]更新</small> !! data-sort-type="isoDate" | <small>決裁者最後更新(UTC+9)</small>',
		last_botop_set : '<small>[[Template:User bot owner|Bot運用者]]更新</small> !! data-sort-type="isoDate" | <small>Bot運用者更新日時(UTC+9)</small>'
	},
}[use_language], column_to_header = Object.assign({
	NO : '#'
}, localized_column_to_header);
// free
localized_column_to_header = null;

function generate_headers(page_configuration) {
	var columns = page_configuration.columns;
	columns = columns.split(';');

	var headers;
	// do not overwrite
	if (page_configuration.headers) {
		headers = page_configuration.headers;
	} else {
		/* let */var header_converter = page_configuration.column_to_header;
		headers = '! ' + columns.map(function(column) {
			return header_converter && header_converter[column]
			//
			|| column_to_header[column];
		}).join(' !! ');
		page_configuration.headers = headers;
	}

	return headers;
}

var
// need to add {{/topic list}} to {{/header}}
general_topic_page = '/topic list', general_page_configuration = {
	topic_page : general_topic_page,
	// general_page_columns
	columns : 'NO;title;discussions;participants;last_user_set'
// 不應該列出管理員那兩欄，似乎暗示著管理員與其他用戶不是平等的。
// + ';last_admin_set'
}, localized_page_configuration = Object.assign({
	zh : {
		timezone : 8,
	// row_style : general_row_style
	},
	'zh-classical' : {
		timezone : 8
	},
	ja : {
		timezone : 9
	}
}[use_language], global.localized_page_configuration);

Object.assign(general_page_configuration, localized_page_configuration);
// free
localized_page_configuration = null;
// generate_headers(general_page_configuration);

// ================================================================================================

// tool functions

function is_bot_user(user_name, section, using_special_users) {
	// TODO: using section for [[w:ja:Wikipedia:Bot/使用申請]]
	return (user_name in (using_special_users || global.special_users).bot)
			|| CeL.wiki.PATTERN_BOT_NAME.test(user_name);
}

function if_too_long(title) {
	title = CeL.wiki.parser(title);
	title.each('convert', function(token, index, parent) {
		var keys;
		if (token.no_convert
				|| (keys = Object.keys(token.conversion)).length === 0)
			return;
		return keys.reduce(function(accumulator, currentValue) {
			// 選出長度最長的轉換文字。
			return accumulator.length < currentValue.length ? currentValue
					: accumulator;
		}, '');
	}, true);

	return title.toString()
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

function local_number(number, attributes, style) {
	if (use_language === 'zh-classical') {
		return (attributes ? attributes + ' ' : '')
				+ data_sort_attributes(number) + ' | '
				// None, N/A
				+ (number === 0 ? '無' : CeL.to_Chinese_numeral(number));
	}

	style = (style || '') + 'text-align: right;';
	if (!attributes) {
		if (!style) {
			return number;
		}
		attributes = 'style="' + style + '"';
	} else if (!attributes.includes('style="')) {
		attributes += ' ' + 'style="' + style + '"';
	} else {
		attributes = attributes.replace('style="', 'style="' + style);
	}
	return attributes + ' | ' + number;
}

// ================================================================================================

// default configurations for BRFA 機器人申請
var default_BRFA_configurations = {
	topic_page : general_topic_page,
	columns : 'NO;title;status;discussions;participants;last_user_set;last_BAG_set',
	column_to_header : {
		zh : {
			title : '機器人申請',
			status : '進度'
		},
		ja : {
			title : 'Bot使用申請',
			status : '進捗'
		}
	}[use_language],
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
	section_filter : BRFA_section_filter,
	twist_filter : {
		// 帶有審核意味的討論，審查者欄位應該去掉申請人。
		BAG : function(section, user_group_filter) {
			var new_filter = Object.create(null);
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
	// @see section_column_operators
	operators : {
		title : function(section) {
			var attributes = '';

			// @see section_link_toString() @ CeL.wiki
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

// asset: (MAX_32bit_INTEGER + 1) | 0 < 0
var MAX_32bit_INTEGER = (1 << 30) * 2 - 1;

var default_FC_vote_configurations = {
	topic_page : general_topic_page,
	columns : 'NO;title;support;oppose;invalid;status;countdown;discussions;participants;last_user_set',
	column_to_header : {
		zh : {
			NO : 'style="font-size: .3em;" |',
			title : '條目標題',
			// 贊成
			support : 'data-sort-type="number" | <small>支持</small>',
			oppose : 'data-sort-type="number" | <small>反對</small>',
			invalid : 'data-sort-type="number" | <small title="包括截止後的投票">無效</small>',
			status : 'data-sort-type="number" | <span title="已去掉逾期選票">狀態</span>',
			countdown : 'data-sort-type="number" | <span title="從上次編輯時間起算之截止期限。非從現在起的時間！">截止</span>'
		}
	}[use_language],
	// 要篩選的章節標題層級。
	level_filter : 3,

	// 發言數量固定減去此數。
	// 減去提名時嵌入的簽名。
	discussion_minus : 1,

	timeout_id_hash : Object.create(null),
	// 註冊 listener。 this: see .section_filter()
	vote_closed_listener : function() {
		// wiki.page(this.title, pre_fetch_sub_pages);
	},

	// will be used in .section_filter()
	support_templates : 'YesFA|YesFL|YesGA|YesFP'.split('|').map(
			function(title) {
				return CeL.wiki.normalize_title(title);
			}).to_hash(),
	oppose_templates : 'NoFA|NoFL|NoGA|NoFP'.split('|').map(function(title) {
		return CeL.wiki.normalize_title(title);
	}).to_hash(),
	cross_out_templates_header : {},
	cross_out_templates_footer : {
		// {{Votevoidh}}統合了較多模板。結尾部分分割得較多部分，例如{{Votevoidf}},{{Timeoutf}}
		Votevoidf : true,
		投票無效f : true,

		// 該用戶投票因與先前重複而無效，但意見可供參考。
		Votedupf : true,

		// 投票者沒有註明理由，所以本票無效，請投票者補充理由。
		Noreasonf : true,
		沒理由f : true,
		沒有理由f : true,
		無理由f : true,

		// 該用戶不符合資格
		Notqualifiedf : true,
		Nqf : true,

		Nosignf : true,
		未簽名f : true,
		Unsignf : true,

		// 傀儡投票
		Sockvotedupf : true,

		// 投票者使用刪除線刪除本票，所以本票無效。
		Votedeletef : true,

		Timeoutf : true,
		OvertimeF : true,
		超過時限f : true,
		Overtimef : true,
	},

	set_vote_closed : set_FC_vote_closed,
	get_votes_on_date : get_FC_votes_on_date,
	// 篩選章節標題。
	section_filter : FC_section_filter,
	// for FA, FL
	pass_vote : function(diff, section) {
		var page_configuration = this.page.page_configuration;
		return diff >= 8
				// 有效淨支持票數滿8票方能中選。
				&& page_configuration.get_votes_on_date(section, null, true) >= 2 * page_configuration
						.get_votes_on_date(section, null, false);
	},
	// column operators
	// @see section_column_operators
	operators : {
		title : function(section) {
			var title = section.section_title.title,
			// 當標題過長時，縮小標題字型。
			title_too_long = if_too_long(title);
			// @see section_link_toString() @ CeL.wiki
			title = CeL.wiki.title_link_of(section.section_title.link[0]
					.replace(/\/(?:提名区|提名區)$/, '')
					+ '#' + title, title);
			return title_too_long ? '<small>' + title + '</small>' : title;
		},

		support : function(section) {
			var page_configuration = this.page.page_configuration;
			var votes = page_configuration.get_votes_on_date(section, null,
					true);
			return votes > 0 ? local_number(votes) : '';
		},
		oppose : function(section) {
			var page_configuration = this.page.page_configuration;
			var votes = page_configuration.get_votes_on_date(section, null,
					false);
			return votes > 0 ? local_number(votes) : '';
		},
		invalid : function(section) {
			var votes = section.vote_list.invalid.length;
			if (votes > 0) {
				// console.log(section.vote_list.invalid);
			}
			return votes > 0 ? local_number(votes, null, 'color: red;') : '';
		},

		countdown : FC_vote_countdown,
		status : check_FC_status
	}
};
Object.assign(default_FC_vote_configurations, global.FC_vote_configurations);
Object.keys(default_FC_vote_configurations.cross_out_templates_footer)
//
.forEach(function(title) {
	if (!/f$/i.test(title))
		return;

	title = title.replace(/f$/i, function($0) {
		return $0 === 'f' ? 'h' : 'H';
	});
	default_FC_vote_configurations.cross_out_templates_header[title] = true;
});
// console.log(default_FC_vote_configurations);

// default configurations for DYK vote 投票
// TODO: check [[Category:拒絕當選首頁新條目推薦欄目的條目]]
var default_DYK_vote_configurations = {
	page_header1 : '<span style="color: red;">下面這個列表正在測試中。請[[Wikipedia:互助客栈/其他#是否要保留新條目評選列表討論|提供您的意見]]讓我們知道，謝謝！</span>',
	page_header2 : '<span style="color: red;">依據[[Wikipedia:互助客栈/其他#是否要保留新條目評選列表討論|討論]]，希望回復原先列表的人數較多。將會在4月24日恢復原先列表。</span>',
	// 默認摺疊，需要的點擊展開
	header_class : 'wikitable sortable collapsible autocollapse',

	// 建議把票數隱藏，我非常擔心這會為人情水票大開方便之門。
	columns : 'NO;title;status;countdown;discussions;participants;last_user_set',
	// .no_vote_message: 不要顯示得票數。
	no_vote_message : true,

	// 要篩選的章節標題層級。
	level_filter : 4,

	discussion_minus : 0,

	// 肯定
	// 規則講明計算「支持票」和「反對票」，如果接受帶有「激情」的票，怕會做壞榜樣
	// |Strong support|强烈支持 |Strong oppose|Strongly oppose|強烈反對
	// 未來若要採用機器計票，遇到類似情況，直接讓計票機器人提醒。溫馨提示
	// {{提醒}}：{{ping|user}}{{tl|強烈支持}}並不是有效票。按本區規則，計算有效票衹接受{{tl|支持}}和{{tl|反對}}。
	// --~~~~
	//
	// {{滋瓷}}本來就是娛樂用途 |滋磁|Zici|Zupport|滋瓷|资磁|资瓷|资辞
	// {{傾向支持}}的立場比較薄弱，當成1票支持計算似乎也不合理。
	support_templates : 'Support|SUPPORT|Pro|SP|ZC|支持'.split('|').map(
			function(title) {
				return CeL.wiki.normalize_title(title);
			}).to_hash(),
	// {{Seriously}}
	oppose_templates : 'Oppose|OPPOSE|Contra|不同意|O|反对|反對'.split('|').map(
			function(title) {
				return CeL.wiki.normalize_title(title);
			}).to_hash(),
	// 篩選章節標題。
	section_filter_in_template : function(token, section) {
		if (token.name === 'DYKEntry') {
			section.DYKEntry = token;
			// overwrite section.section_title.title for `new_topics`
			section.section_title.title = token.parameters.article;
			if (+token.parameters.timestamp) {
				section.vote_time_limit = 1000
				// .timestamp: in seconds
				* token.parameters.timestamp
				// 基本投票期為4天。
				+ CeL.date.to_millisecond('4D');
			}
		} else if (token.name === 'DYKCsplit') {
			// 記錄這一段可直接跳過。
			section.may_skip_section = true;
		}
	},
	// 否則，投票期將自動延長3天，並待至延長投票期屆滿時方為結束投票；
	extend_intervals : [ '3D' ],
	section_filter_postfix : function(section) {
		if (!section.DYKEntry)
			return !section.may_skip_section;
	},
	// 已經可以早期判別選舉的結果。
	pass_vote_prefix : function(section) {
		if (section.DYKEntry) {
			if (/^\+/.test(section.DYKEntry.parameters.result)) {
				return "<span style=\"color: green;\">'''當選'''</span>";
			}
			if (/^\-/.test(section.DYKEntry.parameters.result)) {
				return "<span style=\"color: red;\">'''未當選'''</span>";
			}
		}
	},
	pass_vote : function(diff, section) {
		// 有效淨支持票數滿4票方能中選。
		return diff >= 4;
	},
	// column operators
	operators : {
		title : function(section) {
			if (!section.DYKEntry)
				return 'N/A';

			var title = section.DYKEntry.parameters.article,
			// 當標題過長時，縮小標題字型。
			title_too_long = if_too_long(title);
			// @see section_link_toString() @ CeL.wiki
			title = CeL.wiki.title_link_of(section.section_title.link[0] + '#'
					+ title, title);
			return title_too_long ? '<small>' + title + '</small>' : title;
		}
	}
};

default_DYK_vote_configurations.operators = Object.assign(Object.create(null),
		default_FC_vote_configurations.operators,
		default_DYK_vote_configurations.operators);
default_DYK_vote_configurations = Object.assign(Object.create(null),
		default_FC_vote_configurations, default_DYK_vote_configurations);

// ================================================================================================

// page configurations for all supported talk pages
var page_configurations = {
	// TODO: Wikipedia:バグの報告 Wikipedia:管理者伝言板 Wikipedia:お知らせ
	'jawiki:Wikipedia:Bot/使用申請' : Object.assign({
		timezone : 9
	// 僅會顯示包含"bot"的標題
	// @see is_bot_user(user_name, section)
	}, default_BRFA_configurations),
	'jawiki:Wikipedia:Bot作業依頼' : {
		topic_page : general_topic_page,
		timezone : 9,
		columns : 'NO;title;status;discussions;participants;last_user_set;last_botop_set',
		column_to_header : {
			title : '依頼',
			status : '進捗'
		},
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
		additional_header : 'style="float: left;"',
		timezone : 9,
		transclusion_target : function(token) {
			if (token.name === '井戸端サブページ' && token.parameters.title) {
				return 'Wikipedia:井戸端/subj/' + token.parameters.title;
			}
			if (token.name === '井戸端から誘導' && token.parameters.page) {
				return [ token.parameters.page, token.parameters.title ];
			}
		},
		postfix : function(section_table) {
			// 早見表
			if (false)
				// using .page_header
				section_table.push("↑'''この議題一覧表に関する議論は現在[[Wikipedia‐ノート:井戸端"
						+ "#節ごとの発言数・参加者数・最終更新日時などの表(topic list)について"
						+ "|ノートページ]]で行われています。皆様のご意見をお願いいたします。'''");
		},
		purge_page : 'Wikipedia:議論が盛んなノート'
	}, general_page_configuration),

	'zhwiki:Wikipedia:机器人/作业请求' : {
		topic_page : general_topic_page,
		timezone : 8,
		columns : 'NO;title;status;discussions;participants;last_user_set;last_botop_set',
		column_to_header : {
			title : '需求',
			// 處理情況
			status : '進度',
		},
		operators : {
			// 議體進度狀態。
			status : check_BOTREQ_status
		}
	},
	'zhwiki:Wikipedia:机器人/申请' : Object.assign({
		timezone : 8,
		// 要篩選的章節標題層級。
		level_filter : [ 2, 3 ],
		// 發言數量固定減去此數。
		// 減去機器人等權限申請時嵌入的簽名。
		discussion_minus : 1
	}, default_BRFA_configurations),
	'zhwiki:Wikipedia:机器用户/申请' : Object.assign({
		timezone : 8,
		column_to_header : {
			title : '機器用戶申請'
		},
		// 要篩選的章節標題層級。
		level_filter : 3
	}, Object.assign(Object.create(null), default_BRFA_configurations, {
		transclusion_target : null,
		section_filter : RFF_section_filter
	})),

	// TODO: 維基百科:同行評審
	'zhwiki:Wikipedia:典范条目评选/提名区' : Object.assign({
		timezone : 8,
		need_time_legend : false
	}, default_FC_vote_configurations),
	'zhwiki:Wikipedia:特色列表评选/提名区' : Object.assign({
		timezone : 8,
		need_time_legend : false,
		// 初次延長期（基礎評選期＋14日）及最後延長期（初次延長期＋28日）
		extend_intervals : [ '14D', '28D' ]
	}, default_FC_vote_configurations),
	'zhwiki:Wikipedia:優良條目評選/提名區' : Object.assign({
		timezone : 8,
		need_time_legend : false
	}, default_FC_vote_configurations, {
		pass_vote : function(diff, section) {
			// 有至少6個投票認為條目符合優良條目標準
			return diff >= 6;
		}
	}),
	'zhwiki:Wikipedia:新条目推荐/候选' : Object.assign({
		timezone : 8
	}, default_DYK_vote_configurations),
	'zhwiki:Wikipedia:特色圖片評選' : Object.assign({
		timezone : 8
	}, default_FC_vote_configurations, {
		transclusion_target : function(token) {
			if (token.name.startsWith(this.title + '/')) {
				return token.name;
			}
		},
		// 要篩選的章節標題層級。
		level_filter : 3,
		pass_vote : function(diff, section) {
			// 候選圖片獲得'''8張'''或以上的「符合特色圖片標準」票；「不符合特色圖片標準」票與「符合特色圖片標準」票1:1抵消。
			return diff >= 8;
		}
	}),

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

// ================================================================================================
// column operators & status functions

function BRFA_section_filter(section) {

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
						// console.log(global.special_users.bot);
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
}

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
			status = 'style="background-color: #efe;" | '
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
			status = 'style="background-color: #fdd;" | ' + '{{ ' + token.name
					+ '}}';
			// 此模板代表一種決定性的狀態，可不用再檢查其他內容。
			return to_exit;
		}

		if (token.name in {
			スタック : true
		}) {
			// 這個做法可以去掉模板中的簽名。
			status = 'style="background-color: #ffc;" | ' + '{{ ' + token.name
					+ '}}';
			// 此模板代表一種決定性的狀態，可不用再檢查其他內容。
			return to_exit;
		}

		if (token.name === 'BOTREQ') {
			// [[Template:BOTREQ]]
			status = (token[1] || '').toString().toLowerCase().trim();
			if (status === 'done' || status === '完了') {
				status = 'style="background-color: #dfd;" | ' + token;
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
			status = 'style="background-color: #dfd;" | ' + token;
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
			status = 'style="background-color: #fbb;" | ' + token;
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
				status = 'style="background-color: #cfc;" | ' + status;
			} else if (/^(?:new|tric|trial complete|測試完成|测试完成)$/
			//
			.test(BRFA_status)) {
				status = 'style="background-color: #ffc;" | ' + status;
			} else if (/^(?:\+|app|approved|批准)$/.test(BRFA_status)) {
				status = 'style="background-color: #ccf;" | ' + status;
			} else if (
			//
			/^(?:\-|den|deny|denied|拒絕|拒绝|wit|withdraw|撤回|rev|revoke|revoked|撤銷|撤销)$/
			//
			.test(BRFA_status)) {
				status = 'style="background-color: #fcc;" | ' + status;
			} else if (/^(?:exp|expire|expired|過期|过期|\?|dis|discuss|討論|讨论)$/
			//
			.test(BRFA_status)) {
				status = 'style="background-color: #ddd;" | ' + status;
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
				status = 'style="background-color: #ccf;" | ' + status;
			} else if (
			//
			/^(?:\-|Not done|not done|拒絕|拒绝|驳回|駁回|未完成)$/
			//
			.test(BRFA_status)) {
				status = 'style="background-color: #fcc;" | ' + status;
			} else if (/^(?:on hold|擱置|搁置|等待|等待中|OH|oh|hold|Hold|\*|\?)$/
			//
			.test(BRFA_status)) {
				status = 'style="background-color: #ddd;" | ' + status;
			}
			// 此模板代表一種決定性的狀態，可不用再檢查其他內容。
			return to_exit;
		}

		// [[Template:BAG_Tools]], [[Template:Status2]]
		if (token.name in {
			BotTrial : true,
			BotExtendedTrial : true
		}) {
			status = 'style="background-color: #cfc;" | ' + token;
		} else if (token.name in {
			BotTrialComplete : true,
			OperatorAssistanceNeeded : true,
			BAGAssistanceNeeded : true
		}) {
			status = 'style="background-color: #ffc;" | ' + token;
		} else if (token.name in {
			対処 : true,

			BotSpeedy : true,
			BotApproved : true
		}) {
			status = 'style="background-color: #ccf;" | ' + token;
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
			status = 'style="background-color: #fcc;" | ' + token;
		} else if (token.name in {
			BotOnHold : true,

			'On hold' : true,
			OnHold : true,
			擱置 : true,
			搁置 : true
		}) {
			status = 'style="background-color: #ccc;" | ' + token;
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

// --------------------------------------------------------------------------------------

function set_FC_vote_closed(section) {
	if (!(+section.vote_time_limit > 0)) {
		// 警告: 沒設定 section.vote_time_limit，有問題！
		return;
		return section.vote_closed;
	}

	// assert: +section.vote_time_limit > 0

	if (!(Date.now() >= +section.vote_time_limit)) {
		// section.vote_closed = false;
		return;
	}

	// 已過初期期限。
	var page_configuration = this.page.page_configuration;

	if (!page_configuration.extend_intervals) {
		// 沒有設定任何延長期限。 extensions
		section.vote_closed = true;
		return;
	}

	// assert: {Array}.extend_intervals
	if (page_configuration.extend_intervals.some(function(interval) {
		var diff = page_configuration.get_votes_on_date(section);
		if (page_configuration.pass_vote.call(this, diff, section)) {
			// 至本段投票期屆滿時，如獲得中選所需的最低票數或以上，投票即會結束並獲通過。
			section.vote_closed = true;
			return true;
		}

		// 否則，投票期將自動延長 `interval`。
		section.vote_time_limit = +section.vote_time_limit
				+ CeL.date.to_millisecond(interval);
		return Date.now() < section.vote_time_limit;
	}, this)) {
		return;
	}

	section.vote_closed = Date.now() >= +section.vote_time_limit;
}

// 以截止時間來檢核所有逾期的選票。 應對中文維基之延期制度。
// MUST setup section.vote_time_limit, section.vote_list first!
// (@ function FC_section_filter(section))
function get_FC_votes_on_date(section, date, support_only) {
	function filter_via_date(previous, vote_template) {
		return previous + (date - vote_template.vote_date >= 0 ? 1 : 0);
	}

	if (!date)
		date = section.vote_time_limit;

	var support, oppose;
	if (typeof support_only === 'boolean') {
		support = support_only;
		oppose = !support_only;
	} else {
		support = oppose = true;
	}

	if (+date > 0) {
		support = support ? section.vote_list.support
				.reduce(filter_via_date, 0) : 0;
		oppose = oppose ? section.vote_list.oppose.reduce(filter_via_date, 0)
				: 0;
	} else {
		support = support ? section.vote_list.support.length : 0;
		oppose = oppose ? section.vote_list.oppose.length : 0;
	}

	if (typeof support_only === 'boolean' && !support_only) {
		return oppose;
	}

	var diff = support - oppose;
	return diff;
}

// --------------------------------------

/* const */
var VOTE_SUPPORT = 1, VOTE_OPPOSE = -1, INVALID_VOTE = 0;

function move_to_invalid(section, vote_token) {
	var list = vote_token.vote_type === VOTE_SUPPORT
	// assert: vote_token.vote_type === VOTE_SUPPORT or VOTE_OPPOSE
	? section.vote_list.support : section.vote_list.oppose;

	var index = list.indexOf(vote_token);
	// assert: index !== NOT_FOUND

	list.splice(index, 1);

	vote_token.vote_type = INVALID_VOTE;
	vote_token.invalid_reason = '多次投票: ' + vote_token.vote_user;
	section.vote_list.invalid.push(vote_token);
}

// 讓機器人判定多次投票的用戶、IP投票（包括同時投下支持和反對票）無效。
function check_mutiplte_vote(section, latest_vote) {
	// console.log(latest_vote);
	if (!latest_vote.vote_user || !latest_vote.vote_date) {
		return;
	}

	// 已經判別出本投票模板的選舉人以及投票時間，可以檢查是否重複投票。
	// console.log(latest_vote);

	var latest_vote_of_user
	// assert: {String}latest_vote.vote_user !== ''
	= section.vote_of_user[latest_vote.vote_user];
	if (!latest_vote_of_user) {
		// 登記選舉人所投的選票。
		section.vote_of_user[latest_vote.vote_user] = latest_vote;
		return;
	}
	// console.log(latest_vote_of_user);

	if (latest_vote_of_user.vote_type === VOTE_SUPPORT
	//
	|| latest_vote_of_user.vote_type === VOTE_OPPOSE) {
		if (latest_vote_of_user.vote_type === latest_vote.vote_type) {
			// 投了多次同意或者多次反對，只算一次：前面第一次當作有效票，把後面的這一次當作廢票。

		} else {
			// 兩次投票不同調。把兩次都當作廢票。先處理前一次。
			move_to_invalid(section, latest_vote_of_user);
		}

		// 無論哪一種情況，本次投票都是廢票。
		move_to_invalid(section, latest_vote);

	} else {
		// assert: latest_vote_of_user.vote_type === INVALID_VOTE
		// 這個使用者前一次就已經是無效票/廢票。

		if (latest_vote.vote_type !== INVALID_VOTE) {
			// assert: 之前投的全都是無效票。現在這一張票是第一張有效票。
			section.vote_of_user[latest_vote.vote_user] = latest_vote;
		}
	}

	// 已經處理完latest_vote。為了不讓check_mutiplte_vote()重複處理latest_vote，因此reset。
	// latest_vote = null;

	return true;
}

function cross_out_vote(section, latest_vote, cross_out_token) {
	if (latest_vote && (latest_vote.vote_type === VOTE_SUPPORT
	//
	|| latest_vote.vote_type === VOTE_OPPOSE)) {
		if (latest_vote.vote_type === VOTE_SUPPORT)
			section.vote_list.support.pop();
		else if (latest_vote.vote_type === VOTE_OPPOSE)
			section.vote_list.oppose.pop();

		latest_vote.vote_type = INVALID_VOTE;
		latest_vote.invalid_reason = '被劃票:' + cross_out_token.name;
		section.vote_list.invalid.push(latest_vote);
	}
}

function FC_section_filter(section) {
	// section.vote_of_user[user_name]
	// = {Array} the first valid vote token of user;
	section.vote_of_user = Object.create(null);

	// 正在投票評選的條目。
	section.vote_list = {
		// 有效票中支持的選票template。
		support : [],
		// 有效票中反對的選票template。
		oppose : [],
		// 無效票的選票template。
		invalid : []
	};

	// --------------------------------

	var page_configuration = this.page.page_configuration;
	var latest_vote, cross_out_vote_list, _this = this, skip_inner = this.each.exit;
	this.each.call(section, function(token, index, parent) {
		// TODO: 投票人資格審查。
		// assert: 先投票之後才記錄使用者以及時間。
		if ((typeof token === 'string' || token.type === 'plain'
		//
		|| token.type === 'link') && latest_vote) {
			// parsing user 取得每一票的投票人/選舉人/voter與投票時間點。
			/* let */var user, date, need_check = !latest_vote.vote_user
					|| !latest_vote.vote_date;
			if (token.type === 'link'
			// 就算已有`.vote_user`，還是繼續標註使用者；預防陳述中提到其他使用者的情況。
			// 如此一來將會以日期之前最後一個使用者連結為主。
			// && !latest_vote.vote_user
			) {
				// console.log('check date: ' + token);
				user = CeL.wiki.parse.user(token.toString());
				if (user) {
					latest_vote.vote_user = user;
					// assert: {Date}latest_vote.vote_date
					// console.log(latest_vote);
				}
			} else if ((typeof token === 'string' || token.type === 'plain')
					&& !latest_vote.vote_date) {
				// console.log('check date: ' + token);
				date = CeL.wiki.parse.date(token.toString());
				if (date) {
					latest_vote.vote_date = date;
					// assert: {Date}latest_vote.vote_date
					// console.log(latest_vote);
				}
			}
			if (need_check && (user || date)) {
				// 剛剛設定好voter與投票時間點才需要執行檢查，確保check_mutiplte_vote()只執行一次。
				// console.log(latest_vote);
				check_mutiplte_vote(section, latest_vote);
			}
			return;
		}

		if (token.type !== 'transclusion') {
			return;
		}

		var result_to_exit;
		if (page_configuration.section_filter_in_template
		//
		&& (result_to_exit = page_configuration.section_filter_in_template
		//
		.call(_this, token, section)) !== undefined) {
			return result_to_exit;
		}

		// TODO: 使用刪除線「<s>...</s>」劃掉。

		if (token.name in page_configuration.support_templates) {
			token.vote_type = VOTE_SUPPORT;
			section.vote_list.support.push(token);
			latest_vote = token;
			cross_out_vote_list && cross_out_vote_list.push(token);

		} else if (token.name in page_configuration.oppose_templates) {
			// console.log(token);
			token.vote_type = VOTE_OPPOSE;
			section.vote_list.oppose.push(token);
			latest_vote = token;
			cross_out_vote_list && cross_out_vote_list.push(token);

		} else if (token.name in
		//
		page_configuration.cross_out_templates_header) {
			// 還未獲得投票模板的投票人及日期資訊，因此在這邊先不做劃票動作。
			cross_out_vote_list = [];

		} else if (token.name in
		//
		page_configuration.cross_out_templates_footer) {
			// assert: {String}latest_vote.vote_user !== ''
			if (cross_out_vote_list) {
				CeL.info(CeL.wiki.title_link_of(section.section_title.link[0]
						+ '#' + section.section_title[0])
						+ ': Cross out '
						+ cross_out_vote_list.length
						+ ' vote(s)');
				cross_out_vote_list.forEach(function(vote) {
					cross_out_vote(section, vote, token);
				});
			}
			cross_out_vote_list = null;
		}

	});

	// --------------------------------------

	// search 投票期限
	if (!section.vote_time_limit) {
		var PATTERN = /期：([^<>{}\|\n]+)至([^<>{}\|\n]+)(.)/g, matched;
		while (matched = PATTERN.exec(section.toString())) {
			// e.g., 史克威爾艾尼克斯電子遊戲列表
			// :<small>基礎評選期：2019年1月19日 (六) 07:57 (UTC) 至 2019年2月18日 (一)
			// 07:57 (UTC){{處理中}}</small>
			// :<small>初次延長期：2019年2月18日 (一) 07:57 (UTC) 至 2019年3月20日 (三)
			// 07:57 (UTC){{doing}}</small>
			section.vote_time_limit = CeL.wiki.parse.date(matched[2]);
			// console.log([ matched[2], section.vote_time_limit ]);

			// TODO: add .extend_intervals, e.g., [[Wikipedia:特色列表评选]]
			break;
		}
	}
	if (!section.vote_time_limit) {
		// 投票將於 ... 結束. e.g., [[Wikipedia:特色圖片評選]]
		var matched = section.toString().match(/於([^<>{}\|\n]+)結束/);
		if (matched) {
			section.vote_time_limit = CeL.wiki.parse.date(matched[1]);
		}
	}
	if (section.vote_time_limit) {
		CeL.debug(CeL.wiki.title_link_of(section.section_title.link[0] + '#'
				+ section.section_title[0])
				+ ': 投票截止時間: ' + (CeL.is_Date(section.vote_time_limit)
				//
				? section.vote_time_limit.format() : section.vote_time_limit),
				1);
	} else {
		if (section.users.length === 0) {
			// console.log(section);
			// 無法判別結束時間，又沒有任何使用者標籤的段落，就當作是工作段落，直接跳過。
			return;
		}
		CeL.warn('無法判別投票截止時間: '
				+ CeL.wiki.title_link_of(section.section_title.link[0] + '#'
						+ section.section_title[0]));
	}

	page_configuration.set_vote_closed.call(this, section);
	// console.log(section.vote_time_limit);
	var time_duration = +section.vote_time_limit > 0 && section.vote_time_limit
			- Date.now();
	if (section.vote_closed) {
		// 以截止時間來檢核所有逾期的選票。
		// @see .get_votes_on_date()
		function filter_via_date(vote_template) {
			if (section.vote_time_limit - vote_template.vote_date > 0) {
				return true;
			}
			section.vote_list.invalid.push(vote_template);
		}
		section.vote_list.support = section.vote_list.support
				.filter(filter_via_date);
		section.vote_list.oppose = section.vote_list.oppose
				.filter(filter_via_date);

	} else if (0 < time_duration
	// TimeoutOverflowWarning: \d does not fit into a 32-bit signed integer.
	// 忽略投票截止時間過長，超過24.9天的投票。
	&& time_duration < MAX_32bit_INTEGER) {
		// 在時間截止之後隨即執行一次檢查。
		var timeout_id_hash = page_configuration.timeout_id_hash, section_title =
		// assert: 已經設定好最終章節標題 {String}section.section_title.title
		section.section_title.title;

		if (!(section_title in timeout_id_hash)) {
			// @see section_link_toString() @ CeL.wiki
			CeL.log('Set timer of '
					+ CeL.wiki.title_link_of(section.section_title.link[0]
							+ '#' + section_title) + ': '
					// + time_duration + 'ms, '
					+ CeL.age_of(Date.now() - time_duration) + ' ('
					+ new Date(section.vote_time_limit).toISOString()
					//
					+ ')');
			timeout_id_hash[section_title] = setTimeout(function() {
				delete this.page_configuration
				//
				.timeout_id_hash[this.section_title];
				this.page_configuration.vote_closed_listener.call(this);
			}.bind({
				page_configuration : page_configuration,
				// assert: {String}this.page.title
				title : this.page.title,
				section_title : section_title
			}), time_duration);
			// console.log(timeout_id_hash);
		}
	}

	if (false) {
		console.log(CeL.wiki.title_link_of(section.section_title.title) + ':');
		// console.log(section.vote_list);
		// console.log(Object.keys(section.vote_list));
		Object.keys(section.vote_list).forEach(function(type) {
			if (section.vote_list[type].length === 0)
				return;
			console.log(type + ': '
			//
			+ section.vote_list[type].map(function(vote_template) {
				var vote_status = JSON.stringify(vote_template.vote_date);
				if (vote_template.invalid_reason)
					vote_status += ' ' + vote_template.invalid_reason;
				return vote_status;
				return CeL.is_Date(vote_template.vote_date)
				//
				? vote_template.vote_date.toISOString()
				//
				: vote_template.vote_date;
			}).join('\n	'));
		});
	}

	// --------------------------------------

	var preserve;
	if (page_configuration.section_filter_postfix
			&& (preserve = page_configuration.section_filter_postfix.call(this,
					section)) !== undefined) {
		return preserve;
	}

	section.section_index = this.section_length = this.section_length ? ++this.section_length
			: 1;

	return true;
}

// countdown days / time
function FC_vote_countdown(section) {
	var data = 'data-sort-value="' + (section.vote_time_limit - Date.now())
			+ '" | ',
	//
	limit_title = section.vote_time_limit;
	if (+limit_title > 0) {
		if (!CeL.is_Date(section.vote_time_limit))
			limit_title = new Date(limit_title);
		limit_title = ' title="' + limit_title.format({
			format : '%Y-%2m-%2d %2H:%2M',
			// 採用當個項目最多人所處的時區。
			zone : this.page.page_configuration.timezone || 0
		}) + '"';
	} else
		limit_title = '';

	if (section.vote_closed) {
		// 時間截止 vote_closed
		return (+section.vote_time_limit > 0 ? data : '')
				+ '<b style="color: red;"' + limit_title + '>截止</b>';
	}

	if (!(+section.vote_time_limit > 0)) {
		// console.log(section);
		return '<b style="color: red;">N/A</b>';
	}

	// assert: +section.vote_time_limit > 0
	// && Date.now() < section.vote_time_limit
	return data + '<small' + limit_title + '>'
	// 還有...天 ; ...日後
	// TODO: 把相關表格的剩餘時間表示方式改為60進位。
	+ CeL.age_of(Date.now(), section.vote_time_limit, {
		// 四捨五入方式。
		digits : 0
	}) + '後</small>';
}

function check_FC_status(section) {
	var page_configuration = this.page.page_configuration;
	// console.log(page_configuration.columns);
	// 暗中顯示支持與反對的票數以供檢查調試。
	var votes = page_configuration.columns.includes('support')
			&& page_configuration.columns.includes('oppose') ? ''
			: '<b style="display: none;">'
					+ page_configuration.get_votes_on_date(section, null, true)
					+ '-'
					+ page_configuration
							.get_votes_on_date(section, null, false) + ' ('
					+ section.vote_list.invalid.length + ')' + '</b>';
	if (false)
		console.log('votes of ' + section.section_title.title + ': ' + votes);

	var pass_vote_prefix = typeof page_configuration.pass_vote_prefix === 'function'
			&& page_configuration.pass_vote_prefix.call(this, section);
	if (pass_vote_prefix) {
		// 已經可以早期判別選舉的結果。
		return votes + pass_vote_prefix;
	}

	var diff = page_configuration.get_votes_on_date(section);
	var status_wikitext = 'data-sort-value="' + diff + '"';
	if (page_configuration.pass_vote.call(this, diff, section)) {
		status_wikitext += ' | ' + votes
				+ "<span style=\"color: blue;\">'''已達標'''</span>";
	} else if (section.vote_closed) {
		status_wikitext += ' | ' + votes
				+ "<span style=\"color: red;\">'''未當選'''</span>";

	} else if (diff > 0) {
		status_wikitext += local_number(votes
		// .no_vote_message: 不要顯示得票數。
		+ (page_configuration.no_vote_message ? '' : diff + '票'));
	} else if (diff < 0) {
		status_wikitext += ' | ' + votes
		// 得票數小於零
		+ (page_configuration.no_vote_message ? ''
		//
		: '<span style="color: #800;">反對' + -diff + '</span>');
	} else {
		status_wikitext += ' | ' + votes
		// e.g., diff === 0, isNaN(diff)
		+ (page_configuration.no_vote_message ? ''
		//
		: '<b style="color: gray;">-</b>');
	}

	return status_wikitext;
}

// --------------------------------------------------------------------------------------

function RFF_section_filter(section) {

	// [[Wikipedia:机器人/申请/preload2]]
	// get bot name from link in section title.
	var applicants_name = CeL.wiki.parse.user(section.section_title.toString());
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
		console.log([ section.bot_name, applicants,
				section.section_title.toString(), section.section_title ]);
		console.log(section.toString());
	}

	// console.log(section.bot_name && applicants.length);
	return section.bot_name && applicants.length > 0;
}

// ================================================================================================

// module.exports.page_configurations
// global.page_configurations = page_configurations;

module.exports = {
	// properties
	page_configurations : page_configurations,
	generate_headers : generate_headers,
	general_page_configuration : general_page_configuration,

	// tool functions
	is_bot_user : is_bot_user,
	if_too_long : if_too_long,
	local_number : local_number,
	data_sort_attributes : data_sort_attributes,

	adapt_configuration_to_page : adapt_configuration_to_page
};
