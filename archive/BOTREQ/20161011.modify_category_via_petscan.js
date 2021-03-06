﻿// (cd ~/wikibot && date && hostname && nohup time node 20161011.modify_category_via_petscan.js; date) >> modify_category_via_petscan/log &

/*

 2016/11/10 19:13:45	初版試營運
 2016/11/11 13:1:21	完成。正式運用。

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loader.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('ja');

/** {String}預設之編輯摘要。總結報告。編集内容の要約。 */
summary = '[[Special:Diff/61859289|Bot作業依頼]]：ポップ歌手のカテゴリ修正依頼: 性別付け - [['
		+ log_to + '|log]]';

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),

/** {revision_cacher}記錄處理過的文章。 */
processed_data = new CeL.wiki.revision_cacher(base_directory + 'processed.'
		+ use_language + '.json'),

// ((Infinity)) for do all
test_limit = 3,

category_list = [];

[ '日本', 'アメリカ合衆国' ].forEach(function(country) {
	'歌手,ロック歌手,ポップ歌手,シンガーソングライター'.split(',').forEach(function(type) {
		category_list.push(country + 'の' + type);
	});
});

// ----------------------------------------------------------------------------

// CeL.set_debug(2);

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
// prepare_directory(base_directory);

main_work(category_list, true, function() {
	main_work(category_list);
});

function main_work(template_list, need_male, callback) {
	CeL.wiki.petscan(template_list, function(items) {
		var list = items.map(function(item) {
			return item.sitelink;
		});

		CeL.log('Get ' + list.length + ' pages.');
		if (0) {
			// 設定此初始值，可跳過之前已經處理過的。
			list = list.slice(0 * test_limit, 1 * test_limit);
			CeL.log(list.slice(0, 8).map(function(page_data) {
				return CeL.wiki.title_of(page_data);
			}).join('\n') + '\n...');
		}

		var gender = need_male ? '男性' : '女性';
		wiki.work({
			gender : gender,
			// 不作編輯作業。
			// no_edit : true,
			last : callback,
			log_to : log_to,
			summary : summary + ' (' + gender + ')',
			each : for_each_page
		}, list);

	}, {
		combination : 'union',
		// [[:Category:日本のポップ歌手]]直下の記事のうちWikidataにおいて性別(P21)が女性(Q6581072)となっているもの
		sparql : 'SELECT ?item WHERE { ?item wdt:P21 wd:'
				+ (need_male ? 'Q6581097' : 'Q6581072') + ' }'
	});
}

// ----------------------------------------------------------------------------

var PATTERN_Category = /(\[\[ *(?:Category|カテゴリ) *: *(?:日本|アメリカ合衆国)の)((?:(?:ロック|ポップ)?歌手|シンガーソングライター)[\|\]\]])/ig;

function for_each_page(page_data, messages, config) {
	if (!CeL.wiki.content_of.page_exists(page_data)) {
		// error?
		return [ CeL.wiki.edit.cancel, '條目已不存在或被刪除' ];
	}

	if (page_data.ns !== 0) {
		throw '非條目:[[' + page_data.title + ']]! 照理來說不應該出現有 ns !== 0 的情況。';
	}

	/** {String}page title = page_data.title */
	var title = CeL.wiki.title_of(page_data),
	/**
	 * {String}page content, maybe undefined. 條目/頁面內容 = CeL.wiki.revision_content(revision)
	 */
	content = CeL.wiki.content_of(page_data);

	if (!content) {
		return [ CeL.wiki.edit.cancel,
				'No contents: [[' + title + ']]! 沒有頁面內容！' ];
	}

	// var parser = CeL.wiki.parser(page_data);

	content = content.replace(PATTERN_Category, function(all_category, pretext,
			posttext) {
		return pretext + config.gender + posttext;
	});

	return content;
}
