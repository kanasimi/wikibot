/*

search and replace wikitext

2017/8/28 18:42:12	初版試營運。
2017/8/28 20:15:24	完成。正式運用。

@see [[mw:Manual:Pywikibot/replace.py]]

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
// set_language('en');
var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),
// replace_pairs = [
// [ search_key, replace_from, replace_to ],
// [ search_key, replace_to ], ... ]
replace_pairs, diff_id;

// ----------------------------------------------------------------------------

// 2017/8/28
summary = '英語版ウィキペディアへのウィキリンク書式の修正依頼', diff_id = 65258423;
replace_pairs = [ [ /\[\[:+(en|de):+\1:+/ig, '[[:$1:' ],
		[ /\[\[:{2,}(en|de):+/ig, '[[:$1:' ],
		[ /\[\[:(en|de):{2,}/ig, '[[:$1:' ] ];

// 2017/8/29
summary = 'FCバイエルン・ミュンヘン関連', diff_id = '65287149/65287930';
replace_pairs = [ [ /\[\[(バイエルン・ミュンヘン)\]\]/g, '[[FCバイエルン・ミュンヘン|$1]]' ],
		[ /\[\[バイエルン・ミュンヘン([\|#])/g, '[[FCバイエルン・ミュンヘン$1' ] ];

// 2017/9/4
summary = 'インターネットアーカイブ', diff_id = 65368586;
replace_pairs = [ /\[\[インターネット・アーカイブ([\|#\]])/g, '[[インターネットアーカイブ$1' ];

// 2017/9/12 17:49:44
summary = [ 'WikiProject Asessment banner replacement',
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

// 2017/9/18 16:30:56
summary = '乃木坂46メンバーのMain2の書き換え', diff_id = '65542796/65549970';
replace_pairs = [ 'insource:"乃木坂46#出演"', /乃木坂46#出演/g, '乃木坂46の出演一覧' ];

// 2017/9/19 16:37:22
summary = '申請批量更正中國大陸城市商業銀行模板', diff_id = '46059917/46250288';
replace_pairs = [ /中华人民共和国地方商业银行/g, '中华人民共和国城市商业银行' ];

// ----------------------------------------------------------------------------

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
	if (pair.length === 2) {
		replace_from = pair[0];
		replace_to = pair[1];
	} else {
		// assert: pair.length === 3
		replace_from = pair[1];
		replace_to = pair[2];
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
				return [ CeL.wiki.edit.cancel,
						'No contents: [[' + title + ']]! 沒有頁面內容！' ];
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
	});
}
