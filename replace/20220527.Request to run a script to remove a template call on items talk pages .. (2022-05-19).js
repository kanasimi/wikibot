'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

// ----------------------------------------------------------------------------

replace_tool.replace({
	API_URL: 'wikidata',
}, {
	'Template:Item documentation': {
		namespace: 'talk',
		move_to_link: DELETE_PAGE,
		list_types: 'embeddedin',
		_text_processor(wikitext) {
			// e.g., [[Talk:Q11457]]
			const replace_to = wikitext.replace(/^([\s\n]*{{[\s\S]+?}})?[\s\n]*{{ *[Ii]tem[ _][Dd]ocumentation(?:\s*\|[^{}]*)?}}[\s\n]*/, '$1');
			//console.log([wikitext, replace_to]);
			if (replace_to !== wikitext) {
				return replace_to;
			}
		}
	},
});
