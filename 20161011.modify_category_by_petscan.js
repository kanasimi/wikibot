// (cd ~/wikibot && date && hostname && nohup time node 20161011.modify_category_by_petscan.js; date) >> modify_category_by_petscan/log &

/*

 2016/11/10 19:13:45	初版試營運

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('ja');

/** {String}預設之編輯摘要。總結報告。編集内容の要約。 */
summary = '[[Special:Diff/61859289|Bot作業依頼]]：ポップ歌手のカテゴリ修正依頼 - [[' + log_to
		+ '|log]]';

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),

/** {revision_cacher}記錄處理過的文章。 */
processed_data = new CeL.wiki.revision_cacher(base_directory + 'processed.'
		+ use_language + '.json'),

// ((Infinity)) for do all
test_limit = 3;

// ----------------------------------------------------------------------------

// CeL.set_debug(2);

// prepare_directory(base_directory);

main_work([ '日本の歌手', '日本のポップ歌手', '日本のシンガーソングライター' ]);

function main_work(template_list) {
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

		wiki.work({
			gender : '女性',
			// 不作編輯作業。
			// no_edit : true,
			last : finish_work,
			log_to : log_to,
			summary : summary,
			each : for_each_page
		}, list);

	}, {
		combination : 'union',
		// [[:Category:日本のポップ歌手]]直下の記事のうちWikidataにおいて性別(P21)が女性(Q6581072)となっているもの
		sparql : 'SELECT ?item WHERE { ?item wdt:P21 wd:Q6581072 }'
	});
}

// ----------------------------------------------------------------------------

function for_each_page(page_data, messages, config) {
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

	content = content.replace(
	//
	/(\[\[ *(?:Category|カテゴリ) *: *日本の)((?:(?:ポップ)?歌手|シンガーソングライター)[\|\]\]])/g,
	//
	function(all_category, pretext, posttext) {
		return pretext + config.gender + posttext;
	});

	return content;
}

function finish_work() {
	;
}
