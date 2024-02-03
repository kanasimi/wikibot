/*
node 20210616.test_for_each_page.js
*/

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Load modules.
CeL.run([//'application.net.wiki.template_functions',
	// for CeL.assert()
	'application.debug.log']);

// Set default language. 改變預設之語言。 e.g., 'zh'
//set_language('en');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// ----------------------------------------------

/**
 * 由設定頁面讀入手動設定 manual settings。
 * 
 * @param {Object}latest_task_configuration
 *            最新的任務設定。
 */
async function adapt_configuration(latest_task_configuration) {
	//console.log(latest_task_configuration);
	// console.log(wiki);

	// ----------------------------------------------------

	const { general } = latest_task_configuration;

}

// ----------------------------------------------------------------------------

(async () => {
	//login_options.configuration_adapter = adapt_configuration;
	login_options.API_URL = 'test';
	//console.log(login_options);
	await wiki.login(login_options);
	await main_process();
})();

async function main_process() {
	await test_1();
	console.log('-'.repeat(60));

	await test_2();
	console.log(`Done`);
}

async function test_1() {
	await wiki.for_each_page((new Array(2)).fill(0).map((e, index) => `test ${index}`), async page_data => {
		console.log(`redirects: ` + (await wiki.redirects('1')).length);
		CeL.log(`wikitext: ` + (await wiki.page('test 9')).wikitext);
		await wiki.for_each_page((new Array(2)).fill(0).map((e, index) => `test ${index}`), async page_data => {
			//console.log(page_data.wikitext);
			CeL.log(`wikitext #2: ` + (await wiki.page(page_data.wikitext.slice(0, 4) || 'test 0')).wikitext);
		});
		return `test edit of page ${CeL.wiki.title_link_of(page_data)}`;
	}, { nocreate: 0, summary: `test edit` });
}

async function test_2() {
	await wiki.for_each_page((new Array(2)).fill(0).map((e, index) => `test ${index}`), async page_data => {
		await wiki.for_each_page((new Array(2)).fill(0).map((e, index) => `test ${index}`), async page_data => {
			CeL.log(`wikitext: ` + (await wiki.page(page_data.title)).wikitext);
			return `test edit of page ${CeL.wiki.title_link_of(page_data)}`;
		}, { summary: `test edit - sub` });
		return `test edit of page ${CeL.wiki.title_link_of(page_data)}`;
	}, { summary: `test edit` });
}
