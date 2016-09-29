/*

 2016/8/28 9:4:48	將某分類下所有文章全部移出分類，清空分類文章。仮運用を行って
 2016/8/29 19:42:21	轉成常態性工具。

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

var category_name = process.argv[2];
if (!category_name) {
	CeL.err('No category name specified!');
	process.exit(1);
}

category_name = category_name.trim().replace(
		/^(?:Category|category|CATEGORY|分類|分类|カテゴリ) *: */, '');

// @see PATTERN_category @ CeL.application.net.wiki
var PATTERM_matched = /\[\[ *(?:Category|category|CATEGORY|分類|分类|カテゴリ) *: *name(\|[^\[\]]*)?\]\][\r\n]*/g;
PATTERM_matched = new RegExp(PATTERM_matched.source.replace(/name/,
		category_name), PATTERM_matched.flags);

/** {String}編輯摘要。總結報告。 */
summary = '[[WP:BOTREQ|Bot作業依頼]]：[[:Category:' + category_name + ']]の除去依頼';

// ----------------------------------------------------------------------------

function for_each_page(page_data, messages) {
	if (page_data.ns !== 0
	// category : 14 子分類
	&& page_data.ns !== 14) {
		return [ CeL.wiki.edit.cancel, '記事だけを編集する' && 'skip' ];
	}

	/** {String}page title = page_data.title */
	var title = CeL.wiki.title_of(page_data),
	/**
	 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
	 */
	content = CeL.wiki.content_of(page_data);

	return content.replace(PATTERM_matched, '');
}

// ----------------------------------------------------------------------------

prepare_directory(base_directory);

// CeL.set_debug(2);

CeL.wiki.cache([ {
	type : 'categorymembers',
	list : 'Category:' + category_name,
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
	// namespace : 0,
	// [SESSION_KEY]
	session : wiki,
	// title_prefix : 'Template:',
	// cache path prefix
	prefix : base_directory
});
