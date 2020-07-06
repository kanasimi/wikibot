/*

2020/2/15 10:51:37	初版試營運

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
		diff_id: 76198390,
		section_title: 'Category:バンディオンセ加古川の選手の貼り替え'
	}, {
		'Category:バンディオンセ加古川の選手': 'Category:Cento Cuore HARIMAの選手',
	});
})();
