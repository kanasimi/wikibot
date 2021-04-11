'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('zh');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

let citation_template_list = [];

// ----------------------------------------------

// 讀入手動設定 manual settings。
async function adapt_configuration(latest_task_configuration) {
	//console.log(latest_task_configuration);
	// console.log(wiki);

	// ----------------------------------------------------

	const { general } = latest_task_configuration;

	citation_template_list = await wiki.embeddedin('Module:Citation/CS1');
}

// ----------------------------------------------------------------------------

(async () => {
	login_options.configuration_adapter = adapt_configuration;
	//console.log(login_options);
	await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
	await main_process();
})();

// ----------------------------------------------------------------------------

async function main_process() {
	await replace_tool.replace(null, {
		'Category:含有未知参数的引用的页面': {
			namespace: 0,
			for_template
		}
	});
}

function for_template(token, index, parent) {
	if (!wiki.is_template(token, citation_template_list))
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
