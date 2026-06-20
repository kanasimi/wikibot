/*
node 20260620.fix_external_link.js use_project=zhwiki

這個任務會將維基姐妹計畫的外部連結轉為 wikilink。

	初版試營運

TODO:

*/

'use strict';

const debug_pages = []
	&& null
	;


'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
//set_language('zh');

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

	if (!latest_task_configuration.general)
		latest_task_configuration.general = Object.create(null);
	const { general } = latest_task_configuration;


	console.trace(wiki.latest_task_configuration.general);
}

// ----------------------------------------------------------------------------

(async () => {
	login_options.configuration_adapter = adapt_configuration;
	//console.log(login_options);
	await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
	await main_process();
	routine_task_done('1 week');
})();

// ----------------------------------------------------------------------------


async function main_process() {
	let summary_prefix = CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title, '整理維基姐妹計畫的外部連結');

	for await (const page_list of (debug_pages ? [debug_pages]
		: wiki.allpages({
			//namespace: 'category',
			//namespace: 'template',
			batch_size: 100,
		}))) {

		await wiki.for_each_page(page_list, for_each_page, {
			no_message: true,
			redirects: false,
			summary: `${summary_prefix}`,
		});
	}
}


async function for_each_page(page_data) {
	//console.log(page_data);
	const wikitext = page_data.wikitext;
	if (!wikitext || !/\[\[ *:[^:]+:/.test(wikitext) && !/\[ *https?:\/\//.test(wikitext))
		return Wikiapi.skip_edit;

	CeL.log_temporary(`${handle_each_template.name}: 處理頁面 ${CeL.wiki.title_link_of(page_data)}`);
	const parsed = page_data.parse();
	CeL.assert([page_data.wikitext, parsed.toString()],
		// gettext_config:{"id":"wikitext-parser-checking-$1"}
		CeL.gettext('wikitext parser checking: %1', CeL.wiki.title_link_of(page_data)));

	// ------------------------------------------------------------------------

	console.log(page_data.title);
}
