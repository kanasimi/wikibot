// cd /d D:\USB\cgi-bin\program\wiki && node check_all_pages.js

/*

 2016/3/19 21:14:6	初版試營運

 */

'use strict';

// var CeL_path = 'S:\\cgi-bin\\lib\\JS';
require('./wiki loder.js');
// for CeL.wiki.cache(), CeL.fs_mkdir()
CeL.run('application.platform.nodejs');

/** {String}base directory */
var base_directory = bot_directory + 'check_all_pages/';

// ---------------------------------------------------------------------//

// prepare directory
CeL.fs_mkdir(base_directory);

//CeL.set_debug(3);
//CeL.set_debug(6);
CeL.wiki.cache([ {
	file_name : 'title list',
	type : 'allpages'
}, {
	type : 'page',
	operator : function(page_data) {
	    var title = CeL.wiki.title_of(page_data),
	    content = CeL.wiki.content_of(page_data);
		if (content.includes('\u200E'))
			this.filtered.push(title);
	}
}, {
	file_name : 'filtered.txt',
	list : function() {
		// 於 '含有太多維護模板之頁面' 中設定。
		return this.filtered;
	}
} ], function () {}, {
	filtered : [],
	// cache path prefix
	prefix : base_directory
});
