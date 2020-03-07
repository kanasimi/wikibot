/*

2020/3/7 6:41:57	初版試營運

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
		diff_id: 76485890,
		section_title: '「新型コロナウイルス感染症の流行 (2019年-)」へのリンク修正依頼'
	}, {
		'2019年-2020年中国武漢における肺炎の流行': '新型コロナウイルス感染症の流行 (2019年-)',
	});
})();
