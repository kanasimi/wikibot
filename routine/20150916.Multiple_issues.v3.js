// node 20150916.Multiple_issues.v3.js use_language=en
// 合併/拆分{{多個問題}}模板

/*

2020/5/13 6:44:35	初版試營運 因為 enwiki 量大，不得不採用 inplace 處理法。

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

	/** {String}{{Multiple issues}}/{{多個問題}}模板本名 without "Template:" prefix */
	configuration.Multiple_issues_template_name = configuration.Multiple_issues_template_name ? configuration.Multiple_issues_template_name : 'Multiple issues';
	/** {Array}{{多個問題}}模板別名 alias */
	configuration.Multiple_issues_template_alias_list = configuration.Multiple_issues_template_alias_list;

	/** {Natural}須拆分模板數 */
	configuration.template_count_to_be_split = +configuration.template_count_to_be_split || 1;
	/** {Natural}須合併模板數 */
	configuration.template_count_to_be_merged = +configuration.template_count_to_be_merged || 3;
	if (!(1 <= configuration.template_count_to_be_split)
		// assert: template_count_to_be_split < template_count_to_be_merged
		|| !(configuration.template_count_to_be_split < configuration.template_count_to_be_merged)) {
		throw new Error('模板數量不合理');
	}
	/** {Natural}列入報表的最低模板數 */
	configuration.template_count_to_be_reported = +configuration.template_count_to_be_reported || configuration.template_count_to_be_merged + 1;

	/**
	 * 可包含在{{多個問題}}模板中之維基百科維護模板名(Wikipedia maintenance templates)
	 * [[Category:Cleanup templates]]
	 * 
	 * @type {Array}
	 * 
	 * @see [[維基百科:模板訊息/清理]], [[Category:維基百科維護模板]], [[Category:條目訊息模板]],
	 *      {{Ambox}}, [[WP:HAT#頂註模板]], [[Category:Wikipedia maintenance
	 *      templates]]
	 */
	configuration['maintenance template list'] = configuration['maintenance template list'] || [];
	/**
	 * 須排除之維護模板別名。不可包含在{{多個問題}}模板中之維基百科維護模板名(Wikipedia maintenance templates)
	 * 那些會導致刪除的tag（比如substub、關注度、notmandarin、merge那幾個）不要合併進去。
	 * 
	 * @type {Array}
	 * 
	 * @see [[Category:刪除模板]]
	 */
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
	if (false) {
		console.log(await wiki.redirects_here(configuration.Multiple_issues_template_name));
		console.log(await wiki.redirects_here('Template:Issues'));
	}
	if (cached_data) {
		Object.assign(configuration, cached_data);
	} else {
		// 解析出所有維護模板別名
		if (!configuration.Multiple_issues_template_alias_list) {
			configuration.Multiple_issues_template_alias_list = (await wiki.redirects_here(wiki.to_namespace(configuration.Multiple_issues_template_name, 'template')))
				// wiki.remove_namespace() /^Template:/
				.map(template => wiki.remove_namespace(template));
			// console.log(configuration.Multiple_issues_template_alias_list);
			// 維護模板本名
			configuration.Multiple_issues_template_name = configuration.Multiple_issues_template_alias_list[0];
		}
		configuration.Multiple_issues_template_alias_hash = configuration.Multiple_issues_template_alias_list.to_hash();
		// console.log(configuration.Multiple_issues_template_alias_hash);

		await get_maintenance_template_list();
		CeL.write_file(cache_file_path, {
			Multiple_issues_template_name: configuration.Multiple_issues_template_name,
			Multiple_issues_template_alias_hash: configuration.Multiple_issues_template_alias_hash,
			maintenance_template_hash: configuration.maintenance_template_hash,
		});
	}
	// free
	delete configuration.Multiple_issues_template_alias_list;
	delete configuration['maintenance template list'];
	delete configuration['maintenance template list to be excluded'];
	if (false) {
		console.trace(configuration);
		CeL.log('總共有 ' + Object.values(configuration.maintenance_template_hash).sort().unique() + ' 個維護模板名.');
		console.log(Object.values(configuration.maintenance_template_hash).sort().unique().map(t => '* ' + t).join('\n'));
	}

	// configuration.count_list[4] = [ pages with 4 maintenance templates ]
	configuration.count_list = [];
	// (pageid in pageid_processed): have processed
	configuration.pageid_processed = Object.create(null);

	// @see [[Category:含有多个问题的条目]]
	// 處理含有 {{Multiple issues}} 的條目
	await check_template(configuration.Multiple_issues_template_name);

	// 處理含有維護模板的條目
	for (let maintenance_template of
		/** 維護模板本名 without "Template:" prefix */
		Object.values(configuration.maintenance_template_hash).unique()
			// for debug
			.slice(0, 70)) {
		await check_template(maintenance_template);
	}

	// ----------------------------------------------------

	await generate_report();

	routine_task_done('7d');
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
	if (false) {
		configuration['maintenance template list to be excluded'] = maintenance_template_list_to_be_excluded;
	}

	const maintenance_template_hash = Object.create(null);
	for (let index = 0; index < configuration['maintenance template list'].length; index++) {
		const template = CeL.wiki.normalize_title(configuration['maintenance template list'][index]);
		if (template in maintenance_template_hash) {
			// 已處理過。
			continue;
		}

		process.stdout.write(`Get maintenance template redirects ${index}/${configuration['maintenance template list'].length} {{${template}}}... \r`);
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

async function check_template(template_name) {
	const configuration = wiki.latest_task_configuration;
	const pages_including_maintenance_template = (await wiki.embeddedin(wiki.to_namespace(template_name, 'template'), {
		// for debug
		limit: 20,
		// 本作業僅處理條目命名空間
		namespace: 0,
		page_filter: page_data => !(page_data.pageid in configuration.pageid_processed)
	}));
	if (false) {
		// find all maintenance templates
		await wiki.for_each_page(pages_including_maintenance_template, check_maintenance_template_name);
		return;
	}

	// await wiki.setup_layout_elements();
	await wiki.for_each_page(pages_including_maintenance_template, check_pages_including_Multiple_issues_template, {
		log_to: log_to,
		// 規範多個問題模板
		/** {String}編輯摘要。總結報告。 */
		summary: `[[Wikipedia:Bots/Requests for approval/Cewbot 5|bot test edit]]: [[${configuration.configuration_page_title}|Normalize {{Multiple issues}}]]`,
		// for debug
		tags: 'bot trial',
	});
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
	// for debug 用.
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

	/** {Number}解析出維護模板數。 */
	const all_maintenance_template_count = this.maintenance_template_inside.length + this.maintenance_template_outer.length;
	if (all_maintenance_template_count >= configuration.template_count_to_be_reported) {
		if (!configuration.count_list[all_maintenance_template_count])
			configuration.count_list[all_maintenance_template_count] = [];
		// 統計含有過多個維護模板的條目
		configuration.count_list[all_maintenance_template_count].push(page_data.title);
	}

	let need_merge;
	if (all_maintenance_template_count <= configuration.template_count_to_be_split) {
		// need split
		if (!this.Multiple_issues_template_token) {
			return [CeL.wiki.edit.cancel, 'skip'];
		}
		need_merge = false;

	} else if (all_maintenance_template_count >= configuration.template_count_to_be_merged) {
		// 含有((template_count_to_be_merged))個以上維護模板的條目
		// e.g., 含有三個和三個以上維護模板的條目
		// need merge
		if (this.maintenance_template_outer.length === 0) {
			return [CeL.wiki.edit.cancel, 'skip'];
		}
		// assert: this.maintenance_template_outer.length > 0
		need_merge = true;

	} else if (this.maintenance_template_inside.length > 0 && this.maintenance_template_outer.length > 0) {
		need_merge = true;
	} else {
		// others: 可以忽略不處理的條目
		// 含有((>template_count_to_be_split))–((<template_count_to_be_merged))個維護模板的條目_list
		// e.g., 含有2個維護模板的條目。不動這些條目。
		return [CeL.wiki.edit.cancel, 'skip'];
	}

	CeL.warn(`${CeL.wiki.title_link_of(page_data)}: Need ${need_merge ? 'merge' : 'split'}. ${this.maintenance_template_inside.length}+${this.maintenance_template_outer.length} maintenance templates: ${this.maintenance_template_inside.map(t => t.name).join(' | ')} + ${this.maintenance_template_outer.map(t => t.name).join(' | ')}`);

	if (need_merge) {
		// 處理須合併的條目:
		// 抽取出所有維護模板，再於首個維護模板出現的地方插入{{多個問題}}模板

		// remove outer maintenance template
		this.maintenance_template_outer.forEach(function (token) {
			// 抽取出此維護模板
			let index = token.index;
			token.parent[index++] = '';
			// @see function remove_token_from_parent()
			if (token.parent.length > index && /^\s*\n/.test(token.parent[index]))
				token.parent[index] = token.parent[index].toString().replace(/^\s*\n/, '');
		});
		let Multiple_issues_template_token = this.Multiple_issues_template_token;
		if (Multiple_issues_template_token) {
			// 本來就已經含有{{多個問題}}模板。
			this.summary += `: Merge ${this.maintenance_template_outer.length} template(s) into {{Multiple issues}}: ${this.maintenance_template_outer.map(t => t.name).join(', ')}`;
			const tokens = Multiple_issues_template_token.parameters[1];
			if (!/^\s*\n/.test(token.parent[0])) {
				// be sure .startsWith('\n')
				tokens.unshift('\n');
			}
			if (!/\n/.test(tokens[tokens.length - 1])) {
				// be sure .endsWith('\n')
				tokens.push('\n');
			}
			// 維護模板內容
			tokens.push(this.maintenance_template_outer.join('\n') + '\n');
		} else {
			// 插入{{多個問題}}模板。盡可能不改變原先維護模板之順序。
			// 維護模板_count>=template_count_to_be_merged&&不含有{{多個問題}}模板
			// 須合併維護模板的條目，卻不含有{{多個問題}}模板。
			// in-place replace
			this.summary += `: Create {{Multiple issues}} with ${this.maintenance_template_outer.length} maintenance template(s): ${this.maintenance_template_outer.map(t => t.name).join(', ')}`;
			const token = this.maintenance_template_outer[0];
			token.parent[token.index] = `{{${configuration.Multiple_issues_template_name}|\n${this.maintenance_template_outer.join('\n')}\n}}\n`;
		}
	} else {
		// need split
		// 處理須拆分的條目:
		// 維護模板_count<=template_count_to_be_split&&含有{{多個問題}}模板
		// 含有{{多個問題}}模板，卻不在可以忽略不處理的條目list或須合併維護模板的條目list中。

		// assert true === !!this.Multiple_issues_template_token
		this.summary += `: Split {{Multiple issues}} for only ${all_maintenance_template_count} maintenance template(s): ${this.maintenance_template_inside.map(t => t.name).join(', ')}`;
		this.Multiple_issues_template_token.parent[this.Multiple_issues_template_token.index] = this.Multiple_issues_template_token.parameters[1];
	}

	return parsed.toString();
}

// 不會處理把維護模板放在或注解中的條目。
function check_maintenance_templates(token, index, parent) {
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
		token.index = index;
		token.parent = parent;
		this.Multiple_issues_template_token = token;
		// console.log(token.parameters[1]);
		this.for_each_token.call(token.parameters[1], 'template', token => {
			if (token.name in configuration.maintenance_template_hash) {
				this.maintenance_template_inside.push(token);
			}
		});
		return;
	}

	if (token.name in configuration.maintenance_template_hash) {
		token.index = index;
		token.parent = parent;
		this.maintenance_template_outer.push(token);
		return;
	}
}

// ----------------------------------------------------------------------------

async function generate_report() {
	const configuration = wiki.latest_task_configuration;
	let all_count = 0;
	let content = [];

	configuration.count_list.forEach((list, count) => {
		all_count += list.length;
		content.push([count, '共' + list.length
			// \n\n
			+ '條目。\n[['
			// 避免顯示過多。
			+ (list.length <= 1e4 ? list : list.slice(0, 1e4))
				//
				.join(']], [[') + ']]']);
	});
	content.reverse();
	content.unshift(['模板數', '含有維護模板之條目']);

	content =
		// __NOTITLECONVERT__
		'__NOCONTENTCONVERT__\n'
		+ '以下列出含有太多維護模板之條目：共' + all_count + '條目。\n'
		+ '* 本條目會每周更新，毋須手動修正。您可以從'
		+ CeL.wiki.title_link_of(configuration.configuration_page_title, '這個頁面')
		+ '更改設定參數。\n'
		// [[WP:DBR]]: 使用<onlyinclude>包裹更新時間戳。
		+ '* 產生時間：<onlyinclude>~~~~~</onlyinclude>\n\n' + '{{see|' + log_to + '}}\n\n<!-- report begin -->\n'
		+ CeL.wiki.array_to_table(content, { 'class': "wikitable" })
		+ '\n<!-- report end -->\n' + configuration['Categories adding to report'];

	// [[Wikipedia:頁面存廢討論/討論頁模板維護報告]]
	await wiki.edit_page(configuration.report_page, content, {
		bot: 1,
		nocreate: 1,
		redirects: 1,
		// 規範多個問題模板
		summary: `Normalize {{Multiple issues}}: 紀錄含有太多維護模板之條目: ${all_count}條`
	});
}
