﻿// (cd ~/wikibot && date && hostname && nohup time node 20160414.import_label_from_wiki_link.js use_language=ja; date) >> import_label_from_wiki_link/log &

/*

 ** 修改過錯誤文章後，必須先刪除cache才能避免重複發生錯誤。

 base_directory/
 all_pages.*.json	存有當前語言維基百科當前所有的頁面id以及最新版本 (*:當前語言)
 common_title.json	存有所有語言常用標題之資料維基數據
 common_title.*.json	存有當前語言常用標題 pattern (*:當前語言)
 labels.*.csv	存有當前語言維基百科所獲得之跨語言標籤資料，一行一個標籤 (*:當前語言)
 labels.*.json	存有當前語言維基百科所獲得，已經過統整之跨語言標籤資料 (*:當前語言)
 processed.*.json	存有當前語言維基百科已經處理過之頁面標題以及版本 (*:當前語言)


 2016/4/14 22:57:45	初版試營運，約耗時 18分鐘執行（不包含 modufy Wikidata，parse and filter page）。約耗時 105分鐘執行（不包含 modufy Wikidata）。
 2016/5/28	開始處理日語的部分。
 2016/6/17	開始處理從文章的開頭部分[[WP:LEAD|導言章節]]辨識出本地語言部分。
 2016/6/19 6:3:1	常態性運行。


 TODO:
 自 redirect 獲取 alias。
 parse [[西利西利]]山（Mauga Silisili）
 [[默克公司]]（[[:en:Merck & Co.|Merck & Co.]]） → [[默克藥廠]]
 [[哈利伯顿公司]]（[[:en:Halliburton|Halliburton]]） → [[哈里伯顿]]
 [[亨利·弗拉格勒]]（{{lang-en|Henry Flager}}）
 [[氣泡核融合]]（{{lang|en|bubble fusion}}）
 [[史帝夫·賈維森]]（{{lang|en|[[:en:Steve Jurvetson|Steve Jurvetson]]}}）
 “[[超越爱因斯坦]]”（beyond Einstein program）
 遊戲設計者[[艾德·格林伍德]](Ed Greenwood)所創造。
 美國白皮鬆 → 美國白皮松
 相撲力士鬆太郎 → 相撲力士松太郎
 一千個小醜 → 一千個小丑
 Q1148511
 KC&amp;ザ・サンシャイン・バンド
 列表: Q11597589
 {{仮リンク|民主党 (キプロス){{!}}民主党|en|Democratic Party (Cyprus)}}
 https://www.wikidata.org/wiki/Special:AbuseLog?wpSearchUser=Cewbot&wpSearchTitle=&wpSearchFilter=90

 蜂 (喜劇) → label 蜂 + 説明 喜劇
 蜂 (曖昧さ回避), 蜂 (曖昧さ) → label 蜂
 焼く (調理) | オスマン・サファヴィー戦争 (1623年–1639年) | 陸軍少将 (イギリス) | パンパン (マレー王朝) | リセット (筒井哲也)
 追憶 (1941年の映画)

 https://www.wikidata.org/wiki/Special:Contributions/Cewbot?uselang=zh-tw
 https://www.wikidata.org/w/index.php?title=Special:AbuseLog&offset=&limit=500&wpSearchUser=Cewbot&wpSearchTitle=&wpSearchFilter=69
 https://www.wikidata.org/w/index.php?title=Special:RecentChanges&hideminor=1&hidebots=0&hideanons=1&hideliu=1&hidemyself=1&days=30&limit=500&tagfilter=wikisyntax
 https://www.wikidata.org/wiki/Special:AbuseLog?wpSearchUser=cewbot

 OK:
 [[:en:Urban agriculture|城市農業]]	[[都市農業]]
 [[:en:Time 100: The Most Important People of the Century|时代100：本世纪最重要的人]] [[时代100人：本世纪最重要的人物]]
 [[:en:William Sadler (actor)|威廉·桑德勒]]	[[威廉·托马斯·桑德勒]]
 [[:en:Clancy Brown|克藍西·布朗]]	[[克蘭西·布朗]]
 [[:en:Gil Bellows|吉爾·貝羅斯]]	[[吉爾·貝羅斯]]
 [[莫斯科]]的[[:en:State Historical Museum|國立歷史博物館]]]]	[[莫斯科]]的[[俄羅斯國家歷史博物館]]]]
 [[:en:Pride Week (Toronto)|同性戀自豪節]]	[[骄傲周|同性戀自豪節]]
 [[:en:Wilmslow|威姆斯洛]]	[[威姆斯洛]]
 [[:en:Peshmerga|自由斗士]]	[[佩什梅格|自由斗士]]
 [[:en:Jean-François Lyotard|利奥塔]]	[[让-弗朗索瓦·利奥塔]]
 [[:en:Alexander II of Epirus|亞歷山大二世]]	[[亞歷山大二世 (伊庇魯斯)|亞歷山大二世]]
 [[:en:Taranto|塔蘭托]]	[[塔兰托]]
 [[:en:Piano Concerto No. 2 (Shostakovich)|F大調第2號鋼琴協奏曲]]	[[第2號鋼琴協奏曲 (蕭士達高維契)|F大調第2號鋼琴協奏曲]]
 [[:en:John Flamsteed|弗拉姆斯蒂德]]	[[約翰·佛蘭斯蒂德]]
 [[:en:Samuel Pepys|塞缪尔·匹普斯]]	[[塞缪尔·皮普斯]]
 [[:en:Royal Observatory, Edinburgh|爱丁堡皇家天文台]]	[[愛丁堡皇家天文台]]
 [[:en:Magdalen College, Oxford|牛津大学莫德林学院]]旧图书	[[牛津大学莫德林学院]]旧图书馆
 [[:en:2006 Chinese Grand Prix|2006年中国大奖赛]]	[[2006年中国大奖赛]]
 [[:en:2012 Brazilian Grand Prix|2012年巴西大奖赛]]	[[2012年巴西大奖赛]]
 [[:en:Kármán line|卡門線]]	[[卡門線]]
 [[:en:Colchis|科爾基斯]]	[[科爾基斯]]
 [[:en:Benetton Formula|贝纳通车队]]	[[贝纳通车队]]
 [[:en:List of Romanian counties by population|排名羅馬尼亞第一]]	[[羅馬尼亞各縣人口列表|排名羅馬尼亞第一]]
 [[:en:7400 series|7400系列]]	[[7400系列]]
 *[[馬來西亞]]之[[:en:Law of Malaysia|法律]]	*[[馬來西亞]]之[[马来西亚法律制度|法律]]
 獲得'''[[:en:Institute of Engineering Education Taiwan|IEET認證]]'''	獲得'''[[中華工程教育學會|IEET認證]]'''
 [[:en:German Labour Front|德意志勞動者陣線]]（1933~1945）{{en}}	[[德意志劳工阵线|德意志勞動者陣線]]（1933~1945）{{en}}
 其他的[[:en:Alien language|外星語言]]{{en icon}}	其他的[[宇宙语言学|外星語言]]{{en icon}}

 NG:
 *《[[兄弟情人]]》（[[:en:From Beginning to End|''Do Começo ao Fim'']]），巴西（2009）	*《[[兄弟情人]]》（[[兄弟情人|''Do Começo ao Fim'']]），巴西（2009）
 [[:en:Atropatene|亞特羅巴特那]]	[[阿特羅帕特尼王國|亞特羅巴特那]]
 [[:en:Sheba|賽佰邑（示巴）]]	[[示巴王國|賽佰邑（示巴）]]
 [[:en:Walking with Monsters|與巨獸共舞]]	[[与巨兽同行|與巨獸共舞]]
 [[马克萨斯群岛]] Îles Marquises（也称“[[:en:Marquesas Islands|侯爵夫人群岛]]”）
 ::1984年起[[朝日電視台]]曾播放[[:ja:ナイトライダー|霹靂遊俠]]
 美国[[科罗拉多学院]]（[[:en:Colorado College|Colorado College]]）。	美国[[科罗拉多学院]]（[[科羅拉多學院]]）。
 詳細人物列表請見[[:en:List of Nobel laureates by university affiliation|英文條目：各個大學的諾貝爾得獎主人物列表]]。	詳細人物列表請見[[各大學諾貝爾獎得主列表|英文條目：各個大學的諾貝爾得獎主人物列表]]。
 見[[連鐵]]或[[:ja:大連都市交通|大連電氣鐵道]]。	見[[連鐵]]或[[連鐵|大連電氣鐵道]]。
 Q955618: [[en:Sentosa Express]]: {"zh-hant":["<small>'''聖淘沙捷運<br>（Sentosa Express）'''</small>"],"zh-cn":["<small>'''圣淘沙捷运<br>（Sentosa Express）'''</small>"]}
 Q3827723
 Q700499
 [[:en:Mercedes Simplex|メルセデス・シンプレックス〈英語版〉]]
 Q3311832 はLabelが間違っています。

 不當使用:
 [[:en:Gambier Islands|甘比爾]]群島	[[甘比爾群島]]群島
 [[:en:Gambier Islands|甘比爾]]島	[[甘比爾群島]]島
 並同時包括鄰近的一些小島嶼和一塊在大陸上的[[:en:Marble Hill, Manhattan|飛地]]。	並同時包括鄰近的一些小島嶼和一塊在大陸上的飛地[[大理石山]]。

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');
// 在非 Windows 平台上避免 fatal 錯誤。
CeL.env.ignore_COM_error = true;
// load module for CeL.CN_to_TW('简体')
CeL.run('extension.zh_conversion');
// for CeL.test(), CeL.assert()
CeL.run('application.debug.log');

// Set default language. 改變預設之語言。 e.g., 'zh'
// set_language('ja');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),

// for debug specified pages. 只處理此一頁面。僅測試此單一頁面上的跨語言連結。
test_the_page_only = "",

/** {Natural}所欲紀錄的最大筆數。 */
log_limit = 1000,
// ((Infinity)) for do all.
test_limit = Infinity,

raw_data_file_name = 'labels.' + CeL.wiki.site_name(wiki) + '.csv', raw_data_file_path = base_directory
		+ raw_data_file_name,
//
raw_data_file_stream,

en_label_list = [],

// 是否要使用Wikidata數據來清理跨語言連結。
modify_Wikipedia = false;

// ----------------------------------------------------------------------------

var
/** {Number}未發現之index。 const: 基本上與程式碼設計合一，僅表示名義，不可更改。(=== -1) */
NOT_FOUND = ''.indexOf('_'),

is_zh = use_language === 'zh', is_CJK = is_zh || use_language === 'ja',
// label_data['foreign_language:foreign_title']
// = [ { language: {Array}labels }, {Array}titles, {Array}revid ]
label_data = Object.create(null), NO_NEED_CHECK_INDEX = 3,
// label_data_keys = Object.keys(label_data);
// = ['foreign_language:foreign_title' , '', ...]
label_data_keys, label_data_index = 0, label_data_length = 0, starting_label_time,

/** {revision_cacher}記錄處理過的文章。 */
processed_data = new CeL.wiki.revision_cacher(base_directory + 'processed.'
		+ CeL.wiki.site_name(wiki) + '.json', {
	// preserve : true,
	id_only : true
}),

// @see PATTERN_link @ application.net.wiki
// [ all link, foreign language, title in foreign language, local label ]
PATTERN_link = /\[\[:\s*?([a-z]{2,})\s*:\s*([^\[\]|#]+)\|([^\[\]|#]+)\]\]/g,

// 國名或常用字詞。
PATTERN_common_title,

// 改為 non-Chinese
// 2E80-2EFF 中日韓漢字部首補充 CJK Radicals Supplement
PATTERN_none_used_title = /^[\u0000-\u2E7F]+$/i,
//
PATTERN_language_label = Object.create(null),
// e.g., '[\\s\\d_,.:;\'"!()\\-+\\&<>\\\\\\/\\?–`@#$%^&*=~×☆★♪♫♬♩○●©®℗™℠]*'
common_characters = CeL.wiki.PATTERN_common_characters.source.replace(/\+$/,
		'*'),

// en_titles,
// /^[\s\n]*(?:(?:{{[^{}]+}}|\[\[[^\[\]]+\]\])[\s\n]*)*([^（()）\n]+)[（(]([^（()）\n]+)/
// [ all token including local title, including foreign title ]
PATTERN_title_in_lead_section = /^[^（()）{}\[\]\n\t]+[（(]([^（()）\[\]\n\t]{3,})/,

// @see
// https://github.com/liangent/mediawiki-maintenance/blob/master/cleanupILH_DOM.php
parse_templates = '{{link-[a-z]+|[a-z]+-link|le' + '|ill|interlanguage[ _]link'
		+ '|tsl|translink|ilh|internal[ _]link[ _]helper'
		+ '|illm|interlanguage[ _]link[ _]multi|liw'
		//
		+ (is_zh ? '|多語言連結' : use_language === 'ja' ? '|仮リンク|ill2' : '')
		//
		+ '}}',

// CJK 用 外國語言版本指示器。
// 注意: 採取寧缺勿濫原則。
// TODO: [[:en:List of ISO 639-2 codes]]
// TODO: \p{Katakana}
// |^[ァ-ヴ][ァ-ヴー]+(?:[・＝][ァ-ヴ][ァ-ヴー]*)*語$
// @see https://www.tactsystem.co.jp/blog/post-94/
PATTERN_CJK_foreign_language_indicator = /^[?!.+\-]+$|^[(（]?\s*[英中日德法西義韓諺俄独原](?:文|[語语國国]文?)[名字]?[)）]?$|(?:国|フランス|ドイツ|ロシア|アラビア|スペイン|オランダ)語[)）]?$|[語语國国文](?:版|[維维]基|[頁页]面|Wikipedia|ウィキペディア)|:?(?:en|zh|ko|de|fr|pt|es|hu|pl|ca|hr|it|af|vi|sl)(?:$|[)）]|\W)/i;

'著作権法|上告禁止法|自由社会主義|聖体の祝日|霧の国|チルボン王国|全米哀悼の日|行動心理療法|アルバ憲法|楕円法|王国記念日|多配置SCF法|高速多重極展開法|アゼルバイジャンの言語|古代アラム語|ジル・ブラース物語|アルスター・スコットランド語|DIGITALコマンド言語|多文化的なロンドン英語|ケベック英語|法律英語'
// TODO: should be OK: |英語版の有名人のリスト
.split('|').forEach(function(title) {
	if (PATTERN_CJK_foreign_language_indicator.test(title)) {
		throw new Error(
		//
		'Matched PATTERN_CJK_foreign_language_indicator: ' + title);
	}
});
// "?": 去掉純符號 e.g., {{仮リンク|?|fr|Miaulement}} @ [[w:ja:喉鳴らし]]
"?|日语维基百科|英語版|中国版|TI-30（Wikipedia英語版）|オランダ語|オランダ語版|英語|英語版記事|（英語版）|（英語）|（en）|(英語版)|(英語)|(en)|:en:ABC|英語版の記事|法文版|義大利文版|イタリア語版|英語版ウィキペディア\"Objectivism\"|中文版|独語版|英語版該当ページ|中国語版ウィキペディアの記事|参考:英語版|（ドイツ語版）|イタリア語版|中国版|中国語版|朝鮮語版|英語版該当ページ|フランス語版|伊語版|アラビア語|アラビア語版|スペイン語|スペイン語版|英語版のサイト"
// should be NG:
.split('|').forEach(function(title) {
	if (!PATTERN_CJK_foreign_language_indicator.test(title)) {
		throw new Error(
		//
		'Not match PATTERN_CJK_foreign_language_indicator: ' + title);
	}
});

// 常用非英語拉丁語言。多為歐美語系。
var languages_maybe_latin_script = [ 'de', 'fr', 'pt', 'es', 'hu', 'pl', 'ca',
		'hr', 'it', 'af', 'vi', 'sl' ];

function language_label(language) {
	if (language in PATTERN_language_label)
		return PATTERN_language_label[language];

	return PATTERN_language_label[language]
	//
	= new RegExp('^' + common_characters + language + common_characters + '$',
			'i');
}

function try_decode(title) {
	if (typeof title === 'string') {
		// 對日文版，有必要刪除註解。
		title = title.replace(/<\!--[\s\S]*?-->/g, '');

		// if(title.includes('%'))
		try {
			return decodeURIComponent(title);
		} catch (e) {
		}
	}
	// for '&#x0259;'
	return CeL.HTML_to_Unicode(title);
}

/**
 * Operation for each page. 對每一個頁面都要執行的作業。
 * 
 * @param {Object}page_data
 *            page data got from wiki API. =
 *            {pageid,ns,title,revisions:[{timestamp,'*'}]}
 */
function for_each_page(page_data, messages) {
	// 有必要中途跳出時則須在 callback() 中設定：
	// @ callback(page_data, messages):
	if (label_data_length > test_limit) {
		if (messages) {
			// 當在 .work() 執行時。
			messages.quit_operation = true;
			// 在 .edit() 時不設定內容。但照理應該會在 .page() 中。
			return;
		}
		// 當在本函數，下方執行時，不包含 messages。
		return CeL.wiki.quit_operation;
	}

	// TODO: template
	if (page_data.ns !== 0) {
		return [ CeL.wiki.edit.cancel, '本作業僅處理條目命名空間' ];
	}

	/** {String}page title = page_data.title */
	var title = CeL.wiki.title_of(page_data),
	/**
	 * {String}page content, maybe undefined. 頁面內容 =
	 * CeL.wiki.revision_content(revision)
	 */
	content = CeL.wiki.content_of(page_data),
	/** {Natural}所取得之版本編號。 */
	revid = page_data.revisions[0].revid;

	if (!content) {
		// 若是時間過長，失去 token 則會有空白頁面？此時不應計入已處理。
		return;
	}

	// ----------------------------------------------------

	if (/^\d+月(\d+日)?/.test(title) || /^\d+年(\d+月)?$/.test(title)) {
		return [ CeL.wiki.edit.cancel, '跳過日期條目，常會有意象化、隱喻、象徵的表達方式。' ];
	}

	if (/^訃報 2018年1?\d月$/.test(title)) {
		return [ CeL.wiki.edit.cancel, '[[d:Special:Diff/781564206|機械翻訳修正中]]' ];
	}

	// ----------------------------------------------------

	// Check if page_data had processed useing revid.
	if (processed_data.had(page_data)) {
		return;
	}

	// ----------------------------------------------------

	/**
	 * 增加特定語系註記。
	 * 
	 * @param foreign_language
	 *            外國語言
	 * @param foreign_title
	 *            外語之標題
	 * @param label
	 *            本地語言標題
	 * @param local_language
	 *            本地語言
	 * @param token
	 *            包含此標題資訊之wikitext上下文
	 * @param no_need_check
	 *            不需檢查 foreign_title 是否存在。
	 */
	function add_label(foreign_language, foreign_title, label, local_language,
			token, no_need_check) {

		if (foreign_language !== 'WD') {
			foreign_language = foreign_language.toLowerCase();
			if (!/^(?:[a-z]{2,})$/.test(foreign_language)) {
				CeL.warn('Invalid language: ' + foreign_language);
				return;
			}
		}

		// 不應處理 {{仮リンク|タイタンの地質|en|Titan_(moon)#Surface_features}}
		// Skip {{le|Deep Silver|Koch Media#Deep Silver}}
		if (label.includes('#') || foreign_title.includes('#')) {
			// [[ビッグ・リーグ・チュー]]:
			// [[タバコ#噛みタバコ|噛みタバコ]] ([[:en:Chewing tobacco|chewing tobacco]])
			// [[スクロドフスカ石]]:
			// {{仮リンク|ネソ珪酸塩鉱物|en|Silicate_minerals#Nesosilicates_or_orthosilicates}}
			CeL.debug('不處理名稱包含"#"者: [' + label + '], foreign_title: '
					+ foreign_title);
			return;
		}

		foreign_title = CeL.wiki.normalize_title(foreign_title
				.replace(/^:/, ''));
		label = CeL.wiki.normalize_title(label
		// e.g., {{仮リンク|:Category:1758年に記載された鳥類|en|Category:Birds described
		// in 1758|ハシジロキツツキ}} (カテゴリ)
		.replace(/^:/, '')
		// remove disambiguation information.
		// e.g., [[Special:Diff/518108554]], [[w:zh:目擊者 (1999年電影)]]
		// e.g., [[:en:Bumper cars|（bumper cars）]] @ [[w:ja:アニー・ホール]]
		.replace(/[(（][^()（）]+[)）]$/, ''));
		if (false) {
			// done by CeL.wiki.normalize_title().
			label = label.replace(/_/g, ' ');
		}

		if ((foreign_language !== 'ja' || local_language !== 'zh-hant')
		// 不處理各自包含者。
		&& (foreign_title.length === label.length
		// 在遇到如 [[:ja:混合農業]] 時會被跳過。此處 'zh-hant' 表示已經過轉換，繁簡標題不相同之結果。
		? foreign_title === label
		// e.g., [[:en:Björn Eriksson (civil servant)|Björn Eriksson]]
		: foreign_title.length > label.length && foreign_title.includes(label))) {
			CeL.debug('不處理各自包含者: [' + label + '], foreign_title: '
					+ foreign_title, 2, 'add_label');
			return;
		}

		if (wiki.namespace(foreign_language)) {
			CeL.debug('Skip wiki namespace: [' + foreign_language
			// e.g., [[:template:光緒六年庚辰科殿試金榜|光緒六年進士]]
			+ '], foreign_title: ' + foreign_title, 2, 'add_label');
			return;
		}

		if (!local_language) {
			local_language = CeL.wiki.guess_language(label);
			if (!local_language) {
				// local_language === ''
				CeL.warn('add_label: Unknown language: ' + token + ' @ '
						+ CeL.wiki.title_link_of(title));

			} else if (local_language === 'en'
			// 不應包含常用非英語拉丁語言。
			// e.g., {{link-de|ZUB|Zugbeeinflussung}} 不應當作英語縮寫。
			// [[d:User talk:Kanashimi#English aliases]]
			&& languages_maybe_latin_script.includes(foreign_language)) {
				// Will set as `use_language`
				// local_language = null;

				local_language = languages_maybe_latin_script
						.includes(use_language) ? use_language
						: foreign_language;
			}
		}

		if (is_zh && (!local_language
		// assert: is_zh 才有可能是簡體
		|| local_language === 'zh-cn' || local_language === 'zh-hans')) {
			// 後期修正/繁簡修正。繁體轉換成簡體比較不容易出錯，因此以繁體為主。

			// TODO: CeL.CN_to_TW() is too slow...
			var label_CHT = CeL.CN_to_TW(label);
			if (label_CHT !== label
			// 勛章→勳章 身份→身分
			// 不代表原先的詞彙就是簡體。
			// 當原詞彙轉換成繁體之後與原詞彙不同，機器人便會將原詞彙視為簡體詞彙。但假如原詞彙其實是繁體的，就會發生
			// [[Special:AbuseFilter/234]], [[Special:AbuseFilter/235]] 問題。
			&& !/[份裡佔後託勛]/.test(label)) {
				// 詞條標題中，使用'里'這個字的機會大多了。
				label_CHT = label_CHT.replace(/裡/g, '里').replace(/佔/g, '占')
						.replace(/([王皇太天])後/g, '$1后');
				// 奧托二世 ja:"・"
				if (true || /[·･．˙•]/.test(label_CHT)) {
					// 為人名。
					label_CHT = label_CHT.replace(/託/g, '托').replace(/理察/g,
							'理查').replace(/伊麗/g, '伊莉');
				}
				if (label_CHT !== label
				// 人名常使用'舍'這個字。
				&& label_CHT.replace(/捨/g, '舍') !== label) {
					// 加上轉換成繁體的 label
					add_label(foreign_language, foreign_title, label_CHT,
							'zh-hant', token, no_need_check);
					if (!local_language)
						// 非繁體的 label 照理應該是簡體 (zh-hans)。
						// treat zh-hans as zh-hans
						local_language = 'zh-hans';

					// language fallback :[[mw:Localisation statistics]]
					// (zh-hk, zh-mo, zh-tw) → zh-hant (→ zh?)
					// (zh-cn, zh-sg) → zh-hans (→ zh?)
					// no zh-my?
				} else {
					// 繁簡標題相同，採用 local_language = 'zh' 即可。
				}
			}
		}

		// 2016/5/21:
		// 在此採用 asynchronous 非循序執行的方法，如 wiki.page()，不能真正同時執行或穿插執行指令；
		// 在文章數量大時會造成 JavaScript heap out of memory。
		// 此法僅在少量文章時可使用。因此此處先推入 label_data[]，稍後再處理。

		// 2016/5/22 (using 21H):
		// 由於zhwiki也有187K+筆紀錄，因此還是可能造成 FATAL ERROR:
		// CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory

		label_data_length++;
		CeL.debug('label_data_length: ' + label_data_length, 2, 'add_label');
		// console.log(raw_data_file_stream);

		// [ At what local page title, token,
		// foreign_language, foreign_title, local_language, local_title,
		// no_need_check, revid ]
		raw_data_file_stream.write([ title, token, foreign_language,
				foreign_title, local_language || use_language, label,
				// type no_need_check: 不需檢查 foreign_title 是否存在。
				no_need_check || '', revid ].join('\t')
				+ '\n');
	}

	// ----------------------------------------------------

	var matched;

	// ----------------------------------------------------

	// parse 跨語言連結模板
	CeL.wiki.parse.every(parse_templates, content, function(token) {
		if (CeL.is_debug(2)) {
			CeL.info('parse 跨語言連結模板:');
			console.log(token);
		}

		var foreign_language, foreign_title, label,
		//
		template_name = token[1].toLowerCase().replace(/_/g, ' ');

		switch (template_name) {
		case 'translink':
		case 'tsl':
			// {{tsl|en|foreign title|local title}}
			foreign_language = token[2][1];
			foreign_title = token[2][2];
			label = token[2][3];
			break;

		case 'ill':
		case 'interlanguage link':
			// {{ill|en|local title|foreign title}}
			foreign_language = token[2][1];
			label = token[2][2];
			foreign_title = token[2][3];
			break;

		case 'liw':
		case 'illm':
		case 'ill2':
		case 'interlanguage link multi':
			// @see
			// https://ja.wikipedia.org/w/index.php?title=%E7%89%B9%E5%88%A5:%E3%83%AA%E3%83%B3%E3%82%AF%E5%85%83/Template:%E4%BB%AE%E3%83%AA%E3%83%B3%E3%82%AF&namespace=10&limit=500&hidetrans=1&hidelinks=1
		case '仮リンク':
		case '多語言連結':
			label = token[2][1];
			if (token[2].WD) {
				// {{illm|WD=Q1}}
				foreign_language = 'WD';
				foreign_title = token[2].WD;
			} else {
				// {{illm|local title|en|foreign title}}
				// {{liw|local title|en|foreign title}}
				// {{liw|中文項目名|語言|其他語言頁面名|...}}
				foreign_language = token[2][2];
				foreign_title = token[2][3];
			}
			break;

		case 'link-interwiki':
			// {{link-interwiki|zh=local_title|lang=en|lang_title=foreign_title}}
			// {{Link-interwiki|local_title|en|foreign_title}}
			label = token[2][use_language] || token[2][1];
			foreign_language = token[2].lang || token[2][2];
			foreign_title = token[2].lang_title || token[2][3];
			break;

		case 'ilh':
		case 'internal link helper':
			// {{internal link helper|本地條目名|外語條目名|lang-code=en|lang=語言}}
			label = token[2][1];
			foreign_title = token[2][2];
			foreign_language = token[2]['lang-code'];
			break;

		case 'le':
			// {{le|local title|foreign title|show}}
			label = token[2][1];
			foreign_title = token[2][2];
			foreign_language = 'en';
			break;

		default:
			// {{Internal link helper}}系列模板
			// {{link-en|local title|foreign title}}
			foreign_language = template_name.startsWith('link-')
			// 5: 'link-'.length, '-link'.length
			? template_name.slice(5)
			// assert: template_name.endsWith('-link')
			: template_name.slice(0, -5);
			label = token[2][1];
			foreign_title = token[2][2];
			break;
		}

		// TODO: 處理 {{=}} e.g., {{仮リンク|ド・モアブル{{=}} @ [[中心極限定理]]
		CeL.debug('Get label: ' + label + ' → [' + CeL.wiki.plain_text(label)
				+ '], foreign title: [' + foreign_language + ':'
				+ foreign_title + ']', 2);
		if (label && (label = CeL.wiki.plain_text(label)) && isNaN(label)
		// label, title 不可包含 {{}}[[]]。
		&& !/[{}\[\]]{2}/.test(label)
		//
		&& foreign_title && !/[{}\[\]]{2}/.test(foreign_title)
		//
		&& foreign_language && /^[a-z_]+$/.test(foreign_language)) {
			add_label(foreign_language, try_decode(foreign_title),
					try_decode(label), null, token[0]);
		} else if (!label && !foreign_title || !foreign_language) {
			CeL.warn('Invalid template: ' + token[0] + ' @ '
					+ CeL.wiki.title_link_of(title));
		}
	});

	// ----------------------------------------------------

	/**
	 * 從文章的開頭部分[[WP:LEAD|導言章節]]辨識出本地語言(本國語言)以及外國原文label。 此階段所加的，必須先確定 en
	 * 無此條目。最晚在 wikidata 階段需要確保目標 wiki 無此條目。
	 * 
	 * 注意: 同一個template標籤之內，應該只放一組專有名詞。因此
	 * <code>{{lang-en-short|pseudoscience, pseudo-science}}</code> 應該要改成
	 * <code>{{lang-en-short|pseudoscience}}、{{lang-en-short|pseudo-science}}</code>
	 * TODO: 在有多組專有名詞的情況下，本工具只會匯入第一個 template。
	 * 
	 * TODO: Q32956 之類 foreign_language 判別不當的情況。
	 * 
	 * <code>
	'''亨利·-{zh-cn:阿尔弗雷德;zh-tw:阿佛列;zh-hk:亞弗列;}-·基辛格'''（[[英文]]：Henry Alfred Kissinger，本名'''海因茨·-{zh-cn:阿尔弗雷德;zh-tw:阿佛列;zh-hk:亞弗列;}-·基辛格'''（Heinz Alfred Kissinger），{{bd|1923年|5月27日|}}）
	'''动粒<ref>[http://www.term.gov.cn/pages/homepage/result2.jsp?id=171683&subid=10000633&subject=%E5%8C%BB%E5%AD%A6%E9%81%97%E4%BC%A0%E5%AD%A6&subsys=%E5%8C%BB%E5%AD%A6]</ref>'''或'''着丝点'''（{{lang-en|Kinetochore}}）
	</code>
	 * 
	 * @see /public/dumps/public/enwiki/20160601/enwiki-20160601-all-titles-in-ns0.gz
	 */

	var lead_text = CeL.wiki.lead_text(content);
	matched = lead_text.match(PATTERN_title_in_lead_section);
	if (false) {
		console.log('-'.repeat(80));
		console.log(PATTERN_title_in_lead_section);
		console.log(matched);
		console.log(CeL.wiki.lead_text(content).slice(0, 20));
	}
	if (matched
	// 對此無效: [[卡尔·古斯塔夫 (伊森堡-比丁根)]], [[奥托二世 (萨尔姆-霍斯特马尔)]]
	// && matched[1].includes("'''" + title + "'''")
	) {
		// matched 量可能達數十萬！
		// TODO: 對於這些標籤，只在沒有英文的情況下才加入。
		var label = matched[1].replace(/<[a-z][^<>]*>/g, ''), token = matched[0]
				.trim(), foreign_title = null, foreign_language;
		CeL.debug(CeL.wiki.title_link_of(title) + ' lead: ' + token, 4);

		matched = label
		// 檢查 "'''條目名'''（{{lang-en|'''en title'''}}...）"
		// find {{lang|en|...}} or {{lang-en|...}}
		.match(/{{\s*[Ll]ang[-|]([a-z]{2}[a-z\-]{0,20})\s*\|([^{}]{3,40})}}/);
		if (matched
		// '''竇樂安'''，[[英帝國官佐勳章|OBE]]（{{lang-en|'''John Darroch'''}}，
		// CeL.HTML_to_Unicode(): 處理HTML編碼。 see [[d:Special:Diff/348446688]]
		&& (foreign_title = CeL.HTML_to_Unicode(CeL.wiki.plain_text(matched[2])
		// e.g., {{Lang-tr|Türkçe|link=no}}
		// e.g., {{Lang-tr|links=no|Türkçe}}
		.replace_till_stable(/(^|\|)\s*[a-z]+\s*=[^\|=]*($|\|)/ig,
		//
		'$1$2').replace(/^\|+/, '').replace(/\|.*$/, '').trim()))) {
			// adapt for 略記. e.g., [[ja:Template:Lang-en-short]]
			foreign_language = matched[1].replace(/-short$/, '');
			CeL.debug('title@lead type {{lang-xx|title}}: '
					+ CeL.wiki.title_link_of(title) + ' → [['
					+ foreign_language + ':' + foreign_title + ']]', 3);
			if (foreign_language === 'el') {
				// [[zh:Special:Diff/40503472]] 無法分辨 grc (古希臘語) 與 el (希臘語)，放棄編輯。
				// Stop import el to Wikidata.
				foreign_title = '';
			}

		} else if ((matched = label
		// 檢查 "'''條目名'''（'''en title'''）"
		// 檢查 "'''巴爾敦'''爵士，GBE，KCVO，CMG（Sir '''Sidney Barton'''，"
		.match(/^[a-z\d\-\s,]{0,8}'''([^:：{}<>()]{3,40})'''/i))
		// e.g., [[zh:城域网]], [[zh:ISM频段]]: "'''A'''... '''B'''... '''C'''..."
		// e.g., [[zh:电影手册]]
		&& !matched[1].includes("''")
				&& (foreign_title = CeL.wiki.plain_text(matched[1]))
				&& (foreign_language = CeL.wiki.guess_language(foreign_title))) {
			CeL.debug("title@lead type '''title''': [[" + title + "]] → [["
					+ foreign_language + ':' + foreign_title + ']]', 3);

		} else if ((matched = label
		// 檢查 "'''條目名'''（en title，...）"
		// '''霍夫曼的故事'''（Les Contes d`Hoffmann）
		// 注意: 此處已不可包含 "''"。
		// @see common_characters
		.match(/^([a-z][a-z\s\d,.\-–`]{3,40})[)），;；。]/i))
				&& (foreign_title = CeL.wiki.plain_text(matched[1]))) {
			foreign_language = 'en';
			CeL.debug('title@lead type （title，...）: '
					+ CeL.wiki.title_link_of(title) + ' → [['
					+ foreign_language + ':' + foreign_title + ']]', 3);
		}

		if (foreign_title) {
			// Exclude [[w:ja:疑似科学]]:
			// "{{lang-en-short|pseudoscience, pseudo-science}}"
			matched = foreign_title.split(/[,;]/);
			var pieces = matched.map(function(token) {
				return token.trim().replace(/-/g, '').toLowerCase();
			}).filter(function(token) {
				return !!token;
			}).unique();
			if (pieces === 1) {
				// 取第一個有內容的 foreign label。
				matched.some(function(token) {
					return foreign_title = token.trim();
				});
			} else {
				// '''ポロシティ'''（{{lang|en|porosity, void fraction}}）
				// 分不清會不會有包括逗號","和分號";"才算是完整別名(label)的情況，因此放棄。
				foreign_title = null;
			}

			matched = title
			// e.g., "Loser Man、Loser Guy、Loser Boy" "Event Data Recorder ， EDR"
			.match(/^[a-z\d\-\s]{2,}(?:([、，;；])[a-z\d\-\s]{2,})+$/i)
			// e.g., "Nimburg, Neuenburg", "Guide number, GN"
			|| title.match(/^[a-z\d\-\s,;]{2,}(?:([,;])[a-z\d\-\s,;]{2,})+$/i)
			// e.g., "高槻第一ジャンクション、たかつきだいいちジャンクション"
			|| title.match(/^[^.。、，;；]{2,}(?:([、，;；])[^.。、，;；]{2,})+$/)
			// e.g., "אִיָּר ,אייר"
			|| title.match(/^[^.。、，;；]{2,}(?:(,)[^.。、，;；]{2,})+$/);
			if (matched) {
				title = title.split(matched[1]);
			} else if (/或| or | and /i.test(title)) {
				// e.g., "ThioTEPA 或 thiotepa"
				title = [ title ];
			}
			if (!foreign_title) {
				// e.g., 分不清會不會有包括逗號","和分號";"才算是完整別名(label)的情況，因此放棄。
			} else if (Array.isArray(title)) {
				// e.g., "Electronic waste, e-waste or e-scrap"
				if (/或| or | and /i.test(title.at(-1))) {
					matched = title.pop().split(/或| or | and /i);
					title.append(matched);
				}
				title.forEach(function(title) {
					title = title.trim();
					if (title.length <= 3) {
						return;
					}
					add_label(use_language, title, foreign_title,
							foreign_language, token, 1);
				});
			} else {
				// if (!en_titles.search_sorted(foreign_title))
				add_label(use_language, title, foreign_title, foreign_language,
						token, 1);
			}

		} else if (CeL.is_debug(2)) {
			CeL.debug(CeL.wiki.title_link_of(title)
					+ ': Unknown label pattern: [' + label + ']', 3);
		}

	} else if (matched = lead_text.match(/^[\s\n]*({{|\[\[)/)) {
		CeL.warn(CeL.wiki.title_link_of(title) + ': 有問題的 wikitext，例如有首 "'
				+ matched[1] + '" 標記，無結尾標記？\ntext: ' + lead_text);
	}

	// 若僅要處理"從文章的開頭部分[[WP:LEAD|導言章節]]辨識出本地語言(本國語言)以及外國原文label"之部分。
	// return;

	// ----------------------------------------------------

	while (matched = PATTERN_link.exec(content)) {
		// @see function language_to_project(language) @
		// CeL.application.net.wiki
		// 以防 incase wikt, wikisource
		if (matched[1].includes('wik')
		// 光是只有 "Category"，代表還是在本 wiki 中，不算外國語言。
		|| /^category/i.test(matched[1]) || is_CJK
				&& PATTERN_CJK_foreign_language_indicator.test(matched[3])) {
			continue;
		}

		// 外國語言條目名
		var foreign_title = matched[2].trim().replace(/_/g, ' ');

		if (foreign_title.length < 2
		// e.g., [[:en:wikt:title|title]]
		|| /^[a-z\s]*:/.test(foreign_title)) {
			continue;
		}

		var
		// language of ((label))
		language_guessed,
		// 本地條目名 or 本地實際顯示名 . local_title
		label = CeL.wiki.plain_text(matched[3]);

		if (PATTERN_none_used_title.test(label)) {
			// context 上下文 前後文
			// 前面的 foregoing paragraphs, see above, previously stated, precedent
			// 後面的 behind rearwards;back;posteriority;atergo;rearward
			var foregoing = content.slice(matched.index - 80, matched.index)
			// parse 括號後附註
			// "《[[local title]]》 （[[:en:foreign title|foreign]]）"
			// @see PATTERN_duplicate_title
			.match(/\[\[([^\[\]:]+)\]\]\s*['》」』〉】〗〕]?[（(\s]*$/);
			if (!foregoing
			//
			|| PATTERN_none_used_title.test(label = foregoing[1])) {
				continue;
			}
		}

		// 排除 [[:en:Day|en]] 之類，label 僅包含 language 資訊者。
		if (language_label(matched[1]).test(label)
		// 去除國名或常用字詞。 @see [[瓦倫蒂諾·羅西]]
		|| PATTERN_common_title.test(label))
			continue;

		if (is_zh) {
			label = label.replace(/-{([^{}]*)}-/g, function($0, $1) {
				if (!$1.includes(':'))
					return $1;
				// 台灣正體
				var matched = $1.match(/(zh-tw):([^;]+)/i)
				// 香港繁體, 澳門繁體
				|| $1.match(/(zh-(?:hk|hant[^a-z:]*|mo)):([^;]+)/i);
				if (matched) {
					language_guessed = matched[1].toLowerCase();
					return matched[2].trim();
				}
				matched = $1.match(/zh(?:-[a-z]+):([^;]+)/i);
				return matched && matched[1].trim() || $0;
			});
		}

		// 去掉 "|..." 之後之 label。
		label = label.replace(/\|.*/, '').trim().replace(/<br[^<>]*>/ig, ' ')
				.replace(/[\s　_]{2,}/g, ' ');

		if (label.length < 5
		// && label.length > 1
		// [[:en:Thirty-third government of Israel|第33届]] @ [[以色列总理]]
		// [[en:1st Lok Sabha]] ← [[1屆]] @ [[印度总理]]: [[:en:1st Lok Sabha|1届]]
		// [[en:First Gerbrandy cabinet]] ← [[第一屆]] @ [[荷兰首相]]: [[:en:First
		// Gerbrandy cabinet|第一届]]
		&& is_zh && /[屆届]$/.test(label)
		// 跳過日期 label
		|| /^\d+月(\d+日)?$/.test(label) || /^\d+年(\d+月)?$/.test(label)) {
			continue;
		}

		if (label.length > foreign_title.length) {
			var index = label.indexOf(foreign_title);
			if (index > 0 && /[(（]/.test(label.charAt(index - 1))
					&& /[)）]/.test(label.charAt(index + foreign_title.length))) {
				label = label.slice(0, index - 1)
						+ label.slice(index + foreign_title.length + 1);
			} else if (index !== NOT_FOUND) {
				// assert: label.includes(foreign_title)

				// 照理來說應該是 [[:ko:기린|キリン]]。
				// 但是對於 [[:ko:기린|기린（キリン）]] 或 [[:ko:기린|기린]] 這樣的情況就只好跳過。
				// @see [[:ja:麒麟]]
				continue;
			}
		}

		label = label
		// e.g., [[:en:title|''title'']], [[:en:title|《title》]]
		.replace(/['》」』〉】〗〕]+$|^['《「『〈【〖〔]+/g, '').replace(
				/'{2,}([^']+)'{2,}/g, '$1')
		// e.g., [[:en:title|title{{en}}]]
		.replace(/{{[a-z]{2,3}}}/g, '').replace(/{{·}}/g, '·').trim();

		// 篩除代表資訊過少的辭彙。
		if (label.length < 2
		// 去除不能包含的字元。
		// || label.includes('/')
		// || /^[\u0001-\u00ff英中日德法西義韓諺俄独原]$/.test(label)
		|| is_CJK && (PATTERN_CJK_foreign_language_indicator.test(label)
		// || label.endsWith('學家')
		|| /[學学][家者]$/.test(label))
		// || label.includes('-{')
		) {
			continue;
		}

		// label = label.replace(/（(.+)）$/, '($1)');

		add_label(matched[1], foreign_title, label, language_guessed,
				matched[0]);
	}

}

// ----------------------------------------------------------------------------

// 本函數並沒有被使用到。
function get_enwiki_titles() {
	/** node.js file system module */
	var node_fs = require('fs'), execSync = require('child_process').execSync,
	//
	dump_dir = '/public/dumps/public/enwiki/'
	//
	fso_name_list = node_fs.readdirSync(dump_dir),
	//
	latest_id = fso_name_list.sort().pop(),
	// e.g., 'enwiki-20171001-all-titles-in-ns0'
	titles_file = 'enwiki-' + latest_id + '-all-titles-in-ns0';
	// dump_directory: see "wiki loader.js"
	execSync('/bin/gzip -cd "' + dump_dir + latest_id + '/' + titles_file
			+ '.gz" > "' + dump_directory + titles_file + '"');

	return CeL.fs_read(dump_directory + titles_file,
	/**
	 * 若直接讀入 all-titles-in-ns0，會出現 <code>
	FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory
	 * </code>
	 * 但若要每個查詢一次資料庫，不如乾脆列入排程。因此跳過此步。
	 * 
	 * <code>
	cd /shared/cache/ && gzip -cd /public/dumps/public/enwiki/20171001/enwiki-20171001-all-titles-in-ns0.gz > enwiki-20171001-all-titles-in-ns0
	 * </code>
	 */
	'utf8').toLowerCase().split('\n').filter(function(title) {
		return /^[a-z][a-z\d\-\s,]{3,}$/i.test(title);
	}).sort();
}

// ----------------------------------------------------------------------------

function merge_label_data(callback) {

	function parse_line(line) {
		line = line.split('\t');

		// [ At what local page title, token,
		// foreign_language, foreign_title, local_language, local_title,
		// no_need_check, revid ]
		var title = line[0], token = line[1], foreign_language = line[2], foreign_title = line[3], local_language = line[4], label = line[5],
		// type no_need_check: 不需檢查 foreign_title 是否存在。
		no_need_check = line[6],
		// ((revid|0)) 可能出問題。
		revid = Math.floor(line[7]);

		var data, full_title = foreign_language + ':' + foreign_title;

		if (!(full_title in label_data)) {
			++label_data_length;
			// console.trace('label_data_length: ' + label_data_length);
			if (label_data_length <= log_limit) {
				// 此 label 指向
				CeL.slog([ 'parse_line: ' + label_data_length + ':',
						'fg=yellow', label, '-fg', '→', 'fg=cyan', full_title,
						'-fg',
						'@ ' + CeL.wiki.title_link_of(title) + ': ' + token ]);
			}
			// 為防止有重複，在此不 push()。
			// label_data_keys.push(full_title);
			label_data[full_title] = data = [ Object.create(null), [ title ],
					[ revid ] ];

		} else {
			data = label_data[full_title];
			if (!data[1].includes(title)) {
				data[1].push(title);
				data[2].push(revid);
			}
		}

		if (no_need_check) {
			data[NO_NEED_CHECK_INDEX] = true;
		}

		if (!local_language) {
			local_language = use_language;
		}

		if (!data[0][local_language]) {
			data[0][local_language] = [ label ];
		} else if (!data[0][local_language].includes(label)) {
			data[0][local_language].push(label);
		}
	}

	label_data = Object.create(null);
	// reset
	label_data_length = 0;

	// read-out data
	raw_data_file_stream = new require('fs').ReadStream(raw_data_file_path,
			'utf8');

	var buffer = '';

	raw_data_file_stream.on('data', function(chunk) {
		chunk = (buffer + chunk).split('\n');
		buffer = chunk.pop();
		chunk.forEach(parse_line);
	});

	raw_data_file_stream.on('end', function() {
		callback(label_data);
		// finish_wikidata_part();
	});
}

function create_label_data(callback) {
	// reset
	label_data_length = 0;
	raw_data_file_stream = new require('fs').WriteStream(raw_data_file_path,
			'utf8');

	// Set the umask to share the xml dump file.
	if (typeof process === 'object') {
		process.umask(parseInt('0022', 8));
	}

	// for_each_page() 需要用到 rev_id。
	CeL.wiki.page.rvprop += '|ids';

	function after_read_page() {
		// 在 .end() 之後馬上 .close() 會造成最後的資料尚未寫入!
		raw_data_file_stream.end();
		raw_data_file_stream.on('finish', function() {
			CeL.info('after_read_page: Close [' + raw_data_file_path
					+ '], start merge_label_data()');
			merge_label_data(callback);
		});
	}

	if (test_the_page_only) {
		// for debug specified pages. 只處理此一頁面。僅測試此單一頁面。
		CeL.set_debug(2);
		wiki.page(test_the_page_only, for_each_page).run(after_read_page);
		return;
	}

	// CeL.set_debug(6);
	CeL.wiki.traversal({
		// [SESSION_KEY]
		session : wiki,
		// cache path prefix
		directory : base_directory,
		// 指定 dump file 放置的 directory。
		// dump_directory: see "wiki loader.js"
		dump_directory : dump_directory,
		// 若 config.filter 非 function，表示要先比對 dump，若修訂版本號相同則使用之，否則自 API 擷取。
		// 設定 config.filter 為 ((true)) 表示要使用預設為最新的 dump，否則將之當作 dump file path。
		filter : true,
		last : after_read_page

	}, for_each_page);
}

// ----------------------------------------------------------------------------

var name_type_hash = {
	5 : '人',
	515 : '城市'
};

// name of person, place, work, book, ...
function name_type(entity) {
	var claims = entity && entity.claims;
	if (!claims)
		return;

	// P50: 作者
	if (claims.P50)
		return '作品名';

	// P57: 導演
	if (claims.P57)
		return '影片名';

	var type,
	// P31: 隸屬於, instance of
	property = claims.P31;
	if (Array.isArray(property)) {
		property.some(function(value) {
			value = value.mainsnak.datavalue.value['numeric-id'];
			if (value && (value in name_type_hash))
				return type = name_type_hash[value];
		});

		if (type)
			return type;

		// TODO: 大學
	}

	// P47: 接攘, P131: 所在行政區, P2046: 面積
	if (claims.P47 || claims.P131 || claims.P2046)
		return '地名';
}

// 去除重複連結用。
// " \t": 直接採 "\s" 會包括 "\n"。
// [ all, text_1, link_1, title_1, middle, text_2, quote_start, title_2,
// quote_end ]
var PATTERN_duplicate_title = /(['《「『〈【〖〔]*\s*\[\[([^\[\]:\|]+)(\|[^\[\]:]+)?\]\]\s*['》」』〉】〗〕]*)([\s,;.!?\/，；。！？／]*)(([（(])?[\s']*\[\[\2(\|[^\[\]\|]+)?\]\][\s,;.!?\/，；。！？／']*([）)])?)/g,
//
summary_prefix = '[[' + use_language + ':', summary_postfix = ']]',
// separator
summary_sp = summary_postfix + ', ' + summary_prefix,
// @see CeL.wiki.plain_text()
// 跨語言
// 有很多類似的[[中文名]]，原名/簡稱/英文/縮寫為[[:en:XXX|XXX]]
// {{request translation | tfrom = [[:ru:Владивосток|俄文維基百科對應條目]]}}
// {{求翻译}}
// 日本稱{{lang|ja|'''[[:ja:知的財産権|知的財産法]]'''}}）
PATTERN_interlanguage = /[英中日德法西義韓諺俄独原][語语國国]?文?[名字]?|[簡简縮缩稱称]|翻[译譯]|translation|language|tfrom/,
// e.g., {{lang|en|[[:en:T]]}}
PATTERN_lang_link = /{{[lL]ang\s*\|\s*([a-z]{2,3})\s*\|\s*(\[\[:\1:[^\[\]]+\]\])\s*}}/g,

// @see [[d:Property:P1814|假名]]
読み仮名_id = 'P1814',
/**
 * 振り仮名 / 読み仮名 の正規表現。
 * 
 * @type {RegExp}
 */
PATTERN_読み仮名 = CeL.RegExp(/^[\p{Hiragana}\p{Katakana}ー・･ 　]+$/, 'u'),
// e.g., [[d:Q6157375]] "こくどう374ごう"
PATTERN_読み仮名_need_skip = CeL.RegExp(/^[\p{Hiragana}\p{Katakana}ー・･ 　\d\-]+$/,
		'u');

function 仮名_claim(仮名, imported_from) {
	CeL.debug('add 仮名 claim: [' + 仮名 + ']', 3, '仮名_claim');
	// https://www.wikidata.org/wiki/Wikidata:Database_reports/Constraint_violations
	return {
		読み仮名 : 仮名,
		language : 'ja',
		references : {
			// P143 @see https://www.wikidata.org/wiki/Wikidata:List_of_wikis
			'imported from Wikimedia project' : imported_from
					|| (use_language === 'zh' ? 'zh' : 'ja') + 'wiki'
		}
	};
}

var include_label = CeL.wiki.data.include_label;

function process_wikidata(full_title, foreign_language, foreign_title) {
	var labels = label_data[full_title], titles = labels[1],
	// no_need_check: 對於這些標籤，只在沒有英文的情況下才加入。
	no_need_check = labels[NO_NEED_CHECK_INDEX];
	labels = labels[0];

	// TODO: 一次取得多筆資料。
	wiki.data(foreign_language === 'WD' ? foreign_title : {
		title : foreign_title,
		language : foreign_language
	},
	// 不設定 property
	null, modify_Wikipedia && !no_need_check && function(entity) {
		if (label_data_index > test_limit)
			return;

		if (CeL.wiki.data.is_DAB(entity)) {
			// is Q4167410: Wikimedia disambiguation page 維基媒體消歧義頁
			return;
		}

		// console.log([ foreign_language, foreign_title ]);
		// console.log(entity);

		// 使用Wikidata數據來清理跨語言連結。例如將[[:ja:日露戦争|日俄戰爭]]轉成[[日俄戰爭]]，避免「在條目頁面以管道連結的方式外連至其他語言維基頁面」。

		// local title
		var local_title = CeL.wiki.data.title_of(entity, use_language);

		if (!local_title) {
			return;
		}

		// cache
		var type = null;

		// 標的語言 wikipedia 存在所欲連接/指向的頁面。
		titles.forEach(function(title) {
			wiki.page(title).edit(function(page_data) {
				var
				/**
				 * {String}page content, maybe undefined. 頁面內容 =
				 * CeL.wiki.revision_content(revision)
				 */
				content = CeL.wiki.content_of(page_data),
				// [ link, local title ]
				pattern = new RegExp('(?:{{' + foreign_language
				// TODO: {{languageicon}}
				+ '(?: icon)?}}\s*)?\\[\\[:'
				//
				+ foreign_language + '\\s*:\\s*'
				//
				+ CeL.to_RegExp_pattern(foreign_title)
				//
				+ '(?:\\|([^\\[\\]]+))?\\]\\](?:\s*{{'
				//
				+ foreign_language + '(?: icon)?}})?', 'g');

				// TODO: 任[[:en:Island School|英童中學]] (Island
				// School，今稱[[港島中學]]) 創校校長

				var change_to = content
				// "{{lang|en|[[:en:Luke Air Force Base|Luke Field空军基地]]}}"
				// → "[[:en:Luke Air Force Base|Luke Field空军基地]]"
				.replace(PATTERN_lang_link, '$2')
				//
				.replace_check_near(pattern, function(link, local) {
					if (local) {
						local = local.replace(
						// @see CeL.wiki.plain_text()
						/(?:\s*\()?[英中日德法西義韓諺俄独原][語语國国]?文?[名字]?\)?$/g, '');
					}

					var converted = '[[' + local_title + (local
					//
					&& !foreign_title.toLowerCase()
					// [[:en:Day|地球日]] → [​[日|地球日]]
					.includes(local.toLowerCase())
					// [[:en:Day|en:]] → [​[日 (消歧義)|日]]
					&& !/^[a-z]{2,3}:$/i.test(local)
					// [[:en:name of person, book, place, work|無論是什麼奇怪譯名]]
					// → [​[中文全名]] (譯名已匯入 wikidata aliases)
					&& !(type === null ? (type = name_type(entity)) : type)
					// ↓採用原先之標籤。
					? local === local_title ? '' : '|' + local
					// ↓放棄原先之標籤，採用條目名稱。
					// [[:en:Day (disambiguation)]] → [​[日 (消歧義)|日]]
					// [[:en:Day (disambiguation)|日]] → [​[日 (消歧義)|日]]
					// [[:en:Day (disambiguation)|Day]] → [​[日 (消歧義)|日]]
					: /\([^()]+\)$/.test(local_title)
					// e.g., [[title (type)]] → [[title (type)|title]]
					// 在 <gallery> 中，"[[title (type)|]]" 無效，因此需要明確指定。
					? '|' + local_title.replace(/\s*\([^()]+\)$/, '')
					// [[:en:Day]] → [​[日]]
					// [[:en:Day|日]] → [​[日]]
					// [[:en:Day|Day]] → [​[日]]
					// [[:en:First Last]] → [​[中文全名]]
					// [[:en:First Last|First]] → [​[中文全名]]
					: '')
					//
					+ ']]';
					CeL.log('replace ' + use_language
					//
					+ ': ' + link + ' → ' + converted);
					return converted;

				}, function(foregoing) {
					return !PATTERN_interlanguage.test(foregoing.slice(-20));
				}, function(behind) {
					return !PATTERN_interlanguage.test(behind.slice(0, 20));
				})

				// 去除重複連結。
				// TODO: 處理 link_1 重定向至 link_2 的情況。
				// e.g., [[率失真理論]]（[[率失真理论|Rate distortion theory]]）
				// TODO: link_1 雖然可能不同於 link_2，也不存在此頁面，但可能已經被列入 alias。
				.replace(PATTERN_duplicate_title,
				//
				function(all, text_1, link_1, title_1, middle,
				//
				text_2, quote_start, title_2, quote_end) {
					if (!quote_start && (
					// "相較於[[F404渦輪扇發動機|F404發動機]]，[[F404渦輪扇發動機|F412發動機]]的風扇直徑加大，"
					middle.trim()
					// "{{Unicode|[[Ԓ]] [[Ԓ|ԓ]]}}"
					|| link_1.toLowerCase() === title_2.toLowerCase())) {
						return all;
					}
					if (quote_start ? quote_end : !quote_end) {
						if (/[a-z\d,;.!]$/i.test(link_1)
						// TODO: 檢查是否所接續之下文亦為英文。
						// && /[a-z\d]$/i.test(接續之下文)
						)
							text_1 += ' ';
						// 前後 quote 皆有或皆無。
						return text_1;
					}
					// quote_start與quote_end僅有其一。
					return text_1 + (quote_start || quote_end);
				});

				if (change_to === content) {
					// 可能之前已更改過。
					return [ CeL.wiki.edit.cancel, 'skip' ];
				}

				return change_to;

			}, {
				bot : 1,
				summary : 'bot: 以[[d:' + entity.id
				//
				+ ']]清理跨語言連結' + CeL.wiki.title_link_of(local_title)
				//
				+ (type ? ' (' + type + ')' : '')
			});
		});

	}, {
		props : 'labels|aliases|claims|sitelinks'

	}).edit_data(function(entity, error) {
		if (error) {
			CeL.error('[' + (entity && entity.id
			//
			|| foreign_language + ':' + foreign_title) + ']:');
			CeL.error(error);
			return [ CeL.wiki.edit.cancel,
			//
			'Error: ' + error.messages ];
		}

		if (!CeL.wiki.content_of.page_exists(entity)) {
			CeL.debug('跳過不存在頁面: ' + (entity && entity.id)
			//
			+ ': [[' + foreign_language + ':' + foreign_title + ']]');
			// console.trace(entity);
			return [ CeL.wiki.edit.cancel,
			//
			'missing wikidata page of [' + (entity && entity.id
			//
			|| foreign_language + ':' + foreign_title) + ']' ];
		}

		// 處理: 從文章的開頭部分[[WP:LEAD|導言章節]]辨識出本地語言(本國語言)以及外國原文label。
		if (no_need_check && entity.labels) {
			var f_label,
			// foreign language
			f_language;
			// assert: Object.keys(labels).length === 1
			for (f_language in labels) {
				f_label = labels[f_language][0];
				break;
			}

			// assert: labels[f_language].length === 1
			var o_label = entity.labels[f_language]
			//
			&& entity.labels[f_language].value;

			// 新舊 label 之檢測需置於檢測重複的読み仮名前，預防輸入等價的仮名。
			if (include_label(o_label, f_label)) {
				CeL.debug('跳過從文章的開頭部分辨識出之外國原文 label: '
				// 確保目標 wiki 無等價之 label。
				+ entity.id + ': [[' + foreign_language
				//
				+ ':' + foreign_title + ']]: 已存在 [' + o_label
				//
				+ ']，放棄 [' + f_label + ']');
				return [ CeL.wiki.edit.cancel, 'skip' ];
			}

			if (f_language === 'ja' && PATTERN_読み仮名_need_skip.test(f_label)) {
				if (PATTERN_読み仮名.test(f_label)
				// 檢測重複的読み仮名。
				&& (!entity.claims || !include_label(CeL.wiki.data.value_of(
				//
				entity.claims[読み仮名_id]), f_label))) {
					this.summary = 'imported 仮名 from [['
					//
					+ titles.unique().slice(0, 10).map(function(title) {
						return use_language + ':' + title;
					}).join(summary_sp) + ']]';
					// treat foreign_title as 読み仮名.
					// 片仮中点（半角）→ 片仮中点
					return 仮名_claim(f_label.replace(/･/g, '・'), use_language);
				}

				return [ CeL.wiki.edit.cancel, 'skip' ];
			}

		}

		if (CeL.wiki.data.is_DAB(entity)) {
			// is Q4167410: Wikimedia disambiguation page
			// 維基媒體消歧義頁
			CeL.debug('跳過消歧義頁: '
			//
			+ entity.id + ': [[' + foreign_language
			//
			+ ':' + foreign_title + ']]');
			return [ CeL.wiki.edit.cancel, 'skip' ];
		}

		if (entity.claims && Array.isArray(entity.claims.P31)
		// [[d:User_talk:Kanashimi/Archive_1#Excluding_given_name/family_name_items_for_Latin_script_aliases]]
		&& entity.claims.P31.some(function(value) {
			value = value.mainsnak.datavalue.value['numeric-id'];
			return value && (value in {
				12308941 : 'male given name',
				11879590 : 'female given name',
				202444 : 'given name',
				101352 : 'family name'
			});
		})) {
			return;
		}

		if (label_data_index % 1e4 === 0 || CeL.is_debug()) {
			// CeL.append_file()
			CeL.log(label_data_index + '/' + label_data_length + ' '
			//
			+ entity.id + ': [['

			+ foreign_language + ':' + foreign_title
			//
			+ ']]: ' + JSON.stringify(labels));
		}

		if (CeL.is_debug()) {
			if (foreign_title !==
			//
			(foreign_language === 'WD'
			//
			? entity.id : entity.sitelinks[
			// 為日文特別修正: 'jp' is wrong!
			(foreign_language === 'jp' ? 'ja'
			// 為粵文維基百科特別處理。
			: foreign_language === 'yue' ? 'zh_yue'
			//
			: foreign_language) + 'wiki'].title)) {
				CeL.error('Different title!');
				console.log([ foreign_title, foreign_language ]);
				console.log(entity);
				// throw entity;
			}
		}

		// --------------------------------------
		// 2016/6/1 fix error
		if (false) {
			var original_labels = entity.labels && entity.labels[use_language],
			//
			original_label = original_labels && original_labels.value;
			if (original_label && original_label.includes('<!--')) {
				original_labels.value
				// 去除註解 comments。
				= original_label.replace(/<\!--[\s\S]*?-->/g, '');

				CeL.log('process_wikidata: fix error (comments): '
				//
				+ entity.id + ': [' + original_label + '] → '
				//
				+ CeL.wiki.title_link_of(original_labels.value));

				return {
					// https://www.wikidata.org/w/api.php?action=help&modules=wbeditentity
					labels : [ original_labels ]
				};
			}

			if (is_CJK
			//
			&& PATTERN_CJK_foreign_language_indicator.test(original_label)) {
				// fix error.
				// e.g., "（英語版）"
				var matched = original_label
				//
				.match(/^(.+?)\s*[（(]([^（）()]+)[）)]$/);
				if (matched && (matched[1] = matched[1].trim())
				// TODO: en + CeL.wiki.PATTERN_common_characters
				&& !/^[a-z\s\d\-]$/.test(matched[1])
				//
				&& PATTERN_CJK_foreign_language_indicator
				//
				.test(matched[2].trim())) {
					original_labels.value
					// e.g., "リトアニアの推理作家（リトアニア語版Wikipedia）"
					= matched[1];
					CeL.log('process_wikidata: fix error (CJK版): '
					//
					+ entity.id + ': ['
					// → "リトアニアの推理作家"
					+ original_label + '] → '
					//
					+ CeL.wiki.title_link_of(original_labels.value));

				} else {
					CeL.log('process_wikidata: fix error (delete CJK版): '
					//
					+ entity.id + ': ' + JSON.stringify(original_labels));
					original_labels.remove = 1;
				}

				return {
					// https://www.wikidata.org/w/api.php?action=help&modules=wbeditentity
					labels : [ original_labels ]
				};
			}
			return [ CeL.wiki.edit.cancel, 'skip' ];
		}
		// --------------------------------------

		// 要編輯（更改或創建）的資料。
		var data = CeL.wiki.edit_data.add_labels(labels, entity);

		// console.log(data);

		if (!data) {
			CeL.debug('跳過無須變更項目: [[d:' + entity.id + ']]');
			return [ CeL.wiki.edit.cancel, 'skip' ];
		}

		if (data.language === 'en') {
			en_label_list.push(entity.id + '	' + labels);
		}

		// TODO:
		// this.summary = 'import '+data.language+' '+label/alias+' from '+...;
		return data;

	}, {
		bot : 1,
		// TODO: add [[Special:Redirect/revision/00000|版本]]
		summary : '[[User:' + wiki.token.login_user_name
		//
		+ '#Import labels/aliases|import label/alias]] from ' + summary_prefix
		// 一般到第5,6個就會被切掉。
		+ titles.unique().slice(0, 10).join(summary_sp)
		//
		+ summary_postfix

	}, function(data, error) {
		// CeL.set_debug(6);
		if (!error || 'skip' === (Array.isArray(error) ? error[0] : error)) {
			// do next.
			setImmediate(next_label_data_work);
			return;
		}

		var may_skip;
		if (typeof error === 'object') {
			if (error.code === 'last_data_failed') {
				// 例如提供的 foreign title 錯誤，或是 foreign title 為 redirected。
				// 抑或者存在 foreign title 頁面，但沒有 wikidata entity。
				error = error.message;
				may_skip = true;
			} else {
				error = JSON.stringify(error.error || error);
			}
		}

		CeL.info('process_wikidata: [[' + titles.join(']], [[')
		//
		+ ']] failed: ' + error + (may_skip ? '' : ' - Retry next time.'));

		if (!may_skip) {
			// 成功才登記。失敗則下次重試。
			titles.unique().forEach(processed_data.remove, processed_data);
		}

		// do next.
		setImmediate(next_label_data_work);
	});
}

/**
 * Finish up wikidata part. wikidata part 最後結束工作。
 */
function finish_wikidata_part() {
	// console.log(PATTERN_common_title);

	// initialize: 不論是否為自 labels.json 讀取，皆應有資料。
	label_data_keys = Object.keys(label_data);
	// 設定此初始值，可跳過之前已經處理過的。但在此設定，不能登記 processed_data！
	// label_data_index = 1000;
	label_data_length = label_data_keys.length;
	CeL.log(script_name + ': All ' + label_data_length + ' labels'
	//
	+ (label_data_index ? ', starts from ' + label_data_index : '.'));

	// 由於造出 label_data 的時間過長，可能丟失 token，因此 re-login。
	// wiki = Wiki(true);
	// need fix wiki_session.edit_time_interval

	starting_label_time = Date.now();
	// do next.
	setImmediate(next_label_data_work);
}

// ----------------------------------------------------------------------------

// 為降低 RAM 使用，不一次 push 進 queue，而是依 label_data 之 index 一個個慢慢來處理。
function next_label_data_work() {
	CeL.debug('Start ' + label_data_index + '/' + label_data_length, 6,
			'next_label_data_work');

	if (label_data_index === label_data_length
	// Test done.
	|| label_data_index >= test_limit) {
		// Wikidata 部分: done.
		wiki.run(finish_work);
		return;
	}

	var full_title = label_data_keys[label_data_index++];

	if (label_data_index % 1000 === 0) {
		CeL.log('next_label_data_work: '
				+ CeL.wiki.estimated_message(label_data_index,
						label_data_length, starting_label_time,
						label_data_length, 'label') + ' '
				+ CeL.wiki.title_link_of(full_title));
	}
	var foreign_title = full_title.match(/^([a-z]{2,}|WD):(.+)$/),
	//
	titles = label_data[full_title][1];
	if (!foreign_title) {
		CeL.warn('next_label_data_work: Invalid title: '
				+ CeL.wiki.title_link_of(full_title) + ' @ [['
				+ titles.join(']], [[') + ']]');
		// do next.
		setImmediate(next_label_data_work);
		return;
	}

	var foreign_language = foreign_title[1],
	//
	revids = label_data[full_title][2];
	foreign_title = foreign_title[2];

	// 由於造出 label_data 的時間過長，可能丟失 token，
	// 因此將 processed_data 的建置放在 finish_wikidata_part() 階段。
	titles.unique().forEach(function(title, index) {
		processed_data.data_of(title, revids[index]);
	});

	// 跳過之前已經處理過的。
	if (label_data_index < 0) {
		setImmediate(next_label_data_work);
		return;
	}

	if (foreign_language === 'WD'
	// type no_need_check: 不需檢查 foreign_title 是否存在。
	|| label_data[full_title][NO_NEED_CHECK_INDEX]) {
		process_wikidata(full_title, foreign_language, foreign_title);
		return;
	}

	// 檢查 [[foreign_language:foreign_title]] 是否存在。
	CeL.wiki.redirect_to([ foreign_language, foreign_title ], function(
			redirect_data, page_data) {
		// CeL.info('next_label_data_work.check_label: page_data:');
		// console.log(page_data);

		if (!CeL.wiki.content_of.page_exists(page_data)) {
			CeL.info(
			//
			'next_label_data_work.check_label: missing foreign page '
					+ CeL.wiki.title_link_of(full_title)
					// ↓ 無此 token, title 資訊可用。
					// + '; ' + token + ' @ [[' + title + ']].'
					+ ' @ [[' + titles.join(']], [[') + ']]');
			// do next.
			setImmediate(next_label_data_work);
			return;
		}

		// 取消 foreign page 重新導向到章節的情況。對於導向相同目標的情況，可能導致重複編輯。
		if (typeof redirect_data === 'object') {
			CeL.info('next_label_data_work.check_label: 重新導向到章節, skip '
					+ CeL.wiki.title_link_of(full_title)
					+ ' → '
					+ CeL.wiki.title_link_of(redirect_data.to + '#'
							+ redirect_data.tofragment) + ' @ [['
					+ titles.join(']], [[') + ']]');
			// do next.
			setImmediate(next_label_data_work);
			return;
		}

		// TODO: check:
		// if the redirect page has wikidata item, then skip the label.
		// https://www.wikidata.org/w/index.php?title=Q56063989&type=revision&diff=1215536775&oldid=1214412806

		if (foreign_title !== page_data.title) {
			if (!page_data.title) {
				CeL.warn('next_label_data_work.check_label: Error page_data:');
				CeL.log(page_data);
			}
			foreign_title = page_data.title;
			if (label_data_length <= log_limit) {
				CeL.info('next_label_data_work.check_label: '
						+ CeL.wiki.title_link_of(full_title) + ' → '
						+ CeL.wiki.title_link_of(foreign_title));
			}
			// TODO: 處理作品被連結/導向到作者的情況。
			// full_title 當作 key，不能改變。
		}

		// 去掉被導向到 /^List of /, /の一覧$/ 的情況。
		// [[Wikipedia:格式手冊/獨立列表]], [[Wikipedia:Stand-alone lists]]
		if (/List of|Timeline of|列表|年表|一覧/i.test(foreign_title)) {
			CeL.info('next_label_data_work.check_label: Skip list: '
					+ CeL.wiki.title_link_of(full_title) + ' → '
					+ CeL.wiki.title_link_of(foreign_title));
			// do next.
			setImmediate(next_label_data_work);
			return;
		}

		process_wikidata(full_title, foreign_language, foreign_title);

	}, {
		get_URL_options : {
			onfail : function(error) {
				CeL.error('next_label_data_work: get_URL error: '
						+ CeL.wiki.title_link_of(full_title) + ':');
				console.error(error);
				// 確保沒有因特殊錯誤產生的漏網之魚。
				titles.unique().forEach(processed_data.remove, processed_data);

				/**
				 * do next action. 警告: 若是自行設定 .onfail，則需要自行善後。
				 * 例如可能得在最後自行執行(手動呼叫) wiki.next()， 使 wiki_API.prototype.next()
				 * 知道應當重新啟動以處理 queue。
				 */
				wiki.next();

				setImmediate(next_label_data_work);
			}
		}
	});

}

function finish_work() {
	// Finally: Write to cache file.
	processed_data.write();

	var message = script_name + ': ' + (new Date).format()
			+ ' 已處理完畢 Wikidata 部分。' + (modify_Wikipedia ? '開始處理 ' : '已設定不')
			+ '處理 ' + use_language + ' Wikipedia 上的頁面。';
	CeL.log(message);

	CeL.write_file(
			base_directory + 'en_label_list_of_' + use_language + '.txt',
			en_label_list.join('\n'));
}

// ----------------------------------------------------------------------------

// CeL.set_debug(2);

// rm import_label_from_wiki_link/labels.json
// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
prepare_directory(base_directory);
// prepare_directory(base_directory, true);

try {
	// delete cache.
	// cd import_label_from_wiki_link && rm all_pages* common_title* labels*
	require('fs').unlinkSync(
			base_directory + 'all_pages.' + CeL.wiki.site_name(wiki) + '.json');
} catch (e) {
	// TODO: handle exception
}

if (!modify_Wikipedia) {
	// Only respect maxlag. 因為數量太多，只好增快速度。
	CeL.wiki.query.default_edit_time_interval = 0;
}

var work_queue = [ {
	type : 'callback',
	file_name : 'common_title',
	list : function(callback) {
		CeL.wiki.SPARQL(
		// SELECT ?item ?itemLabel WHERE { ?item wdt:P31 wd:Q6256. }
		'SELECT ?item WHERE{?item wdt:P31 wd:Q6256}', function(items) {
			wiki.data(items.id_list(), callback, {
				props : 'labels|aliases|sitelinks'
			});
		});
		return;

		// 持續 502 @2017/7
		// instance of country
		CeL.wiki.wdq('claim[31:6256]', function(list) {
			callback(list);
		}, {
			session : wiki,
			props : 'labels|aliases|sitelinks'
		});
	}

}, {
	file_name : 'common_title.' + CeL.wiki.site_name(wiki) + '.json',
	list : function(list) {
		var countries = [];
		list.forEach(function(country_data) {
			function add_country_label(language) {
				countries.append(CeL.wiki.data
				//
				.label_of(country_data, language, true, true));
			}

			add_country_label(use_language);
			if (is_zh) {
				add_country_label('zh-tw');
				add_country_label('zh-cn');
				add_country_label('zh-hant');
				add_country_label('zh-hans');
			}
		});

		// old, deprecated:
		if (false && is_zh) {
			wiki.page('模块:CGroup/地名', function(page_data) {
				// prepare PATTERN_common_title
				PATTERN_common_title = ('馬來西亞|印尼|日本|西班牙|葡萄牙|荷蘭|奧地利|捷克'
				//
				+ '|伊莫拉|阿根廷|南非|土耳其').split('|');
				var matched, pattern = /, *rule *= *'([^']+)'/g,
				/**
				 * {String}page content, maybe undefined. 頁面內容 =
				 * CeL.wiki.revision_content(revision)
				 */
				content = CeL.wiki.content_of(page_data);
				while (matched = pattern.exec(content)) {
					PATTERN_common_title.append(matched[1].split(/;|=>/)
					//
					.map(function(name) {
						return name.replace(/^[a-z\-\s]+:/, '').trim()
						//
						.replace(/(?:(?:王|(?:人民)?共和)?[國国]|[州洲]|群?島)$/, '');
					}));
				}
				PATTERN_common_title = PATTERN_common_title
				//
				.sort().unique_sorted();
				// 保留 ''，因為可能只符合
				// postfix。 e.g., '共和國'
				if (false && !PATTERN_common_title[0])
					PATTERN_common_title = PATTERN_common_title.slice(1);
				PATTERN_common_title = new RegExp(
				//
				'^(?:國名)(?:(?:王|(?:人民)?共和)?[國国]|[州洲]|群?島)?$'
				//
				.replace('國名', PATTERN_common_title.join('|')));
			});
		}

		countries = countries.sort().unique_sorted().filter(function(country) {
			return country !== '*';
		});
		// console.trace(countries);
		return {
			source : '^(?:' + countries.join('|') + ')$',
			flags : ''
		};
	},
	operator : function(data) {
		PATTERN_common_title = new RegExp(data.source, data.flags);
	}

}, false && {
	type : 'callback',
	file_name : 'en_titles.json',
	list : get_enwiki_titles,
	operator : function(data) {
		en_titles = data;
	}
}, {
	type : 'callback',
	file_name : 'labels.' + CeL.wiki.site_name(wiki) + '.json',
	reget : true,
	list : create_label_data,
	operator : function(data) {
		label_data = data;
	}

} ];

function main_work() {
	CeL.wiki.cache(work_queue, finish_wikidata_part, {

		// default options === this
		// [SESSION_KEY]
		session : wiki,
		// title_prefix : 'Template:',
		// cache path prefix
		prefix : base_directory
	});
}

wiki.run(main_work);
