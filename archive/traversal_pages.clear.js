// cd ~/wikibot && date && time /shared/bin/node "traversal_pages.clear.js" && date
// Traversal all pages. 遍歷所有頁面。簡易版，用於展示概念。

/*

 初版試運行，採用模板：traversal_pages.clear.js，約耗時 ?分鐘執行。

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),

// ((Infinity)) for do all
test_limit = 3000,

/** {Array}filtered list = {Array}[ list ] */
filtered = [];

// ----------------------------------------------------------------------------

prepare_directory(base_directory);
// prepare_directory(base_directory, true);

// Set the umask to share the xml dump file.
if (typeof process === 'object') {
	process.umask(parseInt('0022', 8));
}

// CeL.set_debug(6);
CeL.wiki.traversal({
	// [SESSION_KEY]
	session : wiki,
	// cache path prefix
	directory : base_directory,
	// 指定 dump file 放置的 directory。
	// dump_directory : bot_directory + 'dumps/',
	dump_directory : dump_directory,
	// 若 config.filter 非 function，表示要先比對 dump，若修訂版本號相同則使用之，否則自 API 擷取。
	// 設定 config.filter 為 ((true)) 表示要使用預設為最新的 dump，否則將之當作 dump file path。
	filter : true,
	last : finish_traversal
}, for_each_page);

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
	/** {Object}revision data. 修訂版本資料。 */
	var revision = page_data.revisions && page_data.revisions[0];

	if (!content)
		return;

	// TODO: operations for each page
	if (0) {
		// need modify
		filtered.push(title);
	}
}

/**
 * Finish traversal. traversal 工作結束。
 */
function finish_traversal() {
	CeL.log(script_name + ': ' + filtered.length + ' page(s) filtered.');
	if (filtered.length > 0) {
		CeL.fs_write(base_directory + 'filtered.lst', filtered.join('\n'));
		// filtered = filtered.slice(0, test_limit);
		wiki.work({
			each : for_each_filtered,
			// 不作編輯作業。
			// no_edit : true,
			last : finish_work,
			log_to : log_to,
			summary : summary
		}, filtered);
	}
}

// ----------------------------------------------------------------------------

// TODO: operations for each page that filtered
function for_each_filtered(page_data) {
	;
}

/**
 * Finish up. 最後結束工作。
 */
function finish_work() {
	CeL.log('done');
}
