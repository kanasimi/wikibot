/*
合併/拆分{{多個問題}}模板

node 20150916.Multiple_issues.v4.js use_language=zh
node 20150916.Multiple_issues.v4.js use_language=en
node 20150916.Multiple_issues.v4.js use_language=simple
node 20150916.Multiple_issues.v4.js use_language=ks

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
async function adapt_configuration(latest_task_configuration) {
	const configuration = latest_task_configuration;
	// console.log(configuration);
	// console.log(wiki);

	if (false) {
		// test if works
		// gettext_config:{"id":"normalize-template-$1"}
		console.log(gettext('Normalize {{%1}}', configuration.Multiple_issues_template_name));
	}

	// ----------------------------------------------------

	/** {String}{{Multiple issues}}/{{多個問題}}模板本名 without "Template:" prefix */
	configuration.Multiple_issues_template_name = wiki.to_namespace(configuration.Multiple_issues_template_name || 'Multiple issues', 'template');
	configuration.Multiple_issues_template_name_without_namespace = wiki.remove_namespace(configuration.Multiple_issues_template_name);

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

	let maintenance_template__category_list = [/* 'Category:Cleanup templates' */];
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
	let maintenance_template_list = (configuration[
		// gettext_config:{"id":"maintenance-template-list"}
		gettext('maintenance template list')] || []).filter(template_name => {
			if (wiki.is_namespace(template_name, 'Category')) {
				maintenance_template__category_list.push(template_name);
			} else {
				return true;
			}
		}).map(template_name => wiki.to_namespace(template_name, 'template'));
	maintenance_template_list = wiki.to_namespace(maintenance_template_list, 'template');

	await wiki.register_redirects([configuration.Multiple_issues_template_name].append(maintenance_template__category_list));
	maintenance_template__category_list = await Promise.all(wiki.redirect_target_of(maintenance_template__category_list).map(category_name => wiki.category_tree(category_name, { namespace: 'Template' })));
	function append_maintenance_templates(list) {
		//console.trace(list);
		maintenance_template_list.append(list.map(page_data => page_data.title));
		if (list.subcategories)
			Object.values(list.subcategories).forEach(append_maintenance_templates);
	}
	maintenance_template__category_list.forEach(append_maintenance_templates);
	//console.log(JSON.stringify(maintenance_template_list));

	/**
	 * 須排除之維護模板別名。不可包含在{{多個問題}}模板中之維基百科維護模板名(Wikipedia maintenance templates)
	 * 那些會導致刪除的tag（比如substub、關注度、notmandarin、merge那幾個）不要合併進去。
	 * 
	 * @type {Array}
	 * 
	 * @see [[Category:刪除模板]]
	 */
	configuration[
		// gettext_config:{"id":"maintenance-template-list-to-be-excluded"}
		gettext('maintenance template list to be excluded')] = configuration[
			// gettext_config:{"id":"maintenance-template-list-to-be-excluded"}
			gettext('maintenance template list to be excluded')]?.map(template_name => wiki.to_namespace(template_name, 'template')) || [];

	// get_maintenance_template_list()
	// 解析出所有維護模板別名
	// The bot will get all the redirects of maintenance template.
	await wiki.register_redirects(maintenance_template_list.append(configuration[
		// gettext_config:{"id":"maintenance-template-list-to-be-excluded"}
		gettext('maintenance template list to be excluded')]), { namespace: 'Template', no_message: true });
	// gettext_config:{"id":"maintenance-template-list-to-be-excluded"}
	configuration[gettext('maintenance template list to be excluded')] = wiki.redirect_target_of(configuration[
		// gettext_config:{"id":"maintenance-template-list-to-be-excluded"}
		gettext('maintenance template list to be excluded')]);
	//console.trace(wiki.redirect_target_of(maintenance_template_list));
	/** 維護模板本名 without "Template:" prefix */
	configuration.maintenance_template_list = wiki.redirect_target_of(maintenance_template_list).filter(template_name => !configuration[
		// gettext_config:{"id":"maintenance-template-list-to-be-excluded"}
		gettext('maintenance template list to be excluded')].includes(template_name)).sort().unique();
	const maintenance_template_alias_list = wiki.aliases_of_page(configuration.maintenance_template_list, { alias_only: true });
	CeL.log(`總共有 ${configuration.maintenance_template_list.length} 個維護模板名，${maintenance_template_alias_list.length} 個 alias。`);
	console.log(configuration.maintenance_template_list.map(template_name => {
		const template_alias = wiki.aliases_of_page(template_name, { alias_only: true });
		//console.log([template_name, template_alias]);
		return `# ${wiki.remove_namespace(template_name)}${template_alias.length > 0 ? ` (${template_alias.map(t => wiki.remove_namespace(t)).join(', ')})` : ''}`;
	}).join('\n'));

	// free
	// gettext_config:{"id":"maintenance-template-list"}
	delete configuration[gettext('maintenance template list')];
	// gettext_config:{"id":"maintenance-template-list-to-be-excluded"}
	delete configuration[gettext('maintenance template list to be excluded')];

	// ----------------------------------------------------

	// gettext_config:{"id":"categories-added-to-report"}
	let categories = configuration[gettext('Categories added to the report')];
	if (categories) {
		if (!Array.isArray(categories)) {
			categories = [categories];
		}
		categories = categories.map(category_name => `[[${wiki.to_namespace(category_name.replace(/^:/, ''), 'Category')}]]`).join('\n');
		//console.trace(categories);
	} else {
		categories = '';
	}
	// gettext_config:{"id":"categories-added-to-report"}
	configuration[gettext('Categories added to the report')] = categories;

	// ----------------------------------------------------

	// CeL.log('Configuration:');
	// console.trace(configuration);
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
	// console.trace(configuration);

	Object.assign(configuration, {
		// count_list[4] : [ pages with 4 maintenance templates ]
		count_list: [],
		problematic_articles: [],
		// (pageid in pageid_processed): have processed
		pageid_processed: Object.create(null)
	});

	// for debug specified article
	if (false) {
		setTimeout(() => check_articles_embeddedin_template(['Mass killings under communist regimes']), 0);
		return;
	}

	// @see [[Category:含有多个问题的条目]]
	// 處理含有 {{Multiple issues}} 的條目
	await check_articles_embeddedin_template(configuration.Multiple_issues_template_name);

	// for debug
	// maintenance_template_list = maintenance_template_list.slice(0, 200);

	// 處理含有維護模板的條目
	for (let index = 0, length = configuration.maintenance_template_list.length; index < length; index++) {
		const maintenance_template = configuration.maintenance_template_list[index];
		CeL.info(`check_articles_embeddedin_template: ${index + 1}/${length} ${maintenance_template}`);
		await check_articles_embeddedin_template(maintenance_template);
	}

	// ----------------------------------------------------

	await generate_report();

	routine_task_done('7d');
}

// ----------------------------------------------------------------------------

function is_Multiple_issues_template(template_name) {
	return wiki.is_template(template_name, wiki.latest_task_configuration.Multiple_issues_template_name);
}

function is_maintenance_template(template_name) {
	template_name = wiki.redirect_target_of(template_name, { namespace: 'template' });
	return wiki.latest_task_configuration.maintenance_template_list.includes(template_name);
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

	// await wiki.setup_layout_elements();
	await wiki.for_each_page(pages_including_maintenance_template, check_pages_including_maintenance_template, {
		log_to: log_to,
		// 規範多個問題模板
		/** {String}編輯摘要。總結報告。 */
		// [[Wikipedia:Bots/Requests for approval/Cewbot 5|bot test edit]]:
		summary: `[[${configuration.configuration_page_title}|${gettext(
			// gettext_config:{"id":"normalize-template-$1"}
			'Normalize {{%1}}', configuration.Multiple_issues_template_name_without_namespace)}]]`,
		// for debug
		// tags: wiki.site_name() === 'enwiki' ? 'bot trial' : '',
	});
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

	/** {Number}解析出整個頁面包含的維護模板數量。 */
	const all_maintenance_template_count = this.maintenance_template_inside.length + this.maintenance_template_outer.length;
	if (all_maintenance_template_count >= configuration.template_count_to_be_reported) {
		if (!configuration.count_list[all_maintenance_template_count])
			configuration.count_list[all_maintenance_template_count] = [];
		// 統計含有過多個維護模板的條目
		configuration.count_list[all_maintenance_template_count].push(page_data.title);
	}

	//console.trace([all_maintenance_template_count, configuration.template_count_to_be_split]);
	let need_merge;
	if (all_maintenance_template_count <= configuration.template_count_to_be_split) {
		// need split
		const Multiple_issues_template_token = this.Multiple_issues_template_token;
		if (!Multiple_issues_template_token) {
			return Wikiapi.skip_edit;
		}
		const parameters = Object.keys(Multiple_issues_template_token.parameters);
		if (parameters.length > 0 && !/^1?$/.test(parameters)) {
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
			CeL.warn(`${CeL.wiki.title_link_of(page_data)}: There are additional parameters, so we cannot remove {{${configuration.Multiple_issues_template_name_without_namespace}}}: ${parameters.join(' | ')}`);
			configuration.problematic_articles.push(page_data.title);
			return Wikiapi.skip_edit;
		}

		if (this.maintenance_template_inside.length === 0 && Multiple_issues_template_token.parameters[1] && Multiple_issues_template_token.parameters[1].toString().trim()) {
			CeL.warn(`${CeL.wiki.title_link_of(page_data)}: The parameter "1" is strange, so we cannot remove {{${configuration.Multiple_issues_template_name_without_namespace}}}: ${Multiple_issues_template_token.parameters[1].toString()}`);
			configuration.problematic_articles.push(page_data.title);
			return Wikiapi.skip_edit;
		}

		need_merge = false;

	} else if (all_maintenance_template_count >= configuration.template_count_to_be_merged) {
		// 含有((template_count_to_be_merged))個以上維護模板的條目
		// e.g., 含有三個和三個以上維護模板的條目
		// need merge
		if (this.maintenance_template_outer.length === 0) {
			return Wikiapi.skip_edit;
		}
		// assert: this.maintenance_template_outer.length > 0
		need_merge = true;

	} else if (this.maintenance_template_inside.length > 0 && this.maintenance_template_outer.length > 0) {
		need_merge = true;
	} else {
		// others: 可以忽略不處理的條目
		// 含有((>template_count_to_be_split))–((<template_count_to_be_merged))個維護模板的條目_list
		// e.g., 含有2個維護模板的條目。不動這些條目。
		return Wikiapi.skip_edit;
	}

	// ----------------------------------------------------

	CeL.warn(`${CeL.wiki.title_link_of(page_data)}: Need ${need_merge ? 'merge' : 'split'}. ${this.maintenance_template_inside.length}+${this.maintenance_template_outer.length} maintenance templates: ${this.maintenance_template_inside.map(t => t.name).join(' | ')} + ${this.maintenance_template_outer.map(t => t.name).join(' | ')}`);
	//console.trace([need_merge, this.maintenance_template_outer, this.maintenance_template_inside]);
	//console.trace(wiki.latest_task_configuration);

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
			this.summary += `: ${gettext(
				// gettext_config:{"id":"merge-$1-templates-into-template-$2"}
				'Merge %1 {{PLURAL:%1|template|templates}} into {{%2}}', this.maintenance_template_outer.length, Multiple_issues_template_token.name)}: ${this.maintenance_template_outer.map(t => t.name).join(', ')}`;
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
			this.summary += `: ${gettext(
				// gettext_config:{"id":"create-template-$2-with-$1-maintenance-templates"}
				'Create {{%2}} with %1 maintenance {{PLURAL:%1|template|templates}}', this.maintenance_template_outer.length, configuration.Multiple_issues_template_name_without_namespace)}: ${this.maintenance_template_outer.map(t => t.name).join(', ')}`;
			const token = this.maintenance_template_outer[0];
			token.parent[token.index] = `{{${configuration.Multiple_issues_template_name_without_namespace}|\n${this.maintenance_template_outer.join('\n')}\n}}\n`;
			CeL.wiki.parser.remove_heading_spaces(token.parent, token.index + 1);
		}
	} else {
		// need split
		// 處理須拆分的條目:
		// 維護模板_count<=template_count_to_be_split&&含有{{多個問題}}模板
		// 含有{{多個問題}}模板，卻不在可以忽略不處理的條目list或須合併維護模板的條目list中。

		// assert true === !!this.Multiple_issues_template_token
		const token = this.Multiple_issues_template_token;
		this.summary += `: ${gettext(
			// gettext_config:{"id":"remove-template-$2-for-only-$1-maintenance-templates"}
			'Remove {{%2}} for only %1 maintenance {{PLURAL:%1|template|templates}}', all_maintenance_template_count, token.name)}: ${this.maintenance_template_inside.map(t => t.name).join(', ')}`;
		token.parent[token.index] = token.parameters[1] && token.parameters[1].toString().trim();
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

	if (is_Multiple_issues_template(token.name)) {
		token.index = index;
		token.parent = parent;
		this.Multiple_issues_template_token = token;
		// console.log(token.parameters[1]);
		this.for_each_token.call(token.parameters[1], 'template', token => {
			//console.trace(token);
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
		// gettext_config:{"id":"total-$1-articles"}
		content.push([count, gettext('Total %1 {{PLURAL:%1|article|articles}}.', list.length)
			// \n\n
			+ '\n[['
			// 避免顯示過多。
			+ (list.length <= 1e4 ? list : list.slice(0, 1e4))
				//
				.join(']], [[') + ']]']);
	});
	content.reverse();
	content.unshift([
		// gettext_config:{"id":"number-of-templates"}
		gettext('number-of-templates'),
		// gettext_config:{"id":"articles-containing-maintenance-templates"}
		gettext('Articles containing maintenance templates')]);

	content._heading = new gettext.Sentence_combination();
	content._heading.push(
		// __NOTITLECONVERT__
		'__NOCONTENTCONVERT__\n',
		// gettext_config:{"id":"the-articles-containing-too-many-maintenance-templates-are-listed-below"}
		gettext('The articles containing too many maintenance templates are listed below:'),
		// gettext_config:{"id":"total-$1-articles"}
		gettext('Total %1 {{PLURAL:%1|article|articles}}.', all_count), '\n',
		'* ',
		// gettext_config:{"id":"the-report-will-be-updated-weekly-by-the-robot"}
		gettext('The report will be updated weekly by the robot.'),
		// gettext_config:{"id":"you-can-change-the-configuration-from-$1"}
		gettext('You can change the configuration from %1.',
			CeL.wiki.title_link_of(configuration.configuration_page_title,
				// gettext_config:{"id":"the-configuration-page"}
				gettext('the configuration page'))), '\n',
		// [[WP:DBR]]: 使用<onlyinclude>包裹更新時間戳。
		'* ',
		// gettext_config:{"id":"generate-date-$1"}
		gettext('Generate date: %1', '<onlyinclude>~~~~~</onlyinclude>'), '\n\n',
		'{{see|' + log_to + '}}\n\n<!-- report begin -->\n'
	);
	content = content._heading + CeL.wiki.array_to_table(content, { 'class': "wikitable" });
	if (configuration.problematic_articles.length > 0) {
		content += `\n\n== ${gettext(
			// gettext_config:{"id":"problematic-articles"}
			'Problematic articles')} ==\n[[` + configuration.problematic_articles.join(']], [[') + ']]';
	}
	content += '\n<!-- report end -->\n' + configuration[
		// gettext_config:{"id":"categories-added-to-report"}
		gettext('Categories added to the report')];

	// [[Wikipedia:頁面存廢討論/討論頁模板維護報告]]
	await wiki.edit_page(configuration.report_page, content, {
		bot: 1,
		nocreate: 1,
		redirects: 1,
		// gettext_config:{"id":"normalize-template-$1"}
		summary: `${gettext('Normalize {{%1}}', configuration.Multiple_issues_template_name_without_namespace)}: ${gettext(
			// gettext_config:{"id":"too-many-entries-with-maintenance-templates-in-the-record-$1-entries"}
			'Too many entries with maintenance templates in the record: %1 {{PLURAL:%1|entrie|entries}}', all_count)} (${gettext(
				// gettext_config:{"id":"minimum-number-of-templates-to-report-$1"}
				'Minimum number of templates to report: %1', configuration.template_count_to_be_reported)})`
	});
}
