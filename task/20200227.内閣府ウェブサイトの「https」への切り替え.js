/*

2020/2/27 17:49:57	初版試營運

 */

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');
//import { replace } from './replace_tool.js';

// ----------------------------------------------------------------------------

const _replace_to = {
	text_processor(wikitext, page_data) {
		const PATTERN = /^http(:\/\/[a-z\d.]+?\.cao\.go\.jp(?:\/|$))/i;
		/** {Array} parsed page content 頁面解析後的結構。 */
		const parsed = page_data.parse();
		let changed;
		parsed.each('external_link', link_token => {
			if (PATTERN.test(link_token[0])) {
				changed = true;
				link_token[0] = link_token[0].toString().replace(PATTERN, 'https$1');
			}
		});
		wikitext = parsed.toString();
		// TODO: for others
		if (changed)
			return wikitext;
	}
};

const replace_to = { replace_protocol_to: 'https' };

//async function main_process()
(async () => {
	await replace_tool.replace({
		language: 'ja',
		//summary: '',
		// 'small_oldid/big_new_diff' or {Number}new
		diff_id: 76300222,
		section_title: '内閣府ウェブサイトの「https:」への切り替え'
	}, {
		'http://www.cao.go.jp': replace_to,
		'http://www5.cao.go.jp': replace_to,
		'http://www8.cao.go.jp': replace_to,
		'http://www.esri.cao.go.jp': replace_to,
	});
})();
