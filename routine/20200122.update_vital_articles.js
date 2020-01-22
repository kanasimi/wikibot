/*

	初版試營運


 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

CeL.run('application.net.wiki.featured_content');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;
// globalThis.use_language = 'zh';
use_language = 'en';

// ----------------------------------------------------------------------------

prepare_directory(base_directory);

(async () => {
	await wiki.login(user_name, user_password, use_language);
	// await wiki.login(null, null, use_language);
	await main_process();
})();

async function main_process() {
	await wiki.get_featured_content();
	//console.log(wiki.FC_data_hash);
	const vital_articles_classes = await wiki.categorymembers('Wikipedia vital articles by class');
}

// ----------------------------------------------------------------------------

