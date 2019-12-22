/*

2019/12/21 7:17:45	初版試營運

 */

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');
//import { replace } from './replace_tool.js';

// ----------------------------------------------------------------------------

//async function main_process()
(async () => {
	await replace_tool.replace({
		summary: '清空分類:中國鐵路線中的條目',
		diff_id: '57334336/57341043',
		section_title: '请求批量更改中国铁路线路的分类'
	}, {
		'Category:中国铁路线': {
			text_processor
		}
	});
})();

// 中國省份+直轄市
const allow_pattern = /北京|天津|上海|重庆|河北|山西|辽宁|吉林|黑龙江|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|海南|四川|贵州|云南|陕西|甘肃|青海|内蒙古|广西|西藏|宁夏|新疆/;

function text_processor(wikitext, page_data) {
	/** {Array} parsed page content 頁面解析後的結構。 */
	const parsed = page_data.parse();
	let changed, has_省份分類;
	parsed.each('category', function (token, index, parent) {
		//console.log(token.toString());
		if (allow_pattern.test(token.name)) {
			has_省份分類 = true;
			return parsed.each.exit;
		}
	});

	if (has_省份分類) {
		parsed.each('category', function (token, index, parent) {
			if (token.name === '中国铁路线') {
				changed = true;
				return remove_token;
			}
		});
	}

	return changed ? parsed.toString() : Wikiapi.skip_edit;
}
