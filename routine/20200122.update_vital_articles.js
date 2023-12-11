/*

node 20200122.update_vital_articles.js using_cache
node 20200122.update_vital_articles.js do_PIQA
node 20200122.update_vital_articles.js "base_page=Wikipedia:Vital people"
TODO:
node 20200122.update_vital_articles.js "base_page=Wikipedia:基礎條目" use_language=zh

2020/1/23 14:24:58	初版試營運	Update the section counts and article assessment icons for all levels of [[Wikipedia:Vital articles]].
2020/2/7 7:12:28	於 Wikimedia Toolforge 執行需要耗費30分鐘，大部分都耗在 for_each_list_page()。

對話頁上的模板內容會在最後才取得。因此假如要靠對話頁上的模板更改屬性，就不能夠一次做到好。

TODO:
將判斷條目的屬性與品質寫成泛用功能
report level/class change

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Load modules.
CeL.run(['application.net.wiki.featured_content',
	// for {{Anchor}}
	'application.net.wiki.template_functions',
	// for CeL.assert()
	'application.debug.log']);

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('en');
/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

const using_cache = CeL.env.arg_hash?.using_cache;
if (using_cache)
	prepare_directory(base_directory);

const do_PIQA = CeL.env.arg_hash?.do_PIQA;

// ----------------------------------------------

// badge
const page_info_cache_file = `${base_directory}/articles attributes.json`;
const page_info_cache = using_cache && CeL.get_JSON(page_info_cache_file);

/** {Object}icons_of_page[title]=[icons] */
const icons_of_page = page_info_cache?.icons_of_page || Object.create(null);
/** {Object}level of page get from list page. icons_of_page[title]=1–5 */
const list_page_level_of_page = page_info_cache?.list_page_level_of_page || Object.create(null);
/** {Object}level of page get from category. icons_of_page[title]=1–5 */
const category_level_of_page = page_info_cache?.category_level_of_page || Object.create(null);
/** {Array}list of WikiProject templates */
const all_WikiProject_template_list = page_info_cache?.all_WikiProject_template_list || [];
/** {Array}list of opted out WikiProject templates */
const all_opted_out_WikiProject_template_list = page_info_cache?.all_opted_out_WikiProject_template_list || [];
/** {Object}listed_article_info[title]=[{level,topic},{level,topic},...] */
const listed_article_info = Object.create(null);
/**
 * 必須編輯其談話頁面。
 * {Object}have_to_edit_its_talk_page[main page title needing to edit cital article infomation in the talk page] = {level,topic}
 */
const have_to_edit_its_talk_page = Object.create(null);

const VA_template_name = 'Vital article';
const WPBS_template_name = 'WikiProject banner shell';
const WPDAB_template_name = 'WikiProject Disambiguation';
const WPBIO_template_name = 'WikiProject Biography';

const WikiProject_template_categories = ['Category:WikiProject banners without quality assessment', 'Category:WikiProject banners with quality assessment', 'Category:Inactive WikiProject banners'];
const opted_out_WikiProject_template_categories = ['Category:WikiProjects using a non-standard quality scale'];

const default_base_page_prefix = 'Wikipedia:Vital articles';
const base_page_prefix = wiki.normalize_title(CeL.env.arg_hash?.base_page?.replace(/\/+$/, '')) || default_base_page_prefix;
const get_category_level_of_page = base_page_prefix === default_base_page_prefix;
const modify_talk_pages = base_page_prefix === default_base_page_prefix;
//console.trace([base_page_prefix, get_category_level_of_page]);

// [[Wikipedia:Vital articles/Level/3]] redirect to→ `base_page_prefix`
const DEFAULT_LEVEL = 3;

// There is no category of the icons now, preserve the icon.
// @see [[Module:Article history/config]], [[Template:Icon]]
const icon_note = {
	FFAC: 'Failed featured article candidate'
};

// @see function set_section_title_count(parent_section)
// [ all, quota+articles postfix ]
const PATTERN_count_mark = /\([\d,]+(\/[\d,]+)?\s+articles?\)/i;
const PATTERN_counter_title = new RegExp(/^[\w\s\-–',\/]+MARK$/.source.replace('MARK', PATTERN_count_mark.source), 'i');

const report_lines = [];
report_lines.skipped_records = 0;
/**{Set}已經警告過的topics */
report_lines.warned_topics = new Set;

let max_VA_level;

// ----------------------------------------------

const KEY_extra_items = '*';
function sorted_keys_of_Object_by_order(object, order_Set, extra_sort_function) {
	if (!order_Set)
		return Object.keys(object).sort(extra_sort_function);

	let extra_icons = Object.keys(object).filter(icon => !order_Set.has(icon)).sort(extra_sort_function);

	const icon_order = [];
	for (const icon of order_Set) {
		if (icon === KEY_extra_items) {
			icon_order.append(extra_icons);
			extra_icons = null;
		} else if (icon in object) {
			icon_order.push(icon);
		}
	}

	if (extra_icons)
		icon_order.append(extra_icons);

	return icon_order;
}

// ----------------------------------------------

let icon_order_Set, icon_order_Map;

function get_topic_of_section(page_and_section, topic) {
	const page_and_section_id = page_and_section.replace(/^.+\/Level\/?/, '').replace(/\s*\]\]\s*#\s*/, '#').replace(/^([^#]+)#$/, '$1') || DEFAULT_LEVEL;
	if (!topic && typeof page_and_section_id === 'string') {
		topic = page_and_section_id.replace(/^(?:(\d)\/)?([^#]+)?(?:#(.*))$/, (all, level, page, section) => {
			if (!level && /^\d$/.test(page)) {
				// 1, 2級
				level = page;
				page = '';
			}
			if (level <= DEFAULT_LEVEL) {
				// 1級的 page, section 不包含 topic 資訊。
				// 2, 3級的 section title 分割過細，不如採下一等級的。
				return '';
			}
			// sublist do not include section
			return page;
		});
		//console.trace([page_and_section, page_and_section_id, topic]);
	}
	if (topic) {
		const matched = topic.match(/^(.+?)\/(.+)$/);
		topic = matched ? {
			topic: matched[1],
			// sublist
			subpage: matched[2]
		} : { topic };

	} else {
		if (/![12]\//.test(page_and_section_id))
			CeL.error(`${get_topic_of_section.name}: Cannot determine the topic of ${JSON.stringify(page_and_section_id)}!`);
		return;
	}

	const Topics = wiki.latest_task_configuration.Topics;
	if (!Topics[page_and_section_id]) {
		delete Topics[page_and_section];
		Topics[page_and_section_id] = topic;
	} else if (page_and_section_id === page_and_section) {
		// `page_and_section` is page and section id
		Topics[page_and_section_id] = topic;
	} else {
		CeL.warn(`${get_topic_of_section.name}: Duplicated topic configuration! ${page_and_section_id} and ${page_and_section}`);
	}
	//console.trace([page_and_section, page_and_section_id, Topics[page_and_section_id]]);
	return Topics[page_and_section_id];
}

/**
 * 由設定頁面讀入手動設定 manual settings。
 * 
 * @param {Object}latest_task_configuration
 *            最新的任務設定。
 */
async function adapt_configuration(latest_task_configuration) {
	// console.log(wiki);

	// ----------------------------------------------------

	const general = latest_task_configuration.general || (latest_task_configuration.general = Object.create(null));

	if (general.report_page && base_page_prefix === default_base_page_prefix)
		talk_page_summary_prefix = CeL.wiki.title_link_of(general.report_page, talk_page_summary_prefix_text);

	if (general.icon_order && typeof general.icon_order === 'string') {
		icon_order_Map = new Map();
		icon_order_Set = general.icon_order.split(',').map(icon => icon.trim()).filter(icon => !!icon);
		icon_order_Set.forEach((icon, order) => icon_order_Map.set(icon, order));
		icon_order_Set = new Set(icon_order_Set);
	} else {
		icon_order_Set = icon_order_Map = null;
	}

	if (general.pages_auto_add_summary_table && !CeL.is_RegExp(general.pages_auto_add_summary_table = general.pages_auto_add_summary_table.to_RegExp())) {
		CeL.error(`${adapt_configuration.name}: Invalid RegExp: ${general.pages_auto_add_summary_table}`);
		delete general.pages_auto_add_summary_table;
	}

	// ----------------------------------------------------

	const { Topics } = latest_task_configuration;
	if (Topics) {
		for (let [page_and_section, topic] of Object.entries(Topics)) {
			get_topic_of_section(page_and_section, topic);
		}
	} else {
		// Initialization
		latest_task_configuration.Topics = Object.create(null);
	}

	console.log(latest_task_configuration);
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
	wiki.FC_data_hash = page_info_cache?.FC_data_hash;
	if (!wiki.FC_data_hash) {
		await get_page_info();
		if (using_cache)
			CeL.write_file(page_info_cache_file, {
				category_level_of_page, icons_of_page, FC_data_hash: wiki.FC_data_hash,
				all_WikiProject_template_list, all_opted_out_WikiProject_template_list
			});
	}

	await wiki.register_redirects([VA_template_name, WPBS_template_name, WPDAB_template_name]
		.append(CeL.wiki.setup_layout_elements.template_order_of_layout[wiki.site_name()].talk_page_lead)
		.append(all_WikiProject_template_list).append(all_opted_out_WikiProject_template_list), { namespace: 'Template', no_message: true });

	// ----------------------------------------------------

	function to_title(page_data) {
		const title = typeof page_data === 'string' ? page_data : page_data.title;
		//console.log([title, title === base_page_prefix ? level_to_page_title(DEFAULT_LEVEL, true) : '']);
		if (title === base_page_prefix)
			return level_to_page_title(DEFAULT_LEVEL, true);
		return title;
	}

	const vital_articles_list = ((await wiki.prefixsearch(base_page_prefix)) || [
		// 1,
		// 2,
		// 3 && '',
		// '4/Removed',
		// '4/People',
		'4/History',
		// '4/Physical sciences',
		// '5/People/Writers and journalists',
		// '5/People/Artists, musicians, and composers',
		// '5/Physical sciences/Physics',
		// '5/Technology',
		// '5/Everyday life/Sports, games and recreation',
		// '5/Mathematics',
		// '5/Geography/Cities',
	].map(level => level_to_page_title(level)))
		.filter(page_data => !/\.json$/i.test(to_title(page_data)));

	max_VA_level = vital_articles_list.reduce((max_VA_level, page_data) => {
		const level = level_of_page_title(page_data);
		return max_VA_level < level ? level : max_VA_level;
	}, 0);
	// assert: vital_articles_list 標題應該已按照高重要度 → 低重要度的級別排序。
	//console.trace(vital_articles_list);

	//console.log(vital_articles_list.length);
	//console.log(vital_articles_list.map(page_data => page_data.title));

	await wiki.for_each_page(vital_articles_list, for_each_list_page, {
		// prevent [[Talk:Ziaur Rahman]] redirecting to [[Talk:Ziaur Rahman (disambiguation)]]
		//redirects: 1,
		bot: 1,
		minor: false,
		log_to: null,
		multi: 'keep order',
		skip_nochange: true,
		// 高重要度必須排前面，保證處理低重要度的列表時已知高重要度有那些文章，能 level_page_link()。
		sort_function(page_data_1, page_data_2) {
			const title_1 = to_title(page_data_1);
			const title_2 = to_title(page_data_2);
			// assert: to_title(page_data_1) !== to_title(page_data_2)
			return title_1 < title_2 ? -1 : 1;
		},
		summary: CeL.wiki.title_link_of(base_page_prefix === default_base_page_prefix && wiki.latest_task_configuration.general.report_page || wiki.latest_task_configuration.configuration_page_title, 'Update the section counts and article assessment icons')
	});

	// ----------------------------------------------------

	await generate_all_VA_list_page();

	check_page_count();

	let no_editing_of_talk_pages;
	if (modify_talk_pages) {
		const talk_pages_to_edit = Object.keys(have_to_edit_its_talk_page).length;
		if (talk_pages_to_edit > wiki.latest_task_configuration.general.talk_page_limit_for_editing
			&& !CeL.env.arg_hash?.forced_edit) {
			no_editing_of_talk_pages = true;
			CeL.warn(`編輯談話頁面數量${talk_pages_to_edit}篇，超越編輯數量上限${wiki.latest_task_configuration.general.talk_page_limit_for_editing}。執行時請設定命令列參數 forced_edit 以強制編輯。`);
		} else {
			await maintain_VA_template();
		}
	}

	// ----------------------------------------------------

	if (do_PIQA) {
		if (!CeL.is_empty_object(have_to_edit_its_talk_page)) {
			// clean
			Object.keys(have_to_edit_its_talk_page).forEach(page_title => delete have_to_edit_its_talk_page[page_title]);
		}

		for (const WikiProject_template_data of all_WikiProject_template_list) {
			if (wiki.is_template(all_opted_out_WikiProject_template_list, WikiProject_template_data)
				|| !wiki.is_template(WPBIO_template_name, WikiProject_template_data)
			) {
				continue;
			}

			for (const page_data of (await wiki.embeddedin(WikiProject_template_data, {
				limit: 5000
			})).slice(0, 35)) {
				const page_title = page_data.title;
				have_to_edit_its_talk_page[page_title] = {
					// 所有作業皆經由人工監督。
					talk_page_summary_prefix: `[[Wikipedia:Bots/Requests for approval/Cewbot 12|Bot test]] for [[WP:PIQA]]. All operations are manually supervised`,
					no_topic_message: true,
					do_PIQA: true,
					key_is_talk_page: true,
				};
			}

			await maintain_VA_template();
		}

		//routine_task_done('1 week');

	} else if (modify_talk_pages) {
		await generate_report({ no_editing_of_talk_pages });

		routine_task_done('1d');
	}
}

// ----------------------------------------------------------------------------

const icon_to_category = Object.create(null);

function vital_article_level_to_category(level) {
	// 2023/7/24 `All Wikipedia level-${level} vital articles` → `Wikipedia level-${level} vital articles`
	return `Wikipedia level-${level} vital articles`;
}

// All attributes of articles get from corresponding categories.
async function get_page_info() {

	await wiki.get_featured_content({
		on_conflict(FC_title, data) {
			report_lines.push([FC_title, , `Category conflict: ${data.from}→${CeL.wiki.title_link_of('Category:' + data.category, data.to)}`]);
		}
	});

	if (!wiki.FC_data_hash['Ambulance']?.types.includes('GA')) {
		console.trace(wiki.FC_data_hash['Ambulance']);
		throw new Error('[[Ambulance]] should be a GA!');
	}

	// ---------------------------------------------

	// Skip [[Category:All Wikipedia level-unknown vital articles]]
	if (get_category_level_of_page) {
		for (let level = /*max_VA_level*/5; level >= 1; level--) {
			const page_list = await wiki.categorymembers(vital_article_level_to_category(level), {
				// exclude [[User:Fox News Brasil]]
				namespace: 'talk'
			});
			page_list.forEach(page_data => {
				const title = wiki.talk_page_to_main(page_data.original_title || page_data);
				if (title in category_level_of_page) {
					report_lines.push([title, , `${category_level_of_page[title]}→${level}`]);
				}
				category_level_of_page[title] = level;
			});
		}
		// console.log(category_level_of_page);
	}

	// ---------------------------------------------

	const synchronize_icons = 'List|FA|FL|GA'.split('|');
	const synchronize_icon_hash = Object.fromEntries(synchronize_icons.map(icon => [icon, true]));

	// list an article's icon for current quality status always first
	// they're what the vital article project is most concerned about.
	// [[Category:Wikipedia vital articles by class]]
	//
	// [[Wikipedia:Content assessment#Grades]]
	'A|B|C|NA|Start|Stub'.split('|')
		// FA|FL|GA|List|
		.append(synchronize_icons)
		// 2023/7: `All Wikipedia ${icon}-Class vital articles` → `${icon}-Class vital articles`
		// NA 級是不需要評估的東西，適用於重定向、草稿、類別或消歧頁面等非文章。Unassessed 未評估意味著他們需要評估，但尚未完成。
		.forEach(icon => icon_to_category[icon] = `${icon}-Class vital articles`);
	'Unassessed'.split('|')
		// The unassessed category is [[Category:Unassessed vital articles]], not [[Category:Unassessed-Class vital articles]]
		.forEach(icon => icon_to_category[icon] = `${icon} vital articles`);
	// @see [[Module:Article history/config]], [[Template:Icon]]
	Object.assign(icon_to_category, {
		// FFA: 'Wikipedia former featured articles',
		FFL: 'Wikipedia former featured lists',
		FFLC: 'Wikipedia featured list candidates (contested)',
		FGAN: 'Former good article nominees',
		DGA: 'Delisted good articles',
		FPo: 'Wikipedia featured portals',
		FFPo: 'Wikipedia former featured portals',
		FPoC: 'Wikipedia featured portal candidates (contested)',

		// [[Category:All Wikipedia List-Class vital articles]]
		// duplicated with [[Category:List-Class List articles]]
		LIST: 'List-Class List articles',

		// The icons that haven't been traditionally listed
		// (peer review, in the news) might even be unnecessary.
		// PR: 'Old requests for peer review',
		// ITN: 'Wikipedia In the news articles',
		// OTD: 'Article history templates with linked otd dates',
	});
	for (const [icon, category_name] of Object.entries(icon_to_category)) {
		const pages = await wiki.categorymembers(category_name);
		pages.forEach(page_data => {
			if (!wiki.is_namespace(page_data, 'Talk')) {
				if (!wiki.is_namespace(page_data, 'Category') && !((category_name === 'Wikipedia former featured portals' || category_name === 'Wikipedia featured portals') && wiki.is_namespace(page_data, 'Portal talk')))
					CeL.warn(`${get_page_info.name}: Skip invalid namespace: ${CeL.wiki.title_link_of(page_data)} (${category_name})`);
				return;
			}
			const title = wiki.talk_page_to_main(page_data.original_title || page_data);
			if (!(title in icons_of_page))
				icons_of_page[title] = [];
			if (icon in synchronize_icon_hash /* synchronize_icons.includes(icon) */) {
				// assert: ('VA_class' in icons_of_page[title]) === false
				icons_of_page[title].VA_class = icon.toUpperCase();
			} else {
				icons_of_page[title].push(icon);
			}
		});
	}
	// console.log(icons_of_page);

	// ---------------------------------------------
	// Check VA class, synchronize FA|FL|GA|List.

	const former_icon_of_VA_class = {
		FA: 'FFA',
		FL: 'FFLC',
		GA: 'FGAN',
	};

	for (const page_title in icons_of_page) {
		let icons = icons_of_page[page_title];
		if (!icons.VA_class) {
			// There is no VA class of the title. abnormal!
			continue;
		}

		// List → LIST
		const VA_class = icons.VA_class.toUpperCase();

		// For the first time do_PIQA
		if (do_PIQA && Object.keys(have_to_edit_its_talk_page).length < 35
			//|| page_title.includes('')
		) {
			have_to_edit_its_talk_page[page_title] = {
				class: VA_class || '',
				reason: `[[Wikipedia:Templates for discussion/Log/2023 May 17#Template:Vital article|Merge {{VA}} into {{WPBS}}]].`,
				no_topic_message: true,
			};
		}

		// Remove FGAN form ".VA_class = GA".
		if (former_icon_of_VA_class[VA_class] && icons.includes(former_icon_of_VA_class[VA_class])) {
			icons = icons_of_page[page_title] = icons.filter(icon => icon !== former_icon_of_VA_class[VA_class]);
		}
		// Also remove the FGAN symbol from articles that are also DGA. It just seems redundant to show the FGAN symbol for delisted good articles.
		if (icons.includes('DGA') && icons.includes('FGAN')) {
			icons = icons_of_page[page_title] = icons.filter(icon => icon !== 'FGAN');
		}

		// Release memory. 釋放被占用的記憶體。
		delete icons.VA_class;
		if (icons.includes(VA_class)) {
			// assert: VA_class === 'LIST'
			continue;
		}

		function fallback() {
			if (/^(?:FA|FL|GA)$/.test(VA_class)) {
				// fallback. e.g., FFA
				// [[w:en:User talk:Kanashimi#Cewbot A-class]]: When removing GAs, it should default to B class, which seems the usual practice for manual downgrades.
				have_to_edit_its_talk_page[page_title] = {
					// NG: Move class from FA|GA|FL → A|B|LIST
					//class: VA_class === 'FL' ? 'LIST' : VA_class === 'FA' ? 'A' : 'B',
					// We really have no choice, since every de-featured article is different, although most are C-class.

					// Plenty of unclassified articles out there, perhaps it may prompt someone to take a closer look at an article.
					class: VA_class === 'FL' ? 'LIST' : VA_class === 'FA' ? '' : '',
					reason: `The article is no longer a ${VA_class}.`
				};
				return true;
			}
		}

		const FC_type = wiki.FC_data_hash[page_title] && wiki.FC_data_hash[page_title].type;
		if (FC_type) {
			if (FC_type !== VA_class) {
				let category = wiki.get_featured_content_configurations()[FC_type];
				if (category) {
					have_to_edit_its_talk_page[page_title] = {
						class: FC_type,
						reason: `The article is listed in featured content type: [[Category:${category}]]`
					};
				} else {
					// prevent FC_type===FFA. e.g., [[Talk:China]] @ 2020/12/22
					//console.trace([page_title, VA_class, FC_type]);
					fallback();
				}
			}
			continue;
		}

		let icon = 'LIST';
		// Must test after wiki.FC_data_hash[]
		if (icons.includes(icon)) {
			// e.g., list in [[Category:List-Class List articles]]
			// but not in [[Category:All Wikipedia List-Class vital articles]]
			have_to_edit_its_talk_page[page_title] = {
				class: icon,
				reason: `The article is listed in list type: [[Category:${icon_to_category[icon]}]]`
			};
			continue;
		}

		icon = 'LIST';
		// e.g., list in [[Category:All Wikipedia List-Class vital articles]]
		// but not in [[Category:List-Class List articles]]
		if (VA_class === icon) {
			icons.push(VA_class);
			continue;
		}

		// assert: /^(?:FA|FL|GA)$/.test(VA_class)
		if (fallback()) {
			continue;
		}
	}

	/** {Array}list of opted out WikiProject templates */
	const all_opted_out_WikiProject_template_Set = new Set;
	for (const category of opted_out_WikiProject_template_categories) {
		(await wiki.categorymembers(category, { namespace: 'Template' })).forEach(page_data => all_opted_out_WikiProject_template_Set.add(page_data.title));
	}
	all_opted_out_WikiProject_template_list.append(Array.from(all_opted_out_WikiProject_template_Set));
	CeL.info(`${get_page_info.name}: ${all_opted_out_WikiProject_template_list.length} opted out WikiProject templates.`);

	const all_WikiProject_template_Set = new Set;
	for (const category of WikiProject_template_categories) {
		(await wiki.categorymembers(category, { namespace: 'Template' })).forEach(page_data => /*all_opted_out_WikiProject_template_Set.has(page_data.title) || */all_WikiProject_template_Set.add(page_data.title));
	}
	all_WikiProject_template_list.append(Array.from(all_WikiProject_template_Set));
	CeL.info(`${get_page_info.name}: ${all_WikiProject_template_list.length} WikiProject templates.`);
}

// ----------------------------------------------------------------------------

function level_to_page_title(level, add_level) {
	return level === DEFAULT_LEVEL && !add_level ? base_page_prefix : base_page_prefix + '/Level/' + level;
}

function level_page_link(level, number_only, page_title) {
	return `[[${page_title || level_to_page_title(level)}|${number_only ? '' : 'Level '}${level}]]`;
}

function level_of_page_title(page_title, number_only) {
	// page_title.startsWith(base_page_prefix);
	// [, 1–5, section ]
	const matched = (page_title && page_title.title || page_title).match(/\/Level(?:\/([1-5])(\/.+)?)?$/);
	if (matched) {
		const level = number_only || !matched[2] ? + matched[1] || DEFAULT_LEVEL : matched[1] + matched[2];
		return level;
	}
}

function replace_level_note(item, index, highest_level, new_wikitext) {
	if (item.type !== 'list_item' && item.type !== 'plain')
		return;

	const rest_wikitext = item.slice(index + 1).join('').trim();
	const PATTERN_level = /\s*\((?:level [1-5]|\[\[([^\[\]\|]+)\|level [1-5]\]\])\)/i;
	const matched = rest_wikitext && rest_wikitext.match(PATTERN_level);

	if (new_wikitext === undefined) {
		// auto-generated
		new_wikitext = ` (${level_page_link(highest_level, false, matched &&
			// preserve level page. e.g.,
			// " ([[Wikipedia:Vital articles/Level/2#Society and social sciences|Level 2]])"
			(highest_level === DEFAULT_LEVEL || matched[1] && matched[1].includes(`/${highest_level}`)) && matched[1])})`;
	}
	// assert: typeof new_wikitext === 'string'
	// || typeof new_wikitext === 'number'

	if (new_wikitext) {
		item.set_category_level = highest_level;
	}

	// Decide whether we need to replace or not.
	if (new_wikitext ? rest_wikitext.includes(new_wikitext)
		// new_wikitext === '': Remove level note.
		: !matched) {
		// No need to change
		return;
	}

	item.truncate(index + 1);
	// _item.push()
	item[index + 1] = rest_wikitext ? rest_wikitext.replace(PATTERN_level, new_wikitext) : new_wikitext;
	return true;
}

function icons_and_item_toString() {
	return this.join(' ');
}

function is_ignored_list_page(list_page_data) {
	const title = list_page_data.title;
	return title.endsWith('/Removed')
		//[[Wikipedia:Vital articles/Level/4/People/Candidates]]
		|| title.endsWith('/Candidates');
}

async function for_each_list_page(list_page_data) {
	if (CeL.wiki.parse.redirect(list_page_data))
		return Wikiapi.skip_edit;
	if (list_page_data.title.endsWith('/Labels')) {
		// Skip non-list pages.
		return Wikiapi.skip_edit;
	}
	if (is_ignored_list_page(list_page_data)) {
		// 想要更新這些被忽略的頁面，必須做更多測試，避免他們也列入索引。
		return Wikiapi.skip_edit;
	}
	if (CeL.wiki.content_of.revision(list_page_data)?.contentmodel !== 'wikitext') {
		// e.g., 'json'
		return Wikiapi.skip_edit;
	}

	const level = level_of_page_title(list_page_data, true) || DEFAULT_LEVEL;
	// console.log([list_page_data.title, level]);
	const parsed = list_page_data.parse();
	CeL.assert([CeL.wiki.content_of(list_page_data), parsed.toString()], 'wikitext parser check for ' + CeL.wiki.title_link_of(list_page_data));
	// console.log(parsed);
	parsed.each_section();
	// console.log(parsed.child_section_titles);
	// console.log(parsed.child_section_titles[0]);
	// console.log(parsed.child_section_titles[0].child_section_titles[0]);

	const article_count_of_icon = Object.create(null);

	const need_check_redirected = Object.create(null);
	let latest_section_title;

	let topic_of_current_section, latest_topic_section;
	set_latest_section_title();
	function set_latest_section_title(section_title_token) {
		latest_section_title = section_title_token;
		if (latest_section_title)
			latest_section_title.item_count = 0;

		// 判別 topic: 從本 section 一直向上追溯所有 parent section。
		const Topics = wiki.latest_task_configuration.Topics;
		//console.log(Topics);
		if (!Topics || latest_section_title && latest_topic_section === latest_section_title)
			return;
		latest_topic_section = latest_section_title;

		const page_id = level_of_page_title(list_page_data) || DEFAULT_LEVEL;
		let section_title_now = latest_section_title;
		topic_of_current_section = null;
		while (section_title_now) {
			const section_title = section_title_now.title.toString().replace(PATTERN_count_mark, '').trim();
			//console.trace(section_title);
			const page_and_section_id = `${page_id}#${section_title}`;
			topic_of_current_section = Topics[page_and_section_id] || get_topic_of_section(page_and_section_id);
			if (topic_of_current_section) {
				// console.trace([page_and_section_id, topic_of_current_section]);
				break;
			}
			section_title_now = section_title_now.parent_section_title;
		}
		topic_of_current_section = topic_of_current_section || Topics[page_id];

		if (false && section_title_token?.title.toString().includes('Crocodilia')) {
			console.trace([page_id, topic_of_current_section]);
		}
	}

	function set_redirect_to(redirect_from, normalized_redirect_to) {
		[icons_of_page, list_page_level_of_page, category_level_of_page, listed_article_info].forEach(list => {
			if (redirect_from in list) {
				if (normalized_redirect_to in list) {
					CeL.error(`${set_redirect_to.name}: For ${redirect_from}→${normalized_redirect_to}, the target is existed in the list!`);
					return;
				}
				list[normalized_redirect_to] = list[redirect_from];
				//delete list[redirect_from];
			}
		});
	}

	function simplify_link(link_token, normalized_page_title) {
		// console.log(link_token);
		if (link_token[2]
			// Need avoid [[PH|pH]], do not use
			// wiki.normalize_title(link_token[2].toString())
			&& link_token[2].toString().trim() ===
			// assert: normalized_page_title ===
			// wiki.normalize_title(link_token[0].toString())
			(normalized_page_title || wiki.normalize_title(link_token[0].toString()))) {
			// assert: link_token.length === 3
			link_token.length = 2;
		}
	}

	function for_item(item, index, list) {
		if (item.type === 'list') {
			item.forEach((list_item, index, list) => {
				if (list_item.length === 1 && list_item[0].type === 'list')
					for_item(list_item[0], index, list);
				else
					for_item(list_item, index, list);
			});
			return;
		}

		let item_replace_to, icons = [];
		function for_item_token(token, index, _item) {
			if (!item_replace_to && token.type !== 'link') {
				// e.g., token.type === 'list_item'

				// For token.type === 'bold', 'italic', finding the first link children.
				// e.g., `'' [[title]] ''`, `''' [[title]] '''`,
				// `''''' [[title]] '''''`
				parsed.each.call(token, (_token, index, parent) => {
					if (typeof _token === 'string'
						// e.g., "{{Icon|A}} ''[[title]]''"
						&& !/^['\s]*$/.test(_token)) {
						// Skip links with non-space prefix.
						return parsed.each.exit;
					}

					if (_token.type === 'link') {
						// assert: token.type === 'link'
						token = _token;
						return parsed.each.exit;
					}
				});
				//console.trace(token);
			}

			if (token.type === 'link' && !item_replace_to) {
				// e.g., [[pH]], [[iOS]]
				const normalized_page_title = wiki.normalize_title(token[0].toString());
				simplify_link(token, normalized_page_title);
				if (wiki.is_namespace(normalized_page_title, 'Wikipedia')) {
					// Skip invalid namespaces.
					return parsed.each.exit;
				}
				if (!(normalized_page_title in listed_article_info)) {
					listed_article_info[normalized_page_title] = [];
				}
				const article_info = {
					level: level_of_page_title(list_page_data, true),
					// detailed_level這個參數是為了準確的連結到列表頁面。現在我採用的方法其實是讀取列表頁面之後，取得頁面名稱與章節名稱再來做分類。topic、subpage 其實是從[[User:Cewbot/log/20200122/configuration#Topics]]轉換獲得的，不是靠著一頁一頁讀取文章的talk頁面。其實我一直疑惑，為何像 5/People/Entertainers, directors, producers, and screenwriters 不能夠設定成 subpage=Entertainers, directors, producers, and screenwriters，如此就能少一個轉換的過程。
					// The <code>detailed_level</code> parameter is to link to the list page accurately. The way I'm using now is to read the list page and then get the page name and chapter name to categorize it. <code>topic</code> and <code>subpage</code> are actually converted from [[User:Cewbot/log/20200122/configuration#Topics]] instead of relying on reading the talk page of the article one by one. In fact, I've been wondering why something like <code>5/People/Entertainers, directors, producers, and screenwriters</code> can't be set to <code>subpage=Entertainers, directors, producers, and screenwriters</code>, so that there is less conversion process.
					detailed_level: level_of_page_title(list_page_data),
					link: latest_section_title?.link,
				};
				listed_article_info[normalized_page_title].push(article_info);

				if (topic_of_current_section) {
					Object.assign(article_info, topic_of_current_section);
					//console.trace([normalized_page_title, article_info]);
				}

				if (normalized_page_title in icons_of_page) {
					icons.append(icons_of_page[normalized_page_title]);
				}

				if (normalized_page_title in wiki.FC_data_hash) {
					icons.append(wiki.FC_data_hash[normalized_page_title].types);
				}

				// Good: Always count articles.
				// NG: The bot '''WILL NOT COUNT''' the articles listed in level
				// other than current page to prevent from double counting.
				// 先把本章節的條目數量儲存在 .item_count，等到最後 function set_section_title_count(parent_section) 再一次處理。
				if (latest_section_title) {
					latest_section_title.item_count++;
				}

				const list_page_or_category_level = list_page_level_of_page[normalized_page_title] || category_level_of_page[normalized_page_title];
				// 登記列在本頁面的項目。先到先贏。
				if (!(normalized_page_title in list_page_level_of_page)) {
					list_page_level_of_page[normalized_page_title] = level;
				}
				// The frist link should be the main article.
				if (list_page_or_category_level === level || is_ignored_list_page(list_page_data)) {
					// Remove level note. It is unnecessary.
					replace_level_note(_item, index, list_page_or_category_level, '');
				} else {
					// `list_page_or_category_level===undefined`: e.g., redirected
					replace_level_note(_item, index, list_page_or_category_level, list_page_or_category_level ? undefined : '');

					if (false) {
						const message = `Category level ${list_page_or_category_level}, also listed in level ${level}. If the article is redirected, please modify the link manually.`;
					}
					// Use {{r}} to reduce size.
					const message = `${CeL.wiki.title_link_of(wiki.to_talk_page(normalized_page_title))}: ${list_page_or_category_level ? `Category level ${list_page_or_category_level}.{{r|c}}` : 'Not set as VA?{{r|e}}'}`;
					if (!list_page_or_category_level) {
						have_to_edit_its_talk_page[normalized_page_title] = {
							...article_info,
							level,
							reason: `The article is listed in the level ${level} page`
						};
					}
					if (!(list_page_or_category_level < level)) {
						// Only report when list_page_or_category_level (main level) is not
						// smallar than level list in.
						report_lines.push([normalized_page_title, list_page_data, message]);
						if (false) CeL.warn(`${CeL.wiki.title_link_of(normalized_page_title)}: ${message}`);
						// If there is list_page_or_category_level, the page was not redirected.
						if (!list_page_or_category_level) {
							// e.g., deleted; redirected (fix latter);
							// does not has {{`VA_template_name`}}
							// (fix @ maintain_VA_template_each_talk_page())
							need_check_redirected[normalized_page_title] = token;
						}
					}
					if (icons.length === 0) {
						// Leave untouched if error with no icon.
						// e.g., unleveled articles
						return true;
					}
				}

				icons = icons.sort((_1, _2) => {
					const order_1 = icon_order_Map.get(_1) || icon_order_Map.get(KEY_extra_items) || icons.length;
					const order_2 = icon_order_Map.get(_2) || icon_order_Map.get(KEY_extra_items) || icons.length;
					return order_1 !== order_2 ? order_1 - order_2 : _1 < _2 ? -1 : _1 > _2 ? 1 : 0;
				});
				//if (icons.join(' ').includes('FFAC')) { console.trace(icons); }
				icons = icons.map(icon => {
					if (icon in article_count_of_icon)
						article_count_of_icon[icon]++;
					else
						article_count_of_icon[icon] = 1;
					//{{Class/icon}}
					return `{{Icon|${icon}}}`;
				});


				parsed.each.call(_item[index], (_token, index, parent) => {
					//console.log(_token);
				}, { add_index: true });

				Object.assign(_item[index], { index, parent: _item });
				function move_up() {
					const parent = token.parent;
					//assert: token.index === 0 && token.parent[0] === token

					// '''[[link]]''' → [[link]]
					parent.parent[parent.index] = token;
					token.index = parent.index;
					token.parent = parent.parent;
				}
				if (false) {
					// Clear all style
					while (_item[index] !== token && token.parent?.length === 1) {
						move_up();
					}
				}
				// Only clear '''bold font''' and '''''bold italics'''''
				// This will keep ''work title''
				// For work titles or scientific names needing to be italicized, please using <nowiki><i></nowiki> instead.
				if (token.parent.type === 'bold' && token.parent.length === 1) {
					move_up();
					if (token.parent.type === 'italic' && token.parent.length === 1) {
						move_up();
					}
					//should be: _item[index] === token
				}

				if (false && token.toString().includes('Russian Empire')) {
					console.trace(_item);
				}
				if (_item[index] === token && _item.set_category_level && level - list_page_or_category_level > 0) {
					// All articles from higher levels are also included in lower levels. For example, all 100 subjects on the Level 2 list (shown on this page in bold font) are included here in Level 3. And the Level 2 list also includes the 10 subjects on Level 1 (shown on this page in bold italics).
					_item[index] = level - list_page_or_category_level === 1 ? `'''${token}'''` : `'''''${token}'''''`;
					//console.trace(_item[index]);
				}
				// Using token will preserve link display text.
				icons.push(_item[index]);

				// 為避免替換後 `Check redirects` 無效，依然保留 token。
				//item_replace_to = icons.join(' ');
				item_replace_to = icons;
				item_replace_to.toString = icons_and_item_toString;

				// 前面的全部消除光，後面的原封不動
				// list[index] = item_replace_to;
				_item[index] = item_replace_to;
				if (_item === item)
					_item.splice(0, index);
				return true;
			}

			if (token.type === 'transclusion' && token.name === 'Space'
				|| !token.toString().trim()) {
				// Skip
			} else if (token.type === 'transclusion' && token.name === 'Icon') {
				// reset icon
				// _item[index] = '';

				const icon = token.parameters[1];
				if (icon === 'FFAC') {
					icons.push(icon);
				}
			} else if (item_replace_to) {
				// CeL.error('for_item: Invalid item: ' + _item);
				console.log(item_replace_to);
				console.log(token);
				CeL.error(`${for_item.name}: Invalid item: ` + _item)
				throw new Error(`${for_item.name}: Invalid item: ` + _item);
			} else {
				if (_item.length !== 1 || typeof token !== 'string') {
					console.log(`Skip from ${index}/${_item.length}, ${token.type || typeof token} of item: ${_item}`);
					// console.log(_item.join('\n'));
					// delete _item.parent;
					// console.log(_item);

					if (false) report_lines.push([normalized_page_title, list_page_data, `Invalid item: ${_item}`]);

					// Fix invalid pattern.
					const wikitext = (_item.type === 'list_item' || _item.type === 'plain') && _item.toString();
					let PATTERN;
					if (!wikitext) {
					} else if ((PATTERN = /('{2,5})((?:{{Icon\|\w+}}\s*)+)/i).test(wikitext)) {
						// "{{Icon|B}} '''{{Icon|A}} {{Icon|C}} [[title]]'''" →
						// "{{Icon|B}} {{Icon|A}} {{Icon|C}} '''[[title]]'''"
						_item.truncate();
						_item[0] = wikitext.replace(PATTERN, '$2$1');
					} else if ((PATTERN = /^([^']*)('{2,5}) *(\[\[[^\[\]]+\]\][^']*)$/).test(wikitext)) {
						// "{{Icon|C}} ''' [[title]]" →
						// "{{Icon|C}} '''[[title]]'''"
						_item.truncate();
						_item[0] = wikitext.replace(PATTERN, '$1$2$3$2');
					} else if ((PATTERN = /^([^"]*)" *(\[\[[^\[\]]+\]\]) *"/).test(wikitext)) {
						// `{{Icon|D}} " [[title]]"` →
						// `{{Icon|D}} [[title]]`
						_item.truncate();
						_item[0] = wikitext.replace(PATTERN, '$1$2');
					}
				}

				// Skip to next item.
				return true;
			}
		}

		if (section_text_to_title(item, index, list) || typeof item === 'string') {
			// e.g., ":Popes (3 articles)"
			return;
		}

		if (!item.some) {
			console.error(`No .some() @ ${list_page_data.title}: ${JSON.stringify(item)}`);
		}
		if ((item.type === 'link' ? for_item_token(item, index, list) : item.some(for_item_token)) && !item_replace_to) {
			return parsed.each.exit;
		}

		if (!item_replace_to) {
			CeL.error('No link! ' + list_page_data.title);
			console.trace(item);
		}
	}

	// e.g., [[Wikipedia:Vital articles/Level/4/People]]
	function section_text_to_title(token, index, parent) {
		// assert: token.type !== 'section_title'
		// console.log(token.toString());
		let wikitext = token.toString()
			// "''Pre-Schism (21 articles)''" → "Pre-Schism (21 articles)"
			.replace(/^'''?|'''?$/g, '');
		let next_wikitext;
		// console.log(wikitext + next_wikitext);
		if (PATTERN_counter_title.test(wikitext.trim())
			|| !parent.list_prefix && (next_wikitext = parent[index + 1] && parent[index + 1].toString()
				.replace(/^'''?|'''?$/g, ''))
			// ''Latin America'' (9 articles)
			&& PATTERN_counter_title.test((wikitext += next_wikitext).trim())) {
			// console.log(token);
			const level = '='.repeat(latest_section_title.level + 1);
			// The bot only update counter in section title. The counter will
			// update next time.
			parent[index] = `\n${level} ${wikitext.trim()} ${level}`;
			if (parent.list_prefix) {
				// remove list item prefix
				parent.list_prefix[index] = '';;
			} else if (next_wikitext) {
				parent[index + 1] = '';
			}
			return true;
		}
	}

	function for_root_token(token, index, root) {
		if (token.type === 'tag') {
			// e.g., the whole list is wrapped up with <div>.
			token = token[1];
			//console.trace(token.length);
			return Array.isArray(token) && token.some((sub_token, index, root) =>
				sub_token.type === 'plain' ? sub_token.forEach(for_root_token)
					: for_root_token(sub_token, index, root)
			);
		}

		if (token.type === 'transclusion' && token.name === 'Columns-list') {
			// [[Wikipedia:Vital articles/Level/5/Everyday life/Sports, games and recreation]]
			token = token.parameters[1];
			// console.log(token);
			return Array.isArray(token) && token.some(for_root_token);
		}

		if (token.type === 'list') {
			for_item(token, index, root);
			return;
		}

		if (token.type === 'section_title') {
			// for set_section_title_count()
			//token.index = token;

			//if (list_page_data.title.includes('Military personnel, revolutionaries, and activists')) console.log(token);
			// quit on "See also" section. e.g., [[Wikipedia:Vital articles]]
			return /See also/i.test(token[0].toString()) || set_latest_section_title(token);
		}

		section_text_to_title(token, index, root);
	}

	parsed.some(for_root_token);

	// -------------------------------------------------------

	function set_section_title_count(parent_section) {
		//if (!parent_section.page) console.log(parent_section);
		const item_count = parent_section.child_section_titles.reduce((item_count, subsection) => item_count + set_section_title_count(subsection), parent_section.item_count || 0);

		if (parent_section.type === 'section_title') {
			// $1: Target number
			parent_section[0] = parent_section.join('')
				.replace(PATTERN_count_mark, `(${item_count.toLocaleString()}$1 ${item_count === 1 ? 'article' : 'articles'})`);
			// console.log(parent_section[0]);
			parent_section.truncate(1);
		}

		return item_count;
	}

	//console.trace(list_page_data.title);
	const total_articles = `Total ${set_section_title_count(parsed).toLocaleString()} articles.`;
	this.summary += `: ${total_articles}`;
	//console.trace([list_page_data.title, this.summary]);

	// `Check redirects`
	if (!CeL.is_empty_object(need_check_redirected)) {
		const need_check_redirected_list = Object.keys(need_check_redirected);
		const fixed_list = [];
		CeL.info(`${CeL.wiki.title_link_of(list_page_data)}: Check ${need_check_redirected_list.length} link(s) for redirects.`);
		if (need_check_redirected_list.length < 9) {
			console.log(need_check_redirected_list);
			// console.trace(need_check_redirected_list);
		}
		await wiki.for_each_page(need_check_redirected_list, page_data => {
			const normalized_redirect_to = wiki.normalize_title(CeL.wiki.parse.redirect(page_data));
			if (!normalized_redirect_to
				// Need check if redirects to [[title#section]].
				// Skip [[Plaster of Paris]]:
				// #REDIRECT [[Plaster#Gypsum plaster]]
				|| normalized_redirect_to.includes('#')) {
				return;
			}

			// Fix redirect in the list page.
			const link_token = need_check_redirected[page_data.title];
			if (!link_token) {
				CeL.error(`${for_each_list_page.name}: No need_check_redirected[${page_data.title}]!`);
				console.log(page_data.wikitext);
				console.log(page_data);
			}
			fixed_list.push(link_token[0] + '→' + normalized_redirect_to);
			// 預防頁面被移動後被當作已失去資格，確保執行 check_page_count() 還是可以找到頁面資料。
			// TODO: 必須捨棄 catch。
			set_redirect_to(link_token[0], normalized_redirect_to);
			link_token[0] = normalized_redirect_to;
			simplify_link(link_token, normalized_redirect_to);
		}, { no_edit: true, no_warning: true, redirects: false });
		CeL.debug(`${CeL.wiki.title_link_of(list_page_data)}: ${fixed_list.length} link(s) fixed.`, 0, for_each_list_page.name);
		if (fixed_list.length > 0 && fixed_list.length < 9) {
			CeL.log(fixed_list.join('\n'));
		}
	}

	let wikitext = parsed.toString();
	if (wikitext !== list_page_data.wikitext) {
		// CeL.info(`${for_each_list_page.name}: Modify ${CeL.wiki.title_link_of(list_page_data)}`);
	}

	/**summary table / count report table for each page */
	const summary_table = [['Class', '#Articles']];
	sorted_keys_of_Object_by_order(article_count_of_icon, icon_order_Set).forEach(icon => {
		let category_name = icon_to_category[icon];
		if (category_name) {
			category_name = `[[:Category:${category_name}|${icon}]]`;
		} else if (category_name = wiki.get_featured_content_configurations()) {
			category_name = category_name.list_source;
			if (!category_name) {
				CeL.error(`Invalid featured_content_configurations of icon: ${icon}`);
			} else if (category_name = category_name[icon]) {
				if (typeof category_name === 'string')
					category_name = `[[:Category:${category_name}|${icon}]]`;
				else if (category_name && category_name.page)
					category_name = `[[${category_name.page}|${icon}]]`;
				else {
					CeL.error(`Invalid featured_content_configurations: ${JSON.stringify(category_name)}`);
					category_name = null;
				}
			}
		}
		summary_table.push([`{{Icon|${icon}}} ${category_name || (icon in icon_note ? `<span title="${icon_note[icon]}">${icon}</span>` : icon)}`, article_count_of_icon[icon].toLocaleString()]);
	});

	const report_Variable_Map = new CeL.wiki.Variable_Map();
	if (false && wikitext.includes('<!-- summary table begin')) {
		// old style 2023/11
		wikitext = wikitext.replace(/(<!-- summary table begin(?::[\s\S]+?)? -->)[\s\S]*?(<!-- summary table end(?::[\s\S]+?)? -->)/, `<!-- update summary table: The text between update comments will be automatically overwritten by the bot. -->\n${total_articles}\n` + CeL.wiki.array_to_table(summary_table, {
			'class': "wikitable sortable"
		}) + '\n<!-- update end: summary table -->');

	} else if (wiki.latest_task_configuration.general.pages_auto_add_summary_table && !CeL.wiki.Variable_Map.text_has_mark(wikitext, 'summary table') && wiki.latest_task_configuration.general.pages_auto_add_summary_table.test(list_page_data.title)) {
		wikitext = wikitext.replace(/(\n(==?)(?: *<span [^<>]+><\/span>)?[\w\s\-]+? \(\d+(?:\/\d+)? articles\) *\2)/, report_Variable_Map.format('summary table') + '\n$1');
	}

	//console.trace(`${list_page_data.title}: ${total_articles}`);
	// ~~~~~
	report_Variable_Map.set('summary table', '\n' + total_articles + '\n' + CeL.wiki.array_to_table(summary_table, {
		'class': "wikitable sortable"
	}) + '\n');
	wikitext = report_Variable_Map.update(wikitext, { force_change: true, remove_duplicates: ['summary table'] });

	// console.trace(`${for_each_list_page.name}: return ${wikitext.length} chars`);
	// console.log(wikitext);
	//console.trace('Skip edit ' + list_page_data.title);
	//return Wikiapi.skip_edit;
	return wikitext;
}

// ----------------------------------------------------------------------------

async function generate_all_VA_list_page() {
	const all_articles = Object.create(null);
	const all_level_1_to_4_articles = Object.create(null);
	const topic_hierarchy = Object.create(null);
	const VA_data_list_via_prefix = Object.create(null);

	for (const [page_title, article_info_list] of Object.entries(listed_article_info)) {
		const prefix = page_title.slice(0, 1);
		// assert: prefix.toUpperCase() === prefix
		const data_list_prefix = /^[A-Z]$/.test(prefix) ? prefix : 'others';
		if (!VA_data_list_via_prefix[data_list_prefix])
			VA_data_list_via_prefix[data_list_prefix] = Object.create(null);
		// assert: Array.isArray(article_info_list)
		VA_data_list_via_prefix[data_list_prefix][page_title] = article_info_list.map((article_info, index) => {
			article_info = Object.clone(article_info);

			if (!article_info.level)
				article_info.level = DEFAULT_LEVEL;

			// use [[Wikipedia:Vital articles/level/topic/sublist#section]]
			if (typeof article_info.detailed_level == 'string') {
				// e.g., 5/People/Scientists, inventors, and mathematicians
				const _topic_hierarchy = article_info.detailed_level.split('/');
				article_info.topic = _topic_hierarchy[1];
				if (_topic_hierarchy.length > 2) {
					article_info.sublist = _topic_hierarchy.slice(2).join('/');
				}
			} else {

			}

			// https://en.wikipedia.org/wiki/Wikipedia_talk:Vital_articles#Break_2
			// Level 1: I think section "Level 1 vital articles" is superfluous, could easily be removed
			if (article_info.level > 1 && article_info.link[1]) {
				article_info.section = article_info.link[1].replace(PATTERN_count_mark, '').trimEnd();
			}
			// 裁切過的連結 cf. detailed_level
			article_info.trimmed_link = article_info.link[0].replace(/^[^\/]+/, '') + (article_info.link[1] ? '#' + article_info.link[1] : '');
			delete article_info.link;

			// At levels 1 and 2, the topic is not needed to make the link, but it is needed to populate categories such as Category:Wikipedia vital articles in Philosophy.
			if (index === 0 && !article_info.topic) {
				for (let i = 1; i < article_info_list.length; i++) {
					if (article_info_list[i].topic) {
						article_info.topic = article_info_list[i].topic;
						break;
					}
				}
			}

			const topic = article_info.topic;
			if (topic) {
				if (!topic_hierarchy[topic]) {
					topic_hierarchy[topic] = {
						article_list: []
					};
				}
				let hierarchy = topic_hierarchy[topic];
				const sublist = article_info.sublist;
				if (sublist) {
					if (!hierarchy[sublist]) {
						hierarchy[sublist] = {
							article_list: []
						};
					}
					hierarchy = hierarchy[sublist];
				}
				if (!hierarchy.article_list.includes(page_title))
					hierarchy.article_list.push(page_title);
			} else if (article_info.level > DEFAULT_LEVEL) {
				if (!article_info.detailed_level) {
					CeL.error(`${generate_all_VA_list_page.name}: No topic and detailed_level: ${page_title} ${JSON.stringify(article_info)}`);
				} else if (!report_lines.warned_topics.has(article_info.detailed_level)) {
					report_lines.warned_topics.add(article_info.detailed_level);
					report_lines.push([page_title, article_info.detailed_level, `Please set the topic/subpage in [[User:Cewbot/log/20200122/configuration#Topics]].`]);
				}
			}

			// Use article_info.sublist
			delete article_info.subpage;
			// We already have article_info.sublist
			delete article_info.detailed_level;

			return article_info;
		})
		// 只取最高重要度的一篇文章。 https://en.wikipedia.org/w/index.php?title=Wikipedia_talk%3AVital_articles#List_of_vital_articles
		[0];

		if (!all_articles[prefix])
			all_articles[prefix] = [];
		all_articles[prefix].push(page_title);

		for (const article_info of article_info_list) {
			if (/^[1-4]/.test(article_info.level)) {
				if (!all_level_1_to_4_articles[prefix])
					all_level_1_to_4_articles[prefix] = [];
				all_level_1_to_4_articles[prefix].push(page_title);
				break;
			}
		}

	}

	try { await generate_list_page('List of all articles', all_articles); } catch { }
	try { await generate_list_page('List of all level 1–4 vital articles', all_level_1_to_4_articles); } catch { }

	const pages_to_edit = {
		// 生成階層 async function generate_hierarchy_json(topic_hierarchy)
		[`${base_page_prefix}/data/Topic hierarchy.json`]: [topic_hierarchy, `Update topic hierarchy of vital articles: ${Object.keys(topic_hierarchy).length} topics`],
	};
	for (const prefix in VA_data_list_via_prefix) {
		// async function generate_VA_list_json(prefix, VA_data_list_via_prefix)
		const VA_data_list = VA_data_list_via_prefix[prefix];
		pages_to_edit[`${base_page_prefix}/data/${prefix}.json`] = [VA_data_list, `Update list of vital articles: ${Object.keys(VA_data_list).length.toLocaleString()} article(s)`];
	}
	await wiki.for_each_page(Object.keys(pages_to_edit), function (page_data) {
		const data = pages_to_edit[page_data.title];
		if (!data) {
			CeL.error(`${generate_all_VA_list_page.name}: Cannot find data for ${page_data.title}!`);
			return Wikiapi.skip_edit;
		}
		this.summary = data[1];
		//console.trace('Skip edit ' + page_data.title);
		//return Wikiapi.skip_edit;
		return data[0];
	}, {
		bot: 1,
		summary: 'Update list of vital articles',
		skip_nochange: true,
	});
}

async function generate_list_page(page_name, article_hash) {
	let report_wikitext = [], count = 0;
	for (const prefix in article_hash) {
		const article_list = article_hash[prefix].sort();
		count += article_list.length;
		report_wikitext.push(`== ${prefix} ==\n(${article_list.length.toLocaleString()}) ${article_list.map(title => CeL.wiki.title_link_of(title)).join(' · ')}`);
	}
	report_wikitext = report_wikitext.join('\n\n');

	page_name = `${base_page_prefix}/${page_name}`;
	const page_data = await wiki.page(page_name);
	if (page_data.wikitext && page_data.wikitext.between(report_mark_start, report_mark_end) === report_wikitext) {
		// No new change
		return;
	}

	count = count.toLocaleString();
	// __NOINDEX__
	report_wikitext = `This page lists all '''[[${base_page_prefix}|Vital articles]]'''. It is used in order to show '''[[Special:RecentChangesLinked/${base_page_prefix}/List of all articles|recent changes]]'''. It is a temporary solution until [[phab:T117122]] is resolved.

The list contains ${count} articles. --~~~~`
		+ report_mark_start + report_wikitext + report_mark_end;
	await wiki.edit_page(page_name, report_wikitext, {
		bot: 1,
		summary: `Update list of vital articles: ${count} articles`,
		skip_nochange: true,
	});
}

// ----------------------------------------------------------------------------

function check_page_count() {
	for (const [page_title, category_level] of Object.entries(category_level_of_page)) {
		const article_info_list = listed_article_info[page_title];
		if (!article_info_list) {
			CeL.log(`${check_page_count.name}: ${CeL.wiki.title_link_of(page_title)}: Category level ${category_level} but not listed. Privious vital article?`);
			// pages that is not listed in the Wikipedia:Vital articles/Level/*
			have_to_edit_its_talk_page[page_title] = {
				// When an article is not listed {{Vital article}} should be removed, not just blanking the |level=.
				remove: true,
				level: '',
				reason: 'The article is NOT listed in any vital article list page.'
			};
			listed_article_info[page_title] = [];
			continue;
		}

		let min_level_info, min_level;
		const listed_level_array = article_info_list.map(article_info => {
			// level maybe `null`
			let level = article_info.level;
			level = typeof level === 'string' && /^[1-5]\//.test(level) ? +level.match(/^[1-5]/)[0] : level || DEFAULT_LEVEL;
			if (!min_level || level < min_level) {
				min_level = level;
				min_level_info = {
					...article_info,
					level,
					reason: `The article is listed in the level ${level} page`
				};
				// console.log(min_level_info);
			}
			return level;
		});
		if (min_level !== category_level) {
			if (1 <= min_level && min_level <= 5) {
				CeL.log(`${check_page_count.name}: ${CeL.wiki.title_link_of(page_title)}: level ${category_level}→${min_level}`);
				have_to_edit_its_talk_page[page_title] = min_level_info;
			} else {
				CeL.error(`${check_page_count.name}: Invalid level of ${CeL.wiki.title_link_of(page_title)}: ${JSON.stringify(article_info_list)}`);
			}
		}

		if (listed_level_array.length <= 3
			// report identifying articles that have been listed twice
			&& listed_level_array.length === listed_level_array.unique().length
			&& listed_level_array.some(level => level === category_level)) {
			delete listed_article_info[page_title];
			continue;
		}
	}

	for (const [page_title, article_info_list] of Object.entries(listed_article_info)) {
		if (article_info_list.length === 1) {
			continue;
		}
		if (false && article_info_list.length > 0) {
			// [contenttoobig] The content you supplied exceeds the article size
			// limit of 2048 kilobytes.
			report_lines.skipped_records++;
			continue;
		}
		if (article_info_list.length === 0) {
			report_lines.push([page_title, category_level_of_page[page_title],
				`${CeL.wiki.title_link_of(wiki.to_talk_page(page_title))} is listed in the ${CeL.wiki.title_link_of(wiki.to_namespace(vital_article_level_to_category(category_level_of_page[page_title]), 'Category'))}, but ${CeL.wiki.title_link_of(page_title)} is not in the level ${category_level_of_page[page_title]} VA listing page.`]);
			continue;
		}
		const article_info_of_level = [];
		//console.trace(article_info_list);
		// https://github.com/kanasimi/wikibot/issues/24
		// 在各級只列出一次的話應該沒有列出來的需要。
		if (!article_info_list.some(article_info => {
			const level = article_info.level || DEFAULT_LEVEL;
			if (article_info_of_level[level]) return true;
			article_info_of_level[level] = true;
		})) {
			continue;
		}
		report_lines.push([page_title, category_level_of_page[page_title],
			`Listed ${article_info_list.length} times in ${article_info_list.map(article_info => level_page_link(article_info.detailed_level || DEFAULT_LEVEL)).join(', ')}`]);
	}
}

// ----------------------------------------------------------------------------

const talk_page_summary_prefix_text = `Maintain vital articles and {{${WPBS_template_name}}}`;
let talk_page_summary_prefix = CeL.wiki.title_link_of(login_options.task_configuration_page, talk_page_summary_prefix_text);
//console.log(talk_page_summary_prefix);

async function maintain_VA_template() {
	// CeL.info('have_to_edit_its_talk_page: ');
	// console.log(have_to_edit_its_talk_page);

	// prevent creating talk page if main article redirects to another page. These pages will be listed in the report.
	// 警告：若缺少主 article，這會強制創建出 talk page。 We definitely do not need more orphaned talk pages
	try {
		await wiki.for_each_page(Object.keys(have_to_edit_its_talk_page).filter(title => {
			// the bot only fix namespace=talk.
			if (have_to_edit_its_talk_page[title].key_is_talk_page ? wiki.is_namespace(title, 'talk')
				: wiki.is_namespace(title, 'main')) {
				return true;
			}

			// e.g., [[Wikipedia:Vital articles/Vital portals level 4/Geography]]
			CeL.warn(`${maintain_VA_template.name}: Skip invalid namespace: ${CeL.wiki.title_link_of(title)} ${have_to_edit_its_talk_page[title].reason}`);
			//console.trace(have_to_edit_its_talk_page[title]);
			delete have_to_edit_its_talk_page[title];
			return false;
		}), function (main_page_data) {
			const main_article_exists = !CeL.wiki.parse.redirect(main_page_data) && main_page_data.wikitext;
			if (!main_article_exists) {
				delete have_to_edit_its_talk_page[main_page_data.original_title || main_page_data.title];
			}
		});
	} catch (e) {
	}

	let key_title_of_talk_title = Object.create(null);
	try {
		await wiki.for_each_page(Object.keys(have_to_edit_its_talk_page).map(title => {
			const talk_page = wiki.to_talk_page(title);
			// console.log(`${title}→${talk_page}`);
			key_title_of_talk_title[talk_page] = title;
			return talk_page;
		}), function (talk_page_data) {
			return maintain_VA_template_each_talk_page.call(this, talk_page_data, key_title_of_talk_title[talk_page_data.original_title || talk_page_data.title]);
		}, {
			// prevent [[Talk:Ziaur Rahman]] redirecting to [[Talk:Ziaur Rahman (disambiguation)]]
			//redirects: 1,

			// assert: The main article exists.
			nocreate: false,

			bot: 1,
			log_to: null,
			summary: talk_page_summary_prefix,
		});
	} catch (e) {
		// e.g., [[Talk:Chenla]]: [spamblacklist]
	}
}

let maintain_VA_template_count = 0;

// https://en.wikipedia.org/wiki/Template:WikiProject_Rugby_league/class
const class_alias_to_normalized = {
	Dab: 'Disambig', Disamb: 'Disambig', Disambiguation: 'Disambig',
};

// maintain vital articles templates: FA|FL|GA|List,
// add new {{Vital articles|class=unassessed}}
// or via {{WikiProject banner shell|class=}}, ({{WikiProject *|class=start}})
function maintain_VA_template_each_talk_page(talk_page_data, main_page_title) {
	// For [[Talk:Philippines]]
	//console.trace(wiki.FC_data_hash[main_page_title]);
	const article_info = have_to_edit_its_talk_page[main_page_title];

	// There are copies @ 20201008.fix_anchor.js
	// TODO: fix disambiguation

	if (CeL.wiki.parse.redirect(talk_page_data)) {
		// prevent [[Talk:Ziaur Rahman]] redirecting to [[Talk:Ziaur Rahman (disambiguation)]]
		// this kind of redirects will be skipped and listed in `wiki.latest_task_configuration.general.report_page` for manually fixing.
		// Warning: Should not go to here!
		CeL.warn(`${maintain_VA_template_each_talk_page.name}: ${CeL.wiki.title_link_of(talk_page_data)} redirecting to ${CeL.wiki.title_link_of(CeL.wiki.parse.redirect(talk_page_data))}`);
		//console.log(talk_page_data.wikitext);
		report_lines.push([main_page_title, article_info.level,
			`${CeL.wiki.title_link_of(talk_page_data)} redirecting to ${CeL.wiki.title_link_of(CeL.wiki.parse.redirect(talk_page_data))}`]);
		return Wikiapi.skip_edit;
	}

	// ------------------------------------------------------------------------

	// console.log(article_info);
	const parsed = talk_page_data.parse();
	CeL.assert([CeL.wiki.content_of(talk_page_data), parsed.toString()], 'wikitext parser check for ' + CeL.wiki.title_link_of(talk_page_data));
	let VA_template_token, WikiProject_banner_shell_token, is_DAB;
	/**class_from_other_templates_Map.get(class)===count */
	let class_from_other_templates_Map = new Map();

	function normalize_class(_class) {
		if (!_class)
			return _class;
		_class = String(_class).trim();
		//@see [[Category:Wikipedia vital articles by class]]
		// There is no class named "FFA"!
		_class = _class.length > 2 ? CeL.wiki.upper_case_initial(_class.toLowerCase()) : _class.toUpperCase();
		if (_class in class_alias_to_normalized) {
			_class = class_alias_to_normalized[_class];
		}
		return _class;
	}

	function add_class(class_via_parameter) {
		if (class_via_parameter) {
			class_via_parameter = normalize_class(class_via_parameter);
			if (class_from_other_templates_Map.has(class_via_parameter))
				class_from_other_templates_Map.set(class_via_parameter, class_from_other_templates_Map.get(class_via_parameter) + 1);
			else
				class_from_other_templates_Map.set(class_via_parameter, 1);
		}
	}

	parsed.each('template', token => {
		if (wiki.is_template(WPDAB_template_name, token)) {
			// TODO: should test main article
			is_DAB = true;
			return parsed.each.exit;
		}

		const class_via_parameter = normalize_class(token.parameters.class);
		if (wiki.is_template(VA_template_name, token)) {
			// get the first one
			if (VA_template_token) {
				CeL.error(`${maintain_VA_template_each_talk_page.name}: Find multiple {{${VA_template_name}}} in ${CeL.wiki.title_link_of(talk_page_data)}, keep only the first template!`);
				return parsed.each.remove_token;
			} else {
				VA_template_token = token;
			}
			if (article_info.remove) {
				return parsed.each.remove_token;
			}

		} else if (wiki.is_template(WPBS_template_name, token)) {
			if (WikiProject_banner_shell_token) {
				CeL.error(`${maintain_VA_template_each_talk_page.name}: Find multiple {{${WPBS_template_name}}} in ${CeL.wiki.title_link_of(talk_page_data)}!`);
			} else {
				WikiProject_banner_shell_token = token;
			}

			if (article_info.remove) {
				CeL.wiki.parse.replace_parameter(token, 'vital', CeL.wiki.parse.replace_parameter.KEY_remove_parameter);
			}

		} else if (wiki.is_template(all_WikiProject_template_list, token) && !wiki.is_template(all_opted_out_WikiProject_template_list, token) && class_via_parameter
			// e.g., {{WikiProject Africa}}, {{AfricaProject}}, {{maths rating}}
			//&& /project|rating/i.test(token.name)
		) {
			add_class(class_via_parameter);
		}
	});
	// console.log([class_from_other_templates, VA_template_token]);

	if (is_DAB) {
		CeL.warn(`${maintain_VA_template_each_talk_page.name}: Skip DAB article: ${CeL.wiki.title_link_of(talk_page_data)}`);
		return Wikiapi.skip_edit;
	}

	// new style from 2023/12:
	// merge [[Template:Vital article]] into [[Template:WikiProject banner shell]]
	if (VA_template_token
		// If there's a conflict in the ratings of the templates, keep {{Vital article}} first.
		&& (!WikiProject_banner_shell_token?.parameters.class || !VA_template_token?.parameters.class || WikiProject_banner_shell_token.parameters.class === VA_template_token.parameters.class)) {
		parsed.each('template', token => {
			if (wiki.is_template(VA_template_name, token)) {
				return parsed.each.remove_token;
			}
		});
	}

	// ------------------------------------------------------------------------

	const VA_class = normalize_class(article_info.class ?? VA_template_token?.parameters.class ?? '');
	// Vital article 的 class 也算一票，只添加一次。
	add_class(VA_class);
	/**Will preserve {{WikiProject *}} rating */
	let has_different_ratings = class_from_other_templates_Map.size > 1;
	// {{WikiProject banner shell|class=*}}
	add_class(WikiProject_banner_shell_token?.parameters.class);

	/**majority rating */
	let majority_class
		// Because {{VA}} would be eliminated, keep its class in {{WPBS}}.
		// @see [[Wikipedia:Bots/Requests for approval/Cewbot 12#Discussion]]
		= VA_class;
	if (!majority_class) {
		// Get the majority rating
		for (const [_class, count] of class_from_other_templates_Map) {
			if (!majority_class || count > majority_class[0]) {
				majority_class = [count, [_class]];
			} else if (count == majority_class[0]) {
				majority_class[1].push(_class);
			}
		}
		if (majority_class) {
			if (majority_class[1].length === 1) {
				majority_class = majority_class[1][0];
			} else if (has_different_ratings) {
				// assert: Should be ''
				majority_class = VA_class;
			} else {
				majority_class = '';
			}
		}
	}
	//console.trace([majority_class, has_different_ratings, class_from_other_templates_Map]);

	if (false) {
		// old style before 2023/12:
		let VA_template_object = {
			// normalize_class(): e.g., for [[Talk:Goosebumps]]
			class: normalize_class(VA_class ?? class_from_other_templates_Map ?? '')
		};
	}
	// console.trace([VA_template_token?.parameters, article_info, +VA_template_token?.parameters.level !== +article_info.level]);
	// old style before 2023/12:
	// 2022/6/21:	對於這三者，皆應以列表為主。若有誤應修改列表。
	if (false && (true
		|| !(VA_template_token?.parameters.level >= 1)
		// 高重要度層級的設定，應當覆蓋低重要度的。
		// 2022/6/21:	但假如此文章在列表中被降格，還是應該記錄。應該遵循、修改的是列表而非談話頁面上的模板。
		|| +VA_template_token?.parameters.level !== +article_info.level
		|| !VA_template_token?.parameters.topic && article_info.topic)) {
		for (const property of ['level', 'topic', 'subpage']) {
			if ((property in article_info)
				// 取最小 level 之設定，其他的不覆蓋原有值。
				// 2022/6/21:	但假如此文章在列表中被降格，還是應該記錄。應該遵循、修改的是列表而非談話頁面上的模板。
				//&& (+article_info.level <= + VA_template_token?.parameters.level || !VA_template_token?.parameters[property])
			) {
				VA_template_object[property] = article_info[property];
			}
		}
	}
	if (article_info.link) {
		// 關於link與anchor參數，一開始是因為機器人沒設定topic的方法。現在有方法了。
		// VA_template_object.link = article_info.link[0];
		if (article_info.link[1]) {
			// VA_template_object.anchor = article_info.link[1];
			article_info.reason += `: ${article_info.link}.`;
		} else {
			// level 1-3
			article_info.reason += `: ${article_info.link}.`;
		}
	}

	// console.trace(VA_template_object);
	// new style from 2023/12:
	if (false && VA_template_token) {
		CeL.wiki.parse.replace_parameter(VA_template_token, VA_template_object, { value_only: true, force_add: true, append_key_value: true });
		CeL.info(`${CeL.wiki.title_link_of(talk_page_data)}: ${VA_template_token.toString()}`);
		//console.trace([VA_template_object, VA_template_token]);
	}

	if (article_info.remove) {
		// Already processed above.
	} else {
		// uses the {{WikiProject banner shell}}
		// @see [[Wikipedia:Bots/Requests for approval/Qwerfjkl (bot) 26]]

		// new style from 2023/12: If the {{WikiProject banner shell}} does not exist, create one.
		let need_insert_WPBS = false;
		if (!WikiProject_banner_shell_token) {
			WikiProject_banner_shell_token = CeL.wiki.parse(CeL.wiki.parse.template_object_to_wikitext(WPBS_template_name));
			need_insert_WPBS = true;
		}

		if (majority_class && majority_class === VA_class)
			article_info.reason = (article_info.reason || '') + ` (keep the class of vital article: ${majority_class} in {{WPBS}})`;
		// new style from 2023/12:
		const WPBS_template_object = {
			class: majority_class || WikiProject_banner_shell_token.parameters.class,

			// old style before 2023/12:
			//'1': value => wikitext_to_add + '\n' + (value ? value.toString().trimStart() : ''),
		};
		if (article_info.do_PIQA ? VA_template_token : !article_info.remove)
			WPBS_template_object.vital = 'yes';

		// merge other {{WikiProject *}} into WikiProject_banner_shell_token
		if (true) {
			const WikiProject_templates = [];
			parsed.each('template', (token, index, parent) => {
				if (false && token === WikiProject_banner_shell_token) {
					console.trace(WikiProject_banner_shell_token[WikiProject_banner_shell_token.index_of[1]]);
					//return parsed.each.skip_inner;
				}
				// /^WikiProject /.test(token.name)
				if (wiki.is_template(all_WikiProject_template_list, token)) {
					if (!wiki.is_template(all_opted_out_WikiProject_template_list, token)) {
						if (wiki.is_template(WPBIO_template_name, token)) {
							//@see [[w:en:Template:WikiProject Biography]]
							const parameters_to_remove = [];
							if (CeL.wiki.Yesno(token.parameters.living || token.parameters.blp || token.parameters.BLP)) {
								// No overwrite
								if (!WikiProject_banner_shell_token.parameters.blp) {
									WPBS_template_object.blp = 'yes';
									parameters_to_remove.push('living', 'blp', 'BLP');
								}
								if (CeL.wiki.Yesno(token.parameters.activepol) && !WikiProject_banner_shell_token.parameters.activepol) {
									WPBS_template_object.activepol = 'yes';
									parameters_to_remove.push('activepol');
								}
							} else if (CeL.wiki.Yesno(token.parameters.blpo) && !WikiProject_banner_shell_token.parameters.blpo) {
								WPBS_template_object.blpo = 'yes';
								parameters_to_remove.push('blpo');
							}
							if (token.parameters.listas && !WikiProject_banner_shell_token.parameters.listas) {
								WPBS_template_object.listas = token.parameters.listas;
								parameters_to_remove.push('listas');
							}

							const parameters_argument = Object.create(null);
							parameters_to_remove.forEach(parameter => parameters_argument[parameter] = CeL.wiki.parse.replace_parameter.KEY_remove_parameter);
							// These parameters will move to {{WikiProject banner shell}}
							CeL.wiki.parse.replace_parameter(token, parameters_argument);
						}
						// move class rating from project banners
						if (!has_different_ratings || ('class' in token.parameters
							// remove |class=|
							&& !token.parameters.class.toString().trim())) {
							CeL.wiki.parse.replace_parameter(token, { class: CeL.wiki.parse.replace_parameter.KEY_remove_parameter });
						} else if (normalize_class(token.parameters.class) === WPBS_template_object.class) {
							CeL.wiki.parse.replace_parameter(token, { class: CeL.wiki.parse.replace_parameter.KEY_remove_parameter });
							const _reason = ' (Remove the same ratings as {{WPBS}} and keep only the dissimilar ones.)';
							if (!article_info.reason || !article_info.reason.includes(_reason))
								article_info.reason = (article_info.reason || '') + _reason;
						}

						// TODO: fix [[Category:WikiProject templates with unknown parameters]]
						// [[Wikipedia:Bots/Requests for approval/BattyBot 79]]

						// TODO: [[Wikipedia:Bots/Requests for approval/Qwerfjkl (bot) 24]]
					}

					WikiProject_templates.push(token);
					// Fix to the redirect target
					token[0] = wiki.remove_namespace(wiki.redirect_target_of(token));
					return parsed.each.remove_token;
				}
			});
			//console.trace(WikiProject_banner_shell_token[WikiProject_banner_shell_token.index_of[1]]);
			//console.trace(WikiProject_templates);
			if (WikiProject_templates.length > 0) {
				CeL.wiki.inplace_reparse_token(WikiProject_banner_shell_token, wiki.append_session_to_options());
				// adding to the bottom of the banner shell
				if (WikiProject_banner_shell_token.parameters[1]) {
					WikiProject_templates.unshift(WikiProject_banner_shell_token.parameters[1].toString().trim());
				}
				WPBS_template_object[1] = ('\n' + WikiProject_templates.join('\n') + '\n')
					// 去掉太多的換行。
					.replace(/\n{2,}/g, '\n');
				article_info.reason = WikiProject_templates.length + ' WikiProject template(s). ' + (article_info.reason || '');
			}
		}

		if (Object.keys(WPBS_template_object).length > 0) {
			//console.trace([WPBS_template_object, WikiProject_banner_shell_token[WikiProject_banner_shell_token.index_of[1]]]);
			CeL.wiki.parse.replace_parameter(WikiProject_banner_shell_token, WPBS_template_object, {
				value_only: true, force_add: true,
				// {{WikiProject banner shell|class=|vital=yes|1=\n...\n}}
				before_parameter: 1, no_value_space: true,
			});
		}

		// TODO: resort WikiProject_banner_shell_token
		// <s>可考慮插入於原 {{Vital article}} 處？</s>
		if (need_insert_WPBS) {
			CeL.info(`${CeL.wiki.title_link_of(talk_page_data)}: Add ${WikiProject_banner_shell_token.toString().trim()}`);
			// [[w:en:Wikipedia:Talk page layout#Lead (bannerspace)]]
			parsed.insert_layout_token(WikiProject_banner_shell_token);
		}
		//console.trace(WPBS_template_object, WikiProject_banner_shell_token, WikiProject_banner_shell_token.toString());
	}

	const wikitext = parsed.toString()
		// e.g., [[Talk:Fiscal policy]]
		.replace(/{{Suppress categories\s*\|\s*}}\n*/ig, '');
	// console.trace([talk_page_data.title, article_info, typeof VA_template_object !== 'undefined' && VA_template_object, wikitext.replace(/\n==[\s\S]+$/, ''), parsed.slice(0, 5)]);
	// return Wikiapi.skip_edit;

	if (false) {
		// for debug
		if (wikitext === talk_page_data.wikitext)
			return Wikiapi.skip_edit;
		if (++maintain_VA_template_count > 50)
			return Wikiapi.skip_edit;
		// console.log(wikitext);
	}
	this.summary = article_info.full_summary
		|| `${article_info.talk_page_summary_prefix || talk_page_summary_prefix}: ${article_info.reason || ''} ${article_info.no_topic_message ? ''
			: article_info.topic ? `Configured as topic=${article_info.topic}${article_info.subpage ? ', subpage=' + article_info.subpage : ''}`
				: article_info.remove ? ''
					: CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title + '#' + 'Topics', 'Config the topic of this page')}`;
	return wikitext;
}

// ----------------------------------------------------------------------------

const report_mark_start = '\n<!-- report begin -->\n';
const report_mark_end = '\n<!-- report end -->';

async function generate_report(options) {
	const records_limit = wiki.latest_task_configuration.general.records_limit || 100;
	if (report_lines.length > records_limit) {
		report_lines.skipped_records += report_lines.length - records_limit;
		report_lines.truncate(records_limit);
	}
	report_lines.forEach(record => {
		const page_title = record[0];
		record[0] = CeL.wiki.title_link_of(page_title);
		if (!record[1]) {
			record[1] = category_level_of_page[page_title];
		} else if (record[1].title) {
			record[1] = record[1].title;
			const matched = record[1].match(/Level\/([1-5](?:\/.+)?)$/);
			if (matched)
				record[1] = matched[1];
			else if (record[1] === default_base_page_prefix)
				record[1] = DEFAULT_LEVEL;
		}
		if (/^[1-5](?:\/.+)?$/.test(record[1])) {
			record[1] = level_page_link(record[1], true);
		}
	});

	const report_count = report_lines.length;
	let report_wikitext;
	if (report_count > 0) {
		report_lines.unshift(['Page title', 'Detailed level', 'Situation']);
		report_wikitext = CeL.wiki.array_to_table(report_lines, {
			'class': "wikitable sortable"
		});
		if (!CeL.is_empty_object(have_to_edit_its_talk_page))
			report_wikitext = `* ${Object.keys(have_to_edit_its_talk_page).length} talk pages to edit${options.no_editing_of_talk_pages ? ' (The amount of talk pages to edit exceeds the value of talk_page_limit_for_editing on the configuration page. Do not edit the talk pages at all.)' : ''}.\n` + report_wikitext;
		if (report_lines.skipped_records > 0)
			report_wikitext = `* Skip ${report_lines.skipped_records.toLocaleString()} records.\n` + report_wikitext;
	} else {
		report_wikitext = "* '''So good, no news!'''";
	}

	// [[WP:DBR]]: 使用<onlyinclude>包裹更新時間戳。
	// __NOTITLECONVERT__
	report_wikitext = `__NOCONTENTCONVERT__
* Configuration: ${CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title)}
* The report will update automatically.
* If the category level different to the level listed<ref name="c">Category level is different to the level article listed in.</ref>, maybe the article is redirected<ref name="e">Redirected or no level assigned in talk page. Please fix this issue manually.</ref>.
* Generate date: <onlyinclude>~~~~~</onlyinclude>
${report_mark_start}${report_wikitext}${report_mark_end}
[[Category:Wikipedia vital articles]]`;

	await wiki.edit_page(wiki.latest_task_configuration.general.report_page,
		report_wikitext, {
		bot: 1,
		nocreate: 1,
		summary: `${CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title, `Vital articles update report`)}: ${report_count + (report_lines.skipped_records > 0 ? '+' + report_lines.skipped_records : '')} record(s)`
	});
}
