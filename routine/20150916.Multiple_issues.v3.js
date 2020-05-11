// node 20150916.Multiple_issues.v3.js use_language=en
// 合併/拆分{{多個問題}}模板

/*

初版試營運 因為 enwiki 量大，不得不採用 inplace 處理法。

 @see https://en.wikipedia.org/wiki/Wikipedia:AutoWikiBrowser/General_fixes#Multiple_issues_.28MultipleIssues.29

 TODO:
 (old format templates) Corrects casing of exiting parameters
 When not in zeroth section, includes |section=yes parameter
 Does not operate if an article level-2 section has more than one {{Multiple issues}}


 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// ----------------------------------------------------------------------------

// 讀入手動設定 manual settings。
function adapt_configuration(latest_task_configuration) {
	const configuration = latest_task_configuration;
	// console.log(configuration);
	// console.log(wiki);

	configuration.Multiple_issues_template_name = configuration.Multiple_issues_template_name ? wiki.to_namespace(configuration.Multiple_issues_template_name, 'template') : 'Template:Multiple issues';
	configuration.Multiple_issues_template_alias_list = configuration.Multiple_issues_template_alias_list;

	configuration.template_count_to_be_split = +configuration.template_count_to_be_split || 1;
	configuration.template_count_to_be_merged = +configuration.template_count_to_be_merged || 3;
	if (!(1 <= configuration.template_count_to_be_split)
		|| !(configuration.template_count_to_be_split < configuration.template_count_to_be_merged)) {
		throw new Error('模板數量不合理');
	}
	configuration.template_count_to_be_reported = +configuration.template_count_to_be_reported || configuration.template_count_to_be_merged + 1;

	// 維護模板名 [[Category:Cleanup templates]]
	configuration['maintenance template list'] = configuration['maintenance template list'] || [];
	configuration['maintenance template list to be excluded'] = configuration['maintenance template list to be excluded'] || [];

	// 報表添加維護分類
	let categories = configuration['Categories adding to report'];
	if (categories) {
		if (!Array.isArray(categories)) {
			categories = [categories];
		}
		categories = categories.map(category_name => `[[Category:${category_name}]]\n`).join('');
	} else {
		categories = '';
	}
	configuration['Categories adding to report'] = categories;

	// CeL.log('Configuration:');
	// console.log(configuration);
}

// ----------------------------------------------------------------------------

(async () => {
	login_options.configuration_adapter = adapt_configuration;
	await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
	await main_process();
})();

async function main_process() {
	const configuration = wiki.latest_task_configuration;

	const cache_file_path = 'Multiple_issues.' + wiki.site_name() + '.json';
	let cached_data;
	try {
		cached_data = JSON.parse(CeL.read_file(cache_file_path));
	} catch{ }
	// console.log(await
	// wiki.redirects_here(configuration.Multiple_issues_template_name));
	// console.log(await wiki.redirects_here('Template:Issues'));
	if (cached_data) {
		Object.assign(configuration, cached_data);
	} else {
		if (!configuration.Multiple_issues_template_alias_list) {
			configuration.Multiple_issues_template_alias_list = (await wiki.redirects_here(configuration.Multiple_issues_template_name))
				// wiki.remove_namespace() /^Template:/
				.map(template => wiki.remove_namespace(template));
			// console.log(configuration.Multiple_issues_template_alias_list);
			configuration.Multiple_issues_template_name = configuration.Multiple_issues_template_alias_list[0];
		}
		configuration.Multiple_issues_template_alias_hash = configuration.Multiple_issues_template_alias_list.to_hash();
		// console.log(configuration.Multiple_issues_template_alias_hash);

		await get_maintenance_template_list();
		CeL.write_file(cache_file_path, {
			Multiple_issues_template_alias_hash: configuration.Multiple_issues_template_alias_hash,
			maintenance_template_hash: configuration.maintenance_template_hash,
		});
	}
	// free
	delete configuration.Multiple_issues_template_alias_list;
	delete configuration['maintenance template list'];
	delete configuration['maintenance template list to be excluded'];
	// console.trace(configuration);

	// (pageid in pageid_processed): have processed
	configuration.pageid_processed = Object.create(null);
	const pages_including_Multiple_issues_template = await wiki.embeddedin(configuration.Multiple_issues_template_name, {
		//limit: 5,
		namespace: 0,
	});
	if (false) {
		//find all maintenance templates
		await wiki.for_each_page(pages_including_Multiple_issues_template, check_maintenance_template_name);
		return;
	}

	await wiki.for_each_page(pages_including_Multiple_issues_template, check_pages_including_Multiple_issues_template, {
		summary: 'Normalize {{Multiple issues}}'
	});

	routine_task_done('1 week');
}

// ----------------------------------------------------------------------------

async function get_maintenance_template_list() {
	const configuration = wiki.latest_task_configuration;

	const maintenance_template_list_to_be_excluded = Object.create(null);
	for (let template of configuration['maintenance template list to be excluded']) {
		const list = await wiki.redirects_here(wiki.to_namespace(template, 'template'));
		// `list[0].title` is the redirect target.
		const main_title = list[0].title;
		if (!main_title)
			continue;
		maintenance_template_list_to_be_excluded[main_title] = null;
	}
	// configuration['maintenance template list to be excluded'] =
	// maintenance_template_list_to_be_excluded;

	const maintenance_template_hash = Object.create(null);
	for (let index = 0; index < configuration['maintenance template list'].length; index++) {
		const template = CeL.wiki.normalize_title(configuration['maintenance template list'][index]);
		if (template in maintenance_template_hash) {
			// 已處理過。
			continue;
		}

		process.stdout.write(`Get maintenance template list ${index}/${configuration['maintenance template list'].length} {{${template}}}... \r`);
		// console.log(wiki.to_namespace(template, 'template'));
		const list = await wiki.redirects_here(wiki.to_namespace(template, 'template'), {
			redirects: 1,
			converttitles: 1
		});
		// console.log(list);

		// `list[0].title` is the redirect target.
		let main_title = list[0].title;
		if (!main_title)
			continue;
		if (main_title in maintenance_template_list_to_be_excluded)
			continue;
		main_title = wiki.remove_namespace(main_title);
		if (main_title in maintenance_template_hash)
			continue;
		maintenance_template_hash[main_title] = main_title;
		for (let page_data of list)
			maintenance_template_hash[wiki.remove_namespace(page_data.title)] = main_title;
	}
	// console.log(maintenance_template_hash);
	configuration.maintenance_template_hash = maintenance_template_hash;
}

// ---------------------------------------------------------------------//

const maintenance_template_hash = Object.create(null);
function check_maintenance_template_name(page_data) {
	const configuration = wiki.latest_task_configuration;
	/** {Array} parsed page content 頁面解析後的結構。 */
	const parsed = page_data.parse();
	// debug 用.
	// check parser, test if parser working properly.
	if (page_data.wikitext !== parsed.toString()) {
		console.log(CeL.LCS(page_data.wikitext, parsed.toString(), 'diff'));
		throw new Error('Parser error: ' + CeL.wiki.title_link_of(page_data));
	}

	let changed;
	// using for_each_token()
	parsed.each('template', token => {
		if (!(token.name in configuration.Multiple_issues_template_alias_hash))
			return;

		parsed.each.call(token.parameters[1], 'template', template => {
			if (!(template.name in maintenance_template_hash)) {
				maintenance_template_hash[template.name] = null;
				changed = true;
			}
		}, {
			// 只探索第一層。
			max_depth: 1
		});
	}, {
		// 只探索第一層。
		max_depth: 1
	});

	if (changed) {
		const maintenance_template_list = Object.keys(maintenance_template_hash).sort();
		CeL.log(JSON.stringify(maintenance_template_list));
	}
}

// ---------------------------------------------------------------------//

async function check_pages_including_Multiple_issues_template(page_data) {
	const configuration = wiki.latest_task_configuration;
	configuration.pageid_processed[page_data.pageid] = null;
	/** {Array} parsed page content 頁面解析後的結構。 */
	const parsed = page_data.parse();
	// debug 用.
	// check parser, test if parser working properly.
	if (page_data.wikitext !== parsed.toString()) {
		console.log(CeL.LCS(page_data.wikitext, parsed.toString(), 'diff'));
		throw new Error('Parser error: ' + CeL.wiki.title_link_of(page_data));
	}

	// console.log(this.page_to_edit);
	// console.log(this);
	this.maintenance_template_outer = [];
	this.maintenance_template_inside = [];
	this.for_each_token = parsed.each;
	parsed.each(check_maintenance_templates.bind(this), {
		// 只探索第一層，探索到第一個標題為止。
		max_depth: 1
	});

	console.log(`${CeL.wiki.title_link_of(page_data)}: ${this.maintenance_template_inside.length}+${this.maintenance_template_outer.length} maintenance templates: ${this.maintenance_template_inside.join('|')} + ${this.maintenance_template_outer.join('|')}`);
	// return parsed.toString();
}

function check_maintenance_templates(token, index, parent, depth) {
	if (token.type === 'section_title') {
		// 只探索第一層，探索到第一個標題為止。
		return this.for_each_token.exit;
	}

	if (token.type !== 'transclusion') {
		return;
	}

	const configuration = wiki.latest_task_configuration;

	// console.log(configuration.Multiple_issues_template_alias_hash);
	// console.log([token.name, token.name in
	// configuration.Multiple_issues_template_alias_hash]);
	if (token.name in configuration.Multiple_issues_template_alias_hash) {
		// console.log(token.parameters[1]);
		this.for_each_token.call(token.parameters[1], 'template', token => {
			if (token.name in configuration.maintenance_template_hash) {
				this.maintenance_template_inside.push(token.name);
			}
		});
		return;
	}

	if (token.name in configuration.maintenance_template_hash) {
		this.maintenance_template_outer.push(token.name);
		return;
	}
}
