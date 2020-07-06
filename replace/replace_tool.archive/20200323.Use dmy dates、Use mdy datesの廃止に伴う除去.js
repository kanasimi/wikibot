/*

2020/3/23 16:58:28	初版試營運

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
		diff_id: 76720109,
		section_title: 'Use dmy dates、Use mdy datesの廃止に伴う除去'
	}, {
		'Template:Use dmy dates': DELETE_PAGE,
		'Template:Use mdy dates': DELETE_PAGE,
	});
})();
