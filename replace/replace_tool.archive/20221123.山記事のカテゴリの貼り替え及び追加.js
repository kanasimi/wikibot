'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

// ----------------------------------------------------------------------------

replace_tool.replace({
}, {
	'Category:オセアニアの山': {
		text_processor(wikitext, page_data) {
			/** {Array} parsed page content 頁面解析後的結構。 */
			const parsed = page_data.parse();
			parsed.insert_layout_token(`[[Category:山岳名目録]]`);
			return parsed.toString();
		}
	},
	'Category:南極の山': {
		text_processor(wikitext, page_data) {
			/** {Array} parsed page content 頁面解析後的結構。 */
			const parsed = page_data.parse();
			parsed.insert_layout_token(`[[Category:山岳名目録]]`);
			return parsed.toString();
		}
	},
});
