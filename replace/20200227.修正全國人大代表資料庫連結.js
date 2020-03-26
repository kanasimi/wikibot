/*

2020/2/27 21:13:18	初版試營運

 */

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');
//import { replace } from './replace_tool.js';

// ----------------------------------------------------------------------------

//async function main_process()
(async () => {
	await replace_tool.replace({
		language: 'zh',
		//summary: '',
		// 'small_oldid/big_new_diff' or {Number}new
		diff_id: 57854080,
		section_title: '修正全国人大代表数据库链接'
	}, {
		'http://www.npc.gov.cn/delegate/': 'http://210.82.31.1:8084/delegate/',
	});
})();
