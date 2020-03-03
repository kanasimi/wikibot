/*

2020/2/27 16:38:47	初版試營運

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
		diff_id: '76363602/76367662',
		section_title: '名探偵コナン (アニメ) のエピソード一覧のリンク修正'
	}, {
		'名探偵コナン (アニメ) のエピソード一覧': '名探偵コナンのアニメエピソード一覧',
	});
})();
