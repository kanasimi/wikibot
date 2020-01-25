/*

	初版試營運

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
				for (let parameter of Object.keys(token.index_of)) {
					if (/[A-Z]/.test(parameter)) {
						const index = token.index_of[parameter];
						CeL.log(`${parameter}→${parameter.toLowerCase()}`);
						token[index] = token[index].toString()
							.replace(/^([^=]+)=/, (_, parameter) => parameter.toLowerCase() + '=');
					}
				}
			}
		}
	});
})();
