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
CeL.run(['application.net.wiki.featured_content']);

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

	const featured_content_badges = (await get_featured_content_badges()).map(id => 'wd:' + id);
	//console.trace(featured_content_badges);
	const Wikimedia_article_badges = await get_all_Wikimedia_badges({ language: use_language });
	//console.trace(Wikimedia_article_badges);

	const FC_data_hash = await get_featured_content_of_language({ language: use_language, featured_content_badges });
	//console.trace(FC_data_hash);

	const FA_sitelinks = (await wiki.data('Wikipedia:秀逸な記事')).sitelinks;
	const all_featured_contents = await get_all_featured_contents({ language: use_language });
	//console.trace(all_featured_contents);
	const summary_of_language = Object.create(null);
	for (const [language_code, FC_hash] of Object.entries(all_featured_contents)) {
		const FC_count = Object.keys(FC_hash).length;
		console.assert(FC_count >= 1);
		//if (FC_count < 10) continue;
		// 先以 wikipedia_sites 為準。 e.g., Q1211233
		let language_name = extract_label_of_language(wikipedia_sites, language_code);
		if (language_name) {
			// e.g., 'ヴォラピュク版ウィキペディア'
			language_name = language_name.replace(/版ウィキペディア/, '');
		} else if (!(language_name = extract_label_of_language(all_wikipedia_language_codes, language_code))) {
			CeL.error(`Cannot find name of ${language_code}: ${FC_count} FCs!`);
			console.log([all_wikipedia_language_codes[language_code], wikipedia_sites[language_code]]);
			continue;
		}
		const summary_table = summary_of_language[language_code] = { language_name };
		await for_wikipedia_site({ language_code, FC_hash, summary_table, language_name, FA_sitelinks, FC_data_hash, Wikimedia_article_badges });
	}

	await update_all_sites_menu({ all_featured_contents, summary_of_language });

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
#title: All languages with a Wikimedia language code (P424)
# Date: 2021-09-24
SELECT DISTINCT ?lang_code ?itemLabel ?item
WHERE
{
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
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${languages.join(',')}". }
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
		if (old_data?.label_language === options?.language
			? wikipedia_language_code.label_language !== options?.language || old_data?.entity_id < wikipedia_language_code.entity_id
			: wikipedia_language_code.label_language !== options?.language && old_data?.entity_id < wikipedia_language_code.entity_id
		) {
			// 用舊的資訊，不改成新的 wikipedia_language_code。
			return;
		}
		if (old_data?.label_language === options?.language) {
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
	const languages = ['[AUTO_LANGUAGE]', 'en'];
	if (options?.language)
		languages.unshift(options.language);
	CeL.log_temporary(`${get_all_Wikimedia_badges.name}: ${languages}`);

	const Wikimedia_article_badges = Object.create(null);
	(await wiki.SPARQL(`
SELECT ?item ?itemLabel ?itemLabel_en WHERE {
  VALUES ?badges {
    # Wikimedia badge
    wd:Q17442550
    # Wikimedia article badge
    wd:Q108606989
  }
  ?item wdt:P31 ?badges.
  OPTIONAL { ?item rdfs:label ?itemLabel_en filter (lang(?itemLabel_en) = "en") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${languages}" }
}
`)).for_id((id, item) => {
		//console.trace([id, item]);
		Wikimedia_article_badges[id] = {
			language: item.itemLabel['xml:lang'],
			label: item.itemLabel.value,
			icon: item.itemLabel_en.value.replace(/\s+badge$/, '').replace(/-Class .+/, '').split(/\s+/).map(word => word.charAt(0)).join('').toUpperCase()
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
	SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
}
`)).id_list();

	//console.trace(featured_content_badges);
	return featured_content_badges;
}

function add_entity_id_list(FC_data, item, name) {
	const entity_id = item[name] && CeL.wiki.data.value_of(item[name]).match(/(Q\d+)$/)[1];
	if (entity_id) {
		const entity_ids_name = name + '_entity_ids';
		if (FC_data[entity_ids_name]) {
			FC_data[entity_ids_name].push(entity_id);
			FC_data[entity_ids_name].sort();
		} else {
			FC_data[entity_ids_name] = [entity_id];
		}
	}
}

function parse_FC_data(entity_id, item, item_hash_with_language) {
	//console.trace(item);

	const sitelink = CeL.wiki.data.value_of(item.sitelink);
	const matched = sitelink.match(/\/\/([^\/.]+)\.wikipedia\.org\//);
	// wikipedia only.
	if (!matched) return;

	const language_code = matched[1];
	const entity_id_hash = item_hash_with_language[language_code] || (item_hash_with_language[language_code] = Object.create(null));

	//const entity_id = CeL.wiki.data.value_of(item.item).match(/(Q\d+)$/)[1];
	const FC_data = entity_id_hash[entity_id] || {
		name: CeL.wiki.data.value_of(item.name),
		lang: CeL.wiki.data.value_of(item.lang),
		linkcount: CeL.wiki.data.value_of(item.linkcount),
		sitelink: decodeURIComponent(sitelink.between('wiki/')).replace(/_/g, ' '),

		label: CeL.wiki.data.value_of(item.itemLabel),
		label_language: item.itemLabel['xml:lang'],
		entity_id,
	};

	if (!entity_id_hash[entity_id]) {
		entity_id_hash[entity_id] = FC_data;
	}

	add_entity_id_list(FC_data, item, 'badge');
	add_entity_id_list(FC_data, item, 'type');

	if (item.sitelink_of_lang)
		FC_data.sitelink_of_lang = decodeURIComponent(CeL.wiki.data.value_of(item.sitelink_of_lang).between('wiki/')).replace(/_/g, ' ');
	if (FC_data.lang.toLowerCase() !== item.name['xml:lang']) console.trace(item);
	if (FC_data.sitelink !== CeL.wiki.title_of(FC_data.name)) {
		//console.trace(FC_data);
	}
}

async function get_featured_content_of_language(options) {
	const languages = ['[AUTO_LANGUAGE]', 'en'];
	if (options?.language)
		languages.unshift(options.language);
	CeL.log_temporary(`${get_featured_content_of_language.name}: ${languages}`);

	const { featured_content_badges } = options;

	const featured_content_of_language = Object.create(null);
	(await wiki.SPARQL(`
SELECT ?lang ?name ?itemLabel ?sitelink ?linkcount ?item ?badge
WHERE {
  VALUES ?badges { ${featured_content_badges.join(' ')} }
  ?item wikibase:sitelinks ?linkcount.
  ?sitelink schema:name ?name;
 		schema:about ?item;
		schema:inLanguage ?lang;

		schema:isPartOf <https://${options?.language || 'en'}.wikipedia.org/>;
        wikibase:badge ?badges;
        wikibase:badge ?badge.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${languages}" }
}
`)).for_id((id, item) => {
		parse_FC_data(id, item, featured_content_of_language);
	});

	//console.trace(featured_content_of_language);
	return featured_content_of_language[options?.language];
}

async function get_all_featured_contents(options) {
	const languages = ['[AUTO_LANGUAGE]', 'en'];
	if (options?.language)
		languages.unshift(options.language);
	CeL.log_temporary(`${get_all_featured_contents.name}: ${languages}`);
	const all_featured_contents = Object.create(null);
	(await wiki.SPARQL(`
# get all Featured Articles (Q17437796) with sitelink of specified language
SELECT ?lang ?name ?itemLabel ?sitelink ?sitelink_of_lang ?linkcount ?item ?type
WHERE {
	?item wikibase:sitelinks ?linkcount.
	?sitelink schema:name ?name;
		schema:inLanguage ?lang;
		schema:about ?item;

		# Will timeout.
		#schema:isPartOf [ wikibase:wikiGroup "wikipedia" ];
		#schema:isPartOf / wikibase:wikiGroup "wikipedia";

		# Sitelink is badged as a Featured Article
		wikibase:badge wd:Q17437796.
	OPTIONAL { ?item wdt:P31 ?type }
	OPTIONAL { ?sitelink_of_lang schema:about ?item;
		schema:isPartOf <https://ja.wikipedia.org/> }
	SERVICE wikibase:label { bd:serviceParam wikibase:language "${languages.join(',')}".
		#?item rdfs:label ?itemLabel .
		#?type rdfs:label ?typeLabel .
	}
}
`)).for_id((id, item) => {
		parse_FC_data(id, item, all_featured_contents);
	});
	return all_featured_contents;
}

async function for_wikipedia_site(options) {
	const { language_code, FC_hash, summary_table, language_name, FA_sitelinks, FC_data_hash, Wikimedia_article_badges } = options;
	CeL.info(`${for_wikipedia_site.name}: Process ${language_name} (${language_code})`);
	const FC_list = Object.values(FC_hash);
	if (!language_name.endsWith('語')) {
		//console.trace([language_code, FC_list.length, language_name]);
		//console.trace(FC_list.slice(0, 3));
	}
	if (/als|gsw/i.test(language_code)) {
		//console.trace([language_code, FC_list.length, language_name]);
	}

	const content_to_write = [`{{ショートカット|WP:FAOL/${language_code}}}`, '{{Wikipedia:諸言語版の秀逸な記事/ヘッダ}}', '', '__TOC__'];
	const table = [['#', language_name + '版記事', '{{label|P31}}', '日本語版記事', '言語数']];
	let count = 0, with_local_count = 0, total_linkcount = 0;

	FC_list.forEach((FC_data, index) => {
		const row = [++count];

		let label_in_local_language;
		if (FC_data.sitelink_of_lang) {
			with_local_count++;
			label_in_local_language = '<span style="color:green;">✓</span> ' + CeL.wiki.title_link_of(FC_data.sitelink_of_lang);
			const ltem_in_local_language = FC_data_hash[FC_data.entity_id];
			if (ltem_in_local_language) {
				//console.trace(ltem_in_local_language.badge_entity_ids);
				//console.trace(Wikimedia_article_badges[ltem_in_local_language.badge_entity_ids[0]]);
				ltem_in_local_language.badge_entity_ids.forEach(badge_entity_id => label_in_local_language += ` {{icon|${Wikimedia_article_badges[badge_entity_id].icon}}}`);
			}
		} else {
			// Will timeout: `{{仮リンク|${FC_data.label}|wikidata|${FC_data.entity_id}}}`
			label_in_local_language = `<span style="color:red;">✗</span> ${CeL.wiki.title_link_of(FC_data.label)} ([[d:${FC_data.entity_id}]])`;
		}

		row.push(`[[:${language_code}:${FC_data.name}|]]`,
			// Will timeout: `{{wikidata|label|linked|${type_entity_id}}}`
			FC_data.type_entity_ids?.map(type_entity_id => `{{label|${type_entity_id}}}`).join('、'),
			label_in_local_language,
			FC_data.linkcount);
		total_linkcount += FC_data.linkcount;
		table.push(row);
	});
	table.push(['', '平均', '', '', (total_linkcount / count).to_fixed(1)]);
	table.at(-1).class = 'sortbottom';
	table.push(['', '合計', '', '', total_linkcount]);
	table.at(-1).class = 'sortbottom';

	//console.trace([CeL.wiki.site_name(language_code), FA_sitelinks[CeL.wiki.site_name(language_code)]]);
	content_to_write.push(
		'', '== 記事一覧 ==', CeL.wiki.array_to_table(table, {
			class: 'wikitable sortable',
			caption: `[[:${language_code}:|${language_name}版]]の${FA_sitelinks[CeL.wiki.site_name(language_code)]?.title ? `[[:${language_code}:${FA_sitelinks[CeL.wiki.site_name(language_code)].title}|「Wikipedia:秀逸な記事」一覧]]` : `「Wikipedia:秀逸な記事」一覧`}`
		}),
		'', '== 集計 ==', `Total ja/${language_code} (${language_name}) = ${with_local_count}/${count} (${(100 * with_local_count / count).to_fixed(1)}%) articles existing in 日本語. ~~~~~`,
		'', '== 関連項目 ==', `{{世界のFA|state=uncollapsed}}`, `[[Category:諸言語版の秀逸な記事|${language_code}]]`
	);
	// free
	table.truncate();

	const page_title = `Wikipedia:諸言語版の秀逸な記事/${language_name}版`;
	if (language_name==='')
		await wiki.edit_page(page_title, content_to_write.join('\n'), { bot: 1, nocreate: 1, redirects: 1, summary: `秀逸な記事の更新: ${language_name} (${language_code})` });

	Object.assign(summary_table, {
		//統計: FA数
		count,
		//jaあり
		with_local_count,
		//total_linkcount,
		page_title,
	});
}

async function update_all_sites_menu(options) {
	CeL.info(`${update_all_sites_menu.name}: Process 秀逸な記事`);
	const { all_featured_contents, summary_of_language } = options;
	const content_to_write = [];
	const table = [];
	let count = 0, article_count = 0, article_with_local_count = 0;

	for (const [language_code, FC_hash] of Object.entries(all_featured_contents)) {
		const summary_table = summary_of_language[language_code];
		article_count += summary_table.count;
		article_with_local_count += summary_table.with_local_count;
		table.push([++count, CeL.wiki.title_link_of(summary_table.page_title, summary_table.language_name), `[[:${language_code}:|${language_code}]]`, summary_table.count, summary_table.with_local_count]);
	}
	table.sort((_1, _2) => _2[3] - _1[3]);
	table.forEach((row, index) => row[0] = index + 1);

	table.unshift(['#', '言語', 'code', 'FA数', 'jaあり']);
	table.push(['', '平均', '', (article_count / count).to_fixed(1), (article_with_local_count / count).to_fixed(1)]);
	table.at(-1).class = 'sortbottom';
	table.push(['', '合計', '', article_count, article_with_local_count]);
	table.at(-1).class = 'sortbottom';

	content_to_write.push(CeL.wiki.array_to_table(table, {
		class: 'wikitable sortable',
		caption: `諸言語版の秀逸な記事統計`
	}));
	// free
	table.truncate();

	const page_title = `Wikipedia:諸言語版の秀逸な記事/統計`;
	await wiki.edit_page(page_title, content_to_write.join('\n'), { bot: 1, nocreate: 1, redirects: 1, summary: `秀逸な記事の更新` });
}
