/*

2020/1/25 9:15:3	初版試營運

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
		summary: '{{Cite journal}}のパラメータ一を小文字にする',
		// 'small_oldid/big_new_diff' or {Number}new
		diff_id: '75666077/75666797',
		section_title: 'テンプレート "Cite journal" 中の パラメータ一文字目'
	}, {
		'Template:Cite journal': {
			//page_list: ['仮面ライダー龍騎'],
			list_types: 'embeddedin',
			for_template(token) {
				//CeL.log(Object.keys(token.index_of).join('|'));
				const config = Object.create(null);
				for (let parameter in token.parameters) {
					if (/[A-Z]/.test(parameter)) {
						CeL.log(`${parameter}→${parameter.toLowerCase()}`);
						config[parameter] = config[parameter.toLowerCase()];
					}
				}
				CeL.wiki.parse.replace_parameter(token, config, 'parameter_name_only');
			}
		}
	});
})();
