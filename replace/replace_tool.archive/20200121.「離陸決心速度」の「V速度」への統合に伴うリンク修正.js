/*

2020/1/21 ‏‎19:35:47	初版試營運

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
		diff_id: 75852488,
		section_title: '「離陸決心速度」の「V速度」への統合に伴うリンク修正'
	}, {
		'離陸決心速度': 'V速度#V1の定義'
	});
})();
