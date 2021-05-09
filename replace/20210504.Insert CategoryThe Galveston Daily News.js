'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

const category_name = 'The Galveston Daily News';

replace_tool.replace({
	language: 'commons',
	log_to: null,
	diff_id: 557730952,
}, {
	'intitle:"The Galveston Daily News. (Galveston, Tex.), Vol."': {
		list_title: 'File:The Galveston Daily News. (Galveston, Tex.), Vol. 5',
		//list_title: 'File:The Galveston Daily News. (Galveston, Tex.), No. 3',
		list_types: 'prefixsearch',
		text_processor(wikitext, page_data) {
			const parsed = page_data.parse();
			let has_token;
			parsed.each('Category', token => {
				if (token.name === category_name) {
					has_token = true;
					return parsed.each.exit;
				}
			});
			if (has_token)
				return Wikiapi.skip_edit;
			parsed.insert_layout_token(`[[Category:${category_name}]]`);
			return parsed.toString();
		}
	}
});
