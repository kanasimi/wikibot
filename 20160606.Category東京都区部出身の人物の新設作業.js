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
test_limit = 1000,

/** {revision_cacher}記錄處理過的文章。 */
processed_data = new CeL.wiki.revision_cacher(base_directory + 'processed.'
		+ use_language + '.json', {
	id_only : true
});

/** {String}編輯摘要。總結報告。 */
summary = '[[WP:BOTREQ]]: [[:Category:東京都区部出身の人物]]新設に伴う貼り変え作業';

// ----------------------------------------------------------------------------

// TODO: " 出生地 = {{flagicon|JPN}} [[東京府]][[東京市]][[蒲田区]]"
/** {RegExp}人物出身的匹配模式。 */
var PATTERN_birth = /(?:birth|origin|生誕|生地|誕生|出生|出身)[^=\|]*=[^=\|]*(?:(?:下谷区|世田谷区|中野区|京橋区|北豊島郡|千代田区|南葛飾郡|南足立郡|台東区|向島区|品川区|四谷区|墨田区|大森区|大田区|小石川区|文京区|新宿区|日本橋区|本所区|本郷区|杉並区|東京市|板橋区|江戸川区|江東区|浅草区|淀橋区|深川区|渋谷区|滝野川区|牛込区|王子区|目黒区|砧村|神田区|練馬区|荏原区|荒川区|葛飾区|蒲田区|豊多摩郡|豊島区|赤坂区|足立区|麹町区|麻布区)|東京府\)\|(?:六郷町|千歳村|大井町|大崎町|大森町|松沢村|池上町|玉川村|目黒町)|東京都\)\|(?:中央区|北区|城東区|港区)|\[\[(?:世田ヶ谷町|入新井町|品川町|東調布町|矢口町|碑衾町|羽田町|芝区|荏原町|蒲田町|馬込町|駒沢町))\]\]/i,
// 可能取到他人資料。 e.g., 北区出身のxxとは友達です
PATTERN_birth2 = /(?:(?:下谷区|世田谷区|中野区|京橋区|北豊島郡|千代田区|南葛飾郡|南足立郡|台東区|向島区|品川区|四谷区|墨田区|大森区|大田区|小石川区|文京区|新宿区|日本橋区|本所区|本郷区|杉並区|東京市|板橋区|江戸川区|江東区|浅草区|淀橋区|深川区|渋谷区|滝野川区|牛込区|王子区|目黒区|砧村|神田区|練馬区|荏原区|荒川区|葛飾区|蒲田区|豊多摩郡|豊島区|赤坂区|足立区|麹町区|麻布区)|東京府\)\|(?:六郷町|千歳村|大井町|大崎町|大森町|松沢村|池上町|玉川村|目黒町)|東京都\)\|(?:中央区|北区|城東区|港区)|\[\[(?:世田ヶ谷町|入新井町|品川町|東調布町|矢口町|碑衾町|羽田町|芝区|荏原町|蒲田町|馬込町|駒沢町))\]\](?:誕生|出生|出身|生まれ)/;

function for_each_page(page_data, messages) {
	if (!page_data || ('missing' in page_data)) {
		// error?
		return [ CeL.wiki.edit.cancel, 'skip' ];
	}

	// Check if page_data had processed useing revid.
	if (processed_data.had(page_data)) {
		return [ CeL.wiki.edit.cancel, 'skip' ];
	}

	if (page_data.ns !== 0) {
		processed_data.data_of(page_data);
		return [ CeL.wiki.edit.cancel, '記事だけを編集する' && 'skip' ];
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

	// 注意: 只有經過 .data_of() 的才造出新實體。
	// 因此即使沒有要取得資料，也需要呼叫一次 .data_of() 以造出新實體、登記 page_data 之 revid。
	processed_data.data_of(page_data);

	var matched = content.match(PATTERN_birth2);
	if (matched) {
		return [ CeL.wiki.edit.cancel,
				matched[0].replace(/^(.+)\|/, '').replace(/\]+/g, '') + '？' ];
	}

	return [ CeL.wiki.edit.cancel, 'skip' ];
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
