/*

2020/2/15 5:7:8	初版試營運

 */

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');
//import { replace } from './replace_tool.js';

// ----------------------------------------------------------------------------

//async function main_process()
(async () => {
	await replace_tool.replace({
		language: 'ja',
		//summary: '',
		// 'small_oldid/big_new_diff' or {Number}new
		diff_id: 76192264,
		section_title: 'Template:駅情報への地図引数挿入'
	}, {
		'Template:駅情報': {
			list_types: 'embeddedin',
			text_processor(wikitext, page_data) {
				/** {Array} parsed page content 頁面解析後的結構。 */
				const parsed = page_data.parse();
				let changed;
				parsed.each('template', 駅情報_token => {
					if (駅情報_token.name !== '駅情報')
						return;
					parsed.each.call(駅情報_token, 'template', (token, index, parent) => {
						if (token.name !== 'Infobox mapframe' && token.name !== 'Maplink2')
							return;
						if (/^\s*地図\s*=\s*/.test(parent.slice(0, index).join(''))) {
							//already replaced
							return;
						}
						changed = true;
						//console.log(token.toString());
						if (index > 0) {
							parent[index - 1] = parent[index - 1].toString().replace(/([\s\n]|<br[^<>]+>)+$/, '');
						}
						// TODO: 地図\s*=\s*
						parent[index] = '\n|地図=' + token.toString();
					});
				});
				if (changed)
					return parsed.toString();
			}
		},
	});
})();
