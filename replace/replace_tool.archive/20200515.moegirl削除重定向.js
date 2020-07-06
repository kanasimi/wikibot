/*

2020/5/15 16:52:45	初版試營運

 */

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');
//import { replace } from './replace_tool.js';

// ----------------------------------------------------------------------------

//async function main_process()
(async () => {
	await replace_tool.replace({
		//language: 'zh',
		API_URL: 'https://zh.moegirl.org/api.php',

		// 可省略 `diff_id` 的條件: 以新章節增加請求，且編輯摘要包含 `/* section_title */`
		// 'small_oldid/big_new_diff' or {Number}new
		diff_id: 3840228,

		// 可省略 `section_title` 的條件: 檔案名稱即 section_title
		section_title: '削除重定向',

		//summary: '',
	}, {
		//'': DELETE_PAGE,
		//'': REDIRECT_TARGET,
		'长鸿娘': { move_to_link: '长鸿出版社', keep_title: true },
	});
})();
