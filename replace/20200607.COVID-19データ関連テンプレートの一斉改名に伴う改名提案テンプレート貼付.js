/*

2020/6/7 6:19:27	初版試營運

 */

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');
//import { replace } from './replace_tool.js';

// ----------------------------------------------------------------------------

function add_template(wikitext, page_data) {
	if (/{{\s*改名提案\s*\|/.test(wikitext))
		return;
	//console.log(this);
	wikitext = `<noinclude>{{改名提案|${this.move_title_pair[page_data.original_title]
		|| this.move_title_pair[page_data.title]
		|| '「Template:COVID-19の流行データ」から始まるページ名'}|t=Template‐ノート:2019-nCoV_Data#改名提案|date=2020年6月}}</noinclude>` + wikitext;
	//console.log(wikitext);
	return wikitext;
}

async function setup_move_configuration(meta_configuration) {
	/** {Object}wiki operator 操作子. */
	const wiki = meta_configuration.wiki;

	const move_title_pair = Object.create(null);

	const list_page_data = await wiki.page('Template‐ノート:2019-nCoV Data');
	/** {Array} parsed page content 頁面解析後的結構。 */
	const parsed = list_page_data.parse();
	parsed.each('table', table => {
		if (table.caption === '改名候補の一覧')
			replace_tool.parse_move_pairs_from_link(table, move_title_pair);
	});
	//console.log([page_list, move_to]);

	return {
		'「Template:COVID-19の流行データ」から始まるページ名': {
			page_list: Object.keys(move_title_pair),
			move_title_pair,
			text_processor: add_template,
		}
	};
}

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
	}, setup_move_configuration);
})();
