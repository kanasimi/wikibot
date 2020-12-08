'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

// ----------------------------------------------------------------------------

//const search_url = 'www.cracroftspeerage.co.uk/online/content/';
// "www."がないになっているものもあるので、それらも併せて修正できれば大変助かります。
const search_url = 'cracroftspeerage.co.uk/online/content/';
const replace_from_url = '//' + search_url;
const replace_to_url = '//www.cracroftspeerage.co.uk/';
const PATTERN_replace_from = new RegExp(CeL.to_RegExp_pattern(replace_from_url), 'g');

replace_tool.replace(null, {
	[search_url]: {
		namespace: 'main',
		list_types: 'exturlusage',
		text_processor(wikitext, page_data) {
			if (wikitext.includes(replace_from_url))
				return wikitext.replace(PATTERN_replace_from, replace_to_url);
		},
	},
});
