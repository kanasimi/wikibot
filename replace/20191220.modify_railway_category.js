/*

2019/12/20 13:48:46	初版試營運

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;
// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('zh');

// ----------------------------------------------------------------------------

(async () => {
	await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
	await main_process();
})();

async function main_process() {
	await modify_category('Category:中国各省铁路');
	await modify_category('Category:中国高速铁路线');

	CeL.info((new Date).format() + '	Done.');
}

// ----------------------------------------------------------------------------


async function modify_category(root_category) {
	const category_tree = await wiki.category_tree(root_category, {
		namespace: 'Category|main',
		category_filter: (page_data) => /(?:铁路|鐵路)$/.test(page_data.title),
		page_filter: (page_data) => /(?:铁路|鐵路|线|線)$/.test(page_data.title),
		for_each_page: (page_data) => pages_to_modify.push(page_data),
		//depth: 2
	});
	//console.log(category_tree);
	//console.log(category_tree[Wikiapi.KEY_subcategories].江西省铁路);
	//console.log(pages_to_modify);
	await wiki.for_each_page(pages_to_modify, for_each_page, {
		summary: '[[Special:Diff/57320664/57320952#请求批量更改中国铁路线路的分类|機器人作業請求]]: 將中國鐵路線路的分類從"鐵路"改成"鐵路線"'
	});
}

// ------------------------------------

const pages_to_modify = [];
// 中國省份+直轄市
const allow_pattern = /北京|天津|上海|重庆|河北|山西|辽宁|吉林|黑龙江|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|海南|四川|贵州|云南|陕西|甘肃|青海|内蒙古|广西|西藏|宁夏|新疆/;
// 中国高速铁路: [[分類:中國各省高速鐵路線]]
// 单线铁路|复线铁路|内燃化铁路|电气化铁路|中国合资铁路|清朝铁路线|中国高速铁路
const ignore_pattern = /单线|复线|电气|内燃|化铁路|合资铁路|清朝|高速铁路/;

function for_each_page(page_data) {
	const parsed = page_data.parse();

	// CeL.info(CeL.wiki.title_link_of(page_data.title));
	parsed.each('category', (token) => {
		if (!/(?:铁路|鐵路)$/.test(token.name) || token.name === page_data.title
			|| allow_pattern && !allow_pattern.test(token.name)
			|| ignore_pattern && ignore_pattern.test(token.name))
			return;

		const move_to = '[[Category:' + token.name
			+ (token.name.includes('铁路') ? '线' : '線') + ']]';
		CeL.log(token + ' → ' + move_to);
		return move_to;
	}, true);

	return parsed.toString();
}
