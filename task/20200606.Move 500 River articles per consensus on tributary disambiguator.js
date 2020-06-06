/*

2020/6/5 5:5:19	初版試營運

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('en');
/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;


// ----------------------------------------------------------------------------

const reason = '[[Special:Diff/960931382#Move 500 River articles per consensus on tributary disambiguator|BOTREQ]]: Move 500 River articles per consensus on tributary disambiguator';

(async () => {
	await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
	await main_process();
})();

async function main_process() {
	const move_title_pair = { 'Slate Creek (Rapid Creek)': 'Slate Creek (Rapid Creek tributary)' };
	const list_page_data = await wiki.page('User:Dicklyon/tributaries');
	/** {Array} parsed page content 頁面解析後的結構。 */
	const parsed = list_page_data.parse();
	parsed.each('list', token => {
		if (token.length < 20)
			return;
		for (let i = 0; i < token.length; i++) {
			let from, to;
			parsed.each.call(token[i], 'link', link => {
				if (link[1]) {
					CeL.error(`Link with anchor: ${token[i]}`);
					throw new Error(`Link with anchor: ${token[i]}`);
				}
				link = link[0].toString();
				if (!from)
					from = link;
				else if (!to)
					to = link;
				else
					CeL.error(`Too many links: ${token[i]}`);
			});
			if (from && to)
				move_title_pair[from] = to;
			else
				CeL.error(`Can not parse: ${token[i]}`);
		}
	});
	CeL.info(`${Object.keys(move_title_pair).length} pages to move...`);
	//	console.log(move_title_pair);

	for (const move_from_title in move_title_pair) {
		const move_to_title = move_title_pair[move_from_title];
		if (move_from_title === move_to_title) {
			CeL.error('The same title: ' + CeL.wiki.title_link_of(move_from_title));
			continue;
		}

		CeL.info(`move page: ${CeL.wiki.title_link_of(move_from_title)} → ${CeL.wiki.title_link_of(move_to_title)}`);
		try {
			await wiki.move_page(move_from_title, move_to_title, { reason, movetalk: true, noredirect: false });
		} catch (e) {
			if (e.code === 'articleexists') {
				// Already moved?
			} else {
				console.error(e);
			}
		}
	}
}
