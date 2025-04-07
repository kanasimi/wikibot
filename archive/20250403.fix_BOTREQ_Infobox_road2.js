/*
node task/20250403.fix_BOTREQ_Infobox_road2.js

2025/4/3 14:55:46
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
	login_options.API_URL = 'zh';
	//console.log(login_options);
	await wiki.login(login_options);
	await main_process();
})();

async function main_process() {
	await wiki.register_redirects('Template:Infobox road2');

	await wiki.for_each_page(await wiki.embeddedin('Template:Infobox road2', { namespace: 'main' }), for_each_page, {
		bot: 1,
		minor: false,
		log_to: null,
		skip_nochange: true,
		summary: 'BOTREQ: fix {{Infobox road2}} to remove parser functions',
	});

	console.log(`Done`);
}

async function for_each_page(page_data) {
	//console.log(page_data);

	const parsed = page_data.parse();
	CeL.assert([CeL.wiki.content_of(page_data), parsed.toString()], 'wikitext parser check for ' + CeL.wiki.title_link_of(page_data));

	let changed;
	parsed.each('Template:Infobox road2', template_token => {
		let wiki_text = template_token.toString();
		//console.log(wiki_text);
		if (!wiki_text.includes('{{#')) {
			return;
		}

		parsed.each.call(template_token, 'magic_word_function', magic_word_function_token => {
			//return magic_word_function_token.evaluate();
			magic_word_function_token[0] = 'subst:' + magic_word_function_token[0];
		}, true);

		wiki_text = template_token.toString();

		const matched = wiki_text.match(/{{#(\w+):[\s\S]+?}}/);
		if (matched) {
			CeL.error('Still parser functions left: ' + matched[0]);
			throw new Error('Still parser functions left: ' + matched[0]);
		}

		changed = true;
		return wiki_text;
	}, true);

	if (changed)
		return parsed.toString();
}
