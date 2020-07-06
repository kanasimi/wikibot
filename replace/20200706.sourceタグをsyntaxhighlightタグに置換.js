'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

replace_tool.replace({
	no_notice: true,
}, {
	'Category:非推奨のsourceタグを使用しているページ': {
		// for debug
		//page_list : ['QBasic'],
		text_processor(wikitext, page_data) {
			/** {Array} parsed page content 頁面解析後的結構。 */
			const parsed = page_data.parse();
			console.log(parsed.slice(90));
			throw 4564564
			let changed;
			parsed.each('tag', token => {
				if (token.tag !== 'source')
					return;
				changed = true;
				//console.log(token);
				token.tag = 'syntaxhighlight';
			});
			if (changed)
				return parsed.toString();
		},
	},
});
