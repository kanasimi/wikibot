/*
node 20251126.Move_exposed_template_Collapsible_option_to_Navbox_documentation.js use_project=zh

這個任務會清理navbox模板中裸露的{{Collapsible option}}，改用{{Navbox documentation}}。

	初版試營運


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

async function main_process() {
	for await (let page_list of wiki.embeddedin('Template:Collapsible option', { namespace: 'template', batch_size: 500 })) {
		page_list = page_list.filter(page_data => !page_data.title.endsWith('/doc'));
		await wiki.for_each_page(page_list, for_each_template, {
			redirects: false,
			summary: `${CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title, '清理navbox模板中裸露的{{Collapsible option}}，改用{{Navbox documentation}}。')}`
		});
	}
}

async function for_each_template(page_data) {
	CeL.log_temporary(`${for_each_template.name}: 處理頁面 ${CeL.wiki.title_link_of(page_data)}`);
	const parsed = page_data.parse();
	let changed = false;
	parsed.each('template', template_token => {
		// 對於所有第一層的模板，假如是{{Collapsible option}}則直接轉成{{Navbox documentation}}。
		if (wiki.is_template(template_token, 'Collapsible option')) {
			// replace parameter name only
			template_token[0] = 'Navbox documentation';
			changed = true;
			return;
		}
	}, { depth: 1 });

	if (changed) {
		return parsed.toString();
	}
}
