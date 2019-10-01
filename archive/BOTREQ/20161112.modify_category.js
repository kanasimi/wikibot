// (cd ~/wikibot && date && hostname && nohup time node 20161112.modify_category.js; date) >> modify_category/log &

/*

 rename category

 2016/11/12 21:27:32	初版試營運。
 2016/11/12 22:55:46	完成。正式運用。

 TODO:
 check if category exists
 check link and transclusion

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
test_limit = 2,

category_hash = Object.create(null), move_from_list;

// ----------------------------------------------------------------------------

// CeL.set_debug(2);

// current work

/** {String}預設之編輯摘要。總結報告。編集内容の要約。 */

// -------------------------------------
// archive
if (false) {
	// 2017/4/21 6:38:32
	summary = '[[Special:Diff/63725606|Bot作業依頼]]：「JXグループ」→「JXTGグループ」ほか カテゴリ変更依頼 - [['
			+ log_to + '|log]]';
	category_hash = {
		JXグループ : 'JXTGグループ',
		JXエネルギーの系列販売店 : 'JXTGエネルギーの系列販売店',
		JXグループの人物 : 'JXTGグループの人物',
		JXグループのスポーツ活動 : 'JXTGグループのスポーツ活動',
		JXグループ単独提供番組 : 'JXTGグループ単独提供番組',
		JXグループの歴史 : 'JXTGグループの歴史',
		JXグループのスポーツ関係者 : 'JXTGグループのスポーツ関係者'
	};

	// 2017/4/20 16:50:53
	summary = '[[Special:Diff/63713843|Bot作業依頼]]：「富士重工業」→「SUBARU」カテゴリ変更依頼 - [['
			+ log_to + '|log]]';
	category_hash = {
		富士重工業 : 'SUBARU',
		富士重工業の人物 : 'SUBARUの人物',
		富士重工業のエンジン : 'スバルのエンジン',
		富士重工業のディーラー : 'SUBARUのディーラー',
		富士重工業硬式野球部の選手 : 'SUBARU硬式野球部の選手',
	};

	// 2016/11/16 9:52:18
	summary = '[[Special:Diff/61947923|Bot作業依頼]]：ポップ歌手のカテゴリ修正依頼の巻き戻し - [['
			+ log_to + '|log]]';
	'Category:プエルトリコのポップ歌手 (2), Category:タイのポップ歌手 (2), Category:ミズーリ州のポップ・ミュージシャン (2), Category:コロンビアのポップ歌手 (1), Category:セネガルのポップ・ミュージシャン (2), Category:コロンビアのポップ・ミュージシャン (1), Category:ウクライナのポップ歌手 (3), Category:香港のポップ歌手 (2), Category:モンゴルのポップ歌手 (1), Category:南アフリカ共和国のポップ歌手 (1), Category:ドイツのポップ歌手 (1), Category:ニューオーリンズのポップ・ミュージシャン (3), Category:カンボジアのポップ歌手 (1), Category:ベトナムのポップ歌手 (1), Category:シンガポールのポップ歌手 (1), Category:シンガポールのポップ・ミュージシャン (1), Category:ポーランドのポップ歌手 (3), Category:バルバドスのポップ・ミュージシャン (1), Category:クロアチアのポップ・ミュージシャン (2), Category:イエメンのポップ歌手 (1), Category:ギリシャのポップ歌手 (4), Category:アルバニアのポップ歌手 (2), Category:レバノンのポップ歌手 (1), Category:ブラジルのポップ歌手 (3), Category:アイスランドのポップ歌手 (2), Category:ブラジルのポップ・ミュージシャン (3), Category:アルゼンチンのポップ歌手 (1), Category:セルビアのポップ歌手 (7), Category:クロアチアのポップ歌手 (3), Category:琉球民謡のポップ歌手 (2), Category:ルーマニアのポップ歌手 (4), Category:ノルウェーのポップ歌手 (2), Category:エストニアのポップ・ミュージシャン (2), Category:アラブのポップ歌手 (1), Category:ボスニア・ヘルツェゴビナのポップ歌手 (3), Category:ボスニア・ヘルツェゴビナのポップ・ミュージシャン (2), Category:アルメニアのポップ歌手 (1), Category:クラシカル・クロスオーバーのポップ歌手 (2), Category:スロバキアのポップ歌手 (1), Category:ウクライナのポップ・ミュージシャン (1), Category:ウクライナのポップ歌手 (1), Category:フィリピンのポップ歌手 (2), Category:マレーシアのポップ歌手 (1), Category:架空のポップ歌手 (2), Category:チェコのポップ歌手 (1), Category:中国のポップ歌手 (3), Category:ケニアのポップ歌手 (1), Category:スロバキアのポップ・ミュージシャン (1), Category:エストニアのポップ歌手 (2), Category:パキスタンのポップ歌手 (1), Category:インドネシアのポップ歌手 (3), Category:キューバのポップ歌手 (1), Category:キプロスのポップ歌手 (2), Category:モンテネグロのポップ歌手 (1), Category:チリのポップ歌手 (1), Category:ベラルーシのポップ歌手 (2), Category:キプロスのポップ・ミュージシャン (1), Category:デンマークのポップ歌手 (1), Category:サンマリノのポップ歌手 (1), Category:ニューヨーク州出身のポップ・ミュージシャン (1), Category:スロベニアのポップ歌手 (1)'
	// revert
	.split(',').forEach(
			function(category_name) {
				category_name = category_name
				//
				&& category_name.match(/Category:([^ ]+)/)[1];
				if (!category_name) {
					return;
				}
				var move_to = category_name.replace(/ポップ・?/, '');
				if (!move_to || category_name === move_to
						|| move_to.includes('ポップ')) {
					throw 'The same name: ' + category_name;
				}
				category_hash[category_name] = move_to;
				if (category_name.includes('ミュージシャン')) {
					category_hash[category_name.replace(/ポップ/, '')]
					//
					= category_name.replace(/ポップ/, '').replace(/の・ミュージシャン/,
							'のミュージシャン');
				}
			});

	// 2016/11/13 10:52:1
	summary = '[[Special:Diff/61873576|Bot作業依頼]]：日本維新の会・自由党改名にともなうカテゴリ修正依頼 - [['
			+ log_to + '|log]]';
	category_hash = {
		おおさか維新の会 : '日本維新の会 (2016-)',
		おおさか維新の会の人物 : '日本維新の会の人物 (2016-)',
		おおさか維新の会の国会議員 : '日本維新の会の国会議員 (2016-)',
		日本維新の会 : '日本維新の会 (2012-2014)',
		日本維新の会の人物 : '日本維新の会の人物 (2012-2014)',
		日本維新の会の国会議員 : '日本維新の会の国会議員 (2012-2014)',
		生活の党 : ' 自由党 (日本 2016-)',
		生活の党の人物 : ' 自由党の人物 (日本 2016-)',
		生活の党の国会議員 : ' 自由党の国会議員 (日本 2016-)'
	};

	// 2016/11/13 10:51:53 Bot依頼
	summary = '[[Special:Diff/61835577|Bot作業依頼]]：削除された韓国のアイドルのカテゴリ修正依頼 - [['
			+ log_to + '|log]]';
	category_hash = {
		韓国のアイドルグループ : '韓国の歌手グループ',
		韓国のアイドル : '韓国の歌手'
	};
}

// ----------------------------------------------------------------------------

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
prepare_directory(base_directory);

modify_category(category_hash, move_from_list);

function modify_category(category_hash, move_from_list) {
	if (!Array.isArray(move_from_list)) {
		move_from_list = Object.keys(category_hash);
	}
	move_from_list.run_serial(function(run_next, category_name, index) {
		CeL.log(index + '/' + move_from_list.length + ' Category:'
				+ category_name + ' → ' + category_hash[category_name]);
		main_work(category_name, category_hash[category_name], run_next);
	}, function(params) {
		CeL.log('All ' + move_from_list.length + ' categories done.');
	});
}

function main_work(category_name, move_to, callback) {
	// remove prefix.
	category_name = category_name.trim().replace(
			/^(?:Category|category|CATEGORY|分類|分类|カテゴリ) *: */, '');

	wiki.cache([ {
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
			minor : true,
			last : callback,
			log_to : log_to,
			summary : summary + ': [[Category:' + category_name
					+ ']] → [[Category:' + move_to + ']]',
			each : for_each_page
		}, list);

	}, {
		// default options === this
		// テンプレートなど他の名前空間のページについては必要があれば手動で修正をお願いします。また、コメントアウトされていた箇所（4記事にあります）につきましては作業を行っていませんので、こちらも必要があれば手動で修正をお願いします。
		// include File, Template, Category
		namespace : '0|6|10|14',
		// title_prefix : 'Template:',
		// cache path prefix
		prefix : base_directory
	});
}

// ----------------------------------------------------------------------------

// @see PATTERN_category @ CeL.wiki
// [ all, category_name, sort_order ]
var PATTERN_category = /\[\[ *(?:Category|分類|分类|カテゴリ) *: *([^\[\]\|]+)\s*(?:\| *(.*?))?\]\] *\n?/ig;

function for_each_page(page_data, messages, config) {
	if (!page_data || ('missing' in page_data)) {
		// error?
		return [ CeL.wiki.edit.cancel, '條目已不存在或被刪除' ];
	}

	if (page_data.ns !== 0 && page_data.ns !== 6 && page_data.ns !== 10
			&& page_data.ns !== 14) {
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

	// 已經添加過的category。
	var categories = Object.create(null);

	// 分類名稱重複時，排序索引以後出現者為主。

	content = content.replace(PATTERN_category, function(all, category_name,
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
