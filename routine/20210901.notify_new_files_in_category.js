/*

2021/9/1 13:31:50	初版試營運。
2021/9/1 15:11:14	完成。正式運用。
2021/9/11 16:4:26	從頁面為主的作業轉成以日期為主。

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Load modules.
CeL.run([]);

login_options.API_URL = 'commons';

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// ----------------------------------------------------------------------------

/** {Number}一整天的 time 值。should be 24 * 60 * 60 * 1000 = 86400000. */
const ONE_DAY_LENGTH_VALUE = new Date(0, 0, 2) - new Date(0, 0, 1);

let summary_prefix;

// 讀入手動設定 manual settings。
async function adapt_configuration(latest_task_configuration) {
	//console.log(latest_task_configuration);
	// console.log(wiki);

	// ----------------------------------------------------

	const { general } = latest_task_configuration;
	const default_options = general.default_options;
	//console.log(default_options);

	for (let [page_prefix, options] of Object.entries(wiki.latest_task_configuration.Subscribers)) {
		wiki.latest_task_configuration.Subscribers[page_prefix] = options = { ...default_options, ...options };
		options.base_page_title = options.base_page_title || page_prefix;
		options.dated_page_format = options.dated_page_format || options.base_page_title + options.subpage;
	}
	console.log(Object.values(wiki.latest_task_configuration.Subscribers));

	summary_prefix = CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title, CeL.gettext('Notify new files in category')) + ': ';
}

// ----------------------------------------------------------------------------

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
prepare_directory(base_directory);

(async () => {
	login_options.configuration_adapter = adapt_configuration;
	//console.log(login_options);
	await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
	await main_process();
})();

async function main_process() {
	let start_date = Date.parse(CeL.env.arg_hash?.start_date);
	start_date = start_date ? new Date(start_date) : new Date();
	//回溯兩周。
	start_date.setUTCDate(start_date.getUTCDate() - 7 * 2);
	//必須以UTC時間每日0時起算，否則會分配到錯誤日期。
	start_date.setUTCHours(0, 0, 0, 0);
	start_date = start_date.getTime();

	// default: 只篩選到1週前，留取時間等待添加分類。
	for (let end_date = Math.min(start_date + 7 * ONE_DAY_LENGTH_VALUE, Date.now()), this_end_date; start_date < end_date; start_date = this_end_date) {
		this_end_date = start_date + ONE_DAY_LENGTH_VALUE;
		CeL.info(`${'-'.repeat(60)}\nProcess ${new Date(start_date).format({ format: '%Y-%2m-%2d', zone: 0 })}`);
		const file_created_list = await wiki.categories(await wiki.allimages([new Date(start_date).toISOString(), new Date(this_end_date).toISOString()]), { clprop: 'sortkey' });
		Object.freeze(file_created_list);
		for (const options of Object.values(wiki.latest_task_configuration.Subscribers)) {
			if (!(options.end_date <= Date.now())) {
				// default: 只篩選到1週前，留取時間等待添加分類。
				options.end_date = Date.now() - CeL.to_millisecond('1w');
			}
			Object.assign(options, { start_date, end_date, file_created_list });
			await process_page(options);
		}
	}

	routine_task_done('1 day');
}

// ----------------------------------------------------------------------------

async function process_page(options) {
	const base_category_name = options.base_category;
	const all_sub_categories_Set = new Set(await get_all_sub_categories(base_category_name, options));
	CeL.info(`${base_category_name}: ${all_sub_categories_Set.size} sub-categories.`);

	for (let start_date = new Date(options.start_date), end_date; ; start_date = end_date) {
		end_date = start_date.getTime() + ONE_DAY_LENGTH_VALUE;
		if (!(end_date <= options.end_date))
			break;
		end_date = new Date(end_date);

		const page_data = await wiki.page(start_date.format({ format: options.dated_page_format, zone: 0 }));
		const parsed = CeL.wiki.parser(page_data);
		let had_got;
		parsed.each_section(section => {
			if (section.section_title?.title.includes(start_date.format({ format: options.section_title, zone: 0 }))) {
				had_got = section.section_title.title;
				return parsed.each.exit;
			}
		});
		if (had_got) {
			CeL.info('Had got ' + had_got);
			continue;
		}
		await process_date(start_date, end_date, options, all_sub_categories_Set);
	}
}

async function get_all_sub_categories(category_name, options) {
	const cache_file_path = `${base_directory}${category_name}.all_sub_categories.json`;
	let all_sub_categories_data = CeL.read_file(cache_file_path);
	const exclude_categories = options.exclude_categories;
	if (all_sub_categories_data && (all_sub_categories_data = JSON.parse(all_sub_categories_data))
		//必須有相同的篩選條件。
		&& all_sub_categories_data.PATTERN_exclude_categories === options.PATTERN_exclude_categories
		&& all_sub_categories_data.exclude_categories === JSON.stringify(exclude_categories)
		// 有效期限1個月。
		&& Date.now() - Date.parse(all_sub_categories_data.date) < CeL.to_millisecond('1 month')
		// 2021/8/29 14:17:18	Echinodermata: 4509 sub-categories.
		&& Array.isArray(all_sub_categories_data.list) && all_sub_categories_data.list.length > 1e3
	) {
		return all_sub_categories_data.list;
	}

	const PATTERN_exclude_categories = options.PATTERN_exclude_categories && options.PATTERN_exclude_categories.to_RegExp();
	const category_tree = await wiki.category_tree(category_name, {
		depth: 10,
		cmtype: 'subcat',
		get_flated_subcategories: true,
		category_filter: category_data => (!PATTERN_exclude_categories || !PATTERN_exclude_categories.test(category_data.title))
			&& (!exclude_categories || !exclude_categories.includes(category_data.title))
	});
	all_sub_categories_data = {
		date: new Date,
		PATTERN_exclude_categories: options.PATTERN_exclude_categories,
		exclude_categories,
		list: [category_name].append(Object.keys(category_tree.flated_subcategories)),
		tree: category_tree.get_category_tree(),
	};
	CeL.write_file(cache_file_path, all_sub_categories_data);
	return all_sub_categories_data.list;
}

async function process_date(start_date, end_date, options, all_sub_categories_Set) {
	CeL.info(`${process_date.name}: ${start_date.format({ format: '%Y-%2m-%2d', zone: 0 })}–${end_date.format({ format: '%Y-%2m-%2d', zone: 0 })}`);
	// TODO: use for_each_category()
	const file_created_list = options.file_created_list || await wiki.categories(await wiki.allimages([start_date.toISOString(), end_date.toISOString()]), { clprop: 'sortkey' });
	//console.log(file_created_list);

	const filtered_files = Object.create(null);
	file_created_list.forEach(
		file_categories_data => file_categories_data.some(
			category_data => all_sub_categories_Set.has(category_data.title.replace(/^Category:/, ''))
				&& (filtered_files[file_categories_data.title] = category_data.title)
		)
	);

	// ------------------------------------------

	const contents_to_write = [`<gallery ${options.gallery_attributes?.trim() || ''}>`];
	let count = 0;
	for (const [file_title, category] of Object.entries(filtered_files)) {
		count++;
		contents_to_write.push(`${file_title}|${CeL.wiki.title_link_of(file_title)}<br />(${CeL.wiki.title_link_of(category)})`);
	}
	if (count === 0) {
		// No file in this range.
		return;
	}
	contents_to_write.unshift(`* ${count} / all ${all_sub_categories_Set.size} new files in this day`);
	contents_to_write.push('</gallery>');

	//console.log([end_date, filtered_files]);
	await wiki.edit_page(start_date.format({ format: options.dated_page_format, zone: 0 }), page_data => {
		return contents_to_write.join('\n');
	}, {
		section: 'new',
		sectiontitle: start_date.format({ format: options.section_title, zone: 0 }),
		summary: `${summary_prefix}Updating gallery for files in [[Category:${options.base_category}]] (${start_date.format({ format: '%Y-%2m-%2d', zone: 0 })})`,
	});

	if (!options.subpage) {
		// no subpage
		return;
	}

	// ------------------------------------------

	const dated_page_sub_title = start_date.format(options.subpage);
	if (options.list_links?.includes(dated_page_sub_title))
		return;

	await wiki.edit_page(options.base_page_title, page_data => {
		const parsed = CeL.wiki.parser(page_data);
		let had_link;
		parsed.each('link', token => {
			if (token[0].toString().includes(dated_page_sub_title))
				had_link = true;
		});
		if (!options.list_links)
			options.list_links = [];
		options.list_links.push(dated_page_sub_title);
		if (had_link)
			return Wikiapi.skip_edit;
		return parsed.toString() + `\n* ${CeL.wiki.title_link_of(dated_page_sub_title)}`;
	}, {
		summary: `${summary_prefix}Updating gallery list (${start_date.format({ format: '%Y-%2m', zone: 0 })}, ${CeL.wiki.title_link_of(dated_page_sub_title)})`,
	});
}
