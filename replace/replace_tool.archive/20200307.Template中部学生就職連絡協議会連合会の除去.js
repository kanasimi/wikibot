/*

2020/3/7 16:36:59	初版試營運

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
		diff_id: 76494157,
		section_title: 'Template:中部学生就職連絡協議会連合会の除去'
	}, {
		'Template:中部学生就職連絡協議会連合会': DELETE_PAGE,
	});
})();
