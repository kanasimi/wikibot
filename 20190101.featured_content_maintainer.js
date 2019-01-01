// cd /d D:\USB\cgi-bin\program\wiki && node 20190101.featured_content_maintainer.js

/*

 2019/1/1 10:25:51	初版試營運

 // 輪流展示列表

 @see [[]]

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

var

/** {Object}wiki operator 操作子. */
wiki = Wiki(true);

// ---------------------------------------------------------------------//
// main

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
prepare_directory(base_directory);

// CeL.set_debug(6);

// ---------------------------------------------------------------------//

var JDN_today = CeL.Julian_day(new Date), JDN_tomorrow = JDN_today + 1,
//
JDN_start = CeL.Julian_day.from_YMD(2013, 8, 20, true),
// 開始廢棄"特色條目"，採用"典範條目"的日期。
典範JDN = CeL.Julian_day.from_YMD(2017, 10, 1, true),

// Featured_content_hash[FC_title] = is_list
Featured_content_hash = CeL.null_Object(),
// JDN_hash[FC_title] = JDN
JDN_hash = CeL.null_Object(),
// page name to transclude
// = 'Wikipedia:' + FC_page_prefix[FC_title] + '/' + FC_title
FC_page_prefix = CeL.null_Object(),
/**
 * {RegExp}每日特色內容頁面所允許的[[w:zh:Wikipedia:嵌入包含]]正規格式。<br />
 * matched: [ all, FC_page_prefix, FC_title ]
 */
PATTERN_FC_transcluded = /^\s*\{\{\s*(?:Wikipedia|wikipedia|維基百科|维基百科):((?:特色|典範|典范|优良)(?:條目|条目|列表))\/(?:s\|)?([^\/{}]+)\}\}\s*$/;

function parse_each_FC_list(page_data) {
	/**
	 * {String}page title = page_data.title
	 */
	var title = CeL.wiki.title_of(page_data),
	/**
	 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
	 */
	content = CeL.wiki.content_of(page_data),
	//
	matched, is_list = title.includes('列表')
			|| page_data.original_title.includes('FL'),
	//
	PATTERN_Featured_content = is_list ? /\[\[:([^\[\]]+)\]\]/g
	// @see [[Template:FA number]]
	: /'''\[\[([^\[\]]+)\]\]'''/g;

	// console.log(content);
	while (matched = PATTERN_Featured_content.exec(content)) {
		var FC_title = CeL.wiki.normalize_title(matched[1]);
		if (FC_title in Featured_content_hash) {
			CeL.error('Duplicate FC title: ' + FC_title);
		}
		Featured_content_hash[FC_title] = is_list;
	}
}

// ---------------------------------------------------------------------//

function generate_FC_page_list() {
	var title_list = [];

	for (var JDN = JDN_start; JDN <= JDN_today; JDN++) {
		title_list.push(CeL.Julian_day.to_Date(JDN).format(
				'Wikipedia:' + (JDN < 典範JDN ? '特色條目' : '典範條目') + '/%Y年%m月%d日'));
	}

	return title_list;
}

function parse_each_FC_page(page_data) {
	/**
	 * {String}page title = page_data.title
	 */
	var title = CeL.wiki.title_of(page_data),
	/**
	 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
	 */
	content = CeL.wiki.content_of(page_data),
	//
	matched = content
			&& content.replace(/<!--[\s\S]*?-->/g, '').match(
					PATTERN_FC_transcluded);

	if (matched) {
		var FC_title = CeL.wiki.normalize_title(matched[2]);
		if (!(FC_title in Featured_content_hash)) {
			// 可能經過重定向了
			CeL.log('不再是特色/典範了? ' + matched[1] + ':'
					+ CeL.wiki.title_link_of(FC_title));
		} else {
			JDN_hash[FC_title] = this.JDN++;
			FC_page_prefix[FC_title] = matched[1];
		}
	} else {
		CeL.error(title + ': ' + content);
	}
}

// ---------------------------------------------------------------------//

CeL.wiki.cache([ {
	type : 'page',
	// assert: 這些頁面包含的必定是所有檢核過的特色內容標題。
	list : 'WP:FA|WP:FL'.split('|'),
	redirects : 1,
	reget : true,
	// 檢查WP:FA、WP:FL，提取出所有特色內容的條目連結，
	each : parse_each_FC_list
}, {
	type : 'page',
	// TODO: 一次大量取得頁面。
	list : generate_FC_page_list,
	redirects : 1,
	// 並且檢查/解析所有過去首頁曾經展示過的特色內容頁面，以確定特色內容頁面最後一次展示的時間。
	each : parse_each_FC_page
} ], function() {
	// console.log(Featured_content_hash);

	var title_sorted = Object.keys(Featured_content_hash)
	// || Infinity: 沒上過首頁的頁面因為不存在簡介頁面，所以必須要排在最後，不能夠列入顯示。
	// TODO: 檢查簡介頁面是否存在。
	.sort(function(title_1, title_2) {
		return (JDN_hash[title_1] || 0) - (JDN_hash[title_2] || 0);
	});

	if (false) {
		title_sorted.join('|');
		title_sorted.map(function(FC_title) {
			return JDN_hash[FC_title];
		});
		console.log(title_sorted.map(function(FC_title) {
			return FC_title + ' - '
			//
			+ (JDN_hash[FC_title] ? CeL.Julian_day.to_YMD(
			//
			JDN_hash[FC_title], true).join('/') : '沒上過首頁');
		}).join('\n'));
	}

	wiki.page(CeL.Julian_day.to_Date(JDN_tomorrow).format(
			'Wikipedia:典範條目/%Y年%m月%d日'), function(page_data) {
		/**
		 * {String}page title = page_data.title
		 */
		var title = CeL.wiki.title_of(page_data),
		/**
		 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
		 */
		content = CeL.wiki.content_of(page_data);

		if (!content) {
			// 沒上過首頁、抑或最後展示時間距今最早的頁面（此方法不見得會按照日期順序來展示）
			var FC_title = title_sorted[0];
			if (!JDN_hash[FC_title]) {
				throw '沒有可供選擇的特色內容頁面! 照理來說不就不應該發生!';
			}
			// 最後採用嵌入包含的方法寫入新的日期裡面，如Wikipedia:典範條目/2019年1月1日，展示為下一個首頁特色內容。
			wiki.edit('{{Wikipedia:'
					+ (FC_page_prefix[FC_title] || '典範'
							+ (Featured_content_hash[FC_title] ? '條目' : '條目'))
					+ '/' + FC_title + '}}', {
				summary : '更新首頁特色內容: '
						+ CeL.wiki.title_link_of(FC_title)
						+ (JDN_hash[FC_title] ? '上次展示時間為'
								+ CeL.Julian_day.to_YMD(JDN_hash[FC_title],
										true).join('/') : '沒上過首頁'),
				bot : 1,
			});
			return;
		}

		var matched = content.replace(
		//
		/<!--[\s\S]*?-->/g, '').match(PATTERN_FC_transcluded);

		if (!matched) {
			// TODO: 如有破壞，該機器人應及時通知社群。
			return;
		}

		var FC_title = CeL.wiki.normalize_title(matched[2]);
		if (!(FC_title in Featured_content_hash)) {
			// 所嵌入包含的標題並非特色內容標題。
			;
		}
	});

}, {
	// JDN index in parse_each_FC_page()
	JDN : JDN_start,

	// default options === this
	// [SESSION_KEY]
	// session : wiki,
	// cache path prefix
	prefix : base_directory
});
