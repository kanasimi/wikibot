/*

2020/6/17 6:22:20	初版試營運

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

		// 可省略 `diff_id` 的條件: 以新章節增加請求，且編輯摘要包含 `/* section_title */`
		// 'small_oldid/big_new_diff' or {Number}new
		//diff_id: '',

		// 可省略 `section_title` 的條件: 檔案名稱即 section_title
		//section_title: '',

		summary: '[[Wikipedia:記事名の付け方#記事名に使用できる文字]]が緩和されたからの改名',
	}, {
		//'': DELETE_PAGE,
		//'': REDIRECT_TARGET,
		//'insource:""': '',
		'李承ヨプ (野球)': REDIRECT_TARGET,
		'草なぎ剛': REDIRECT_TARGET,
		'朴ロ美': REDIRECT_TARGET,
		'内田百間': REDIRECT_TARGET,
		'内田百閒': {
			for_each_link(token, index, parent) {
				if (token[2] && token[0].toString() === token[2].toString().replace(/{{CP932フォント\|(.+?)}}/g, '$1')) {
					token.pop();
				}
			}
		}
	});
})();
