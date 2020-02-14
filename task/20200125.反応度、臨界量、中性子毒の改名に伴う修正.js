/*

2020/1/25 9:16:13	初版試營運

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
		diff_id: '75666797/75713740',
		section_title: '反応度、臨界量、中性子毒の改名に伴う修正'
	}, {
		'反応度 (原子力)': '反応度',
		'臨界量 (原子力)': '臨界量',
		'毒物質 (原子力)': '中性子毒',
	});
})();
