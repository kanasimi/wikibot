/*

search and replace wikitext

 2017/8/28 18:42:12	初版試營運。


 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

/* eslint no-use-before-define: ["error", { "functions": false }] */
/* global CeL */
/* global Wiki */

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'ja'),

search_key = /\[\[::en:/i,

diff_id = 65258423,

/** {String}編輯摘要。總結報告。 */
summary = '[[' + (diff_id ? 'Special:Diff/' + diff_id : 'WP:BOTREQ')
		+ '|Bot作業依頼]]：英語版ウィキペディアへのウィキリンク書式の修正依頼 - [[' + log_to + '|log]]';

// ----------------------------------------------------------------------------

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

		return content.replace(/\[\[::en:/ig, '[[:en:');
	},
	log_to : log_to
}, {
	srlimit : 1
});
