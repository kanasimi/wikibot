'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

// ----------------------------------------------------------------------------

replace_tool.replace({
}, {
	//'prefix:Template:Taxonomy/'
	'Category:分类学模板': {
		//namespace: 'template',
		text_processor(wikitext) {
			return wikitext.replace("{{Don't edit this line {{{machine code|}}}|{{{1}}}", "{{Don't edit this line {{{machine code|}}}");
		}
	},
});
