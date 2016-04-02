// cd ~/wikibot && date && time ../node/bin/node traversal_pages.js && date
// 遍歷所有頁面。

/*

 2016/4/1 21:16:32	初版試營運，約耗時 12分鐘執行。

 */

'use strict';

require('./wiki loder.js');
// for CeL.wiki.cache(), CeL.fs_mkdir()
CeL.run('application.platform.nodejs');

var
/** {Object}wiki 操作子. */
wiki = Wiki(true),
/** {String}base directory */
base_directory = bot_directory + script_name + '/',

/** {Array}filtered list */
filtered = [];

// ----------------------------------------------------------------------------

/**
 * 對每一個頁面都要執行的作業。
 * 
 * @param {Object}page_data
 *            page data got from wiki API. =
 *            {pageid,ns,title,revisions:[{timestamp,'*'}]}
 */
function for_each_page(page_data) {
	/** {String}page title */
	var title = CeL.wiki.title_of(page_data),
	/** {String}page content, maybe undefined. */
	content = CeL.wiki.content_of(page_data);
	// var revision = page_data.revisions && page_data.revisions[0];

	if (content &&
	// ↓ 約耗時 12分鐘執行。
	// content.includes('\u200E')
	// ↓ 約耗時 15分鐘執行。 check Wikimedia projects links
	/\[[\s\n]*(?:(?:https?:)?\/\/)?[a-z]+\.wikipedia\./i.test(content)) {
		filtered.push(title);
		// filtered 太多則不顯示。
		if (filtered.length < 400)
			CeL.log(filtered.length + ': [[' + title + ']]');

		if (false) {
			// 採用所輸入之 page data 作為 this.last_page，不再重新擷取 page。
			wiki.page(page_data).edit('');
		}
	}
}

/**
 * 最後結束工作。
 */
function finish_work() {
	CeL.fs_write(base_directory + 'filtered.lst', filtered.join('\n'));
	if (false) {
		// Write to wiki page.
		wiki.page('User:' + user_name + '/filtered').edit(filtered.join('\n'));
	}
	CeL.log(script_name + ': ' + filtered.length + ' page(s) filtered.');
}

// ----------------------------------------------------------------------------

prepare_directory(base_directory, true);

// CeL.set_debug(6);
CeL.wiki.traversal({
	wiki : wiki,
	// cache path prefix
	directory : base_directory,
	// 指定 dump file 放置的 directory。
	dump_directory : bot_directory + 'dumps/',
	// 若 config.filter 非 function，表示要先比對 dump，若版本號相同則使用之，否則自 API 擷取。
	// 設定 config.filter 為 ((true)) 表示要使用預設為最新的 dump，否則將之當作 dump file path。
	filter : true,
	after : finish_work
}, for_each_page);
