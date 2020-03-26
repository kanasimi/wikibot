/*

2020/2/12 10:1:17	初版試營運

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
		diff_id: '76137946/76150720',
		section_title: 'りゅうこうじ→笠浩二のリンク修正'
	}, {
		'りゅうこうじ': '笠浩二',
	});
})();
