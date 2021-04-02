// (cd ~/wikibot && date && hostname && nohup time node 20170708.import_VOA.js; date) >> modify_link/log &

/*

 讓機器人自動匯入美國之音(VOA)新的報導。
 警告: 同時間只能有一隻程式在跑，否則可能會造成混亂！

 2017/7/8 21:05:40–23:41:07	初版試營運。

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

/* eslint no-use-before-define: ["error", { "functions": false }] */
/* global CeL */
/* global Wiki */

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'wikinews');

// The user is waiting online.
wiki.edit_time_interval = 0;

// ----------------------------------------------------------------------------

var main_operation_title = 'User talk:' + user_name + '/VOA-request', PATTERN_link = /\n[*#:]?\s*(https?:\/\/[^\s]+)(\s[^\n]*)?/g;

// @see [[Category:频道]]
var preserve_categories = ('臺灣|台灣|台湾|香港|澳门|西藏|蒙古|印度|俄罗斯|朝鲜|中东' + '|环境|天气'
		+ '|政治|法治|法律|人权' + '|社会|文化|教育|宗教|讣告' + '|财经|经济|金融' + '|科技|科学' + '|体育')
		.split('|');

(function() {
	var category_hash = Object.create(null);
	preserve_categories.forEach(function(category) {
		category_hash[category] = true;
	});
	preserve_categories = category_hash;
})();

// CeL.set_debug(2);

// 僅僅執行一次，一開始就執行一次。
wiki.page(main_operation_title, process_main_page, {
	rvprop : 'content|timestamp|user',
	redirects : 1
})
// listen all_time
.run(setup_listener);

function setup_listener() {
	// CeL.set_debug(2);
	// 隨時監視 main_operation_title。
	if (false)
		CeL.info('setup_listener: listen to '
				+ CeL.wiki.title_link_of(main_operation_title));

	wiki.listen(function(row) {
		CeL.info(script_name + ': ' + CeL.wiki.title_link_of(row));
		if (false)
			console.log([ row.title, row.revid, row.timestamp,
					CeL.wiki.content_of(row).slice(0, 200) ]);
		process_main_page(row);
	}, {
		// start : '1h',
		interval : '5s',
		with_content : true,
		filter : main_operation_title
	});
}

// ----------------------------------------------------------------------------

// 解析 main_operation_title 看看是不是有新的申請。
function process_main_page(row, error) {
	// console.log(row);
	// console.log(CeL.wiki.content_of.revision(row).user);

	if (!CeL.wiki.content_of.page_exists(row)) {
		// error?
		return [ CeL.wiki.edit.cancel, '條目已不存在或被刪除' ];
	}

	// for redirects
	if (main_operation_title !== row.title) {
		CeL.info('Redirects: ' + CeL.wiki.title_link_of(main_operation_title)
				+ '→' + CeL.wiki.title_link_of(row.title));
		main_operation_title = row.title;
	}

	var
	/** {String}page content, maybe undefined. */
	content = CeL.wiki.content_of(row);
	// console.log(content);

	var link_data = Object.create(null), to_pass = {
		link_data : link_data,
		processed_count : 0,
		process : process_VOA_page,
		check_links : check_links
	};
	var matched;
	while (matched = PATTERN_link.exec(content)) {
		if (false) {
			delete matched.input;
			console.log(matched);
		}
		var link = matched[1];
		if (link in link_data) {
			CeL.error('連結重複了: ' + link + ' Skip the link');
			continue;
		}
		link_data[link] = {
			URL : link,
			user : CeL.wiki.parse.user(matched[2])
			// 自動取得編輯者名稱
			|| row.user
			// row.revisions[0].user
			|| CeL.wiki.content_of.revision(row).user
		};
		CeL.get_URL(link, function(XMLHttp, error) {
			XMLHttp.original_URL = link;
			to_pass.process(XMLHttp, error);
		}, null, null, {
			// 美國之音網站似乎時不時會 Error: connect ETIMEDOUT
			error_retry : 3,
			timeout : CeL.to_millisecond('30s')
		});
	}

	var titles = Object.keys(link_data);
	to_pass.count = titles.length;
	if (to_pass.count > 0) {
		CeL.log('process_main_page: Import ' + to_pass.count + ' VOA links:\n'
				+ titles.join('\n'));
	}
}

// ----------------------------------------------------------------------------

function process_VOA_page(XMLHttp, error) {
	// console.log(XMLHttp);
	var status_code = XMLHttp.status,
	//
	response = XMLHttp.responseText;

	var link_data = this.link_data,
	// assert: 沒有經過301轉換網址
	this_link_data = link_data[XMLHttp.original_URL];
	if (!this_link_data) {
		CeL.error('Can not found link data of ' + XMLHttp.original_URL);
		console.log('link data: ' + JSON.stringify(link_data));
		this.check_links();
		return;
	}

	if (error) {
		this_link_data.note = error;
		CeL.error(this_link_data.note + ': ' + XMLHttp.original_URL);
		this.check_links();
		return;
	}

	var title = response.between('<meta name="title" content="', '"').trim(),
	// 報導的時間。
	report_date = new Date(response.between('<time datetime="', '"')
	// VOA 這個時間竟然是錯的，必須將之視作中原標準時間。
	.replace('+00:00', '+08:00')),
	// 解析頁面以取得內容。
	// 這裡列出的是一定會包含的tags
	report = response.between('<div class="body-container">');
	// 有些文章沒有 "<ul class="author-hlight">"
	// e.g.,
	// https://www.voachinese.com/a/supreme-court-adjourns-hearings-of-former-catalan-lawmakers-20171102/4097188.html
	// 有些文章沒有 '<div class="comments comments-pangea">'
	// e.g.,
	// https://www.voachinese.com/a/air-filter-20171024/4084304.html
	report = report.between(null, '<ul class="author-hlight">')
	// Author's Profile e.g.,
	// https://www.voachinese.com/a/pence-nokor-20180221/4263630.html
	|| report.between(null, '<div class="c-author')
			|| report.between(null, '<div id="comments" ')
			|| report.between(null, '<div class="media-block-wrap') || report;
	// 不能從 "</ul>" 截斷，會造成第二段之後消失。
	report = report.between('<div class="wsw">', {
		tail : '</div>'
	});

	// assert: typeof this_link_data === 'object'

	// console.log(title);
	// console.log(report);

	if (!title || !report) {
		this_link_data.note = response ? '無法解析頁面，需要更新解析頁面這部分的程式碼。'
				: '無法取得頁面內容。';
		CeL.error(this_link_data.note + ': ' + XMLHttp.original_URL);
		this.check_links();
		return;
	}

	// 去掉包含的圖片以及多媒體影片。
	// TODO: 應該 parse HTML。
	report = report.replace_till_stable(/(<div[^<>]*>[\s\S]*?)<\/div>/g,
	// e.g., "<div class="wsw__embed ">",
	// "<div class="wsw__embed wsw__embed--small">"
	function(all, innerHTML) {
		var index = innerHTML.lastIndexOf('<div');
		return index > 0 ? all.slice(0, index) : '';
	}).replace(/<span class="dateline">.+?<\/span>/, '');
	report = CeL.wiki.HTML_to_wikitext(report)
	// ignore style, remove <p style="...">...</p>
	.replace(/<p[^<>]*>([^<>]*)<\/p>[\s\n]*/g, '$1\n\n')
	// 去掉結尾無用的 HTML tags. e.g.,
	// https://www.voachinese.com/a/cultural-odyssey-20180126-earth-sweltered/4226492.html
	.replace(/(<\/?[a-z]+>[\s\n]*)+$/g, '')
	// 去掉 empty HTML tags.
	.replace_till_stable(/<([a-z]+)( [^<>]*)?>\s*<\/\1>/g, function(all, tag) {
		return tag === 'p' ? '\n\n' : '';
	}).trim();

	if (!(report_date.getTime() > 0)) {
		report_date = new Date;
	}

	function edit_wiki_page(page_data) {
		// 清空頁面將會執行下去。
		if (CeL.wiki.content_of(page_data)) {
			this_link_data.note = CeL.wiki.title_link_of(title) + ': 本頁面已經有內容。';
			CeL.error('本頁面已經有內容: ' + CeL.wiki.title_link_of(title));
			return;
		}

		if (this_link_data.OK) {
			CeL.error('已經處理過，可能是標題重複了: ' + CeL.wiki.title_link_of(title) + ', '
					+ XMLHttp.original_URL);
			// 目標網頁已存在，跳過。
			// this_link_data.note = '已處理過，跳過。';
			return [ CeL.wiki.edit.cancel, 'skip' ];
		}
		this_link_data.OK = true;
		CeL.info('Write page ' + CeL.wiki.title_link_of(title));
		this_link_data.title = title;
		if (this_link_data.user) {
			this.summary += ' requested by [[User:' + this_link_data.user
					+ ']]';
		}

		var categories = response
				.match(/<meta content="([^"]+)" name="news_keywords"/);
		if (categories) {
			categories = categories[1].replace(/港澳/, '香港,澳门').split(/\s*,\s*/);
			this_link_data.categories = categories;
			categories = '\n' + categories
			// 目前僅自動加入國家或者各大洲的分類。
			// TODO: 僅對於存在的分類才加入。
			.filter(function(keyword) {
				return /[洲國国]$/.test(keyword)
				//
				|| (keyword in preserve_categories);
			}).map(function(keyword) {
				return '[[Category:' + keyword + ']]';
			}).join('\n');
		} else {
			categories = '';
		}

		if (/<[a-z][^<>]*>/.test(report)) {
			this_link_data.note = '因為報導中尚存有[[w:HTML標籤|]]，這份報導還必須經過整理。';
		}

		// {"edit":{"spamblacklist":"bit.ly/VOAIO-youtube|youtu.be/KdlNsp0gmh4","result":"Failure"}}
		report = report.replace(/\[([^\[\]\s]+)([^\[\]]*)\]/g, function(all,
				link, title) {
			if (/youtu\.be|bit\.ly/.test(link)) {
				this_link_data.note = '已去掉廣告連結。';
				return all;
			}
		});

		// console.log(report);
		// throw 974513456;
		return '{{Date|' + report_date.format({
			format : '%Y年%m月%d日',
			// CST
			zone : 8
		}) + '}}\n\n' + report + '\n\n== 資料來源 ==\n{{VOA|url='
				+ XMLHttp.responseURL + '|title=' + title + '}}\n{{'
				// 有問題的文章都設定為 Review。
				+ (this_link_data.note ? 'Review' : 'Publish') + '}}'
				+ categories;
	}

	// CeL.set_debug(6);
	wiki.page(title).edit(edit_wiki_page, {
		// for 機器人轉載新聞稿。
		tags : 'import news',
		summary : '[[' + main_operation_title + '|Import VOA news]]'
	}, function(page_data, error, result) {
		if (this_link_data.OK && error && error !== 'skip') {
			delete this_link_data.OK;
			if (!this_link_data.note)
				this_link_data.note = error;
		}
	}).run(check_links.bind(this));
}

// ----------------------------------------------------------------------------

function check_links() {
	var link_data = this.link_data;
	++this.processed_count;
	CeL.log('check_links: got ' + this.processed_count + '/' + this.count);
	if (this.processed_count < this.count) {
		return;
	}

	function add_report(page_data) {
		var
		/** {String}page content, maybe undefined. */
		content = CeL.wiki.content_of(page_data);

		return content.replace(PATTERN_link, function(all, link, sign) {
			var this_link_data = link_data[link];
			// console.log(this_link_data);

			return '\n* '
					+ (this_link_data.title ? '[' + link + ' '
							+ this_link_data.title + ']'
					// 對 link 添加一點變化，以避免下一次再執行的時候重複處理。
					// 採用(...)+link的話，這一段會造成 JSDoc 沒辦法格式化。
					: '{{' + (this_link_data.OK ? 'Done' : 'Cancelled') + '}} '
							+ link)
					+ (sign ? sign : this_link_data.user ? ' --[[User:'
							+ this_link_data.user + '|]]' : '')
					+ '\n: {{'
					+ (this_link_data.OK ? 'Done' : 'Cancelled')
					+ '}}'
					+ (this_link_data.user ? '[[User:' + this_link_data.user
							+ ']]: ' : '')
					+ CeL.wiki.title_link_of(this_link_data.title)
					// add categories (keywords) to report
					+ (this_link_data.categories ? ' ('
							+ this_link_data.categories.join(', ') + ')' : '')
					+ (this_link_data.note ? "。'''" + this_link_data.note
							+ "'''" : '') + ' --~~~~';
		});
	}

	wiki.page(main_operation_title).edit(add_report, {
		summary : 'Report of '
		//
		+ this.processed_count + ' VOA-importing request'
	}).run(function() {
		// CeL.set_debug(0);
	});
}
