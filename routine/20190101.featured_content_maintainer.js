// cd /d D:\USB\cgi-bin\program\wiki && node 20190101.featured_content_maintainer.js type=good environment=production days_later=2

/*

 2019/1/1 13:39:58	初版試營運: 每日更新 zhwiki 首頁特色內容
 2019/1/5 12:32:58	轉換成經過繁簡轉換過的最終標題。
 2019/1/9 21:22:42	重構程式碼: using FC_data_hash
 2019/1/10 13:9:32	add 首頁優良條目展示
 2019/1/13 9:33:15	修正頁面

 // 輪流展示列表

 @see https://en.wikipedia.org/wiki/Wikipedia:Good_articles/mismatches

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

login_options.configuration_adapter = adapt_configuration;

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true);

// ---------------------------------------------------------------------//

var is_production_environment = CeL.env.arg_hash
// environment=production
&& CeL.env.arg_hash.environment === 'production',

// node 20190101.featured_content_maintainer.js type=good
using_GA = CeL.env.arg_hash && CeL.env.arg_hash.type === 'good',
/** {String}特色內容將採用的前綴: 'Wikipedia:' + NS_PREFIX */
NS_PREFIX = using_GA ? '優良條目' : '典範條目',
/** {String}將顯示的類型名稱。 */
TYPE_NAME = using_GA ? '優良條目' : '特色內容',

JDN_today = CeL.Julian_day(new Date),
// + 1: 明天 JDN_tomorrow
JDN_to_generate = JDN_today
		+ (CeL.env.arg_hash && (CeL.env.arg_hash.days_later | 0) || 1),
//
JDN_search_to = Math.max(JDN_today, JDN_to_generate - 1),
// 開始有特色內容頁面的日期。
JDN_start = using_GA ? CeL.Julian_day.from_YMD(2006, 9, 3, true)
		: CeL.Julian_day.from_YMD(2013, 8, 20, true),
// 典範JDN: 開始廢棄"特色條目"，採用"典範條目"的日期。
典範JDN = CeL.Julian_day.from_YMD(2017, 10, 1, true),
// {{#time:Y年n月|+1 day}}
// @see Template:Feature , Template:Wikidate/ymd
月日_to_generate = CeL.Julian_day.to_Date(JDN_to_generate).format('%m月%d日'),

FC_list_pages = (using_GA ? 'WP:GA' : 'WP:FA|WP:FL').split('|'),
// [[Wikipedia:已撤銷的典範條目]] 條目連結
// 典範條目很可能是優良條目進階而成，因此將他們全部列為已撤銷的。
Former_FC_list_pages = (using_GA ? 'WP:DGA|WP:FA|WP:FFA' : 'WP:FFA|WP:FFL')
		.split('|'), sub_FC_list_pages = [],
// 出問題時，至此頁面提醒社群。須保證本頁面存在，並且機器人可以寫入。
// [[Wikipedia:互助客栈/其他]], [[Wikipedia:互助客栈/条目探讨]]
DISCUSSION_PAGE = 'Wikipedia talk:首页', DISCUSSION_edit_options = {
	section : 'new',
	sectiontitle : 月日_to_generate + '的首頁' + TYPE_NAME + '頁面似乎有問題，請幫忙處理',
	nocreate : 1,
	summary : 'bot: ' + 月日_to_generate + '的首頁' + TYPE_NAME
			+ '頁面似乎有問題，無法解決，通知社群幫忙處理。'
},

/** 特色內容為列表 */
KEY_IS_LIST = 0,
/** 為已撤銷的特色內容 */
KEY_ISFFC = 1,
// to {String}transcluding page title.
// e.g., FC_data[KEY_TRANSCLUDING_PAGE]="Wikipedia:典範條目/條目"
KEY_TRANSCLUDING_PAGE = 2, KEY_JDN = 3,
// 指示用。會在 parse_each_FC_item_list_page() 之後就刪除。
KEY_LIST_PAGE = 4,
// 上次展示時間
KEY_LATEST_JDN = 4,
/** 特色內容類別 */
KEY_CATEGORY = 5,
// 日期頁面包含另外一個日期頁面，因此必須修正，以直接指向簡介頁面。
KEY_TITLES_TO_MOVE = 6,
//
KEY_DISPLAY_TEXT = 7,
// FC_data_hash[redirected FC_title] = [ {Boolean}is_list,
// {Boolean}is former FC, {String}transcluding page title, [ JDN list ] ]
FC_data_hash = Object.create(null), new_FC_pages,

/** {Array}錯誤記錄 */
error_logs = [], FC_title_sorted, redirects_list_to_check = [],
// cache file of redirects
redirects_to_file = base_directory + 'redirects_to.json',
// redirects_to_hash[original_FC_title] = {String}FC_title 經過繁簡轉換過的最終標題
redirects_to_hash = CeL.get_JSON(redirects_to_file) || Object.create(null),
// JDN_hash[FC_title] = JDN
JDN_hash = Object.create(null),
// @see get_FC_title_to_transclude(FC_title)
FC_page_prefix = Object.create(null),
// 避免採用類別
avoid_catalogs, hit_count,
/**
 * {RegExp}每日特色內容頁面所允許的[[w:zh:Wikipedia:嵌入包含]]正規格式。<br />
 * should allow "AdS/CFT對偶" as FC title<br />
 * matched: [ all, transcluding_title, FC_page_prefix, FC_title ]
 */
PATTERN_FC_transcluded = /^\s*\{\{\s*((?:Wikipedia|WP|維基百科|维基百科):((?:特色|典範|典范|優良|优良)(?:條目|条目|列表))\/(?:(?:s|摘要)\|)?([^{}]+))\}\}\s*$/i,
//
get_page_options = {
	converttitles : 1,
	redirects : 1
};

// ---------------------------------------------------------------------//
// main

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
prepare_directory(base_directory);

// CeL.set_debug(6);

function main_work() {
	wiki.cache([ {
		type : 'page',
		// assert: FC_list_pages 所列的頁面包含的必定是所有檢核過的特色內容標題。
		// TODO: 檢核FC_list_pages 所列的頁面是否是所有檢核過的特色內容標題。
		// Former_FC_list_pages: check [[Wikipedia:已撤銷的典範條目]]
		// FC_list_pages: 檢查WP:FA、WP:FL，提取出所有特色內容的條目連結，
		list : Former_FC_list_pages.concat(FC_list_pages),
		redirects : 1,
		reget : true,
		each : parse_each_FC_item_list_page
	}, {
		type : 'page',
		list : sub_FC_list_pages,
		redirects : 1,
		reget : true,
		each : parse_each_FC_item_list_page
	}, {
		type : 'redirects_here',
		// TODO: 一次取得大量頁面。
		list : function() {
			CeL.debug('redirects_to_hash = '
			//
			+ JSON.stringify(redirects_to_hash));
			CeL.debug('FC_data_hash = ' + JSON.stringify(FC_data_hash));
			new_FC_pages = Object.keys(FC_data_hash).filter(function(FC_title) {
				delete FC_data_hash[FC_title][KEY_LIST_PAGE];
				return !(FC_title in redirects_to_hash);
			});
			return new_FC_pages;
		},
		reget : true,
		// 檢查特色內容列表頁面所列出的連結，其所指向的真正頁面標題。
		each : check_FC_redirects
	}, {
		type : 'page',
		// TODO: 一次取得大量頁面。
		list : generate_FC_date_page_list,
		redirects : 1,
		// 並且檢查/解析所有過去首頁曾經展示過的特色內容頁面，以確定特色內容頁面最後一次展示的時間。（這個動作會作cache，例行作業時只會讀取新的日期。當每天執行的時候，只會讀取最近1天的頁面。）
		each : parse_each_FC_date_page
	}, {
		type : 'redirects_here',
		// TODO: 一次取得大量頁面。
		list : redirects_list_to_check,
		reget : true,
		// 檢查出問題的頁面 (redirects_list_to_check) 是不是重定向所以才找不到。
		each : check_redirects
	}, {
		// 檢查含有特色內容、優良條目模板之頁面是否與登記項目頁面相符合。
		type : 'embeddedin',
		reget : true,
		list : (using_GA ? 'Template:Good article'
		//
		: 'Template:Featured article|Template:Featured list').split('|'),
		each : check_FC_template,
		operator : summary_FC_template
	} ], check_date_page, {
		// JDN index in parse_each_FC_date_page()
		JDN : JDN_start,
		// index in check_redirects()
		redirects_index : 0,

		// default options === this
		// [SESSION_KEY]
		// session : wiki,
		// cache path prefix
		prefix : base_directory
	});
}

wiki.run(main_work);

// ---------------------------------------------------------------------//

/**
 * 由設定頁面讀入手動設定 manual settings。
 * 
 * @param {Object}latest_task_configuration
 *            最新的任務設定。設定頁面所獲得之手動設定。
 */
function adapt_configuration(latest_task_configuration) {
	// console.log(wiki.latest_task_configuration);
	// console.log(wiki);

	// 一般設定
	var general = wiki.latest_task_configuration.general;
	if (!general) {
		CeL.info('No configuration');
		return;
	}

	if (general.stop_working && general.stop_working !== 'false') {
		CeL.info('stop_working setted. exiting...');
		process.exit(2);
		return;
	}

	// 檢查從網頁取得的設定，檢測數值是否合適。
	if (general.DISCUSSION_PAGE) {
		DISCUSSION_PAGE = general.DISCUSSION_PAGE;
	}

	if (!isNaN(general.avoid_same_catalog_past_days)) {
		if (1 <= general.avoid_same_catalog_past_days
				&& general.avoid_same_catalog_past_days <= 10)
			general.avoid_same_catalog_past_days |= 0;
		else
			delete general.avoid_same_catalog_past_days;
	}

	if (!isNaN(general.portal_item_count)) {
		if (1 <= general.portal_item_count && general.portal_item_count <= 100)
			general.portal_item_count |= 0;
		else
			delete general.portal_item_count;
	}

	var _key = 'NS_PREFIX_' + (using_GA ? 'GA' : 'FA');
	if (general[_key]) {
		NS_PREFIX = general[_key];
	}
	_key = 'TYPE_NAME_' + (using_GA ? 'GA' : 'FA');
	if (general[_key]) {
		TYPE_NAME = general[_key];
	}

	// 正式寫入每日頁面時，捨棄cache以防[[Wikipedia:典範條目/2023年8月]]1日和7日重複的情況。
	var force_flush_cache = is_production_environment;
	var flush_cache_before = general.remove_cache
			&& CeL.wiki.parse.date(general.remove_cache);
	if (force_flush_cache || flush_cache_before) {
		// 加上刪除快取選項。
		var latest_flush_file = base_directory + 'latest_flush.json';
		var latest_flush = CeL.get_JSON(latest_flush_file)
				|| Object.create(null);
		var latest_flush_time = Date.parse(latest_flush.date);
		if (force_flush_cache || !latest_flush_time
				|| (flush_cache_before - 0 > 0)
				&& !(latest_flush_time - flush_cache_before > 0)) {
			CeL.info('設定頁面指定 '
					+ flush_cache_before.format()
					+ ' 前要更新 cache。'
					+ (latest_flush_time ? '上一次更新是在'
							+ new Date(latest_flush_time).format() + '，' : '')
					+ '因此清空 cache 目錄。移除 cache 重新取得資料。');
			prepare_directory(base_directory, true);
		}
		latest_flush.date = new Date;
		CeL.write_file(latest_flush_file, latest_flush);
		// reset cache
		redirects_to_hash = Object.create(null);
	}

	CeL.log('Configuration:');
	console.log(wiki.latest_task_configuration);
}

// ---------------------------------------------------------------------//

function parse_each_FC_item_list_page(page_data) {
	/**
	 * {String}page title = page_data.title
	 */
	var title = CeL.wiki.title_of(page_data),
	/**
	 * {String}page content, maybe undefined. 條目/頁面內容 =
	 * CeL.wiki.revision_content(revision)
	 */
	content = CeL.wiki.content_of(page_data),
	//
	matched,
	/** 特色內容為列表 */
	is_list = /list|列表/.test(title)
	// e.g., 'Wikipedia:FL'
	|| /:[DF]?[FG]L/.test(page_data.original_title || title),
	// 本頁面為已撤消的條目列表。注意: 這包含了被撤銷後再次被評為典範的條目。
	is_FFC = [ page_data.original_title, title ].join('|');

	// 對於進階的條目，採用不同的 is_FFC 表示法。
	is_FFC = using_GA && /:FF?A/.test(is_FFC) && 'UP'
			|| /:[DF][FG][AL]|已撤消的|已撤销的/.test(is_FFC);

	if (is_FFC
	// [[Wikipedia:已撤销的特色列表#撤銷後再次入選特色列表]]
	|| is_list) {
		// 去掉被撤銷後再次被評為典範的條目/被撤銷後再次被評為特色的列表/被撤銷後再次被評選的條目/撤銷後再次入选特色列表
		content = content.replace(/\n== *被?(?:撤銷後|撤销后)[\s\S]+$/, '');
	}

	// 自動偵測要使用的模式。
	function test_pattern(pattern, min) {
		var count = 0, matched;
		while (matched = pattern.exec(content)) {
			if (matched[1] && count++ > (min || 20)) {
				return pattern;
			}
		}
	}

	var catalog,
	// matched: [ all, link title, display, title level, catalog ]
	PATTERN_Featured_content = test_pattern(
	// @see [[Template:FA number]] 被標記為粗體的條目已經在作為典範條目時在首頁展示過
	// 典範條目, 已撤銷的典範條目, 已撤销的特色列表: '''[[title]]'''
	/'''\[\[([^\[\]\|#]+)(?:\|([^\[\]]*))?\]\]'''|\n(===?)([^=].*?)\3\n/g)
			// 特色列表: [[:title]]
			|| test_pattern(/\[\[:([^\[\]\|#]+)(?:\|([^\[\]]*))?\]\]|\n(===?)([^=].*?)\3\n/g)
			// 優良條目轉換到子頁面模式: 警告：本頁中的所有嵌入頁面都會被機器人當作優良條目的分類列表。請勿嵌入非優良條目的分類列表。
			|| test_pattern(/{{(Wikipedia:[^{}\|]+)}}/g, 10)
			// 優良條目子分類列表, 已撤消的優良條目: all links NOT starting with ':'
			|| /\[\[([^:\[\]\|#][^\[\]\|#]*)(?:\|([^\[\]]*))?\]\]|\n(===?)([^=].*?)\3\n/g;
	CeL.log(CeL.wiki.title_link_of(title) + ': ' + (is_FFC ? 'is former'
	//
	+ (is_FFC === true ? '' : ' (' + is_FFC + ')') : 'NOT former') + ', '
			+ (is_list ? 'is list' : 'is article') + ', using pattern '
			+ PATTERN_Featured_content);

	// reset pattern
	PATTERN_Featured_content.lastIndex = 0;
	// 分類/類別。
	if (matched = title.match(/\/(?:分類|分类)\/([^\/]+)/)) {
		catalog = matched[1];
	}

	if (false) {
		CeL.log(content);
		console.log([ page_data.original_title || title, is_FFC, is_list,
				PATTERN_Featured_content ]);
	}
	while (matched = PATTERN_Featured_content.exec(content)) {
		// 還沒繁簡轉換過的標題。
		var original_FC_title = CeL.wiki.normalize_title(matched[1]);

		if (matched.length === 2) {
			sub_FC_list_pages.push(original_FC_title);
			continue;
		}

		// assert: matched.length === 4

		if (matched[4]) {
			// 分類/類別。
			catalog = matched[4].replace(/<!--[\s\S]*?-->/g, '').trim()
					.replace(/\s*（\d+）$/, '');
			continue;
		}

		// 去除並非文章，而是工作連結的情況。 e.g., [[File:文件名]], [[Category:维基百科特色内容|*]]
		if (CeL.wiki.namespace(original_FC_title, 'is_page_title') !== 0) {
			continue;
		}

		// 轉換成經過繁簡轉換過的最終標題。
		var FC_title = redirects_to_hash[original_FC_title]
				|| original_FC_title;

		if (FC_title in FC_data_hash) {
			// 基本檢測與提醒。
			if (FC_data_hash[FC_title][KEY_ISFFC] === is_FFC) {
				CeL.warn('parse_each_FC_item_list_page: Duplicate ' + TYPE_NAME
						+ ' title: ' + FC_title + '; ' + FC_data_hash[FC_title]
						+ '; ' + matched[0]);
				error_logs.push(CeL.wiki.title_link_of(title)
						+ '有重複條目: '
						+ CeL.wiki.title_link_of(original_FC_title)
						+ (original_FC_title === FC_title ? '' : ', '
								+ CeL.wiki.title_link_of(FC_title)));
			} else if (!!FC_data_hash[FC_title][KEY_ISFFC] !== !!is_FFC
			//
			&& (FC_data_hash[FC_title][KEY_ISFFC] !== 'UP' || is_FFC !== false)) {
				error_logs
						.push(CeL.wiki.title_link_of(FC_title)
								+ ' 被同時列在了現存及已撤銷的'
								+ TYPE_NAME
								+ '清單中: '
								+ CeL.wiki.title_link_of(original_FC_title)
								+ '@'
								+ CeL.wiki.title_link_of(title)
								+ ', '
								+ CeL.wiki
										.title_link_of(FC_data_hash[FC_title][KEY_LIST_PAGE][1])
								+ '@'
								+ CeL.wiki
										.title_link_of(FC_data_hash[FC_title][KEY_LIST_PAGE][0]));
				CeL.error(CeL.wiki.title_link_of(FC_title) + ' 被同時列在了現存及已撤銷的'
						+ TYPE_NAME + '清單中: ' + is_FFC + '; '
						+ FC_data_hash[FC_title]);
			}
		}
		var FC_data = FC_data_hash[FC_title] = [];
		FC_data[KEY_IS_LIST] = is_list;
		FC_data[KEY_ISFFC] = is_FFC;
		FC_data[KEY_JDN] = [];
		if (matched[2]
				&& ((matched[2] = matched[2].trim()).includes('-{') || !matched[2]
						.includes(FC_title)))
			FC_data[KEY_DISPLAY_TEXT] = matched[2];
		if (catalog)
			FC_data[KEY_CATEGORY] = catalog;
		FC_data[KEY_LIST_PAGE] = [ title, original_FC_title ];
	}
}

// ---------------------------------------------------------------------//

function check_FC_redirects(page_list) {
	// console.log(page_list);
	var original_FC_title = page_list.query_title;
	if (!original_FC_title) {
		throw '無法定位的重定向資料! 照理來說這不應該發生! ' + JSON.stringify(page_list);
	}
	// 經過繁簡轉換過的最終標題。
	var FC_title = CeL.wiki.title_of(page_list[0]);

	if (original_FC_title !== FC_title) {
		CeL.debug(CeL.wiki.title_link_of(original_FC_title) + ' → '
				+ CeL.wiki.title_link_of(FC_title));
		redirects_to_hash[original_FC_title] = FC_title;
		// 搬移到經過繁簡轉換過的最終標題。
		if (FC_data_hash[original_FC_title]) {
			if (FC_data_hash[FC_title]) {
				CeL.error('check_FC_redirects: 標題已經登記過: '
						+ CeL.wiki.title_link_of(FC_title) + ' ← '
						+ CeL.wiki.title_link_of(original_FC_title));
			} else {
				FC_data_hash[FC_title] = FC_data_hash[original_FC_title];
				delete FC_data_hash[original_FC_title];
			}
		}
	}

	page_list.forEach(function(page_data) {
		// cache 所有標題，以避免下次還要 reget。
		redirects_to_hash[page_data.title] = FC_title;
	});
}

// ---------------------------------------------------------------------//

// get page name of FC_title to transclude
function get_FC_title_to_transclude(FC_title) {
	var FC_data = FC_data_hash[FC_title];
	return FC_data[KEY_TRANSCLUDING_PAGE]
			|| ('Wikipedia:'
					+ (using_GA ? wiki.latest_task_configuration.general.NS_PREFIX_GA
							|| '優良條目'
							: FC_data[KEY_IS_LIST] ? wiki.latest_task_configuration.general.NS_PREFIX_FL
									|| '特色列表'
									: wiki.latest_task_configuration.general.NS_PREFIX_FA
											|| '典範條目') + '/' + FC_title);
}

// get page name of JDN to transclude
function get_FC_date_title_to_transclude(JDN) {
	return 'Wikipedia:'
			+ (using_GA ? wiki.latest_task_configuration.general.NS_PREFIX_GA
					|| '優良條目'
			// 典範JDN: 開始廢棄"特色條目"，採用"典範條目"的日期。
			: JDN < 典範JDN ? '特色條目'
					: wiki.latest_task_configuration.general.NS_PREFIX_FA
							|| '典範條目')
			+ CeL.Julian_day.to_Date(JDN).format('/%Y年%m月%d日');
}

function generate_FC_date_page_list() {
	var title_list = [];

	for (var JDN = JDN_start; JDN <= JDN_search_to; JDN++) {
		title_list.push(get_FC_date_title_to_transclude(JDN));
	}

	return title_list;
}

function parse_each_FC_date_page(page_data) {
	// console.trace(page_data);

	/**
	 * {String}page title = page_data.title
	 */
	var title = CeL.wiki.title_of(page_data),
	/**
	 * {String}page content, maybe undefined. 條目/頁面內容 =
	 * CeL.wiki.revision_content(revision)
	 */
	content = CeL.wiki.content_of(page_data),
	//
	FC_title, JDN = this.JDN++, matched = content
			&& content.replace(/<!--[\s\S]*?-->/g, '').match(
					PATTERN_FC_transcluded);

	// return error
	function check_NOT_FC_title(FC_title) {
		if (!FC_title)
			return true;
		var FC_data = FC_data_hash[FC_title];
		if (FC_data) {
			FC_data[KEY_JDN].push(JDN);
			if (matched) {
				matched = CeL.wiki.normalize_title(matched[1].replace(
						/\/(?:s|摘要)\|/, '\/'));
				// 直接覆蓋 [KEY_TRANSCLUDING_PAGE]: 以新出現者為準。
				FC_data[KEY_TRANSCLUDING_PAGE] = matched;
				if (false) {
					console.log(CeL.Julian_day.to_Date(JDN)
							.format('%Y-%2m-%2d')
							+ ': ' + matched);
				}
			} else if (FC_data[KEY_TITLES_TO_MOVE]) {
				// 日期頁面包含另外一個日期頁面，因此必須修正，以直接指向簡介頁面。
				FC_data[KEY_TITLES_TO_MOVE].push(title);
			} else {
				// 日期頁面包含另外一個日期頁面，因此必須修正，以直接指向簡介頁面。
				FC_data[KEY_TITLES_TO_MOVE] = [ title ];
			}
		} else {
			return true;
		}
	}

	if (matched) {
		FC_title = CeL.wiki.normalize_title(matched[3]);
		if (check_NOT_FC_title(FC_title)
				&& check_NOT_FC_title(redirects_to_hash[FC_title])) {
			// 可能繁簡轉換不同/經過重定向了?
			CeL.debug('不再是' + (using_GA ? '優良' : '特色/典範') + '了? ' + matched[2]
					+ ' ' + CeL.wiki.title_link_of(FC_title));
			redirects_list_to_check.push(FC_title);
			(FC_data_hash[FC_title] = [])[KEY_JDN] = [];
			check_NOT_FC_title(FC_title);
		}
		return;
	}

	// try to parse page and fix the format

	/** 頁面解析後的結構。 */
	var parsed = CeL.wiki.parser(page_data).parse();
	// debug 用.
	// check parser, test if parser working properly.
	if (CeL.wiki.content_of(page_data) !== parsed.toString()) {
		console.log(CeL.LCS(CeL.wiki.content_of(page_data), parsed.toString(),
				'diff'));
		throw 'Parser error: ' + CeL.wiki.title_link_of(page_data);
	}

	// assert: !!FC_title === false;
	parsed.each('link', function(token, index, parent) {
		if (parent.type === 'bold' && parent[1].length === 1) {
			// 找到第一個粗體連結。 e.g., [[Wikipedia:优良条目/2009年1月20日]]
			FC_title = CeL.wiki.normalize_title(token[0].toString());
			return parsed.each.exit;
		}
		if (!FC_title) {
			// 找到第一個連結。
			FC_title = CeL.wiki.normalize_title(token[0].toString());
		}
	});

	if (!check_NOT_FC_title(FC_title)
			|| !check_NOT_FC_title(redirects_to_hash[FC_title])) {
		// 已經做過登記了。
		// 但是沒有設定 FC_data[KEY_TRANSCLUDING_PAGE]

		// 假如之前沒有搜尋過，那麼就搜尋一次。
		if (!redirects_to_hash[FC_title]
				&& !redirects_list_to_check.includes(FC_title)) {
			redirects_list_to_check.push(FC_title);
		}
		return;
	}

	if (FC_title) {
		if (!redirects_to_hash[FC_title]) {
			redirects_list_to_check.push(FC_title);
		}
		(FC_data_hash[FC_title] = [])[KEY_JDN] = [];
		// 無法設定 FC_data[KEY_TRANSCLUDING_PAGE]
		// 補登記資訊。
		check_NOT_FC_title(FC_title);
		return;
	}

	// 連標題連結都找不到的情況。
	error_logs.push(content ? '無法解析 ' + CeL.wiki.title_link_of(title)
	// + (FC_title ? ': ' + FC_title : '')
	: CeL.wiki.title_link_of(title) + ' 不存在。您可在設定頁面刪除快取來更新。');
	if (CeL.is_debug())
		CeL.error(title + ': ' + content);

	// TODO: 不應 cache 今天起的 FC date pages。
	// delete FC date page for recent date
	console.log('parse_each_FC_date_page: remove '
			+ JSON.stringify(base_directory + 'page/'
			// 正規化檔名。
			+ title.replace(/[:*?<>]/g, '_') + '.json'));
	CeL.remove_file(base_directory + 'page/'
	// 正規化檔名。
	+ title.replace(/[:*?<>]/g, '_') + '.json');
}

// ---------------------------------------------------------------------//

function check_redirects(page_list) {
	// console.log(page_list);

	/** {String}原先嵌入的特色內容條目標題，並非日期標題。 */
	var original_FC_title = page_list.query_title;
	if (!original_FC_title) {
		throw '無法定位的重定向資料! 照理來說這不應該發生! ' + JSON.stringify(page_list);
	}
	// 經過繁簡轉換過的最終特色內容標題。
	var FC_title = CeL.wiki.title_of(page_list[0]);

	var not_found;
	if (original_FC_title !== FC_title) {
		CeL.debug(CeL.wiki.title_link_of(original_FC_title) + ' → '
				+ CeL.wiki.title_link_of(FC_title));
		redirects_to_hash[original_FC_title] = FC_title;
		// 搬移到經過繁簡轉換過的最終特色內容標題。
		if (FC_data_hash[original_FC_title]) {
			if (FC_data_hash[FC_title]) {
				if (!FC_data_hash[FC_title][KEY_TRANSCLUDING_PAGE]
				// 標題已經登記過. merge.
				&& FC_data_hash[original_FC_title][KEY_TRANSCLUDING_PAGE]) {
					FC_data_hash[FC_title][KEY_TRANSCLUDING_PAGE] = FC_data_hash[original_FC_title][KEY_TRANSCLUDING_PAGE];
				}
				FC_data_hash[FC_title][KEY_JDN].append(
						FC_data_hash[original_FC_title][KEY_JDN]).sort();
			} else {
				not_found = true;
				FC_data_hash[FC_title] = FC_data_hash[original_FC_title];
			}
			delete FC_data_hash[original_FC_title];
		} else {
			CeL.log('redirects_list_to_check = '
					+ JSON.stringify(redirects_list_to_check));
			CeL.log('redirects_to_hash = ' + JSON.stringify(redirects_to_hash));
			CeL.log('FC_data_hash = ' + JSON.stringify(FC_data_hash));
			console.log(page_list);
			throw '未發現' + CeL.wiki.title_link_of(original_FC_title)
					+ '的資料! 照理來說這不應該發生!';
		}
	} else {
		not_found = true;
	}

	page_list.forEach(function(page_data) {
		// cache 所有標題，以避免下次還要 reget。
		redirects_to_hash[page_data.title] = FC_title;
	});

	var FC_data = FC_data_hash[original_FC_title] || FC_data_hash[FC_title];
	if (!not_found && FC_data[KEY_TRANSCLUDING_PAGE]) {
		return;
	}

	// --------------------------------
	// 處理日期頁面包含/指向了另一個日期頁面的情況

	if (FC_data[KEY_TRANSCLUDING_PAGE]
			&& /^\d{4}年\d{1,2}月\d{1,2}日$/.test(original_FC_title)) {
		CeL.info('check_redirects: ' + FC_data[KEY_JDN].map(function(title) {
			return CeL.wiki.title_link_of(
			//
			get_FC_date_title_to_transclude(title));
		}).join(', ') + ' includes date page: '
				+ CeL.wiki.title_link_of(FC_data[KEY_TRANSCLUDING_PAGE]));

		wiki.page(FC_data[KEY_TRANSCLUDING_PAGE], function(page_data) {
			var content = CeL.wiki.content_of(page_data);
			CeL.debug('content: ' + content);
			if (!content || !PATTERN_FC_transcluded.test(content))
				return;

			CeL.info('check_redirects: copy '
					+ CeL.wiki.title_link_of(FC_data[KEY_TRANSCLUDING_PAGE])
					+ ' → date pages: ' + FC_data[KEY_JDN].map(function(title) {
						return CeL.wiki.title_link_of(
						//
						get_FC_date_title_to_transclude(title));
					}).join(', '));

			FC_data[KEY_JDN].forEach(function(JDN) {
				wiki.page(get_FC_date_title_to_transclude(JDN),
						get_page_options).edit(content, {
					bot : 1,
					nocreate : 1,
					summary : 'bot: 修正頁面: 首頁' + TYPE_NAME
					//
					+ '日期頁面包含/指向了另一個日期頁面 ' + original_FC_title
					//
					+ '，直接改成所包含的內容以便查詢與統計。'
				});
			});
		}, get_page_options);
		return;
	}

	// --------------------------------

	var move_to_title =
	// 已經有嵌入的記錄就不用再白做工。
	!FC_data[KEY_TRANSCLUDING_PAGE]
	// 跳過已經撤銷資格、並非當前優良條目的狀況。
	// 這種頁面太多，要全部移動的話太浪費資源。
	&& FC_data[KEY_ISFFC] === false
	//
	&& FC_data[KEY_TITLES_TO_MOVE] && get_FC_title_to_transclude(FC_title), from_title;
	// console.log([ FC_title, FC_data ]);

	if (move_to_title
	// avoid error: selfmove
	&& move_to_title === (from_title = FC_data[KEY_TITLES_TO_MOVE][0])) {
		move_to_title = null;
	}

	if (!move_to_title) {
		if (!(KEY_ISFFC in FC_data)) {
			// console.log([ FC_title, FC_data ]);
			FC_data[KEY_JDN].forEach(function(JDN) {
				error_logs.push(CeL.wiki
				//
				.title_link_of(get_FC_date_title_to_transclude(JDN)) + '介紹的'
						+ CeL.wiki.title_link_of(original_FC_title)
						+ '似乎未登記在現存或已撤銷的' + TYPE_NAME + '項目頁面中？');
			});
			if (false) {
				CeL.warn('過去曾經在 '
						+ CeL.Julian_day.to_Date(FC_data[KEY_JDN][0]).format(
								'%Y年%m月%d日') + ' 包含過的' + TYPE_NAME
						+ '，並未登記在現存或已撤銷的登記項目頁面中: '
						+ CeL.wiki.title_link_of(original_FC_title) + '。'
						+ '若原先內容轉成重定向頁，使此標題指向了重定向頁，請修改' + TYPE_NAME
						+ '項目頁面上的標題，使之連結至實際標題；' + '並且將 Wikipedia:' + NS_PREFIX
						+ '/ 下的簡介頁面移到最終指向的標題。' + '若這是已撤銷的' + TYPE_NAME
						+ '，請加入相應的已撤銷項目頁面。'
						+ '若為標題標點符號全形半形問題，請將之移動到標點符號完全相符合的標題。');
			}
		}
		return;
	}

	// --------------------------------
	// 處理日期頁面的內容直接就是簡介的情況: 將日期頁面搬移到簡介應該在的子頁面

	var description, write_content = '{{' + move_to_title + '}}';
	// 先檢查目標頁面存不存在。
	wiki.page(move_to_title, function(page_data) {
		// console.log(page_data);
		if (!('missing' in page_data)) {
			description = CeL.wiki.content_of(page_data).trim();
			if (description)
				write_date_pages();
			return;
		}

		// 目標頁面不存在就移動。
		CeL.info('move page: ' + CeL.wiki.title_link_of(from_title) + ' → '
				+ CeL.wiki.title_link_of(move_to_title));

		wiki.move_to(move_to_title, from_title, {
			reason : 'bot: 修正頁面: 首頁' + TYPE_NAME
			//
			+ '日期頁面包含的是簡介文字而非嵌入簡介頁面，將之移至簡介頁面以便再利用。',
			movetalk : true,
			// noredirect : true,
			bot : 1
		}, function(response, error) {
			if (error) {
				CeL.error('Failed to move '
				//
				+ CeL.wiki.title_link_of(from_title)
				//
				+ ' → ' + CeL.wiki.title_link_of(move_to_title)
				//
				+ ': ' + JSON.stringify(error));
				return;
			}

			// 成功移動完畢。
			FC_data[KEY_TITLES_TO_MOVE].shift();
			if (!FC_data[KEY_TRANSCLUDING_PAGE]) {
				// 補登記資訊。
				FC_data[KEY_TRANSCLUDING_PAGE] = move_to_title;
			}

			CeL.info('write to ' + CeL.wiki.title_link_of(from_title)
			//
			+ ': ' + write_content);
			wiki.page(from_title).edit(write_content, {
				bot : 1,
				summary : 'bot: 修正頁面: 首頁' + TYPE_NAME + '移動完頁面後，寫回原先嵌入的簡介頁面。'
			});

			wiki.page(move_to_title, function(page_data) {
				description = CeL.wiki.content_of(page_data).trim();
				if (description)
					write_date_pages();
			});
		});

	}, get_page_options);

	function write_date_pages() {
		FC_data[KEY_TITLES_TO_MOVE].forEach(function(title) {
			wiki.page(title, function(page_data) {
				var content = CeL.wiki.content_of(page_data).trim();
				if (content !== description) {
					return;
				}
				wiki.page(title).edit(write_content, {
					bot : 1,
					summary : 'bot: 修正頁面: 日期頁面所包含的內容與簡介頁面的相同，'
					//
					+ '直接嵌入簡介頁面以便查詢與統計。'
				});
			});
		});
	}

}

// ---------------------------------------------------------------------//

function template_links(template_list) {
	if (!Array.isArray(template_list)) {
		template_list = [ template_list ];
	}
	return template_list.map(function(name) {
		return '{{Tl|' + name.replace(/^Template:/i, '') + '}}';
	}).join(', ') + (template_list.length > 1 ? '其中之一' : '');
}

function check_FC_template(page_data_list, operation) {
	// console.log(page_data_list);

	var is_list = /list/.test(operation.list), FC_title_hash = this.FC_title_hash;
	if (!FC_title_hash) {
		FC_title_hash = this.FC_title_hash = Object.create(null);

		Object.keys(FC_data_hash).forEach(function(FC_title) {
			if (is_FC(FC_title)) {
				FC_title_hash[FC_title] = true;
			}
		});
	}

	page_data_list.forEach(function(page_data) {
		// { pageid: 111, ns: 0, title: '列表' }
		if (page_data.ns !== 0)
			return;

		var FC_title = CeL.wiki.title_of(page_data);
		if (!is_FC(FC_title)) {
			error_logs.push(CeL.wiki.title_link_of(FC_title) + '一文嵌入了'
					+ template_links(operation.list) + '，卻沒登記在' + TYPE_NAME
					+ '項目中？');
			return;
		}

		var FC_data = FC_data_hash[FC_title];
		if (FC_data[KEY_IS_LIST] !== is_list) {
			error_logs.push(CeL.wiki.title_link_of(FC_title) + ' 嵌入了'
					+ template_links(operation.list) + '，在' + TYPE_NAME
					+ '項目中卻登記為' + (FC_data[KEY_IS_LIST] ? '' : '非') + TYPE_NAME
					+ '列表？');
			return;
		}

		// 登記
		delete FC_title_hash[FC_title];
	});
}

function summary_FC_template(list, operation) {
	var FC_title_list = Object.keys(this.FC_title_hash),
	//
	list = operation.list;

	FC_title_list.forEach(function(FC_title) {
		var _list = list;
		if (FC_title.includes('列表')) {
			_list = list.filter(function(name) {
				return /list/i.test(name);
			});
		}
		error_logs.push(CeL.wiki.title_link_of(FC_title) + ' 登記在' + TYPE_NAME
				+ '項目中，卻沒嵌入' + template_links(_list) + '？');
	});
}

// ---------------------------------------------------------------------//

function generate_help_message(date_page_title, message) {
	var JDN_diff = JDN_to_generate - JDN_today | 0;
	return (JDN_diff === 1 ? '[[Wikipedia:首頁/明天|明天的首頁]]'
	//
	: JDN_diff === 2 ? '後天首頁的'
	//
	: JDN_diff === 3 ? '大後天首頁的' : JDN_diff + '天後首頁的')
	//
	+ TYPE_NAME + '頁面（' + CeL.wiki.title_link_of(date_page_title) + '）'
	//
	+ message + '，謝謝。若您想使用最古老的頁面，可參考'
	//
	+ CeL.wiki.title_link_of('Wikipedia:首頁/' + TYPE_NAME + '展示報告')
	//
	+ '。 --~~~~';
}

// 不是日期頁面嵌入的、有問題的標題。
function is_FC(FC_title) {
	var FC_data = FC_data_hash[FC_title];
	return FC_data && FC_data[KEY_ISFFC] === false;
}

function check_date_page() {
	// write cache
	CeL.write_file(redirects_to_file, redirects_to_hash);

	// 上過首頁次數
	hit_count = 0;
	// 條目數量
	// entry_count = 0;
	avoid_catalogs = [];
	FC_title_sorted = Object.keys(FC_data_hash).filter(function(FC_title) {
		if (is_FC(FC_title)) {
			var FC_data = FC_data_hash[FC_title],
			//
			JDN = FC_data[KEY_LATEST_JDN] = FC_data[KEY_JDN].length > 0
			//
			? FC_data[KEY_JDN].at(-1)
			// : Infinity: 沒上過首頁的頁面因為不存在簡介/摘要頁面，所以必須要排在最後，不能夠列入顯示。
			: 0;
			if (FC_data[KEY_JDN].length > 0)
				hit_count += FC_data[KEY_JDN].length;
			if (JDN_to_generate - JDN
			// 記錄之前幾天曾經使用過的類別。
			<= wiki.latest_task_configuration.general
			//
			.avoid_same_catalog_past_days) {
				avoid_catalogs.push(FC_data[KEY_CATEGORY]);
			}
			return true;
		}
	}).sort();

	function write_FC_list(FC_list, prefix) {
		wiki.page('Wikipedia:' + (prefix || NS_PREFIX) + '/列表')
		// 自動更新 Wikipedia:典範條目/列表、Wikipedia:特色列表/列表、Wikipedia:優良條目/列表
		.edit(FC_list.map(function(FC_title) {
			return CeL.wiki.title_link_of(FC_title);
		}).join('－'), {
			bot : 1,
			nocreate : 1,
			summary : CeL.wiki.title_link_of(
			//
			wiki.latest_task_configuration.configuration_page_title,
			//
			'更新' + (prefix || NS_PREFIX) + '列表')
		});
	}

	if (using_GA) {
		write_FC_list(FC_title_sorted);
	} else {
		write_FC_list(FC_title_sorted.filter(function(FC_title) {
			return !FC_data_hash[FC_title][KEY_IS_LIST];
		}), '典範條目');
		write_FC_list(FC_title_sorted.filter(function(FC_title) {
			return FC_data_hash[FC_title][KEY_IS_LIST];
		}), '特色列表');
	}

	FC_title_sorted = FC_title_sorted.sort(function(FC_title_1, FC_title_2) {
		return FC_data_hash[FC_title_1][KEY_LATEST_JDN]
		// TODO: 檢查簡介/摘要頁面是否存在。
		- FC_data_hash[FC_title_2][KEY_LATEST_JDN];
	});
	avoid_catalogs = avoid_catalogs.unique();
	CeL.log('避免採用類別: ' + avoid_catalogs);

	var index = 0, need_list_field = !using_GA, never_shown_pages = [],
	// @see
	// https://en.wikipedia.org/wiki/Wikipedia:Good_article_nominations/Report
	report = '本報告將由機器人每日自動更新，毋須手動修正。' + '您可'
	//
	+ CeL.wiki.title_link_of(
	//
	wiki.latest_task_configuration.configuration_page_title
	//
	+ '#一般設定', '更改設定參數')
	// <del>不簽名，避免一日之中頻繁變更。 " --~~~~"</del>
	// [[WP:DBR]]: 使用<onlyinclude>包裹更新時間戳。
	+ '。' + '\n* 產生時間：<onlyinclude>~~~~~</onlyinclude>' + '\n'
	//
	+ '{| class="wikitable sortable"\n|-\n' + '! # !! 標題 ' + (need_list_field
	//
	? '!! <small title="為' + TYPE_NAME + '列表">列表</small> ' : '')
	// 範疇
	+ '!! 類別 !! 上次展示時間 !! <small title="上過首頁次數">次數</small> !! 簡介頁面\n'
	//
	+ FC_title_sorted.map(function(FC_title) {
		var FC_data = FC_data_hash[FC_title],
		//
		JDN = FC_data[KEY_LATEST_JDN],
		//
		fields = [ ++index,
		// FC_data[KEY_DISPLAY_TEXT]: 處理字詞轉換
		CeL.wiki.title_link_of(FC_title, FC_data[KEY_DISPLAY_TEXT]) ];

		if (!JDN)
			never_shown_pages.push(FC_title);

		if (need_list_field) {
			fields.push(
			// 類型: 條目/列表
			'data-sort-value="' + (FC_data[KEY_IS_LIST] ? 1e8 + JDN : JDN)
			//
			+ '" | ' + (FC_data[KEY_IS_LIST] ? '✓' : ' '));
		}

		var transcluding_page = FC_data[KEY_TRANSCLUDING_PAGE]
		//
		|| get_FC_title_to_transclude(FC_title), transcluding_display;
		if (FC_data[KEY_DISPLAY_TEXT]) {
			transcluding_display = transcluding_page
			//
			.replace(FC_title, FC_data[KEY_DISPLAY_TEXT]);
		}

		fields.push(FC_data[KEY_CATEGORY] || '',
		//
		'data-sort-value="' + JDN + '" | '
		//
		+ (JDN ? '[[' + get_FC_date_title_to_transclude(JDN) + '|'
		//
		+ CeL.Julian_day.to_Date(JDN).format('%Y年%m月%d日') + ']]'
		//
		+ (JDN_today > JDN ? ' (' + (JDN_today - JDN) + ' days)' : '')
		// 沒有展示過
		: '沒上過首頁'), FC_data[KEY_JDN].length,
		//
		CeL.wiki.title_link_of(transcluding_page, transcluding_display));

		return '|-\n| ' + fields.join(' || ');
	}).join('\n') + '\n|}';

	if (error_logs.length > 0) {
		report += '\n== 問題頁面 ==\n本次檢查發現無法解析或有問題的頁面：（"Wikipedia:' + NS_PREFIX
		//
		+ '/"之後的頁面名稱應準確符合所介紹的頁面名稱）\n# '
		// 過去問題頁面
		+ error_logs.join('\n# ') + '\n[[Category:维基百科积压工作]]';
	}
	wiki.page('Wikipedia:首頁/' + TYPE_NAME + '展示報告')
	//
	.edit(report, {
		bot : 1,
		nocreate : 1,
		summary : CeL.wiki.title_link_of(
		//
		wiki.latest_task_configuration.configuration_page_title,
		//
		'首頁' + TYPE_NAME + '更新報告') + ': '
		//
		+ FC_title_sorted.length + '篇' + TYPE_NAME
		//
		+ (never_shown_pages.length > 0
		//
		? '，' + never_shown_pages.length + '篇沒上過首頁' : '')
		//
		+ (error_logs.length > 0 ? '，' + error_logs.length + '筆錯誤' : '')
		//
		+ (0 < new_FC_pages.length ? new_FC_pages.length < 4
		//
		? '，新出現條目：' + CeL.wiki.title_link_of(new_FC_pages)
		//
		: new_FC_pages.length < FC_title_sorted.length
		//
		? '，新出現' + new_FC_pages.length + '個條目' : '' : '')
	});

	// [[Wikipedia:首页/明天]]是連鎖保護
	/** {String}隔天首頁將展示的特色內容/優良條目分頁title */
	var date_page_title = get_FC_date_title_to_transclude(JDN_to_generate);
	wiki.page(date_page_title, function(page_data) {
		var
		/**
		 * {String}page content, maybe undefined. 條目/頁面內容 =
		 * CeL.wiki.revision_content(revision)
		 */
		content = CeL.wiki.content_of(page_data);

		if (!content || !(content = content.trim())) {
			write_date_page(date_page_title);
			return;
		}

		// 最後檢查隔天首頁將展示的特色內容分頁，如Wikipedia:典範條目/2019年1月1日，如有破壞，通知社群：Wikipedia:互助客棧/其他。
		var matched = content.replace(/<!--[\s\S]*?-->/g, '').match(
				PATTERN_FC_transcluded);

		if (!matched) {
			wiki.page(DISCUSSION_PAGE).edit(function(page_data) {
				var
				/**
				 * {String}page content, maybe undefined. 條目/頁面內容 =
				 * CeL.wiki.revision_content(revision)
				 */
				content = CeL.wiki.content_of(page_data);

				if (content
				// 避免多次提醒。
				&& content.includes(CeL.wiki.title_link_of(date_page_title))) {
					CeL.log('已經做過提醒。');
					return;
				}

				return generate_help_message(date_page_title,
				//		
				'似乎並非標準的嵌入包含頁面格式，這會造成計數錯誤，請幫忙處理');

			}, DISCUSSION_edit_options).run(check_month_list);
			return;
		}

		var FC_title = CeL.wiki.normalize_title(matched[3]);
		FC_title = redirects_to_hash[FC_title] || FC_title;
		if (!is_FC(FC_title)) {
			wiki.page(DISCUSSION_PAGE).edit(function(page_data) {
				var
				/**
				 * {String}page content, maybe undefined. 條目/頁面內容 =
				 * CeL.wiki.revision_content(revision)
				 */
				content = CeL.wiki.content_of(page_data);

				if (content
				// 避免多次提醒。
				&& content.includes(CeL.wiki.title_link_of(date_page_title))) {
					CeL.log('已經做過提醒。');
					return;
				}

				return generate_help_message(date_page_title,
				//
				/^\d{4}年\d{1,2}月\d{1,2}日$/.test(FC_title)
				//
				? '似乎嵌入包含了另一個日期的簡介。請幫忙改成直接嵌入頁面'
				//
				: '所嵌入包含的標題' + CeL.wiki.title_link_of(FC_title)
				//
				+ '似乎並非' + TYPE_NAME + '標題？'
				//
				+ '若包含的頁面確實並非' + TYPE_NAME + '，請幫忙處理');

			}, DISCUSSION_edit_options).run(check_month_list);
			return;
		}

		check_if_FC_introduction_exists(FC_title, date_page_title, matched[1]);

	}, get_page_options);

}

// ---------------------------------------------------------------------//

// fix for [[MediaWiki:Titleblacklist]]
function fix_for_titleblacklist(page_title) {
	return page_title;

	return page_title.replace(/Wikipedia:典範條目\//, 'Wikipedia:典范条目/').replace(
			/Wikipedia:優良條目\//, 'Wikipedia:优良条目/');
}

// 然後自還具有特色內容資格的條目中，挑選出沒上過首頁、抑或最後展示時間距今最早的頁面（此方法不見得會按照日期順序來展示），
function write_date_page(date_page_title, transcluding_title_now) {
	var FC_title, candidates = [],
	// 跳過上過首頁太多次、展示次數過多的條目。盡量使各條目展示的次數相近。
	hit_upper_Bound = hit_count / FC_title_sorted.length + 1 | 0;
	for (var index = 0; index < FC_title_sorted.length; index++) {
		FC_title = FC_title_sorted[index];
		if (!is_FC(FC_title))
			continue;
		var FC_data = FC_data_hash[FC_title];
		if (is_production_environment
		// 每天凌晨零時之前，若是頁面還不存在，就會找一個之前曾經上過首頁的最古老 FC_title 頁面來展示。
		// assert: 上過首頁的都必定有介紹頁面。
		&& !FC_data[KEY_LATEST_JDN]) {
			FC_title = null;
			continue;
		}
		// 從未展示的條目，應該按照當選日期排列，按照先進先出的原則。社群和讀者也曾抱怨連續數日同一個範疇上首頁的事情。
		// 增加了避免採用與前幾日相同類別的功能。
		if (avoid_catalogs.includes(FC_data[KEY_CATEGORY])
				|| FC_data[KEY_JDN].length > hit_upper_Bound) {
			candidates.push(FC_title);
			FC_title = null;
			continue;
		}
		break;
	}
	if (!is_FC(FC_title) && !is_FC(FC_title = candidates.shift())) {
		// TODO: 檢查簡介/摘要頁面是否存在。
		throw new Error('沒有可供選擇的' + TYPE_NAME + '頁面! 照理來說這不應該發生!');
	}

	var transcluding_title = get_FC_title_to_transclude(FC_title),
	//
	write_content = '{{' + transcluding_title + '}}';
	// console.log(write_content);

	if (transcluding_title_now) {
		// assert: (transcluding_title_now) 為
		// 現在 (date_page_title) 頁面中嵌入但*有問題*的頁面。
		if (is_production_environment) {
			if (transcluding_title === transcluding_title_now) {
				wiki.page(date_page_title);
				wiki.edit('', {
					allow_blanking : true,
					nocreate : 1,
					summary : 'production environment 下，'
							+ '如果沒有人處理的話應該有補救措施（即便最後留空）。'
				}, function(page_data, error, result) {
					if (error) {
						// error: 如 [cascadeprotected]
						// 寫入失敗同樣提醒社群，預防新當選條目沒有準備展示內容的情況。
						check_if_FC_introduction_exists(FC_title,
								date_page_title, transcluding_title, true);
					} else
						check_month_list();
				});
				return;
			}
			// else: write (write_content)
		} else {
			// assert: 已經提醒過 (DISCUSSION_PAGE)。
			check_month_list();
			return;
		}
	}

	date_page_title = fix_for_titleblacklist(date_page_title);
	wiki.page(date_page_title);
	// 如若不存在，採用嵌入包含的方法寫入隔天首頁將展示的特色內容分頁裡面，展示為下一個首頁特色內容。
	wiki.edit(write_content, {
		// bot : 1,
		summary : CeL.wiki.title_link_of(
		//
		wiki.latest_task_configuration.configuration_page_title, '自動更新首頁'
		//
		+ TYPE_NAME) + '：' + CeL.wiki.title_link_of(FC_title)
		//
		+ (is_FC(FC_title) && FC_data_hash[FC_title][KEY_LATEST_JDN]
		//
		? '上次於' + CeL.wiki.title_link_of(get_FC_date_title_to_transclude(
		//
		FC_data_hash[FC_title][KEY_LATEST_JDN])) + '展示' : '沒上過首頁')
		//
		+ '。作業機制請參考'
		//
		+ CeL.wiki.title_link_of(
		//
		wiki.latest_task_configuration.configuration_page_title)
	// 已轉換過
	// + ' 編輯摘要的red link經繁簡轉換後存在'
	}, function(page_data, error, result) {
		// error: 如 [cascadeprotected]
		if (!error
		// 繁簡轉換有問題？
		&& is_FC(FC_title)
		// 這個頁面沒有展示過？
		&& FC_data_hash[FC_title][KEY_LATEST_JDN]) {
			check_month_list();
			return;
		}

		if (transcluding_title_now) {
			// 預防新當選條目沒有準備展示內容的情況。
			check_if_FC_introduction_exists(FC_title, date_page_title,
					transcluding_title, true);
			return;
		}

		if (!error && !result.error) {
			// 寫入動作本身沒有問題。但是這個頁面沒有展示過，或者繁簡轉換有問題？
			check_month_list();
			return;
		}

		wiki.page(DISCUSSION_PAGE).edit(function(page_data) {
			var
			/**
			 * {String}page content, maybe undefined. 條目/頁面內容 =
			 * CeL.wiki.revision_content(revision)
			 */
			content = CeL.wiki.content_of(page_data);

			// 避免多次提醒。
			if (content.includes(CeL.wiki.title_link_of(date_page_title))) {
				CeL.log('已經做過提醒。');
				return;
			}

			if (result.error && result.error.code === 'cascadeprotected') {
				// '{{Edit fully-protected}}\n' +
				return generate_help_message(date_page_title, '已被保護，無法寫入'
				//
				+ CeL.wiki.title_link_of(FC_title) + '。請幫忙處理');
			}

			return generate_help_message(date_page_title,
			//
			'寫入' + CeL.wiki.title_link_of(FC_title) + '時發生錯誤: '
			//
			+ (error || result.error && result.error.code || result.error)
			//
			+ '，請幫忙處理');

		}, DISCUSSION_edit_options).run(check_month_list);

	});
}

// ---------------------------------------------------------------------//

// 確認簡介頁面存在。新入選的文章會自動被列入排程。但是簡介頁面確實得由人工先編纂出來。
function check_if_FC_introduction_exists(FC_title, date_page_title,
		transcluding_title, write_failed) {
	var converted_title;
	if (!transcluding_title)
		transcluding_title = get_FC_title_to_transclude(FC_title);
	else if (Array.isArray(transcluding_title)) {
		converted_title = transcluding_title[1];
		transcluding_title = transcluding_title[0];
	}

	wiki.page(converted_title || transcluding_title, function(page_data) {
		/**
		 * {String}page title = page_data.title
		 */
		var title = CeL.wiki.title_of(page_data),
		/**
		 * {String}page content, maybe undefined. 條目/頁面內容 =
		 * CeL.wiki.revision_content(revision)
		 */
		content = CeL.wiki.content_of(page_data);

		if (content && content.trim()
		// TODO: 進一步檢查簡介頁面
		) {
			check_month_list();
			return;
		}

		if (!converted_title
		// 因應繁簡體無法自動轉換問題。 e.g., [[Wikipedia:优良条目/病毒概論]]
		&& (converted_title = fix_for_titleblacklist(title)) !== title) {
			check_if_FC_introduction_exists(FC_title, date_page_title, [
					transcluding_title, converted_title ], write_failed);
			return;
		}

		if (!write_failed && is_production_environment) {
			// remove cache 刪除cache。
			CeL.move_fso(base_directory, base_directory + '.'
					+ (new Date).format('%Y%2m%2d'));
			write_date_page(date_page_title, transcluding_title);
			return;
		}

		var introduction_section;
		wiki.page(FC_title, function(page_data, error) {
			introduction_section = CeL.wiki.extract_introduction(page_data);
		}).page(fix_for_titleblacklist(converted_title || transcluding_title))
		// 自動創建簡介頁面。
		.edit(function(page_data) {
			var title = introduction_section.title_token[0].toString();
			if (title.includes('[[')) {
				CeL.error('Cannot adding link to introduction_section: '
				//
				+ title);
			} else if (title.includes(FC_title)) {
				introduction_section.title_token[0]
				//
				= title.replace(FC_title, CeL.wiki.title_link_of(FC_title));
			} else {
				introduction_section.title_token[0]
				//
				= CeL.wiki.title_link_of(FC_title, title);
			}
			var representative_image
			//
			= introduction_section.representative_image;
			if (representative_image) {
				introduction_section.unshift('[['
				//
				+ representative_image[0]
				//
				+ '|left|border|'
				// 一些想法是FA和GA要有所區分，所以FA文字要比GA多，圖片也要比GA大，而且保持一個相對固定的文字數量和圖片大小也會比較美觀。
				+ (using_GA ? '140x140' : '190x190') + 'px'
				//
				+ (representative_image.alt
				//
				? '|alt=' + representative_image.alt : '')
				//
				+ (representative_image.caption
				//
				? '|' + representative_image.caption : '') + ']]\n');
			}

			var toString = introduction_section.toString;
			introduction_section = introduction_section.filter(function(token) {
				// 去掉單個換行。
				return token && token !== '\n';
			});
			// using original .toString()
			introduction_section = toString.call(introduction_section);

			if (introduction_section.length < 3000) {
				introduction_section
				//
				= introduction_section.replace(/\n\n/g, '');
			}
			return introduction_section;
		}, {
			summary : CeL.wiki.title_link_of(
			//
			wiki.latest_task_configuration.configuration_page_title,
			//
			'自動創建' + TYPE_NAME + '簡介頁面')
		});

		wiki.page(DISCUSSION_PAGE).edit(function(page_data) {
			var
			/**
			 * {String}page content, maybe undefined. 條目/頁面內容 =
			 * CeL.wiki.revision_content(revision)
			 */
			content = CeL.wiki.content_of(page_data),
			// 撰寫簡介
			write_link = CeL.wiki.title_link_of(transcluding_title, '檢核與編篡簡介');

			// 之前檢查過了。避免多次提醒。
			if (content.includes(write_link)) {
				CeL.log('已經做過提醒。');
				return;
			}

			return generate_help_message(date_page_title,
			//
			'所嵌入包含的' + TYPE_NAME + '──' + CeL.wiki.title_link_of(FC_title)
			//
			+ '似乎還不存在簡介？或許原頁面被移動了？'
			//
			+ (using_GA ? '' : '或者簡介頁面存放在"Wikipedia:優良條目/"下？')
			// 若簡介頁面確實不存在
			+ '機器人已嘗試自動創建簡介頁面，請幫忙' + write_link);

		}, DISCUSSION_edit_options).run(check_month_list);
		return;
	}, get_page_options);
}

// =====================================================================//

// → check_month_list() → update_portal() → finish_up()

// 若不存在則自動創建每月特色內容存檔頁面：如[[Wikipedia:典範條目/{{CURRENTYEAR}}年{{CURRENTMONTHNAME}}]]。
function check_month_list() {
	var date = CeL.Julian_day.to_Date(JDN_to_generate),
	//
	page_title = fix_for_titleblacklist(date.format('Wikipedia:' + NS_PREFIX
			+ '/%Y年%m月'));
	wiki.page(page_title, function(page_data) {
		var
		/**
		 * {String}page content, maybe undefined. 條目/頁面內容 =
		 * CeL.wiki.revision_content(revision)
		 */
		content = CeL.wiki.content_of(page_data);

		if (content && content.trim()) {
			update_portal();
			return;
		}

		content = [
				'__NOTOC__<!---->__NOEDITSECTION__<!---->' + '{{Wikipedia:'
						+ NS_PREFIX + '/存檔表頭}}',
				'{|width="100%" border="1" cellspacing="8" cellpadding="4"'
						+ ' style="background:transparent;border:0;"' ];
		var day = 1;
		while (true) {
			date.setDate(day);
			if (date.getDate() !== day++)
				break;
			if (date.getDate() % 2 === 1)
				content.push('|-');
			content.push(date.format('{{Wikipedia:' + NS_PREFIX
					+ '/日期|%Y年%m月%d日}}'));
		}
		content.push('|}');
		wiki.page(page_data).edit(content.join('\n'), {
			summary : CeL.wiki.title_link_of(
			//
			wiki.latest_task_configuration.configuration_page_title,
			//
			'自動創建每月' + TYPE_NAME + '存檔')
		}).run(update_portal);
	}, get_page_options);
}

// ---------------------------------------------------------------------//

function update_portal() {
	// 清除首頁快取。刷新首頁緩存。
	wiki.purge('Wikipedia:首页');

	var portal_item_count = wiki.latest_task_configuration.general.portal_item_count;
	if (!(portal_item_count >= 1) || using_GA || CeL.env.arg_hash
			&& (CeL.env.arg_hash.days_later | 0)) {
		wiki.run(finish_up);
		return;
	}

	var edit_options = {
		bot : 1,
		nocreate : 1,
		summary : CeL.wiki.title_link_of(
		//
		wiki.latest_task_configuration.configuration_page_title,
		//
		'更新[[Portal:特色內容]]。作業機制請參考')
		//
		+ CeL.wiki.title_link_of(
		//
		wiki.latest_task_configuration.configuration_page_title)
	};

	// ----------------------------------------------------

	var title_lists = {
		FA : [],
		FA1 : [],
		FL : [],
		FL1 : []
	};
	// 現在採用的方法是挑出從來沒上過首頁，或者最近才首次上首頁的條目。
	FC_title_sorted.some(function(FC_title) {
		var FC_data = FC_data_hash[FC_title], is_list = FC_data[KEY_IS_LIST];
		var count = FC_data_hash[FC_title][KEY_JDN].length;
		if (count === 0) {
			var list = title_lists[is_list ? 'FL' : 'FA'];
			list.push(FC_title);
			if (list.length > portal_item_count)
				return true;
		} else if (count === 1) {
			var list = title_lists[is_list ? 'FL1' : 'FA1'];
			list.unshift(FC_title);
			list.truncate(portal_item_count);
		}
	});
	// title_lists.FA + title_lists.FL === never_shown_pages

	if (title_lists.FA.length < portal_item_count)
		title_lists.FA = title_lists.FA.concat(title_lists.FA1);
	title_lists.FA = title_lists.FA.slice(0, portal_item_count);
	if (title_lists.FL.length < portal_item_count)
		title_lists.FL = title_lists.FL.concat(title_lists.FL1);
	title_lists.FL = title_lists.FL.slice(0, portal_item_count);

	// console.log(title_lists);

	wiki.page('Template:New featured pages', get_page_options)
	//
	.edit(function(page_data) {
		var
		/**
		 * {String}page content, maybe undefined. 條目/頁面內容 =
		 * CeL.wiki.revision_content(revision)
		 */
		content = CeL.wiki.content_of(page_data);

		if (!content)
			return;

		content = content.replace(/(\|[\s\n]*<!--(.+?)-->)[\s\S]*?(\n\|)/g,
		//
		function(all, type_tag, type, tail) {
			var list;
			type = type.trim();
			// 機器人會定期更新典範條目、特色列表頁面。本註解必須以本欄項目開頭，方便機器人辨識。若您有想要固定顯示的項目，可以列在本註解前面。本註解前的內容不會列入計數。
			// 用了個技巧處理這個問題，您參考看看。這樣的編輯彈性比較大。但仍必須手動撤下特別要顯示的條目。
			if (type.startsWith('典範條目')) {
				list = title_lists.FA;
			} else if (type.startsWith('特色列表')) {
				list = title_lists.FL;
			}

			if (!list) {
				return all;
			}

			list = list.map(function(title) {
				return CeL.wiki.title_link_of(title);
			});
			list.unshift(type_tag);
			return list.join('\n* ') + tail;
		});

		return content;
	}, edit_options);

	// ----------------------------------------------------

	// 每個禮拜更新一次。
	if (false && (new Date).getDay() !== 5) {
		wiki.run(finish_up);
		return;
	}

	// ----------------------------------------------------

	var index = FC_title_sorted.length, FC_articles = [], FC_lists = [];
	while (index-- > 0) {
		var FC_title = FC_title_sorted[index], FC_data = FC_data_hash[FC_title], is_list = FC_data[KEY_IS_LIST];
		if (is_list) {
			if (FC_lists.length < portal_item_count)
				FC_lists.push(FC_title);
		} else {
			if (FC_articles.length < portal_item_count)
				FC_articles.push(FC_title);
		}
	}

	// console.log(FC_articles);
	// console.log(FC_lists);

	function edit_portal(page_data) {
		var
		/**
		 * {String}page content, maybe undefined. 條目/頁面內容 =
		 * CeL.wiki.revision_content(revision)
		 */
		content = CeL.wiki.content_of(page_data);
		/** 頁面解析後的結構。 */
		var parsed = CeL.wiki.parser(page_data).parse();

		parsed.each('template', function(token) {
			if (token.name !== '#invoke:random')
				return;
			var last_option = 2;
			while (token[last_option].includes('=')) {
				last_option++;
			}
			token.splice(last_option, token.length - last_option);
			token.append(page_data.title.includes('列表') ? FC_lists
					: FC_articles);
		});

		return parsed.toString();
	}

	wiki.page('Portal:特色內容/條目', get_page_options).edit(edit_portal,
			edit_options);
	wiki.page('Portal:特色內容/列表', get_page_options).edit(edit_portal,
			edit_options);

	// ----------------------------------------------------

	wiki.run(finish_up);
}

// ---------------------------------------------------------------------//

function finish_up() {
	// log
	CeL.write_file(base_directory + 'FC_data_hash.' + (using_GA ? 'G' : 'F')
			+ '.json', FC_data_hash);
	if (error_logs.length > 0) {
		CeL.warn('本次檢查發現有比較特殊格式的頁面(包括非嵌入頁面)：\n# ' + error_logs.join('\n# '));
	}
	CeL.debug('Done.')
}
