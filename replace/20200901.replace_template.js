// 

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');
//import { replace } from './replace_tool.js';

// ----------------------------------------------------------------------------

//async function main_process()
//(async () => { await replace_tool.replace({ ... }); })();
replace_tool.replace({
	no_notice: true,

	//language: 'ja',
	//API_URL: 'https://zh.moegirl.org/api.php',

	// 可省略 `diff_id` 的條件: 以新章節增加請求，且編輯摘要包含 `/* section_title */`
	// 'small_oldid/big_new_diff' or {Number}new
	//diff_id: '',

	// 可省略 `section_title` 的條件: 檔案名稱即 section_title
	//section_title: '',

	//summary: '',

	// Speedy renaming or speedy merging
	//speedy_criteria: 'merging',
}, {
	'title#anchor|display_text': 'title#anchor|display_text',
	'from_title': REDIRECT_TARGET,
	'from_title': DELETE_PAGE,
	'insource:"from_text"': 'to_text',
	'http://url': 'https://url',

	// no anchor
	'title#|display_text': '',
	'title#': '',

	'': {
		move_to_link: 'to_title',
		move_from_link: '作品',
		do_move_page: true,

		// for debug
		page_list : [],

		// 當設定 list_intersection 時，會取得 task_configuration.move_from_link 與各 list_intersection 的交集(AND)。
		list_intersection: 'Category:',

		keep_title: true,
		namespace: 'Category',

		//對於追蹤類別 [[Category:Tracking categories]]，不會算入 [[Template:name/doc]]。例如 [[Category:Pages using deprecated source tags]]
		is_tracking_category: true,

		text_processor(wikitext, page_data) { return wikitext.replace(/./g, ''); },
		text_processor(wikitext, page_data) {
			/** {Array} parsed page content 頁面解析後的結構。 */
			const parsed = page_data.parse();
			let changed;
			parsed.each('template', token => {
				if (token.name !== '')
					return;
				parsed.each.call(token, 'template', (token, index, parent) => {
					changed = true;
					parent[index] = '';
				});
			});
			if (changed)
				return parsed.toString();
		},
		for_each_link(token, index, parent) { },

		before_get_pages(page_list, edit_options) { edit_options.summary += ''; },
	},

	'Template:from_title': {
		list_types: 'embeddedin',
		for_template(token, index, parent) { CeL.wiki.parse.replace_parameter(token, config, 'parameter_name_only'); },
	},

});
