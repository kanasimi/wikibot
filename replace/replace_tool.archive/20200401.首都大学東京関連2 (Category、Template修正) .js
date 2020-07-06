/*

2020/4/1 8:7:34	初版試營運

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
		diff_id: 76853014,
		section_title: '首都大学東京関連2 (Category、Template修正) '
	}, {
		'Category:首都大学東京': 'Category:東京都立大学',
		'Category:首都大学東京学長': 'Category:東京都立大学学長',
		'Category:首都大学東京の人物': 'Category:東京都立大学の人物',
		'Template:首都大学東京': 'Template:東京都立大学',
		'Template:首都大学東京の前身諸機関': 'Template:東京都立大学の前身諸機関',
		'Category:首都大学東京出身の人物': 'Category:東京都立大学出身の人物',
	});
})();
