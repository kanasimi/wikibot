/*

	初版試營運。
	完成。正式運用。

[[ja:Module:ISO639言語名]]
[[en:Module:Language/data/ISO 639-1]]

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Load modules.
CeL.run([]);

//login_options.API_URL = 'en';

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('ja');
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

	summary_prefix = CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title, CeL.gettext('Maintain challenge templates')) + ': ';
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
	const all_wikipedia_language_codes = await get_all_wikipedia_language_codes({ language: use_language });
	const wikipedia_sites = await get_all_wikipedia_sites({ language: use_language });
	const all_featured_contents = await get_all_featured_contents({ language: use_language });
	//console.trace(all_featured_contents);
	for (const [language_code, FC_list] of Object.entries(all_featured_contents)) {
		console.assert(FC_list.length >= 1);
		//if (FC_list.length < 10) continue;
		// 先以 wikipedia_sites 為準。 e.g., Q1211233
		let language_name = extract_label_of_language(wikipedia_sites, language_code);
		if (language_name) {
			// e.g., 'ヴォラピュク版ウィキペディア'
			language_name = language_name.replace(/版ウィキペディア/, '');
		} else if (!(language_name = extract_label_of_language(all_wikipedia_language_codes, language_code))) {
			CeL.error(`Cannot find name of ${language_code}: ${FC_list.length} FCs!`);
			console.log([all_wikipedia_language_codes[language_code], wikipedia_sites[language_code]]);
			continue;
		}
		await for_wikipedia_site(language_code, FC_list, language_name);
	}

	routine_task_done('1 day');
}

// ----------------------------------------------------------------------------

function extract_label_of_language(set, language_code) {
	const item = set[language_code];
	const language_name = item?.label_language === use_language && item.label;
	return language_name;
}

async function get_all_wikipedia_language_codes(options) {
	const languages = ['[AUTO_LANGUAGE]', 'en'];
	if (options?.language)
		languages.unshift(options.language);
	CeL.log_temporary(`${get_all_wikipedia_language_codes.name}: ${languages}`);
	const all_wikipedia_language_codes = Object.create(null);
	(await wiki.SPARQL(`
SELECT DISTINCT ?lang_code ?itemLabel ?item
WHERE
{
  { ?item wdt:P31 wd:Q34770. }
  UNION
  { ?item wdt:P31 wd:Q436240. }
  UNION
  { ?item wdt:P31 wd:Q1288568. }
  UNION
  { ?item wdt:P31 wd:Q33215. }
  ?item wdt:P424 ?lang_code.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${languages.join(',')}". }
}
`)).forEach(item => {
		const language_code = CeL.wiki.data.value_of(item.lang_code);
		const wikipedia_language_code = {
			label: CeL.wiki.data.value_of(item.itemLabel),
			label_language: item.itemLabel['xml:lang'],
			entity_id: +CeL.wiki.data.value_of(item.item).match(/Q(\d+)$/)[1],
		};
		console.assert(CeL.wiki.data.value_of(item.item) === `http://www.wikidata.org/entity/Q${wikipedia_language_code.entity_id}`);
		const old_data = all_wikipedia_language_codes[language_code];
		if (old_data?.label_language === options?.language
			? wikipedia_language_code.label_language !== options?.language || old_data?.entity_id < wikipedia_language_code.entity_id
			: wikipedia_language_code.label_language !== options?.language && old_data?.entity_id < wikipedia_language_code.entity_id
		) {
			// 用舊的資訊，不改成新的 wikipedia_language_code。
			return;
		}
		if (old_data?.label_language === options?.language) {
			CeL.warn(`${get_all_wikipedia_language_codes.name}: 不同項目卻有相同語言代碼 ${language_code}`);
			console.log([old_data, wikipedia_language_code]);
		}
		all_wikipedia_language_codes[language_code] = wikipedia_language_code;
	});
	//console.log(all_wikipedia_language_codes);
	return all_wikipedia_language_codes;
}

// [[ja:ウィキペディアのリスト]]
async function get_all_wikipedia_sites(options) {
	const languages = ['[AUTO_LANGUAGE]', 'en'];
	if (options?.language)
		languages.unshift(options.language);
	CeL.log_temporary(`${get_all_wikipedia_sites.name}: ${languages}`);
	const wikipedia_sites = Object.create(null);
	(await wiki.SPARQL(`
SELECT ?item ?itemLabel ?website
WHERE 
{
	#?item wdt:P31 wd:Q10876391.
	?item wdt:P856 ?website.
	?website wikibase:wikiGroup "wikipedia".
	SERVICE wikibase:label { bd:serviceParam wikibase:language "${languages.join(',')}". }
}`)).forEach(item => {
		const language_code = CeL.wiki.data.value_of(item.website).match(/\/\/(.+?)\./)[1];
		const wikipedia_site = {
			label: CeL.wiki.data.value_of(item.itemLabel),
			label_language: item.itemLabel['xml:lang'],
			entity_id: +CeL.wiki.data.value_of(item.item).match(/Q(\d+)$/)[1],
		};
		console.assert(CeL.wiki.data.value_of(item.item) === `http://www.wikidata.org/entity/Q${wikipedia_site.entity_id}`);
		console.assert(CeL.wiki.data.value_of(item.website) === `https://${language_code}.wikipedia.org/`);
		wikipedia_sites[language_code] = wikipedia_site;
	});
	//console.log(wikipedia_sites);
	//console.log(wikipedia_sites.id_list());
	return wikipedia_sites;
}

async function get_all_featured_contents(options) {
	const languages = ['[AUTO_LANGUAGE]', 'en'];
	if (options?.language)
		languages.unshift(options.language);
	const all_featured_contents = Object.create(null);

	const limit = 5000;
	let offset = 0;

	async function get_FC_pieces() {
		CeL.log_temporary(`${get_all_featured_contents.name}: ${languages} ${offset}–${offset + limit}`);
		const list = await wiki.SPARQL(`
# get all Featured Articles (Q17437796) with sitelink of specified language
SELECT ?lang ?name ?itemLabel ?sitelink ?sitelink_lang ?linkcount ?item ?type ?typeLabel WHERE {
	?item wikibase:sitelinks ?linkcount.
	?item wdt:P31 ?type.
	?sitelink schema:name ?name;
		schema:inLanguage ?lang;
		schema:about ?item;
		# Sitelink is badged as a Featured Article
		wikibase:badge wd:Q17437796.
	OPTIONAL { ?sitelink_lang schema:about ?item;
		schema:isPartOf <https://ja.wikipedia.org/>. }
	SERVICE wikibase:label { bd:serviceParam wikibase:language "${languages.join(',')}".
		?item rdfs:label ?itemLabel .
		?type rdfs:label ?typeLabel .
	}
}
ORDER BY ?item LIMIT ${limit} OFFSET ${offset}
`);

		list.forEach(item => {
			//console.trace(item);
			const language_code = CeL.wiki.data.value_of(item.sitelink).match(/\/\/(.+?)\./)[1];
			const FC_data = {
				name: CeL.wiki.data.value_of(item.name),
				lang: CeL.wiki.data.value_of(item.lang),
				linkcount: CeL.wiki.data.value_of(item.linkcount),
				sitelink: decodeURIComponent(CeL.wiki.data.value_of(item.sitelink).between('wiki/')).replace(/_/g, ' '),

				type: CeL.wiki.data.value_of(item.typeLabel),
				type_language: item.typeLabel['xml:lang'],
				type_entity_id: +CeL.wiki.data.value_of(item.type).match(/Q(\d+)$/)[1],

				label: CeL.wiki.data.value_of(item.itemLabel),
				label_language: item.itemLabel['xml:lang'],
				entity_id: +CeL.wiki.data.value_of(item.item).match(/Q(\d+)$/)[1],
			};
			if (item.sitelink_lang)
				FC_data.sitelink_lang = decodeURIComponent(CeL.wiki.data.value_of(item.sitelink_lang).between('wiki/')).replace(/_/g, ' ');
			if (FC_data.lang.toLowerCase() !== item.name['xml:lang']) console.trace(item);
			if (FC_data.sitelink !== CeL.wiki.title_of(FC_data.name)) {
				//console.trace(FC_data);
			}
			if (!(language_code in all_featured_contents))
				all_featured_contents[language_code] = [];
			all_featured_contents[language_code].push(FC_data);
		});

		return list.length;
	}

	while (limit === await get_FC_pieces()) {
		offset += limit;
	}

	return all_featured_contents;
}

async function for_wikipedia_site(language_code, FC_list, language_name) {
	if (!language_name.endsWith('語')) {
		console.trace([language_code, FC_list.length, language_name]);
		console.trace(FC_list.slice(0, 3));
	}
	if (/als|gsw/i.test(language_code)) {
		//console.trace([language_code, FC_list.length, language_name]);
	}

}
