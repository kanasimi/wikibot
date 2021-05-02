// cd ~/wikibot && date && time ../node/bin/node 20160628.insert_navigation.插入導航模板.js && date
// cd /d D:\USB\cgi-bin\program\wiki && node 20160628.insert_navigation.插入導航模板.js template_name BOTREQ_diff_id
// Insert navigation template (navigation boxes, navboxes).
// 對指定之[[WP:導航模板|]]中所有列表頁面，都插入此導航模板。若有[[WP:重定向|]]頁，則回頭將導航模板中之連結改成重定向的目標。

/*

 usage:
 node 20160628.insert_navigation.插入導航模板.js template_name [BOTREQ_diff_id]

 e.g.,
 node 20160628.insert_navigation.插入導航模板.js 中国经济 49849923

 2016/4/3 21:24:7	初版試營運。批量連接Template:廣州
 2016/6/28 22:27:52	批量連接Template:深圳、Template:南京
 2016/7/14 18:40:39	轉成常態性工具。

 TODO: 重定向頁需跑兩次！

 */

'use strict';

require('../wiki loader.js');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true);

// ---------------------------------------------------------------------//

// CeL.set_debug(0);

var

BOTREQ_diff_id = +process.argv[3],

// process.argv:
// ['node','20160628.insert_navigation.插入導航模板.js','template name']
template_name = CeL.wiki.normalize_title(process.argv[2]).replace(/^Template:/i, '');
if (!template_name) {
	// throw new Error('No template name specified!');
	CeL.error('No template name specified!');
	process.exit(1);
}

// 回頭將導航模板中之連結改成重定向的目標。
var redirect_hash = Object.create(null),
//
template_with_ns = /^(Template|模板):/.test(template_name) ? template_name
		: 'Template:' + template_name,
//
template_transclusion = '{{' + template_name + '}}' + '\n',
// {{tl|Featured article}}或{{tl|Good article}}模板 pattern
PATTERN_GA = /[\r\n]*{{(?:[Ff]eatured|[Gg]ood)[ _](?:article|list)(?:[\s\n\|][^{}]*?)?}}[\r\n]*/,
// [[WP:ORDER]]
// [[WP:分類、列表與導航模板]]
// [[WP:NAV]]
// [[WP:小作品類別列表|(小)小作品模板]]: e.g., {{小小條目}}, {{Rubik's Cube-stub}},
// {{F1-stub}}, {{Japan-Daimyō-stub}}, {{BDSM小作品}}, {{LGBT小作品}}
// {{Coord[}\s\|]|{{Coord[}\s\|]| → 大多用在模板參數中，不用在文末，因此不予加入。
PATTERN_AFTER = /{{\s*Portal[ _]bar\s*\||{{\s*Authority[ _]control\s*[}\|]|{{\s*Persondata(?:[}\s\|]|<!--)|{{\s*DEFAULTSORT\s*:|\[\[ *(?:Category|分類|分类) *:|{{\s*(?:(?:Sub|Sect|[a-z\d\- _\'ō]*-)?stub|[^{} _\d\|]*小作品|小小?條目|(?:Featured|Good)[ _](?:article|list))(?:[\s\n\|}]|<!--)|\n*$/;

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
	/** {String}page content, maybe undefined. 頁面內容 = CeL.wiki.revision_content(revision) */
	content = CeL.wiki.content_of(page_data);
	/** {Object}revision data. 版本資料。 */
	// var revision = page_data.revisions && page_data.revisions[0];
	if (!content) {
		content = 'No contents: [[' + title + ']]! 沒有頁面內容！';
		CeL.log(content);
		return;
		return [ CeL.wiki.edit.cancel, content ];
	}

	if (title === template_with_ns) {
		// 回頭將導航模板中之連結改成重定向的目標。
		for (title in redirect_hash) {
			content = content.replace(new RegExp(
					'\\[\\[' + title + '([\\]\|])', 'g'), '[['
					+ redirect_hash[title] + '$1');
		}
		return content;
	}

	var matched;
	if (matched = CeL.wiki.parse.redirect(content)) {
		// wiki.page(matched).edit(for_each_pages);
		redirect_hash[title] = matched;
		return [ CeL.wiki.edit.cancel, '為重定向頁: [[' + matched + ']]' ];
	}

	matched = CeL.wiki.parse.template(content, template_name, true);
	if (matched) {
		// 若已存在模板/兩者模板相同，則跳過不紀錄。
		matched = '已存在模板{{tlx|' + template_name + '}}';
		CeL.log(matched);
		return;
		return [ CeL.wiki.edit.cancel, matched ];
	}

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

// 確保 [[template_with_ns]] 在最後一頁，以在最後處理 redirect_hash。
// 注意: 一次取得大量頁面時，回傳內容不一定會按照原先輸入的次序排列！
// 若有必要，此時得用 config.first 自行處理！
function arrange_page(messages, pages) {
	// console.log(pages);
	if (template_with_ns === CeL.wiki.title_of(pages.at(-1))) {
		return;
	}

	// 應該從後面搜尋。
	var index = pages.length, page_data;
	while (true) {
		if (--index < 0) {
			CeL.error('Not found: [[' + template_with_ns
					+ ']]. 除非是處理巨型模板，連結過多使模板本身並不在本批次中；否則不應發生此錯誤！');
			return;
		}
		page_data = pages[index];
		if (template_with_ns === CeL.wiki.title_of(page_data)) {
			break;
		}
	}
	pages.splice(index, 1);
	pages.push(page_data);
}

/**
 * Finish up. 最後結束工作。
 */
function finish_work() {
}

// ----------------------------------------------------------------------------

wiki.links(template_with_ns, function(pages, error) {
	CeL.log('[[' + pages.title + ']]: All ' + pages.length + ' links.');

	/** 限制每一項最大處理頁面數。 */
	if (false) {
		pages = pages.slice(0, 5);
	}

	// for redirect_hash.
	pages.push(template_with_ns = pages.title);

	// callback
	wiki.work({
		each : for_each_pages,
		// 採用 {{tlx|template_name}} 時，[[Special:最近更改]]頁面無法自動解析成 link。
		summary : summary + ': [[Template:' + template_name + ']]'
				+ (BOTREQ_diff_id > 0 ? ' [[Special:Diff/' + BOTREQ_diff_id
				//
				+ '|bot作業請求]]' : '') + ' - [[' + log_to + '|log]]',
		log_to : log_to,
		before : arrange_page,
		last : finish_work
	}, pages);

}, {
	limit : 'max',
	namespace : 0
});
