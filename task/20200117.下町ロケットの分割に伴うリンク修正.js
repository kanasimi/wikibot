/*

2020/1/1 15:49:56	初版試營運

 */

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');
//import { replace } from './replace_tool.js';

// ----------------------------------------------------------------------------

//async function main_process()
(async () => {
	await replace_tool.replace({
		language: 'ja',
		//summary: '',
		// 'small_oldid/big_new_diff' or {Number}new
		diff_id: 75768833,
		section_title: '下町ロケットの分割に伴うリンク修正'
	}, {
		'下町ロケット': {
			for_each_link(token, index, parent) {
				// console.log(token);
				switch (token.anchor) {
					case 'WOWOW版':
						token[0] = '下町ロケット (WOWOWのテレビドラマ)';
						token[1] = '';
						break;

					case 'TBS版':
						token[0] = '下町ロケット (TBSのテレビドラマ)';
						token[1] = '';
						break;
				}
			}
		}
	});
})();
