/*

2020/1/23 14:24:58	初版試營運	Update the section counts and article assessment icons for all levels of [[Wikipedia:Vital articles]].

TODO:
report level/class change

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

CeL.run('application.net.wiki.featured_content');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('en');
/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

prepare_directory(base_directory, true);

// ----------------------------------------------

// badge
const page_info_cache_file = `${base_directory}/articles attributes.json`;
const page_info_cache = CeL.get_JSON(page_info_cache_file);

/** {Object}icons_of_page[title]=[icons] */
const icons_of_page = page_info_cache && page_info_cache.icons_of_page || Object.create(null);
/** {Object}level of page get from category. icons_of_page[title]=1–5 */
const level_of_page = page_info_cache && page_info_cache.level_of_page || Object.create(null);
/** {Object}page_listed_in[title]=[level,level,...] */
const page_listed_in = Object.create(null);

const base_page = 'Wikipedia:Vital articles';
// [[Wikipedia:Vital articles/Level/3]] redirect to→ `base_page`
const DEFAULT_LEVEL = 3;

const report_lines = [];
report_lines.skipped_records = 0;

// ----------------------------------------------------------------------------

(async () => {
	await wiki.login(user_name, user_password, use_language);
	// await wiki.login(null, null, use_language);
	await main_process();
})();

async function main_process() {
	wiki.FC_data_hash = page_info_cache && page_info_cache.FC_data_hash;
	if (!wiki.FC_data_hash) {
		await get_page_info();
		CeL.write_file(page_info_cache_file, { level_of_page, icons_of_page, FC_data_hash: wiki.FC_data_hash });
	}

	// ----------------------------------------------------

	const vital_articles_list = (await wiki.prefixsearch(base_page)) || [
		// 1,
		// 2,
		// 3 && '',
		'4/People',
		// '4/History',
		// '4/Physical sciences',
		// '5/People/Writers and journalists',
		// '5/People/Artists, musicians, and composers',
		// '5/Physical sciences/Physics',
		// '5/Technology',
		// '5/Everyday life/Sports, games and recreation',
		// '5/Mathematics',
	].map(level => `${base_page}${level ? `/Level/${level}` : ''}`);
	// console.log(vital_articles_list.length);

	await wiki.for_each_page(vital_articles_list, for_each_list_page, {
		redirects: 1,
		bot: 1,
		minor: false,
		log_to: null,
		summary: '[[Wikipedia:Database reports/Vital articles update report|Update the section counts and article assessment icons]]'
	});

	// ----------------------------------------------------

	check_page_count();

	//await wiki.for_each_page(Object.keys(need_edit_VA_template).map(wiki.to_talk_page), maintain_VA_template);

	// ----------------------------------------------------

	await generate_report();

	CeL.info(`${(new Date).format()}	done.`);
}

// ----------------------------------------------------------------------------

const icon_to_category = Object.create(null);

// All attributes of articles get from corresponding categories.
async function get_page_info() {
	await wiki.get_featured_content({
		on_conflict(FC_title, data) {
			report_lines.push([FC_title, , `Category conflict: ${data.from}→${CeL.wiki.title_link_of('Category:' + data.category, data.to)}`]);
		}
	});
	// console.log(wiki.FC_data_hash);

	// ---------------------------------------------

	// Skip [[Category:All Wikipedia level-unknown vital articles]]
	for (let i = 5; i >= 1; i--) {
		const page_list = await wiki.categorymembers(`All Wikipedia level-${i} vital articles`);
		page_list.forEach(page_data => {
			const title = CeL.wiki.talk_page_to_main(page_data.original_title || page_data);
			if (title in level_of_page) {
				report_lines.push([title, , `${level_of_page[title]}→${i}`]);
			}
			level_of_page[title] = i;
		});
	}
	// console.log(level_of_page);

	// ---------------------------------------------

	// list an article's icon for current quality status always first
	// they're what the vital article project is most concerned about.
	// [[Category:Wikipedia vital articles by class]]
	//
	// [[Category:All Wikipedia List-Class vital articles]]
	// duplicated with [[Category:List-Class List articles]]
	//
	// [[Wikipedia:Content_assessment#Grades]]
	// FA|FL|GA|List|
	'A|B|C|Start|Stub|Unassessed'.split('|').forEach(icon => icon_to_category[icon] = `All Wikipedia ${icon}-Class vital articles`);
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

		LIST: 'List-Class List articles',

		// The icons that haven't been traditionally listed (peer review, in the
		// news) might even be unnecessary.
		// PR: 'Old requests for peer review',
		// ITN: 'Wikipedia In the news articles',
		// OTD: 'Article history templates with linked otd dates',
	});
	for (let icon in icon_to_category) {
		const category_name = icon_to_category[icon];
		const pages = await wiki.categorymembers(category_name);
		pages.forEach(page_data => {
			const title = CeL.wiki.talk_page_to_main(page_data.original_title || page_data);
			if (title in icons_of_page) {
				icons_of_page[title].push(icon);
			} else {
				icons_of_page[title] = [icon];
			}
		});
	}
	// console.log(icons_of_page);
}

// ----------------------------------------------------------------------------

function level_page_link(level, number_only, page_title) {
	return `[[${page_title || (level === DEFAULT_LEVEL ? base_page : base_page + '/Level/' + level)}|${number_only ? '' : 'Level '}${level}]]`;
}

function level_of_page_title(page_title, number_only) {
	// page_title.startsWith(base_page);
	// [, 1–5, section ]
	const matched = page_title.match(/\/Level(?:\/(\d)(\/.+)?)?$/);
	if (matched) {
		const level = number_only || !matched[2] ? + matched[1] || DEFAULT_LEVEL : matched[1] + matched[2];
		return level;
	}
}

function replace_level_note(item, index, category_level, new_wikitext) {
	if (item.type !== 'plain')
		return;

	const rest_wikitext = item.slice(index + 1).join('').trim();
	const PATTERN_level = /\s*\((?:level \d|\[\[([^\[\]\|]+)\|level \d\]\])\)/i;
	const matched = rest_wikitext && rest_wikitext.match(PATTERN_level);

	if (new_wikitext === undefined) {
		new_wikitext = ` (${level_page_link(category_level, false, matched &&
			//preserve level page. e.g., " ([[Wikipedia:Vital articles/Level/2#Society and social sciences|Level 2]])"
			(category_level === DEFAULT_LEVEL || matched[1] && matched[1].includes(`/${category_level}`)) && matched[1])})`;
	}
	// assert: typeof new_wikitext === 'string'
	// || typeof new_wikitext === 'number'

	// Decide whether we need to replace or not.
	if (new_wikitext ? rest_wikitext.includes(new_wikitext)
		// new_wikitext === '': Remove level note.
		: !matched) {
		return;
	}

	item.truncate(index + 1);
	// _item.push()
	item[index + 1] = rest_wikitext ? rest_wikitext.replace(PATTERN_level, new_wikitext) : new_wikitext;
	return true;
}

function for_each_list_page(list_page_data) {
	const level = level_of_page_title(list_page_data.title, true) || DEFAULT_LEVEL;
	// console.log([list_page_data.title, level]);
	const parsed = list_page_data.parse();
	// console.log(parsed);
	parsed.each_section();
	// console.log(parsed.subsections);
	// console.log(parsed.subsections[0]);
	// console.log(parsed.subsections[0].subsections[0]);

	const article_count_of_icon = Object.create(null);

	let latest_section;

	function for_item(item, index, list) {
		if (item.type === 'list') {
			item.forEach(for_item);
			return;
		}

		let item_wikitext, icons = [];
		function for_item_token(token, index, _item) {
			let parent_of_link;
			if (!item_wikitext && token.type !== 'link') {
				//For token.type 'bold', 'italic', finding the first link children.
				//e.g., `'' [[title]] ''`, `''' [[title]] '''`, `''''' [[title]] '''''`
				parsed.each.call(token, (_token, index, parent) => {
					if (_token.type === 'link') {
						//assert: token.type === 'link'
						token = _token;
						token.index = index;
						parent_of_link = parent;
						return parsed.each.exit;
					}
					if (typeof _token === 'string'
						//e.g., "{{Icon|A}} ''[[title]]"
						&& !/^['\s]*$/.test(_token)) {
						//Skip links with non-space prefix.
						return parsed.each.exit;
					}
				});
			}
			if (token.type === 'link' && !item_wikitext) {
				const page_title = token[0].toString();
				if (!(page_title in page_listed_in)) {
					page_listed_in[page_title] = [];
				}
				page_listed_in[page_title].push(level_of_page_title(list_page_data.title));

				if (page_title in icons_of_page) {
					icons.append(icons_of_page[page_title]);
				}

				if (page_title in wiki.FC_data_hash) {
					icons.append(wiki.FC_data_hash[page_title].types);
				}

				// Good: Always count articles.
				// NG: The bot '''WILL NOT COUNT''' the articles listed in level
				// other than current page to prevent from double counting.
				if (latest_section) {
					latest_section.item_count++;
				}

				const category_level = level_of_page[page_title];
				// The frist link should be the main article.
				if (category_level === level) {
					// Remove level note. It is unnecessary.
					replace_level_note(_item, index, category_level, '');
				} else {
					// `category_level===undefined`: e.g., redirected
					replace_level_note(_item, index, category_level, category_level ? undefined : '');

					if (false) {
						const message = `Category level ${category_level}, also listed in level ${level}. If the article is redirected, please modify the link manually.`;
					}
					// reduce size
					const message = category_level ? `Category level ${category_level}.{{r|c}}` : 'Redirected?{{r|e}}';
					CeL.warn(`${page_title}: ${message}`);
					if (!(category_level < level)) {
						// Only report when category_level (main level) is not smallar than level list in.
						report_lines.push([page_title, list_page_data, message]);
					}
					if (icons.length === 0) {
						// Leave untouched if error with no icon.
						// e.g., unleveled articles
						return true;
					}
				}

				icons = icons.map(icon => {
					if (icon in article_count_of_icon)
						article_count_of_icon[icon]++;
					else
						article_count_of_icon[icon] = 1;
					return `{{Icon|${icon}}}`;
				});

				// This will preserve link display text.
				if (parent_of_link) {
					// replace the [[link]]
					parent_of_link[token.index] = token;
					icons.push(_item[index]);
				} else {
					icons.push(token);
				}

				item_wikitext = icons.join(' ');

				// 前面的全部消除光，後面的原封不動
				// list[index] = item_wikitext;
				_item[index] = item_wikitext;
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

				// There is no category of the icons now, preserve the icon.
				// @see [[Module:Article history/config]], [[Template:Icon]]
				const icon = token.parameters[1];
				if (icon === 'FFAC') {
					icons.push(icon);
				}
			} else if (item_wikitext) {
				// CeL.error('for_item: Invalid item: ' + _item);
				console.log(item_wikitext);
				console.log(token);
				throw new Error('for_item: Invalid item: ' + _item);
			} else {
				if (_item.length !== 1 || typeof token !== 'string') {
					console.log(`Skip from ${index}/${_item.length}, ${token.type || typeof token} of item: ${_item}`);
					// console.log(_item.join('\n'));
					// delete _item.parent;
					console.log(_item);
					//report_lines.push([page_title, list_page_data, `Invalid item: ${_item}`]);

					//Fix invalid pattern.
					const wikitext = _item.type === 'plain' && _item.toString();
					let PATTERN;
					if (!wikitext) {
					} else if ((PATTERN = /(''){{Icon\|\w+}}\s*/i).test(wikitext)) {
						// `{{Icon|B}} '''{{Icon|A}} [[title]]'''`
						// → `{{Icon|B}} '''[[title]]'''`
						_item.truncate();
						_item[0] = wikitext.replace(PATTERN, '$1');
					} else if ((PATTERN = /^([^']*)('{2,5}) *(\[\[[^\[\]]+\]\][^']*)$/).test(wikitext)) {
						// `{{Icon|C}} ''' [[title]]`
						// → `{{Icon|C}} '''[[title]]'''`
						_item.truncate();
						_item[0] = wikitext.replace(PATTERN, '$1$2$3$2');
					}
				}

				//Skip to next item.
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
		if ((item.type === 'link' ? for_item_token(item, index, list) : item.some(for_item_token)) && !item_wikitext) {
			return parsed.each.exit;
		}

		if (!item_wikitext) {
			throw new Error('No link! ' + list_page_data.title);
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
		const PATTERN_counter_title = /^[\w\s\-–']+ \([\d,]+(\/[\d,]+)? articles?\)$/i;
		if (PATTERN_counter_title.test(wikitext.trim())
			|| !parent.list_prefix && (next_wikitext = parent[index + 1] && parent[index + 1].toString()
				.replace(/^'''?|'''?$/g, ''))
			// ''Latin America'' (9 articles)
			&& PATTERN_counter_title.test((wikitext += next_wikitext).trim())) {
			// console.log(token);
			const level = '='.repeat(latest_section.level + 1);
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
		if (token.type === 'transclusion' && token.name === 'Columns-list') {
			// [[Wikipedia:Vital articles/Level/5/Everyday life/Sports, games
			// and recreation]]
			token = token.parameters[1];
			// console.log(token);
			if (Array.isArray(token)) {
				token.forEach(for_root_token);
			}
			return;
		}

		if (token.type === 'list') {
			token.forEach(for_item);
			return;
		}

		if (token.type === 'section_title') {
			// e.g., [[Wikipedia:Vital articles]]
			if (/See also/i.test(token[0].toString())) {
				return true;
			}
			(latest_section = token).item_count = 0;
			return;
		}

		section_text_to_title(token, index, root);
	}

	parsed.some(for_root_token);

	// -------------------------------------------------------

	function set_section_title_count(parent_section) {
		const item_count = parent_section.subsections.reduce((item_count, subsection) => item_count + set_section_title_count(subsection), parent_section.item_count || 0);

		if (parent_section.type === 'section_title') {
			// $1: Target number
			parent_section[0] = parent_section.join('').replace(/\([\d,]+(\/[\d,]+)? articles?\)/i, `(${item_count.toLocaleString()}$1 article${item_count >= 2 ? 's' : ''})`);
			// console.log(parent_section[0]);
			parent_section.truncate(1);
		}

		return item_count;
	}

	const total_articles = `Total ${set_section_title_count(parsed).toLocaleString()} articles.`;
	this.summary += `: ${total_articles}`;
	// console.log(this.summary);

	let wikitext = parsed.toString();

	// summary table / count report table for each page
	const summary_table = [['Class', 'Articles']];
	for (let icon in article_count_of_icon) {
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
		summary_table.push([`{{Icon|${icon}}} ${category_name || icon}`, article_count_of_icon[icon].toLocaleString()]);
	}
	// ~~~~~
	wikitext = wikitext.replace(/(<!-- summary table begin(?::[\s\S]+?)? -->)[\s\S]*?(<!-- summary table end(?::[\s\S]+?)? -->)/, `$1\n${total_articles}\n` + CeL.wiki.array_to_table(summary_table, {
		'class': "wikitable sortable"
	}) + '\n$2');

	// console.log(wikitext);
	// return Wikiapi.skip_edit;
	return wikitext;
}

// ----------------------------------------------------------------------------

/** {Object}need_edit_VA_template[main page title needing to edit {{VA}} in the talk page] = modify to level */
const need_edit_VA_template = Object.create(null);

function check_page_count() {
	for (let page_title in level_of_page) {
		const category_level = level_of_page[page_title];
		const level_list = page_listed_in[page_title];
		if (!level_list) {
			// pages that is not listed in the Wikipedia:Vital articles/Level/*
			need_edit_VA_template[page_title] = '';
			page_listed_in[page_title] = [];
			continue;
		}

		const listed_level = Math.min.apply(null, level_list
			//level maybe `null`
			.map(level => typeof level === 'string' && /^\d\//.test(level) ? +level.match(/^\d/)[0] : level || DEFAULT_LEVEL)
			.unique());
		if (listed_level !== category_level) {
			if (1 <= listed_level && listed_level <= 5) {
				need_edit_VA_template[page_title] = listed_level;
			} else {
				CeL.error(`Invalid level of ${CeL.wiki.title_link_of(page_title)}: ${JSON.stringify(level_list)}`);
			}
		}

		if (level_list.length <= 3
			// report identifying articles that have been listed twice
			&& level_list.length === level_list.unique().length
			&& level_list.some(level => typeof level === 'string' ? level.startsWith(category_level + '/') : category_level === level)) {
			delete page_listed_in[page_title];
			continue;
		}
	}

	for (let page_title in page_listed_in) {
		const level_list = page_listed_in[page_title];
		if (level_list.length > 0) {
			// [contenttoobig] The content you supplied exceeds the article size
			// limit of 2048 kilobytes.
			report_lines.skipped_records++;
			continue;
		}
		report_lines.push([page_title, level_of_page[page_title], level_list.length > 0
			? `Listed ${level_list.length} times in ${level_list.map(level_page_link)}`
			: `Did not listed in level ${level_of_page[page_title]}.`]);
	}
}

// maintain vital articles templates: FA|FL|GA|List, add new {{Vital articles|class=unassessed}} or via ({{WikiProject *|class=start}})
async function maintain_VA_template(talk_page_data) {
	const main_page_title = wiki.talk_page_to_main(talk_page_data.original_title || talk_page_data.title);
	const level = need_edit_VA_template[main_page_title];
	const parsed = list_page_data.parse();
	let VA_template, _class;

	/**scan for existing informations
	 * <code>

{{WikiProjectBannerShell|1=
{{WikiProject Video games|class=C|importance=High}}
{{WikiProject Apple Inc.|class=C|ios=yes|ios-importance=High}}
{{WikiProject Apps |class=C|importance=High}}
}}

	 * </code>*/
	parsed.each('template', token => {
		if (token.name === 'Vital articles') {
			//get the first one
			if (VA_template) {
				CeL.error(`Get multiple {{Vital articles}} in ${CeL.wiki.title_link_of(talk_page_data)}!`);
			} else {
				VA_template = token;
			}
		} else if (token.name.startsWith('WikiProject ') && token.parameters.class) {
			// TODO: verify if class is the same.
			_class = token.parameters.class;
		}
	});

	let wikitext;
	if (VA_template) {
		CeL.wiki.parse.replace_parameter(token, { level }, 'value_only');
		wikitext = parsed.toString();
	} else {
		//TODO: |topic=
		wikitext = `{{Vital articles|level=${level}|topic=|class=}}\n` + parsed.toString();
	}

	//return wikitext;
}

// ----------------------------------------------------------------------------

async function generate_report() {
	const records_limit = 500;
	if (report_lines.length > records_limit) {
		report_lines.skipped_records += report_lines.length - records_limit;
		report_lines.truncate(records_limit);
	}
	report_lines.forEach(record => {
		const page_title = record[0];
		record[0] = CeL.wiki.title_link_of(page_title);
		if (!record[1]) {
			record[1] = level_of_page[page_title];
		} else if (record[1].title) {
			record[1] = record[1].title;
			const matched = record[1].match(/Level\/(\d(?:\/.+)?)$/);
			if (matched)
				record[1] = matched[1];
		}
		if (/^\d(?:\/.+)?$/.test(record[1])) {
			record[1] = level_page_link(record[1], true);
		}
	});

	const report_count = report_lines.length;
	let report_wikitext;
	if (report_count > 0) {
		report_lines.unshift(['Page title', 'Level', 'Situation']);
		report_wikitext = CeL.wiki.array_to_table(report_lines, {
			'class': "wikitable sortable"
		});
		if (!CeL.is_empty_object(need_edit_VA_template))
			report_wikitext = `* ${Object.keys(need_edit_VA_template).length} talk pages to edit.\n` + report_wikitext;
		if (report_lines.skipped_records > 0)
			report_wikitext = `* Skip ${report_lines.skipped_records.toLocaleString()} records.\n` + report_wikitext;
	} else {
		report_wikitext = "* '''So good, no news!'''";
	}

	await wiki.edit_page(`Wikipedia:Database reports/Vital articles update report`,
		// __NOTITLECONVERT__
		'__NOCONTENTCONVERT__\n'
		+ '* The report will update automatically.\n'
		+ '* If the category level different to the level listed<ref name="c">Category level is different to the level article listed in.</ref>, maybe the article is redirected.<ref name="e">Redirected or no level assigned in talk page. Please modify the link manually.</ref>\n'
		// [[WP:DBR]]: 使用<onlyinclude>包裹更新時間戳。
		+ '* Generate date: <onlyinclude>~~~~~</onlyinclude>\n\n<!-- report begin -->\n'
		+ report_wikitext + '\n<!-- report end -->'
		+ '\n[[Category:Wikipedia vital articles]]', {
		bot: 1,
		nocreate: 1,
		summary: `Vital articles update report: ${report_count + (report_lines.skipped_records > 0 ? '+' + report_lines.skipped_records : '')} records`
	});
}
