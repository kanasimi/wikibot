// cd ~/wikibot && date && hostname && time /shared/bin/node 20160609.check_表記ガイド.js && date
// Traversal all pages. 遍歷所有頁面。簡易版，用於展示概念。

/*

 2016/6/9 6:14:18	初版試營運，採用模板：traversal_pages.clear.js，約耗時 ?分鐘執行。

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('ja');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true);

/** {Array}filtered list = {Array}[ list ] */
var filtered = [];

// ----------------------------------------------------------------------------

/**
 * Operation for each page. 對每一個頁面都要執行的作業。
 * 
 * @param {Object}page_data
 *            page data got from wiki API. =
 *            {pageid,ns,title,revisions:[{timestamp,'*'}]}
 */
function for_each_page(page_data) {
	/** {String}page title = page_data.title */
	var title = CeL.wiki.title_of(page_data),
	/** {String}page content, maybe undefined. 頁面內容 = revision['*'] */
	content = CeL.wiki.content_of(page_data);

	if (!content)
		return;

	var PATTERN_title = /\n(=+[^\n=]+=+)/g, matched;
	while (matched = PATTERN_title.exec(content)) {
		if (matched[1].includes('･')) {
			CeL.log('[[' + title + ']]: ' + matched[1]);
			filtered.push('[[' + title + ']]: ' + matched[1]);
			return;
		}
	}
}

/**
 * Finish up. 最後結束工作。
 */
function finish_work() {
	CeL.log(script_name + ': ' + filtered.length + ' page(s) filtered.');
	if (filtered.length > 0) {
		CeL.fs_write(base_directory + 'filtered.lst', filtered.join('\n'));
		wiki.page('User:' + user_name + '/節タイトルが半角の中黒を含んだ記事').edit(function () {
			filtered.join('\n');
		});
	}
}

// ----------------------------------------------------------------------------

prepare_directory(base_directory);

// Set the umask to share the xml dump file.
if (typeof process === 'object') {
	process.umask(parseInt('0022', 8));
}

// CeL.set_debug(6);
CeL.wiki.traversal({
	wiki : wiki,
	// cache path prefix
	directory : base_directory,
	// 指定 dump file 放置的 directory。
	// dump_directory : bot_directory + 'dumps/',
	dump_directory : dump_directory,
	// 若 config.filter 非 function，表示要先比對 dump，若修訂版本號相同則使用之，否則自 API 擷取。
	// 設定 config.filter 為 ((true)) 表示要使用預設為最新的 dump，否則將之當作 dump file path。
	filter : true,
	after : finish_work
}, for_each_page);
