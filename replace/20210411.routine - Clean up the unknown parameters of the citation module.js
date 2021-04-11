'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('zh');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

/** {Array}引文格式1模板 */
let citation_template_list;

// ----------------------------------------------

// 讀入手動設定 manual settings。
async function adapt_configuration(latest_task_configuration) {
	//console.log(latest_task_configuration);
	// console.log(wiki);

	// ----------------------------------------------------

	const { general } = latest_task_configuration;
}

// ----------------------------------------------------------------------------

(async () => {
	//login_options.configuration_adapter = adapt_configuration;
	await wiki.login(login_options);
	await main_process();
})();

// ----------------------------------------------------------------------------

async function setup_citation_template_list() {
	// get from [[Category:引用模板]]
	let citation_templates = Object.create(null);
	(await wiki.categorymembers('Category:引用模板', { namespace: 'Template' }))
		.forEach(page_data => citation_templates[page_data.title] = null);
	// 取交集。
	citation_templates = (await wiki.embeddedin('Module:Citation/CS1', { namespace: 'Template' }))
		.filter(page_data => page_data.title in citation_templates).map(page_data => page_data.title);

	await wiki.register_redirects(citation_templates);

	citation_template_list = wiki.redirect_target_of(citation_templates);
	//console.trace(citation_template_list);
}

async function main_process() {
	await setup_citation_template_list();

	await replace_tool.replace({
		use_language,
		not_bot_requests: true,
		summary: '[[Wikipedia:机器人/申请/Cewbot/25|清理引文模組未知參數]]',
	}, {
		'Category:含有未知参数的引用的页面': {
			namespace: 0,
			for_template,
			list_types: 'categorymembers',
		}
	});
}

function for_template(token, index, parent) {
	if (!wiki.is_template(citation_template_list, token))
		return;

	let changed;
	['df'].forEach(parameter => {
		const index = token.index_of[parameter];
		if (index) {
			token[index] = '';
			changed = true;
		}
	});

	return changed;
}
