/*
node 20250812.Move_exposed_template_Collapsible_option_to_Navbox_documentation.js use_project=zh

這個任務會清理navbox模板中裸露的{{Collapsible option}}，改用{{Navbox documentation}}。

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

	if (!general.Collapsible_option_template_name)
		general.Collapsible_option_template_name = 'Collapsible option';
	if (!general.Navbox_documentation_template_name)
		general.Navbox_documentation_template_name = 'Navbox documentation';

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
	await replace_tool.replace({
		//[KEY_wiki_session]
		wiki,
		use_language,
		work_options: { no_message: true, },
		not_bot_requests: true,
		no_move_configuration_from_command_line: true,
		summary: `${CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title, '清理模板中裸露的{{Collapsible option}}，改用{{Navbox documentation}}')}`
		//+ ' 人工監視檢測中 '
		,
	}, {
		[wiki.to_namespace(wiki.latest_task_configuration.general.Collapsible_option_template_name, 'template')]: {
			namespace: 'Template',
			list_types: 'embeddedin',
			move_to_link: wiki.to_namespace(wiki.latest_task_configuration.general.Navbox_documentation_template_name, 'template'),
			for_template(template_token, index, parent) {
				const { task_configuration } = this;
				const parsed = task_configuration.page_data.parsed;
				if (parent !== parsed) {
					this.discard_changes = true;
					return;
				}

				if (Object.keys(template_token.parameters).length > 0) {
					this.discard_changes = true;
					return;
				}
			},
		},
	});
}

