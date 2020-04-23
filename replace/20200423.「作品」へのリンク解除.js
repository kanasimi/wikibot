/*

2020/4/23 17:47:29	初版試營運

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
		'作品': {
			list_intersection: 'Category:すべての曖昧さ回避',
			move_to_link: DELETE_PAGE
		},
		'「映画」「絵画」「漫画」「ゲーム」「楽曲」「シングル」「アルバム」のいずれかを名前に含んだカテゴリが付いた記事': {
			move_from_link: '作品',
			list_intersection: {
				list_types: 'allcategories',
				list_filter: page_data => /映画|絵画|漫画|ゲーム|楽曲|シングル|アルバム/.test(page_data.title),
			},
			move_to_link: DELETE_PAGE
		}
	});
})();
