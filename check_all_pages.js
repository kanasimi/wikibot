// cd ~/wikibot && time node check_all_pages.js

/*

 2016/3/19 21:14:6	初版試營運

 */

'use strict';

// var CeL_path = 'S:\\cgi-bin\\lib\\JS';
require('./wiki loder.js');
// for CeL.wiki.cache(), CeL.fs_mkdir()
CeL.run('application.platform.nodejs');

var
/** {Object}wiki 操作子. */
wiki = Wiki(true),
/** {String}base directory */
base_directory = bot_directory + 'check_all_pages/';

// ---------------------------------------------------------------------//

// prepare directory
CeL.fs_mkdir(base_directory);

// CeL.set_debug(3);
// CeL.set_debug(6);

CeL.wiki.cache({
	file_name : 'title list',
	type : 'allpages',
	operator : function(list) {
		CeL.log('All ' + list.length + ' pages.');
		return this.all_list = list;
	}
}, function() {
	var filtered = [];
	wiki.work({
		no_message : true,
		no_edit : true,
		each : function(page_data, messages) {
			/** {String}page title */
			var title = CeL.wiki.title_of(page_data),
			/** {String}page content */
			content = CeL.wiki.content_of(page_data);
			if (content.includes('\u200E'))
				filtered.push(title);
		},
		after : function(messages, titles, pages) {
			CeL.fs_write(base_directory + 'filtered.txt', filtered);
			CeL.log('check_all_pages: Done.');
		}
	}, this.all_list);
}, {
	// cache path prefix
	prefix : base_directory
});

// --------------------------

// deprecated: 警告: 耗時過長而不實際。
if (false)
	CeL.wiki.cache([ {
		file_name : 'title list',
		type : 'allpages'
	}, {
		type : 'page',
		// 當設定 operation.cache: false 時，不寫入 cache。
		cache : false,
		operator : function(page_data) {
			/** {String}page title */
			var title = CeL.wiki.title_of(page_data),
			/** {String}page content */
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
	} ], function() {
		CeL.log('check_all_pages: Done.');
	}, {
		filtered : [],
		// cache path prefix
		prefix : base_directory
	});
