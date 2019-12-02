/*

2019/12/2 20:2:11	初版試營運

@see [[w:zh:Wikipedia:互助客栈/其他/存档/2019年11月#有关于公共字词转换组的若干讨论]]

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loader.js');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;
// globalThis.use_language = 'zh';
use_language = 'zh';

const main_category = 'Category:公共轉換組模板';
const report_base = 'Wikipedia:字詞轉換處理/公共轉換組/';
const convention_list_page = report_base + '各頁面包含字詞';
const duplicated_report_page = report_base + '重複字詞報告';
const convention_table_file = 'convention_table.' + use_language + '.json';

// ----------------------------------------------------------------------------

const KEY_page = Symbol('page');

// convention_table[string] = {'zh-tw':'string', ...}
const convention_table = Object.create(null);

// convention_of_page[page_title] = [ string, string, ... ];
const convention_of_page = Object.create(null);

// duplicated_items[string] = [ pages ]
const duplicated_items = Object.create(null);

function add_duplicated(string, from_convention, to_convention) {
	if (CeL.is_debug()) {
		CeL.warn('add_duplicated: Overwrite ' + JSON.stringify(string));
		console.log(from_convention);
		CeL.info(string + ' →');
		console.log(to_convention);
	} else if (false) {
		CeL.warn('add_duplicated: ' + JSON.stringify(string)
			+ ': ' + from_convention[KEY_page].title
			+ ' → ' + to_convention[KEY_page].title);
	}

	if (duplicated_items[string]) {
		duplicated_items[string].push(
			CeL.wiki.title_link_of(to_convention[KEY_page])
		);
	} else {
		duplicated_items[string] = [
			CeL.wiki.title_link_of(from_convention[KEY_page]),
			CeL.wiki.title_link_of(to_convention[KEY_page])
		];
	}
}

function add_convention(item, from_page) {
	// console.log(item);
	if (!item || item.type !== 'item')
		return;

	// + ' ': 當作 page，取得 .conversion_table。
	const parsed = CeL.wiki.parse('-{H|' + item.rule + '}-' + ' ');
	let table = parsed.conversion_table;
	if (!table) {
		if (typeof parsed[0].converted === 'string') {
			// e.g., -{H|都市圈}-
			table = Object.create(null);
			table[parsed[0].converted] = {
				converted: parsed[0].converted
			};
		} else {
			/**
			 * e.g.,<code>

			parsed = CeL.wiki.parse("-{H|zh-cn:<sup>-9</sup>米; zh-hk:<sup>-9</sup>米; zh-sg:<sup>-9</sup>米; zh-mo:<sup>-9</sup>米; zh-tw:<sup>-9</sup>公尺;}- ");

			</code>
			 */
			CeL.warn('add_convention: Can not parse:');
			console.log(item);
			return;
		}
	}
	// console.log(table);

	for (let [string, conv] of Object.entries(table)) {
		if (!convention_of_page[from_page.title])
			convention_of_page[from_page.title] = [];
		convention_of_page[from_page.title].push(string);

		if (conv.conversion)
			conv = conv.conversion;
		// console.log([string, conv]);
		conv[KEY_page] = from_page;
		if ((string in convention_table)
			&& convention_table[string][KEY_page] !== from_page) {
			add_duplicated(string, convention_table[string], conv);
		}
		convention_table[string] = conv;
	}
}

const NS_module = CeL.wiki.namespace('module'),
	NS_template = CeL.wiki.namespace('template');

async function for_each_page(page_data, index, conversion_group_list) {
	if (page_data.ns !== NS_module
		&& page_data.ns !== NS_template
		// || !page_data.title.includes('')
	) {
		return;
	}

	function show_info(count) {
		CeL.info((index + 1) + '/' + conversion_group_list.length
			+ ': ' + CeL.wiki.title_link_of(page_data) + ': ' + count + ' items.');
	}

	page_data = await wiki.page(page_data);
	// CeL.info(CeL.wiki.title_link_of(page_data));
	// console.log(page_data);
	if (page_data.ns === NS_module) {
		const object = CeL.wiki.parse.lua_object(page_data);
		const content = object && object.content;
		if (!Array.isArray(content)) {
			CeL.error('Invalid group: ' + CeL.wiki.title_link_of(page_data));
			return;
		}
		show_info(content.length);
		// console.log(content);
		content.forEach(item => add_convention(item, page_data));
		return;
	}

	// assert: page_data.ns === NS_template
	const parsed = CeL.wiki.parser(page_data);
	let count = 0;
	parsed.each('template', function (token) {
		const item = {
			type: 'item'
		};
		switch (token.name) {
			case 'CItemHidden':
			case 'CI':
			case 'CItem':
			case 'CNoteA':
				if (token.parameters.display)
					return;
				item.rule = token.parameters[1];
				if (token.parameters.original)
					item.original = token.parameters.original;
				break;

			case 'CItemLan':
				item.rule = token.parameters[1];
				if (token.parameters[2])
					item.original = token.parameters[2];
				break;
		}

		if (!item.rule)
			return;

		if (Array.isArray(item.rule)) {
			item.rule.forEach(function (token, index) {
				/**
				 * e.g.,<code>

				parsed = CeL.wiki.parse("{{CItem|宿命之子誕生{{=}}>zh-cn:新生|desc=|original=The Hatchling}}");

				</code>
				 */
				if (token.type === 'transclusion' && token.name === '=')
					item.rule[index] = '=';
			});
		}

		count++;
		add_convention(item, page_data);
	});
	show_info(count);
}

// ----------------------------------------------------------------------------

async function check_pages() {
	const conversion_group = Object.create(null);
	const category_tree = await wiki.category_tree(main_category, {
		namespace: [NS_module, NS_template],
	});
	// console.log(page_list.subcategories);

	const deprecated_pages = Object.create(null);
	function add_page(page_list, deprecated) {
		page_list.forEach(function (page_data) {
			const matched = page_data.title.match(/^([^:]+):(.+)$/);
			if (!matched) {
				console.log(page_data);
				return;
			}

			if (deprecated) {
				deprecated_pages[matched[2]] = page_data;
				// Will be deleted later.
				if (false && conversion_group[matched[2]]
					&& conversion_group[matched[2]].title === page_data.title) {
					delete conversion_group[matched[2]];
				}
				return;
			}

			if (!conversion_group[matched[2]]
				// module 的優先度高於 template。
				|| page_data.ns === NS_module) {
				conversion_group[matched[2]] = page_data;
			}
		});
		if (page_list.subcategories) {
			for (let [subcategory, sub_list] of Object.entries(page_list.subcategories)) {
				//CeL.info('Add Category:' + subcategory + '...');
				//console.log(sub_list);
				add_page(sub_list, subcategory.includes('已停用') || deprecated);
			}
		}
	}
	add_page(category_tree);

	for (let [name, page_data] of Object.entries(deprecated_pages)) {
		if (conversion_group[name] && conversion_group[name].title === page_data.title)
			delete conversion_group[name];
	}
	//console.log(deprecated_pages);
	// free
	//deprecated_pages = null;

	const conversion_group_list = Object.values(conversion_group);
	CeL.info('Traversal ' + conversion_group_list.length + ' pages...');
	//console.log(conversion_group);
	await Promise.all(conversion_group_list.map(for_each_page));
}

function ascending(a, b) {
	a = a[0];
	b = b[0];
	return a < b ? -1 : a > b ? 1 : 0;
}

async function write_convention_list() {
	CeL.info('Writing report to ' + CeL.wiki.title_link_of(convention_list_page) + '...');
	const report_array = [];
	for (let [page_title, convention_list] of Object.entries(convention_of_page)) {
		convention_list = convention_list.sort().unique();
		report_array.push([CeL.wiki.title_link_of(page_title) + ' (' + convention_list.length + ')',
		'data-sort-value="' + convention_list.length + '"|' + convention_list.join('; ')]);
	}
	const count = report_array.length;
	report_array.sort(ascending);
	report_array.unshift('公共轉換組頁面|定義的詞彙'.split('|'));
	await wiki.edit_page(convention_list_page,
		// __NOTITLECONVERT__
		'__NOCONTENTCONVERT__\n'
		+ '總共' + count + '個公共轉換組頁面。 --~~~~\n\n'
		+ CeL.wiki.array_to_table(report_array, {
			'class': "wikitable sortable"
		}), {
		nocreate: 1,
		summary: count + '個公共轉換組頁面'
	});
	return count;
}

async function write_duplicated_report() {
	CeL.info('Writing report to ' + CeL.wiki.title_link_of(duplicated_report_page) + '...');
	const report_array = [];
	for (let [string, page_list] of Object.entries(duplicated_items)) {
		page_list = page_list.sort().unique();
		report_array.push([string, 'data-sort-value="' + page_list.length + '"|' + page_list.length + ': ' + page_list.join(', ')]);
	}
	const count = report_array.length;
	report_array.sort(ascending);
	report_array.unshift('重複出現的詞彙|定義於公共轉換組頁面'.split('|'));
	await wiki.edit_page(duplicated_report_page,
		// __NOTITLECONVERT__
		'__NOCONTENTCONVERT__\n'
		+ '出現在多個不同的公共轉換組中的詞彙：' + count + '個詞彙。 --~~~~\n\n'
		+ CeL.wiki.array_to_table(report_array, {
			'class': "wikitable sortable"
		}), {
		nocreate: 1,
		summary: count + '個重複詞彙'
	});
	return count;
}

async function main_process() {
	await check_pages();

	const pages = await write_convention_list();

	const items = await write_duplicated_report();

	CeL.write_file(convention_table_file, convention_table);
	CeL.info((new Date).format() + '	' + pages + ' pages, ' + items + ' items done.');
}

(async () => {
	await wiki.login(user_name, user_password, use_language);
	// await wiki.login(null, null, use_language);
	await main_process();
})();
