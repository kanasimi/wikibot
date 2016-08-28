// (cd ~/wikibot && date && hostname && nohup time node 20160828.clear_category.清空分類.js; date) >> clear_category.清空分類/log &

/*

 2016/8/28 9:4:48	將某分類下所有文章全部移出分類，清空分類文章。仮運用を行って

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('ja');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),

// ((Infinity)) for do all
test_limit = 1;

/** {String}編輯摘要。總結報告。 */
summary = '[[WP:BOTREQ]]: [[:Category:販売代理店]]の除去依頼';


// ----------------------------------------------------------------------------

function for_each_page(page_data, messages) {
	if (page_data.ns !== 0) {
		return [ CeL.wiki.edit.cancel, '記事だけを編集する' && 'skip' ];
	}

	/** {String}page title = page_data.title */
	var title = CeL.wiki.title_of(page_data),
	/**
	 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
	 */
	content = CeL.wiki.content_of(page_data);

	// @see PATTERN_category @ CeL.application.net.wiki
	return content.replace(/\[\[ *(?:Category|category|CATEGORY|分類|分类|カテゴリ) *: *販売代理店(\|[^\[\]]*)?\]\][\r\n]*/g, '');
}

// ----------------------------------------------------------------------------

prepare_directory(base_directory);

// CeL.set_debug(2);

CeL.wiki.cache([ {
	type : 'categorymembers',
	list : 'Category:販売代理店',
	reget : true,
	operator : function(list) {
		this.list = list;
	}

} ], function() {
	var list = this.list;
	// list = [ ];
	CeL.log('Get ' + list.length + ' pages.');
	if (1) {
		// 設定此初始值，可跳過之前已經處理過的。
		list = list.slice(0 * test_limit, 1 * test_limit);
		CeL.log(list.slice(0, 8).map(function(page_data) {
			return CeL.wiki.title_of(page_data);
		}).join('\n') + '\n...');
	}

	wiki.work({
		each : for_each_page,
		page_options : {
			rvprop : 'ids|content|timestamp'
		},
		last : function() {
			// Finally
		},
		summary : summary,
		log_to : log_to

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
