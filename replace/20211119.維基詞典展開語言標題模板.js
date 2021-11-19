/*

	初版試營運。
	完成。正式運用。


https://zh.wiktionary.org/wiki/Special:ApiSandbox#action=expandtemplates&format=json&title=%E9%A6%96%E9%A1%B5&text=%7B%7B-en-%7D%7D&utf8=1

 */

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// ----------------------------------------------------------------------------

const summary_prefix = '[[Special:PermaLink/6463191#章節模板是否應該刪除？|展開語言標題模板]]: ';

function text_processor(wikitext, page_data, work_config) {
	const summary = [];

	const parsed = page_data.parse();
	const add_categories = [];

	// https://zh.wiktionary.org/wiki/Special:ApiSandbox#action=expandtemplates&format=json&title=%E9%A6%96%E9%A1%B5&text=%3D%3D%7B%7B-en-%7D%7D%3D%3D&utf8=1
	parsed.each('Template:漢語', template_token => {
		if (template_token.length === 1) {
			summary.push(template_token);
			add_categories.push('汉语');
			return '== 漢語 ==';
		}
	}, true);

	if (summary.length === 0)
		return Wikiapi.skip_edit;

	work_config.summary = summary_prefix + summary.unique().join(', ');
	if (add_categories.length > 0) {
		parsed.each('category', category_token => {
			const index = add_categories.indexOf(category_token.name);
			if (index >= 0) {
				add_categories.splice(index, 1);
			}
		});
		if (add_categories.length > 0) {
			add_categories.forEach(category_name => {
				parsed.push(`[[Category:${category_name}]]`);
			});
		}
	}
	return parsed.toString();
}

(async () => {
	login_options.API_URL = 'zh.wiktionary';
	//console.trace(login_options);
	await wiki.login(login_options);

	await replace_tool.replace({
		log_to: null,
		not_bot_requests: true,
		wiki,
	}, {
		'Template:漢語': { text_processor },
	});
})();
