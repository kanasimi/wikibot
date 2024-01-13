'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

// ----------------------------------------------------------------------------

replace_tool.replace({
}, {
	'Category‐ノート:人物名目録（日本）/追加する人物カテゴリの一覧': {
		get_task_configuration_from: 'table',
		text_processor(wikitext, page_data) {
			/** {Array} parsed page content 頁面解析後的結構。 */
			const parsed = page_data.parse();
			parsed.insert_layout_element(`[[Category:人物名目録（日本）]]`);
			return parsed.toString();
		}
	},
});
