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
		diff_id: '76110329/76110990',
		section_title: '「レッジーナ1914」関連ページの貼り換えのbot作業依頼'
	}, {
		'ASDレッジョ・カラブリア': 'レッジーナ1914',
		'Template:ASDレッジョ・カラブリアのメンバー': 'Template:レッジーナ1914のメンバー',
		'Template:ASDレッジョ・カラブリア歴代監督': 'Template:レッジーナ1914歴代監督',
		'Category:ASDレッジョ・カラブリアの選手': 'Category:レッジーナ1914の選手',
	});
})();
