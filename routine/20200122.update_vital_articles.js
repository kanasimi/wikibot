/*

	初版試營運

report error, level/class change

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

CeL.run('application.net.wiki.featured_content');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;
// globalThis.use_language = 'zh';
use_language = 'en';

const page_info_cache_file = `${base_directory}/vital_articles_cache.json`;
const page_info_cache = CeL.get_JSON(page_info_cache_file);

// badge
const icons_of_page = page_info_cache && page_info_cache.icons_of_page || Object.create(null);
const level_of_page = page_info_cache && page_info_cache.level_of_page || Object.create(null);

// [[Wikipedia:Vital articles/Level/3]] redirect→ [[Wikipedia:Vital articles]]
const DEFAULT_LEVEL = 3;
const base_page = 'Wikipedia:Vital articles';

const vital_articles_list = [
	// 1,
	// 2,
	// '',
	// '4/People',
	// '4/History',
	// '5/People/Writers and journalists',
	'5/Technology',
].map(level => `${base_page}${level ? `/Level/${level}` : ''}`);

const report_lines = [];

// ----------------------------------------------------------------------------

prepare_directory(base_directory);

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

	await wiki.for_each_page(vital_articles_list, for_each_list_page, {
		redirects: 1,
		bot: 1,
		// summary: '',
	});

	// ----------------------------------------------------

	// await generate_report();

	CeL.info(`${(new Date).format()}	done.`);
}

// ----------------------------------------------------------------------------

async function get_page_info() {
	await wiki.get_featured_content();
	// console.log(wiki.FC_data_hash);

	// ---------------------------------------------

	for (let i = 1; i <= 5; i++) {
		const pages = await wiki.categorymembers(`All Wikipedia level-${i} vital articles`);
		pages.forEach(page_data => {
			const title = CeL.wiki.talk_page_to_main(page_data.original_title || page_data);
			if (title in level_of_page) {
				report_lines.push([title, , `${level_of_page[title]}→${i}`]);
			}
			level_of_page[title] = i;
		});
	}
	// console.log(level_of_page);

	// ---------------------------------------------

	const icon_to_category = Object.create(null);
	// [[Category:Wikipedia vital articles by class]]
	// FA|FL|GA|
	'A|B|C|List|Start|Stub|Unassessed'.split('|').forEach(icon => icon_to_category[icon] = `All Wikipedia ${icon}-Class vital articles`);
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
		PR: 'Old requests for peer review',
		ITN: 'Wikipedia In the news articles',
		OTD: 'Article history templates with linked otd dates',
	});
	for (let icon in icon_to_category) {
		const pages = await wiki.categorymembers(icon_to_category[icon]);
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

function for_each_list_page(list_page_data) {
	let matched = list_page_data.title.match(/\/Level\/(\d)(?:$|\/)/);
	const level = matched && + matched[1] || DEFAULT_LEVEL;
	const parsed = list_page_data.parse();
	// console.log(parsed);
	parsed.each_section();
	// console.log(parsed.subsections);
	// console.log(parsed.subsections[0]);
	// console.log(parsed.subsections[0].subsections[0]);

	let latest_section;

	function for_item(item, index, list) {
		if (item.type === 'list') {
			item.forEach(for_item);
			return;
		}

		let item_wikitext, icons = [];
		function for_item_token(token, index, _item) {
			let parent_of_link;
			if (!item_wikitext) {
				let _token = token;
				while (_token.type
					// e.g., 'bold', 'italic'
					&& _token.type !== 'link' && _token[0]) {
					if (_token[0].type === 'link') {
						parent_of_link = _token;
						token = _token[0];
						break;
					} else {
						_token = _token[0];
					}
				}
			}
			if (token.type === 'link' && !item_wikitext) {
				const page_title = token[0].toString();
				if (page_title in icons_of_page) {
					icons.append(icons_of_page[page_title]);
				}

				if (page_title in wiki.FC_data_hash) {
					icons.append(wiki.FC_data_hash[page_title].types);
				}

				if (latest_section) {
					latest_section.item_count++;
				}

				const category_level = level_of_page[page_title];
				// The bot will not count the articles listed in other level.
				// The frist link should be the main article.
				if (category_level !== level) {
					// `category_level===undefined`: e.g., redirected
					let has_error = !category_level || _item.type !== 'plain';
					if (!has_error) {
						const PATTERN_level = /\((?:level \d|\[\[([^\[\]\|]+)\|level \d\]\])\)/i;
						const rest_wikitext = _item.slice(index + 1).join('').trim();
						const matched = rest_wikitext && rest_wikitext.match(PATTERN_level);
						if (!rest_wikitext || matched) {
							const new_wikitext = ` (${level_page_link(category_level, false, matched &&
								//preserve level page. e.g., " ([[Wikipedia:Vital articles/Level/2#Society and social sciences|Level 2]])"
								(category_level === DEFAULT_LEVEL || matched[1] && matched[1].includes(`/${category_level}`)) && matched[1])})`;
							_item.truncate(index + 1);
							_item[index + 1] = rest_wikitext ? rest_wikitext.replace(PATTERN_level, new_wikitext) : new_wikitext;
						} else {
							has_error = true;
						}
					}

					if (has_error) {
						const message = `Category level ${category_level}, also listed in level ${level}. If the article is redirected, please modify the link manually.`;
						CeL.warn(`${page_title}: ${message}`);
						report_lines.push([page_title, list_page_data, message]);
						if (icons.length === 0) {
							// Leave untouched if error with no icon.
							return true;
						}
					}
				}

				icons = icons.map(icon => `{{Icon|${icon}}}`);

				// This will preserve link display text.
				if (parent_of_link) {
					// replace the [[link]]
					parent_of_link[0] = token;
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
					console.log(`Skip from ${index}/${_item.length}, ${token.type} of item: ${_item}`);
					// console.log(_item.join('\n'));
					// delete _item.parent;
					console.log(_item);
				}
				return true;
			}
		}

		if (section_text_to_title(item, index, list)) {
			// e.g., ":Popes (3 articles)"
			return;
		}

		if (!item.some) {
			console.error(JSON.stringify(item));
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
		const PATTERN_counter_title = /^[\w\s\-']+ \([\d,]+(\/[\d,]+)? articles?\)$/i;
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

	parsed.some(function (token, index) {
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

		section_text_to_title(token, index, parsed);
	});

	// -------------------------------------------------------

	function set_section_title_count(parent_section) {
		const item_count = parent_section.subsections.reduce((item_count, subsection) => item_count + set_section_title_count(subsection), parent_section.item_count || 0);

		// $1: Target number
		parent_section[0] = parent_section.join('').replace(/\([\d,]+(\/[\d,]+)? articles?\)/i, `(${item_count.toLocaleString()}$1 article${item_count >= 2 ? 's' : ''})`);
		// console.log(parent_section[0]);
		parent_section.truncate(1);
		return item_count;
	}

	parsed.subsections.forEach(set_section_title_count);

	console.log(parsed.toString());
}

// ----------------------------------------------------------------------------

async function generate_report() {
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
	} else {
		report_wikitext = "* '''So good, no news!'''";
	}

	await wiki.edit_page(`Wikipedia:Database reports/Vital articles update report`,
		// __NOTITLECONVERT__
		'__NOCONTENTCONVERT__\n'
		+ '* The report will update automatically.\n'
		// [[WP:DBR]]: 使用<onlyinclude>包裹更新時間戳。
		+ '* Generate date: <onlyinclude>~~~~~</onlyinclude>\n\n'
		+ report_wikitext, {
		bot: 1,
		nocreate: 1,
		summary: `Vital articles update report: ${report_count} records`
	});
}
