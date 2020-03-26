/*

2020/3/25 6:56:56	初版試營運

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
		diff_id: 76750962,
		section_title: '首都大学東京関連1（リンクの修正、カテゴリ修正）'
	}, {
		'東京都立大学': '東京都立大学 (1949-2011)',
		'Category:東京都立大学の教員': 'Category:旧東京都立大学の教員',
	});
})();
