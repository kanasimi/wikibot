// (cd ~/wikibot && date && hostname && nohup time node 20160606.Category東京都区部出身の人物の新設作業.js; date) >> Category東京都区部出身の人物の新設作業/log &

/*

 2016/6/6 23:0:1	仮運用を行って

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
test_limit = 6,

/** {Natural}剩下尚未處理完畢的頁面數。 */
page_remains,

/** {revision_cacher}記錄處理過的文章。 */
processed_data = new CeL.wiki.revision_cacher(base_directory + 'processed.'
		+ use_language + '.json', {
	id_only : true
});

/** {String}編輯摘要。總結報告。 */
summary = '[[:Category:東京都区部出身の人物]]新設に伴う貼り変え作業';

// ----------------------------------------------------------------------------

/** {RegExp}人物出身的匹配模式。 */
var PATTERN_birth = /(?:birth|origin|生誕|誕生|出生|出身)[^=\|]*=[^=\|]*(?:世田谷|中央|中野|北|千代田|台東|品川|墨田|大田|文京|新宿|杉並|板橋|江戸川|江東|渋谷|港|目黒|練馬|荒川|葛飾|豊島|足立)区/i,
// 可能取到他人資料。 e.g., 北区出身のxxとは友達です
PATTERN_birth2 = /(?:世田谷|中央|中野|北|千代田|台東|品川|墨田|大田|文京|新宿|杉並|板橋|江戸川|江東|渋谷|港|目黒|練馬|荒川|葛飾|豊島|足立)区\]*(?:出身|生まれ)/;

function for_each_page(page_data, messages) {
	if (!page_data || ('missing' in page_data)) {
		// error?
		return [ CeL.wiki.edit.cancel, 'skip' ];
	}

	if (page_data.ns !== 0) {
		return [ CeL.wiki.edit.cancel, 'skip' ];
		return [ CeL.wiki.edit.cancel, '記事だけを編集する' ];
	}

	// Check if page_data had processed useing revid.
	if (processed_data.had(page_data)) {
		return [ CeL.wiki.edit.cancel, 'skip' ];
	}

	/** {String}page title = page_data.title */
	var title = CeL.wiki.title_of(page_data),
	/**
	 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
	 */
	content = CeL.wiki.content_of(page_data);

	if (PATTERN_birth.test(content)) {
		return content.replace(/\[\[Category:東京都出身の人物(|\])/,
				'[[Category:東京都区部出身の人物$1');
	}
}

// ----------------------------------------------------------------------------

prepare_directory(base_directory);

try {
	// delete cache.
	require('fs').unlinkSync(
			base_directory + 'categorymembers/Category_東京都出身の人物.json');
} catch (e) {
	// TODO: handle exception
}

// CeL.set_debug(2);

CeL.wiki.cache([ {
	type : 'categorymembers',
	list : 'Category:東京都出身の人物',
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

	// setup ((page_remains))
	page_remains = list.length;
	wiki.work({
		each : for_each_page,
		page_options : {
			rvprop : 'ids|content|timestamp'
		},
		last : function() {
			// Finally: Write to cache file.
			processed_data.write();
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
