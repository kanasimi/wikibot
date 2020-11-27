// 

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

// ----------------------------------------------------------------------------

replace_tool.replace({
	language: 'commons',
}, {
	'File:LUSITANA WLM 2011 d.svg': {
		namespace: 'User talk',
		text_processor(wikitext, page_data) {
			/** {Array} parsed page content 頁面解析後的結構。 */
			const parsed = page_data.parse();
			let changed;
			parsed.each('file', (token, index, parent) => {
				if (token.name !== 'LUSITANA WLM 2011 d.svg' || token.link !== 'Commons:Wiki Loves Monuments 2020')
					return;
				// Should be parent[index - 2]
				parent.slice(index - 3, index).forEach(token => {
					if (token.type === 'section_title' && token[0].toString().includes('Wiki Loves Monuments 2019')) {
						token[0] = token[0].toString().replace('Wiki Loves Monuments 2019', 'Wiki Loves Monuments 2020');
						changed = true;
					}
				});
			});
			if (changed)
				return parsed.toString();
		},

	},
});
