/*

2021/9/1 13:31:50	初版試營運。
2021/9/1 15:11:14	完成。正式運用。
2021/9/11 16:4:26	從頁面為主的作業轉成以日期為主。
2021/9/15 18:58:49	完成 [[commons:User:OgreBot/gallery]] 的所有功能。

TODO:

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
		wiki.latest_task_configuration.Subscribers[page_prefix] = options = Object.assign(Object.create(default_options), options);
		options.base_page_title = options.base_page_title || page_prefix;
		if (!options.dated_subpage_format) {
			if (options.gallery_per_month >= 2 && Array.isArray(options.subpage_with_date)) {
				options.dated_subpage_format = options.subpage_with_date;
			} else {
				options.dated_subpage_format = options.subpage;
			}
		}
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
	for (let end_date = Math.min(start_date + CeL.to_millisecond('1w'), Date.now()), this_end_date; start_date < end_date; start_date = this_end_date) {
		this_end_date = start_date + CeL.to_millisecond('1d');
		CeL.info(`${'-'.repeat(60)}\nProcess ${new Date(start_date).format({ format: '%Y-%2m-%2d', zone: 0 })} (${CeL.indicate_date_time(start_date)})`);
		const file_created_list = await get_file_created_list(new Date(start_date), new Date(this_end_date));
		Object.freeze(file_created_list);
		for (const options of Object.values(wiki.latest_task_configuration.Subscribers)) {
			Object.assign(options, { start_date, end_date: this_end_date, file_created_list });
			await process_page(options);
			// for debug: only the first subscriber
			//break;
		}
	}

	routine_task_done('1 day');
}

// ----------------------------------------------------------------------------

async function process_page(options) {
	const base_category_list = Array.isArray(options.base_category) ? options.base_category : [options.base_category];
	const all_sub_categories_Set = new Set(await get_all_sub_categories(base_category_list[0], options));
	//console.trace(all_sub_categories_Set.size);
	for (let index = 1; index < base_category_list.length; index++) {
		const base_category_name = base_category_list[index];
		const all_sub_categories = await get_all_sub_categories(base_category_name, options);
		all_sub_categories.forEach(category => all_sub_categories_Set.add(category));
	}
	//console.trace(all_sub_categories_Set.size);

	// for debug
	return;

	for (let start_date = new Date(options.start_date), end_date; ; start_date = end_date) {
		end_date = start_date.getTime() + CeL.to_millisecond('1d');
		if (!(end_date <= options.end_date))
			break;
		end_date = new Date(end_date);

		const { dated_subpage_format } = options;
		let dated_page_sub_title;
		if (Array.isArray(dated_subpage_format)) {
			// assert: options.gallery_per_month >= 2
			//console.trace(start_date);
			const [_start_date, _end_date] = options.date_range = CeL.get_date_range_via_cutting_month(start_date, options.gallery_per_month, { get_Date: true });
			dated_page_sub_title = _start_date.format({ format: dated_subpage_format[0], zone: 0 });
			if (_end_date - _start_date > 0) {
				dated_page_sub_title += '–' + _end_date.format({ format: dated_subpage_format[1], zone: 0 });
			} else {
				// 在同一天。
				options.date_range[1] = null;
			}
		} else {
			delete options.date_range;
			dated_page_sub_title = start_date.format({ format: dated_subpage_format, zone: 0 });
		}
		const dated_page_title = options.base_page_title + dated_page_sub_title;
		//console.trace(dated_page_title);
		const dated_page_data = await wiki.page(dated_page_title);
		const parsed = dated_page_data.parse();
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
		Object.assign(options, { dated_page_sub_title, dated_page_data });
		await process_date(start_date, end_date, options, all_sub_categories_Set);
	}
}

async function get_all_sub_categories(base_category_name, options) {
	let depth;
	if (Array.isArray(base_category_name)) {
		depth = base_category_name[1];
		base_category_name = base_category_name[0];
	} else {
		depth = options.subcategory_depth;
	}

	const cache_file_path = `${base_directory}${CeL.to_file_name(options.base_page_title)}.${CeL.to_file_name(base_category_name)}.all_sub_categories.json`;
	let all_sub_categories_data = CeL.read_file(cache_file_path);
	const { exclude_categories } = options;
	if (all_sub_categories_data) {
		// cache 不符資格
		const cache_not_qualified = [];
		try { all_sub_categories_data = JSON.parse(all_sub_categories_data); } catch (e) { all_sub_categories_data = null; }
		if (!all_sub_categories_data) cache_not_qualified.push('cache 非正規 JSON');
		else {
			// 必須有相同的篩選條件。
			if (JSON.stringify(all_sub_categories_data.exclude_categories) !== JSON.stringify(exclude_categories)) cache_not_qualified.push('exclude_categories 篩選條件不同');
			if (all_sub_categories_data.PATTERN_exclude_categories !== options.PATTERN_exclude_categories) cache_not_qualified.push('PATTERN_exclude_categories 篩選條件不同');
			if (all_sub_categories_data.depth !== depth) cache_not_qualified.push('depth 不同');
			// 有效期限(options.cache_expires)個月。
			if (!(Date.now() - Date.parse(all_sub_categories_data.date) < CeL.to_millisecond(options.cache_expires))) cache_not_qualified.push('cache 不在期限內');
			// 2021/8/29 14:17:18	Echinodermata: 4509 sub-categories.
			if (!Array.isArray(all_sub_categories_data.list)) cache_not_qualified.push('list 非 {Arraay}');
			else if (all_sub_categories_data.list.length < 100) cache_not_qualified.push('list 過小');
		}

		if (cache_not_qualified.length === 0) {
			return all_sub_categories_data.list;
		}
		CeL.info(`重新取得 sub_categories_data: ${cache_not_qualified.join(', ')}`);
	}

	// ------------------------------------------

	//console.trace([cache_file_path, base_category_name, depth, process.memoryUsage()]);

	const PATTERN_exclude_categories = options.PATTERN_exclude_categories && options.PATTERN_exclude_categories.to_RegExp();
	const category_tree = await wiki.category_tree(base_category_name, {
		depth,
		cmtype: 'subcat',
		get_flated_subcategories: true,
		category_filter: category_page_data => (!PATTERN_exclude_categories || !PATTERN_exclude_categories.test(category_page_data.title))
			// `category_page_data.title` starts with "Category:"
			&& (!exclude_categories || !exclude_categories.includes(wiki.remove_namespace(category_page_data)))
	});

	const list = Object.keys(category_tree.flated_subcategories);
	CeL.info(`${base_category_name}: ${list.length} sub-categories.`);
	list.unshift(base_category_name);

	all_sub_categories_data = {
		date: new Date,
		depth,
		PATTERN_exclude_categories: options.PATTERN_exclude_categories,
		exclude_categories,
		list,
		// 會造成 JavaScript heap out of memory
		//tree: category_tree.get_category_tree(),
	};
	//console.trace(all_sub_categories_data);
	CeL.write_file(cache_file_path, all_sub_categories_data);

	return list;
}

async function get_file_created_list(start_date, end_date) {
	return await wiki.categories(await wiki.allimages([start_date.toISOString(), end_date.toISOString()]), { clprop: 'sortkey' });
}

async function process_date(start_date, end_date, options, all_sub_categories_Set) {
	if (false) {
		// The message was shown @ main_process()
		CeL.info(`${process_date.name}: ${start_date.format({ format: '%Y-%2m-%2d', zone: 0 })
			}${end_date - start_date > CeL.to_millisecond('1d') ? `–${end_date.format({ format: '%Y-%2m-%2d', zone: 0 })}` : ''}`);
	}
	// TODO: use for_each_category()
	const file_created_list = options.file_created_list || await get_file_created_list(start_date, end_date);
	//console.log(file_created_list);

	const filtered_files = Object.create(null);
	file_created_list.forEach(
		file_categories_data => file_categories_data.some(
			category_page_data => all_sub_categories_Set.has(wiki.remove_namespace(category_page_data))
				&& (filtered_files[file_categories_data.title] = category_page_data.title)
		)
	);

	// ------------------------------------------

	const contents_to_write = [];
	let count = 0;
	for (const [file_title, category] of Object.entries(filtered_files)) {
		count++;
		const file_line = [file_title];
		if (options.caption) {
			file_line.push(CeL.extract_literals(options.caption, {
				file_link: CeL.wiki.title_link_of(file_title),
				hit_category_link: CeL.wiki.title_link_of(category),
			}));
		}
		contents_to_write.push(file_line.join('|'));
	}
	if (count === 0) {
		// No file in this range.
		return;
	}
	contents_to_write.unshift(`* ${count} / all ${all_sub_categories_Set.size} new files in this day`,
		// gallery parameters
		`<gallery ${options.gallery_attributes?.trim() || ''}>`);
	contents_to_write.push('</gallery>');

	if (!CeL.wiki.content_of(options.dated_page_data)) {
		contents_to_write.unshift('');
		if (options.WARNING) contents_to_write.unshift(`{{${options.warning_page}}}`);
		if (options.NOINDEX) contents_to_write.unshift('__NOINDEX__ ');
	}

	//console.log([end_date, filtered_files]);
	//console.trace([options.dated_page_data.title, contents_to_write, options.date_range]);

	await wiki.edit_page(options.dated_page_data, contents_to_write.join('\n'), {
		section: 'new',
		sectiontitle: start_date.format({ format: options.section_title, zone: 0 }),
		summary: `${summary_prefix}Updating gallery for files in [[Category:${options.base_category}]] (${start_date.format({ format: '%Y-%2m-%2d', zone: 0 })})`,
	});

	if (!options.dated_subpage_format) {
		// no subpage
		return;
	}

	// ------------------------------------------

	const { dated_page_sub_title } = options;
	if (options.list_links?.includes(dated_page_sub_title))
		return;

	await wiki.edit_page(options.base_page_title, page_data => {
		const parsed = page_data.parse();
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
		return parsed.toString() + '\n* ' + CeL.wiki.title_link_of(dated_page_sub_title, options.date_range && options.date_range[1]
			? `{{complex date|-|${options.date_range[0].format('%Y-%2m-%2d')}|${options.date_range[1].format('%Y-%2m-%2d')}}}`
			: start_date.format('{{date|%Y|%m}}'));
	}, {
		summary: `${summary_prefix}Updating gallery list (${start_date.format({ format: '%Y-%2m', zone: 0 })}, ${CeL.wiki.title_link_of(dated_page_sub_title)})`,
	});
}
