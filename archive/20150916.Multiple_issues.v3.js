/*
合併/拆分{{多個問題}}模板

node 20150916.Multiple_issues.v3.js use_language=zh
node 20150916.Multiple_issues.v3.js use_language=en
node 20150916.Multiple_issues.v3.js use_language=simple

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

const gettext = CeL.gettext;

// ----------------------------------------------------------------------------

// 讀入手動設定 manual settings。
function adapt_configuration(latest_task_configuration) {
	const configuration = latest_task_configuration;
	// console.log(configuration);
	// console.log(wiki);

	if (false) {
		console.log(gettext('規範{{%1}}模板', configuration.Multiple_issues_template_name));
	}

	// ----------------------------------------------------

	/** {String}{{Multiple issues}}/{{多個問題}}模板本名 without "Template:" prefix */
	configuration.Multiple_issues_template_name = configuration.Multiple_issues_template_name ? configuration.Multiple_issues_template_name : 'Multiple issues';
	/** {Array}{{多個問題}}模板別名 alias */
	if (false) {
		configuration.Multiple_issues_template_alias_list = configuration.Multiple_issues_template_alias_list;
	}

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
	 *      templates]], [[Wikipedia:AutoWikiBrowser/Template redirects#Maintenance templates]], [[en:Wikipedia:AutoWikiBrowser/Dated_templates]]
	 */
	configuration[gettext('維護模板名稱列表')] = configuration[gettext('維護模板名稱列表')] || [];
	/**
	 * 須排除之維護模板別名。不可包含在{{多個問題}}模板中之維基百科維護模板名(Wikipedia maintenance templates)
	 * 那些會導致刪除的tag（比如substub、關注度、notmandarin、merge那幾個）不要合併進去。
	 * 
	 * @type {Array}
	 * 
	 * @see [[Category:刪除模板]]
	 */
	configuration[gettext('須排除之維護模板名稱列表')] = configuration[gettext('須排除之維護模板名稱列表')] || [];

	// 報表添加維護分類
	let categories = configuration[gettext('報表添加維護分類')];
	if (categories) {
		if (!Array.isArray(categories)) {
			categories = [categories];
		}
		categories = categories.map(category_name => `[[Category:${category_name}]]\n`).join('');
	} else {
		categories = '';
	}
	configuration[gettext('報表添加維護分類')] = categories;

	// ----------------------------------------------------

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
	} catch { }
	if (false) {
		console.log(await wiki.redirects_here(configuration.Multiple_issues_template_name));
		console.log(await wiki.redirects_here('Template:Issues'));
	}
	if (cached_data && Date.now() - cached_data.cached_date < CeL.to_millisecond('1d')) {
		Object.assign(configuration, cached_data);
	} else {
		if (!configuration.Multiple_issues_template_alias_list) {
			configuration.Multiple_issues_template_alias_list = (await wiki.redirects_here(wiki.to_namespace(configuration.Multiple_issues_template_name, 'template')))
				// wiki.remove_namespace() /^Template:/
				.map(template => wiki.remove_namespace(template));
			// console.log(configuration.Multiple_issues_template_alias_list);
			// 模板本名
			configuration.Multiple_issues_template_name = configuration.Multiple_issues_template_alias_list[0];
		}
		configuration.Multiple_issues_template_alias_hash = configuration.Multiple_issues_template_alias_list.to_hash();
		// console.log(configuration.Multiple_issues_template_alias_hash);

		await get_maintenance_template_list();
		CeL.write_file(cache_file_path, {
			cached_date: Date.now(),
			Multiple_issues_template_name: configuration.Multiple_issues_template_name,
			Multiple_issues_template_alias_hash: configuration.Multiple_issues_template_alias_hash,
			maintenance_template_hash: configuration.maintenance_template_hash,
		});
	}

	/** 維護模板本名 without "Template:" prefix */
	const maintenance_template_list = Object.values(configuration.maintenance_template_hash).sort().unique();
	const maintenance_template_alias_list = Object.keys(configuration.maintenance_template_hash);
	//console.log(configuration.maintenance_template_hash);
	if (maintenance_template_list.join() !== configuration[gettext('維護模板名稱列表')].join()) {
		CeL.log(`總共有 ${maintenance_template_list.length} 個維護模板名，${maintenance_template_alias_list.length} 個 alias。`);
		console.log(maintenance_template_list.map(template_name => {
			const template_alias = maintenance_template_alias_list.filter(t => t !== template_name && configuration.maintenance_template_hash[t] === template_name);
			//console.log([template_name, template_alias]);
			return `# ${template_name}${template_alias.length > 0 ? ` (${template_alias.join(', ')})` : ''}`;
		}).join('\n'));
	}

	// free
	delete configuration.Multiple_issues_template_alias_list;
	delete configuration[gettext('維護模板名稱列表')];
	delete configuration[gettext('須排除之維護模板名稱列表')];
	// console.trace(configuration);

	// ----------------------------------------------------

	// configuration.count_list[4] = [ pages with 4 maintenance templates ]
	configuration.count_list = [];
	configuration.problematic_articles = [];
	// (pageid in pageid_processed): have processed
	configuration.pageid_processed = Object.create(null);

	// for debug specified article
	if (1 || false) {
		check_articles_embeddedin_template(['東南季風']);
		return;
	}

	// @see [[Category:含有多个问题的条目]]
	// 處理含有 {{Multiple issues}} 的條目
	await check_articles_embeddedin_template(configuration.Multiple_issues_template_name);

	// for debug
	// maintenance_template_list = maintenance_template_list.slice(0, 200);

	// 處理含有維護模板的條目
	for (let index = 0, length = maintenance_template_list.length; index < length; index++) {
		const maintenance_template = maintenance_template_list[index];
		CeL.info(`check_articles_embeddedin_template: ${index + 1}/${length} ${maintenance_template}`);
		await check_articles_embeddedin_template(maintenance_template);
	}

	// ----------------------------------------------------

	await generate_report();

	routine_task_done('7d');
}

// ----------------------------------------------------------------------------

function is_maintenance_template(template_name) {
	return template_name in wiki.latest_task_configuration.maintenance_template_hash;
}

// TODO: using wiki.is_template()
async function get_maintenance_template_list() {
	const configuration = wiki.latest_task_configuration;

	const maintenance_template_list_to_be_excluded = Object.create(null);
	for (const template of configuration[gettext('須排除之維護模板名稱列表')]) {
		const list = await wiki.redirects_here(wiki.to_namespace(template, 'template'));
		// `list[0].title` is the redirect target.
		const main_title = list[0].title;
		if (!main_title)
			continue;
		maintenance_template_list_to_be_excluded[main_title] = null;
	}
	if (false) {
		configuration[gettext('須排除之維護模板名稱列表')] = maintenance_template_list_to_be_excluded;
	}

	// 解析出所有維護模板別名
	// The bot will get all the redirects of maintenance template.
	const maintenance_template_hash = Object.create(null);
	for (let index = 0; index < configuration[gettext('維護模板名稱列表')].length; index++) {
		const template = CeL.wiki.normalize_title(configuration[gettext('維護模板名稱列表')][index]);
		if (template in maintenance_template_hash) {
			// 已處理過。
			continue;
		}

		CeL.log_temporary(`Get maintenance template redirects ${index}/${configuration[gettext('維護模板名稱列表')].length} {{${template}}}`);
		// console.log(wiki.to_namespace(template, 'template'));
		const list = await wiki.redirects_here(wiki.to_namespace(template, 'template'), {
			// should NOT use converttitles!
			// converttitles: 1
		});
		// console.log(list);

		// 維護模板本名
		// `list[0]` is the redirect target.
		let main_title = list[0].title;
		if (!main_title)
			continue;
		if (list[0].original_title && list[0].redirect_from && list[0].original_title !== list[0].redirect_from) {
			// TODO: 處理 converttitles。
			// e.g., for 'Template:專家'
			const original_title = wiki.remove_namespace(list[0].original_title);
			maintenance_template_hash[original_title] = original_title;
		}

		if (main_title in maintenance_template_list_to_be_excluded)
			continue;
		main_title = wiki.remove_namespace(main_title);
		if (main_title in maintenance_template_hash)
			continue;
		maintenance_template_hash[main_title] = main_title;
		for (const page_data of list)
			maintenance_template_hash[wiki.remove_namespace(page_data.title)] = main_title;
	}
	// console.log(maintenance_template_hash);
	configuration.maintenance_template_hash = maintenance_template_hash;
}

// ---------------------------------------------------------------------//

async function check_articles_embeddedin_template(template_name) {
	const configuration = wiki.latest_task_configuration;
	const pages_including_maintenance_template = Array.isArray(template_name) ? template_name : (await wiki.embeddedin(wiki.to_namespace(template_name, 'template'), {
		// for debug
		// limit: 20,
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
	await wiki.for_each_page(pages_including_maintenance_template, check_pages_including_maintenance_template, {
		log_to: log_to,
		// 規範多個問題模板
		/** {String}編輯摘要。總結報告。 */
		// [[Wikipedia:Bots/Requests for approval/Cewbot 5|bot test edit]]:
		summary: `[[${configuration.configuration_page_title}|${gettext('規範{{%1}}模板', configuration.Multiple_issues_template_name)}]]`,
		// for debug
		// tags: wiki.site_name() === 'enwiki' ? 'bot trial' : '',
	});
}

// ---------------------------------------------------------------------//

check_maintenance_template_name.maintenance_template_hash = Object.create(null);
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
			if (!(template.name in check_maintenance_template_name.maintenance_template_hash)) {
				check_maintenance_template_name.maintenance_template_hash[template.name] = null;
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
		const maintenance_template_list = Object.keys(check_maintenance_template_name.maintenance_template_hash).sort();
		CeL.log(JSON.stringify(maintenance_template_list));
	}
}

// ---------------------------------------------------------------------//

async function check_pages_including_maintenance_template(page_data) {
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
		// Only search the root elements, till the first section title.
		max_depth: 1
	});
	//console.trace([this.maintenance_template_inside, this.maintenance_template_outer]);

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
		const Multiple_issues_template_token = this.Multiple_issues_template_token;
		if (!Multiple_issues_template_token) {
			return [CeL.wiki.edit.cancel, 'skip'];
		}
		const parameters = Object.keys(Multiple_issues_template_token.parameters);
		if (!/^1?$/.test(parameters)) {
			if (wiki.site_name() === 'zhwiki') {
				// fix for "|expand=2010-10-22T16:37:55+00:00" in zhwiki
				let changed;
				let parameter_1 = Multiple_issues_template_token.parameters[1];
				parameters.forEach(parameter => {
					const template = CeL.wiki.normalize_title(parameter);
					const time = Multiple_issues_template_token.parameters[parameter].trim();
					const is_date = /^\d{4}年\d{1,2}月(\d{1,2}日)?$/.test(time);
					if (false) {
						console.log([template, is_maintenance_template(template), Date.parse(time)]);
					}
					if (is_maintenance_template(template) && (is_date || Date.parse(time) > 0)) {
						if (!parameter_1) {
							parameter_1 = [''];
							parameter_1.toString = function () {
								return this.join('\n') + '\n';
							};
							// 不影響 index。
							Multiple_issues_template_token.push(parameter_1);
						}
						// assert: Array.isArray(parameter_1)
						parameter_1.push(`{{${template}|${is_date ? 'date' : 'time'}=${time}}}`);
						Multiple_issues_template_token[Multiple_issues_template_token.index_of[parameter]] = '';
						changed = true;
					}
				});
				if (changed) {
					Multiple_issues_template_token.parent[Multiple_issues_template_token.index] = Multiple_issues_template_token.toString().replace(/\|([\s\n]*\|)+/g, '|');
					return parsed.toString();
				}
			}
			CeL.warn(`${CeL.wiki.title_link_of(page_data)}: There are additional parameters, so we cannot remove {{${configuration.Multiple_issues_template_name}}}: ${parameters.join(' | ')}`);
			configuration.problematic_articles.push(page_data.title);
			return [CeL.wiki.edit.cancel, 'skip'];
		}

		if (this.maintenance_template_inside.length === 0 && Multiple_issues_template_token.parameters[1].toString().trim()) {
			CeL.warn(`${CeL.wiki.title_link_of(page_data)}: The parameter 1 is strange, so I cannot remove {{${configuration.Multiple_issues_template_name}}}: ${Multiple_issues_template_token.parameters[1].toString()}`);
			configuration.problematic_articles.push(page_data.title);
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

	// ----------------------------------------------------

	CeL.warn(`${CeL.wiki.title_link_of(page_data)}: Need ${need_merge ? 'merge' : 'split'}. ${this.maintenance_template_inside.length}+${this.maintenance_template_outer.length} maintenance templates: ${this.maintenance_template_inside.map(t => t.name).join(' | ')} + ${this.maintenance_template_outer.map(t => t.name).join(' | ')}`);

	if (need_merge) {
		// 處理須合併的條目:
		// 抽取出所有維護模板，再於首個維護模板出現的地方插入{{多個問題}}模板

		// remove outer maintenance template
		this.maintenance_template_outer.forEach(token => {
			// 抽取出此維護模板
			CeL.wiki.parser.remove_token(token, undefined, undefined, true);
		});
		const Multiple_issues_template_token = this.Multiple_issues_template_token;
		if (Multiple_issues_template_token) {
			// 本來就已經含有{{多個問題}}模板。
			this.summary += `: ${gettext('將%1個維護模板納入{{%2}}模板', this.maintenance_template_outer.length, configuration.Multiple_issues_template_name)}: ${this.maintenance_template_outer.map(t => t.name).join(', ')}`;
			const tokens = Multiple_issues_template_token.parameters[1];
			if (!/^\s*\n/.test(tokens[0])) {
				// be sure .startsWith('\n')
				tokens.unshift('\n');
			}
			if (!/\n/.test(tokens.at(-1))) {
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
			this.summary += `: ${gettext('創建包含%1個維護模板的{{%2}}模板', this.maintenance_template_outer.length, configuration.Multiple_issues_template_name)}: ${this.maintenance_template_outer.map(t => t.name).join(', ')}`;
			const token = this.maintenance_template_outer[0];
			token.parent[token.index] = `{{${configuration.Multiple_issues_template_name}|\n${this.maintenance_template_outer.join('\n')}\n}}\n`;
			CeL.wiki.parser.remove_heading_spaces(token.parent, token.index + 1);
		}
	} else {
		// need split
		// 處理須拆分的條目:
		// 維護模板_count<=template_count_to_be_split&&含有{{多個問題}}模板
		// 含有{{多個問題}}模板，卻不在可以忽略不處理的條目list或須合併維護模板的條目list中。

		// assert true === !!this.Multiple_issues_template_token
		this.summary += `: ${gettext('拆分僅有%1個維護模板的{{%2}}模板', all_maintenance_template_count, configuration.Multiple_issues_template_name)}: ${this.maintenance_template_inside.map(t => t.name).join(', ')}`;
		const token = this.Multiple_issues_template_token;
		token.parent[token.index] = token.parameters[1].toString().trim();
	}

	//	console.log(parsed.toString());
	//	console.log(parsed);
	return parsed.toString();
}

// 不會處理把維護模板放在或注解中的條目。
function check_maintenance_templates(token, index, parent) {
	if (token.type === 'section_title') {
		// 只探索第一層，探索到第一個標題為止。
		// Only search the root elements, till the first section title.
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
			if (is_maintenance_template(token.name)) {
				this.maintenance_template_inside.push(token);
			}
		});
		return;
	}

	if (is_maintenance_template(token.name)) {
		token.index = index;
		token.parent = parent;
		this.maintenance_template_outer.push(token);
		// TODO: deal with {{maintenance_template}}<!-- comments -->
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
		content.push([count, gettext('共%1條目。', list.length)
			// \n\n
			+ '\n[['
			// 避免顯示過多。
			+ (list.length <= 1e4 ? list : list.slice(0, 1e4))
				//
				.join(']], [[') + ']]']);
	});
	content.reverse();
	content.unshift([gettext('模板數'), gettext('含有維護模板之條目')]);

	content =
		// __NOTITLECONVERT__
		'__NOCONTENTCONVERT__\n'
		+ gettext('以下列出含有太多維護模板之條目：') + gettext('共%1條目。', all_count) + '\n'
		+ '* ' + gettext('本報告會每周更新，毋須手動修正。') + gettext('您可以從%1更改設定參數。',
			CeL.wiki.title_link_of(configuration.configuration_page_title, gettext('這個設定頁面')))
		+ '\n'
		// [[WP:DBR]]: 使用<onlyinclude>包裹更新時間戳。
		+ '* ' + gettext('產生時間：%1', '<onlyinclude>~~~~~</onlyinclude>') + '\n\n' + '{{see|' + log_to + '}}\n\n<!-- report begin -->\n'
		+ CeL.wiki.array_to_table(content, { 'class': "wikitable" });
	if (configuration.problematic_articles.length > 0) {
		content += `\n\n== ${gettext('有問題的條目')} ==\n[[` + configuration.problematic_articles.join(']], [[') + ']]';
	}
	content += '\n<!-- report end -->\n' + configuration[gettext('報表添加維護分類')];

	// [[Wikipedia:頁面存廢討論/討論頁模板維護報告]]
	await wiki.edit_page(configuration.report_page, content, {
		bot: 1,
		nocreate: 1,
		redirects: 1,
		summary: `${gettext('規範{{%1}}模板', configuration.Multiple_issues_template_name)}: ${gettext('紀錄含有太多維護模板之條目: %1條', all_count)} (${gettext('列入報表的最低模板數: %1', configuration.template_count_to_be_reported)})`
	});
}
