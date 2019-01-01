// cd /d D:\USB\cgi-bin\program\wiki && node 20190101.featured_content_maintainer.js

/*

 2019/1/1 10:25:51	初版試營運

 // 輪流展示列表

 TODO: check Wikipedia:已撤銷的典範條目

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
// 開始有特色內容頁面的日期。
JDN_start = CeL.Julian_day.from_YMD(2013, 8, 20, true),
// 開始廢棄"特色條目"，採用"典範條目"的日期。
典範JDN = CeL.Julian_day.from_YMD(2017, 10, 1, true),

FC_list_pages = 'WP:FA|WP:FL'.split('|'),

DISCUSSION_PAGE = 'Wikipedia:互助客栈/条目探讨', DISCUSSION_options = {
	section : 'new',
	sectiontitle : '明天的首頁特色內容頁面似乎有問題，請幫忙處理',
	nocreate : 1,
	summary : '明天的首頁特色內容頁面似乎有問題，通知社群'
},

// Featured_content_hash[FC_title] = is_list
Featured_content_hash = CeL.null_Object(),
// JDN_hash[FC_title] = JDN
JDN_hash = CeL.null_Object(),
// @see get_FC_title_to_transclude(FC_title)
FC_page_prefix = CeL.null_Object(),
/**
 * {RegExp}每日特色內容頁面所允許的[[w:zh:Wikipedia:嵌入包含]]正規格式。<br />
 * matched: [ all, FC_page_prefix, FC_title ]
 */
PATTERN_FC_transcluded = /^\s*\{\{\s*(?:Wikipedia|wikipedia|維基百科|维基百科):((?:特色|典範|典范|优良)(?:條目|条目|列表))\/(?:s\|)?([^\/{}]+)\}\}\s*$/;

// ---------------------------------------------------------------------//

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
			CeL.log('[[Wikipedia:已撤銷的典範條目|不再是特色/典範了]]? ' + matched[1] + ' '
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

// get page name to transclude
function get_FC_title_to_transclude(FC_title) {
	return 'Wikipedia:'
			+ (FC_page_prefix[FC_title] || '典範'
					+ (Featured_content_hash[FC_title] ? '條目' : '條目')) + '/'
			+ FC_title;
}

function main_process() {
	// console.log(Featured_content_hash);

	var title_sorted = Object.keys(Featured_content_hash)
	// || Infinity: 沒上過首頁的頁面因為不存在簡介/摘要頁面，所以必須要排在最後，不能夠列入顯示。
	// TODO: 檢查簡介/摘要頁面是否存在。
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

	// [[Wikipedia:首页/明天]]是連鎖保護
	/** {String}隔天首頁將展示的特色內容分頁title */
	var page_title = CeL.Julian_day.to_Date(JDN_tomorrow).format(
			'Wikipedia:典範條目/%Y年%m月%d日');
	wiki.page(page_title, function(page_data) {
		/**
		 * {String}page title = page_data.title
		 */
		var title = CeL.wiki.title_of(page_data),
		/**
		 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
		 */
		content = CeL.wiki.content_of(page_data);

		if (!content) {
			// 然後自還具有特色內容資格的條目中，挑選出沒上過首頁、抑或最後展示時間距今最早的頁面（此方法不見得會按照日期順序來展示），
			var FC_title = title_sorted[0];
			if (!JDN_hash[FC_title]) {
				// TODO: 檢查簡介/摘要頁面是否存在。
				// throw '沒有可供選擇的特色內容頁面! 照理來說這不應該發生!';
			}
			// 如若不存在，採用嵌入包含的方法寫入隔天首頁將展示的特色內容分頁裡面，展示為下一個首頁特色內容。
			wiki.edit('{{' + get_FC_title_to_transclude(FC_title) + '}}', {
				// bot : 1,
				summary : '更新首頁特色內容: '
						+ CeL.wiki.title_link_of(FC_title)
						+ (JDN_hash[FC_title] ? '上次展示時間為'
								+ CeL.Julian_day.to_YMD(JDN_hash[FC_title],
										true).join('/') : '沒上過首頁')
			});
			if (!JDN_hash[FC_title])
				check_if_FC_introduction_exists(FC_title);
			return;
		}

		// 最後檢查隔天首頁將展示的特色內容分頁，如Wikipedia:典範條目/2019年1月1日，如有破壞，通知社群：Wikipedia:互助客棧/條目探討。
		var matched = content.replace(/<!--[\s\S]*?-->/g, '').match(
				PATTERN_FC_transcluded);

		if (!matched) {
			wiki.page(DISCUSSION_PAGE).edit('明天的首頁特色內容頁面('
			//
			+ CeL.wiki.title_link_of(page_title)
			//
			+ ')似乎並非標準的嵌入包含頁面格式，請幫忙處理，謝謝。 --~~~~', DISCUSSION_options);
			return;
		}

		var FC_title = CeL.wiki.normalize_title(matched[2]);
		if (!(FC_title in Featured_content_hash)) {
			wiki.page(DISCUSSION_PAGE).edit('明天的首頁特色內容頁面('
			//
			+ CeL.wiki.title_link_of(page_title)
			//
			+ ')所嵌入包含的標題似乎並非特色內容標題，請幫忙處理，謝謝。 --~~~~', DISCUSSION_options);
			return;
		}

		check_if_FC_introduction_exists(FC_title);
	});

}

// ---------------------------------------------------------------------//

// 確認簡介頁面存在。
function check_if_FC_introduction_exists(FC_title) {
	var page_name = get_FC_title_to_transclude(FC_title);
	wiki.page(page_name, function(page_data) {
		/**
		 * {String}page title = page_data.title
		 */
		var title = CeL.wiki.title_of(page_data),
		/**
		 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
		 */
		content = CeL.wiki.content_of(page_data);

		if (!content) {
			wiki.page(DISCUSSION_PAGE).edit('明天的首頁特色內容頁面('
			//
			+ CeL.wiki.title_link_of(page_title)
			//
			+ ')所嵌入包含的標題還不存在簡介，請幫忙[[' + FC_title + '|撰寫簡介]]，謝謝。 --~~~~',
					DISCUSSION_options);
			return;
		}
	});
}

// ---------------------------------------------------------------------//

CeL.wiki.cache([ {
	type : 'page',
	// assert: 這些頁面包含的必定是所有檢核過的特色內容標題。
	// TODO: 檢核這些頁面是否是所有檢核過的特色內容標題。
	list : FC_list_pages,
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
} ], main_process, {
	// JDN index in parse_each_FC_page()
	JDN : JDN_start,

	// default options === this
	// [SESSION_KEY]
	// session : wiki,
	// cache path prefix
	prefix : base_directory
});
