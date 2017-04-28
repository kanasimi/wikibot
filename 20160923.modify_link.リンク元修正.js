/*

 2016/9/23 19:44:52	「Jスルーカード」のリンク修正依頼
 2016/9/23 21:28:36	完成。正式運用。轉成常態性工具。


 リンク元修正

 [[title]]
 [[title|
 [[title (A)
 [[title (B)
 [[title#section title 1
 [[title#section title 2
 [[title#section title|

 [[title]] of ABC → [[title of ABC]]


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
test_limit = Infinity,

diff_id = 61129381,

// [ all ]
PATTERN_TO_REPLACE
// = /\[\[\s*Jスルー\s*(?:#[^\[\]\#\|]*)?(?:\|[^\[\]\#\|]*)?\]\]/g,
// = /\[\[\s*Jスルー\s*(?:#[^\[\]\#\|]*)?\|[^\[\]\#\|]*\]\](\s*カード)?/g,
= /\[\[\s*Jスルー\s*(?:#[^\[\]\#\|]*)?\]\](\s*カード)?/g,

replace_to = '[[Jスルーカード]]';

/** {String}預設之編輯摘要。總結報告。編集内容の要約。 */
summary = '[[' + (diff_id ? 'Special:Diff/' + diff_id : 'WP:BOTREQ')
		+ '|Bot作業依頼]]：[[Jスルーカード]]の記事名変更に伴うリンクの修正 - [[' + log_to + '|log]]';
// 改名に伴うリンクの修正

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

	// var parser = CeL.wiki.parser(page_data);

	if (0) {
		// リンク元の調査。首先需要檢查前後文，確認可能出現的問題！
		var matched = content.match(PATTERN_TO_REPLACE);
		if (matched) {
			matched = matched.map(function(all) {
				return all.replace(PATTERN_TO_REPLACE,
						typeof replace_to === 'function' ? function(all) {
							return all + '\t→\t' + replace_to(all);
						} : all + '\t→\t' + replace_to);
			});
			matched.unshift('[[' + title + ']]:');
			CeL.log(matched.join('\n\t'));
		}
		return;
	}

	return content.replace(PATTERN_TO_REPLACE, replace_to);
}

// ----------------------------------------------------------------------------

// CeL.set_debug(2);

prepare_directory(base_directory);

CeL.wiki.cache([ {
	type : 'backlinks',
	list : 'Jスルー',
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
