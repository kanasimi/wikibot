/*

2020/5/17 5:5:59	初版試營運

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
		diff_id: 3849684,

		// 可省略 `section_title` 的條件: 檔案名稱即 section_title
		section_title: '请求移动页面：艾瑞莎·西园寺 -> 艾瑞莎·西门子',

		//summary: '',
	}, {
		//'': DELETE_PAGE,
		//'': REDIRECT_TARGET,
		'艾瑞莎·西园寺': { move_to_link: '艾瑞莎·西门子', do_move_page: true },
	});
})();
