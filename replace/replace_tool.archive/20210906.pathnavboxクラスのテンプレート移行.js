'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

// ----------------------------------------------------------------------------

function text_processor(wikitext, page_data) {
	let changed;
	/** {Array} parsed page content 頁面解析後的結構。 */
	const parsed = page_data.parse();
	parsed.each('tag', token => {
		if (token.tag !== 'div' || !/ class="? *pathnavbox/.test(token[0])) {
			if (/pathnavbox/.test(token[0])) {
				//console.log(token.toString());
			}
			return;
		}

		if (!/ class="? *pathnavbox *"? */.test(token[0])) {
			//console.log(token.toString());
			return;
		}

		function invalid_inner_token(token) {
			if (typeof token === 'string') return token.trim();
			// e.g., "\n </div>"
			if (token.type === 'pre') return token.toString().trim();
			// e.g., "\n* {{Pathnav|...}}"
			if (token.type === 'list' || token.type === 'comment') return false;
			if (token.type === 'plain') return token.some(invalid_inner_token);
			return token.type !== 'transclusion' || token.name !== 'Pathnav';
		}

		if (token[1].some(invalid_inner_token)) {
			//console.log(token.toString());
			//console.log(token[1]);
			return;
		}

		changed = true;
		return `{{Pathnavbox|\n${token[1].toString().trim()}\n}}`;
	}, true);
	return changed ? parsed.toString() : Wikiapi.skip_edit;
}

replace_tool.replace({
}, {
	'insource:/class=[" ]*pathnavbox/': {
		text_processor
	},
});
