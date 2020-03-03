/*

2020/2/3 19:43:55	初版試營運

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
		diff_id: 76040803,
		section_title: 'Category:日テレ・ベレーザの選手の貼り替え'
	}, {
		'Category:日テレ・ベレーザの選手': 'Category:日テレ・東京ヴェルディベレーザの選手',
	});
})();
