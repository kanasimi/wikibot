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
		diff_id: '75554468/75573475',
		section_title: 'ブランドとしてのXboxの記事作成に伴うリンク修正'
	}, {
		'Xbox': 'Xbox (ゲーム機)'
	});
})();
