// (cd ~/wikibot && date && hostname && nohup time node 20160714.archive_news.js; date) >> archive_news/log &

/*


 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'news');

// ----------------------------------------------------------------------------

prepare_directory(base_directory);

// CeL.set_debug(2);

CeL.wiki.cache([ {
	type : 'categorymembers',
	list : 'Category:published',
	reget : true,
	operator : function(list) {
		this.published = list;
	}

}, {
	type : 'categorymembers',
	list : 'Category:archived',
	reget : true,
	operator : function(list) {
		this.archived = list;
	}

} ], function() {
	// 取差集: 從比較小的來處理。
	CeL.get_set_complement(this.published, this.archived);

	console.log(this.archived);
	console.log(this.published);
	throw 1;

	var list = this.list;
	// list = [ '' ];
	CeL.log('Get ' + list.length + ' pages.');
	if (0) {
		CeL.log(list.slice(0, 8).map(function(page_data, index) {
			return index + ': ' + CeL.wiki.title_of(page_data);
		}).join('\n') + '\n...');
		// 設定此初始值，可跳過之前已經處理過的。
		list = list.slice(0 * test_limit, 1 * test_limit);
	}

	// setup ((page_remains))
	page_remains = list.length;
	wiki.work({
		no_edit : true,
		each : for_each_page,
		page_options : {
			rvprop : 'ids|content|timestamp'
		}

	}, list);

}, {
	// default options === this
	namespace : 0,
	// [SESSION_KEY]
	session : wiki,
	// title_prefix : 'Template:',
	// cache path prefix
	prefix : base_directory
});
