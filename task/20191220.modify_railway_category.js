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



async function modify_root_category(category) {
	const category_tree = await wiki.category_tree(category, {
		filter: /(?:铁路|线‎)‎$/,
		depth: 3
	});
	console.log(category_tree.subcategories.北京市铁路);
}

// ----------------------------------------------------------------------------


async function main_process() {
	await modify_root_category('Category:中国各省铁路');
	//await modify_root_category('Category:中国高速铁路线');

	CeL.info((new Date).format() + '	Done.');
}

(async () => {
	await wiki.login(user_name, user_password, use_language);
	// await wiki.login(null, null, use_language);
	await main_process();
})();
