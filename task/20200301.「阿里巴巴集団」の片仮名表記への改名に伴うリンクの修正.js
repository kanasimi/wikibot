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
		diff_id: 76407097,
		section_title: '「阿里巴巴集団」の片仮名表記への改名に伴うリンクの修正'
	}, {
		'阿里巴巴集団': 'アリババグループ',
	});
})();
