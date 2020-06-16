/*

2020/6/16 5:31:0	初版試營運

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

		//summary: '',
	}, {
		//'': DELETE_PAGE,
		//'': REDIRECT_TARGET,
		'高島屋': REDIRECT_TARGET,
		'伊予鉄高島屋': REDIRECT_TARGET,
		'柏高島屋ステーションモール': REDIRECT_TARGET,
		'今治高島屋': REDIRECT_TARGET,
		'高島屋バラ劇場': REDIRECT_TARGET,
		'高島屋クレジット': REDIRECT_TARGET,
		'Category:高島屋': REDIRECT_TARGET,
		'Category:高島屋の人物': REDIRECT_TARGET,
	});
})();
