/*

2020/2/26 19:45:1	初版試營運

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
		diff_id: 76361853,
		section_title: 'ソフトウェアの外部リンク用テンプレートの改名に伴うテンプレート名の修正'
	}, {
		'Template:外部リンク/Google Play Store': 'Template:Google Play',
		'Template:外部リンク/Windows Store': 'Template:Microsoft Store',
	});
})();
