/*

2021/4/22 10:26:7	初版試營運。
	完成。正式運用。

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Load modules.
CeL.run(['application.net.wiki.template_functions',
	// for CeL.assert()
	'application.debug.log']);

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('en');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// ----------------------------------------------------------------------------

const Thai_people_category__template_name = 'Thai people category';
const summary_prefix = '[[Wikipedia:Bots/Requests for approval/Cewbot 7|Maintaining sort keys in Thai-people categories]]: ';

// ----------------------------------------------

// 讀入手動設定 manual settings。
async function adapt_configuration(latest_task_configuration) {
	//console.log(latest_task_configuration);
	// console.log(wiki);

	// ----------------------------------------------------

	const { general } = latest_task_configuration;

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

	let Thai_name_CATEGORY_LIST = await wiki.embeddedin('Template:' + Thai_people_category__template_name);
	//console.log(Thai_name_CATEGORY_LIST);
	const Thai_people_page_list = new Set;
	// Get all pages of Thai_name_CATEGORY_LIST (categories transcluding {{Thai people category}}).
	await wiki.for_each_page(Thai_name_CATEGORY_LIST
		// for debug
		//.slice(20, 21)
		//&& ['Category:Chiangrai United F.C. players']
		, for_each_Thai_people_category, { Thai_people_page_list });
	//console.log(Thai_people_page_list);
	Thai_name_CATEGORY_LIST = new Set(Thai_name_CATEGORY_LIST.map(page_data => wiki.remove_namespace(page_data)));
	//console.log(Thai_name_CATEGORY_LIST);
	if (false) {
		// for debug
		Thai_people_page_list.clear();
		`Rama II
Asdang Dejavudh
Therdsak Chaiman
Adenilson Martins do Carmo
Ong-ard Satrabhandhu
Abbas Sarkhab
Aed Carabao
Bernard Trink
Ajaan Suwat Suvaco`.split('\n').forEach(t => Thai_people_page_list.add(t));
	}

	const non_biographical_page_titles = [['#', 'Page']];
	// run through all pages of Thai_name_categories
	await wiki.for_each_page(Thai_people_page_list,
		[for_each_Thai_people_page, {
			Thai_name_CATEGORY_LIST, non_biographical_page_titles,
		}],
		{ summary: summary_prefix });

	await wiki.edit_page('Wikipedia:WikiProject Thailand/Nonbiographical pages transcluding Thai name categories',
		'The pages below are pages transcluding Thai name categories but detect as non-biographical articles.\n'
		+ CeL.wiki.array_to_table(non_biographical_page_titles.sort().map((page_title, index) => [index + 1, CeL.wiki.title_link_of(page_title)]), { class: 'wikitable sortable' }), {
		summary: summary_prefix + `Report ${non_biographical_page_titles.length} non-biographical articles.`
	});

	routine_task_done('1 week');
}

// ----------------------------------------------------------------------------

async function for_each_Thai_people_category(page_data) {
	//console.trace(page_data);
	const page_list = await wiki.category_tree(page_data);
	//console.log(page_list);

	const { Thai_people_page_list } = this;
	function append_page_list(page_list) {
		page_list.forEach(page_data =>
			page_data.ns === 0
			// As with the current set-up, pages with single-word titles should also be skipped
			// Skip [[singleWordTitle]], [[singleWordTitle (disambiguator)]]
			// [[Abbhantripaja]] is a single word, so no sort key is necessary, and it should be skipped.
			// Similarly, [[Aguinaldo (footballer)]] is one word (excluding the disambiguator) and should be likewise skipped.
			&& !/^\w+$/.test(CeL.wiki.page_title_to_sort_key(page_data))
			&& Thai_people_page_list.add(page_data.title)
		);
		// No recursion
		if (false && page_list.subcategories)
			Object.values(page_list.subcategories).forEach(append_page_list);
	}
	append_page_list(page_list);
}

// ----------------------------------------------------------------------------

function for_each_Thai_people_page(page_data) {
	const parsed = page_data.parse();
	if (!parsed.is_biography()) {
		CeL.warn(`${for_each_Thai_people_page.name}: Not biography? ${CeL.wiki.title_link_of(page_data)}`);
		this.non_biographical_page_titles.push(page_data.title);
		return Wikiapi.skip_edit;
	}

	if (parsed.find_template('Template:Thai sort key not needed')) {
		// Skip pages transcluding {{Thai sort key not needed}}
		return Wikiapi.skip_edit;
	}

	const Thai_sort_key = CeL.wiki.page_title_to_sort_key(page_data);
	if (!Thai_sort_key) {
		return;
	}

	let DEFAULTSORT_token, DEFAULTSORT_is_equivalent_to_page_title;
	parsed.each('magic_word_function', token => {
		if (token.name === 'DEFAULTSORT') {
			DEFAULTSORT_token = token;
			if (token[1] && CeL.wiki.page_title_to_sort_key(token[1], true)
				=== Thai_sort_key.toLowerCase()) {
				DEFAULTSORT_is_equivalent_to_page_title = true;
				return parsed.each.exit;
			}
		}
	});
	if (!DEFAULTSORT_token || DEFAULTSORT_is_equivalent_to_page_title)
		return Wikiapi.skip_edit;

	let changed;
	const { Thai_name_CATEGORY_LIST } = this;
	parsed.each('category', category_token => {
		if (Thai_name_CATEGORY_LIST.has(category_token.name) && category_token.set_sort_key(Thai_sort_key))
			changed = true;
	});

	this.summary += 'Adding page title as sort keys.';
	return changed ? parsed.toString() : Wikiapi.skip_edit;
}
