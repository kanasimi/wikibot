/*

2020/1/23 14:24:58	初版試營運	Update the section counts and article assessment icons for all levels of [[Wikipedia:Vital articles]].
2020/2/7 7:12:28	於 Wikimedia Toolforge 執行需要耗費30分鐘，大部分都耗在 for_each_list_page()。

TODO:
report level/class change
report articles with {{`VA_template_name`}} but is not listing in the list page.

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

CeL.run('application.net.wiki.featured_content');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('en');
/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

const using_cache = false;
if (using_cache)
	prepare_directory(base_directory, true);

// ----------------------------------------------

// badge
const page_info_cache_file = `${base_directory}/articles attributes.json`;
const page_info_cache = using_cache && CeL.get_JSON(page_info_cache_file);

/** {Object}icons_of_page[title]=[icons] */
const icons_of_page = page_info_cache && page_info_cache.icons_of_page || Object.create(null);
/** {Object}level of page get from category. icons_of_page[title]=1–5 */
const level_of_page = page_info_cache && page_info_cache.level_of_page || Object.create(null);
/** {Object}listed_article_info[title]=[{level,topic},{level,topic},...] */
const listed_article_info = Object.create(null);
/**
 * {Object}need_edit_VA_template[main page title needing to edit {{VA}} in the
 * talk page] = {level,topic}
 */
const need_edit_VA_template = Object.create(null);
const VA_template_name = 'Vital article';

const base_page_prefix = 'Wikipedia:Vital articles';
// [[Wikipedia:Vital articles/Level/3]] redirect to→ `base_page_prefix`
const DEFAULT_LEVEL = 3;

// @see function set_section_title_count(parent_section)
const PATTERN_count_mark = /\([\d,]+(\/[\d,]+)?\s+articles?\)/i;
const PATTERN_counter_title = new RegExp(/^[\w\s\-–']+MARK$/.source.replace('MARK', PATTERN_count_mark.source), 'i');

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
		if (using_cache)
			CeL.write_file(page_info_cache_file, { level_of_page, icons_of_page, FC_data_hash: wiki.FC_data_hash });
	}

	// ----------------------------------------------------

	const vital_articles_list = (await wiki.prefixsearch(base_page_prefix))
		// exclude [[Wikipedia:Vital articles/Labels]], [[Wikipedia:Vital articles 5/Labels]]
		.filter(page_data => !page_data.title.endsWith('/Labels')) || [
			// 1,
			// 2,
			// 3 && '',
			// '4/Removed',
			// '4/People',
			// '4/History',
			// '4/Physical sciences',
			// '5/People/Writers and journalists',
			// '5/People/Artists, musicians, and composers',
			// '5/Physical sciences/Physics',
			// '5/Technology',
			// '5/Everyday life/Sports, games and recreation',
			// '5/Mathematics',
			'5/Geography/Cities',
		].map(level => `${base_page_prefix}${level ? `/Level/${level}` : ''}`);
	// console.log(vital_articles_list.length);

	await wiki.for_each_page(vital_articles_list, for_each_list_page, {
		// prevent [[Talk:Ziaur Rahman]] redirecting to [[Talk:Ziaur Rahman (disambiguation)]]
		//redirects: 1,
		bot: 1,
		minor: false,
		log_to: null,
		summary: '[[Wikipedia:Database reports/Vital articles update report|Update the section counts and article assessment icons]]'
	});

	// ----------------------------------------------------

	check_page_count();

	await maintain_VA_template();

	// ----------------------------------------------------

	await generate_report();

	routine_task_done('1d');
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
		const page_list = await wiki.categorymembers(`All Wikipedia level-${i} vital articles`, {
			// exclude [[User:Fox News Brasil]]
			namespace: 'talk'
		});
		page_list.forEach(page_data => {
			const title = wiki.talk_page_to_main(page_data.original_title || page_data);
			if (title in level_of_page) {
				report_lines.push([title, , `${level_of_page[title]}→${i}`]);
			}
			level_of_page[title] = i;
		});
	}
	// console.log(level_of_page);

	// ---------------------------------------------

	const synchronize_icons = 'List|FA|FL|GA'.split('|');
	const synchronize_icon_hash = Object.fromEntries(synchronize_icons.map(icon => [icon, true]));

	// list an article's icon for current quality status always first
	// they're what the vital article project is most concerned about.
	// [[Category:Wikipedia vital articles by class]]
	//
	// [[Wikipedia:Content_assessment#Grades]]
	// FA|FL|GA|List|
	('A|B|C|Start|Stub|Unassessed'.split('|')).append(synchronize_icons)
		.forEach(icon => icon_to_category[icon] = `All Wikipedia ${icon}-Class vital articles`);
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
	for (let icon in icon_to_category) {
		const category_name = icon_to_category[icon];
		const pages = await wiki.categorymembers(category_name);
		pages.forEach(page_data => {
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

	for (let page_title in icons_of_page) {
		const icons = icons_of_page[page_title];
		if (!icons.VA_class) {
			// There is no VA class of the title. abnormal!
			continue;
		}

		// List → LIST
		const VA_class = icons.VA_class.toUpperCase();
		// Release memory. 釋放被占用的記憶體。
		delete icons.VA_class;
		if (icons.includes(VA_class)) {
			// assert: VA_class === 'LIST'
			continue;
		}

		const FC_type = wiki.FC_data_hash[page_title] && wiki.FC_data_hash[page_title].type;
		if (FC_type) {
			if (FC_type !== VA_class) {
				need_edit_VA_template[page_title] = {
					class: FC_type,
					reason: `The article is listed in featured content type: [[Category:${wiki.get_featured_content_configurations()[FC_type]}]]`
				};
			}
			continue;
		}

		let icon = 'LIST';
		// Must test after wiki.FC_data_hash[]
		if (icons.includes(icon)) {
			// e.g., list in [[Category:List-Class List articles]]
			// but not in [[Category:All Wikipedia List-Class vital articles]]
			need_edit_VA_template[page_title] = {
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
		if (/^(?:FA|FL|GA)$/.test(VA_class)) {
			// e.g., FFA
			// Move class from FA|FL|GA → A|LIST|A
			need_edit_VA_template[page_title] = {
				class: VA_class === 'FL' ? 'LIST' : 'A',
				reason: `The article is no more a ${VA_class}.`
			};
			continue;
		}
	}
}

// ----------------------------------------------------------------------------

function level_page_link(level, number_only, page_title) {
	return `[[${page_title || (level === DEFAULT_LEVEL ? base_page_prefix : base_page_prefix + '/Level/' + level)}|${number_only ? '' : 'Level '}${level}]]`;
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

function replace_level_note(item, index, category_level, new_wikitext) {
	if (item.type !== 'plain')
		return;

	const rest_wikitext = item.slice(index + 1).join('').trim();
	const PATTERN_level = /\s*\((?:level [1-5]|\[\[([^\[\]\|]+)\|level [1-5]\]\])\)/i;
	const matched = rest_wikitext && rest_wikitext.match(PATTERN_level);

	if (new_wikitext === undefined) {
		new_wikitext = ` (${level_page_link(category_level, false, matched &&
			// preserve level page. e.g.,
			// " ([[Wikipedia:Vital articles/Level/2#Society and social sciences|Level 2]])"
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

function icons_and_item_toString() {
	return this.join(' ');
}

async function for_each_list_page(list_page_data) {
	if (CeL.wiki.parse.redirect(list_page_data))
		return Wikiapi.skip_edit;
	if (list_page_data.title.endsWith('/Removed')) {
		// Skip non-list pages.
		return Wikiapi.skip_edit;
	}

	const level = level_of_page_title(list_page_data, true) || DEFAULT_LEVEL;
	// console.log([list_page_data.title, level]);
	const parsed = list_page_data.parse();
	// console.log(parsed);
	parsed.each_section();
	// console.log(parsed.subsections);
	// console.log(parsed.subsections[0]);
	// console.log(parsed.subsections[0].subsections[0]);

	const article_count_of_icon = Object.create(null);

	const need_check_redirected = Object.create(null);
	let latest_section;

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
			item.forEach(for_item);
			return;
		}

		let item_replace_to, icons = [];
		function for_item_token(token, index, _item) {
			let parent_of_link;
			if (!item_replace_to && token.type !== 'link') {
				// For token.type 'bold', 'italic', finding the first link
				// children.
				// e.g., `'' [[title]] ''`, `''' [[title]] '''`,
				// `''''' [[title]] '''''`
				parsed.each.call(token, (_token, index, parent) => {
					if (_token.type === 'link') {
						// assert: token.type === 'link'
						token = _token;
						token.index = index;
						parent_of_link = parent;
						return parsed.each.exit;
					}
					if (typeof _token === 'string'
						// e.g., "{{Icon|A}} ''[[title]]''"
						&& !/^['\s]*$/.test(_token)) {
						// Skip links with non-space prefix.
						return parsed.each.exit;
					}
				});
			}
			if (token.type === 'link' && !item_replace_to) {
				// e.g., [[pH]], [[iOS]]
				const normalized_page_title = wiki.normalize_title(token[0].toString());
				simplify_link(token, normalized_page_title);
				if (!(normalized_page_title in listed_article_info)) {
					listed_article_info[normalized_page_title] = [];
				}
				// console.log(latest_section && latest_section.link);
				const article_info = {
					level: level_of_page_title(list_page_data, true),
					// subtitle: latest_section && latest_section.link[2].toString().replace(PATTERN_count_mark, '').trim(),
					link: latest_section && latest_section.link
				};
				listed_article_info[normalized_page_title].push(article_info);

				if (normalized_page_title in icons_of_page) {
					icons.append(icons_of_page[normalized_page_title]);
				}

				if (normalized_page_title in wiki.FC_data_hash) {
					icons.append(wiki.FC_data_hash[normalized_page_title].types);
				}

				// Good: Always count articles.
				// NG: The bot '''WILL NOT COUNT''' the articles listed in level
				// other than current page to prevent from double counting.
				if (latest_section) {
					latest_section.item_count++;
				}

				const category_level = level_of_page[normalized_page_title];
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
					const message = category_level ? `Category level ${category_level}.{{r|c}}` : 'No VA template?{{r|e}}';
					if (!category_level) {
						need_edit_VA_template[normalized_page_title] = {
							...article_info,
							level,
							reason: `The article is listed in the level ${level} page`
						};
					}
					if (!(category_level < level)) {
						// Only report when category_level (main level) is not
						// smallar than level list in.
						report_lines.push([normalized_page_title, list_page_data, message]);
						if (false) CeL.warn(`${CeL.wiki.title_link_of(normalized_page_title)}: ${message}`);
						// If there is category_level, the page was not redirected.
						if (!category_level) {
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

				// There is no category of the icons now, preserve the icon.
				// @see [[Module:Article history/config]], [[Template:Icon]]
				const icon = token.parameters[1];
				if (icon === 'FFAC') {
					icons.push(icon);
				}
			} else if (item_replace_to) {
				// CeL.error('for_item: Invalid item: ' + _item);
				console.log(item_replace_to);
				console.log(token);
				throw new Error('for_item: Invalid item: ' + _item);
			} else {
				if (_item.length !== 1 || typeof token !== 'string') {
					console.log(`Skip from ${index}/${_item.length}, ${token.type || typeof token} of item: ${_item}`);
					// console.log(_item.join('\n'));
					// delete _item.parent;
					// console.log(_item);

					if (false) report_lines.push([normalized_page_title, list_page_data, `Invalid item: ${_item}`]);

					// Fix invalid pattern.
					const wikitext = _item.type === 'plain' && _item.toString();
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
			// [[Wikipedia:Vital articles/Level/5/Everyday life/Sports, games and recreation]]
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
			parent_section[0] = parent_section.join('')
				.replace(PATTERN_count_mark, `(${item_count.toLocaleString()}$1 article${item_count >= 2 ? 's' : ''})`);
			// console.log(parent_section[0]);
			parent_section.truncate(1);
		}

		return item_count;
	}

	const total_articles = `Total ${set_section_title_count(parsed).toLocaleString()} articles.`;
	this.summary += `: ${total_articles}`;
	// console.log(this.summary);

	// `Check redirects`
	if (!CeL.is_empty_object(need_check_redirected)) {
		const need_check_redirected_list = Object.keys(need_check_redirected);
		const fixed_list = [];
		CeL.info(`${CeL.wiki.title_link_of(list_page_data)}: Check ${need_check_redirected_list.length} link(s) for redirects.`);
		if (need_check_redirected_list.length < 9) {
			console.log(need_check_redirected_list);
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
				CeL.error(`for_each_list_page: No need_check_redirected[${page_data.title}]!`);
				console.log(page_data.wikitext);
				console.log(page_data);
			}
			fixed_list.push(link_token[0] + '→' + normalized_redirect_to);
			link_token[0] = normalized_redirect_to;
			simplify_link(link_token, normalized_redirect_to);
		}, { no_edit: true, no_warning: true, redirects: false });
		CeL.debug(`${CeL.wiki.title_link_of(list_page_data)}: ${fixed_list.length} link(s) fixed.`, 0, 'for_each_list_page');
		if (fixed_list.length > 0 && fixed_list.length < 9) {
			CeL.log(fixed_list.join('\n'));
		}
	}

	let wikitext = parsed.toString();
	if (wikitext !== list_page_data.wikitext) {
		// CeL.info(`for_each_list_page: Modify ${CeL.wiki.title_link_of(list_page_data)}`);
	}

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

	// console.trace(`for_each_list_page: return ${wikitext.length} chars`);
	// console.log(wikitext);
	// return Wikiapi.skip_edit;
	return wikitext;
}

// ----------------------------------------------------------------------------

function check_page_count() {
	for (let page_title in level_of_page) {
		const category_level = level_of_page[page_title];
		const article_info_list = listed_article_info[page_title];
		if (!article_info_list) {
			CeL.log(`${CeL.wiki.title_link_of(page_title)}: Category level ${category_level} but not listed. Privious vital article?`);
			// pages that is not listed in the Wikipedia:Vital articles/Level/*
			need_edit_VA_template[page_title] = {
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
				CeL.log(`${CeL.wiki.title_link_of(page_title)}: level ${category_level}→${min_level}`);
				need_edit_VA_template[page_title] = min_level_info;
			} else {
				CeL.error(`Invalid level of ${CeL.wiki.title_link_of(page_title)}: ${JSON.stringify(article_info_list)}`);
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

	for (let page_title in listed_article_info) {
		const article_info_list = listed_article_info[page_title];
		if (article_info_list.length === 1) {
			continue;
		}
		if (false && article_info_list.length > 0) {
			// [contenttoobig] The content you supplied exceeds the article size
			// limit of 2048 kilobytes.
			report_lines.skipped_records++;
			continue;
		}
		report_lines.push([page_title, level_of_page[page_title], article_info_list.length > 0
			? `Listed ${article_info_list.length} times in ${article_info_list.map(article_info => level_page_link(article_info.level || DEFAULT_LEVEL))}`
			: `Did not listed in level ${level_of_page[page_title]}.`]);
	}
}

// ----------------------------------------------------------------------------

const talk_page_summary = `Maintain {{${VA_template_name}}}`;

async function maintain_VA_template() {
	// CeL.info('need_edit_VA_template: ');
	// console.log(need_edit_VA_template);

	let main_title_of_talk_title = Object.create(null);
	try {
		await wiki.for_each_page(Object.keys(need_edit_VA_template).map(title => {
			const talk_page = wiki.to_talk_page(title);
			// console.log(`${title}→${talk_page}`);
			main_title_of_talk_title[talk_page] = title;
			return talk_page;
		}), function (talk_page_data) {
			return maintain_VA_template_each_talk_page.call(this, talk_page_data, main_title_of_talk_title[talk_page_data.original_title || talk_page_data.title]);
		}, {
			// prevent [[Talk:Ziaur Rahman]] redirecting to [[Talk:Ziaur Rahman (disambiguation)]]
			//redirects: 1,

			// prevent creating talk page if main article redirects to another page. These pages will be listed in the report.
			nocreate: 1,
			bot: 1,
			log_to: null,
			summary: talk_page_summary
		});
	} catch (e) {
		// e.g., [[Talk:Chenla]]: [spamblacklist]
	}
}

let maintain_VA_template_count = 0;

function normalize_class(_class) {
	//@see [[Category:Wikipedia vital articles by class]]
	return _class.length > 2 ? CeL.wiki.upper_case_initial(_class.toLowerCase()) : _class.toUpperCase();
}

// maintain vital articles templates: FA|FL|GA|List,
// add new {{Vital articles|class=unassessed}}
// or via ({{WikiProject *|class=start}})
function maintain_VA_template_each_talk_page(talk_page_data, main_page_title) {
	const article_info = need_edit_VA_template[main_page_title];

	// TODO: fix disambiguation

	if (CeL.wiki.parse.redirect(talk_page_data)) {
		// prevent [[Talk:Ziaur Rahman]] redirecting to [[Talk:Ziaur Rahman (disambiguation)]]
		// this kind of redirects will be skipped and listed in [[Wikipedia:Database reports/Vital articles update report]] for manually fixing.
		// Warning: Should not go to here!
		CeL.warn(`maintain_VA_template_each_talk_page: ${CeL.wiki.title_link_of(talk_page_data)} redirecting to ${CeL.wiki.title_link_of(CeL.wiki.parse.redirect(talk_page_data))}`);
		//console.log(talk_page_data.wikitext);
		report_lines.push([main_page_title, article_info.level,
			`${CeL.wiki.title_link_of(talk_page_data)} redirecting to ${CeL.wiki.title_link_of(CeL.wiki.parse.redirect(talk_page_data))}`]);
		return Wikiapi.skip_edit;
	}

	// the bot only fix namespace=talk.
	if (!wiki.is_namespace(talk_page_data, 'talk')) {
		// e.g., [[Wikipedia:Vital articles/Vital portals level 4/Geography]]
		CeL.warn(`maintain_VA_template_each_talk_page: Skip invalid namesapce: ${CeL.wiki.title_link_of(talk_page_data)}`);
		//console.log(article_info);
		return Wikiapi.skip_edit;
	}

	// console.log(article_info);
	const parsed = talk_page_data.parse();
	let VA_template, class_from_other_templates;

	/**
	 * scan for existing informations <code>

{{WikiProjectBannerShell|1=
{{WikiProject Video games|class=C|importance=High}}
{{WikiProject Apple Inc.|class=C|ios=yes|ios-importance=High}}
{{WikiProject Apps |class=C|importance=High}}
}}

	 * </code>
	 */
	parsed.each('template', token => {
		if (token.name === VA_template_name) {
			// get the first one
			if (VA_template) {
				CeL.error(`maintain_VA_template_each_talk_page: Find multiple {{${VA_template_name}}} in ${CeL.wiki.title_link_of(talk_page_data)}!`);
			} else {
				VA_template = token;
			}
			if (article_info.remove) {
				return parsed.each.remove_token;
			}
		} else if (token.parameters.class
			// e.g., {{WikiProject Africa}}, {{AfricaProject}}, {{maths rating}}
			&& /project|rating/i.test(token.name)) {
			// TODO: verify if class is the same.
			class_from_other_templates = token.parameters.class;
		}
	});
	// console.log([class_from_other_templates, VA_template]);

	let VA_template_object = {
		// normalize_class(): e.g., for [[Talk:Goosebumps]]
		class: normalize_class(article_info.class || VA_template && VA_template.parameters.class || class_from_other_templates || '')
	};
	if ('level' in article_info) {
		VA_template_object.level = article_info.level;
	}
	if (article_info.link) {
		VA_template_object.link = article_info.link[0];
		if (article_info.link[1]) {
			VA_template_object.anchor = article_info.link[1];
			article_info.reason += `: [[${VA_template_object.link}#${VA_template_object.anchor}|${VA_template_object.anchor}]]`;
		} else {
			article_info.reason += `: [[${VA_template_object.link}]]`;
		}
	}
	// console.log(VA_template_object);
	let wikitext;
	if (VA_template) {
		CeL.wiki.parse.replace_parameter(VA_template, VA_template_object, { value_only: true, force_add: true, append_key_value: true });
		CeL.info(`${CeL.wiki.title_link_of(talk_page_data)}: ${VA_template.toString()}`);
		wikitext = parsed.toString();
	} else {
		wikitext = CeL.wiki.parse.template_object_to_wikitext(VA_template_name, VA_template_object);
		CeL.info(`${CeL.wiki.title_link_of(talk_page_data)}: Add ${wikitext}`);
		wikitext += '\n' + talk_page_data.wikitext;
	}

	if (false) {
		// for debug
		if (wikitext === talk_page_data.wikitext)
			return Wikiapi.skip_edit;
		if (++maintain_VA_template_count > 50)
			return Wikiapi.skip_edit;
		// console.log(wikitext);
	}
	this.summary = talk_page_summary + ': ' + article_info.reason;
	return wikitext;
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
			const matched = record[1].match(/Level\/([1-5](?:\/.+)?)$/);
			if (matched)
				record[1] = matched[1];
		}
		if (/^[1-5](?:\/.+)?$/.test(record[1])) {
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
