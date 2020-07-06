/*

2020/3/17 17:1:5	初版試營運

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
		diff_id: 76612743,
		section_title: 'Category:大英帝国勲章内にある受章者項目のCategory貼り替え'
	}, {
		'Category:大英帝国勲章': 'Category:大英帝国勲章受章者',
	});
})();
