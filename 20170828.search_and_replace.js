/*

search and replace wikitext

 2017/8/28 18:42:12	初版試營運。
 2017/8/28 20:15:24 完成。正式運用。

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
set_language('ja');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),
// [ [ search_key, replace_to ], ... ]
replace_pairs = [ [ /\[\[:+(en|de):+\1:+/ig, '[[:$1:' ],
		[ /\[\[:{2,}(en|de):+/ig, '[[:$1:' ],
		[ /\[\[:(en|de):{2,}/ig, '[[:$1:' ] ],

diff_id = 65258423,

/** {String}編輯摘要。總結報告。 */
summary = '[[' + (diff_id ? 'Special:Diff/' + diff_id : 'WP:BOTREQ')
		+ '|Bot作業依頼]]：英語版ウィキペディアへのウィキリンク書式の修正依頼 - [[' + log_to + '|log]]';

// ----------------------------------------------------------------------------

if (replace_pairs.length === 2 && !Array.isArray(replace_pairs)) {
	replace_pairs = [ replace_pairs ];
}

CeL.run_serial(for_pair, replace_pairs, function() {
	CeL.log(replace_pairs.length + ' pair(s) replaced.');
});

function for_pair(run_next, pair) {
	// console.log(pair);
	var search_key = pair[0], replace_to = pair[1];
	wiki.search(search_key, {
		summary : summary,
		each : function(page_data, messages, config) {
			/** {String}page title = page_data.title */
			var title = CeL.wiki.title_of(page_data),
			/**
			 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
			 */
			content = CeL.wiki.content_of(page_data);

			if (!content) {
				return [ CeL.wiki.edit.cancel,
				//
				'No contents: [[' + title + ']]! 沒有頁面內容！' ];
			}

			return content.replace(search_key, replace_to);
		},
		last : run_next,
		log_to : log_to
	}, {
	// srlimit : 1
	});
}
