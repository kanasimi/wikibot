/*

2020/2/4 19:41:22	初版試營運

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
		diff_id: 76003750,
		section_title: '「パルマ・カルチョ1913」関連ページの貼り換えのbot作業依頼'
	}, {
		'SSDパルマ・カルチョ1913': 'パルマ・カルチョ1913',
		'Template:SSDパルマ・カルチョ1913のメンバー': 'Template:パルマ・カルチョ1913のメンバー',
		'Category:SSDパルマ・カルチョ1913の選手': 'Category:パルマ・カルチョ1913の選手',
	});
})();
