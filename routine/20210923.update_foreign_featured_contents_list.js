/*

node 20210923.update_foreign_featured_contents_list.js use_language=ja
node 20210923.update_foreign_featured_contents_list.js use_language=zh
node 20210923.update_foreign_featured_contents_list.js use_language=en


2021/10/7 6:10:25	初版試營運。
2021/10/9 5:16:17	完成。正式運用 for jawiki。
2021/10/13 16:8:42	adapt for zhwiki 更新諸語言的維基百科典範條目

[[ja:Module:ISO639言語名]]
[[en:Module:Language/data/ISO 639-1]]

[[MediaWiki:Variantname-zh-my]]


TODO:
+ article size

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Load modules.
CeL.run(['application.net.wiki.featured_content']);

//login_options.API_URL = 'en';

// Set default language. 改變預設之語言。 e.g., 'zh'
//set_language('ja');
/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

const MAX_ITEMS_TO_LIST = 7500;
console.assert(MAX_ITEMS_TO_LIST > 1000);

// ----------------------------------------------------------------------------

// 讀入手動設定 manual settings。
async function adapt_configuration(latest_task_configuration) {
	//console.log(wiki.latest_task_configuration);

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
	const all_wikipedia_language_codes = await get_all_wikipedia_language_codes({ use_language });
	const wikipedia_sites = await get_all_wikipedia_sites({ use_language });

	const featured_content_badges = await get_featured_content_badges();
	//console.trace(featured_content_badges);
	const Wikimedia_article_badges = await get_all_Wikimedia_badges({ use_language });
	//console.trace(Wikimedia_article_badges);


	const local_FC_for_general_language = await get_featured_content_of_language({ language_code: use_language, use_language: wiki.latest_task_configuration.general.general_language_code, featured_content_badges });
	//console.trace(local_FC_for_general_language);

	const local_language_name = get_language_name({ language_code: use_language, wikipedia_sites, all_wikipedia_language_codes });

	const all_featured_contents = await get_all_featured_contents({ use_language, featured_content_badges });
	// 預先載入每次 for_badge_to_process() 必備的資料。
	for (const language_code of [wiki.latest_task_configuration.general.general_language_code, use_language]) {
		await get_FC_hash({ language_code, use_language, featured_content_badges, all_featured_contents });
	}
	//console.trace(all_featured_contents);

	const badges_to_process = (wiki.latest_task_configuration.general.badges_to_process || 'FA,GA,FL').split(',').map(icon => {
		icon = icon.trim();
		if (!icon) return;
		let badge_entity_id;
		if (featured_content_badges.some(_badge_entity_id => {
			if (Wikimedia_article_badges[_badge_entity_id]?.icon === icon) {
				badge_entity_id = _badge_entity_id;
				return true;
			}
		})) {
			return badge_entity_id;
		}
	}).filter(badge_entity_id => !!badge_entity_id);
	// Should be ['Q17437796', 'Q17437798', 'Q17506997'] in zhwiki, jawiki
	//console.trace(badges_to_process);
	if (badges_to_process.length === 0) {
		CeL.error('No badges_to_process set!');
	}

	for (const badge_entity_id_to_process of badges_to_process) {
		console.assert(featured_content_badges.includes(badge_entity_id_to_process));
		console.assert(CeL.is_Object(Wikimedia_article_badges[badge_entity_id_to_process]));
		await for_badge_to_process({ badge_entity_id_to_process, all_wikipedia_language_codes, wikipedia_sites, featured_content_badges, Wikimedia_article_badges, local_FC_for_general_language, all_featured_contents, local_language_name });
		//console.trace(all_featured_contents);
	}

	routine_task_done('1 day');
}

// ----------------------------------------------------------------------------

async function get_FC_hash(options) {
	const { language_code, all_featured_contents } = options;
	if (all_featured_contents[language_code].partly) {
		// Cache the result.
		all_featured_contents[language_code] = await get_featured_content_of_language(options);
	}
	return all_featured_contents[language_code];
}

function extract_label_of_language(set, language_code) {
	const item = set[language_code];
	const language_name = item?.label_language === use_language && item.label;
	return language_name;
}

function get_language_name(options) {
	const { language_code, wikipedia_sites, all_wikipedia_language_codes } = options;
	// 先以 wikipedia_sites 為準。 e.g., Q1211233
	const language_name = extract_label_of_language(wikipedia_sites, language_code);
	if (language_name) {
		// e.g., 'ヴォラピュク版ウィキペディア'
		return language_name
			// ja
			.replace(/版ウィキペディア/, '')
			// zh
			.replace(/维基百科|維基百科/, '')
			// en
			.replace(/\s+Wikipedia$/, '')
			.trim();
	}
	return extract_label_of_language(all_wikipedia_language_codes, language_code);
}

function get_numbral_entity_id(entity_id, padding) {
	entity_id = +entity_id.replace(/^Q/, '');
	if (padding)
		entity_id = entity_id.pad(10);
	return entity_id;
}

function get_label_languages(options) {
	const label_languages = ['[AUTO_LANGUAGE]', wiki.latest_task_configuration.general.general_language_code];
	if (options?.use_language)
		label_languages.unshift(options.use_language);
	return label_languages;
}

async function get_all_wikipedia_language_codes(options) {
	const label_languages = get_label_languages(options);
	CeL.log_temporary(`${get_all_wikipedia_language_codes.name}: ${label_languages}`);
	const all_wikipedia_language_codes = Object.create(null);
	(await wiki.SPARQL(`
#title: All languages with a Wikimedia language code (P424)
# Date: 2021-09-24
SELECT DISTINCT ?lang_code ?itemLabel ?item
WHERE {
	# ?lang is one of these options
	VALUES ?lang {
		wd:Q34770   # language
		wd:Q436240  # ancient language
		wd:Q1288568 # modern language
		wd:Q33215   # constructed language
	}
	?item wdt:P31 ?lang;
		# get the language code
		wdt:P424 ?lang_code.
	SERVICE wikibase:label { bd:serviceParam wikibase:language "${label_languages.join(',')}" }
}
`)).forEach(item => {
		const language_code = CeL.wiki.data.value_of(item.lang_code);
		const wikipedia_language_code = {
			label: CeL.wiki.data.value_of(item.itemLabel),
			label_language: item.itemLabel['xml:lang'],
			entity_id: CeL.wiki.data.value_of(item.item).match(/(Q\d+)$/)[1],
		};
		console.assert(CeL.wiki.data.value_of(item.item) === `http://www.wikidata.org/entity/${wikipedia_language_code.entity_id}`);
		const old_data = all_wikipedia_language_codes[language_code];
		if (old_data?.label_language === options?.use_language
			? wikipedia_language_code.label_language !== options?.use_language || old_data?.entity_id < wikipedia_language_code.entity_id
			: wikipedia_language_code.label_language !== options?.use_language && old_data?.entity_id < wikipedia_language_code.entity_id
		) {
			// 用舊的資訊，不改成新的 wikipedia_language_code。
			return;
		}
		if (old_data?.label_language === options?.use_language) {
			CeL.warn(`${get_all_wikipedia_language_codes.name}: 不同項目名稱卻有相同維基媒體語言代碼 (P424): ${language_code}`);
			console.log([old_data, wikipedia_language_code]);
		}
		all_wikipedia_language_codes[language_code] = wikipedia_language_code;
	});
	//console.log(all_wikipedia_language_codes);
	return all_wikipedia_language_codes;
}

// [[ja:ウィキペディアのリスト]]
async function get_all_wikipedia_sites(options) {
	const label_languages = get_label_languages(options);
	CeL.log_temporary(`${get_all_wikipedia_sites.name}: ${label_languages}`);
	const wikipedia_sites = Object.create(null);
	(await wiki.SPARQL(`
SELECT ?item ?itemLabel ?website
WHERE {
	#?item wdt:P31 wd:Q10876391.
	?item wdt:P856 ?website.
	?website wikibase:wikiGroup "wikipedia".
	SERVICE wikibase:label { bd:serviceParam wikibase:language "${label_languages.join(',')}" }
}`)).forEach(item => {
		const language_code = CeL.wiki.data.value_of(item.website).match(/\/\/(.+?)\./)[1];
		const wikipedia_site = {
			label: CeL.wiki.data.value_of(item.itemLabel),
			label_language: item.itemLabel['xml:lang'],
			entity_id: CeL.wiki.data.value_of(item.item).match(/(Q\d+)$/)[1],
		};
		console.assert(CeL.wiki.data.value_of(item.item) === `http://www.wikidata.org/entity/${wikipedia_site.entity_id}`);
		console.assert(CeL.wiki.data.value_of(item.website) === `https://${language_code}.wikipedia.org/`);
		wikipedia_sites[language_code] = wikipedia_site;
	});
	//console.log(wikipedia_sites);
	//console.log(wikipedia_sites.id_list());
	return wikipedia_sites;
}

async function get_all_Wikimedia_badges(options) {
	const label_languages = get_label_languages(options);
	CeL.log_temporary(`${get_all_Wikimedia_badges.name}: ${label_languages}`);

	const Wikimedia_article_badges = Object.create(null);
	(await wiki.SPARQL(`
SELECT ?item ?itemLabel ?itemLabel_G
WHERE {
	VALUES ?badges {
		# Wikimedia badge
		wd:Q17442550
		# Wikimedia article badge
		wd:Q108606989
	}
	?item wdt:P31 ?badges.
	# Only accept abbreviation of English.
	OPTIONAL { ?item rdfs:label ?itemLabel_G filter (lang(?itemLabel_G) = "en") }
	SERVICE wikibase:label { bd:serviceParam wikibase:language "${label_languages}" }
}
`)).for_id((id, item) => {
		//console.trace([id, item]);
		Wikimedia_article_badges[id] = {
			language: item.itemLabel['xml:lang'],
			label: item.itemLabel.value.replace(/\s+badge$/, '').replace(/-Class .+/, ''),
			icon: item.itemLabel_G.value.replace(/\s+badge$/, '').replace(/-Class .+/, '').split(/\s+/).map(word => word.charAt(0)).join('').toUpperCase()
		};
	});

	//console.trace(Wikimedia_article_badges);

	return Wikimedia_article_badges;
}

async function get_featured_content_badges(options) {
	const featured_content_badges = (await wiki.SPARQL(`
SELECT ?item ?itemLabel
WHERE {
	# Q4387047: Portal:特色內容
	?item wdt:P279 wd:Q4387047
	SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],${wiki.latest_task_configuration.general.general_language_code}" }
}
`)).id_list();

	//console.trace(featured_content_badges);
	return featured_content_badges;
}

// ----------------------------------------------------------------------------

async function for_badge_to_process(options) {
	const { badge_entity_id_to_process, all_wikipedia_language_codes, wikipedia_sites, featured_content_badges, Wikimedia_article_badges, local_FC_for_general_language, all_featured_contents, local_language_name } = options;
	CeL.info(`${for_badge_to_process.name}: Process ${Wikimedia_article_badges[badge_entity_id_to_process].icon}: ${Wikimedia_article_badges[badge_entity_id_to_process].label} (${badge_entity_id_to_process})`);
	const FC_of_local_language = all_featured_contents[use_language];
	//console.log(Wikimedia_article_badges[badge_entity_id_to_process]);
	const local_badge_name = Wikimedia_article_badges[badge_entity_id_to_process].label;
	wiki.latest_task_configuration.general.summary_prefix = CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title, CeL.gettext('更新%1', local_badge_name)) + ': ';
	//console.trace(wiki.latest_task_configuration.general.summary_prefix);

	const FC_sitelinks = (await wiki.data(`Wikipedia:${local_badge_name}`)).sitelinks;

	const all_languages_to_process = Object.keys(all_featured_contents)
		//.filter(language_code => language_code !== use_language)
		//.sort()
		;

	const summary_of_language = Object.create(null);
	const badge_entity_ids_to_count = Object.keys(Wikimedia_article_badges).filter(badge_entity_id => featured_content_badges.includes(badge_entity_id));
	for (let language_index = 0; language_index < all_languages_to_process.length; language_index++) {
		const language_code = all_languages_to_process[language_index];
		const FC_hash = await get_FC_hash({ language_code, use_language, featured_content_badges, all_featured_contents });
		const FC_count = Object.keys(FC_hash).length;
		console.assert(FC_count >= 1);
		//if (FC_count < 10) continue;

		const language_name = get_language_name({ language_code, wikipedia_sites, all_wikipedia_language_codes });
		if (!language_name) {
			CeL.error(`Cannot find name of ${language_code}: ${FC_count} FCs!`);
			console.log([all_wikipedia_language_codes[language_code], wikipedia_sites[language_code]]);
			continue;
		}

		const summary_table = summary_of_language[language_code] = {
			//language_code,
			language_name,
		};
		const _options = { badge_entity_id_to_process, local_badge_name, language_code, FC_hash, summary_table, language_name, FC_sitelinks, FC_of_local_language, Wikimedia_article_badges, badge_entity_ids_to_count, local_language_code: use_language, local_language_name, language_index, all_languages_to_process };
		if (language_code === use_language) {
			// Swap the 2 hashs
			Object.assign(_options, {
				local_language_code: wiki.latest_task_configuration.general.general_language_code,
				local_language_name: get_language_name({ language_code: wiki.latest_task_configuration.general.general_language_code, wikipedia_sites, all_wikipedia_language_codes }),
				FC_hash: local_FC_for_general_language,
				FC_of_local_language: await get_FC_hash({ language_code: wiki.latest_task_configuration.general.general_language_code, use_language, featured_content_badges, all_featured_contents }),
			});
		}
		await for_wikipedia_site(_options);
	}

	await update_all_sites_menu({ badge_entity_id_to_process, local_badge_name, Wikimedia_article_badges, all_languages_to_process, summary_of_language, badge_entity_ids_to_count, local_language_code: use_language });

	await update_navigation_template({ badge_entity_id_to_process, local_badge_name, Wikimedia_article_badges, all_languages_to_process, summary_of_language, badge_entity_ids_to_count, local_language_code: use_language });
}

function add_entity_id_list(FC_data, item, name) {
	const entity_id = item[name] && CeL.wiki.data.value_of(item[name]).match(/(Q\d+)$/)[1];
	if (entity_id) {
		const entity_ids_name = name + '_entity_ids';
		if (!FC_data[entity_ids_name]) {
			FC_data[entity_ids_name] = [entity_id];
		} else if (!FC_data[entity_ids_name].includes(entity_id)) {
			FC_data[entity_ids_name].push(entity_id);
			// Sort by entity id
			FC_data[entity_ids_name].sort((_1, _2) => get_numbral_entity_id(_1) - get_numbral_entity_id(_2));
		}
	}
}

function parse_FC_data(entity_id, item, item_hash_with_language, partly) {
	//console.trace(item);

	const sitelink = CeL.wiki.data.value_of(item.sitelink);
	const matched = sitelink.match(/\/\/([^\/.]+)\.wikipedia\.org\//);
	// wikipedia only.
	if (!matched) return;

	const language_code = matched[1];
	const entity_id_hash = item_hash_with_language[language_code] || (item_hash_with_language[language_code] = partly ? { partly: true } : Object.create(null));

	//const entity_id = CeL.wiki.data.value_of(item.item).match(/(Q\d+)$/)[1];
	const FC_data = entity_id_hash[entity_id] || (entity_id_hash[entity_id] = {
		name: CeL.wiki.data.value_of(item.name),
		linkcount: CeL.wiki.data.value_of(item.linkcount),
		sitelink: decodeURIComponent(sitelink.between('wiki/')).replace(/_/g, ' '),

		entity_id,
	});

	if (item.lang) {
		FC_data.lang = CeL.wiki.data.value_of(item.lang);
		if (item.name && FC_data.lang.toLowerCase() !== item.name['xml:lang']) console.trace(item);
	}

	if (item.itemLabel) {
		Object.assign(FC_data, {
			label: CeL.wiki.data.value_of(item.itemLabel),
			label_language: item.itemLabel && item.itemLabel['xml:lang'],
		});
	}

	if (item.sitelink_of_lang)
		FC_data.sitelink_of_local_language = decodeURIComponent(CeL.wiki.data.value_of(item.sitelink_of_lang).between('wiki/')).replace(/_/g, ' ');

	add_entity_id_list(FC_data, item, 'badge');
	add_entity_id_list(FC_data, item, 'type');

	if (false && FC_data.name && FC_data.sitelink !== CeL.wiki.title_of(FC_data.name)) {
		//console.trace(FC_data);
	}
}

async function get_featured_content_of_language(options) {
	const label_languages = get_label_languages(options);
	const language_code = options?.language_code || wiki.latest_task_configuration.general.general_language_code;

	const { featured_content_badges } = options;

	const FC_of_local_language = Object.create(null);
	async function get_badges(badges) {
		CeL.log_temporary(`${get_featured_content_of_language.name}: ${badges} of ${language_code} (${label_languages})`);
		(await wiki.SPARQL(`
SELECT ?lang ?name ?itemLabel ?sitelink ?linkcount ?item ?type ?sitelink_of_lang ?badge
WHERE {
	VALUES ?badges { ${badges.map(id => 'wd:' + id).join(' ')} }
	?item wikibase:sitelinks ?linkcount.
	?sitelink schema:name ?name;
		schema:about ?item;
		schema:inLanguage ?lang;

		schema:isPartOf <https://${language_code}.wikipedia.org/>;
		wikibase:badge ?badges;
		wikibase:badge ?badge.
	OPTIONAL { ?item wdt:P31 ?type }
	OPTIONAL { ?sitelink_of_lang schema:about ?item; schema:isPartOf <https://${options?.use_language}.wikipedia.org/> }
	SERVICE wikibase:label { bd:serviceParam wikibase:language "${label_languages}" }
}
`)).for_id((id, item) => {
			parse_FC_data(id, item, FC_of_local_language);
		});
	}

	const TOO_LARGE_LANGUAGES = ['en'];
	// 這些是特定語言(TOO_LARGE_LANGUAGES)需要一個一個擷取的徽章。
	const TOO_LARGE_BADGES = ['Q17437798'];
	let badges = featured_content_badges;
	if (TOO_LARGE_LANGUAGES.includes(language_code)) {
		// 避免 timeout。
		for (const badge of TOO_LARGE_BADGES) {
			if (badges.includes(badge)) {
				await get_badges([badge]);
			}
			badges = badges.filter(_badge => _badge !== badge);
		}
	}

	// 擷取其他所有徽章。
	await get_badges(badges);

	//console.trace(FC_of_local_language);
	return FC_of_local_language[language_code];
}

async function get_all_featured_contents(options) {
	const label_languages = get_label_languages(options);
	CeL.log_temporary(`${get_all_featured_contents.name}: ${label_languages}`);
	const all_featured_contents = Object.create(null);
	(await wiki.SPARQL(`
# get all Featured contents with sitelink of specified language
SELECT ?sitelink ?item # ?linkcount ?lang ?name ?itemLabel ?type ?sitelink_of_lang
WHERE {
	VALUES ?badges { ${options?.featured_content_badges.map(id => 'wd:' + id).join(' ')} }
	#?item wikibase:sitelinks ?linkcount.
	?sitelink
		#schema:name ?name;
		#schema:inLanguage ?lang;
		schema:about ?item;

		# Will timeout.
		#schema:isPartOf [ wikibase:wikiGroup "wikipedia" ];
		#schema:isPartOf / wikibase:wikiGroup "wikipedia";

		# Sitelink is badged as a Featured Article
		wikibase:badge ${options?.badge_entity_id_to_process ? `wd:` + options.badge_entity_id_to_process : '?badges'}.
	#OPTIONAL { ?item wdt:P31 ?type }
	#OPTIONAL { ?sitelink_of_lang schema:about ?item; schema:isPartOf <https://${options?.use_language}.wikipedia.org/> }
	SERVICE wikibase:label { bd:serviceParam wikibase:language "${label_languages.join(',')}".
		#?item rdfs:label ?itemLabel.
		#?type rdfs:label ?typeLabel.
	}
}
`)).for_id((id, item) => {
		parse_FC_data(id, item, all_featured_contents, true);
	});
	return all_featured_contents;
}


function check_redirects(page_title, page_data, content_to_write, options) {
	const { local_badge_name } = options;
	// TODO: using upcase initial char of `local_badge_name`
	if (page_title !== page_data.title && !page_data.title.toLowerCase().startsWith(CeL.gettext('Wikipedia:諸語言的維基百科%1', local_badge_name).toLowerCase() + '/')) {
		CeL.warn(`${check_redirects.name}: Skip ${CeL.wiki.title_link_of(page_title)} → ${CeL.wiki.title_link_of(page_data.title)}`);
		//console.trace([page_title, page_data.title, local_badge_name, CeL.gettext('Wikipedia:諸語言的維基百科%1', local_badge_name)]);
		return Wikiapi.skip_edit;
	}

	//return content_to_write;
	if (false)
		console.trace([page_data.wikitext.length, page_data.wikitext.slice(0, 100), content_to_write.length, content_to_write.slice(0, 100), CeL.LCS(page_data.wikitext, content_to_write, {
			// line : true,
			diff: true
		})]);
	return content_to_write === page_data.wikitext ? Wikiapi.skip_edit : content_to_write;
}

async function for_wikipedia_site(options) {
	const { badge_entity_id_to_process, local_badge_name, language_code, FC_hash, summary_table, language_name, FC_sitelinks, FC_of_local_language, Wikimedia_article_badges, badge_entity_ids_to_count, local_language_code, local_language_name, language_index, all_languages_to_process } = options;
	CeL.info(`${for_wikipedia_site.name}: Process ${language_index + 1}/${all_languages_to_process.length} ${language_name} (${language_code})`);
	const FC_list = Object.values(FC_hash).filter(FC_data => FC_data.badge_entity_ids.includes(badge_entity_id_to_process));
	if (FC_list.length === 0) {
		// 沒有這種類型的 FC。
		return;
	}

	//console.log([badge_entity_id_to_process, local_badge_name]);
	if (false && !language_name.endsWith('語')) {
		console.trace([language_code, FC_list.length, language_name]);
		console.trace(FC_list.slice(0, 3));
	}
	if (false && /als|gsw/i.test(language_code)) {
		console.trace([language_code, FC_list.length, language_name]);
	}

	const table = [];
	let count = 0, local_count = { all: 0 }, total_linkcount = 0, no_label_count = 0;
	badge_entity_ids_to_count.forEach(badge_entity_id => local_count[badge_entity_id] = 0);

	const too_many_items = FC_list.length > MAX_ITEMS_TO_LIST;
	if (too_many_items) {
		CeL.warn(`${for_wikipedia_site.name}: 太多項目，必須裁減或分類: ${language_code} (${language_name})`);
		/**<code>

SELECT ?type (COUNT(?item) AS ?count)
WHERE {
	?item wdt:P31 ?type.
	?sitelink schema:about ?item;
		schema:isPartOf <https://en.wikipedia.org/>;
		wikibase:badge wd:Q17437798.
	SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
}
GROUP BY ?type
ORDER BY DESC(?count)

		</code>*/
	}

	const show_style = FC_list.length < 1000;
	FC_list.forEach((FC_data, index) => {
		const row = [++count];

		let label_in_local_language;
		const entity_id_String = get_numbral_entity_id(FC_data.entity_id, true);
		const sitelink_of_local_language = FC_data.sitelink_of_local_language;
		if (sitelink_of_local_language) {
			row.sort_key = sitelink_of_local_language + entity_id_String;
			label_in_local_language = too_many_items ? '' : (show_style ? 'style="background:#afa;" | ' : '')
				// prefix for sort + '<span style="color:green;">✓</span> '
				+ '✓ ';
			label_in_local_language += (local_language_code === use_language ? CeL.wiki.title_link_of(sitelink_of_local_language) : `[[:${local_language_code}:${sitelink_of_local_language}|${sitelink_of_local_language.replace(/ \([^()]+\)$/, '')}]]`);
			local_count.all++;
			const ltem_in_local_language = FC_of_local_language[FC_data.entity_id];
			if (ltem_in_local_language) {
				if (!ltem_in_local_language.badge_entity_ids) {
					console.trace(FC_of_local_language);
					console.trace(ltem_in_local_language);
					console.trace(Wikimedia_article_badges[ltem_in_local_language.badge_entity_ids[0]]);
				}
				ltem_in_local_language.badge_entity_ids.forEach(badge_entity_id => {
					if (badge_entity_id in local_count) local_count[badge_entity_id]++;
					label_in_local_language += ` {{icon|${Wikimedia_article_badges[badge_entity_id].icon}}}`
				});
			}
		} else {
			row.no_local = true;
			// Will timeout: `{{仮リンク|${FC_data.label}|wikidata|${FC_data.entity_id}}}`
			// Only accept specified language, else is ラベル欠如
			label_in_local_language = too_many_items ? '' : (show_style ? 'style="background:#faa;" | ' : '')
				// prefix for sort '<span style="color:red;">✗</span> '
				+ '✗ ';
			if (FC_data.label_language === local_language_code) {
				row.sort_key = FC_data.label + entity_id_String;
				label_in_local_language += CeL.wiki.title_link_of(FC_data.label) + ' ';
			} else {
				++no_label_count;
				if (FC_data.label === FC_data.entity_id) {
					row.sort_key = entity_id_String;
				} else {
					label_in_local_language += `{{lang|${FC_data.label_language}|${FC_data.label}}} `;
					row.sort_key = FC_data.label + entity_id_String;
				}
			}
			if (!wiki.latest_task_configuration.general.no_wikidata_links)
				label_in_local_language += ` ([[d:${FC_data.entity_id}]])`;
		}

		// Will timeout: `{{wikidata|label|linked|${type_entity_id}}}`
		let type_entity_ids;
		if (FC_data.type_entity_ids) {
			type_entity_ids = FC_data.type_entity_ids;
			if (too_many_items) {
				// 項目太多，只能顯現 entity id 最小（通常是最重要）的1個。
				type_entity_ids = type_entity_ids.slice(0, 1);
			} else {
				// 放太多分類也沒意義。只顯示 entity id 最小（通常是最重要）的幾個。
				type_entity_ids = type_entity_ids.slice(0, 3);
			}
			const type_count = type_entity_ids.length;
			type_entity_ids = type_entity_ids.map(type_entity_id => `{{label|${type_entity_id}}}`)
				// [[translatewiki:MediaWiki:Comma-separator]]
				// Should the same as <code>{{int:Comma-separator}}</code>.
				.join(wiki.latest_task_configuration.general.comma_separator || ', ');

			if (type_count.length > 3)
				type_entity_ids = '<small>' + type_entity_ids + '</small>';
		} else {
			type_entity_ids = '';
		}
		row.push(
			`[[:${language_code}:${FC_data.name}|${FC_data.name.replace(/ \([^()]+\)$/, '')}]]`,
			type_entity_ids,
			label_in_local_language,
			FC_data.linkcount.toLocaleString(use_language)
		);
		row.linkcount = FC_data.linkcount;
		total_linkcount += FC_data.linkcount;
		table.push(row);
	});
	// sort by FC数, local 版條目 + entity_id
	// row.sort_key: 盡可能維持恆定用。
	table.sort((_1, _2) => _2.linkcount - _1.linkcount || (_2.sort_key < _1.sort_key ? 1 : -1));

	async function writetable_to_page(table, sub_page_title) {
		const _too_many_items = table.length > MAX_ITEMS_TO_LIST;
		table.truncate(MAX_ITEMS_TO_LIST);

		// reset index
		table.forEach((row, index) => row[0] = index + 1);

		let row = ['data-sort-type="number" | #', CeL.gettext('%1版條目', language_name), '{{label|P31}}', CeL.gettext('%1版條目', local_language_name),
			// 言語版数
			'data-sort-type="number" | ' + CeL.gettext('語言數')];
		table.unshift(row);

		row = ['', CeL.gettext('Average'), '',
			(show_style ? 'style="background:#afa;" | ' : '✓ ')
			//`${local_count.all} / ${count} (${(100 * local_count.all / count).to_fixed(1)}%) ${local_language_name}版あり`
			+ CeL.gettext('有%1版', local_language_name) + `: ${local_language_code}/${language_code} (${language_name}) = ${local_count.all}/${count} (${(100 * local_count.all / count).to_fixed(1)}%)`
			, (total_linkcount / count).to_fixed(1)];
		row.class = 'sortbottom';
		table.push(row);

		row = ['', CeL.gettext('Sum'), '',
			(show_style ? 'style="background:#faa;" | ' : '✗ ')
			+ CeL.gettext('%1 同名條目或無此條目、%2 無標籤', count - local_count.all - no_label_count, no_label_count), total_linkcount.toLocaleString(use_language)];
		row.class = 'sortbottom';
		table.push(row);

		//console.trace([CeL.wiki.site_name(language_code), FC_sitelinks[CeL.wiki.site_name(language_code)]]);
		const caption = CeL.gettext('%1的%2',
			CeL.wiki.title_link_of(`:${language_code}:`, CeL.gettext('%1版', language_name)),
			FC_sitelinks[CeL.wiki.site_name(language_code)]?.title ? `[[:${language_code}:${FC_sitelinks[CeL.wiki.site_name(language_code)].title}|${CeL.gettext('「Wikipedia:%1」條目一覽', local_badge_name)}]]` : CeL.gettext('「Wikipedia:%1」條目一覽', local_badge_name)
		);
		let content_to_write = [`{{Shortcut|${CeL.gettext('Shortcut:%1/%2', Wikimedia_article_badges[badge_entity_id_to_process].icon, language_code)}}}`];
		if (CeL.gettext('Wikipedia:諸語言的維基百科%1/header', local_badge_name))
			content_to_write.push(`{{${CeL.gettext('Wikipedia:諸語言的維基百科%1/header', local_badge_name)}}}`);
		content_to_write.push('', '__TOC__');
		content_to_write.push(
			'', `== ${sub_page_title || CeL.gettext('條目一覽')} ==`, CeL.wiki.array_to_table(table, {
				class: 'wikitable sortable',
				caption,
			}));
		if (_too_many_items) {
			content_to_write.push(`* Only shows ${MAX_ITEMS_TO_LIST}/${count} items.`);
			if (!sub_page_title) {
				console.assert(too_many_items === true);
				content_to_write.push(`* Please refer to [[/${sub_page_title}]].`);
			}
		}
		content_to_write.push(
			// ~~~~~
			//'', '== 集計 ==', `Total ${local_language_code}/${language_code} (${language_name}) = ${local_count.all}/${count} (${(100 * local_count.all / count).to_fixed(1)}%) articles existing in ${local_language_name}.`,
			// https://translatewiki.net/wiki/MediaWiki:Seealso/ja
			'', `== ${CeL.gettext('See also')} ==`, `* ${caption}`, '',
		);
		if (CeL.gettext('Template:諸語言的%1', Wikimedia_article_badges[badge_entity_id_to_process].icon))
			content_to_write.push(`{{${CeL.gettext('Template:諸語言的%1', Wikimedia_article_badges[badge_entity_id_to_process].icon)}|state=uncollapsed}}`);
		if (CeL.gettext('Category:諸語言的%1', local_badge_name))
			content_to_write.push(`[[${CeL.gettext('Category:諸語言的%1', local_badge_name)}|${language_code}]]`);
		// free
		row = null;
		table.truncate();

		content_to_write = content_to_write.join('\n');
		const page_title = CeL.gettext('Wikipedia:諸語言的維基百科%1/%2版', local_badge_name, language_name) + (sub_page_title ? `/${sub_page_title}` : '');
		//if (language_name !== 'Afrikaans') return page_title;
		try {
			const _options = {
				//tags: 'bot trial',
				redirects: 1,
				nocreate: 1,
				bot: 1, summary: `${wiki.latest_task_configuration.general.summary_prefix}${language_name} (${language_code}) ${_too_many_items ? MAX_ITEMS_TO_LIST + '/' : ''}${local_count.all}/${count} ${Wikimedia_article_badges[badge_entity_id_to_process].icon}(s)`
			};
			// 文言文版, 新共同语言版
			if (/^.{1,15}?(?:語|语言?|文|方言)$/.test(language_name))
				_options.nocreate = false;
			await wiki.edit_page(page_title, page_data => check_redirects(page_title, page_data, content_to_write, options), _options);
		} catch (e) {
			if (e.code === 'contenttoobig') {
				console.trace((Buffer.from(content_to_write, 'utf8')).length + ' bytes to write.');
			}
			//console.trace(e);
		}

		return page_title;
	}

	if (too_many_items) {
		// 日本語版なし
		const no_local_table = table.filter(row => row.no_local);
		await writetable_to_page(no_local_table, CeL.gettext('無%1版條目一覽', local_language_name));
	}

	const page_title = await writetable_to_page(table);

	Object.assign(summary_table, {
		// 統計: FC数
		count,
		// うちjaにあり
		local_count,
		no_label_count,
		//total_linkcount,
		page_title,
	});
}

async function update_all_sites_menu(options) {
	const { badge_entity_id_to_process, local_badge_name, Wikimedia_article_badges, all_languages_to_process, summary_of_language, badge_entity_ids_to_count, local_language_code } = options;
	CeL.info(`${update_all_sites_menu.name}: Process ${local_badge_name}`);
	const table = [];
	let count = 0, article_count = 0, article_with_local_count = 0, local_count = Object.create(null), no_label_count = 0;
	const _badge_entity_ids_to_count = badge_entity_ids_to_count.filter(badge_entity_id => {
		for (const language_code of all_languages_to_process) {
			const summary_table = summary_of_language[language_code];
			return summary_table.local_count && summary_table.local_count[badge_entity_id] > 0;
		}
	});
	_badge_entity_ids_to_count.forEach(badge_entity_id => local_count[badge_entity_id] = 0);

	for (const language_code of all_languages_to_process) {
		if (false && language_code === local_language_code)
			continue;

		const summary_table = summary_of_language[language_code];
		if (!summary_table?.count) {
			// 沒有這種類型的 FC。
			continue;
		}

		article_count += summary_table.count;
		article_with_local_count += summary_table.local_count.all;
		no_label_count += summary_table.no_label_count;
		const row = [++count, CeL.wiki.title_link_of(summary_table.page_title, summary_table.language_name), `[[:${language_code}:|${language_code}]]`, summary_table.count.toLocaleString(use_language), summary_table.local_count.all.toLocaleString(use_language), summary_table.no_label_count.toLocaleString(use_language)];
		row.count = summary_table.count;
		_badge_entity_ids_to_count.forEach(badge_entity_id => {
			const count = summary_table.local_count[badge_entity_id];
			row.push(count.toLocaleString(use_language));
			local_count[badge_entity_id] += count;
		});
		table.push(row);
	}
	// sort by FC数, language code
	table.sort((_1, _2) => _2.count - _1.count || (_2[2] < _1[2] ? 1 : -1));
	// reset index
	table.forEach((row, index) => row[0] = index + 1);

	let row = ['data-sort-type="number" | #', '{{label|Q315}}', '{{label|P424}}', `data-sort-type="number" | ${CeL.gettext('%1數', Wikimedia_article_badges[badge_entity_id_to_process].icon)}`, `data-sort-type="number" | ${CeL.gettext('有%1版', local_language_code)}`, `data-sort-type="number" | ${CeL.gettext('無標籤')}`];
	// 其中屬於本地語言之%3的條目數。
	_badge_entity_ids_to_count.forEach(badge_entity_id => row.push(`data-sort-type="number" | ${CeL.gettext('%1版的%2%3', local_language_code, `{{icon|${Wikimedia_article_badges[badge_entity_id].icon}}}`, `{{label|${badge_entity_id}}}`)}`));
	table.unshift(row);

	row = ['', CeL.gettext('平均'), '', (article_count / count).to_fixed(1), (article_with_local_count / count).to_fixed(1), (no_label_count / count).to_fixed(1)];
	_badge_entity_ids_to_count.forEach(badge_entity_id => row.push((local_count[badge_entity_id] / count).to_fixed(1)));
	row.class = 'sortbottom';
	table.push(row);
	row = ['', CeL.gettext('合計'), '', article_count.toLocaleString(use_language), article_with_local_count.toLocaleString(use_language), no_label_count.toLocaleString(use_language)];
	_badge_entity_ids_to_count.forEach(badge_entity_id => row.push(local_count[badge_entity_id].toLocaleString(use_language)));
	row.class = 'sortbottom';
	table.push(row);

	const content_to_write = CeL.wiki.array_to_table(table, {
		class: 'wikitable sortable',
		caption: CeL.gettext('諸語言的維基百科%1統計', local_badge_name)
	});
	// free
	row = null;
	table.truncate();

	const page_title = CeL.gettext('Wikipedia:諸語言的維基百科%1/統計', local_badge_name);
	await wiki.edit_page(page_title, page_data => check_redirects(page_title, page_data, content_to_write, options), {
		bot: 1, nocreate: 1, redirects: 1, summary: `${wiki.latest_task_configuration.general.summary_prefix}${count} languages, ${article_with_local_count}/${article_count} ${Wikimedia_article_badges[badge_entity_id_to_process].icon}(s)`
	});
}

async function update_navigation_template(options) {
	const { badge_entity_id_to_process, local_badge_name, Wikimedia_article_badges, all_languages_to_process, summary_of_language, badge_entity_ids_to_count, local_language_code } = options;
	const page_title = CeL.gettext('Template:諸語言的%1', Wikimedia_article_badges[badge_entity_id_to_process].icon);
	if (!page_title) return;

	const list = [];
	for (const language_code of all_languages_to_process) {
		const summary_table = summary_of_language[language_code];
		if (summary_table.count > 0)
			list.push([summary_table.count, CeL.wiki.title_link_of(summary_table.page_title, summary_table.language_name)]);
	}
	list.sort((_1, _2) => _2[0] - _1[0] || (_2[1] < _1[1] ? 1 : -1));

	const variable_Map = new CeL.wiki.Variable_Map({ FC_list: '\n' + list.map(data => '* ' + data[1]).join('\n') + '\n' });
	const count = list.length;
	// free
	list.truncate();

	await wiki.edit_page(page_title, variable_Map, { bot: 1, nocreate: 1, redirects: 1, summary: `${wiki.latest_task_configuration.general.summary_prefix}${count} languages` });
}
