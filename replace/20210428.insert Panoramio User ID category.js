'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

replace_tool.replace({
	language: 'commons',
	diff_id: 545787087
}, {
	"insource:panoramio.com/user/4539074": {
		text_processor(wikitext, page_data) {
			const parsed = page_data.parse();
			let has_token;
			parsed.each('Category', token => {
				if (token.name === 'Photos from Panoramio ID 4539074') {
					has_token = true;
					return parsed.each.exit;
				}
			});
			if (has_token)
				return Wikiapi.skip_edit;
			parsed.insert_layout_token('[[Category:Photos from Panoramio ID 4539074]]');
			return parsed.toString();
		}
	}
});
