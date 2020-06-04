/*

	初版試營運

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('en');
/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;


// ----------------------------------------------------------------------------

const reason = '[[Special:Diff/960441428#Move 205 mathematics pages to singular title|BOTREQ]]: Move plural mathematics title to singular title';

(async () => {
	await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
	await main_process();
})();

async function main_process() {
	const move_from_list = ['Rectified_5-cubes'];
	for (const move_from_title of move_from_list) {
		const move_to_title = move_from_title
			.replace(/cubes$/, 'cube')
			.replace(/simplexes$/, 'simplex')
			.replace(/orthoplex$/, 'orthoplexes');
		if (move_from_title === move_to_title) {
			CeL.error('The same title: ' + CeL.wiki.title_link_of(move_from_title));
			continue;
		}

		CeL.info(`move page: ${CeL.wiki.title_link_of(move_from_title)}→${CeL.wiki.title_link_of(move_to_title)}`);
		try {
			await wiki.move_page(move_from_title, move_to_title, { reason });
		} catch (e) {
			console.error(e);
		}
	}
}
