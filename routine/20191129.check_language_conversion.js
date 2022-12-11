/*
調整頁面的字詞轉換規則

node routine/20191129.check_language_conversion.js use_project=zhmoegirl

2019/12/2 20:2:11	初版試營運
2022/12/10 19:37:4	+ function check_system_conversions(), 更正繁簡轉換錯誤之公共轉換組名

@see [[w:zh:Wikipedia:互助客栈/其他/存档/2019年11月#有关于公共字词转换组的若干讨论]]

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

CeL.run('application.net.wiki.template_functions',
	// for CeL.assert()
	'application.debug.log');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('zh');
/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// for debug
const debug_page =
	// 'Wikipedia:沙盒' '三芝區' '衣阿华级战列舰'
	undefined;

const conversion_table_file = `conversion_table.${use_language}.json`;

// ----------------------------------------------------------------------------

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

	let main_category_list = general.main_category;
	if (!Array.isArray(main_category_list))
		main_category_list = [main_category_list];
	general.main_category_list = wiki.remove_namespace(main_category_list);

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

async function main_process() {

	await check_system_conversions();
	// [[Help:高级字词转换语法#基本语法]]
	await check_project_conversion_pages();
	await check_CGroup_pages();

	const pages = await write_conversion_list();

	const items = await write_duplicated_report();

	CeL.write_file(conversion_table_file, conversion_table);
	CeL.info(pages + '個公共轉換組，' + items + '個重複詞彙。');

	// ---------------------------------------------
	// 只會消除正規化後完全相同的轉換規則。

	for (const group_name in conversion_of_group) {
		const transclusions = conversion_of_group[group_name][KEY_transclusions];
		// TODO: 後出現者為準。
		if (Array.isArray(transclusions)) {
			transclusions.forEach(
				source_group_name => Object.entries(conversion_of_group[source_group_name]).forEach(
					([vocabulary, conv]) => conversion_of_group[group_name][vocabulary] = conv
				)
			);
		}
	}

	//console.log(JSON.stringify(conversion_of_group.Movie));
	// Array.isArray(conversion_of_group[group_name])
	// → conversion_of_group[group_name] = [ normalized rule, normalized rule, ... ]
	for (const [group_name, conversion_list] of Object.entries(conversion_of_group)) {
		const redirect_to = conversion_list[KEY_redirect_to];
		if (redirect_to) {
			(conversion_of_group[group_name] = []).redirect_to = redirect_to;
			continue;
		}

		//console.trace(conversion_list);
		conversion_of_group[group_name] = Object.values(conversion_list).map(
			item => (
				item[KEY_rule]
					// 正規化單向轉換規則。
					? item[KEY_rule].toString()
						.split(';')
						.map(conversion => conversion.trim())
					// 正規化雙向轉換規則。
					: Object.entries(item)
						.map(([language_code, words]) => language_code + ':' + words)
			)
				.filter(conversion => !!conversion)
				.sort().join(';')
		).unique();
		Object.assign(conversion_of_group[group_name], {
			group_name,
			page_title: conversion_list[KEY_page],
		});
	}

	for (const group_name in conversion_of_group) {
		let redirect_to = conversion_of_group[group_name].redirect_to;
		if (redirect_to) {
			const redirect_to_data = conversion_of_group[get_group_name_of_page(redirect_to)];
			if (redirect_to_data)
				conversion_of_group[group_name] = redirect_to_data;
			else
				CeL.error(`無重定向標的之資料: ${group_name} → ${redirect_to}`);
		}
	}
	//console.trace(Object.keys(conversion_of_group).join());
	//console.log(conversion_of_group.Movie);

	await generate_conversion_alias();

	await wiki.register_redirects('NoteTA', {
		namespace: 'Template'
	});

	await wiki.for_each_page(
		debug_page ? Array.isArray(debug_page) ? debug_page : [debug_page]
			: await wiki.embeddedin('Template:NoteTA', {
				namespace: 0,
				limit: debug_page >= 1 ? debug_page : 'max',
			}),
		for_NoteTA_article, {
		no_message: true,
		// 去除與公共轉換組/全文轉換重複的轉換規則
		summary: CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title, '去除重複的轉換規則') + ':',
		pages_finished: 0,
	});

	routine_task_done('1 week');
}

// ----------------------------------------------------------------------------

const system_conversion_table = Object.create(null);
const system_conversion_Map = new Map();
// 處理內置轉換列表
async function check_system_conversions() {
	let system_conversion_text = await fetch(`https://raw.githubusercontent.com/wikimedia/mediawiki/master/includes/languages/data/ZhConversion.php`);
	system_conversion_text = await system_conversion_text.text();
	//console.trace(system_conversion_text.slice(0, 800));

	const PATTERN_system_conversion_table_array = /(\w+)\s*=\s*(\[[^\[\]]+\])/g;
	let matched, max_key_length = 0;
	while (matched = PATTERN_system_conversion_table_array.exec(system_conversion_text)) {
		const conversions = CeL.wiki.parse.lua_object(matched[2], { force_parse: true });
		system_conversion_table[matched[1]] = new Map(Object.entries(/*conversions*/ {}));
		for (const [key, value] of Object.entries(conversions)) {
			if (!system_conversion_Map.has(key)) {
				if (max_key_length < key.length) {
					max_key_length = key.length;
				}
				system_conversion_Map.set(key, value);
			}
		}
	}
	system_conversion_Map.max_key_length = max_key_length;

	CeL.info(`${check_system_conversions.name}: All ${system_conversion_Map.size} entries in ${Object.keys(system_conversion_table).length} tables: ${Object.keys(system_conversion_table).join(', ')}`);
	//console.trace(system_conversion_table);
}

// ----------------------------------------------------------------------------

// 處理全局轉換表
async function check_project_conversion_pages() {
	// get all subpage links of the form
	// [[MediaWiki:Conversiontable/zh-xx/...|...]]
	const conversion_group_list = await wiki.prefixsearch('Mediawiki:Conversiontable/');
	CeL.info('Traversal ' + conversion_group_list.length + ' project conversion pages...');
	// console.log(conversion_group);
	await wiki.for_each_page(conversion_group_list, for_each_conversion_group_page, { index: 0, conversion_group_list });
}

const project_conversion_prefix = 'project conversion|';
function get_group_name_of_page(page_data) {
	const page_title = CeL.wiki.title_of(page_data);
	//console.trace([page_title, page_data]);
	const group_name = page_title.match(/^(?:[^:]+):(?:[^\/]+\/)?(.+)$/);
	if (group_name) {
		if (page_data.ns === NS_MediaWiki)
			return project_conversion_prefix + group_name[1];
		return group_name[1];
	}
	throw new Error(`${get_group_name_of_page.name}: Cannot extract group name from page ${CeL.wiki.title_link_of(page_data)}`);
}

// 處理公共轉換組
async function check_CGroup_pages() {
	const conversion_group = Object.create(null);
	const deprecated_pages = Object.create(null);
	function add_page_list(page_list, deprecated) {
		for (const page_data of page_list) {
			// async function add_page(page_data)
			const group_name = get_group_name_of_page(page_data);
			if (!group_name) {
				console.error(page_data);
				return;
			}

			if (deprecated) {
				deprecated_pages[group_name] = page_data;
				// Will be deleted later.
				if (false && conversion_group[group_name]
					&& conversion_group[group_name].title === page_data.title) {
					delete conversion_group[group_name];
				}
				return;
			}

			if (!conversion_group[group_name]
				// module 的優先度高於 template。
				|| page_data.ns === NS_Module) {
				conversion_group[group_name] = page_data;
			}
		}

		// console.log(page_list.subcategories);
		if (page_list.subcategories) {
			for (const [subcategory, sub_list] of Object.entries(page_list.subcategories)) {
				// CeL.info('Add Category:' + subcategory + '...');
				// console.log(sub_list);
				// e.g., [[:Category:已停用的CGroup模板]]
				add_page_list(sub_list, subcategory.includes('已停用') || deprecated);
			}
		}
	}

	for (const main_category_name of wiki.latest_task_configuration.general.main_category_list) {
		const category_tree = await wiki.category_tree(main_category_name, {
			namespace: [NS_Module, NS_Template],
			redirects: 1,
		});
		//console.trace(category_tree);
		if (category_tree.length > 0)
			add_page_list(category_tree);
		else
			CeL.error(`${check_CGroup_pages.name}: 運作機制改變或轉換組分類改名？無法取得 ${CeL.wiki.title_link_of(main_category_name)} 的成員！`);
	}
	//console.trace(Object.keys(conversion_group).join());

	if (false) {
		// 可能有漏: prefixsearch 無法取得 [[Template:CGroup/Free License]]
		// 處理別名 e.g., [[Template:CGroup/諾貝爾獎]]
		add_page_list((await wiki.prefixsearch('Template:CGroup/'))
			.filter(page_data => /^Template:CGroup\/[^\/]+$/.test(page_data.title)));
	}

	//console.trace(Object.keys(conversion_group).join());

	for (const [group_name, page_data] of Object.entries(deprecated_pages)) {
		if (conversion_group[group_name] && conversion_group[group_name].title === page_data.title)
			delete conversion_group[group_name];
	}
	//console.trace(deprecated_pages);
	// free
	//deprecated_pages = null;

	const redirects_from_list = await wiki.redirects(Object.values(conversion_group));
	//console.trace(redirects_from_list);
	redirects_from_list.forEach(page_list => add_page_list(page_list));

	//console.trace(conversion_group);
	const conversion_group_list = Object.values(conversion_group)
		.filter(page_data => page_data.ns === NS_MediaWiki
			|| page_data.ns === NS_Module
			|| page_data.ns === NS_Template);

	CeL.info(`${check_CGroup_pages.name}: Traversal ${conversion_group_list.length} CGroup pages...`);
	//console.trace(conversion_group_list);
	await wiki.for_each_page(conversion_group_list, for_each_conversion_group_page, { index: 0, conversion_group_list });
}

// ----------------------------------------------------------------------------

const KEY_page = Symbol('page');
const KEY_rule = Symbol('rule');

/** conversion_table[vocabulary] = {'zh-tw':'vocabulary', ...} */
const conversion_table = Object.create(null);

/** conversion_of_page[page_title][vocabulary] = {'zh-tw':'vocabulary', ...}; */
const conversion_of_page = Object.create(null);
// conversion_of_group[group_name][vocabulary] = {'zh-tw':'vocabulary', ...};
// → conversion_of_group[group_name] = [ normalized rule, normalized rule, ... ]
const conversion_of_group = Object.create(null);

/** duplicated_items[vocabulary] = [ pages ] */
const duplicated_items = Object.create(null);

const KEY_duplicate_list = Symbol('duplicate list');

// 後出現者為準。
function add_duplicated(vocabulary, from_conversion, to_conversion) {
	if (CeL.is_debug()) {
		CeL.warn('add_duplicated: Overwrite ' + JSON.stringify(vocabulary));
		console.log(from_conversion);
		CeL.info(vocabulary + ' →');
		console.log(to_conversion);
	} else if (false) {
		CeL.warn('add_duplicated: ' + JSON.stringify(vocabulary)
			+ ': ' + from_conversion[KEY_page]
			+ ' → ' + to_conversion[KEY_page]);
	}

	if (from_conversion[KEY_duplicate_list]) {
		to_conversion[KEY_duplicate_list] = from_conversion[KEY_duplicate_list];
		delete from_conversion[KEY_duplicate_list];
	} else {
		to_conversion[KEY_duplicate_list] = [];
	}
	to_conversion[KEY_duplicate_list].push(from_conversion);

	if (duplicated_items[vocabulary]) {
		duplicated_items[vocabulary].push(
			CeL.wiki.title_link_of(to_conversion[KEY_page])
		);
	} else {
		duplicated_items[vocabulary] = [
			CeL.wiki.title_link_of(from_conversion[KEY_page]),
			CeL.wiki.title_link_of(to_conversion[KEY_page])
		];
	}
	if (!from_conversion[KEY_page])
		console.trace(from_conversion)
	if (!to_conversion[KEY_page])
		console.trace(to_conversion)
}

function add_conversion(item, from_page) {
	// console.log(item);
	// console.log(from_page);
	if (!item || item.type !== 'item')
		return;

	const parsed = CeL.wiki.parse(`-{H|${item.rule}}-`,
		// 當作 page，取得 .conversion_table。
		'with_properties');
	let page_conversion_table = parsed.conversion_table;
	if (!page_conversion_table) {
		const converted = parsed.converted;
		if (typeof converted === 'string') {
			/**
			 * e.g.,<code>

			// { type: 'item', original: 'Anti-gravity', rule: '反重力' }
			parsed = CeL.wiki.parse("-{H|反重力}-", 'with_properties');

			</code>
			 */
			page_conversion_table = { [converted]: { converted } };
		} else {
			/**
			 * e.g.,<code>

			parsed = CeL.wiki.parse("-{H|zh-cn:<sup>-9</sup>米; zh-hk:<sup>-9</sup>米; zh-sg:<sup>-9</sup>米; zh-mo:<sup>-9</sup>米; zh-tw:<sup>-9</sup>公尺;}-", 'with_properties');

			</code>
			 */
			CeL.warn(`${add_conversion.name}: Cannot parse item at ${CeL.wiki.title_link_of(from_page)}:`);
			console.log(item);
			console.log(parsed);
			return;
		}
	}
	// console.log(page_conversion_table);

	for (let [vocabulary, conv] of Object.entries(page_conversion_table)) {
		if (conv.conversion)
			conv = conv.conversion;
		// console.log([vocabulary, conv]);

		// 後出現者為準。
		conversion_of_page[from_page.title][vocabulary] = conv;

		conv[KEY_page] = from_page.title;
		if (parsed.unidirectional) {
			// 指定僅轉換某些特殊詞彙。
			conv[KEY_rule] = item.rule;
		}
		if ((vocabulary in conversion_table)
			&& conversion_table[vocabulary][KEY_page] !== conv[KEY_page]) {
			add_duplicated(vocabulary, conversion_table[vocabulary], conv);
		}
		// 後出現者為準。
		conversion_table[vocabulary] = conv;
	}
}

const NS_MediaWiki = CeL.wiki.namespace('MediaWiki');
const NS_Module = CeL.wiki.namespace('Module');
const NS_Template = CeL.wiki.namespace('Template');

const KEY_transclusions = Symbol('transclusions');
const KEY_redirect_to = Symbol('redirect_to');
async function for_each_conversion_group_page(page_data) {
	// assert: page_data.ns === NS_MediaWiki || page_data.ns === NS_Module ||
	// page_data.ns === NS_Template

	const conversion_list = CeL.wiki.template_functions.parse_conversions(page_data);
	let already_had_conversion_data = conversion_of_page[page_data.title];
	if (!already_had_conversion_data) {
		conversion_of_group[get_group_name_of_page(page_data)]
			= conversion_of_page[page_data.title]
			= Object.create(null);
		conversion_of_page[page_data.title][KEY_page] = page_data.title;
	}

	if (conversion_list.redirect_to) {
		conversion_of_page[page_data.title][KEY_redirect_to] = conversion_list.redirect_to;
	} else if (conversion_list.transclusions) {
		if (conversion_list.categories.some(
			category_token => wiki.latest_task_configuration.general.main_category_list.includes(category_token.name)
		)) {
			conversion_of_page[page_data.title][KEY_transclusions] = conversion_list.transclusions;
		} else {
			CeL.warn(`${for_each_conversion_group_page.name}: Skip ${CeL.wiki.title_link_of(page_data)}`);
			//console.trace([conversion_of_page[page_data.title], conversion_list.categories, wiki.latest_task_configuration.general.main_category_list]);
			if (!already_had_conversion_data) {
				delete conversion_of_group[get_group_name_of_page(page_data)];
				delete conversion_of_page[page_data.title];
			}
		}
	}

	if (conversion_of_page[page_data.title])
		conversion_list.forEach(conversion => add_conversion(conversion.item, page_data));
	CeL.info(`${for_each_conversion_group_page.name}: ${++this.index}/${this.conversion_group_list.length} ${CeL.wiki.title_link_of(page_data)}: ${conversion_list.length}個公共轉換組`);
}

// ----------------------------------------------------------------------------

function ascending(a, b) {
	a = a[0];
	b = b[0];
	return a < b ? -1 : a > b ? 1 : 0;
}

async function write_conversion_list() {
	CeL.info(`Writing report to ${CeL.wiki.title_link_of(wiki.latest_task_configuration.general.conversion_list_page)}...`);
	const report_lines = [];
	for (let [page_title, vocabulary] of Object.entries(conversion_of_page)) {
		const conversion_list = Object.keys(vocabulary).sort()
			// needless: .unique()
			;
		report_lines.push([CeL.wiki.title_link_of(page_title),
		conversion_list.length || !vocabulary[KEY_redirect_to] ? conversion_list.length : '',
		`data-sort-value="${conversion_list.length}"|`
		+ (vocabulary[KEY_redirect_to] ? `Redirect to → ${CeL.wiki.title_link_of(vocabulary[KEY_redirect_to])}${conversion_list.length > 0 ? '\n\n' : ''}`
			: vocabulary[KEY_transclusions] ? `嵌入轉換組 ${vocabulary[KEY_transclusions].join(', ')}`
				: '')
		+ conversion_list.join('; ')
		]);
	}
	const report_count = report_lines.length;
	report_lines.sort(ascending);
	report_lines.unshift('公共轉換組頁面|#|定義的詞彙'.split('|'));
	const report_wikitext = CeL.wiki.array_to_table(report_lines, {
		'class': "wikitable sortable"
	});

	await update_report(wiki.latest_task_configuration.general.conversion_list_page, report_wikitext, `總共${report_count}個公共轉換組頁面。`, report_count + '個公共轉換組頁面');
	return report_count;
}

async function write_duplicated_report() {
	CeL.info(`Writing report to ${CeL.wiki.title_link_of(wiki.latest_task_configuration.general.duplicated_report_page)}...`);
	const report_lines = [];
	for (let [vocabulary, page_list] of Object.entries(duplicated_items)) {
		page_list = page_list.sort().unique();
		report_lines.push([vocabulary, `data-sort-value="${page_list.length}"|${page_list.length}: ` + page_list.join(', ')]);
	}

	const report_count = report_lines.length;
	let report_wikitext;
	if (report_count > 0) {
		report_lines.sort(ascending);
		report_lines.unshift('重複出現的詞彙|定義於公共轉換組頁面'.split('|'));
		report_wikitext = CeL.wiki.array_to_table(report_lines, {
			'class': "wikitable sortable"
		});
	} else {
		report_wikitext = "* '''太好了！無特殊頁面。'''";
	}

	await update_report(wiki.latest_task_configuration.general.duplicated_report_page, report_wikitext, `出現在多個不同的公共轉換組中的詞彙：總共${report_count}個詞彙。`, report_count + '個重複詞彙');
	return report_count;
}

async function update_report(report_page, report_wikitext, introduction, summary) {
	if (debug_page)
		return;

	const update_Variable_Map = new CeL.wiki.Variable_Map();
	update_Variable_Map.set('report', `\n${report_wikitext}\n`);
	update_Variable_Map.set('timestamp', {
		// [[WP:DBR]]: 使用<onlyinclude>包裹更新時間戳。
		wikitext: '<onlyinclude>~~~~~</onlyinclude>',
		// .may_not_update: 可以不更新。 e.g., timestamp
		may_not_update: true
	});
	update_Variable_Map.set('introduction', {
		wikitext: introduction,
		may_not_update: true
	});
	update_Variable_Map.template =
		// __NOTITLECONVERT__
		`__NOCONTENTCONVERT__
${update_Variable_Map.format('introduction')}
* 本頁面會定期更新，毋須手動修正。
* 產生時間：${update_Variable_Map.format('timestamp')}

${update_Variable_Map.format('report')}
`;

	await wiki.edit_page(report_page, update_Variable_Map, {
		bot: 1,
		nocreate: 1,
		summary
	});
}

// ----------------------------------------------------------------------------

/** conversion_alias[alias group name] = "normalized group name" */
const conversion_alias = Object.create(null);

// @see function reduce_section_title(section_title) @ routine/20201008.fix_anchor.js
// 順便正規化大小寫與空格。
function normalize_group_name(group_name) {
	return group_name.replace(/[\s_\-–()（）{}「」#＝]/g, '')
		.replace(/;+$/g, '')
		//.replace(/（/g, '(').replace(/）/g, ')')
		.toLowerCase();
}

async function generate_conversion_alias() {
	const group_name_list = Object.keys(conversion_of_group);

	function register_alias(alias, group_name) {
		if (!(alias in conversion_of_group) && !conversion_alias[alias]) {
			if (typeof group_name === 'number') {
				// treat group_name as index of group_name
				group_name =
					// 可考慮不採用正規化過的名稱，若拆分比較不擔心還要重新檢查。
					//group_name_list[group_name]
					conversion_of_group[group_name_list[group_name]].group_name;
			} else {
				group_name = conversion_of_group[group_name].group_name;
			}
			conversion_alias[alias] = group_name;
			const normalized_alias = normalize_group_name(alias);
			if (alias !== normalized_alias)
				register_alias(normalized_alias, group_name);
		}
	}

	for (const uselang of ['zh-hant', 'zh-hans']) {
		(await wiki.convert_Chinese(group_name_list, { uselang }))
			.forEach((alias, index) => {
				register_alias(alias, index);
			});
	}

	// 有模組會先用模組，但假如採用別名，重定向至舊的 template，仍然會使用舊的 template。
	// e.g., for G1=教育與研究 → [[Template:CGroup/Organization]] @ [[徐家福]]
	const template_title_list = group_name_list
		.map(group_name => /Module:/.test(conversion_of_group[group_name].page_title) && `Template:CGroup/${group_name}`)
		.filter(template_title => !!template_title);
	const redirects_from_list = await wiki.redirects(template_title_list);
	//console.trace(redirects_from_list);
	redirects_from_list.forEach(page_list => {
		//console.trace(page_list);
		for (const page_data of page_list) {
			const alias = get_group_name_of_page(page_data);
			const group_name = get_group_name_of_page(page_list.title);
			//if (!(alias in conversion_of_group) && !conversion_alias[alias]) console.trace([alias, page_list, get_group_name_of_page(page_list.title)]);
			register_alias(alias, group_name);
		}
	});

	//console.trace(conversion_alias);
}

// ----------------------------------------------------------------------------

async function for_NoteTA_article(page_data, messages, work_config) {
	work_config.pages_finished++;
	//console.trace(work_config);

	const parsed = page_data.parse();
	CeL.assert([CeL.wiki.content_of(page_data), parsed.toString()], 'wikitext parser check for ' + CeL.wiki.title_link_of(page_data));

	// conversion_hash[conversion rule] = {Array}token || {String}group || {Array}conversion token;
	const conversion_hash = Object.create(null);
	// page 本身的 -{A|}, -{H|}
	const conversion_list = CeL.wiki.template_functions.parse_conversions(page_data);
	//console.log([page_data.title, conversion_list]);
	//OK: return Wikiapi.skip_edit;

	let changed;
	parsed.each('Template:NoteTA', token => {
		if (false) {
			console.log([page_data.title,
			token.conversion_list.groups,
			token.conversion_list.map(conversion => conversion.toString('rule')),
			conversion_list.map(conversion => conversion.toString('rule')),
			]);
		}
		// 登記{{NoteTA}}中的轉換規則
		// assert: token.type === 'transclusion'
		token.conversion_list.forEach(
			conversion => conversion_hash[conversion.toString('rule')] = token
		);
		//console.trace(token.conversion_list);
		// 清理轉換規則時，只會轉換有確實引用到的規則。例如當明確引用{{NoteTA|G1=Physics}}才會清理[[Module:CGroup/Physics]]中有的規則。也因此不會清理[[Special:前綴索引/Mediawiki:Conversiontable/]]下面的規則。
		token.conversion_list.groups.forEach(
			group_name => {
				if (!(group_name in conversion_of_group)) {
					const normalized_group_name = conversion_alias[group_name] || conversion_alias[normalize_group_name(group_name)];
					if (!normalized_group_name) {
						CeL.warn(`${for_NoteTA_article.name}: 在${CeL.wiki.title_link_of(page_data)}中使用了未登記的公共轉換組: ${JSON.stringify(group_name)}`);
						//console.trace('登記的公共轉換組: ' + Object.keys(conversion_of_group).join());
						return;
					}

					// 已經正規化過了。
					//normalized_group_name = conversion_of_group[normalized_group_name].group_name;
					this.summary += ` 更正繁簡轉換錯誤，或已有模組卻重定向到模板之公共轉換組名: ${group_name}→${normalized_group_name}`;
					const group_data = token.conversion_list.group_data[group_name];
					group_name = normalized_group_name;
					//token[group_data.index][2] = group_name;
					CeL.wiki.parse.replace_parameter(token, {
						[group_data.parameter_name]: group_name,
					}, 'value_only');
					changed = true;
				}

				//CeL.info(`${group_name}: ${conversion_of_group[group_name].length} rule(s)`);
				// assert: {String}group_name, and {Array}conversion_of_group[group_name]
				conversion_of_group[group_name].forEach(
					rule => conversion_hash[rule] = group_name
				);
			}
		);
	});

	conversion_list.forEach(conversion => {
		const rule = conversion.toString('rule');
		if (!(rule in conversion_hash)) {
			// assert: conversion.type === 'convert'
			conversion_hash[rule] = conversion;
			//console.trace(conversion.conversion_list);
		}
	});
	//console.trace(conversion_hash);

	const duplicate_list = {
		與公共轉換組重複的轉換規則: [],
		'與{{NoteTA}}重複的內文轉換': [],
		與內文之全文轉換重複的字詞轉換: []
	};
	parsed.each('Template:NoteTA', token => {
		let _changed;
		for (let index = 0; index < token.conversion_list.length; index++) {
			const conversion = token.conversion_list[index];
			const rule = conversion.toString('rule');
			const source = conversion_hash[rule];
			// assert: (rule in conversion_hash)
			// rule 已於前面的 "登記{{NoteTA}}中的轉換規則" 登記。
			if (typeof source !== 'string') {
				return;
			}

			// CeL.wiki.title_link_of('Module:CGroup/' + source)
			duplicate_list.與公共轉換組重複的轉換規則.push(`存在於轉換組 ${source}: ${rule}`);
			_changed = true;
			token[conversion.index] = '';
		}
		if (!_changed) {
			return;
		}
		changed = true;
		for (let index = token.length; index > 1;) {
			if (!token[--index])
				token.splice(index, 1);
		}
		if (token.length === 1) {
			return parsed.each.remove_token;
		}
	}, true);

	const conversion_rule_list = Object.keys(conversion_hash);
	parsed.each('convert', (token, index, parent) => {
		if (token.flag === 'A') {
			// TODO: move -{A|...}- to {{NoteTA}}
			return;
		}

		const rule = token.toString('rule');
		if (!(rule in conversion_hash)) {
			return;
		}

		let convert_to = undefined;

		// 有合適的才轉換，否則放棄轉換。
		function test_convert_to(_convert_to, index, parent) {
			if (!_convert_to || convert_to) {
				return;
			}

			// 測試與前一段文字合起來時，會不會被轉換。
			const previous_piece = parent[index - 1];
			if (previous_piece && typeof previous_piece === 'string') {
				/** 本次測試的文字 */
				const test_piece = previous_piece.slice(-1) + _convert_to.slice(0, 1);
				if (conversion_rule_list.some(rule => rule.includes(test_piece)))
					return;

				// 測試 _convert_to 會被 system_conversion_Map 系統轉換的情況。
				// e.g., [[三芝區]] `{{NoteTA|里}}子里` 在TW下依然會被轉成 "子裡"。
				// TODO: 這個測試不完全，沒包括 _convert_to 在公共轉換組的情況。
				for (let/** 向後長度 */backward_length = 1; backward_length <= _convert_to.length; ++backward_length) {
					const base_piece = _convert_to.slice(0, backward_length);
					for (let/** 本次測試的文字 */test_piece = base_piece,/** 向前追溯長度 */forward_length = 0;
						forward_length <= previous_piece.length && test_piece.length <= system_conversion_Map.max_key_length;) {
						//console.trace([test_piece, system_conversion_Map.has(test_piece), !conversion_rule_list.includes(test_piece)]);
						if (system_conversion_Map.has(test_piece)
							// `{{NoteTA|子里}}子里` 則不會被轉換。
							&& !conversion_rule_list.includes(test_piece))
							return;
						++forward_length;
						test_piece = previous_piece.slice(-forward_length) + base_piece;
					}
				}
			}

			// 測試與後一段文字合起來時，會不會被轉換。
			const following_piece = parent[index + 1];
			if (following_piece && typeof following_piece === 'string') {
				/** 本次測試的文字 */
				const test_piece = _convert_to.slice(-1) + following_piece.slice(0, 1);
				if (conversion_rule_list.some(rule => rule.includes(test_piece)))
					return;
			}

			convert_to = _convert_to;
			return true;
		}

		// TODO: parent.type === 'link' [[P|-{...}-]]
		if (typeof token.converted === 'string') {
			test_convert_to(token.converted, index, parent);

		} else if (CeL.is_Object(token.converted)) {
			function test_language_code(language_code) {
				return test_convert_to(token.conversion[language_code], index, parent);
			}

			// 先採用繁體以減少產生歧義的機會。
			if (!['zh-tw', 'zh-hant', 'zh-hk'].some(test_language_code)) {
				for (const language_code in token.conversion) {
					if (test_language_code(language_code))
						break;
				}
			}
		}

		if (!convert_to) {
			return;
		}

		const source = conversion_hash[rule];
		if (typeof source === 'string') {
			duplicate_list.與公共轉換組重複的轉換規則.push(`存在於轉換組 ${source}: ${rule}`);
		} else if (source.type === 'convert') {
			duplicate_list.與內文之全文轉換重複的字詞轉換.push(rule);
		} else {
			// assert: source.type === 'transclusion'
			duplicate_list['與{{NoteTA}}重複的內文轉換'].push(rule);
		}
		changed = true;
		return convert_to;
	}, true);

	if (!changed) {
		return Wikiapi.skip_edit;
	}
	//console.trace(parsed.toString());

	for (let [type, list] of Object.entries(duplicate_list)) {
		if (list.length === 0) continue;
		this.summary += ` 去除${type} (${list.length})`;
		list = list.unique();
		if (list.length < 4)
			this.summary += ': ' + list.join(', ');
		//else: list.length > 1
	}

	this.summary += ' ('
		// gettext_config:{"id":"the-bot-operation-is-completed-$1$-in-total"}
		+ CeL.gettext('本次bot作業已進行%1%', (100 * work_config.pages_finished /
			// 整體作業進度 overall progress
			work_config.initial_target_length).to_fixed(1)) + ')';

	return parsed.toString();
}
