'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

// ----------------------------------------------------------------------------

const PATTERN_to_replace = /(style *=.+;)(?: *;)+/g;

replace_tool.replace({
	not_bot_requests: true,

	summary: '[[Special:Diff/88329752#サポート対象外になったブラウザとの互換性テンプレートの廃止作業|Bot作業依頼]]: セミコロン1つに変更する - [[User:Cewbot/log/20190913|log]]',
}, {
	'insource:/; *;/': {
		namespace: 'main',
		//namespace: 'template',
		text_processor(wikitext) {
			if (PATTERN_to_replace.test(wikitext)) {
				PATTERN_to_replace.lastIndex = 0;
				return wikitext.replace(PATTERN_to_replace, (all, front) => front);
			}
		}
	},
});
