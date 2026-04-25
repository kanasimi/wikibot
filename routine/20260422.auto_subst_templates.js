/*
node 20260422.auto_subst_templates.js use_project=zhwiki

這個任務會自動替換引用{{Needsubst|auto=yes}}的模板。

2026/4/25 9:31:36	初版試營運


*/

'use strict';

const debug_pages = ['Template:Infobox Twitch streamer']
	//&& null
	;


// Load replace tools.
const replace_tool = require('../replace/replace_tool.js');

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

	const matched = general.category_of_templates_to_be_automatically_substituted.match(/^Q\d+$/);
	if (matched) {
		// 讀入QID對應的分類名稱。
		const category_name = (await wiki.data(matched[0])).sitelinks[wiki.site_name()].title;
		general.category_of_templates_to_be_automatically_substituted = category_name;
	}

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

	for await (const page_data of (debug_pages
		|| wiki.categorymembers(wiki.latest_task_configuration.general.category_of_templates_to_be_automatically_substituted, { namespace: 'template' }))) {

		const move_from_link = CeL.wiki.title_of(page_data);
		const move_to_link = 'subst:';
		//console.log([move_from_link, move_to_link]);
		await replace_tool.replace({
			//[KEY_wiki_session]
			wiki,
			use_language,
			// 嵌入本模板的頁面數量太多，跳過本模板不處理。
			max_pages_before_abort: wiki.latest_task_configuration.general.max_pages_before_abort,
			work_options: { no_message: true, },
			not_bot_requests: true,
			no_move_configuration_from_command_line: true,
			summary: `${CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title, '自動替換引用模板')}: {{${wiki.remove_namespace(move_from_link)}}}`
			//+ ' 人工監視檢測中 '
			,
		}, {
			[move_from_link]: {
				//namespace: 'main|Template',
				move_to_link,
			},
		});

	}
}

