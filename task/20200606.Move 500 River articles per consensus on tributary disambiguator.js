/*

2020/6/5 5:5:19	初版試營運

 */

'use strict';

// Load replace tools.
const replace_tool = require('../replace/replace_tool.js');

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
	const move_title_pair = await replace_tool.parse_move_pairs_from_page('User:Dicklyon/tributaries', wiki);
	await replace_tool.move_via_title_pair(move_title_pair, { reason, session: wiki });
}
