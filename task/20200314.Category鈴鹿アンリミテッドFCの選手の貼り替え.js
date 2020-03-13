/*

2020/3/14 5:11:48	初版試營運

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
		diff_id: 76588305,
		section_title: 'Category:鈴鹿アンリミテッドFCの選手の貼り替え'
	}, {
		'Category:鈴鹿アンリミテッドFCの選手': 'Category:鈴鹿ポイントゲッターズの選手',
	});
})();
