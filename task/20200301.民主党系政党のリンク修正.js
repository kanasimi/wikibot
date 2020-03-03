/*

2020/3/1 14:33:7	初版試營運

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
		diff_id: 76398503,
		section_title: '民主党系政党のリンク修正'
	}, {
		'民主党系政党': '大韓民国の民主党系政党',
	});
})();
