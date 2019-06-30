/**
 * @name 20170105.「Category○○県の組織」への改名提案テンプレートの貼付け.js
 * @since 2017/1/5 19:57:49
 */

'use strict';

// Load CeJS library and modules.
require('./wiki loader.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('ja');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),

// ((Infinity)) for do all
test_limit = 2;

// ----------------------------------------------------------------------------

// CeL.set_debug(2);

/** {String}預設之編輯摘要。總結報告。編集内容の要約。 */
//
summary = '[[Special:Diff/62443420|Bot作業依頼]]：「Category:○○県の組織」への改名提案テンプレートの貼付け - [['
		+ log_to + '|log]]';

// ----------------------------------------------------------------------------

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
prepare_directory(base_directory);

wiki.cache([ {
	type : 'categorymembers',
	list : 'Category:日本の組織 (都道府県別)',
	reget : true,
	operator : function(list) {
		this.list = list;
	}

} ], function() {
	var list = this.list;
	// list = [ '' ];
	CeL.log('Get ' + list.length + ' pages.');
	if (0) {
		// 設定此初始值，可跳過之前已經處理過的。
		list = list.slice(0 * test_limit, 1 * test_limit);
		CeL.log(list.slice(0, 8).map(function(page_data) {
			return CeL.wiki.title_of(page_data);
		}).join('\n') + '\n...');
	}

	wiki.work({
		// 不作編輯作業。
		// no_edit : true,
		log_to : log_to,
		summary : summary,
		each : for_each_page
	}, list);

}, {
	// default options === this
	namespace : 'Category',
	// title_prefix : 'Template:',
	// cache path prefix
	prefix : base_directory
});

function for_each_page(page_data) {
	/** {String}page title = page_data.title */
	var title = CeL.wiki.title_of(page_data),
	// [ , 元のカテゴリの都道府県名 ]
	matched = title.match(/^Category:(.+)の組織$/);
	if (!matched) {
		return;
	}

	var
	/**
	 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
	 */
	content = CeL.wiki.content_of(page_data);

	if (!content) {
		return [ CeL.wiki.edit.cancel,
				'No contents: [[' + title + ']]! 沒有頁面內容！' ];
	}

	if (/{{\s*改名提案/.test(content)) {
		return [ CeL.wiki.edit.cancel, 'Already has {{tl|改名提案}}' ];
	}

	return '{{改名提案|Category:' + matched[1]
			+ '所在の組織|t=Category talk:日本の組織 (都道府県別)|{{subst:DATE}}}}\n'
			+ content;
}
