/*

2020/2/9 19:6:35	初版試營運

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
		summary: 'レイダーズからレイダースへの改名',
		// 'small_oldid/big_new_diff' or {Number}new
		diff_id: 76067457,
		section_title: 'ラスベガス・レイダース'
	}, {
		'insource:"ラスベガス・レイダーズ"': 'ラスベガス・レイダース',
		'insource:"オークランド・レイダーズ"': 'オークランド・レイダース',
		'insource:"ロサンゼルス・レイダーズ"': 'ロサンゼルス・レイダース',
	});
})();
