// (cd ~/wikibot && date && hostname && nohup time node 20170708.import_VOA.js; date) >> modify_link/log &

/*

 讓機器人自動匯入美國之音(VOA)新的報導。

 2017/7/8 21:05:40–23:41:07	初版試營運。


 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'wikinews');

// ----------------------------------------------------------------------------

// CeL.set_debug(2);

var main_page = 'User:' + user_name + '/VOA-request', PATTERN_link = /\n\*\s*(https:[^\s]+)([^\n]+)/g, link_data = CeL
		.null_Object(), processed_count = 0, finished_count = 0;

wiki.page(main_page, function(page_data) {
	if (!page_data || ('missing' in page_data)) {
		// error?
		return [ CeL.wiki.edit.cancel, '條目已不存在或被刪除' ];
	}

	/** {String}page title */
	var title = CeL.wiki.title_of(page_data),
	/** {String}page content, maybe undefined. */
	content = CeL.wiki.content_of(page_data);

	var matched;
	while (matched = PATTERN_link.exec(content)) {
		var link = matched[1];
		if (link in link_data) {
			CeL.err('連結重複了: ' + link);
			continue;
		}
		link_data[link] = {
			URL : link,
			user : CeL.wiki.parse.user(matched[2])
		};
		CeL.get_URL(link, process_VOA_page);
	}
	if (Object.keys(link_data).length > 0) {
		CeL.log('Import VOA links:\n' + Object.keys(link_data).join('\n'));
	}
});

function HTML_to_wikitext(HTML) {
	return HTML
	//
	.replace(/<\/i><i>/g, '').replace(/<\/b><b>/g, '').replace(
			/<\/strong><strong>/g, '')
	//
	.replace(/<i>(.+?)<\/i>\n*/g, "''$1''").replace(/<b>(.+?)<\/b>\n*/g,
			"'''$1'''").replace(/<strong>(.+?)<\/strong>/g, "'''$1'''")
			.replace(/<p>(.+?)<\/p>\n*/g, '$1\n\n');
}

function process_VOA_page(XMLHttp) {
	var status_code = XMLHttp.status,
	//
	response = XMLHttp.responseText;

	var title = response.between('<meta name="title" content="', '"'),
	// 這裡列出的是一定會包含的tags
	report = response.between('<div class="body-container">',
			'<ul class="author-hlight">')
			.between('<div class="wsw">', '</div>'), report_date = new Date(
			response.between('<time datetime="', '"')
			// 這個時間竟然是錯的...
			.replace('+00:00', '+08:00'));

	report = HTML_to_wikitext(
			report.between(null, '<div class="wsw__embed">') || report).trim();

	if (!(report_date.getTime() > 0)) {
		report_date = new Date;
	}

	function edit_wiki_page(page_data) {
		// 清空頁面將會執行下去。
		if (CeL.wiki.content_of(page_data)) {
			CeL.err('本頁面已經存在: ' + CeL.wiki.title_link_of(title));
			return;
		}
		if (link_data[XMLHttp.URL].OK) {
			CeL.err('已經處理過，可能是標題重複了: ' + title + ', ' + XMLHttp.URL);
			return [ CeL.wiki.edit.cancel, 'skip' ];
		}
		link_data[XMLHttp.URL].OK = true;

		link_data[XMLHttp.URL].title = title;
		var keywords = response
				.match(/<meta content="([^"]+)" name="news_keywords"/);
		keywords = keywords ? '\n'
				+ keywords[1].split(/\s*,\s*/).map(function(keyword) {
					return '[[Category:' + keyword + ']]';
				}).join('\n') : '';

		return '{{date|' + report_date.format({
			format : '%Y年%m月%d日',
			// CST
			zone : 8
		}) + '}}\n\n' + report + '\n\n== 資料來源 ==\n{{VOA|url=' + XMLHttp.URL
				+ '|title=' + title + '}}\n{{Publish}}' + keywords;
	}

	wiki.page(title).edit(edit_wiki_page, {
		summary : 'Import VOA news'
	}, check_links);
}

function check_links() {
	if (++processed_count < Object.keys(link_data).length) {
		return;
	}

	function add_report(page_data) {
		var
		/** {String}page content, maybe undefined. */
		content = CeL.wiki.content_of(page_data);

		return content.replace(PATTERN_link, function(all, link, sign) {
			if (link_data[link].OK) {
				return '\n\* [' + link + ' ' + link_data[link].title + ']'
						+ sign + '\n: {{Done}}: '
						+ CeL.wiki.title_link_of(link_data[link].title)
						+ ' ~~~~';
			}
			return all;
		});
	}

	wiki.page(main_page).edit(add_report, {
		summary : 'Report of VOA-importing'
	});
}
