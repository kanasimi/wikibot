/*

	初版試營運

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;
// globalThis.use_language = 'zh';
use_language = 'zh';


// ----------------------------------------------------------------------------

const pages_need_to_modify = [];

async function modify_root_category(category) {
	await wiki.category_tree(category, {
		category_filter: (page_data) => /(?:铁路)$/.test(page_data.title),
		page_filter: (page_data) => /(?:铁路|线)$/.test(page_data.title),
		for_each_page: (page_data) => pages_need_to_modify.push(page_data),
		depth: 3
	});
	// console.log(category_tree);
	// console.log(category_tree[KEY_subcategories].北京市铁路);
	console.log(pages_need_to_modify);
}

// ----------------------------------------------------------------------------


async function main_process() {
	await modify_root_category('Category:中国各省铁路');
	// await modify_root_category('Category:中国高速铁路线');

	CeL.info((new Date).format() + '	Done.');
}

(async () => {
	await wiki.login(user_name, user_password, use_language);
	// await wiki.login(null, null, use_language);
	await main_process();
})();
