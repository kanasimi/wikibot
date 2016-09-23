// (cd ~/wikibot && date && hostname && nohup time node 20160923.modify_link.リンク元修正.js; date) >> modify_link.リンク元修正/log &

/*

 2016/9/23 19:44:52	「Jスルーカード」のリンク修正依頼



 リンク元修正

[[title]]
[[title|
[[title (A)
[[title (B)
[[title#section title 1
[[title#section title 2
[[title#section title|

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('ja');

/** {String}預設之編輯摘要。總結報告。編集内容の要約。 */
summary = '[[Special:Diff/61129381|Bot作業依頼]]：[[Jスルーカード]]の記事名変更に伴う修正';

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),

/** {revision_cacher}記錄處理過的文章。 */
processed_data = new CeL.wiki.revision_cacher(base_directory + 'processed.'
		+ use_language + '.json'),

// ((Infinity)) for do all
test_limit = Infinity,

// [ all ]
PATTERN_TO_REPLACE = /\[\[\s*Jスルー\s*\|.*?\]\]/g;

function for_each_page(page_data, messages) {
	if (!page_data || ('missing' in page_data)) {
		// error?
		return [ CeL.wiki.edit.cancel, '條目已不存在或被刪除' ];
	}

	if (page_data.ns !== 0) {
		throw '非條目:[[' + page_data.title + ']]! 照理來說不應該出現有 ns !== 0 的情況。';
	}

	/** {String}page title = page_data.title */
	var title = CeL.wiki.title_of(page_data),
	/**
	 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
	 */
	content = CeL.wiki.content_of(page_data);

	if (!content) {
		return [ CeL.wiki.edit.cancel,
				'No contents: [[' + title + ']]! 沒有頁面內容！' ];
	}

	if (1) {
		// 首先需要檢查前後文，確認可能出現的問題!
		var matched = content.match(PATTERN_TO_REPLACE);
		if (matched) {
			matched.unshift('[[' + title + ']]:');
			CeL.log(matched.join('\n\t'));
		}
		return;
	}

	return content.replace(PATTERN_TO_REPLACE, '[[Jスルーカード]]');
}

// ----------------------------------------------------------------------------

// CeL.set_debug(2);

prepare_directory(base_directory);
// prepare_directory(base_directory, true);

CeL.wiki.cache([ {
	type : 'backlinks',
	list : 'Jスルー',
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
		each : for_each_page,
		summary : summary
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
