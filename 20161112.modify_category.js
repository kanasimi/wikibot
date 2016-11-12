// (cd ~/wikibot && date && hostname && nohup time node 20161011.modify_category.ロック・ミュージシャンのカテゴリ修正依頼.js; date) >> modify_category.ロック・ミュージシャンのカテゴリ修正依頼/log &

/*

 2016/10/11	初版試營運
 2016/10/17 19:26:52	完成。正式運用。
 2016/11/3 19:8:56	adapt to ポップ歌手のカテゴリ修正依頼

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('ja');

/** {String}預設之編輯摘要。總結報告。編集内容の要約。 */
summary = '[[Special:Diff/61835577|Bot作業依頼]]：削除された韓国のアイドルのカテゴリ修正依頼 - [['
			+ log_to + '|log]]';

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),

/** {revision_cacher}記錄處理過的文章。 */
processed_data = new CeL.wiki.revision_cacher(base_directory + 'processed.'
		+ use_language + '.json'),

// ((Infinity)) for do all
test_limit = 2;

// ----------------------------------------------------------------------------

// CeL.set_debug(2);

prepare_directory(base_directory);

// console.log(all_properties_array.join(','));
CeL.wiki.cache([ {
	type : 'categorymembers',
	list : 'Category:' + category_name,
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
		last : finish_work,
		log_to : log_to,
		summary : summary,
		each : for_each_page
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

// ----------------------------------------------------------------------------

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

	return content;
}

function finish_work() {
	;
}
