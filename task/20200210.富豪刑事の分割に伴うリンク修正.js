/*

2020/2/10 14:39:40	初版試營運

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
		diff_id: 76008546,
		section_title: '富豪刑事の分割に伴うリンク修正'
	}, {
		'富豪刑事#テレビドラマ': '富豪刑事 (テレビドラマ)#',
		'富豪刑事#|富豪刑事デラックス': '富豪刑事デラックス',
		'富豪刑事#第1シリーズ（2005年）': '富豪刑事 (テレビドラマ)#第1シリーズ（2005年）',
		'富豪刑事#第2シリーズ（2006年）': '富豪刑事 (テレビドラマ)#第2シリーズ（2006年）',
		'富豪刑事#第1シリーズ': '富豪刑事 (テレビドラマ)#第1シリーズ（2005年）',
	});
})();
