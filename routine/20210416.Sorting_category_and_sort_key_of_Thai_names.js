/*

2021/4/20 5:45:20	初版試營運。
	  完成。正式運用。

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Load modules.
CeL.run([
	// for CeL.assert()
	'application.debug.log']);

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('en');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// ----------------------------------------------

// 讀入手動設定 manual settings。
async function adapt_configuration(latest_task_configuration) {
	//console.log(latest_task_configuration);
	// console.log(wiki);

	// ----------------------------------------------------

	const { general } = latest_task_configuration;

}

// ----------------------------------------------------------------------------

const Thai_people_category__template_name = 'Thai people category';

// split English Thai name to English surname and given name
function split_English_Thai_name(English_Thai_name) {
	English_Thai_name = English_Thai_name.trim();
	const matched = English_Thai_name.match(PATTERN_Thai_surname_ending)
		// default: single-word surname
		|| English_Thai_name.match(/^([\w\- ]+) ([\w\-]+)$/);
	if (!matched) {
		CeL.error(`${split_English_Thai_name.name}: ${English_Thai_name}`);
		return;
	}
	return {
		given_name: matched[1].trim(),
		surname: matched[2].trim()
	};
}

// ----------------------------------------------------------------------------

(async () => {
	login_options.configuration_adapter = adapt_configuration;
	//console.log(login_options);
	await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
	await main_process();
})();

const summary_prefix = '[[Wikipedia:Bots/Requests for approval/Cewbot 7|Maintain sort key of Thai peoples]]: ';
const do_not_check_redirects = true;
let Thai_name_CATEGORY_LIST;
const pages_without_people_data = [];
const non_biographical_pages = [];
let biographical_templates = [
	'birth date', 'birth date and age', 'birth year and age',
	'death date', 'death date and age', 'death year and age'
].map(name => 'Template:' + name);

async function main_process() {
	// Do only once.
	//await insert__Thai_people_category__template();

	await read_Thai_name_table(biographical_templates);

	await wiki.register_redirects(biographical_templates);
	biographical_templates = wiki.redirect_target_of(biographical_templates);

	Thai_name_CATEGORY_LIST = await wiki.embeddedin('Template:' + Thai_people_category__template_name);
	//console.log(Thai_name_CATEGORY_LIST);
	const Thai_people_page_list = new Set;
	// Get all pages of Thai_name_CATEGORY_LIST (categories transcluding {{Thai people category}}).
	await wiki.for_each_page(Thai_name_CATEGORY_LIST.slice(20, 21)
		// for debug
		//&& ['Category:Chiangrai United F.C. players']
		, for_each_Thai_people_category, { Thai_people_page_list });
	//console.log(Thai_people_page_list);
	Thai_name_CATEGORY_LIST = new Set(Thai_name_CATEGORY_LIST.map(page_data => wiki.remove_namespace(page_data)));
	//console.log(Thai_name_CATEGORY_LIST);
	if (false) {
		// for debug
		Thai_people_page_list.clear();
		["Adenilson Martins do Carmo", "Alex Henrique José", "Brinner Henrique Santos Souza", "Cristiano da Silva Santos", "Danilo Cirino de Oliveira", "Jerri Ariel Farias Hahn"].forEach(t => Thai_people_page_list.add(t));
	}

	// run through all pages of Thai_name_categories
	await wiki.for_each_page(Thai_people_page_list, for_each_Thai_people_page, {
		//page_options: { prop: 'revisions|wbentityusage', wbeuentities: 'Q5' },
		//page_options: { prop: 'revisions|info|pageviews' },
		summary: summary_prefix
	});

	await wiki.edit_page('Wikipedia:WikiProject Thailand/Nonbiographical pages transcluding Thai name categories',
		'The pages below are pages transcluding Thai name categories but detect as non-biographical articles.\n'
		+ CeL.wiki.array_to_table(non_biographical_pages.map(page_title => CeL.wiki.title_link_of(page_title)), 'no_header'), {
		summary: summary_prefix + `Report ${non_biographical_pages.length} non-biographical articles.`
	});

	routine_task_done('1 week');
}

// ----------------------------------------------------------------------------

async function insert__Thai_people_category__template() {
	const page_data = await wiki.page('Wikipedia:WikiProject Thailand/Thai name categories');
	const parsed = page_data.parse();
	const Thai_name_CATEGORY_LIST = [];
	parsed.each('list',
		list_token => parsed.each.call(list_token, 'link', link_token => {
			Thai_name_CATEGORY_LIST.push(link_token[0].toString().replace(/^:+/, ''));
		}),
		{ depth: 0 }
	);
	//console.log(Thai_name_CATEGORY_LIST);

	// insert {{Thai people category}}
	await wiki.for_each_page(Thai_name_CATEGORY_LIST, page_data => {
		const parsed = page_data.parse();
		if (parsed.find_template(Thai_people_category__template_name)) {
			let index = page_data.wikitext.indexOf('{{Thai people category}}');
			if (index >= 0 && !/^\s*\n/.test(page_data.wikitext.slice(index += '{{Thai people category}}'.length))) {
				return page_data.wikitext.slice(0, index) + '\n' + page_data.wikitext.slice(index);
			}
			return Wikiapi.skip_edit;
		}

		let index_to_insert = 0;
		parsed.some((token, index, parent) => {
			if (typeof token === 'string') {
				if (!token.trim())
					return;
			} else if (token.type === 'transclusion') {
				// insert after template.
				index_to_insert = index + 1;
				return;
			}
			// assert: parent === parsed
			parent.splice(index_to_insert, 0, `${index_to_insert ? '\n' : ''}{{${Thai_people_category__template_name}}}${/^\n/.test(parent[index_to_insert]) ? '' : '\n'}`);
			return true;
		});

		return parsed.toString();
	}, {
		summary: `[[Wikipedia:Bots/Requests for approval/Cewbot 7|Prepare for sorting category of Thai names]]: Insert {{${Thai_people_category__template_name}}}`
	});
}

// ----------------------------------------------------------------------------

const Thai_surnames = [
	'Amantegui Phumipha',
	'Arunvongse na Ayudhya',
	'BTU Ruaviking',
	'Balenciaga Chirathiwat',
	'CP Freshmart',
	'Che Man',
	'Chor Charoenying',
	'Chor Praram 6',
	'Chor Siriwat',
	'Chor Thanasukarn',
	'Dutch Boy Gym',
	'FA Group',
	'Gustafsson Lohaprasert',
	'Hargate',
	'Isarangkun Na Ayuthaya',
	'Isarangkura na Ayudhaya',
	'Jensen Narongdej',
	'Kor.Rungthanakeat',
	'Kulap',
	'Malakul Lane',
	'Mor Ratanabandit',
	'Mor.Ratanabandit',
	'Na Nagara',
	'Na Nontachai',
	'Na Pattalung',
	'Na Pombejra',
	'Na Songkhla',
	'Na Takuatung',
	'Na Tarue',
	'Navawongs na Ayudhya',
	'Nongkee Pahuyuth',
	'Nor.Anuwatgym',
	'Or. Kwanmuang',
	'Or. Pitisak',
	'P.K. Saenchai Muaythaigym',
	'P.K. Saenchaimuaythaigym',
	'P.K.Saenchaimuaythaigym',
	'PK Saenchaimuaythaigym',
	'PK.Saenchai',
	'Petchyindee Academy',
	'Pienlert Boripanyutakit',
	'Por Petchsiri',
	'Por Ruamrudee',
	'Por.Daorungruang',
	'Por.Pekko',
	'Por.Suantong',
	'Por.Telakun',
	'Por.Thairongruangkamai',
	'Rattanakun Seriroengrit',
	'Ronnaphagrad Ritthakhanee',
	'Sathian Gym',
	'Sim Ngam',
	'Sompong Espiner',
	'Somtow',
	'Sor Amnuaysirichoke',
	'Sor Chitpattana',
	'Sor Klinmee',
	'Sor Nanthachai',
	'Sor Palangchai',
	'Sor Ploenchit',
	'Sor Prantalay',
	'Sor Rungvisai',
	'Sor Singyu',
	'Sor Taehiran',
	'Sor Tienpo',
	'Sor Udomson',
	'Sor Vorapin',
	'Sor Vorasingh',
	'Sor. Aree',
	'Sor.Amnuaysirichoke',
	'Sor.Dechaphan',
	'Sor.Jor.Danrayong',
	'Sor.Jor.Piek-U-Thai',
	'Sor.Ploenjit',
	'Sor.Rungroj',
	'Sor.Sommai',
	'Sor.Thanaphet',
	'Sorn E-Sarn',
	'Sukosol Clapp',
	'Sundarakul na Jolburi',
	'SuperPro Samui',
	'Tor Buamas',
	'Tor. Silachai',
	'Tor.Morsri',
	'Tor.Ramintra',
	'Tor.Surat',
	'Ungsongtham Hata',
	'Vor Saengthep',
	'Wor Petchpun',
	'Wor Rungniran',
	'Wor.Sanprapai',
	'na Chiang Mai',
	'na Chiengmai',
	'na Nagara',
	'na Patalung'
], PATTERN_Thai_surname_ending = new RegExp('^([\w\\- ]+) (' + Thai_surnames.join('|') + ')$');
const full_name_as_sort_key = [];

async function deprecated_read_Thai_name_table() {
	const list_page_data = await wiki.page('Wikipedia:WikiProject Thailand/Thai name sort keys');
	list_page_data.parse();
	//console.log(list_page_data.parsed);

	const Thai_name_table = CeL.wiki.table_to_array(list_page_data);
	Thai_surnames.original_count = Thai_surnames.length;
	console.log(Thai_name_table.filter((line, index) => {
		if (!line[5] || index === 0)
			return;
		line[0] = line[0].replace(/^\[\[|\]\]$/g, '');
		const personal_name = split_English_Thai_name(line[0]);
		if (personal_name && personal_name.given_name === line[1] && personal_name.surname === line[2])
			return;

		if (line[0] === line[1] + ' ' + line[2]) {
			Thai_surnames.push(line[2]);
			return;
		}

		if (line[0] === line[3]) {
			full_name_as_sort_key.push(line[0]);
			return;
		}

		return true;
	}));

	if (Thai_surnames.length > Thai_surnames.original_count) {
		CeL.info(`${Thai_surnames.length - Thai_surnames.original_count} surnames added:`);
		console.log(Thai_surnames.sort().unique());
	}
}

// ----------------------------------------------------------------------------

// Thai_name_data[Thai people page title] = { page_title:'', given_name:'', surname:'', DEFAULTSORT:'', Thai_sort_key:'' }
const Thai_name_data = Object.create(null);

// (excluding the disambiguator)
function page_title_to_sort_key(page_title) {
	// e.g., [[Abdoul Karim Sylla (footballer, born 1981)]] → "Abdoul Karim Sylla"
	return page_title.replace(/ \([^()]+\)$/, '')
		// diacritics to alphabet
		// https://stackoverflow.com/questions/990904/remove-accents-diacritics-in-a-string-in-javascript
		.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function read_Thai_name_table() {
	const list_page_data = await wiki.page('Wikipedia:WikiProject Thailand/Thai name sort keys');
	list_page_data.parse();
	//console.log(list_page_data.parsed);

	const Thai_name_table = CeL.wiki.table_to_array(list_page_data);
	Thai_name_table.forEach((line, index) => {
		if (!line[5] || index === 0)
			return;
		line[0] = line[0].replace(/^\[\[|\]\]$/g, '');
		if (line[5] === 'yes') {
			if (line[4] === line[3])
				line[4] = '';
			if (line[4])
				CeL.error(`${read_Thai_name_table.name}: Says Thai sort (${line[4]}) = Default sort (${line[3]}) but they are not the same!`);
		} else {
			// assert: line[5] === 'no'
			if (!line[4])
				CeL.error(`${read_Thai_name_table.name}: Says Thai sort != Default sort (${line[3]}) but did not set Thai sort!`);
		}
		Thai_name_data[line[0]] = {
			page_title: line[0],
			given_name: line[1],
			surname: line[2],
			DEFAULTSORT: line[3],
			Thai_sort_key: line[4]
		};
	});

	if (do_not_check_redirects) {
		CeL.warn(`${read_Thai_name_table.name}: Do not check redirects.`);
		return;
	}

	await wiki.register_redirects(Object.keys(Thai_name_data));
	Object.keys(Thai_name_data).forEach(listed_page_title => {
		const redirect_target = wiki.redirect_target_of(listed_page_title);
		if (redirect_target !== listed_page_title) {
			if (Thai_name_data[redirect_target])
				throw new Error(`Thai_name_data[${redirect_target}] existed`);

			CeL.warn(`${read_Thai_name_table.name}: ${CeL.wiki.title_link_of(listed_page_title)} → ${CeL.wiki.title_link_of(redirect_target)}`);
			(Thai_name_data[redirect_target] = Thai_name_data[listed_page_title])
				.page_title = redirect_target;
			delete Thai_name_data[listed_page_title];
		}

		if (false) {
			const data = Thai_name_data[redirect_target];
			if ((page_title_to_sort_key(data.page_title) === data.DEFAULTSORT) !== (data.DEFAULTSORT_equals_page_title === 'yes')) {
				CeL.error(`.DEFAULTSORT_equals_page_title of Thai_name_data[${redirect_target}] is not correct!`);
				console.error(data);
			}
			delete data.DEFAULTSORT_equals_page_title;
		}
	});

	//console.log(Thai_name_data);
}

// ----------------------------------------------------------------------------

async function for_each_Thai_people_category(page_data) {
	const page_list = await wiki.category_tree(page_data);
	//console.log(page_list);

	const Thai_people_page_list = this.Thai_people_page_list;
	function append_page_list(page_list) {
		page_list.forEach(page_data =>
			page_data.ns === 0
			// As with the current set-up, pages with single-word titles should also be skipped
			// Skip [[singleWordTitle]], [[singleWordTitle (disambiguator)]]
			// [[Abbhantripaja]] is a single word, so no sort key is necessary, and it should be skipped.
			// Similarly, [[Aguinaldo (footballer)]] is one word (excluding the disambiguator) and should be likewise skipped.
			&& !/^\w+$/.test(page_title_to_sort_key(page_data.title))
			&& Thai_people_page_list.add(page_data.title)
		);
		if (page_list.subcategories)
			Object.values(page_list).subcategories.forEach(append_page_list)
	}
	append_page_list(page_list);
}

// ----------------------------------------------------------------------------

// is biography of a person
function page_is_biography(page_data) {
	//console.log(page_data);
	const parsed = page_data.parsed;
	let is_biography;
	parsed.each('template', token => {
		if (wiki.is_template(biographical_templates, token)) {
			is_biography = true;
			return parsed.each.exit;
		}
	});

	parsed.each('category', token => {
		if (['Living people'].includes(token.name)
			//e.g., [[Category:2000 births]] [[Category:2000 deaths]]
			|| /^\d+ (?:births|deaths)$/.test(token.name)) {
			is_biography = true;
			return parsed.each.exit;
		}
	});

	if (is_biography)
		return true;

	CeL.warn(`${page_is_biography.name}: Not biography? ${CeL.wiki.title_link_of(page_data)}`);
	non_biographical_pages.push(page_data.title);
}

function for_each_Thai_people_page(page_data) {
	const parsed = page_data.parse();
	if (!page_is_biography(page_data))
		return Wikiapi.skip_edit;

	let changed;

	function set_sort_key_of_category(sort_key, category_token) {
		const old_sort_key = category_token.sort_key && page_title_to_sort_key(category_token.sort_key.toString());
		if (old_sort_key) {
			if (old_sort_key === sort_key)
				return;
			if (old_sort_key.length > sort_key || !old_sort_key.startsWith(sort_key))
				CeL.warn(`${CeL.wiki.title_link_of(page_data)}: The sort key of <code><nowiki>${category_token}</nowiki></code> will be set to ${JSON.stringify(sort_key)}!`);
		}
		category_token[2] = sort_key;
		changed = true;
	}

	// remove all {{Thai sort key not needed}}s and re-insert again.
	parsed.each('Template:Thai sort key not needed', token => /*(changed = true) &&*/ parsed.each.remove_token);

	const Thai_people_data = Thai_name_data[page_data.title];
	let Thai_sort_key;
	//console.log(Thai_people_data);
	if (Thai_people_data) {
		Thai_sort_key = Thai_people_data.Thai_sort_key;

		parsed.insert_layout_token(token => {
			//console.log([page_data.title, Thai_people_data.DEFAULTSORT, token]);
			this.summary += 'Follow the instructions of [[Wikipedia:WikiProject Thailand/Thai name sort keys]]';
			const Thai_sort_key_not_needed = Thai_sort_key ? '' : '{{Thai sort key not needed}}\n';

			if (!token) {
				changed = true;
				return `${Thai_sort_key_not_needed}{{DEFAULTSORT:${Thai_people_data.DEFAULTSORT}}}`;
			}

			if (Thai_people_data.DEFAULTSORT.toString().includes("don't change")) {
				CeL.debug(`${for_each_Thai_people_page.name}: Skip page ${CeL.wiki.title_link_of(page_data)} being tald not to change.`);
			} else if (Thai_people_data.DEFAULTSORT
				// ... also be skipped, as well as pages with empty DEFAULTSORTs or DEFAULTSORTs that are identical to the PAGENAME or differ only in capitalisation (e.g. Abu Samah Mohd Kassim and Alef Vieira Santos above).
				&& token[1] && token[1].toString().toLowerCase() !== Thai_people_data.DEFAULTSORT.toString().toLowerCase()) {
				CeL.warn(`${CeL.wiki.title_link_of(page_data)}: The default sort key of <code><nowiki>${token}</nowiki></code> will be set to ${JSON.stringify(Thai_people_data.DEFAULTSORT)}!`);
				token.truncate(2);
				token[1] = Thai_people_data.DEFAULTSORT;
				changed = true;
			}
			if (Thai_sort_key_not_needed) {
				changed = true;
				// return wikitext that will replace original {{DEFAULTSORT}}
				return Thai_sort_key_not_needed + token;
			}
		}, 'DEFAULTSORT');
		//console.log(parsed.layout_indices);

	} else {
		let DEFAULTSORT_token, DEFAULTSORT_is_equivalent_to_page_title;
		parsed.each('function', token => {
			if (token.name === 'DEFAULTSORT') {
				DEFAULTSORT_token = token;
				if (page_title_to_sort_key(token[1]).toLowerCase() === page_title_to_sort_key(page_data.title).toLowerCase()) {
					DEFAULTSORT_is_equivalent_to_page_title = true;
					return parsed.each.exit;
				}
			}
		});
		if (!DEFAULTSORT_token || DEFAULTSORT_is_equivalent_to_page_title)
			return Wikiapi.skip_edit;

		this.summary += 'Modify sort key of Thai categories, as page name.';
		pages_without_people_data.push(page_data.title);
		Thai_sort_key = page_title_to_sort_key(page_data.title);
	}

	if (Thai_sort_key) {
		parsed.each('category', category_token => {
			if (!Thai_name_CATEGORY_LIST.has(category_token.name))
				return;

			set_sort_key_of_category(Thai_sort_key, category_token);
		});
	} else if (!Thai_people_data) {
		// assert: should not go to here
		CeL.error(`${for_each_Thai_people_page.name}: No Thai_sort_key of ${CeL.wiki.title_link_of(page_data)}`);
	}

	if (changed) {
		return parsed.toString();
	}
	return Wikiapi.skip_edit;
}
