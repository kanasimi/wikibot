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

// filtered list
filtered = [];

// ----------------------------------------------------------------------------

prepare_directory(base_directory, true);

// CeL.set_debug(6);
CeL.wiki.traversal({
	wiki : wiki,
	// cache path prefix
	directory : base_directory,
	// 若 config.filter 非 function，則將之當作 dump file path，
	// 並以 try_dump() 當作 filter()。
	filter : true,
	// 指定 dump file 放置的 directory。
	dump_directory : bot_directory + 'dumps/',
	// 取得多個頁面內容所用之 options。
	page_options : {
		rvprop : 'ids|timestamp|content'
	},
	after : function() {
		CeL.fs_write(base_directory + 'filtered.lst', filtered.join('\n'));
		if (false)
			wiki.page('User:' + user_name + '/filtered').edit(
					filtered.join('\n'));
		CeL.log(script_name + ': ' + filtered.length + ' page(s) filtered.');
	}
}, function(page_data) {
	/** {String}page title */
	var title = CeL.wiki.title_of(page_data),
	/** {String}page content, maybe undefined. */
	content = CeL.wiki.content_of(page_data);
	// var revision = page_data.revisions && page_data.revisions[0];

	if (content &&
	// content.includes('\u200E')
	/\[(?:(?:https?:)?\/\/)?[a-z]+\.wikipedia\./i.test(content)) {
		filtered.push(title);
		// filtered 太多則不顯示。
		if (filtered.length < 400)
			CeL.log(filtered.length + ': [[' + title + ']]');
	}
});
