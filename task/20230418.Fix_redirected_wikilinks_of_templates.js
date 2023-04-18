/*
node 20230418.Fix_redirected_wikilinks_of_templates.js

這個任務會清理導航模板的重導向內部連結。

2023/4/18 6:49:54	初版試營運

*/

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Load modules.
CeL.run('data.CSV');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('zh');

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

	//

	console.trace(wiki.latest_task_configuration.general);
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
	// https://quarry.wmcloud.org/query/72263
	const template_list = await get_template_list();
	console.log(`${template_list.size} templates to process.`);

	await wiki.for_each_page(template_list, for_each_template, {
		//summary: '[[Special:PermanentLink/76861061#需要進行之善後措施|​因應格式手冊修改]]，[[Wikipedia:格式手册/标点符号#连接号|連接號]]改用em dash。',
		summary: '轉換[[Wikipedia:格式手册/链接#模板中的内部链接|模板中的內部連結]]為目標原標題: ',
	});
}


async function get_template_list() {
	const items = CeL.parse_CSV(await (await fetch('https://quarry.wmcloud.org/run/725605/output/0/tsv')).text(), { has_title: true, skip_title: true });
	//console.log(items);

	const template_list = new Set;
	for (const item of items) {
		template_list.add(item[0]);
	}

	return template_list;
}


async function for_each_template(template_page_data) {
	//console.log(template_page_data);

	const parsed = CeL.wiki.parser(template_page_data).parse();
	const link_list = [];
	parsed.each('link', link_token => {
		link_list.push(link_token[0].toString());
	});

	if (link_list.length === 0)
		return Wikiapi.skip_edit;

	const redirects_data = await wiki.page(link_list, {
		redirects : 1,
		prop : 'info',
		multi: true,
	});
	const title_data_map = redirects_data.title_data_map;
	//console.log(link_list.map(page_title => title_data_map[page_title]));
	const convert_map = new Map;

	parsed.each('link', link_token => {
		const link_title = link_token[0].toString();
		const redirects_to = title_data_map[link_title];
		if (!redirects_to.original_title)
			return;
		let redirects_title = redirects_to.title;
		if (wiki.is_namespace(redirects_to, 'File') || wiki.is_namespace(redirects_to, 'Category'))
			redirects_title = ':' + redirects_title;
		convert_map.set(link_title, redirects_title);
		link_token[0] = redirects_title;
	});

	if (convert_map.size === 0)
		return Wikiapi.skip_edit;

	this.summary += Array.from(convert_map).map(pair => CeL.wiki.title_link_of(pair[0]) + '→' + CeL.wiki.title_link_of(pair[1])).join(', ');
	return parsed.toString();
}
