/*

search and replace wikitext

node 20170828.search_and_replace.js

2017/8/28 18:42:12	初版試營運。
2017/8/28 20:15:24	完成。正式運用。

@see [[mw:Manual:Pywikibot/replace.py]]

TODO: 同一個replace test中多個replace pair。
https://www.mediawiki.org/wiki/Help:Extension:AdvancedSearch

for カテゴリ:
check {{リダイレクトの所属カテゴリ}}

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

/* eslint no-use-before-define: ["error", { "functions": false }] */
/* global CeL */
/* global Wiki */

// Set default language. 改變預設之語言。 e.g., 'zh'
// 採用這個方法，而非 Wiki(true, 'ja')，才能夠連報告介面的語系都改變。
// set_language('ja');
var
// replace_pairs = [
// [ search_key, replace_from, replace_to ],
// [ search_key, replace_to ], ... ]
replace_pairs, diff_id, section_title;

summary = '';

// ----------------------------------------------------------------------------

// --------------------------
// 2017/8/28
set_language('ja');
section_title = '英語版ウィキペディアへのウィキリンク書式の修正依頼', diff_id = 65258423;
replace_pairs = [ [ /\[\[:+(en|de):+\1:+/ig, '[[:$1:' ],
		[ /\[\[:{2,}(en|de):+/ig, '[[:$1:' ],
		[ /\[\[:(en|de):{2,}/ig, '[[:$1:' ] ];

// --------------------------
// 2017/8/29
set_language('ja');
section_title = 'FCバイエルン・ミュンヘン関連', diff_id = '65287149/65287930';
replace_pairs = [ [ /\[\[(バイエルン・ミュンヘン)\]\]/g, '[[FCバイエルン・ミュンヘン|$1]]' ],
		[ /\[\[バイエルン・ミュンヘン([\|#])/g, '[[FCバイエルン・ミュンヘン$1' ] ];

// --------------------------
// 2017/9/4
set_language('ja');
section_title = 'インターネットアーカイブ', diff_id = 65368586;
replace_pairs = [ /\[\[インターネット・アーカイブ([\|#\]])/g, '[[インターネットアーカイブ$1' ];

// --------------------------
// 2017/9/12 17:49:44
set_language('en');
section_title = [ 'WikiProject Asessment banner replacement',
		'[[Template:WikiProject Investment]] → [[Template:WikiProject Finance]]' ];
diff_id = 799598464;
// https://www.mediawiki.org/wiki/Help:CirrusSearch
// 'hastemplate:"WikiProject Investment" -hastemplate:"WikiProject Finance"',
replace_pairs = [
		'hastemplate:"WikiProject Investment"',
		// "{{WP__Investment}}" is also OK! Treat as "{{WP Investment}}"
		// e.g., [[en:Talk:W. David Wilson]]
		/{{ *(?:(?:WikiProject|WP)[ _]+Investment|WPINVESTMENT)(?:[ \n]+|<!--[\s\S]+?-->)*(\|[^{}]*)?}}(\n?)/,
		'{{WikiProject Finance$1}}$2' ];
var PATTERN_Finance = /{{ *(?:WikiProject|WP)[ _]+Finance(?:[ \n]+|<!--[\s\S]+?-->)*(\|[^{}]*)?}}/;

// --------------------------
// 2017/9/18 16:30:56
set_language('ja');
section_title = '乃木坂46メンバーのMain2の書き換え', diff_id = '65542796/65549970';
replace_pairs = [ 'insource:"乃木坂46#出演"', /乃木坂46#出演/g, '乃木坂46の出演一覧' ];

// --------------------------
// 2017/9/19 16:37:22
set_language('zh');
section_title = '申請批量更正中國大陸城市商業銀行模板', diff_id = '46059917/46250288';
replace_pairs = [ /中华人民共和国地方商业银行/g, '中华人民共和国城市商业银行' ];

// --------------------------
// 2017/9/21 17:13:4
set_language('en');
section_title = 'Fix adaptivepath links', diff_id = '801185223/801407891';
replace_pairs = [
		/https:\/\/web\.archive\.org\/web\/\d+\/http:\/\/www\.adaptivepath\.com\//g,
		'http://www.adaptivepath.org/' ];

// --------------------------
// 2017/9/23 10:17:20
set_language('ja');
section_title = '「朝日放送・テレビ朝日金曜9時枠の連続ドラマ」関連のリンク修正', diff_id = 65646041;
replace_pairs = [ /テレビ朝日・ABC金曜9時枠の連続ドラマ/g, '朝日放送・テレビ朝日金曜9時枠の連続ドラマ' ];

// --------------------------
// 2017/9/30 20:39:30
set_language('ja');
section_title = '毎日放送とテレビ愛知制作のアニメの内部リンク貼り替え依頼', diff_id = 65748692;
// TODO: parameters in templates.
// e.g., [[新伍のワガママ大百科]] "放送枠 = 毎日放送制作土曜夕方6時枠"
// e.g., [[2012年のテレビアニメ (日本)]] "{{Main|毎日放送制作日曜夕方5時枠}}"
// e.g., [[テレビ愛知]] "{{See|テレビ愛知制作土曜朝8時枠}}"
replace_pairs = [
		[ /\[\[ *毎日放送制作日曜夕方5時枠 *([\|#\]])/g, '[[毎日放送制作日曜夕方5時枠のアニメ$1' ],
		[ /\[\[ *毎日放送制作土曜夕方6時枠 *([\|#\]])/g, '[[毎日放送制作土曜夕方6時枠のアニメ$1' ],
		[ /\[\[ *テレビ愛知制作土曜朝8時枠 *([\|#\]])/g, '[[テレビ愛知制作土曜朝8時枠のアニメ$1' ],
		[ /\{\{ *テレビ愛知制作土曜朝8時枠 *([\|#\}])/g, '{{テレビ愛知制作土曜朝8時枠のアニメ$1' ] ];

// --------------------------
// 2017/9/30 21:20:42
set_language('ja');
section_title = '「スッキリ (テレビ番組)」関連のリンク修正', diff_id = 65749317;
replace_pairs = [ /\{\{ *スッキリ!! *([\|#\}])/g, '{{スッキリ (テレビ番組)$1' ];

// --------------------------
// 2017/10/22 6:32:57
set_language('ja');
section_title = 'ロボマスターズ', diff_id = '65749913/65763833';
summary = 'ROBO MASTERS THE ANIMATED SERIES⇒ROBOMASTERS THE ANIMATED SERIESのリンク元修正';
replace_pairs = [ /ROBO MASTERS THE ANIMATED SERIES/g,
		'ROBOMASTERS THE ANIMATED SERIES' ];
summary = '';

// --------------------------
// 2017/10/22 6:58:26
set_language('ja');
section_title = '「帰れまサンデー」へのリンクの変更依頼', diff_id = 66004907;
replace_pairs = [
		// [ /\[\[ *帰れま10#帰れまサンデー *\| *帰れまサンデー\]\]/g, '[[帰れまサンデー]]' ],
		[ 'insource:"[[帰れま10#帰れまサンデー|帰れまサンデー]]"',
				/\[\[ *帰れま10#帰れまサンデー *\| *帰れまサンデー\]\]/g, '[[帰れまサンデー]]' ],

		// [ /\[\[ *帰れま10#帰れまサンデー *([\|\]])/g, '[[帰れまサンデー$1' ],
		[ 'insource:"[[帰れま10#帰れまサンデー|"', /\[\[ *帰れま10#帰れまサンデー *([\|\]])/g,
				'[[帰れまサンデー$1' ],
		[ 'insource:"[[帰れま10|帰れまサンデー]]"', /\[\[ *帰れま10 *\| *帰れまサンデー *\]\]/g,
				'[[帰れまサンデー]]' ],

		// [ /\[\[ *帰れま10 *\| *帰れまサンデープラス *\]\]/g, '[[帰れまサンデー|帰れまサンデープラス]]' ]
		[ 'insource:"[[帰れま10|帰れまサンデープラス]]"',
				/\[\[ *帰れま10 *\| *帰れまサンデープラス *\]\]/g, '[[帰れまサンデー|帰れまサンデープラス]]' ] ];

// --------------------------
// 2017/11/10 19:28:29
set_language('zh');
section_title = '修復先前Uploadvionotice模板的地區詞轉換錯誤', diff_id = 46870119;
replace_pairs = [
		[ 'insource:"-{zh-cn:文件; zh-tw:檔案;}-"', /-{zh-cn:文件; zh-tw:檔案;}-/g,
				'-{zh-cn:文件;zh-tw:檔案;}-' ],
// [ 'insource:"-{zh-cn:信息; zh-tw:資訊;}-"', /-{zh-cn:信息; zh-tw:資訊;}-/g,
// '-{zh-cn:信息;zh-tw:資訊;}-' ]
];

// --------------------------
// 2017/11/10 19:28:29
set_language('zh');
section_title = '移除上海教堂、上海宗教建筑模板', diff_id = 46915146;
replace_pairs = [
		[
				'hastemplate:"上海宗教建筑"',
				/{{ *(?:上海宗教建筑|上海宗教建築|上海教堂)(?:[ \n]+|<!--[\s\S]+?-->)*(\|[^{}]*)?}}(\n?)/g,
				'' ],
		[
				'hastemplate:"上海教堂"',
				/{{ *(?:上海宗教建筑|上海宗教建築|上海教堂)(?:[ \n]+|<!--[\s\S]+?-->)*(\|[^{}]*)?}}(\n?)/g,
				'' ] ];

// --------------------------
// 2017/12/9 6:37:43
set_language('ja');
section_title = '「森村誠一の終着駅シリーズ」へのリンクの変更依頼', diff_id = '66411347/66561349';
replace_pairs = [ /森村誠一・終着駅シリーズ/g, '森村誠一の終着駅シリーズ' ];

// --------------------------
// 2019/5/27 17:9:50
set_language('zh');
section_title = diff_id = null;
// search and print. do not replace.
replace_pairs = [ /\{\{[^}\u00A0]*\u00A0/ ];

// ----------------------------------------------------------------------------

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true);

summary = summary || section_title;
if (!Array.isArray(summary)) {
	// [ section title of [[WP:BOTREQ]], title shown ]
	summary = [ summary, summary ];
}

/** {String}編輯摘要。總結報告。 */
summary = '[['
		+ (diff_id ? 'Special:Diff/' + diff_id
				+ (summary[0] ? '#' + summary[0] : '') : 'WP:BOTREQ')
		+ '|'
		+ (use_language === 'ja' ? 'Bot作業依頼'
				: use_language === 'zh' ? '機器人作業請求' : 'Bot request') + ']]: '
		+ summary[1] + ' - [[' + log_to + '|log]]';

if (!Array.isArray(replace_pairs[0])) {
	// e.g., replace_pairs = [ from, to ]
	replace_pairs = [ replace_pairs ];
}

// CeL.set_debug(6);

CeL.run_serial(for_pair, replace_pairs, function() {
	CeL.log(replace_pairs.length + ' pair(s) replaced.');
});

function for_pair(run_next, pair) {
	// console.log([ 'pair:', pair ]);
	var search_key = pair[0], replace_from, replace_to;
	if (pair.length < 3) {
		replace_from = pair[0];
		replace_to = pair[1];
	} else {
		// assert: pair.length === 3
		replace_from = pair[1];
		replace_to = pair[2];
	}
	if (!search_key || !replace_from) {
		CeL.warn('未設定搜尋標的: ' + JSON.stringify(pair));
		return;
	}

	wiki.search(search_key, {
		each : function(page_data, messages, config) {
			/** {String}page title = page_data.title */
			var title = CeL.wiki.title_of(page_data),
			/**
			 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
			 */
			content = CeL.wiki.content_of(page_data);

			if (!content) {
				return [
						CeL.wiki.edit.cancel,
						'No contents: ' + CeL.wiki.title_link_of(title)
								+ '! 沒有頁面內容！' ];
			}

			// 額外的替換作業。
			if (false) {
				content = content.replace(/-{zh-cn:信息; zh-tw:資訊;}-/g,
						'-{zh-cn:信息;zh-tw:資訊;}-');
			}

			if (!replace_to) {
				var matched = content.match(replace_from);
				if (matched) {
					delete matched.input;
					CeL.log(CeL.wiki.title_link_of(title) + ': ' + matched);
				}

				return;
			}

			return content.replace(replace_from, replace_to);

			// ------------------------------------------------------
			// 不造成重複的 template。
			return;

			var Investment_parameters = content.match(replace_from);
			if (!Investment_parameters) {
				return [ CeL.wiki.edit.cancel, 'Nothing to replace' ];
			}
			Investment_parameters = (Investment_parameters[1] || '').replace(
					/\s/g, '').toLowerCase();
			var Finance_parameters = content.match(PATTERN_Finance);
			if (Finance_parameters) {
				Finance_parameters = (Finance_parameters[1] || '').replace(
						/\s/g, '').toLowerCase();
				if (!Finance_parameters && Investment_parameters) {
					// "{{Finance}}""{{Investment|...}}"
					// → """{{Investment|...}}"
					content = content.replace(PATTERN_Finance, '');
					// and will → """{{Finance|...}}"
					Finance_parameters = null;
				}
			}
			if (Investment_parameters && Finance_parameters
			//
			&& !Finance_parameters.includes(Investment_parameters)) {
				// "{{Finance|p1}}""{{Investment|p2}}"
				var warning = "'''<nowiki>" + content.match(replace_from)[0]
						+ "</nowiki>''' != '''<nowiki>"
						+ content.match(PATTERN_Finance)[0] + "</nowiki>'''";
				// return [ CeL.wiki.edit.cancel, warning ];

				// just replace those too.
				// "{{Finance|p1}}""{{Investment|p2}}" → "{{Finance|p1}}"
				messages.add(warning, page_data);
			}

			// "{{Investment|p}}" → "{{Finance|p}}"
			// "{{Finance|p1}}""{{Investment|p1}}" → "{{Finance|p1}}"""
			return content.replace(replace_from, Finance_parameters ? ''
					: replace_to);
		},
		summary : summary,
		last : run_next,
		log_to : log_to
	}, {
	// https://www.mediawiki.org/w/api.php?action=help&modules=query%2Bsearch

	// for test
	// srlimit : 1,

	// srnamespace : 'module|template|category|main'
	// srnamespace : 'template|main'
	// srnamespace : 'talk|template_talk|category_talk'
	// srnamespace : 'User talk'
	});
}
