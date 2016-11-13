// (cd ~/wikibot && date && hostname && nohup time node 20161112.modify_category.js; date) >> modify_category/log &

/*

 2016/11/12 21:27:32	初版試營運
 2016/11/12 22:55:46	完成。正式運用。

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('ja');

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

// 2016/11/13 10:52:1
/** {String}預設之編輯摘要。總結報告。編集内容の要約。 */
summary = '[[Special:Diff/61873576|Bot作業依頼]]：日本維新の会・自由党改名にともなうカテゴリ修正依頼 - [['
		+ log_to + '|log]]';
modify_category({
	おおさか維新の会 : '日本維新の会 (2016-)',
	おおさか維新の会の人物 : '日本維新の会の人物 (2016-)',
	おおさか維新の会の国会議員 : '日本維新の会の国会議員 (2016-)',
	日本維新の会 : '日本維新の会 (2012-2014)',
	日本維新の会の人物 : '日本維新の会の人物 (2012-2014)',
	日本維新の会の国会議員 : '日本維新の会の国会議員 (2012-2014)',
	生活の党  : ' 自由党 (日本 2016-)',
	生活の党の人物  : ' 自由党の人物 (日本 2016-)',
	生活の党の国会議員  : ' 自由党の国会議員 (日本 2016-)'
});


if (false) {
	// 2016/11/13 10:51:53
	summary = '[[Special:Diff/61835577|Bot作業依頼]]：削除された韓国のアイドルのカテゴリ修正依頼 - [['
			+ log_to + '|log]]';
	modify_category({
		韓国のアイドルグループ : '韓国の歌手グループ',
		韓国のアイドル : '韓国の歌手'
	});
}

function modify_category(category_hash) {
	var move_from = Object.keys(category_hash), index = 0;
	function modify_next () {
		if (index === move_from.length) {
			CeL.info('All ' + move_from.length + ' categories done.');
			return;
		}
		var category_name = move_from[index++];
		CeL.info(category_name + ' → ' + category_hash[category_name]);
		main_work(category_name, category_hash[category_name], modify_next);
	}
	modify_next ();
}

function main_work(category_name, move_to, callback) {
	// remove prefix.
	category_name = category_name.trim().replace(
			/^(?:Category|category|CATEGORY|分類|分类|カテゴリ) *: */, '');

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
			category_name : category_name,
			move_to : move_to,
			// 不作編輯作業。
			// no_edit : true,
			last : callback,
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
}

// ----------------------------------------------------------------------------

// [ all, category_name, sort_order ]
var PATTERM_category = /\[\[ *(?:Category|分類|分类|カテゴリ) *: *([^\[\]\|]+)\s*(?:\| *(.*?))?\]\] *\n?/ig;

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

	// 已經添加過的category。
	var categories = CeL.null_Object();

	content = content.replace(PATTERM_category, function(all, category_name,
			sort_order) {
		category_name = category_name.trim();
		// 檢查是否有重複，若有則去除之。 重複カテゴリ除去。 bug: 將會lose sort_order
		if (category_name in categories) {
			// 已經有此category。Skip.
			return '';
		}
		// register.
		categories[category_name] = true;
		if (category_name === config.category_name) {
			if (config.move_to) {
				return '[[Category:' + config.move_to
						+ (sort_order ? '|' + sort_order : '') + ']]\n';
			}
			// 未設定 config.move_to 則當作刪除。
			return '';
		}
		return all;
	});

	return content;
}
