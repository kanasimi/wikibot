/*
node 20240821.Clean_up_misspelling_link.js use_project=zh

這個任務會修正拼寫錯誤的連結，修正所有指向{{錯誤拼寫重定向}}的連結。

2024/8/21 14:55:34	初版試營運


*/

'use strict';

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

const misspelling_redirect_template_name = 'Template:錯字重定向';

async function main_process() {
	CeL.log_temporary(`取得所有嵌入${CeL.wiki.title_link_of(misspelling_redirect_template_name)}的頁面並篩選...`);
	const misspelling_pages = [];
	await wiki.for_each_page(
		await wiki.embeddedin(misspelling_redirect_template_name, { namespace: 'main|Template' }),
		page_data => {
			const timestamp = Date.parse(CeL.wiki.content_of.revision(page_data).timestamp);
			// {{tl|錯誤拼寫重定向}}超過一週的頁面才處理。這間隔應當足夠編者檢核了。
			if (Date.now() - timestamp > CeL.to_millisecond('1w')) {
				misspelling_pages.push(page_data);
				// TODO: use correct spelling: {{R from misspelling|of=(correct spelling)}}
			} else {
				CeL.warn(`${CeL.wiki.title_link_of(page_data)} 最後一次編輯在${CeL.indicate_date_time(timestamp)}，頁面過新，下次再處理。`);
			}
		}, {
	});

	CeL.log_temporary(`取得所有包含錯誤拼音連結的頁面...`);
	await wiki.register_redirects(misspelling_pages, { no_message: true });

	for (const misspelling_page of misspelling_pages) {
		const move_from_link = CeL.wiki.title_of(misspelling_page);
		const move_to_link = wiki.redirect_target_of(misspelling_page);
		//console.log([move_from_link, move_to_link]);
		await replace_tool.replace({
			wiki,
			use_language,
			work_options: { no_message: true, },
			not_bot_requests: true,
			no_move_configuration_from_command_line: true,
			summary: `${CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title, '修正拼寫錯誤的連結')}: ${CeL.wiki.title_link_of(move_from_link)}→${CeL.wiki.title_link_of(move_to_link)}`
			//+ ' 人工監視檢測中 '
			,
		}, {
			[move_from_link]: {
				namespace: 'main|Template',
				move_to_link,
			},
		});
	}
}

