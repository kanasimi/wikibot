/*

node 20200122.update_vital_articles.js use_language=en
node 20200122.update_vital_articles.js use_language=en using_cache
node 20200122.update_vital_articles.js use_language=en skip_vital do_PIQA=1000000 forced_edit
node 20200122.update_vital_articles.js use_language=en skip_vital "do_PIQA=Talk:" "category_to_clean="
node 20200122.update_vital_articles.js use_language=en skip_vital "do_PIQA=Talk:Design justice"
node 20200122.update_vital_articles.js use_language=en skip_vital "do_PIQA=Talk:2016 shooting of Dallas police officers"


node 20200122.update_vital_articles.js use_language=zh
node 20200122.update_vital_articles.js use_language=zh do_PIQA=1000000 forced_edit
Deprecated:
node 20200122.update_vital_articles.js use_language=en "base_page=Wikipedia:Vital people"


toolforge jobs delete k8s-20200122.update-vital-articles.en.piqa
toolforge-jobs run k8s-20200122.update-vital-articles.en.piqa --image node18 --mem 4Gi --continuous --command "node ./wikibot/routine/20200122.update_vital_articles.js use_language=en do_PIQA=1000000"


2020/1/23 14:24:58	初版試營運	Update the section counts and article assessment icons for all levels of [[Wikipedia:Vital articles]].
2020/2/7 7:12:28	於 Wikimedia Toolforge 執行需要耗費30分鐘，大部分都耗在 for_each_list_page()。

對話頁上的模板內容會在最後才取得。因此假如要靠對話頁上的模板更改屬性，就不能夠一次做到好。

TODO:
將判斷條目的屬性與品質寫成泛用功能
report level/class change
realigning {{WPBS}}
use [[w:en:Module:Class/definition.json]]
fix [[Category:有不必要class參數的專題橫幅]]: {{德国专题 |1=B |2=low}}
條目位於[[Category:身亡者]]則去掉blp=y或living參數。
如果listas參數為空，添加條目的DEFAULTSORT。
[[User talk:Kanashimi#Merging banners]]

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
//set_language('zh');
/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

const using_cache = CeL.env.arg_hash?.using_cache;

const do_PIQA = CeL.env.arg_hash?.do_PIQA
	&& (CeL.env.arg_hash.do_PIQA >= 1 ? CeL.env.arg_hash.do_PIQA : CeL.env.arg_hash.do_PIQA.split('|'));

if (do_PIQA) {
	if (wiki.site_name() === 'zhwiki') {
		// Only respect maxlag. 因為數量太多，只好增快速度。
		CeL.wiki.query.default_edit_time_interval = 0;
	} else if (wiki.site_name() === 'enwiki') {
		// [[w:en:WP:BOTPERF]]
		CeL.wiki.query.default_edit_time_interval = 3 * 1000;
	}
}
//console.trace(do_PIQA);

// ----------------------------------------------

const start_time = Date.now();

if (using_cache
	// 不再採用這方法。
	// || do_PIQA
) {
	prepare_directory(base_directory);
}

// badge
const page_info_cache_file = `${base_directory}/articles attributes.json`;
const page_info_cache = using_cache && CeL.get_JSON(page_info_cache_file);

// 不再採用這方法。
//const do_PIQA_status_file = `${base_directory}/PIQA_status_file.json`;

/** {Object}icons_of_page[title]=[icons] */
const icons_of_page = page_info_cache?.icons_of_page || Object.create(null);
/** {Object}level of page get from list page. icons_of_page[title]=1–5 */
const list_page_level_of_page = page_info_cache?.list_page_level_of_page || Object.create(null);
/** {Object}level of page get from category. icons_of_page[title]=1–5 */
const category_level_of_page = page_info_cache?.category_level_of_page || Object.create(null);
/** {Array}list of WikiProject templates */
const all_WikiProject_template_list = page_info_cache?.all_WikiProject_template_list || [];
/** {Array}list of opted out WikiProject templates 自定義評級 */
const all_opted_out_WikiProject_template_list = page_info_cache?.all_opted_out_WikiProject_template_list || [];
/** {Object}listed_article_info[title]=[{level,topic},{level,topic},...] */
const listed_article_info = Object.create(null);
/**
 * 必須編輯其談話頁面。
 * {Object}have_to_edit_its_talk_page[main page title needing to edit cital article infomation in the talk page] = {level,topic}
 */
const have_to_edit_its_talk_page = Object.create(null);

const WPBS_syntax_error_pages = [];
// page_title => Template:WikiProject
const non_WikiProject_in_WPBS = new Map();

const template_name_hash = {
	WPBS: 'WikiProject banner shell',
	WPDAB: 'WikiProject Disambiguation',
	WPBIO: 'WikiProject Biography',
	VA: 'Vital article',
	VA_count: 'Vital article count',
};

// [[w:en:User talk:Kanashimi#Move listas]]
const parameters_move_from_any_WikiProjects_to_WPBS = {
	listas: '',
	// [[w:en:User talk:Kanashimi#Two changes please to class and BLP]]
	// Move |class=FM from any banners into the banner shell
	class: { value_filter: /^FM$/ },
};
const parameters_move_from_WikiProjects_to_WPBS = {
	// parameters_move_from_specified_WikiProject_to_WPBS
	// [[w:en:Template:WikiProject Biography]]
	'WikiProject Biography': {
		living: {
			value_normalizer: 'Yesno',
			// [[w:en:User talk:Kanashimi#Two changes please to class and BLP]]
			// Use |blp= instead of |living=.
			move_to_parameter_name: 'blp',
		},
		blp: { value_normalizer: 'Yesno' },
		BLP: { value_normalizer: 'Yesno', move_to_parameter_name: 'blp', },
		activepol: {
			value_normalizer: 'Yesno', token_modifier({ parameter_name_to_remove, value, token, WPBS_template_object }) {
				if (typeof CeL.wiki.Yesno(value) === 'boolean') {
					WPBS_template_object.blp = 'activepol';
					return true;
				}
			},
		},
		blpo: {
			value_normalizer: 'Yesno', token_modifier({ parameter_name_to_remove, value, token, WPBS_template_object }) {
				if (typeof CeL.wiki.Yesno(value) === 'boolean') {
					if (CeL.wiki.Yesno(value)) {
						// [[w:en:User talk:Kanashimi#Two changes please to class and BLP]]
						// |blp=yes should supersede |blp=other.
					} else {
						WPBS_template_object.blp = 'other';
					}
					return true;
				}
			},
		},
		// 'listas' is at `parameters_move_from_any_WikiProjects_to_WPBS`
		//listas: '',
	},
	// [[w:en:User talk:Kanashimi#Moving listas value]]
	'WikiProject U.S. Roads': { sort: 'listas' },
};
let parameters_move_from_WikiProjects_to_WPBS__template_list;

/**可安全移除的任無用的參數值字元。 @see [[w:en:User talk:Qwerfjkl#Disruptions caused by the Qwerfjkl bot]] */
const PATTERN_invalid_parameter_value_to_remove = /(?<=[^{}]|^)[{}](?=[^{}]|$)/g;
CeL.assert(['no', 'no}'.replace(PATTERN_invalid_parameter_value_to_remove, '')]);

// [[Wikipedia:Vital articles/Level/3]] redirect to→ `wiki.latest_task_configuration.general.base_page`
const DEFAULT_LEVEL = 3;
// assert: DEFAULT_LEVEL | 0 === DEFAULT_LEVEL

// @see function set_section_title_count(parent_section)
// [ all, quota+articles postfix, quota / target number ]
const PATTERN_count_mark = /\([\d,]+(\/([\d,]+))?\s+articles?\)/i;
const PATTERN_counter_title = new RegExp(/^[\w\s\-–',\/]+MARK$/.source.replace('MARK', PATTERN_count_mark.source), 'i');

const report_lines = [];
report_lines.skipped_records = 0;
/**{Set}已經警告過的topics */
report_lines.warned_topics = new Set;

/** {Object}代表圖示的分類。將從這些分類取得文章的圖示資訊。 icons_schema[icon] = { data } */
let icons_schema;
let icon_order_Set, icon_order_Map;

/** {Object}deprecated_parameter_hash[template_to_fix] = {parameter_to_remove:value} */
let deprecated_parameter_hash, template_list_of_deprecated_parameters;

// start from 1
let max_VA_level = 1;

// ----------------------------------------------

/** others. 其他 icons_schema 沒設定的 */
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

	if (extra_icons) {
		icon_order.append(extra_icons);
	}

	return icon_order;
}

// ----------------------------------------------


function parse_remove_unnecessary_parameters(general, variable_name) {
	function normalize_pattern(pattern) {
		// '{{!}}' → '|'
		pattern = CeL.wiki.wikitext_to_plain_text(pattern);
		// const PATTERN_is_RegExp
		if (/[\^\[\\\]*]/.test(pattern)) {
			pattern = pattern.to_RegExp();
		}
		return pattern;
	}

	//console.trace(general[variable_name]);
	if (CeL.is_Object(general[variable_name])) {
		const remove_unnecessary_parameters = Object.create(null);
		for (let [namespace, value_list] of Object.entries(general[variable_name])) {
			namespace = wiki.namespace(namespace, { get_name: true });
			if (!namespace)
				continue;
			value_list.forEach(value => {
				value = CeL.wiki.parser(value).parse();
				const parameter_Map = remove_unnecessary_parameters[namespace] || (remove_unnecessary_parameters[namespace] = new Map);
				value.each('Template:Para', template_token => {
					let key = template_token.parameters[1], value = template_token.parameters[2];
					// TODO: value === undefined
					if (!key) return;
					key = normalize_pattern(key);
					value = normalize_pattern(value);
					//console.trace([namespace, key, value]);
					if (parameter_Map.has(key)) {
						CeL.error(`${variable_name}: ${namespace}: 重複設定 ${key}`);
					}
					parameter_Map.set(key, value);
				});
				if (parameter_Map.size === 0)
					delete remove_unnecessary_parameters[namespace];
			});
		}

		if (CeL.is_empty_object(remove_unnecessary_parameters)) {
			delete general[variable_name];
		} else {
			//console.trace(remove_unnecessary_parameters);
			general[variable_name] = remove_unnecessary_parameters;
		}
	} else {
		delete general[variable_name];
	}
}



function get_topic_of_section(page_title_and_section, topic) {
	//console.trace([page_title_and_section, level, topic]);
	const page_title_and_section_data = parse_page_title_and_section(page_title_and_section);

	if (topic && topic !== page_title_and_section_data.topic) {
		CeL.warn(`${get_topic_of_section.name}: Different topic of ${JSON.stringify(page_title_and_section)}: ${JSON.stringify(topic)} vs. ${JSON.stringify(page_title_and_section_data.topic)}`);
	}

	topic = {
		//level: page_title_and_section_data.numeric_level,
		topic: page_title_and_section_data.topic,
	};

	// cf. sublist
	if (page_title_and_section_data.subpage)
		topic.subpage = page_title_and_section_data.subpage;

	const { page_title_and_section_id } = page_title_and_section_data;
	const Topics = wiki.latest_task_configuration.Topics;
	if (!Topics[page_title_and_section_id]) {
		delete Topics[page_title_and_section];
		Topics[page_title_and_section_id] = topic;
	} else if (page_title_and_section_id === page_title_and_section) {
		// `page_title_and_section` is page title and section id
		Topics[page_title_and_section_id] = topic;
	} else {
		CeL.warn(`${get_topic_of_section.name}: Duplicated topic configuration! ${page_title_and_section_id} ≠ ${page_title_and_section}`);
	}
	//console.trace([page_title_and_section, page_title_and_section_id, Topics[page_title_and_section_id]]);
	return Topics[page_title_and_section_id];
}

/**
 * 由設定頁面讀入手動設定 manual settings。
 * 
 * @param {Object}latest_task_configuration
 *            最新的任務設定。
 */
async function adapt_configuration(latest_task_configuration) {
	// console.log(latest_task_configuration.general);

	// ----------------------------------------------------

	const general = latest_task_configuration.general || (latest_task_configuration.general = Object.create(null));

	if (CeL.env.arg_hash?.base_page) {
		// 自訂基準頁面。
		general.base_page = CeL.env.arg_hash.base_page;
		general.customized_base_page = true;
	} else if (general.additional_base_pages) {
		general.additional_base_pages_Set = new Set(Array.isArray(general.additional_base_pages) ? general.additional_base_pages.filter(base_page => !!base_page) : [general.additional_base_pages]);
		if (general.additional_base_pages_Set.size === 0) {
			delete general.additional_base_pages;
			delete general.additional_base_pages_Set;
		} else {
			// general.additional_base_page_Map[list page] = 'base page'
			general.additional_base_page_Map = new Map();
		}
	}
	general.base_page = wiki.normalize_title(general.base_page.replace(/\/+$/, ''));

	if (false && general.report_page) {
		// 現在多方位，不純粹以 vital article 為主。
		talk_page_summary_prefix = CeL.wiki.title_link_of(general.report_page, talk_page_summary_prefix_text);
	}

	if (general.pages_auto_add_summary_table && !CeL.is_RegExp(general.pages_auto_add_summary_table = general.pages_auto_add_summary_table.to_RegExp())) {
		CeL.error(`${adapt_configuration.name}: Invalid RegExp (pages_auto_add_summary_table): ${general.pages_auto_add_summary_table}`);
		delete general.pages_auto_add_summary_table;
	}

	//console.trace(general.icons_schema);
	// reset
	icons_schema = Object.create(null);
	const icon_order = [];
	for (let item of general.icons_schema) {
		if (typeof item !== 'string') {
			// 設定檔壞了？放棄任務。
			throw new Error('Invalid icons_schema: ' + item);
			CeL.error('Invalid icons_schema: ' + item);
			continue;
		}
		if (item === KEY_extra_items) {
			icon_order.push(item);
			continue;
		}
		item = CeL.wiki.parse(item);
		let icon, category_name, icon_index;
		CeL.wiki.parser.parser_prototype.each.call(item, (token, index, parent) => {
			if (token.type === 'link') {
				const link = wiki.normalize_title(token[0].toString());
				if (wiki.is_namespace(link, 'category'))
					category_name = wiki.remove_namespace(link);
			} else if (token.type === 'transclusion' && wiki.is_template('Icon', token)) {
				//icon = normalize_class(token.parameters[1]);
				icon = token.parameters[1].toString().trim();
				icon_index = [index + 1, parent];
			}
		});
		if (icon) {
			icon_order.push(icon);
			if (category_name) {
				icons_schema[icon] = { category_name };
			} else {
				// There is no category of the icons now, preserve the icon.
				// @see [[Module:Article history/config]], [[Template:Icon]]
				const note = icon_index[1].slice(icon_index[0]).join('').trim();
				if (note) icons_schema[icon] = { note };
			}
		} else {
			CeL.error('Invalid icons_schema: ' + item);
		}
	}

	if (icon_order.length > 0) {
		icon_order_Map = new Map();
		icon_order.forEach((icon, order) => icon_order_Map.set(icon, order));
		icon_order_Set = new Set(icon_order);
	} else {
		icon_order_Set = icon_order_Map = null;
	}
	//console.trace({ icons_schema, icon_order, icon_order_Set, icon_order_Map });

	// ----------------------------------------------------

	// 僅允許 [[Wikipedia:Content assessment#Grades]]
	const standard_grades = general.standard_grades?.split('|') || Object.keys(icons_schema);
	for (const icon of standard_grades) {
		standard_class_Set.add(normalize_class(icon));
	}
	//console.trace(standard_class_Set);

	// ----------------------------------------------------

	if (CeL.is_Object(general.PIQA_page_filter)) {
		Object.keys(general.PIQA_page_filter).forEach(namespace => {
			const list = general.PIQA_page_filter[namespace];
			if (!Array.isArray(list) || list.length !== 1 || !list[0] || typeof list[0] !== 'string') {
				CeL.error(`${adapt_configuration.name}: Skip invalid PIQA_page_filter: ` + list);
				delete general.PIQA_page_filter[namespace];
				return;
			}
			general.PIQA_page_filter[namespace] = list[0].to_RegExp();
		});
	} else {
		delete general.PIQA_page_filter;
	}

	// ----------------------------------------------------

	let { deprecated_parameters } = general;
	if (deprecated_parameters) {
		deprecated_parameter_hash = Object.create(null);
		deprecated_parameters = CeL.wiki.parser(deprecated_parameters.toString()).parse();
		deprecated_parameters.each('template', template_token => {
			if (!/^Tl/.test(template_token.name))
				return;
			const template_to_fix = template_token.parameters[1];
			if (!template_to_fix)
				return;
			deprecated_parameter_hash[template_to_fix] = Object.create(null);
			for (const parameter_name in template_token.parameters) {
				if (parameter_name == 1)
					continue;
				if (CeL.is_digits(parameter_name)) {
					// 只要有這個參數就移除。
					deprecated_parameter_hash[template_to_fix][template_token.parameters[parameter_name]] = CeL.wiki.parse.replace_parameter.KEY_remove_parameter;
				} else {
					// 僅移除特定值。
					deprecated_parameter_hash[template_to_fix][parameter_name] = template_token.parameters[parameter_name];
				}
			}
		});

		await wiki.register_redirects(Object.keys(deprecated_parameter_hash), { namespace: 'Template', no_message: true });
		for (const template_to_fix in deprecated_parameter_hash) {
			const normalized_template_name = wiki.remove_namespace(wiki.redirect_target_of(template_to_fix, { namespace: 'Template' }));
			if (normalized_template_name === template_to_fix)
				continue;
			if (deprecated_parameter_hash[normalized_template_name]) {
				CeL.error(`deprecated_parameters 重複設定模板名稱: ${template_to_fix}===${normalized_template_name}`);
				Object.assign(deprecated_parameter_hash[normalized_template_name], deprecated_parameter_hash[template_to_fix]);
			} else {
				deprecated_parameter_hash[normalized_template_name] = deprecated_parameter_hash[template_to_fix];
			}
			delete deprecated_parameter_hash[template_to_fix];
		}

		template_list_of_deprecated_parameters = Object.keys(deprecated_parameter_hash);
		if (template_list_of_deprecated_parameters.length === 0) {
			template_list_of_deprecated_parameters = deprecated_parameter_hash = null;
		}

		//console.trace('deprecated_parameter_hash:', deprecated_parameter_hash);
	}

	parse_remove_unnecessary_parameters(general, 'remove_unnecessary_WPBS_parameters');

	parse_remove_unnecessary_parameters(general, 'remove_unnecessary_WP_parameters');

	//console.trace(general.replace_misspelled_parameter_name);
	if (general.replace_misspelled_parameter_name) {
		if (!Array.isArray(general.replace_misspelled_parameter_name))
			general.replace_misspelled_parameter_name = [general.replace_misspelled_parameter_name];
		const pattern_list = [];
		for (const pattern of general.replace_misspelled_parameter_name) {
			const pattern_RegExp = pattern.to_RegExp({ allow_replacement: true });
			if (CeL.is_RegExp(pattern_RegExp)) {
				pattern_list.push(pattern_RegExp);
			} else {
				CeL.error(`${adapt_configuration.name}: Invalid RegExp (replace_misspelled_parameter_name): ${pattern}`);
			}
		}
		if (pattern_list.length > 0) {
			general.replace_misspelled_parameter_name = pattern_list;
			//console.trace('replace_misspelled_parameter_name:', general.replace_misspelled_parameter_name);
		} else {
			delete general.replace_misspelled_parameter_name;
		}
	}

	// ----------------------------------------------------

	if (general.preserve_template_name_in_WPBS) {
		general.preserve_template_name_in_WPBS = general.preserve_template_name_in_WPBS.to_RegExp();
		if (!CeL.is_RegExp(general.preserve_template_name_in_WPBS)) {
			CeL.error(`${adapt_configuration.name}: Invalid RegExp (preserve_template_name_in_WPBS): ${general.preserve_template_name_in_WPBS}`);
		}
	}

	// ----------------------------------------------------

	const { Topics } = latest_task_configuration;
	if (Topics && !CeL.is_empty_object(Topics)) {
		for (let [page_title_and_section, topic] of Object.entries(Topics)) {
			get_topic_of_section(page_title_and_section, topic);
		}
	} else {
		// Initialization
		latest_task_configuration.Topics = Object.create(null);
		latest_task_configuration.no_topic_summary = true;
	}

	console.log(latest_task_configuration);
}

// ----------------------------------------------------------------------------

// IIFE
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

	parameters_move_from_WikiProjects_to_WPBS__template_list = wiki.to_namespace(Object.keys(parameters_move_from_WikiProjects_to_WPBS), 'template');

	CeL.log_temporary(`Get all redirects. Elapsed time: ${CeL.date.age_of(start_time)}`);
	// all_WikiProject_template_list includes template_name_hash.WPBIO
	await wiki.register_redirects(['Template:Para', wiki.latest_task_configuration.general.base_page]
		.append(all_WikiProject_template_list)
		.append(all_opted_out_WikiProject_template_list)
		.append(wiki.append_session_to_options().session.setup_layout_elements.template_order_of_layout[wiki.site_name()]?.talk_page_lead)
		.append(Object.keys(parameters_move_from_WikiProjects_to_WPBS)), { namespace: 'Template', no_message: true });

	parameters_move_from_WikiProjects_to_WPBS__template_list = wiki.redirect_target_of(parameters_move_from_WikiProjects_to_WPBS__template_list);
	//console.trace(parameters_move_from_WikiProjects_to_WPBS__template_list);

	await wiki.register_redirects(template_name_hash, { namespace: 'Template', no_message: true, update_page_name_hash: true });
	console.log('Redirect targets:', template_name_hash);
	{
		const values = Object.values(template_name_hash);
		if (values.length !== values.unique().length) {
			const message = '有些關鍵模板重定向到了相同的標的，無法繼續執行！';
			CeL.error(message);
			throw new Error(message);
		}
	}

	// ----------------------------------------------------

	if (wiki.site_name() === 'zhwiki') {
		const page_data = await wiki.page('Module:Class/data');
		const object = CeL.wiki.parse.lua_object(page_data.wikitext);

		for (const class_data of Object.values(object)) {
			if (!class_data.code) {
				CeL.error(`Invalid class_data: ${JSON.stringify(class_data)}`);
				continue;
			}
			const normalized_class = normalize_class(class_data.code);
			add_class_alias(class_data.name, normalized_class);
			add_class_alias(class_data.name2, normalized_class);
			if (Array.isArray(class_data.alias)) class_data.alias.forEach(class_name => {
				add_class_alias(class_name, normalized_class);
			});
		}
	}

	// ----------------------------------------------------

	function to_title(page_data) {
		const page_title = page_data.title || page_data;
		//console.log([page_title, page_title === wiki.latest_task_configuration.general.base_page ? level_to_page_title(DEFAULT_LEVEL, true) : '']);
		if (!page_title || page_title === wiki.latest_task_configuration.general.base_page)
			return level_to_page_title(DEFAULT_LEVEL, true);
		return page_title;
	}

	const vital_articles_list = (await (async () => {
		const list = await wiki.prefixsearch(wiki.latest_task_configuration.general.base_page);
		//console.trace([wiki.latest_task_configuration.general.base_page, list.length, list.map(page_data => page_data.title).join('\n')]);
		const additional_base_pages_Set = wiki.latest_task_configuration.general.additional_base_pages_Set;
		if (additional_base_pages_Set) {
			for (const additional_base_page of additional_base_pages_Set) {
				const additional_list = (await wiki.prefixsearch(additional_base_page))
					.filter(list_page_data => {
						if (list_page_data.title.startsWith(additional_base_page)) {
							// Useless.
							//list_page_data.base_page = additional_base_page;
							wiki.latest_task_configuration.general.additional_base_page_Map.set(list_page_data.title, additional_base_page);
							return true;
						}
						CeL.warn(`list page NOT starts with additional_base_page ${CeL.wiki.title_link_of(additional_base_page)}: ${CeL.wiki.title_link_of(list_page_data)}`);
					});
				list.append(additional_list);
			}
		}
		return list;
	})() || [
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
		.filter(list_page => {
			const page_title = to_title(list_page);
			if (/\.json$/i.test(page_title))
				return false;

			const level = level_of_page_title(page_title, true);
			if (level > 0) {
				list_page.VA_level = level;
				if (max_VA_level < level)
					max_VA_level = level;
			}
			return true;
		});

	// assert: vital_articles_list 標題應該已按照高重要度 → 低重要度的級別排序。
	//console.trace(vital_articles_list.map(list_page => to_title).join('\n'));

	//console.log(vital_articles_list.length);
	//console.log(vital_articles_list.map(page_data => page_data.title));

	let no_editing_of_talk_pages;

	if (!CeL.env.arg_hash?.skip_vital) {
		CeL.log_temporary(`Process all vital articles list. Elapsed time: ${CeL.date.age_of(start_time)}`);

		function level_of_page_title_for_sort(page_data) {
			return page_data.VA_level || level_of_page_title(page_data, true) || max_VA_level + 1;
		}
		//console.trace(vital_articles_list.length, vital_articles_list.map(page_data => { return [page_data.title, level_of_page_title_for_sort(page_data)]; }));

		await wiki.for_each_page(vital_articles_list, for_each_list_page, {
			// prevent [[Talk:Ziaur Rahman]] redirecting to [[Talk:Ziaur Rahman (disambiguation)]]
			//redirects: 1,
			bot: 1,
			minor: false,
			log_to: null,
			multi: 'keep order',
			skip_nochange: true,
			// 高重要度必須排前面，保證處理低重要度的基礎條目列表時已知高重要度有那些文章，能 level_page_link()。
			sort_function(page_data_1, page_data_2) {
				const level_1 = level_of_page_title_for_sort(page_data_1);
				const level_2 = level_of_page_title_for_sort(page_data_2);
				//console.log('sort_function: level', [level_1, page_data_1.title, level_2, page_data_2.title]);
				if (level_1 > 0 && level_2 > 0 && level_1 !== level_2)
					return level_1 - level_2;

				const page_title_1 = to_title(page_data_1);
				const page_title_2 = to_title(page_data_2);
				//console.log('title', [page_title_1, page_data_1, page_title_2, page_data_2]);
				// assert: to_title(page_data_1) !== to_title(page_data_2)
				return page_title_1 < page_title_2 ? -1 : 1;
			},
			summary: CeL.wiki.title_link_of(wiki.latest_task_configuration.general.report_page || wiki.latest_task_configuration.configuration_page_title,
				// 圖標
				// gettext_config:{"id":"update-section-counters-and-article-assessment-icons"}
				CeL.gettext('Update section counters and article assessment icons'))
		});

		if (wiki.latest_task_configuration.general.customized_base_page) {
			CeL.info(`Customized base page ${CeL.wiki.title_link_of(wiki.latest_task_configuration.general.base_page)}: list pages generated.`);
			return;
		}

		// ----------------------------------------------------

		if (wiki.latest_task_configuration.general.category_of_non_vital_articles_to_cleanup) {
			const page_list = await wiki.categorymembers(wiki.latest_task_configuration.general.category_of_non_vital_articles_to_cleanup, {
				// exclude [[User:Fox News Brasil]]
				namespace: 'talk'
			});
			page_list.forEach(talk_page_data => {
				const talk_page_title = talk_page_data.original_title || talk_page_data.title;
				if (wiki.remove_namespace(talk_page_title) in listed_article_info) {
					// 登記在案的不該消除。
					return;
				}
				have_to_edit_its_talk_page[talk_page_title] = {
					reason: `The article is [[${wiki.latest_task_configuration.general.category_of_non_vital_articles_to_cleanup}|no longer a vital article]].`,
					remove_vital_parameter: true,
					no_topic_message: true,
					do_PIQA: true,
					key_is_talk_page: true,
				};
			});
		}

		// ----------------------------------------------------

		await generate_all_VA_list_page();

		check_page_count();

		if (wiki.latest_task_configuration.general.modify_talk_pages) {
			const talk_pages_to_edit = Object.keys(have_to_edit_its_talk_page).length;
			if (talk_pages_to_edit > wiki.latest_task_configuration.general.talk_page_limit_for_editing
				//&& !do_PIQA
				&& !CeL.env.arg_hash?.forced_edit) {
				no_editing_of_talk_pages = true;
				CeL.warn(`編輯談話頁面數量${talk_pages_to_edit}篇，超越編輯數量上限${wiki.latest_task_configuration.general.talk_page_limit_for_editing}。執行時請設定命令列參數 forced_edit 以強制編輯。`);
			} else {
				await maintain_VA_template();
			}
		}

		//console.trace(wiki.latest_task_configuration.Topics);
	}

	// ----------------------------------------------------

	if (!CeL.env.arg_hash?.skip_vital && !do_PIQA) {
		//if (wiki.latest_task_configuration.general.modify_talk_pages)
		await generate_report({ no_editing_of_talk_pages });

		routine_task_done('1d');
		return;
	}

	// ----------------------------------------------------

	await do_PIQA_operation();

	CeL.info(`${main_process.name}: Do PIQA, skip VA report. Elapsed time: ${CeL.date.age_of(start_time)}`);

	routine_task_done('1 month');

}

// ----------------------------------------------------------------------------

function clean__have_to_edit_its_talk_page() {
	if (!CeL.is_empty_object(have_to_edit_its_talk_page)) {
		// clean
		Object.keys(have_to_edit_its_talk_page).forEach(page_title => delete have_to_edit_its_talk_page[page_title]);
	}
}

async function do_PIQA_operation() {
	CeL.log_temporary(`Do PIQA operation. Elapsed time: ${CeL.date.age_of(start_time)}`);

	clean__have_to_edit_its_talk_page();

	// @see [[w:en:Wikipedia:Bots/Noticeboard/Archive 19#Flooding watchlists]]
	if (false) {
		/**從這個模板名稱開始執行。 Starts from this template name.*/
		const starts_from_template_name = 'WikiProject Anglicanism';
		let passed_starts_from = false;
		for (const WikiProject_template_title of [].append(all_WikiProject_template_list).append([wiki.to_namespace(template_name_hash.WPBS, 'template')])) {
			if (!passed_starts_from) {
				if (wiki.is_template(starts_from_template_name, WikiProject_template_title)) {
					passed_starts_from = true;
				} else {
					continue;
				}
			}

			if (wiki.is_template(all_opted_out_WikiProject_template_list, WikiProject_template_title)
				//|| !wiki.is_template(template_name_hash.WPBIO, WikiProject_template_title)
			) {
				continue;
			}

			const page_list =
				//await wiki.categorymembers('Category:WikiProject templates with unknown parameters', { namespace: 'Template' }) ||
				//await wiki.categorymembers('Category:Pages using WikiProject Mathematics with unknown parameters', { namespace: wiki.latest_task_configuration.general.PIQA_namespace || 'Talk' }) ||
				(Array.isArray(do_PIQA) ? do_PIQA
					: (await wiki.embeddedin(WikiProject_template_title, {
						limit: 5000
					})).slice(0, do_PIQA >= 1 ? do_PIQA : 1));
			for (const talk_page_data of page_list) {
				const talk_page_title = do_PIQA >= 1 ? talk_page_data.title || talk_page_data : do_PIQA;
				have_to_edit_its_talk_page[talk_page_title] = {
					// 所有作業皆經由人工監督。
					//talk_page_summary_prefix: `[[Wikipedia:Bots/Requests for approval/Cewbot 12|Bot test]] for [[WP:PIQA]]. All operations are manually supervised`,
					no_topic_message: true,
					do_PIQA: true,
					key_is_talk_page: true,
				};
			}

			await maintain_VA_template({
				summary: `${talk_page_summary_prefix}`
					+ (do_PIQA >= 1 ? ` (${CeL.wiki.title_link_of(WikiProject_template_title)})` : '')
			});
			if (!(do_PIQA >= 1)) break;
		}
	}

	// TODO: [[Template talk:WikiProject banner shell#Tracking categories for articles that require performing WP:PIQA]]

	if (false) {
		// @see [[w:en:Wikipedia:Bots/Noticeboard#A decentralized approach to solve the watchlist problem]]
		// 不再採用這方法。
		const starts_from_page_title = (() => {
			const do_PIQA_status = CeL.get_JSON(do_PIQA_status_file);
			return do_PIQA_status?.process_to_page;
		})() || '';
		CeL.info(`${do_PIQA_operation.name}: Continue from page ${JSON.stringify(starts_from_page_title)}`);
	}

	let total_talk_page_count = 0;
	const all_categories_to_clean = wiki.latest_task_configuration.general.PIQA_categories_to_clean.slice();
	//all_categories_to_clean.push('Category:WikiProject templates with unknown parameters');

	if (template_list_of_deprecated_parameters && wiki.site_name() === 'enwiki') {
		for (const template_name of template_list_of_deprecated_parameters) {
			all_categories_to_clean.push(`Category:Pages using ${template_name} with unknown parameters`);
		}
	}

	for (const category_to_clean of (all_categories_to_clean
		//&& ['Category:Pages using WikiProject banner shell without a project-independent quality rating']
	)) {
		//console.trace(category_to_clean);
		for await (let talk_page_list of (Array.isArray(do_PIQA) ? [do_PIQA] :
			// assert: do_PIQA >= 1
			wiki.categorymembers(category_to_clean, { namespace: wiki.latest_task_configuration.general.PIQA_namespace || 'Talk', batch_size: 500 })
		)) {
			if (wiki.latest_task_configuration.general.PIQA_page_filter) {
				talk_page_list = talk_page_list.filter(talk_page_data => {
					const namespace = wiki.namespace(talk_page_data, { is_page_title: true, get_name: true });
					const pattern = wiki.latest_task_configuration.general.PIQA_page_filter[namespace];
					return !pattern || pattern.test(talk_page_data.title);
				});
			}

			total_talk_page_count += talk_page_list.length;
			//if (total_talk_page_count < 50000) { console.trace('Skip many!'); continue; }
			//console.trace(do_PIQA, total_talk_page_count, talk_page_list);
			for (const talk_page_data of talk_page_list) {
				const talk_page_title = talk_page_data.title || talk_page_data;

				have_to_edit_its_talk_page[talk_page_title] = {
					// 所有作業皆經由人工監督。
					//talk_page_summary_prefix: `[[Wikipedia:Bots/Requests for approval/Cewbot 12|Bot test]] for [[WP:PIQA]]. All operations are manually supervised`,
					no_topic_message: true,
					do_PIQA: true,
					key_is_talk_page: true,
					category_to_clean: CeL.env.arg_hash?.category_to_clean || !Array.isArray(do_PIQA) && category_to_clean,
					no_class_detected: !Array.isArray(do_PIQA) && category_to_clean === 'Category:Pages using WikiProject banner shell without a project-independent quality rating',
				};
			}

			await maintain_VA_template();

			clean__have_to_edit_its_talk_page();

			if (false) {
				// 不再採用這方法。
				CeL.write_file(do_PIQA_status_file, {
					process_to_page: wiki.remove_namespace(talk_page_title),
					count: total_talk_page_count, limit: do_PIQA,
				});
			}

			if (do_PIQA >= 1 && total_talk_page_count >= do_PIQA)
				break;
		}

		//console.trace([category_to_clean, do_PIQA, total_talk_page_count]);
		if (Array.isArray(do_PIQA) || do_PIQA >= 1 && total_talk_page_count >= do_PIQA)
			break;
	}

	// 處理殘餘的 `have_to_edit_its_talk_page`
	await maintain_VA_template();

	if (wiki.latest_task_configuration.general.WPBS_syntax_error_report_page) {
		let report_wikitext;
		if (WPBS_syntax_error_pages.length > 0) {
			report_wikitext = WPBS_syntax_error_pages.map(title => CeL.wiki.title_link_of(title));
			report_wikitext.unshift('Page title');
			report_wikitext = CeL.wiki.array_to_table(report_wikitext) + `\n[[Category:Pages using WikiProject banner shell needing attention]]`;
		} else {
			report_wikitext = `No problems detected.`;
		}

		await wiki.edit_page(wiki.latest_task_configuration.general.WPBS_syntax_error_report_page,
			report_wikitext, {
			bot: 1,
			nocreate: 1,
			summary: `${CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title,
				'Report WPBS syntax error pages')}: ${WPBS_syntax_error_pages.length} page(s)`
		});
	}
}

// ----------------------------------------------------------------------------

function vital_article_level_to_category(level) {
	if (wiki.site_name() === 'zhwiki')
		level = level.toLocaleString('zh-u-nu-hanidec');
	return CeL.gettext(wiki.latest_task_configuration.general.category_name_of_level, level);
}

// All attributes of articles get from corresponding categories.
async function get_page_info() {

	await wiki.get_featured_content({
		on_conflict(FC_title, data) {
			report_lines.push([FC_title, , `Category conflict: ${data.from}→${CeL.wiki.title_link_of('Category:' + data.category, data.to)}`]);
		}
	});

	if (wiki.site_name() === 'enwiki' && !wiki.FC_data_hash['Sun']?.types.includes('FA')) {
		console.trace(wiki.FC_data_hash['Sun']);
		throw new Error('[[Sun]] should be a FA! wiki.get_featured_content() comes wrong?');
	}

	// ---------------------------------------------

	// See [[w:en:Wikipedia talk:WikiProject Military history/Coordinators#Cewbot removing "class=redirect" causing problems]]
	if (wiki.latest_task_configuration.general.category_of_custom_class_WikiProject_template) {
		const flat_subcategories = (await wiki.category_tree(wiki.latest_task_configuration.general.category_of_custom_class_WikiProject_template, {
			depth: 3, namespace: 'template', get_flat_subcategories: true,
		})).flat_subcategories;
		//console.trace(flat_subcategories);

		const category_of_custom_class_WikiProject_template__Set = new Set;

		for (const [subcategory, page_list] of Object.entries(flat_subcategories)) {
			for (const page_data of page_list) {
				// assert: wiki.is_namespace(page_data, 'template')

				// .original_title: for page_list = await wiki.categorymembers(vital_article_level_to_category(level), {})
				const main_page_title = wiki.talk_page_to_main(page_data.original_title || page_data).replace(/\/class$/, '');
				if (main_page_title.includes('/')) {
					CeL.warn(`category_of_custom_class_WikiProject_template: Skip ${CeL.wiki.title_link_of(main_page_title)}`);
					continue;
				}
				category_of_custom_class_WikiProject_template__Set.add(main_page_title);
			}
		}

		wiki.latest_task_configuration.general.all_custom_class_WikiProject_template_list = Array.from(category_of_custom_class_WikiProject_template__Set);
		//console.trace(wiki.latest_task_configuration.general.all_custom_class_WikiProject_template_list);

	} else {
		delete wiki.latest_task_configuration.general.all_custom_class_WikiProject_template_list;
	}

	if (wiki.latest_task_configuration.general.category_of_custom_importance_WikiProject_template) {
		const flat_subcategories = (await wiki.category_tree(wiki.latest_task_configuration.general.category_of_custom_importance_WikiProject_template, {
			depth: 3, namespace: 'template', get_flat_subcategories: true,
		})).flat_subcategories;
		//console.trace(flat_subcategories);

		const category_of_custom_importance_WikiProject_template__Set = new Set;

		for (const [subcategory, page_list] of Object.entries(flat_subcategories)) {
			for (const page_data of page_list) {
				// assert: wiki.is_namespace(page_data, 'template')

				// .original_title: for page_list = await wiki.categorymembers(vital_article_level_to_category(level), {})
				const main_page_title = wiki.talk_page_to_main(page_data.original_title || page_data).replace(/\/importance$/, '');
				if (main_page_title.includes('/')) {
					CeL.warn(`category_of_custom_importance_WikiProject_template: Skip ${main_page_title}`);
					continue;
				}
				category_of_custom_importance_WikiProject_template__Set.add(main_page_title);
			}
		}

		wiki.latest_task_configuration.general.all_custom_importance_WikiProject_template_list = Array.from(category_of_custom_importance_WikiProject_template__Set);
		//console.trace(wiki.latest_task_configuration.general.all_custom_importance_WikiProject_template_list);

	} else {
		delete wiki.latest_task_configuration.general.all_custom_importance_WikiProject_template_list;
	}

	// ---------------------------------------------

	// See [[Wikipedia talk:Vital articles#Categories]], [[User talk:Kanashimi#Vital Article inconsistent bolding]]
	// Skip [[Category:All Wikipedia level-unknown vital articles]]
	if (wiki.latest_task_configuration.general.category_name_of_level) {
		const category_tree_options = {
			depth: 3, namespace: 'talk', get_flat_subcategories: true,
		};
		if (wiki.site_name() === 'enwiki') {
			category_tree_options.category_filter = page_data => /Wikipedia level-\d vital articles/.test(page_data.title || page_data);
		}
		for (let level = /*max_VA_level*/5; level >= 1; level--) {
			const flat_subcategories = (await wiki.category_tree(vital_article_level_to_category(level), category_tree_options)).flat_subcategories;
			//if (level === 1) console.trace(flat_subcategories);
			for (const [subcategory, page_list] of Object.entries(flat_subcategories)) {
				for (const page_data of page_list) {
					// assert: wiki.is_namespace(page_data, 'talk')
					if (!wiki.is_namespace(page_data, 'talk')) {
						console.trace(page_data);
						continue;
					}

					// .original_title: for page_list = await wiki.categorymembers(vital_article_level_to_category(level), {})
					const main_page_title = wiki.talk_page_to_main(page_data.original_title || page_data);
					if (main_page_title in category_level_of_page) {
						report_lines.push([main_page_title, , `${category_level_of_page[main_page_title]}→${level}`]);
					}
					category_level_of_page[main_page_title] = level;
				}
			}

		}
	}
	//console.trace(category_level_of_page);

	// ---------------------------------------------
	//CeL.info('Get pages of each icons_schema');

	/**{Array}要與 wiki.FC_data_hash[page_title] 同步的 icons。 */
	const synchronize_icons = 'List|FA|FL|GA'.split('|');
	/**{Object}要與 wiki.FC_data_hash[page_title] 同步的 icons。 */
	const synchronize_icon_hash = Object.fromEntries(synchronize_icons.map(icon => [icon, true]));

	for (const [icon, icon_schema] of Object.entries(icons_schema)) {
		const { category_name } = icon_schema;
		if (!category_name) continue;
		//CeL.log_temporary(`Get pages of icons_schema ${category_name}...`);

		const flat_subcategories = (await wiki.category_tree(category_name, {
			depth: 3, namespace: '*', get_flat_subcategories: true,
			category_filter(page_data) {
				//console.trace(page_data, !(page_data.title || page_data).includes(' by topic'));
				return !(page_data.title || page_data).includes(' by topic');
			}
		})).flat_subcategories;

		//console.trace(flat_subcategories);
		for (const [subcategory, page_list] of Object.entries(flat_subcategories)) {
			for (const page_data of page_list) {
				if (!wiki.is_namespace(page_data, 'Talk')) {
					if (!wiki.is_namespace(page_data, 'Category') && !((category_name === 'Wikipedia former featured portals' || category_name === 'Wikipedia featured portals') && wiki.is_namespace(page_data, 'Portal talk')))
						CeL.warn(`${get_page_info.name}: Skip invalid namespace: ${CeL.wiki.title_link_of(page_data)} (${category_name})`);
					continue;
				}

				const page_title = wiki.talk_page_to_main(page_data.original_title || page_data);
				if (!(page_title in icons_of_page))
					icons_of_page[page_title] = [];
				if (icon in synchronize_icon_hash /* synchronize_icons.includes(icon) */) {
					// assert: ('VA_class' in icons_of_page[page_title]) === false
					icons_of_page[page_title].VA_class = icon.toUpperCase();
				} else {
					icons_of_page[page_title].push(icon);
				}
			}
		}
	}
	//console.trace(icons_of_page);
	//console.trace(icons_of_page['Cash']);

	// ---------------------------------------------
	CeL.info(`Check VA class for ${Object.keys(icons_of_page).length} pages, synchronize FA|FL|GA|List.`);

	const former_icon_of_VA_class = {
		FA: 'FFA',
		FL: 'FFLC',
		GA: 'FGAN',
	};

	for (const page_title in icons_of_page) {
		let icons = icons_of_page[page_title];
		// List → LIST
		const VA_class = icons.VA_class?.toUpperCase();

		// For the first time do_PIQA
		if (false && do_PIQA && Object.keys(have_to_edit_its_talk_page).length < do_PIQA
			//|| page_title.includes('')
		) {
			CeL.log_temporary(`${Object.keys(have_to_edit_its_talk_page).length}/${do_PIQA}/${Object.keys(icons_of_page).length}	${page_title}`);
			have_to_edit_its_talk_page[page_title] = {
				class: VA_class || '',
				reason: `Merge {{VA}} into {{WPBS}}.`,
				no_topic_message: true,
				do_PIQA: true,
			};
		}

		if (!VA_class) {
			// There is no VA class of the title. abnormal!
			continue;
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
					reason: `The article is no longer a ${VA_class}.`,
				};
				return true;
			}
		}

		const FC_type = wiki.FC_data_hash[page_title] && wiki.FC_data_hash[page_title].type;
		if (FC_type) {
			//console.trace(page_title, wiki.FC_data_hash[page_title]);
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
		if (icons.includes(icon) && icons_schema[icon]?.category_name) {
			// e.g., list in [[Category:List-Class List articles]]
			// but not in [[Category:All Wikipedia List-Class vital articles]]
			have_to_edit_its_talk_page[page_title] = {
				class: icon,
				reason: `The article is listed in list type: [[Category:${icons_schema[icon].category_name}]]`
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

		//if (page_title === '') console.trace(VA_class, icons);
		// assert: /^(?:FA|FL|GA)$/.test(VA_class)
		if (fallback()) {
			continue;
		}
	}

	// For the first time do_PIQA
	if (false && do_PIQA >= 1 && Object.keys(have_to_edit_its_talk_page).length < do_PIQA) {
		let talk_page_list;
		//talk_page_list = ['Talk:Lagrangian mechanics', 'Talk:Square root of 2', 'Talk:Boric acid', 'Talk:Municipality', 'Talk:Buffer solution', 'Talk:New Austrian tunneling method', 'Talk:Stavanger', 'Talk:Clipper', 'Talk:Action-adventure game', 'Talk:Maxwell relations',];
		if (!talk_page_list) {
			talk_page_list = await wiki.embeddedin(wiki.to_namespace(template_name_hash.VA, { namespace: 'template' }));
			//console.trace([template_name_hash.VA, talk_page_list.length, do_PIQA, Object.keys(have_to_edit_its_talk_page).length]);
			talk_page_list = talk_page_list.slice(0, do_PIQA - Object.keys(have_to_edit_its_talk_page).length);
		}
		for (const talk_page_data of talk_page_list) {
			const talk_page_title = talk_page_data.title || talk_page_data;
			if (!(talk_page_title in have_to_edit_its_talk_page)) {
				have_to_edit_its_talk_page[talk_page_title] = {
					//class: '',
					key_is_talk_page: true,
					reason: `Merge {{VA}} into {{WPBS}}.`,
					no_topic_message: true,
					do_PIQA: true,
				};
			}
		}
	}
	//console.trace(icons_of_page['Apollo'], have_to_edit_its_talk_page['Apollo'], Object.keys(have_to_edit_its_talk_page).length);


	const all_WikiProject_template_Set = new Set;
	if (Array.isArray(wiki.latest_task_configuration.general.WikiProject_template_categories)) {
		for (const category of wiki.latest_task_configuration.general.WikiProject_template_categories) {
			(await wiki.categorymembers(category, { namespace: 'Template' })).forEach(page_data => /*all_opted_out_WikiProject_template_Set.has(page_data.title) || */all_WikiProject_template_Set.add(page_data.title));
		}
		all_WikiProject_template_list.append(Array.from(all_WikiProject_template_Set));
		CeL.info(`${get_page_info.name}: ${all_WikiProject_template_list.length} WikiProject templates.`);
	}

	if (Array.isArray(wiki.latest_task_configuration.general.opted_out_WikiProject_template_categories)) {
		/** {Array}list of opted out WikiProject templates */
		const all_opted_out_WikiProject_template_Set = new Set;
		for (const category of wiki.latest_task_configuration.general.opted_out_WikiProject_template_categories) {
			(await wiki.categorymembers(category, { namespace: 'Template' })).forEach(page_data => {
				if (!all_WikiProject_template_Set.has(page_data.title)) {
					CeL.warn(`${get_page_info.name}: opted out WikiProject template ${CeL.wiki.title_link_of(page_data)} is not in all WikiProject template list.`);
				}
				all_opted_out_WikiProject_template_Set.add(page_data.title);
			});
		}
		all_opted_out_WikiProject_template_list.append(Array.from(all_opted_out_WikiProject_template_Set));
		CeL.info(`${get_page_info.name}: ${all_opted_out_WikiProject_template_list.length} opted out WikiProject templates.`);
	}

}

// ----------------------------------------------------------------------------

const zhwiki_level_list = [, '第一級', '第二級', '第三級', '擴展', '第五級'];

function level_to_page_title(level, add_level) {
	const base_page = wiki.latest_task_configuration.general.base_page;
	let page_title;

	switch (wiki.site_name()) {
		case 'enwiki':
			page_title = /* level === DEFAULT_LEVEL && !add_level ? base_page : */ base_page + '/Level/' + level;
			break;

		case 'zhwiki':
			page_title = /* level === DEFAULT_LEVEL && !add_level ? base_page : */ base_page + '/' + zhwiki_level_list[level];
			break;
	}

	if (page_title && !add_level) {
		// 應該只有 level === DEFAULT_LEVEL 時才會重導向。
		return wiki.redirect_target_of(page_title);
	}

	return page_title;
}

function level_page_link(level, number_only, page_title) {
	let display_text;
	if (number_only) {
		display_text = level;
	} else {
		switch (wiki.site_name()) {
			case 'enwiki':
				display_text = 'Level ' + level;
				break;

			case 'zhwiki':
				//display_text = zhwiki_level_list[level];
				// 為配合 replace_level_note()，不能採用 PATTERN_level 之外的模式。
				display_text = 'Level ' + level;
				break;
		}
	}

	return CeL.wiki.title_link_of(page_title || level_to_page_title(level), display_text);
}


// Base schema: [[base_page/level/topic/subpage#section]]
// page_title_and_section_id: "level/topic/subpage#section" (subpage vs. sublist)
// Level 1:	1#section
// Level 2:	2#section(=topic)
// Level 3:	3#section(=topic)
// Level 4:	4/topic#section=topic
// Level 5:	5/topic/subpage#section=topic
const PATTERN_page_title_and_section_id = /^(?<level>[^#\/]*)(?:\/(?<topic>[^#\/]*)(?:\/(?<subpage>[^#]*))?)?(?:#(?<section>.*))?$/;

function parse_page_title_and_section(page_title_and_section, options) {
	let page_title_and_section_id;
	if (!page_title_and_section) {
		page_title_and_section_id = String(DEFAULT_LEVEL);
	} else {
		const base_page = wiki.latest_task_configuration.general.additional_base_page_Map?.get(page_title_and_section.title)
			|| wiki.latest_task_configuration.general.base_page;
		if (page_title_and_section.title) {
			page_title_and_section = page_title_and_section.title;
			if (!page_title_and_section.startsWith(base_page)) {
				CeL.warn(`${parse_page_title_and_section.name}: Invalid vital articles list page? ${CeL.wiki.title_link_of(page_title_and_section)} (base page: ${CeL.wiki.title_link_of(base_page)})`);
				console.trace(page_title_and_section);
				return;
			}
		}
		page_title_and_section_id = String(page_title_and_section);
		const index = page_title_and_section_id.indexOf(base_page);
		if (index >= 0)
			page_title_and_section_id = page_title_and_section_id.slice(index + base_page.length);
		page_title_and_section_id = page_title_and_section_id
			// This is for `wiki.latest_task_configuration.Topics`. 由 set_latest_section_title() 呼叫的已正規化。
			.replace(/^.*?\/Level\/?/, '').replace(/^\/+/, '')
			.replace(/\s*\]\]\s*#\s*/, '#').replace(/\s*\]\]\s*/, '').replace(/^([^#]+)#$/, '$1')
			|| String(DEFAULT_LEVEL);
	}

	let page_title_and_section_id_used = page_title_and_section_id;
	if (wiki.site_name() === 'zhwiki') {
		// @see [[Wikipedia:基礎條目/擴展#元維基版本]]
		page_title_and_section_id_used = page_title_and_section_id.replace(/((?:^|\/)擴展\/)meta\//, '$1');
	}

	// assert: typeof page_title_and_section_id === 'string'
	const matched = page_title_and_section_id_used.match(PATTERN_page_title_and_section_id);
	if (!matched) {
		CeL.warn(`${parse_page_title_and_section.name}: Cannot determine level and topic of ${JSON.stringify(page_title_and_section)}`);
		return;
	}

	const page_title_and_section_data = matched.groups;
	page_title_and_section_data.page_title_and_section_id = page_title_and_section_id;

	// 設定純數字級別。
	let numeric_level;
	switch (wiki.site_name()) {
		case 'zhwiki':
			numeric_level = page_title_and_section_id == DEFAULT_LEVEL
				// e.g., `parse_page_title_and_section('Wikipedia:基礎條目')`
				? DEFAULT_LEVEL : zhwiki_level_list.indexOf(page_title_and_section_data.level);
			break;

		default:
			if (CeL.is_digits(page_title_and_section_data.level))
				numeric_level = +page_title_and_section_data.level;
	}
	if (numeric_level > 0) {
		page_title_and_section_data.numeric_level = numeric_level;
		if (!page_title_and_section_data.topic && page_title_and_section_data.section) {
			// 1級的 subpage, section 不包含 topic 資訊。
			// 2, 3級的 section title 分割過細，不如採下一等級的 topic。
			//page_title_and_section_data.pseudo_topic = page_title_and_section_data.section;
		}
	}

	return page_title_and_section_data;
}

function level_of_page_title(page_title, number_only) {
	const page_title_and_section_data = parse_page_title_and_section(page_title);
	return number_only ? page_title_and_section_data.numeric_level : page_title_and_section_data.page_title_and_section_id;
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

// Skip non-list pages.
function is_ignored_list_page(list_page_data) {
	const page_title = list_page_data.title;
	return CeL.wiki.parse.redirect(list_page_data)
		|| page_title.endsWith('/Labels')
		|| page_title.endsWith('/Removed')
		//[[Wikipedia:Vital articles/Level/4/People/Candidates]]
		|| page_title.endsWith('/Candidates')
		// e.g., 'json'
		|| CeL.wiki.content_of.revision(list_page_data)?.contentmodel !== 'wikitext';
}

async function for_each_list_page(list_page_data) {
	if (is_ignored_list_page(list_page_data)) {
		// 想要更新這些被忽略的頁面，必須做更多測試，避免他們也列入索引。
		return Wikiapi.skip_edit;
	}

	const level = level_of_page_title(list_page_data, true);
	if (false && !level && wiki.site_name() !== 'zhwiki') {
		CeL.warn(`${for_each_list_page.name}: Skip ${CeL.wiki.title_link_of(list_page_data)}: Invalid vital articles list page?`);
		return Wikiapi.skip_edit;
	}
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

		const page_id = level_of_page_title(list_page_data);
		if (!page_id) {
			// e.g., [[w:en:Wikipedia:Vital articles/Frequently Asked Questions]]
			return;
		}
		let section_title_now = latest_section_title;
		topic_of_current_section = null;
		while (section_title_now) {
			const section_title = section_title_now.title.toString().replace(PATTERN_count_mark, '').trim();
			if (!section_title) {
				//continue;
			}
			//console.trace(section_title);
			const page_title_and_section_id = `${page_id}#${section_title}`;
			topic_of_current_section = Topics[page_title_and_section_id] || get_topic_of_section(page_title_and_section_id);
			if (topic_of_current_section) {
				// console.trace([page_title_and_section_id, topic_of_current_section]);
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
					//console.trace(listed_article_info[normalized_redirect_to]);
					CeL.error(`${set_redirect_to.name}: For ${redirect_from}→${normalized_redirect_to}, the target is existed in the list!`);
					return;
				}
				list[normalized_redirect_to] = list[redirect_from];
				//delete list[redirect_from];
			}
		});
	}

	function simplify_link(link_token, normalized_page_title) {
		if (link_token.type !== 'link') {
			return;
		}

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
			/** 為中文維基百科的特設模板。 */
			const is_zhwiki_VA_template = wiki.site_name() === 'zhwiki' ? function is_zh_VA_template(token) {
				// 不包括 {{tsl}}。若本地連結存在，應已被 20160517.interlanguage_link_to_wikilinks.js 轉成正規 wikilink。
				return token.type === 'transclusion' && (wiki.is_template(['Va', 'Va2', 'Vae2'], token)
					// e.g., {{/vae2}} @ [[Wikipedia:基礎條目/擴展/地理/自然地理]]
					|| token.name === '/vae2');
			} : () => false;

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

					if (_token.type === 'link'
						|| is_zhwiki_VA_template(_token)) {
						// assert: token.type === 'link'
						token = _token;
						return parsed.each.exit;
					}
				});
				//console.trace(token);
			}

			/** 處理文章。 */
			function register_article(normalized_page_title) {
				simplify_link(token, normalized_page_title);
				if (wiki.is_namespace(normalized_page_title, ['Wikipedia', 'User'])
					// e.g., [[d:Q1]], [[en:T]]
					|| normalized_page_title.includes(':') && wiki.append_session_to_options().session.configurations.interwiki_pattern.test(normalized_page_title)
				) {
					// Skip invalid namespaces or interwiki link.
					return parsed.each.exit;
				}
				if (!wiki.is_namespace(normalized_page_title, 'main')) {
					CeL.warn('Non-article: ' + normalized_page_title);
				}
				if (!(normalized_page_title in listed_article_info)) {
					listed_article_info[normalized_page_title] = [];
				}
				const article_info = {
					level: level_of_page_title(list_page_data, true),
					// detailed_level這個參數是為了準確的連結到基礎條目列表頁面。現在我採用的方法其實是讀取列表頁面之後，取得頁面名稱與章節名稱再來做分類。topic、subpage 其實是從[[User:Cewbot/log/20200122/configuration#Topics]]轉換獲得的，不是靠著一頁一頁讀取文章的talk頁面。其實我一直疑惑，為何像 5/People/Entertainers, directors, producers, and screenwriters 不能夠設定成 subpage=Entertainers, directors, producers, and screenwriters，如此就能少一個轉換的過程。
					// The <code>detailed_level</code> parameter is to link to the list page accurately. The way I'm using now is to read the list page and then get the page name and chapter name to categorize it. <code>topic</code> and <code>subpage</code> are actually converted from [[User:Cewbot/log/20200122/configuration#Topics]] instead of relying on reading the talk page of the article one by one. In fact, I've been wondering why something like <code>5/People/Entertainers, directors, producers, and screenwriters</code> can't be set to <code>subpage=Entertainers, directors, producers, and screenwriters</code>, so that there is less conversion process.
					detailed_level: level_of_page_title(list_page_data),
					link: latest_section_title?.link
						// ugly hack
						|| [list_page_data.title, ''],
				};
				if (wiki.latest_task_configuration.general.additional_base_page_Map?.has(list_page_data.title)) {
					article_info.base_page = wiki.latest_task_configuration.general.additional_base_page_Map.get(list_page_data.title);
					//if (article_info.level === DEFAULT_LEVEL) delete article_info.level;
				}
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
				} else {
					// 記錄用。 e.g., [[w:zh:Wikipedia:基礎條目/第一級]]
					//article_info.list_page_title = list_page_data.title;
				}

				const list_page_or_category_level = list_page_level_of_page[normalized_page_title] || category_level_of_page[normalized_page_title];
				//if (normalized_page_title === 'Quaoar') console.trace([normalized_page_title, list_page_level_of_page[normalized_page_title], category_level_of_page[normalized_page_title], list_page_or_category_level, level, is_ignored_list_page(list_page_data)]);
				// The frist link should be the main article.
				if (list_page_or_category_level === level || is_ignored_list_page(list_page_data)) {
					//if (normalized_page_title === '月球') console.trace('Remove level note. It is unnecessary.');
					replace_level_note(_item, index, list_page_or_category_level, '');
				} else {
					// `list_page_or_category_level===undefined`: e.g., redirected
					replace_level_note(_item, index, list_page_or_category_level, !level
						// 不該列出只從 category 獲得的 level。
						|| !list_page_level_of_page[normalized_page_title] ? ''
						: list_page_or_category_level ? undefined : '');

					if (false) {
						const message = `Category level ${list_page_or_category_level}, also listed in level ${level}. If the article is redirected, please modify the link manually.`;
					}
					// Use {{r}} to reduce size.
					const message = `${CeL.wiki.title_link_of(wiki.to_talk_page(normalized_page_title))}: ${list_page_or_category_level ? `Category level ${list_page_or_category_level}.{{r|c}}` : 'Not set as VA?{{r|e}}'}`;
					if (!list_page_or_category_level
						&& (!have_to_edit_its_talk_page[normalized_page_title]
							// 應該以最重要等級為主。這會影響到 reason / summary。
							|| !(have_to_edit_its_talk_page[normalized_page_title].level < level))) {
						have_to_edit_its_talk_page[normalized_page_title] = {
							...article_info,
							level,
							reason: `The article is listed in the level ${level} page`,
						};
					}
					if (level && !(list_page_or_category_level < level)) {
						// Only report when list_page_or_category_level (main level) is not
						// smallar than level list in.
						report_lines.push([normalized_page_title, list_page_data, message]);
						if (false) CeL.warn(`${CeL.wiki.title_link_of(normalized_page_title)}: ${message}`);
						// If there is list_page_or_category_level, the page was not redirected.
						if (!list_page_or_category_level) {
							// e.g., deleted; redirected (fix latter);
							// does not has {{`template_name_hash.VA`}}
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
				// 登記列在本頁面的項目。先到先贏。
				if (!(normalized_page_title in list_page_level_of_page)) {
					list_page_level_of_page[normalized_page_title] = level;
				}

				icons = icons.sort((_1, _2) => {
					const order_1 = icon_order_Map.has(_1) ? icon_order_Map.get(_1) : icon_order_Map.has(KEY_extra_items) ? icon_order_Map.get(KEY_extra_items) : icons.length;
					const order_2 = icon_order_Map.has(_2) ? icon_order_Map.get(_2) : icon_order_Map.has(KEY_extra_items) ? icon_order_Map.get(KEY_extra_items) : icons.length;
					return order_1 !== order_2 ? order_1 - order_2 : _1 < _2 ? -1 : _1 > _2 ? 1 : 0;
				});
				icons = icons.unique_sorted();
				//if (icons.length > 1) console.trace(normalized_page_title, icons);
				//if (icons.join(' ').includes('FFAC')) { console.trace(icons); }

				icons = icons.map(icon => {
					if (icon in article_count_of_icon)
						article_count_of_icon[icon]++;
					else
						article_count_of_icon[icon] = 1;
					//{{Class/icon}}
					return `{{#invoke:Icon||${icon}}}`;
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
				// assert: token.type === 'link'
				if (token.parent.type === 'bold') {
					// assert: token.parent[1] === token
					move_up();
					// 注意: 僅去除 ''', '''''，不可去除僅 italic。
					if (token.parent.type === 'italic') {
						// assert: token.parent[1] === token
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
				// 已經處理文章連結，跳過後面所有東西。
				return true;
			}

			if (!item_replace_to && token.type === 'link') {
				// e.g., [[pH]], [[iOS]]
				const normalized_page_title = wiki.normalize_title(token[0].toString());
				return register_article(normalized_page_title);
			}

			if (!item_replace_to && is_zhwiki_VA_template(token)) {
				if (token.parameters[1]) {
					token.article_index = token.index_of[1];
					let normalized_page_title = token.parameters[1];
					// e.g., {{vae2|口音 (社會語言學){{!}}口音}} @ [[Wikipedia:基礎條目/擴展/社會和社會科學#基础知识 49]]
					if (normalized_page_title.type === 'plain' && normalized_page_title[1].type === 'magic_word_function' && normalized_page_title[1].name === '!')
						normalized_page_title = normalized_page_title[0];
					normalized_page_title = normalized_page_title.toString();
					if (normalized_page_title.includes('[[')) {
						CeL.error(`${for_item_token.name}: 指定了無效的文章名稱: ` + token);
						return;
					}
					normalized_page_title = wiki.normalize_title(normalized_page_title);
					return register_article(normalized_page_title);
				}

				CeL.error(`${for_item_token.name}: 未指定文章名稱: ` + token);
				return;
			}

			if (token.type === 'transclusion' && wiki.is_template('Space', token)
				|| !token.toString().trim()) {
				// Skip
				return;
			}

			// e.g., {{Icon|FFAC}}
			if (token.type === 'transclusion') {
				if (wiki.is_template('Icon', token)) {
					// reset icon: Should use CeL.wiki.parse.replace_parameter()
					// _item[index] = '';

					const icon = token.parameters[1];
					if (icon === 'FFAC') {
						icons.push(icon);
					}
					return;
				}
			}

			// e.g., {{#invoke:Icon||FFAC}}
			if (token.type === 'magic_word_function') {
				if (token.module_name === 'Icon') {
					// reset icon: Should use CeL.wiki.parse.replace_parameter()
					// _item[index] = '';

					const icon = token.parameters[1];
					if (icon === 'FFAC') {
						icons.push(icon);
					}
					return;
				}
			}

			if (item_replace_to) {
				// CeL.error('for_item: Invalid item: ' + _item);
				console.log(item_replace_to);
				console.log(token);
				const message = `${for_item_token.name}: Invalid item: ` + _item;
				CeL.error(message)
				throw new Error(message);
			}

			// 含有其他不該出現的東西。
			if (_item.length !== 1 || typeof token !== 'string') {
				console.log(`Skip from ${index}/${_item.length}, ${token.type || typeof token} ${JSON.stringify(token.toString())} of item: ${_item}`);
				// console.log(_item.join('\n'));
				// delete _item.parent;
				// console.log(_item);

				if (false) report_lines.push([normalized_page_title, list_page_data, `Invalid item: ${_item}`]);

				// Fix invalid pattern.
				const wikitext = (_item.type === 'list_item' || _item.type === 'plain') && _item.toString();
				let PATTERN;
				if (!wikitext) {
				} else if ((PATTERN = /('{2,5})((?:{{(?:#invoke:)?Icon\|\s*\|?\w+}}\s*)+)/i).test(wikitext)) {
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
			CeL.error('No links in this item! ' + CeL.wiki.title_link_of(list_page_data));
			console.trace(item.toString(), item);
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
				// TODO: use CeL.wiki.parse.replace_parameter()
				parent.list_prefix[index] = '';
			} else if (next_wikitext) {
				// TODO: use CeL.wiki.parse.replace_parameter()
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
			) && parsed.each.exit;
		}

		if (token.type === 'transclusion' && wiki.is_template('Columns-list', token)) {
			// [[Wikipedia:Vital articles/Level/5/Everyday life/Sports, games and recreation]]
			token = token.parameters[1];
			// console.log(token);
			return Array.isArray(token) && token.some(for_root_token) && parsed.each.exit;
		}

		if (token.type === 'transclusion' && wiki.is_template(template_name_hash.VA_count, token)) {
			// for set_section_title_count()
			if (latest_section_title) {
				if (latest_section_title.count_template) {
					CeL.warn(`${for_root_token.name}: Has multiple {{${template_name_hash.VA_count}}}: ${latest_section_title}`);
					if (!latest_section_title.count_template.parameters.quota && token.parameters.quota > 0)
						latest_section_title.count_template.push('|quota=' + token.parameters.quota);
					//return parsed.each.remove_token;
				} else
					latest_section_title.count_template = token;
			}
			return;
		}

		if (token.type === 'list') {
			for_item(token, index, root);
			return;
		}

		if (token.type === 'section_title') {
			// quit on "See also" section. e.g., [[Wikipedia:Vital articles]]
			if (/^(?:See also|相關連結)/i.test(token.title))
				return parsed.each.exit;

			if (token.length > 0) {
				// [[Wikipedia talk:Vital articles#Number of articles in headings]]
				token.forEach((sub_token, index) => {
					// e.g., '==<span id="General"></span>General =='
					let matched = sub_token.toString().match(/^<(\w+)\s+id="([^"]+)"><\/\1>$/);
					if (matched && matched[2] === token.title) {
						// TODO: use CeL.wiki.parse.replace_parameter()
						token[index] = '';
						return;
					}
					// e.g., '=={{anchor|Architecture}}Architecture =='
					if (sub_token.type === 'transclusion' && wiki.is_template('Anchor', sub_token) && sub_token.parameters[1] === token.title) {
						// TODO: use CeL.wiki.parse.replace_parameter()
						token[index] = '';
						return;
					}
				});
			}

			// for set_section_title_count()
			token.index = index;
			token.parent = root;

			if (/^General$/i.test(token.title) && latest_section_title && token.length === 1) {
				token[0] = latest_section_title.title.toString().replace(PATTERN_count_mark, '').trim() + ': General';
			}

			//if (list_page_data.title.includes('Military personnel, revolutionaries, and activists')) console.log(token);
			set_latest_section_title(token);
		}

		section_text_to_title(token, index, root);
	}

	parsed.each(for_root_token, { max_depth: 1 });

	// -------------------------------------------------------

	function set_section_title_count(parent_section) {
		//if (!parent_section.page) console.log(parent_section);
		// [[Wikipedia:基礎條目/擴展/社會和社會科學/商業經濟/vae2]] 無內容，無 .child_section_titles。
		if (!parent_section.child_section_titles)
			return 0;

		const item_count = parent_section.child_section_titles.reduce((item_count, subsection) => item_count + set_section_title_count(subsection), parent_section.item_count || 0);

		if (parent_section.type === 'section_title') {
			let quota;
			parent_section[0] = parent_section.join('')
				.replace(PATTERN_count_mark, function (all, quota_articles, _quota) {
					if (_quota)
						quota = +_quota.replace(/,/g, '');
					// [[Wikipedia talk:Vital articles#Number of articles in headings]]
					if (wiki.latest_task_configuration.general.remove_title_counter)
						return '';
					return `(${item_count.toLocaleString()}${quota_articles} ${item_count === 1 ? 'article' : 'articles'})`
				}).replace(/\s{2,}/g, ' ');
			// console.log(parent_section[0]);
			parent_section.truncate(1);

			if (parent_section.count_template) {
				const parameters_argument = {
					[1]: item_count
				};
				if (quota)
					parameters_argument.quota = quota;
				CeL.wiki.parse.replace_parameter(parent_section.count_template, parameters_argument, { value_only: true, force_add: true, append_key_value: true });
			} else if ((item_count > 0 || quota > 0) && wiki.latest_task_configuration.general.auto_add_count_template) {
				//console.trace(parent_section.parent.slice(parent_section.index, parent_section.index + 2));
				parent_section.parent[parent_section.index + 1] = `\n{{${template_name_hash.VA_count}|${item_count}${quota ? '|quota=' + quota : ''}}}` + (parent_section.parent[parent_section.index + 1] || '\n');
			}
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
			const normalized_redirect_to = wiki.normalize_title(CeL.wiki.parse.redirect(page_data))
				// e.g., 經過繁簡轉換。
				|| page_data.original_title && page_data.title;
			if (!normalized_redirect_to
				// Need check if redirects to [[title#section]].
				// Skip [[Plaster of Paris]]:
				// #REDIRECT [[Plaster#Gypsum plaster]]
				|| normalized_redirect_to.includes('#')) {
				return;
			}

			// Fix redirect in the list page.
			const link_or_template_token = need_check_redirected[page_data.original_title || page_data.title];
			if (!link_or_template_token) {
				CeL.error(`${for_each_list_page.name}: No need_check_redirected [${page_data.title}]!`);
				console.log(page_data.wikitext);
				console.log(page_data);
			}

			fixed_list.push(link_or_template_token[link_or_template_token.article_index || 0] + '→' + normalized_redirect_to);
			// 預防頁面被移動後被當作已失去資格，確保執行 check_page_count() 還是可以找到頁面資料。
			// TODO: 必須捨棄 catch。
			set_redirect_to(link_or_template_token[link_or_template_token.article_index || 0], normalized_redirect_to);
			link_or_template_token[link_or_template_token.article_index || 0] = normalized_redirect_to;
			simplify_link(link_or_template_token, normalized_redirect_to);
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
		const icon_schema = icons_schema[icon];
		if (!icon_schema) {
			CeL.error(`${for_each_list_page.name}: Icon ${JSON.stringify(icon)} is not listed in the icon_schema!`);
			return;
		}

		let { category_name } = icon_schema;
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
		summary_table.push([`{{Icon|${icon}}} ${category_name || (icon_schema.note ? `<span title="${icon_schema.note}">${icon}</span>` : icon)}`, article_count_of_icon[icon].toLocaleString()]);
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

	// e.g., " ([[Wikipedia:基礎條目/擴展/人物|第四級/人物]])"
	if (false && !level && wiki.site_name() === 'zhwiki')
		wikitext = wikitext.replace(/ \(\[\[Wikipedia:基礎條目[^|\[\]]+\|[^|\[\]]+\]\]\)/g, '');

	return wikitext;
}

// ----------------------------------------------------------------------------

async function generate_all_VA_list_page() {
	const all_articles = Object.create(null);
	const all_level_1_to_4_articles = Object.create(null);
	const topic_hierarchy = Object.create(null);
	const VA_data_list_via_prefix = Object.create(null);

	for (const [page_title, article_info_list] of Object.entries(listed_article_info)) {
		if (false && page_title.includes('孫中山')) {
			console.trace(page_title, article_info_list);
			//throw page_title;
		}

		// page_title.slice(0, 1)
		const prefix = String.fromCodePoint(page_title.codePointAt(0));
		let data_list_prefix = prefix;
		if (wiki.site_name() === 'zhwiki') {
			// `local base36 = convertBase({n = codepoint, base = 36})`
			// @ function p.getDataPage(input_data) @ [[w:zh:Module:Vital articles#L-12]]
			data_list_prefix = data_list_prefix.codePointAt(0).toString(36).at(-1).toUpperCase();
			data_list_prefix = /^[A-Z\d]$/.test(data_list_prefix) ? data_list_prefix : '其他';
		} else {
			// enwiki
			// assert: data_list_prefix.toUpperCase() === data_list_prefix
			data_list_prefix = /^[A-Z]$/.test(data_list_prefix) ? data_list_prefix : 'others';
		}
		if (!VA_data_list_via_prefix[data_list_prefix])
			VA_data_list_via_prefix[data_list_prefix] = Object.create(null);
		// assert: Array.isArray(article_info_list)

		const article_info_of_base_page = Object.create(null);

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
			//if (!article_info.link) console.trace(article_info);
			// 裁切過的連結 cf. detailed_level
			if (wiki.latest_task_configuration.general.generate_trimmed_link)
				article_info.trimmed_link = article_info.link[0].replace(/^[^\/]+/, '') + (article_info.link[1] ? '#' + article_info.link[1] : '');
			delete article_info.link;

			// At levels 1 and 2, the topic is not needed to make the link, but it is needed to populate categories such as Category:Wikipedia vital articles in Philosophy.
			if (index === 0 && !article_info.topic) {
				let section;
				for (let i = 1; i < article_info_list.length; i++) {
					if (article_info_list[i].topic) {
						article_info.topic = article_info_list[i].topic;
						break;
					}
					// level 1 的標題完全不能代表文章性質。
					if (!section && article_info.level > 1)
						section = article_info.section;
				}
				if (!article_info.topic && section) {
					//article_info.topic = section;
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

			if (article_info.base_page
				// 僅記錄非 [0] 的，因為 [0] 將成為主要的 data。
				&& index > 0) {
				if (!article_info_of_base_page[article_info.base_page]) {
					// NG: 只取最高重要度的一篇文章。
					//article_info_of_base_page[article_info.base_page] = [article_info];
					article_info_of_base_page[article_info.base_page] = article_info;
				} else {
					// NG: 只取最高重要度的一篇文章。
					//article_info_of_base_page[article_info.base_page].push(article_info);
				}
			}

			return article_info;
		})
		// 只取最高重要度的一篇文章。 https://en.wikipedia.org/w/index.php?title=Wikipedia_talk%3AVital_articles#List_of_vital_articles
		[0];

		if (Object.keys(article_info_of_base_page).length > 0) {
			//console.trace(page_title, article_info_of_base_page);
			VA_data_list_via_prefix[data_list_prefix][page_title].article_info_of_base_page = article_info_of_base_page;
		}

		if (false && page_title.includes('孫中山')) {
			console.trace(page_title, VA_data_list_via_prefix[data_list_prefix][page_title], article_info_of_base_page);
			//throw page_title;
		}

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

	const data_directory_name = wiki.site_name() === 'zhwiki' ? '資料' : 'data';
	const pages_to_edit = {
		// 生成階層 async function generate_hierarchy_json(topic_hierarchy)
		[`${wiki.latest_task_configuration.general.base_page}/${data_directory_name}/Topic hierarchy.json`]: [topic_hierarchy, `Update topic hierarchy of vital articles: ${Object.keys(topic_hierarchy).length} topics`],
	};
	for (const prefix in VA_data_list_via_prefix) {
		// async function generate_VA_list_json(prefix, VA_data_list_via_prefix)
		const VA_data_list = VA_data_list_via_prefix[prefix];
		pages_to_edit[`${wiki.latest_task_configuration.general.base_page}/${data_directory_name}/${prefix}.json`] = [VA_data_list,
			// gettext_config:{"id":"update-list-of-vital-articles"}
			(new CeL.gettext.Sentence_combination([['Update list of vital articles:'],
			// gettext_config:{"id":"total-$1-articles"}
			['Total %1 {{PLURAL:%1|article|articles}}.', Object.keys(VA_data_list).length.toLocaleString()]])).toString(),
		];
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
		// gettext_config:{"id":"update-list-of-vital-articles"}
		summary: CeL.gettext('Update list of vital articles'),
		//nocreate: false,
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

	page_name = `${wiki.latest_task_configuration.general.base_page}/${page_name}`;
	const page_data = await wiki.page(page_name);
	if (page_data.wikitext && page_data.wikitext.between(report_mark_start, report_mark_end) === report_wikitext) {
		// No new change
		return;
	}

	count = count.toLocaleString();
	// __NOINDEX__
	report_wikitext = `This page lists all '''[[${wiki.latest_task_configuration.general.base_page}|Vital articles]]'''. It is used in order to show '''[[Special:RecentChangesLinked/${wiki.latest_task_configuration.general.base_page}/List of all articles|recent changes]]'''. It is a temporary solution until [[phab:T117122]] is resolved.

The list contains ${count} articles. --~~~~`
		+ report_mark_start + report_wikitext + report_mark_end;
	await wiki.edit_page(page_name, report_wikitext, {
		bot: 1,
		// gettext_config:{"id":"update-list-of-vital-articles"}
		summary: (new CeL.gettext.Sentence_combination([['Update list of vital articles:'],
		// gettext_config:{"id":"total-$1-articles"}
		['Total %1 {{PLURAL:%1|article|articles}}.', count]])).toString(),
		skip_nochange: true,
		nocreate: 1,
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
				remove_vital_parameter: true,
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

const talk_page_summary_prefix_text = `Maintain {{${template_name_hash.WPBS && 'WPBS'}}}${do_PIQA ? '' : ' and vital articles'}`;
let talk_page_summary_prefix = CeL.wiki.title_link_of(login_options.task_configuration_page, talk_page_summary_prefix_text);
//console.log(talk_page_summary_prefix);

async function maintain_VA_template(options) {
	// CeL.info('have_to_edit_its_talk_page: ');
	// console.trace(have_to_edit_its_talk_page);

	// prevent creating talk page if main article redirects to another page. These pages will be listed in the report.
	// 警告：若缺少主 article，這會強制創建出 talk page。 We definitely do not need more orphaned talk pages
	try {
		const page_list = [];
		Object.keys(have_to_edit_its_talk_page).forEach(page_title => {
			const article_info = have_to_edit_its_talk_page[page_title];
			if (article_info.do_PIQA) {
				page_list.push(wiki.to_namespace(page_title, 'main'));
				return;
			}

			if (article_info.key_is_talk_page
				// the bot only fix namespace=talk.
				? wiki.is_namespace(page_title, 'talk')
				: wiki.is_namespace(page_title, 'main')) {
				page_list.push(wiki.to_namespace(page_title, 'main'));
				return;
			}

			//console.trace([article_info, wiki.is_talk_namespace(page_title), page_title]);
			// e.g., [[Wikipedia:Vital articles/Vital portals level 4/Geography]]
			CeL.warn(`${maintain_VA_template.name}: Skip invalid namespace: ${CeL.wiki.title_link_of(page_title)} ${article_info.reason}`);
			//console.trace(article_info);
			delete have_to_edit_its_talk_page[page_title];
		});
		//console.trace(page_list, have_to_edit_its_talk_page);
		if (page_list.length > 0) {
			// e.g., items from VA list page?
			CeL.info(`${maintain_VA_template.name}: 檢查 ${page_list.length} 個談話頁面的主頁面是否有內容、非 redirect。`);
			//console.trace(page_list);
			await wiki.for_each_page(page_list, main_page_data => {
				const main_article_exists = !CeL.wiki.parse.redirect(main_page_data) && main_page_data.wikitext;
				//console.trace([CeL.wiki.parse.redirect(main_page_data), !!main_page_data.wikitext]);
				if (main_article_exists) {
					return;
				}
				//console.trace([main_page_data.original_title, main_page_data.title, CeL.wiki.parse.redirect(main_page_data), main_page_data.wikitext, main_article_exists]);
				const page_title = main_page_data.original_title || main_page_data.title;
				const article_info = have_to_edit_its_talk_page[page_title] || have_to_edit_its_talk_page[wiki.to_talk_page(page_title)];
				if (article_info) {
					if (article_info.do_PIQA) {
						article_info.main_page_redirect_to = CeL.wiki.parse.redirect(main_page_data);
						//console.trace(article_info);
						return;
					}
					if (have_to_edit_its_talk_page[page_title])
						delete have_to_edit_its_talk_page[page_title];
					else
						delete have_to_edit_its_talk_page[wiki.to_talk_page(page_title)];
				}
			});
		}
	} catch (e) {
	}

	CeL.info(`${maintain_VA_template.name}: 處理 ${Object.keys(have_to_edit_its_talk_page).length} 個談話頁面。`);
	let key_title_of_talk_title = Object.create(null);
	try {
		await wiki.for_each_page(Object.keys(have_to_edit_its_talk_page).map(title => {
			const talk_page = wiki.to_talk_page(title);
			//if (title !== talk_page) console.log(`To talk page: ${title}→${talk_page}`);
			key_title_of_talk_title[talk_page] = title;
			return talk_page;
		}), function (talk_page_data) {
			if ('missing' in talk_page_data) return Wikiapi.skip_edit;
			return maintain_VA_template_each_talk_page.call(this, talk_page_data, key_title_of_talk_title[talk_page_data.original_title || talk_page_data.title]);
		}, {
			// 採用重定向可能編輯到錯誤的頁面！
			//redirects: 0,

			// Allow content to be emptied. 允許內容被清空。白紙化。
			allow_blanking: true,

			// assert: The main article exists.
			nocreate: false,

			bot: 1,
			log_to: null,
			tags: do_PIQA && wiki.latest_task_configuration.general.PIQA_tags,
			summary: options?.summary || talk_page_summary_prefix,
		});
	} catch (e) {
		// e.g., [[Talk:Chenla]]: [spamblacklist]
		console.error(e);
	}
}

let maintain_VA_template_count = 0;

// https://en.wikipedia.org/wiki/Template:WikiProject_Rugby_league/class
const class_alias_to_normalized = {
	Dab: 'Disambig', Disamb: 'Disambig', Disambiguation: 'Disambig',
	// [[w:en:WP:NONSTANDARDCLASS]]
	//Sia: 'SIA',
	// [[w:en:User talk:Kanashimi#Redundant class parameter]]
	Sia: 'List', SI: 'List', SL: 'List',
};

function add_class_alias(class_alias, normalized_class) {
	if (class_alias
		&& (class_alias = normalize_class(class_alias))
		&& (normalized_class = normalize_class(normalized_class))) {
		class_alias_to_normalized[class_alias] = normalize_class(normalized_class);
	}
}

// @see [[Module:Pagetype]]
const class_to_namespace_map = {
	// 所有 namespace='Category talk' 頁面上 {{WikiProject template|class=Category}} 的 class 都會被消除。
	Category: false,
	Template: false,
	File: false,

	// [[User talk:Kanashimi#PIQA_page_filter and Category:WikiProject banners with redundant class parameter]]
	Template: 'User talk',
	// 所有 namespace='WikiProject talk' or User talk' 頁面上 {{WikiProject template|class=Project}} 的 class 都會被消除。
	Project: ['WikiProject talk', 'User talk'],
	Book: 'User talk',
	// 所有 '?' 皆為無效 class。
	'?': '*',
};

// @see https://zh.wikipedia.org/wiki/Module:Class/data
// @see https://en.wikipedia.org/wiki/Module:Icon/data
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

const standard_class_Set = new Set;
/**
 * 測試是否為正規 class。
 * @param {String} _class 需測試之 class。
 * @returns {Boolean}為正規 class。
 */
function is_standard_class(_class) {
	_class = normalize_class(_class);
	return standard_class_Set.has(_class);
}

/** value_of_move_to 包含與 value_to_move 等價的 value，可將 value_to_move 移到 value_of_move_to 去。 */
function are_equivalent_parameter_values(value_to_move, value_of_move_to, parameter_configuration) {
	if (!value_to_move)
		return false;

	return !value_of_move_to
		// normalize parameter value. .toLowerCase().trim()
		|| CeL.wiki.wikitext_to_plain_text(value_of_move_to).trim() === CeL.wiki.wikitext_to_plain_text(value_to_move).trim()
		|| parameter_configuration?.value_normalizer === 'Yesno' && CeL.wiki.Yesno(value_of_move_to) === CeL.wiki.Yesno(value_to_move)
		;
}



// maintain vital articles templates: FA|FL|GA|List,
// add new {{Vital articles|class=unassessed}}
// or via {{WikiProject banner shell|class=}}, ({{WikiProject *|class=start}})
function maintain_VA_template_each_talk_page(talk_page_data, main_page_title) {
	// For [[Talk:Philippines]]
	//console.trace(main_page_title, wiki.FC_data_hash[main_page_title]);
	const article_info = have_to_edit_its_talk_page[main_page_title];
	if (!article_info) {
		CeL.warn(`${maintain_VA_template_each_talk_page.name}: No article_info (Invalid page title?): ${CeL.wiki.title_link_of(talk_page_data)}`);
		//console.trace(talk_page_data);
		return Wikiapi.skip_edit;
	}

	// There are copies @ 20201008.fix_anchor.js
	// TODO: fix disambiguation

	// 重定向頁面不該是 vital article。
	if (!article_info.do_PIQA && CeL.wiki.parse.redirect(talk_page_data)) {
		// prevent [[Talk:Ziaur Rahman]] redirecting to [[Talk:Ziaur Rahman (disambiguation)]]
		// this kind of redirects will be skipped and listed in `wiki.latest_task_configuration.general.report_page` for manually fixing.
		// Warning: Should not go to here!
		CeL.warn(`${maintain_VA_template_each_talk_page.name}: ${CeL.wiki.title_link_of(talk_page_data)} redirecting to ${CeL.wiki.title_link_of(CeL.wiki.parse.redirect(talk_page_data))}`);
		//console.log(talk_page_data.wikitext);
		report_lines.push([main_page_title, article_info.level,
			`${CeL.wiki.title_link_of(talk_page_data)} redirecting to ${CeL.wiki.title_link_of(CeL.wiki.parse.redirect(talk_page_data))}`]);
		// TODO: [[Wikipedia:Bots/Requests for approval/Qwerfjkl (bot) 24]]
		return Wikiapi.skip_edit;
	}

	// 2024/10/23 15:38:53
	// [[Template talk:WikiProject banner shell#Combine messages]]
	// synchronizing {{para|blp}} with [[Category:Living people]] for pages in [[:Category:Pages using WikiProject Biography with conflicting living parameter]]
	if (article_info.category_to_clean === 'Category:Pages using WikiProject Biography with conflicting living parameter') {
		// TODO
	}

	// ------------------------------------------------------------------------

	// console.log(article_info);
	const parsed = talk_page_data.parse();
	CeL.assert([CeL.wiki.content_of(talk_page_data), parsed.toString()], 'wikitext parser check for ' + CeL.wiki.title_link_of(talk_page_data));
	let VA_template_token, WikiProject_banner_shell_token, is_DAB;
	/**class_from_other_templates_Map.get(class)===count */
	let class_from_other_templates_Map = new Map();

	/**
	 * 登記 class。
	 * @param {String} class_via_parameter class get from WikiProject template parameter |class=
	 * @param {Boolean|Array}is_opted_out is opted out WikiProject template
	 * @returns 
	 */
	function add_class(class_via_parameter, is_opted_out) {
		if (Array.isArray(class_via_parameter)) {
			// 處理 {{|class=<!-- Formerly assessed as Start-class -->}}
			// e.g., [[w:en:Talk:95-10 Initiative]]
			const _class = (!class_via_parameter.type || class_via_parameter.type === 'plain' ? class_via_parameter : [class_via_parameter])
				.filter(token => token.type !== 'comment');
			if (_class.some(token => typeof token !== 'string')) {
				CeL.warn(`Skip invalid class ${JSON.stringify(class_via_parameter.toString())} @ ${CeL.wiki.title_link_of(talk_page_data)}`);
				return;
			}
			//console.trace(class_via_parameter, _class);
			class_via_parameter = _class.join('');
		}

		if (!class_via_parameter)
			return;

		class_via_parameter = normalize_class(class_via_parameter);
		if (!is_standard_class(class_via_parameter)) {
			// Standard class only. e.g., [[w:en:Talk:16 Avenue North station]]
			// 排除 [[Wikipedia:Content assessment#Non-standard grades]]
			return;
		}

		if (class_from_other_templates_Map.has(class_via_parameter))
			class_from_other_templates_Map.set(class_via_parameter, class_from_other_templates_Map.get(class_via_parameter) + 1);
		else
			class_from_other_templates_Map.set(class_via_parameter, 1);
	}

	let WikiProject_template_Map = new Map();
	let all_parameters_fix_count = 0;
	let changed;
	parsed.each('template', token => {
		if (wiki.is_template(template_name_hash.WPDAB, token)) {
			// TODO: should test main article
			is_DAB = true;
			return parsed.each.exit;
		}

		if (wiki.is_template(template_name_hash.VA, token)) {
			// get the first one
			if (VA_template_token) {
				CeL.error(`${maintain_VA_template_each_talk_page.name}: Find multiple {{${template_name_hash.VA}}} in ${CeL.wiki.title_link_of(talk_page_data)}, keep only the first template!`);
				return parsed.each.remove_token;
			} else {
				VA_template_token = token;
			}
			if (article_info.do_PIQA || article_info.remove) {
				changed = true;
				return parsed.each.remove_token;
			}
			return;
		}

		if (wiki.is_template(template_name_hash.WPBS, token)) {
			if (token.parameters.category) {
				console.trace(CeL.wiki.title_link_of(talk_page_data), token.parameters);
				throw new Error(talk_page_data.title);
			}
			if (WikiProject_banner_shell_token) {
				CeL.error(`${maintain_VA_template_each_talk_page.name}: Find multiple {{${template_name_hash.WPBS}}} in ${CeL.wiki.title_link_of(talk_page_data)}!`);
				console.trace([WikiProject_banner_shell_token.toString(), token.toString()]);
			} else {
				WikiProject_banner_shell_token = token;
			}

			if (article_info.remove_vital_parameter) {
				changed = true;
				CeL.wiki.parse.replace_parameter(token, 'vital', CeL.wiki.parse.replace_parameter.KEY_remove_parameter);
			}

			if (token.parameters.class && article_info.main_page_redirect_to) {
				changed = true;
				CeL.wiki.parse.replace_parameter(token, 'class', CeL.wiki.parse.replace_parameter.KEY_remove_parameter);
			}
			return;
		}

		if (wiki.is_template(all_WikiProject_template_list, token)
			// e.g., {{WikiProject Africa}}, {{AfricaProject}}, {{maths rating}}
			//&& /project|rating/i.test(token.name)
		) {
			/** is opted out WikiProject template */
			const is_opted_out = token.is_opted_out = wiki.is_template(all_opted_out_WikiProject_template_list, token);

			// 應該在其他處理之前修正參數名稱。
			if (Array.isArray(wiki.latest_task_configuration.general.replace_misspelled_parameter_name)) {
				let parameters_fix_count = 0;
				//console.trace([wiki.latest_task_configuration.general.replace_misspelled_parameter_name, token.index_of]);
				for (const pattern of wiki.latest_task_configuration.general.replace_misspelled_parameter_name) {
					for (const [parameter_name, index] of Object.entries(token.index_of)) {
						//console.log('replace_misspelled_parameter_name: Test pattern:', [pattern, parameter_name]);
						if (pattern.test(parameter_name)) {
							const replace_to = pattern.replace(parameter_name);
							if (!token[index][0]) {
								CeL.warn(`Numeric parameter name? ${JSON.stringify(parameter_name)}→${JSON.stringify(replace_to)}`);
								continue;
							}
							if (parameter_name !== replace_to) {
								//CeL.warn(`Fix parameter name: ${JSON.stringify(parameter_name)}→${JSON.stringify(replace_to)}`);
								//console.trace(token[index]);
								parameters_fix_count++;
								token[index][0] = replace_to;
							}
						}
					}
				}
				if (parameters_fix_count > 0) {
					all_parameters_fix_count += parameters_fix_count;
					CeL.wiki.inplace_reparse_element(token, wiki.append_session_to_options());
					//console.trace(token, token.toString());
				}
			}

			if (CeL.is_Object(wiki.latest_task_configuration.general.remove_unnecessary_WP_parameters)) {
				const parameter_Map = wiki.latest_task_configuration.general.remove_unnecessary_WP_parameters[wiki.namespace(talk_page_data, { is_page_title: true, get_name: true })];
				if (parameter_Map) {
					const all_custom_class_WikiProject_template_list = wiki.latest_task_configuration.general.all_custom_class_WikiProject_template_list;
					const all_custom_importance_WikiProject_template_list = wiki.latest_task_configuration.general.all_custom_importance_WikiProject_template_list;
					let _changed;
					for (const [key_pattern, value_pattern] of parameter_Map.entries()) {
						//console.log('remove_unnecessary_WP_parameters: Test pattern:', [key_pattern, value_pattern]);
						for (const [parameter_name, index] of Object.entries(token.index_of)) {
							const value = token.parameters[parameter_name];
							if ((CeL.is_RegExp(key_pattern) ? key_pattern.test(parameter_name) : key_pattern === parameter_name)
								&& (!all_custom_class_WikiProject_template_list || parameter_name !== 'class' || !wiki.is_template(all_custom_class_WikiProject_template_list, token))
								&& (!all_custom_importance_WikiProject_template_list || parameter_name !== 'importance' || !wiki.is_template(all_custom_importance_WikiProject_template_list, token))
								&& CeL.is_RegExp(value_pattern) ? value_pattern.test(value) : value_pattern === value) {
								// TODO: use CeL.wiki.parse.replace_parameter()
								token[index] = '';
								_changed = true;
							}
						}
					}

					if (_changed) {
						CeL.wiki.inplace_reparse_element(token, wiki.append_session_to_options({ remove_empty_parameters: true }));
					}
				}
			}

			if (token.parameters.class) {
				const normalized_class = normalize_class(token.parameters.class);
				if ((normalized_class in class_to_namespace_map)
					&& (class_to_namespace_map[normalized_class] === '*' || wiki.is_namespace(talk_page_data, class_to_namespace_map[normalized_class] || normalized_class + ' talk'))
				) {
					if (CeL.wiki.parse.replace_parameter(token, { class: CeL.wiki.parse.replace_parameter.KEY_remove_parameter })) {
						changed = true;
						CeL.wiki.inplace_reparse_element(token, wiki.append_session_to_options());
					}
				}

				add_class(token.parameters.class, is_opted_out);
			}

			const normalized_template_name = wiki.redirect_target_of(token);
			//console.trace(WikiProject_template_Map.get(normalized_template_name), token);
			if (WikiProject_template_Map.has(normalized_template_name)) {
				// Duplicate WikiProject banners. Merge the parameters to the first one.
				// Clean [[Category:Pages using WikiProject banner shell with duplicate banner templates]]
				if (!CeL.wiki.parse.merge_template_parameters(WikiProject_template_Map.get(normalized_template_name), token, {
					normalize_parameter(value, parameter_name) {
						if (parameter_name === 'class')
							return normalize_class(value);
						return value;
					}
				})) {
					changed = true;
					return parsed.each.remove_token;
				}
			} else {
				WikiProject_template_Map.set(normalized_template_name, token);
			}

			return;
		}
	});
	//console.log([class_from_other_templates, VA_template_token]);

	if (is_DAB && !do_PIQA) {
		CeL.warn(`${maintain_VA_template_each_talk_page.name}: Skip DAB article: ${CeL.wiki.title_link_of(talk_page_data)}`);
		return Wikiapi.skip_edit;
	}

	// new style from 2023/12:
	// merge [[Template:Vital article]] into [[Template:WikiProject banner shell]]
	if (VA_template_token
		// If there's a conflict in the ratings of the templates, keep {{Vital article}} first.
		&& (!WikiProject_banner_shell_token?.parameters.class || !VA_template_token?.parameters.class || WikiProject_banner_shell_token.parameters.class === VA_template_token.parameters.class)) {
		parsed.each('template', token => {
			if (wiki.is_template(template_name_hash.VA, token)) {
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
		//= VA_class
		;
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
				// [[w:en:User talk:Kanashimi#Majority rating]]
				if (majority_class[1].includes(VA_class)) {
					// 以 {{VA}} 為準。
					majority_class = VA_class;
				} else {
					// 最多的任意選一個。
					majority_class = majority_class[1][0];
				}
			} else {
				// assert: 不應該到這邊
				//majority_class = '';
				// 最多的任意選一個。
				majority_class = majority_class[1][0];
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
	// free
	class_from_other_templates_Map = null;

	// console.trace([VA_template_token?.parameters, article_info, +VA_template_token?.parameters.level !== +article_info.level]);
	// old style before 2023/12:
	// 2022/6/21:	對於這三者，皆應以基礎條目列表為主。若有誤應修改列表。
	if (false && (true
		|| !(VA_template_token?.parameters.level >= 1)
		// 高重要度層級的設定，應當覆蓋低重要度的。
		// 2022/6/21:	但假如此文章在基礎條目列表中被降格，還是應該記錄。應該遵循、修改的是列表而非談話頁面上的模板。
		|| +VA_template_token?.parameters.level !== +article_info.level
		|| !VA_template_token?.parameters.topic && article_info.topic)) {
		for (const property of ['level', 'topic', 'subpage']) {
			if ((property in article_info)
				// 取最小 level 之設定，其他的不覆蓋原有值。
				// 2022/6/21:	但假如此文章在基礎條目列表中被降格，還是應該記錄。應該遵循、修改的是列表而非談話頁面上的模板。
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

		article_info.reason = new CeL.gettext.Sentence_combination(article_info.reason);

		// new style from 2023/12: If the {{WikiProject banner shell}} does not exist, create one.
		let need_insert_WPBS = !WikiProject_banner_shell_token;
		if (WikiProject_banner_shell_token) {
			if (WikiProject_banner_shell_token.parameters.class !== majority_class) {
				// Using WPBS parameter first.
				has_different_ratings = true;
			}
			// 跳過 "{{t<!-- -->}}" 之類。
			if (WikiProject_banner_shell_token[0].type !== 'plain') {
				// Fix to the redirect target: bypass any redirects to {{WikiProject banner shell}} at the same time
				if (CeL.wiki.parse.replace_parameter(WikiProject_banner_shell_token, CeL.wiki.parse.replace_parameter.KEY_template_name,
					//wiki.remove_namespace(wiki.redirect_target_of(WikiProject_banner_shell_token))
					template_name_hash.WPBS
				)) {
					changed = true;
				}
			}
		} else if (
			// TODO: Test all aliases
			// https://en.wikipedia.org/w/index.php?title=Category_talk%3A21st-century_architecture_in_Morocco&diff=1197567269&oldid=1143023611
			/{\s*WikiProject\s*(?:banner|{{)/i.test(talk_page_data.wikitext)) {
			// [[w:en:User talk:Kanashimi#Periodic GIGO report]]
			CeL.warn(`${maintain_VA_template_each_talk_page.name}: ${CeL.wiki.title_link_of(talk_page_data)} may contain syntax error.`);
			WPBS_syntax_error_pages.push(talk_page_data.title);
			return Wikiapi.skip_edit;
		} else {
			WikiProject_banner_shell_token = CeL.wiki.parse(CeL.wiki.parse.template_object_to_wikitext(template_name_hash.WPBS));
			// assert: need_insert_WPBS === true
			//need_insert_WPBS = true;
			article_info.reason.push('Create {{WPBS}}.');
			changed = true;
		}

		if (false && majority_class && majority_class === VA_class)
			article_info.reason.push(`Keep the rating of {{VA}} ${JSON.stringify(majority_class)} in {{WPBS}}.`);
		if (majority_class && majority_class !== WikiProject_banner_shell_token.parameters.class)
			article_info.reason.push(`Keep majority rating ${JSON.stringify(majority_class)} in {{WPBS}}.`);

		// new style from 2023/12:
		const WPBS_template_object = {
			// Using WPBS parameter first.
			class: WikiProject_banner_shell_token.parameters.class || majority_class || '',

			// old style before 2023/12:
			//'1': value => wikitext_to_add + '\n' + (value ? value.toString().trimStart() : ''),
		};

		if (WPBS_template_object.class !== WikiProject_banner_shell_token.parameters.class)
			changed = true;

		if (article_info.remove_vital_parameter) {
			WPBS_template_object.vital = CeL.wiki.parse.replace_parameter.KEY_remove_parameter;
			changed = true;
		} else if (article_info.do_PIQA ? VA_template_token : !article_info.remove) {
			WPBS_template_object.vital = 'yes';
			changed = true;
		}

		/**{String|Undefined}去掉 WikiProject templates 之後剩下多餘的 wikitext */
		let extra_contents;

		// merge other {{WikiProject *}} into WikiProject_banner_shell_token
		// IIFE
		{
			const WikiProject_templates_and_allowed_elements = [], WPBS_to_check = new Set;
			WikiProject_templates_and_allowed_elements.WikiProject_template_count = 0;

			function move_to_WikiProject_templates(token, index, parent) {
				// assert: wiki.is_template(all_WikiProject_template_list, token)
				// assert: 'is_opted_out' in token

				if (parent === parsed) {
					// Move into {{WPBS}}.
					changed = true;
				}

				const parameters_to_remove_Set = new Set;
				/**
				 * remove class rating from wikiproject banner
				 * @param {Boolean|Array}is_opted_out is opted out WikiProject template
				 */
				function set_remove_needless_class(is_opted_out) {
					if (!('class' in token.parameters))
						return;

					if (!is_opted_out && wiki.latest_task_configuration.general.remove_WikiProject_class_parameter) {
						// Remove {{para|class|*}} of non-opted-out WikiProject templates.
						parameters_to_remove_Set.add('class');
						return;
					}

					if (!token.parameters.class.toString().trim()) {
						// remove |class= |
						parameters_to_remove_Set.add('class');
						return;
					}

					const normalize_token_class = normalize_class(
						Array.isArray(token.parameters.class) && token.parameters.class.type === 'plain'
							? CeL.wiki.wikitext_to_plain_text(token.parameters.class).trim()
							: token.parameters.class
					);
					//console.trace([ token, token.parameters.class, WPBS_template_object, normalize_token_class, normalize_class(WPBS_template_object.class) ]);

					// [[w:en:User talk:Kanashimi#Redundant class parameter]]
					if (normalize_token_class === 'NA') {
						// remove |class=NA|
						parameters_to_remove_Set.add('class');
						return;
					}

					if ((is_opted_out || has_different_ratings) && normalize_token_class !== normalize_class(WPBS_template_object.class)
						// 有特殊 token 如 comment 不動。 e.g., [[w:en:Talk:95-10 Initiative]]
						|| Array.isArray(token.parameters.class) && token.parameters.class.type !== 'plain'
					) {
						if (!article_info.reason.untouched_message) {
							// gettext_config:{"id":"keep-different-ratings-in-$2"}
							article_info.reason.untouched_message = ['Keep %1 different {{PLURAL:%1|rating|ratings}} in %2.', 0, []];
							article_info.reason.push(article_info.reason.untouched_message);
						}
						article_info.reason.untouched_message[2].push(token.name);
						//console.trace([is_opted_out, has_different_ratings, token.parameters.class, normalize_class(token.parameters.class), normalize_class(WPBS_template_object.class), WPBS_template_object]);
						return;
					}

					//console.trace(normalize_token_class, !is_standard_class(normalize_token_class), normalize_class(WPBS_template_object.class || WikiProject_banner_shell_token.parameters.class));
					if (!is_standard_class(normalize_token_class)
						&& normalize_token_class !== normalize_class(WPBS_template_object.class || WikiProject_banner_shell_token.parameters.class)) {
						// 有衝突的 class，但非正規 class。
						// 不該消除非正規的 class，否則可能漏失資訊。因為這些在 add_class() 不會被記入，也不會被列入 {{WPBS|class=}} 候選。
						// e.g., |class=SI @ [[Talk:HMAS Broome]]
						return;
					}

					if (!article_info.reason.touched_message) {
						// (%1)
						// gettext_config:{"id":"remove-the-same-ratings-as-template-wpbs-in-$2"}
						article_info.reason.touched_message = ['Remove %1 same {{PLURAL:%1|rating|ratings}} as {{WPBS}} in %2.', 0, []];
						article_info.reason.push(article_info.reason.touched_message);
					}
					article_info.reason.touched_message[2].push(token.name);
					parameters_to_remove_Set.add('class');

					if (!Array.isArray(token.parameters.class)) {
						return;
					}
					// assert: token.parameters.class.type === 'plain'

					let previous_element = token[token.index_of.class - 1];
					if (!CeL.wiki.is_parsed_element(previous_element)) {
						// assert: typeof previous_element === 'string'
						previous_element = token[token.index_of.class - 1] = CeL.wiki.parse.set_wiki_type(
							// 為了整行刪掉。
							// e.g., for [[Talk:Bar mleczny]]
							previous_element.trimEnd(), 'plain');
					} else if (token[token.index_of.class - 1].length === 4) {
						// assert: /^\s+$/.test(token[token.index_of.class - 1][3])
						token[token.index_of.class - 1].pop();
					}

					// 採用 token.parameters.class 恐漏掉最後的空白字元。
					token[token.index_of.class][2].forEach(sub_token => {
						if (typeof sub_token === 'string') {
							previous_element.push(sub_token.replace(new RegExp(WPBS_template_object.class, 'i'), ''));
						} else {
							previous_element.push(sub_token);
						}
					});
					if (token[token.index_of.class][3]) {
						// assert: token[token.index_of.class].length === 3
						// assert: /^\s+$/.test(token[token.index_of.class][3])
						previous_element.push(token[token.index_of.class][3]);
					}

					// 預防 `CeL.wiki.parse.replace_parameter(token, parameters_argument)` 出問題。
					//CeL.wiki.inplace_reparse_element(token, wiki.append_session_to_options());
				}

				// assert: token.is_opted_out === false
				function move_parameters(parameters_to_move) {
					for (const [parameter_name_to_remove, parameter_configuration] of Object.entries(parameters_to_move)) {
						if (!(parameter_name_to_remove in token.parameters))
							continue;
						let value = token.parameters[parameter_name_to_remove];

						// fix parameter value
						if (typeof value === 'string') {
							value = value.replace(PATTERN_invalid_parameter_value_to_remove, '');
						}

						if (!value.toString().trim()) {
							// 直接消掉 WikiProject template token 無意義的、空的 parameter。
							parameters_to_remove_Set.add(parameter_name_to_remove);
							continue;
						}

						if (parameter_configuration.value_filter && !parameter_configuration.value_filter.test(value)) {
							continue;
						}

						// These parameters will move to {{WikiProject banner shell}}
						// TODO: If contains comment...
						const move_to_parameter_name = parameter_configuration?.move_to_parameter_name
							|| typeof parameter_configuration === 'string' && parameter_configuration
							|| parameter_name_to_remove;

						if (!are_equivalent_parameter_values(value, WikiProject_banner_shell_token.parameters[move_to_parameter_name], parameter_configuration)
							|| !are_equivalent_parameter_values(value, WPBS_template_object[move_to_parameter_name], parameter_configuration)) {
							// 保留 value 不同的 parameters。
							continue;
						}

						if (parameter_configuration.token_modifier) {
							if (parameter_configuration.token_modifier({ parameter_name_to_remove, value, token, WPBS_template_object }))
								parameters_to_remove_Set.add(parameter_name_to_remove);
							continue;
						}

						if (!WPBS_template_object[move_to_parameter_name]
							// 取較完整的 value。
							|| WPBS_template_object[move_to_parameter_name].toString().trim().length < value.toString().trim().length) {
							WPBS_template_object[move_to_parameter_name] = value;
						}
						parameters_to_remove_Set.add(parameter_name_to_remove);
					}
				}

				// [[w:en:User talk:Kanashimi#Moving listas value]]
				move_parameters(parameters_move_from_any_WikiProjects_to_WPBS);

				if (wiki.is_template(parameters_move_from_WikiProjects_to_WPBS__template_list, token)) {
					const template_name = wiki.remove_namespace(wiki.redirect_target_of(token));
					const parameters_to_move = parameters_move_from_WikiProjects_to_WPBS[template_name];
					if (parameters_to_move) {
						move_parameters(parameters_to_move);
					} else {
						throw new Error(`Cannot find parameters moving configuration of {{${template_name}}}!`);
					}
				}

				if (wiki.is_template(all_opted_out_WikiProject_template_list, token)) {
					// assert: token.is_opted_out === true
					// 有些選擇退出的模板有自己的展示方式，利用到class參數，不能完全用[[Module:WikiProject banner]]解決。e.g., {{WikiProject Military history}}
					//set_remove_needless_class(true);
				} else {
					set_remove_needless_class();
				}

				WikiProject_templates_and_allowed_elements.push(token);
				WikiProject_templates_and_allowed_elements.WikiProject_template_count++;
				// 跳過 "{{t<!-- -->}}" 之類。
				if (token[0].type !== 'plain') {
					// Fix to the redirect target
					if (CeL.wiki.parse.replace_parameter(token, CeL.wiki.parse.replace_parameter.KEY_template_name, wiki.remove_namespace(wiki.redirect_target_of(token)))) {
						//changed = true;
					}
				}

				// fix [[Category:WikiProject templates with unknown parameters]]
				// @see [[Wikipedia:Bots/Requests for approval/BattyBot 79]]
				if (template_list_of_deprecated_parameters && wiki.is_template(template_list_of_deprecated_parameters, token)) {
					const parameters_hash = deprecated_parameter_hash[wiki.remove_namespace(wiki.redirect_target_of(token))];
					//console.trace([parameters_hash, wiki.redirect_target_of(token), token.toString()]);
					if (CeL.is_Object(parameters_hash)) {
						for (const parameter_to_remove in parameters_hash) {
							if ((parameter_to_remove in token.parameters)
								&& (parameters_hash[parameter_to_remove] === CeL.wiki.parse.replace_parameter.KEY_remove_parameter
									|| parameters_hash[parameter_to_remove].toString() === token.parameters[parameter_to_remove].toString())) {
								if (!article_info.reason.remove_parameters) {
									article_info.reason.remove_parameters = ['Remove %1 deprecated {{PLURAL:%1|parameter|parameters}}: %2.', 0, []];
									article_info.reason.push(article_info.reason.remove_parameters);
								}
								article_info.reason.remove_parameters[2].push(parameter_to_remove);
								parameters_to_remove_Set.add(parameter_to_remove);
							}
						}
					} else {
						// Should not go to here.
						CeL.error(`Cannot find configuration of ${wiki.redirect_target_of(token)} (${token})`);
					}
				}

				if (parameters_to_remove_Set.size > 0) {
					//console.trace('Remove parameters:', parameters_to_remove_Set);
					const parameters_argument = Object.create(null);
					parameters_to_remove_Set.forEach(parameter => parameters_argument[parameter] = CeL.wiki.parse.replace_parameter.KEY_remove_parameter);
					if (CeL.wiki.parse.replace_parameter(token, parameters_argument)) {
						changed = true;
					}
				}

				// fix for [[Wikipedia:Bots/Requests for approval/EnterpriseyBot 10]]
				for (let _index = index; ++_index < parent.length;) {
					/** 接著的 token */
					const follow_token = parent[_index];
					if (follow_token.toString().trim()) {
						// e.g., "<!-- Formerly assessed as Start-class -->"
						if (follow_token.type === 'comment' && follow_token.length === 1 && /assessed as (?:\w+-class|class-\w+)/.test(follow_token[0])) {
							if (!token.parameters.class) {
								if (CeL.wiki.parse.replace_parameter(token, { class: follow_token }, { value_only: true, force_add: true, no_value_space: true, })) {
									changed = true;
								}
							}
							for (let i = index; ++i <= _index;) {
								// TODO: use CeL.wiki.parse.replace_parameter()
								parent[i] = '';
							}
						}
						break;
					}
				}

				return parsed.each.remove_token;
			}

			parsed.each('template', (token, index, parent) => {
				if (wiki.is_template(template_name_hash.WPBS, token)) {
					if (token === WikiProject_banner_shell_token) {
						//console.trace(WikiProject_banner_shell_token[WikiProject_banner_shell_token.index_of[1]]);
						WikiProject_banner_shell_token.index = index;
						WikiProject_banner_shell_token.parent = parent;
						if (!WikiProject_banner_shell_token.parameters[1]) {
							return;
						}
						CeL.wiki.parser.parser_prototype.each.call(WikiProject_banner_shell_token[WikiProject_banner_shell_token.index_of[1]], (token, index, parent) => {
							if (!token && token !== '') {
								console.trace([parent, index, token]);
								//return;
							}
							if (token.type === 'commit') {
								WikiProject_templates_and_allowed_elements.push(token);
								return parsed.each.remove_token;
							}
							if (token.type === 'transclusion' && wiki.is_template(all_WikiProject_template_list, token)) {
								return move_to_WikiProject_templates(token, index, parent);
							}
							// /^WikiProject /.test(token.name)
							if (token.type === 'transclusion' && wiki.latest_task_configuration.general.preserve_template_name_in_WPBS && wiki.latest_task_configuration.general.preserve_template_name_in_WPBS.test(token.name)) {
								WikiProject_templates_and_allowed_elements.push(token);
								return parsed.each.remove_token;
							}
						});
						// 已處理過 |1= 的內部元素，可直接跳過。剩下的元素將會被列在 extra_contents。
						return parsed.each.skip_inner;
					}

					// 這時候 token 裡面的 WikiProject templates 可能還沒清空!
					WPBS_to_check.add(token);
					return;
				}

				if (wiki.is_template(all_WikiProject_template_list, token)) {
					return move_to_WikiProject_templates(token, index, parent);
				}
			});

			// 到這邊所有 WikiProject templates 應皆已自 parsed 移到 WikiProject_templates_and_allowed_elements，可以開始檢查 WPBS_to_check 是否為空。
			if (WPBS_to_check.size > 0) {
				parsed.each('Template:' + template_name_hash.WPBS, (token, index, parent) => {
					if (!WPBS_to_check.has(token))
						return;

					CeL.wiki.inplace_reparse_element(token, wiki.append_session_to_options());
					for (const parameter_name in token.parameters) {
						if (!/^[\s{}]*$/.test(token.parameters[parameter_name])) {
							return;
						}
					}
					changed = true;
					CeL.warn(`移除空的重複 WPBS ${token}`);
					return parsed.each.remove_token;
				});
			}

			//console.trace('WikiProject_banner_shell_token:', WikiProject_banner_shell_token.toString());
			//console.trace('WikiProject_banner_shell_token.parameters[1]:', WikiProject_banner_shell_token[WikiProject_banner_shell_token.index_of[1]]);
			//console.trace('WikiProject_templates_and_allowed_elements: ', WikiProject_templates_and_allowed_elements);
			if (WikiProject_templates_and_allowed_elements.length > 0) {
				// assert: WikiProject_template_Map.size > 0
				CeL.wiki.inplace_reparse_element(WikiProject_banner_shell_token, wiki.append_session_to_options());
				// adding to the bottom of the banner shell
				if (WikiProject_banner_shell_token.parameters[1]) {
					// 避免消除原有內容。
					// TODO: https://en.wikipedia.org/w/index.php?title=Talk:Amphetamine&diff=prev&oldid=1192899833
					extra_contents = WikiProject_banner_shell_token.parameters[1].toString().trim();
					if (/{{\s*WikiProject [.+]+}}/.test(extra_contents)) {
						// [[w:en:User talk:Kanashimi#Moving 'WikiProject Irish Republicanism' outside of banner shell]]
						console.error(`${maintain_VA_template_each_talk_page.name}: WPBS 中包含 {{WikiProject}}！或許是因為執行 categorymembers 時 API 未包含這個 WikiProject？`);
						console.trace(extra_contents);
						throw new Error('WPBS contains {{WikiProject}}');
					}
					if (/^[{}\s]+$/.test(extra_contents)) {
						// 只剩下不需要的特殊字符。
						// [[w:en:User talk:Kanashimi#Potential bot issue: extra brackets]]
						extra_contents = '';
					}
				}
				WPBS_template_object[1] = ('\n' + WikiProject_templates_and_allowed_elements
					// [[Wikipedia:Bots/Requests for approval/Qwerfjkl (bot) 26]]
					// "consolidate the banners into one line"
					.map(WikiProject_template => {
						const wikitext = WikiProject_template.toString();
						// e.g., [[Talk:John J. Kelly]], [[Talk:Mohammad Bana]]
						return /<\!--|\n==|\n{{/.test(wikitext) ? wikitext : wikitext.replace(/\n/g, '');
					}).join('\n') + '\n')
					// 去掉太多的換行。
					.replace(/\n{2,}/g, '\n');
				// gettext_config:{"id":"$1-wikiproject-templates"}
				article_info.reason.unshift(['%1 WikiProject {{PLURAL:%1|template|templates}}.', WikiProject_templates_and_allowed_elements.WikiProject_template_count]);
			}
		}

		if (!WPBS_template_object.class)
			delete WPBS_template_object.class;

		// [[w:en:User talk:Kanashimi/Archive 1#Another bot issue about |living=yes and |blp=yes]]
		// [[w:en:User talk:Kanashimi/Archive 1#blp/living]]
		// Only keep |blp=
		if (WPBS_template_object.living && CeL.wiki.Yesno(WPBS_template_object.living) === CeL.wiki.Yesno(WikiProject_banner_shell_token.parameters.blp || WPBS_template_object.blp)) {
			delete WPBS_template_object.living;
		}
		if (WPBS_template_object.blp && CeL.wiki.Yesno(WPBS_template_object.blp) === CeL.wiki.Yesno(WikiProject_banner_shell_token.parameters.living)) {
			// 很少到這邊。
			delete WPBS_template_object.blp;
		}
		if (WikiProject_banner_shell_token.parameters.living?.toString().trim() === '' && !WPBS_template_object.living) {
			// [[w:en:Talk:Abdul Hai Sarker]]
			WPBS_template_object.living = CeL.wiki.parse.replace_parameter.KEY_remove_parameter;
		} else if (WikiProject_banner_shell_token.parameters.living) {
			if (!WikiProject_banner_shell_token.parameters.blp && !WPBS_template_object.blp) {
				// [[w:en:Talk:Tom Hales (Irish republican)]]
				WPBS_template_object.blp = WikiProject_banner_shell_token.parameters.living;
				WPBS_template_object.living = CeL.wiki.parse.replace_parameter.KEY_remove_parameter;
			} else if (CeL.wiki.Yesno(WikiProject_banner_shell_token.parameters.living) === CeL.wiki.Yesno(WikiProject_banner_shell_token.parameters.blp)) {
				WPBS_template_object.living = CeL.wiki.parse.replace_parameter.KEY_remove_parameter;
			}
		}

		if (CeL.is_Object(wiki.latest_task_configuration.general.remove_unnecessary_WPBS_parameters)) {
			const parameter_Map = wiki.latest_task_configuration.general.remove_unnecessary_WPBS_parameters[wiki.namespace(talk_page_data, { is_page_title: true, get_name: true })];
			if (parameter_Map) {
				for (const [key_pattern, value_pattern] of parameter_Map.entries()) {
					//console.log('remove_unnecessary_WPBS_parameters: Test pattern:', [key_pattern, value_pattern]);
					for (const [parameter_name, index] of Object.entries(WikiProject_banner_shell_token.index_of)) {
						const value = WikiProject_banner_shell_token.parameters[parameter_name];
						if ((CeL.is_RegExp(key_pattern) ? key_pattern.test(parameter_name) : key_pattern === parameter_name)
							&& CeL.is_RegExp(value_pattern) ? value_pattern.test(value) : value_pattern === value) {
							WPBS_template_object[parameter_name] = CeL.wiki.parse.replace_parameter.KEY_remove_parameter;
						}
					}

					for (const [parameter_name, value] of Object.entries(WPBS_template_object)) {
						if ((CeL.is_RegExp(key_pattern) ? key_pattern.test(parameter_name) : key_pattern === parameter_name)
							&& CeL.is_RegExp(value_pattern) ? value_pattern.test(value) : value_pattern === value) {
							// 不能光直接 delete，因 WikiProject_banner_shell_token 可能已存在此參數。
							WPBS_template_object[parameter_name] = CeL.wiki.parse.replace_parameter.KEY_remove_parameter;
						}
					}
				}

			}
		}

		//console.trace(WikiProject_banner_shell_token.parameters, WPBS_template_object);

		if (Object.keys(WPBS_template_object).length > 0) {
			//console.trace([WPBS_template_object, WikiProject_banner_shell_token[WikiProject_banner_shell_token.index_of[1]]]);
			if (CeL.wiki.parse.replace_parameter(WikiProject_banner_shell_token, WPBS_template_object, {
				value_only: true, force_add: true,
				// {{WikiProject banner shell|class=|vital=yes|1=\n...\n}}
				before_parameter: 1, no_value_space: true,
			})) {
				changed = true;
			}
			//console.trace(WikiProject_banner_shell_token, WikiProject_banner_shell_token.toString());
		} else if (WikiProject_template_Map.size === 0) {
			let remove_WPBS;
			parsed.each('Template:' + template_name_hash.WPBS, token => {
				for (const parameter_name in token.parameters) {
					if (token.parameters[parameter_name].toString().trim()) {
						return;
					}
				}
				if (token === WikiProject_banner_shell_token)
					WikiProject_banner_shell_token = null;
				remove_WPBS = true;
				return parsed.each.remove_token;
			});
			if (need_insert_WPBS) {
				need_insert_WPBS = false;
			}
			if (remove_WPBS) {
				changed = true;
				article_info.reason.push(`Remove empty {{WPBS}}`);
			}
			// assert: !!extra_contents === false
		}

		if (WikiProject_template_Map.size > 0 && CeL.wiki.parse.redirect(talk_page_data)) {
			CeL.error(`${maintain_VA_template_each_talk_page.name}: ${CeL.wiki.title_link_of(talk_page_data)} redirecting to ${CeL.wiki.title_link_of(CeL.wiki.parse.redirect(talk_page_data))}`);
			//return Wikiapi.skip_edit;
		}

		if (changed && WikiProject_banner_shell_token) {
			CeL.wiki.inplace_reparse_element(WikiProject_banner_shell_token, wiki.append_session_to_options());
			if (WikiProject_banner_shell_token.index_of[1] > 0 && WikiProject_banner_shell_token.index_of[1] !== WikiProject_banner_shell_token.length - 1) {
				// [[w:en:User talk:Kanashimi#Category:Pages with redundant living parameter]]
				// 把 |1= 移到最後一個參數。

				//console.trace(talk_page_data.title, WikiProject_banner_shell_token.toString(), WikiProject_banner_shell_token);

				let _parameter = WikiProject_banner_shell_token[WikiProject_banner_shell_token.length - 1];
				_parameter = _parameter.toString().replace(/\n\s*$/, '');
				WikiProject_banner_shell_token[WikiProject_banner_shell_token.length - 1] = _parameter;

				const parameter_of_1 = WikiProject_banner_shell_token.splice(WikiProject_banner_shell_token.index_of[1], 1);
				WikiProject_banner_shell_token.push(parameter_of_1);

				CeL.wiki.inplace_reparse_element(WikiProject_banner_shell_token, wiki.append_session_to_options());
			}
		}

		// TODO: resort WikiProject_banner_shell_token
		// <s>可考慮插入於原 {{Vital article}} 處？</s>
		if (need_insert_WPBS) {
			//CeL.info(`${CeL.wiki.title_link_of(talk_page_data)}: Add ${WikiProject_banner_shell_token.toString().trim()}`);

			// [[w:en:Wikipedia:Talk page layout#Lead (bannerspace)]]
			parsed.insert_layout_element(WikiProject_banner_shell_token, {
				fine_tuning_layout(token) {
					if (!extra_contents)
						return token;
					// Any non-project banners (i.e. not produced with Module:WikiProject banner) should be moved outside the banner shell ideally
					return token + '\n' + extra_contents;
				}
			});
		} else if (extra_contents) {
			WikiProject_banner_shell_token.parent.splice(WikiProject_banner_shell_token.index + 1, 0, '\n' + extra_contents);
		}

		//console.trace(need_insert_WPBS, WPBS_template_object, WikiProject_banner_shell_token, [extra_contents, WikiProject_banner_shell_token.toString()]);
	}

	const wikitext = parsed.toString().trim()
		// e.g., [[Talk:Fiscal policy]]
		//.replace(/{{Suppress categories\s*\|\s*}}\n*/ig, '')
		;
	//console.trace([talk_page_data.title, article_info, typeof VA_template_object !== 'undefined' && VA_template_object, wikitext.replace(/\n==[\s\S]+$/, ''), parsed.slice(0, 5)]);
	//return Wikiapi.skip_edit;

	if (false) {
		// for debug
		if (wikitext === talk_page_data.wikitext)
			return Wikiapi.skip_edit;
		if (++maintain_VA_template_count > 50)
			return Wikiapi.skip_edit;
		// console.log(wikitext);
	}

	if (!wikitext && !talk_page_data.wikitext?.trim())
		return Wikiapi.skip_edit;
	// assert: wikitext === '' && Remove empty {{WPBS}}

	if (all_parameters_fix_count > 0) {
		changed = true;
		article_info.reason.push(['Fix %1 misspelled {{PLURAL:%1|parameter|parameters}}.', all_parameters_fix_count]);
	}

	if (article_info.full_summary) {
		this.summary = article_info.full_summary;
	} else {
		this.summary = new CeL.gettext.Sentence_combination((article_info.talk_page_summary_prefix || talk_page_summary_prefix) + ':');
		if (article_info.reason) {
			if (article_info.reason.touched_message) {
				article_info.reason.touched_message[1] = article_info.reason.touched_message[2].length;
				article_info.reason.touched_message[2] =
					article_info.reason.touched_message[2].map(template_name => `{{${template_name}}}`)
						// gettext_config:{"id":"Comma-separator"}
						.join(CeL.gettext('Comma-separator'));
			}
			if (article_info.reason.untouched_message) {
				article_info.reason.untouched_message[1] = article_info.reason.untouched_message[2].length;
				article_info.reason.untouched_message[2] =
					article_info.reason.untouched_message[2].map(template_name => `{{${template_name}}}`)
						// gettext_config:{"id":"Comma-separator"}
						.join(CeL.gettext('Comma-separator'));
			}
			if (article_info.reason.remove_parameters) {
				article_info.reason.remove_parameters[1] = article_info.reason.remove_parameters[2].length;
				article_info.reason.remove_parameters[2] =
					article_info.reason.remove_parameters[2]
						// gettext_config:{"id":"Comma-separator"}
						.join(CeL.gettext('Comma-separator'));
			}
			if (Array.isArray(article_info.reason))
				this.summary.append(article_info.reason);
			else
				this.summary.push(article_info.reason);
		}
		if (!article_info.no_topic_message && !wiki.latest_task_configuration.no_topic_summary) {
			if (article_info.topic) {
				let message = `Configured as topic=${article_info.topic}`;
				if (article_info.subpage)
					message += ', subpage=' + article_info.subpage;
				message += '.';
				this.summary.push(message);
			} else if (!article_info.remove) {
				this.summary.push(CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title + '#' + 'Topics', 'Config the topic of this page'));
			}
		}
		this.summary = this.summary.toString();
	}

	if (article_info.category_to_clean) {
		this.summary += ` (Fix ${CeL.wiki.title_link_of(article_info.category_to_clean)})`;
	}

	if (!changed) {
		if (Date.now() - Date.parse(CeL.wiki.content_of.revision(talk_page_data).timestamp) > CeL.to_millisecond('8 hour')) {
			CeL.error(`${maintain_VA_template_each_talk_page.name}: No change: ${CeL.wiki.title_link_of(talk_page_data)} (revid=${CeL.wiki.content_of.revision(talk_page_data).revid})`);
			//console.trace(article_info);
			// do a [[WP:NULLEDIT|null edit]].
			this.skip_nochange = false;
		}
	}

	//console.trace(this, article_info);
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
			else if (record[1] === wiki.latest_task_configuration.general.base_page)
				record[1] = DEFAULT_LEVEL;
		}
		if (!record[1]) console.trace(category_level_of_page, page_title, record);
		if (/^[1-5](?:\/.+)?$/.test(record[1])) {
			record[1] = level_page_link(record[1], true);
		} else if (record[1]?.startsWith(wiki.latest_task_configuration.general.base_page)) {
			record[1] = CeL.wiki.title_link_of(record[1]);
		}
	});

	const report_count = report_lines.length;
	let report_wikitext;
	if (report_count > 0) {
		report_lines.unshift(['Page title', 'Detailed level', 'Situation']);
		report_wikitext = CeL.wiki.array_to_table(report_lines, {
			class: "wikitable sortable"
		});
		if (!CeL.is_empty_object(have_to_edit_its_talk_page))
			report_wikitext = `* ${Object.keys(have_to_edit_its_talk_page).length} talk page(s) to edit${options.no_editing_of_talk_pages ? ' (The amount of talk pages to edit exceeds the value of talk_page_limit_for_editing on the configuration page. Will not edit the talk pages at all.)' : ''}.\n` + report_wikitext;
		if (report_lines.skipped_records > 0)
			report_wikitext = `* Skip ${report_lines.skipped_records.toLocaleString()} record(s).\n` + report_wikitext;
	} else {
		report_wikitext = "* '''So good, no news!'''";
	}

	// [[WP:DBR]]: 使用<onlyinclude>包裹更新時間戳。
	// __NOTITLECONVERT__
	// "Sometimes you may need to do a [[WP:NULLEDIT|null edit]]."
	report_wikitext = `__NOCONTENTCONVERT__
* Configuration: ${CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title)}
* The report will update automatically.
* If the category level different to the level listed<ref name="c">Category level is different to the level article listed in.</ref>, maybe the article is redirected<ref name="e">Redirected or no level assigned in talk page. Please fix this issue manually.</ref>.
* Generate date: <onlyinclude>~~~~~</onlyinclude>
${report_mark_start}${report_wikitext}${report_mark_end}
[[${wiki.site_name() === 'zhwiki' ? 'Category:基礎條目' : 'Category:Wikipedia vital articles'}]]
`;

	await wiki.edit_page(wiki.latest_task_configuration.general.report_page,
		report_wikitext, {
		bot: 1,
		nocreate: 1,
		summary: `${CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title,
			// gettext_config:{"id":"vital-articles-update-report"}
			CeL.gettext('Vital articles update report'))}: ${report_count + (report_lines.skipped_records > 0 ? '+' + report_lines.skipped_records : '')} record(s)`
	});
}
