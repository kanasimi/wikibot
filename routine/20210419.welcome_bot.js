/*

2021/4/19 19:8:58	First version, for https://github.com/hugolpz/WikiapiJS-Eggs/issues/4

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('en');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// ----------------------------------------------------------------------------

(async () => {
	await wiki.login(login_options);
	wiki.listen(async row => {
		const page_data = await wiki.page('User talk:' + row.user);
		if (!page_data.wikitext) {
			//console.log(row);
			await wiki.edit_page(page_data, '{{subst:Welcome}}');
		}
	}, {
		delay: '2m',
		rcprop: 'user'
	});
})();
