/*

2020/6/15 5:29:54	初版試營運

 */

'use strict';

// Load replace tools.
const replace_tool = require('../replace/replace_tool.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('en');
/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// ----------------------------------------------------------------------------

const reason = '[[Special:Diff/962140938#52 articles on French railway stations|BOTREQ]]: Respect [[WP:MOSFR#Stations]], these station names should be suffixed "station" or "railway station"';

(async () => {
	await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
	await main_process();
})();

async function main_process() {
	const move_title_pair = await replace_tool.parse_move_pairs_from_reverse_moved_page('Captain scarlet', { ucstart: new Date('2020-05-30 09:34 UTC'), ucend: new Date('2020-05-30 09:54 UTC'), session: wiki });
	await replace_tool.move_via_title_pair(move_title_pair, { noredirect: false, reason, session: wiki });
}
