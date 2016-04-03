// cd ~/wikibot && date && time ../node/bin/node 20160403.insert_navigation.插入導航模板.js && date
// cd /d D:\USB\cgi-bin\program\wiki && node 20160403.insert_navigation.插入導航模板.js
// Insert navigation template (navigation boxes, navboxes). 插入導航模板

/*

 初版試營運。

 */

'use strict';

require('./wiki loder.js');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),
/** {String}編輯摘要。總結報告。 */
summary = '插入導航模板',
/** {String}緊急停止作業將檢測之章節標題。 */
check_section = '20160403',
/** {String}運作記錄存放頁面。 */
log_to = 'User:' + user_name + '/log/' + check_section;

// ---------------------------------------------------------------------//

// CeL.set_debug(0);

var template_name = '广州';

var template_transclusion = '{{' + template_name + '}}' + '\n',
// {{tl|Featured article}}或{{tl|Good article}}模板 pattern
PATTERN_GA = /[\r\n]*{{(?:[Ff]eatured|[Gg]ood)[ _](?:article|list)(?:[\s\n\|][^{}]*?)?}}[\r\n]*/,
// [[WP:ORDER]]
// [[WP:分類、列表與導航模板]]
// [[WP:NAV]]
// [[WP:小作品類別列表|(小)小作品模板]]: e.g., {{小小條目}}, {{Rubik's Cube-stub}},
// {{F1-stub}}, {{Japan-Daimyō-stub}}, {{BDSM小作品}}, {{LGBT小作品}}
PATTERN_AFTER = /{{Coord[}\s\|]|{{Coord[}\s\|]|{{Authority[ _]control[}\s\|]|{{\s*Persondata(?:[}\s\|]|<!--)|{{\s*DEFAULTSORT\s*:|\[\[\s*Category:|{{\s*(?:(?:Sub|Sect|[a-z\- _\d'ō]*-)?stub|[^{} _\d\|]*小作品|小小?條目|(?:Featured|Good)[ _](?:article|list))(?:[\s\n\|}]|<!--)|\n*$/

/**
 * Operation for each page. 對每一個頁面都要執行的作業。
 * 
 * @param {Object}page_data
 *            page data got from wiki API. =
 *            {pageid,ns,title,revisions:[{timestamp,'*'}]}
 * 
 * @see "20150805.en wiki 之[[規範控制]] (Authority control) 模板轉移作業.sop.js"
 */
function for_each_pages(page_data) {
	/** {String}page title = page_data.title */
	var title = CeL.wiki.title_of(page_data),
	/** {String}page content, maybe undefined. 頁面內容 = revision['*'] */
	content = CeL.wiki.content_of(page_data);
	/** {Object}revision data. 版本資料。 */
	var revision = page_data.revisions && page_data.revisions[0];

	if (!content)
		return [ CeL.wiki.edit.cancel,
				'No contents: [[' + title + ']]! 沒有頁面內容！' ];

	var matched = CeL.wiki.parser.template(content, template_name, true);
	if (matched)
		// 若已存在模板/兩者模板相同，則跳過不紀錄。
		return [ CeL.wiki.edit.cancel, '已存在模板{{tlx|' + template_name + '}}' ];

	// 某些條目把{{tl|Featured article}}或{{tl|Good article}}模板加至頁頂。
	matched = content.match(PATTERN_GA);
	if (matched && matched.index < (content.length / 2 | 0)) {
		// 依[[WP:ORDER]]，優特狀態模板應置放在條目的最底部。
		content = content.replace(PATTERN_GA, '\n') + '\n' + matched[0].trim()
				+ '\n';
	}

	return content.replace(PATTERN_AFTER, function($0) {
		$0 = $0.trim();
		return $0 ? template_transclusion + $0
		// +'\n': 若結尾不包含 '\n'，則可能直接添加在文字後！
		: '\n' + template_transclusion;
	});
}

/**
 * Finish up. 最後結束工作。
 */
function finish_work() {
}

// ----------------------------------------------------------------------------

wiki.links('Template:' + template_name, function(title, titles, pages) {
	CeL.log('All ' + pages.length + ' pages.');

	// callback
	wiki.work({
		each : for_each_pages,
		// 採用 {{tlx|template_name}} 時，[[Special:最近更改]]頁面無法自動解析成 link。
		summary : summary + ': [[Template:' + template_name + ']]',
		log_to : log_to,
		after : finish_work
	}, titles.slice(0, 2));

}, {
	limit : 'max',
	namespace : 0
});
