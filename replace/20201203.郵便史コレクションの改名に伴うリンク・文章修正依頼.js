'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

// ----------------------------------------------------------------------------

replace_tool.replace(null, {
	'insource:/郵便史/': {
		namespace: 'main',
		text_processor(wikitext, page_data) {
			let changed;
			wikitext = wikitext.split('郵便史');
			if (wikitext.length === 1)
				return;

			for (let index = 1; index < wikitext.length; index++) {
				if (wikitext[index].startsWith('コレクション'))
					wikitext[index] = wikitext[index].slice('コレクション'.length);
				else
					changed = true;
			}
			if (changed)
				return wikitext.join('郵便史コレクション');
		},

	},
});
