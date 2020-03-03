/*

2020/2/9 18:5:24	初版試營運

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
		diff_id: 76111002,
		section_title: '「S.P.A.L.」関連ページの貼り換えのbot作業依頼'
	}, {
		'SPAL 2013': 'S.P.A.L.',
		'Template:SPAL 2013のメンバー': 'Template:S.P.A.L.のメンバー',
		'Category:SPAL 2013の選手': 'Category:S.P.A.L.の選手',
	});
})();
