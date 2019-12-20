/*

2019/12/20 13:48:46	初版試營運

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;
// globalThis.use_language = 'zh';
use_language = 'zh';

// ----------------------------------------------------------------------------

(async () => {
	await wiki.login(user_name, user_password, use_language);
	// await wiki.login(null, null, use_language);
	await main_process();
})();

async function main_process() {
	await modify_root_category('Category:中国各省铁路');
	// await modify_root_category('Category:中国高速铁路线');

	CeL.info((new Date).format() + '	Done.');
}

// ----------------------------------------------------------------------------

async function modify_root_category(category) {
	await wiki.category_tree(category, {
		namespace: 'Category|main',
		category_filter: (page_data) => /(?:铁路)$/.test(page_data.title),
		page_filter: (page_data) => /(?:铁路|线)$/.test(page_data.title),
		for_each_page: (page_data) => pages_need_to_modify.push(page_data),
		depth: 2
	});
	// console.log(category_tree);
	// console.log(category_tree[KEY_subcategories].北京市铁路);
	//console.log(pages_need_to_modify);
	await wiki.for_each_page(pages_need_to_modify, for_each_page, {
		bot: 1,
		monor: 1,
		summary: '[[Special:Diff/57320664/57320952#请求批量更改中国铁路线路的分类|機器人作業請求]]: 將中國鐵路線路的分類從"鐵路"改成"鐵路線"'
	});
}

// ------------------------------------

const pages_need_to_modify = [];
// 单线铁路|复线铁路|内燃化铁路|电气化铁路|中国合资铁路|清朝铁路线
const ignore_pattern = /单线|复线|电气|内燃|化铁路|合资铁路|清朝/;

function for_each_page(page_data) {
	const parsed = page_data.parse();
	let modified = [];

	// CeL.info(CeL.wiki.title_link_of(page_data.title));
	parsed.each('category', (token) => {
		if (!/(?:铁路)$/.test(token.name) || ignore_pattern.test(token.name) || token.name === page_data.title)
			return;

		const move_to = '[[Category:' + token.name + '线' + ']]';
		CeL.log(token + ' → ' + move_to);
		return move_to;
	}, true);

	return parsed.toString();
}
