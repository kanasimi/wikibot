/*

2020/6/18 7:18:54	初版試營運

 */

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

replace_tool.replace({
	language: 'zh',
}, {
	'http://www.ncha.gov.cn/': {
		before_get_pages,
		text_processor
	},
});

let move_title_pair;
async function before_get_pages(page_list, edit_options, options) {
	move_title_pair = await replace_tool.parse_move_pairs_from_page(options.meta_configuration.requests_page || options.bot_requests_page, {
		session: this.wiki,
		section_title: script_name,
		using_table: true,
		redirects: 1,
	});
	//console.log(move_title_pair);
	//return move_title_pair;
}

function text_processor(wikitext, page_data) {
	/** {Array} parsed page content 頁面解析後的結構。 */
	const parsed = page_data.parse();
	parsed.each('template', (token, index, parent) => {
		const from_link = token.parameters.url;
		if (token.name !== 'Cite web' || !(from_link in move_title_pair)) {
			return;
		}

		const to_link = move_title_pair[from_link];
		CeL.wiki.parse.replace_parameter(token, {
			url: to_link,
			'dead-url': 'no'
		}, { value_only: true });
		//移除和連結在同一行內的{{deadlink}}模板
		while (++index < parent.length) {
			token = parent[index];
			if (typeof token === 'string') {
				if (token.includes('\n'))
					return;
			} else if (token.type === 'transclusion' && token.name in {
				'Dead link': true,
				Deadlink: true,
				失效: true,
				失效链接: true,
				失效連結: true,
				'404': true,
				死链: true,
			}) {
				parent[index] = '';
				return;
			}
		}
	});
	return parsed.toString();
}
