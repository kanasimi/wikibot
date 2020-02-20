/*

2020/1/25 11:22:33	初版試營運

 */

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');
// import { replace } from './replace_tool.js';

// ----------------------------------------------------------------------------

// async function main_process()
(async () => {
	await replace_tool.replace({
		language: 'ja',
		// summary: '',
		// 'small_oldid/big_new_diff' or {Number}new
		diff_id: '75713740/75730483',
		section_title: '「Template:Infobox 組織」が使用されている記事の引数の置き換え'
	}, {
		'Template:Infobox 組織': {
			// page_list: ['仮面ライダー龍騎'],
			// page_limit: 10,
			for_template(token) {
				const config = {
					メンバー: '会員数',
					// リーダー: '幹部氏名',
					// 理事長: '幹部氏名',
					// 会長 : '幹部氏名',
					廃止: '解散',
					貢献: 'area_served',
					過去名: '旧称',
				};
				if (!token.幹部氏名) {
					if (token.parameters.理事長) {
						if (!token.parameters.リーダー) {
							if (!token.parameters.幹部呼称)
								config.幹部呼称 = '理事長';
							config.理事長 = '幹部氏名';
						}
					} else if (token.parameters.リーダー) {
						if (!token.parameters.幹部呼称)
							config.幹部呼称 = 'リーダー';
						config.リーダー = '幹部氏名';
					}
				}
				CeL.wiki.parse.replace_parameter(token, config, 'parameter_name_only');
			}
		}
	});
})();
