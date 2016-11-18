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
summary = {
	ロック : '[[Special:Diff/61558855|Bot作業依頼]]：ロック・ミュージシャンのカテゴリ修正依頼 - [['
			+ log_to + '|log]]',
	ポップ : '[[Special:Diff/61779756|Bot作業依頼]]：ポップ歌手のカテゴリ修正依頼 - [[' + log_to
			+ '|log]]'
};
summary.main = summary.ポップ;

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),

/** {revision_cacher}記錄處理過的文章。 */
processed_data = new CeL.wiki.revision_cacher(base_directory + 'processed.'
		+ use_language + '.json'),

// ((Infinity)) for do all
test_limit = 200,

// all count
count = 0,

// category_count[category] = count
category_count = CeL.null_Object(),

// カテゴリから国を判別できない音楽家
problem_list = [], no_country_found = [],

// TODO: バンド
// [ all_category, pretext, country, music_type, posttext, type ]
PATTERN_歌手 = /(\[\[ *(?:Category|カテゴリ) *: *([^\|\[\]]+)の)(?:(ロック|ポップ)・?)?((歌手|ミュージシャン|シンガーソングライター|歌手グループ|ギタリスト)\s*(?:\|\s*([^\|\[\]]*))?\]\])/ig,

// e.g., "| Genre = [[ロックンロール]]<br />[[ポップ・ミュージック]]<br />[[ロック]]"
// Genre = ロックンロール、ハードロック、パンク・ロック、ヘヴィメタルになっている人物もbotで修正して
// @see [[Template:ロック・ミュージック]]
// should add 転送ページ
// 需考慮 "[[A|B]]<br />[[ロック (音楽)|ロック]]"
PATTERN_ロック = /\| *(?:Genre|ジャンル) *=[^={}]*?\[\[ *(?:ロック(?: \(音楽\)|音楽|ミュージック)?|ロックン・?ロール|ハード・?ロック(?:バンド)?|Hard rock|パンク(・?ロック|・?バンド|ロック| \(音楽\)|音楽|ミュージック)?|バロック・?ポップ|パワー・?ポップ|Punk rock|ロンドン・?パンク|ヘヴィ・?メタル|Heavy Metal|アート・?ロック|インディー・?ロック|AOR|エクスペリメンタル・?ロック|オルタナティヴ・?ロック|ガレージロック|カントリーロック|クラウトロック|クラシック・?ロック|グラムロック|クリスチャン・?ロック|ゴシック・?ロック|サイケデリック・?ロック|サザン・?ロック|ジャズ・?ロック|シンフォニック・?ロック|スタジアム・?ロック|ストーナーロック|スペース・?ロック|ソフトロック|デジタルロック|パブロック|ピアノ・?ロック|フォークロック|ブルースロック|プログレッシヴ・?ロック|プンタ・?ロック|ポップ・?ロック|ラーガ・?ロック|ラップロック|リバプールサウンド|ロカビリー) *(?:\]\]|\|)/,
//
PATTERN_ポップ = /\| *(?:Genre|ジャンル) *=[^={}]*?\[\[ *(?:ポップ(?:・?ミュージック|音楽)?|[Pp]op music|エレクトロ・?ポップ|シンセ・?ポップ|ソフィスティ・?ポップ|ダンス・?ポップ|ティーン・?ポップ|バブルガム・?ポップ|バロック・?ポップ|パワー・?ポップ|ユーロ・?ポップ|ラテン・?ポップ|J-POP|K-POP) *(?:\]\]|\|)/,

countries = '日本|アメリカ|イギリス'.split('|');

function add_category(content, added, category) {
	if (added.includes(category)) {
		// 已經有此category。Skip.
		return '';
	}
	if (content.includes(category)) {
		// 已經有此category。Skip.
		return '';
	}
	// CeL.log('add_category: ' + category);

	added.push(category);
	var normalized = category.replace(/^\[\[ *Category *: */ig, '[[Category:');
	if (category in category_count) {
		category_count[normalized]++
	} else {
		category_count[normalized] = 1;
	}
	return category;
}

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

	var replace_type = PATTERN_ロック.test(content) ? 'ロック' : PATTERN_ポップ
			.test(content) ? 'ポップ' : '';

	if (!replace_type) {
		// Genre NOT ロック/ポップ
		return [ CeL.wiki.edit.cancel, 'skip' ];
	}

	++count;

	content = content.replace(/(\| *Genre *=[^=\|{}]*?\[\[ *ロック) *(\]\]|\|)/,
	// fix disambiguation page [[ロック]]
	function(all, previous, following) {
		if (following === '|') {
			// [[ロック|...]] → [[ロック (音楽)|...]]
			return previous + ' (音楽)' + following;
		}
		// assert: following === ']]'
		// [[ロック]] → [[ロック (音楽)|ロック]]
		return previous + ' (音楽)|ロック' + following;
	}).replace(/(\| *Genre *=[^=\|{}]*?\[\[ *ポップ) *(\]\]|\|)/,
	// fix disambiguation page [[ポップ]]
	function(all, previous, following) {
		if (following === '|') {
			// [[ポップ|...]] → [[ポップ・ミュージック|...]]
			return previous + '・ミュージック' + following;
		}
		// assert: following === ']]'
		// [[ポップ]] → [[ポップ・ミュージック|ポップ]]
		return previous + '・ミュージック|ポップ' + following;
	});

	var main_country, error,
	// 已經添加過的category。
	added = [];
	content = content.replace(PATTERN_歌手,
	//
	function(all_category, pretext, country, music_type, posttext, type) {
		// CeL.log('[[' + title + ']]: ');
		// console.log(all_category);

		if (error) {
			// skip.
			return all_category;
		}
		if (countries ? !countries.includes(country)
		// not country. 国ではない。
		// e.g., 'アメリカ先住民', アフリカ系アメリカ人, ECMレコード, GRPレコード
		: /(?:[人民]|レコード|州)$/.test(country)) {
			return all_category;
		}
		if (main_country && main_country !== country) {
			error = '複数の国を含んでいる: ' + main_country + ',' + country;
			return all_category;
		}

		main_country = country;

		// 去掉沒有這個Category的情況
		if (replace_type !== 'ポップ' && type !== '歌手' && type !== 'ミュージシャン')) {
			return all_category;
		}

		if (music_type) {
			if (music_type !== replace_type) {
				// 複合ジャンルなので両方つけます。
				music_type = add_category(content, added, all_category.replace(
						music_type, replace_type));
				if (music_type) {
					all_category += '\n' + music_type;
				}
			} else {
				// 已處理: category已包含music_type。
			}
			return all_category;
		}

		if (type === 'シンガーソングライター') {
			music_type = add_category(content, added, all_category.replace(
					'シンガーソングライター', replace_type + '歌手'));
			if (music_type) {
				all_category += '\n' + music_type;
			}
			return all_category;
		}
		if (type === '歌手グループ') {
			// Category:日本の歌手グループ → Category:日本のポップ・グループ
			music_type = add_category(content, added, pretext + 'ポップ・グループ]]');
			return music_type;
		}
		return add_category(content, added, pretext
				+ (music_type || replace_type + (type === '歌手' ? '' : '・'))
				+ posttext);
	});

	if (!error && !main_country
	// e.g., [[Category:日本のロック・バンド]]
	&& !(replace_type === 'ロック' ? /のロック・バンド *(\]\]|\|)/
	//
	: /のポップ・バンド *(\]\]|\|)/).test(content)) {
		no_country_found.push(title);
		error = no_country_found;
	}

	if (error) {
		if (error !== no_country_found) {
			// error: skip edit.
			problem_list.push(': ' + count + ' [[' + title + ']]: ' + error);
		}
		// 後で報告
		return [ CeL.wiki.edit.cancel, 'skip' ];
	}

	this.summary = summary[replace_type];
	return content;
}

function finish_work() {
	if (count > 0) {
		var messages = [ '; カテゴリから国を判別できない音楽家或いはバンド: '
		//
		+ (problem_list.length + no_country_found.length) + '/' + count,
				problem_list.join('\n') ],
		//
		categories = Object.keys(category_count);

		if (no_country_found.length > 0) {
			messages.push('', '; 国別の歌手のカテゴリを含んでいない (' + no_country_found.length
					+ '):',
			//
			': ' + no_country_found.map(function(t) {
				return '[[' + t + ']]';
			}).join(', '));
		}

		if (categories.length > 0) {
			messages.push('', '; 増設したカテゴリ ('
			//
			+ categories.length + '):', ': ' + categories.map(function(c) {
				// 去掉 category sort key
				var category_name = c.match(/\[\[([^\[\]\|]+)/)[1];
				return '{{#ifexist:' + category_name + '||[[:'
				//
				+ category_name + ']] (' + category_count[c] + '),}}';
			}).join(' ')) + '(存在していないカテゴリのみ表示します)';
		}

		wiki.page(log_to).edit(messages.join('\n'), {
			section : 'new',
			sectiontitle : '作業結果報告',
			nocreate : 1,
			bot : 1
		});
	}
}

// ----------------------------------------------------------------------------

// CeL.set_debug(2);

prepare_directory(base_directory);

// console.log(all_properties_array.join(','));
CeL.wiki.cache([ {
	// Template:Infobox Musicianが使用されている記事
	// type : 'embeddedin',
	// list : 'Template:Infobox Musician',

	// Category:日本の歌手グループにある記事
	type : 'categorymembers',
	list : 'Category:日本の歌手グループ',

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
		summary : summary.main,
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
