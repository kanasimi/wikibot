/*

2021/10/7 6:10:25	初版試營運。
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

const general_language_code = 'en';

// ----------------------------------------------------------------------------

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
	const all_wikipedia_language_codes = await get_all_wikipedia_language_codes({ use_language });
	const wikipedia_sites = await get_all_wikipedia_sites({ use_language });

	const featured_content_badges = await get_featured_content_badges();
	//console.trace(featured_content_badges);
	const Wikimedia_article_badges = await get_all_Wikimedia_badges({ use_language });
	//console.trace(Wikimedia_article_badges);

	const FC_of_local_language = await get_featured_content_of_language({ language_code: use_language, use_language, featured_content_badges });
	//console.trace(FC_of_local_language);
	const FC_of_general_language = await get_featured_content_of_language({ language_code: general_language_code, use_language, featured_content_badges });

	const local_language_name = get_language_name({ language_code: use_language, wikipedia_sites, all_wikipedia_language_codes });

	for (const badge_entity_id_to_process of ['Q17437796']) {
		const all_featured_contents = await get_all_featured_contents({ badge_entity_id_to_process, use_language, featured_content_badges });
		//console.trace(all_featured_contents);
		Object.assign(all_featured_contents, {
			[use_language]: FC_of_local_language,
			[general_language_code]: FC_of_general_language,
		});

		await for_badge_to_process({ badge_entity_id_to_process, all_wikipedia_language_codes, wikipedia_sites, featured_content_badges, Wikimedia_article_badges, FC_of_local_language, all_featured_contents, local_language_name });
	}

	routine_task_done('1 day');
}

// ----------------------------------------------------------------------------

async function get_FC_hash(options) {
	const { language_code, all_featured_contents } = options;
	return all_featured_contents[language_code].partly ? await get_featured_content_of_language(options) : all_featured_contents[language_code];
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
		return language_name.replace(/版ウィキペディア/, '');
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
	const label_languages = ['[AUTO_LANGUAGE]', 'en'];
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
SELECT ?item ?itemLabel ?itemLabel_en
WHERE {
	VALUES ?badges {
		# Wikimedia badge
		wd:Q17442550
		# Wikimedia article badge
		wd:Q108606989
	}
	?item wdt:P31 ?badges.
	OPTIONAL { ?item rdfs:label ?itemLabel_en filter (lang(?itemLabel_en) = "en") }
	SERVICE wikibase:label { bd:serviceParam wikibase:language "${label_languages}" }
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
	SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en" }
}
`)).id_list();

	//console.trace(featured_content_badges);
	return featured_content_badges;
}

// ----------------------------------------------------------------------------

async function for_badge_to_process(options) {
	const { badge_entity_id_to_process, all_wikipedia_language_codes, wikipedia_sites, featured_content_badges, Wikimedia_article_badges, FC_of_local_language, all_featured_contents, local_language_name } = options;
	//console.log(Wikimedia_article_badges[badge_entity_id_to_process]);
	const local_badge_name = Wikimedia_article_badges[badge_entity_id_to_process].label;
	const FC_sitelinks = (await wiki.data(`Wikipedia:${local_badge_name}`)).sitelinks;

	const all_languages_to_process = Object.keys(all_featured_contents)
		//.filter(language_code => language_code !== use_language)
		;

	const summary_of_language = Object.create(null);
	const badge_entity_ids_to_count = Object.keys(Wikimedia_article_badges).filter(badge_entity_id => featured_content_badges.includes(badge_entity_id));
	for (const language_code of all_languages_to_process) {
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

		const summary_table = summary_of_language[language_code] = { language_name };
		const _options = { badge_entity_id_to_process, local_badge_name, language_code, FC_hash, summary_table, language_name, FC_sitelinks, FC_of_local_language, Wikimedia_article_badges, badge_entity_ids_to_count, local_language_name };
		if (language_code === use_language) {
			// Swap the 2 hashs
			Object.assign(_options, {
				FC_hash: FC_of_local_language,
				FC_of_local_language: await get_FC_hash({ language_code: general_language_code, use_language, featured_content_badges, all_featured_contents }),
			});
		}
		await for_wikipedia_site(_options);
	}

	await update_all_sites_menu({ badge_entity_id_to_process, local_badge_name, Wikimedia_article_badges, all_languages_to_process, summary_of_language, badge_entity_ids_to_count });
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
		FC_data.sitelink_of_local_language = decodeURIComponent(CeL.wiki.data.value_of(item.sitelink_of_lang).between('wiki/')).replace(/_/g, ' ');
	if (FC_data.lang.toLowerCase() !== item.name['xml:lang']) console.trace(item);
	if (FC_data.sitelink !== CeL.wiki.title_of(FC_data.name)) {
		//console.trace(FC_data);
	}
}

async function get_featured_content_of_language(options) {
	const label_languages = get_label_languages(options);
	CeL.log_temporary(`${get_featured_content_of_language.name}: ${options?.language_code} (${label_languages})`);

	const { featured_content_badges } = options;

	const FC_of_local_language = Object.create(null);
	(await wiki.SPARQL(`
SELECT ?lang ?name ?itemLabel ?sitelink ?linkcount ?item ?type ?sitelink_of_lang ?badge
WHERE {
	VALUES ?badges { ${featured_content_badges.map(id => 'wd:' + id).join(' ')} }
	?item wikibase:sitelinks ?linkcount.
	?sitelink schema:name ?name;
		schema:about ?item;
		schema:inLanguage ?lang;

		schema:isPartOf <https://${options?.language_code || 'en'}.wikipedia.org/>;
		wikibase:badge ?badges;
		wikibase:badge ?badge.
	OPTIONAL { ?item wdt:P31 ?type }
	OPTIONAL { ?sitelink_of_lang schema:about ?item; schema:isPartOf <https://${options?.use_language}.wikipedia.org/> }
	SERVICE wikibase:label { bd:serviceParam wikibase:language "${label_languages}" }
}
`)).for_id((id, item) => {
		parse_FC_data(id, item, FC_of_local_language);
	});

	//console.trace(FC_of_local_language);
	return FC_of_local_language[options?.language_code];
}

async function get_all_featured_contents(options) {
	const label_languages = get_label_languages(options);
	CeL.log_temporary(`${get_all_featured_contents.name}: ${label_languages}`);
	const all_featured_contents = Object.create(null);
	(await wiki.SPARQL(`
# get all Featured contents with sitelink of specified language
SELECT ?lang ?name ?itemLabel ?sitelink ?linkcount ?item ?type ?sitelink_of_lang
WHERE {
	?item wikibase:sitelinks ?linkcount.
	?sitelink schema:name ?name;
		schema:inLanguage ?lang;
		schema:about ?item;

		# Will timeout.
		#schema:isPartOf [ wikibase:wikiGroup "wikipedia" ];
		#schema:isPartOf / wikibase:wikiGroup "wikipedia";

		# Sitelink is badged as a Featured Article
		wikibase:badge wd:${options?.badge_entity_id_to_process}.
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

async function for_wikipedia_site(options) {
	const { badge_entity_id_to_process, local_badge_name, language_code, FC_hash, summary_table, language_name, FC_sitelinks, FC_of_local_language, Wikimedia_article_badges, badge_entity_ids_to_count, local_language_name } = options;
	CeL.info(`${for_wikipedia_site.name}: Process ${language_name} (${language_code})`);
	const FC_list = Object.values(FC_hash).filter(FC_data => FC_data.badge_entity_ids.includes(badge_entity_id_to_process));
	//console.log([badge_entity_id_to_process, local_badge_name]);
	if (!language_name.endsWith('語')) {
		//console.trace([language_code, FC_list.length, language_name]);
		//console.trace(FC_list.slice(0, 3));
	}
	if (/als|gsw/i.test(language_code)) {
		//console.trace([language_code, FC_list.length, language_name]);
	}

	const content_to_write = [`{{ショートカット|WP:${Wikimedia_article_badges[badge_entity_id_to_process].icon}OL/${language_code}}}`, `{{Wikipedia:諸言語版の${local_badge_name}/ヘッダ}}`, '', '__TOC__'];
	const table = [];
	let count = 0, local_count = { all: 0 }, total_linkcount = 0, no_label_count = 0;
	badge_entity_ids_to_count.forEach(badge_entity_id => local_count[badge_entity_id] = 0);

	FC_list.forEach((FC_data, index) => {
		const row = [++count];

		let label_in_local_language;
		if (FC_data.sitelink_of_local_language) {
			row.sort_key = FC_data.sitelink_of_local_language + get_numbral_entity_id(FC_data.entity_id, true);
			label_in_local_language = '<span style="color:green;">✓</span> ' + CeL.wiki.title_link_of(FC_data.sitelink_of_local_language);
			local_count.all++;
			const ltem_in_local_language = FC_of_local_language[FC_data.entity_id];
			if (ltem_in_local_language) {
				//console.trace(ltem_in_local_language.badge_entity_ids);
				//console.trace(Wikimedia_article_badges[ltem_in_local_language.badge_entity_ids[0]]);
				ltem_in_local_language.badge_entity_ids.forEach(badge_entity_id => {
					if (badge_entity_id in local_count) local_count[badge_entity_id]++;
					label_in_local_language += ` {{icon|${Wikimedia_article_badges[badge_entity_id].icon}}}`
				});
			}
		} else {
			// Will timeout: `{{仮リンク|${FC_data.label}|wikidata|${FC_data.entity_id}}}`
			// Only accept specified language, else is ラベル欠如
			label_in_local_language = '<span style="color:red;">✗</span> ';
			if (FC_data.label_language === use_language) {
				row.sort_key = FC_data.label + get_numbral_entity_id(FC_data.entity_id, true);
				label_in_local_language += CeL.wiki.title_link_of(FC_data.label) + ' ';
			} else {
				++no_label_count;
				if (FC_data.label === FC_data.entity_id) {
					row.sort_key = get_numbral_entity_id(FC_data.entity_id);
				} else {
					label_in_local_language += `{{lang|${FC_data.label_language}|${FC_data.label}}} `;
					row.sort_key = FC_data.label + get_numbral_entity_id(FC_data.entity_id, true);
				}
			}
			label_in_local_language += `([[d:${FC_data.entity_id}]])`;
		}

		// Will timeout: `{{wikidata|label|linked|${type_entity_id}}}`
		let type_entity_ids;
		if (FC_data.type_entity_ids) {
			type_entity_ids = FC_data.type_entity_ids.map(type_entity_id => `{{label|${type_entity_id}}}`).join('、');
			if (FC_data.type_entity_ids.length > 3)
				type_entity_ids = '<small>' + type_entity_ids + '</small>';
		} else {
			type_entity_ids = '';
		}
		row.push(`[[:${language_code}:${FC_data.name}|]]`,
			type_entity_ids,
			label_in_local_language,
			FC_data.linkcount);
		total_linkcount += FC_data.linkcount;
		table.push(row);
	});
	// sort by FC数, local 版記事 + entity_id
	// row.sort_key: 盡可能維持恆定用。
	table.sort((_1, _2) => _2[4] - _1[4] || (_2.sort_key < _1.sort_key ? 1 : -1));
	// reset index
	table.forEach((row, index) => row[0] = index + 1);

	let row = ['data-sort-type="number" | #', language_name + '版記事', '{{label|P31}}', `${local_language_name}版記事`, 'data-sort-type="number" | 言語数'];
	table.unshift(row);

	row = ['', '平均', '', `${local_count.all} / ${count} (${(100 * local_count.all / count).to_fixed(1)}%) ${local_language_name}版あり`, (total_linkcount / count).to_fixed(1)];
	row.class = 'sortbottom';
	table.push(row);

	row = ['', '合計', '', `${count - local_count.all - no_label_count} 赤リンク/違い青リンク、${no_label_count} ラベル欠如`, total_linkcount];
	row.class = 'sortbottom';
	table.push(row);

	//console.trace([CeL.wiki.site_name(language_code), FC_sitelinks[CeL.wiki.site_name(language_code)]]);
	const caption = `[[:${language_code}:|${language_name}版]]の${FC_sitelinks[CeL.wiki.site_name(language_code)]?.title ? `[[:${language_code}:${FC_sitelinks[CeL.wiki.site_name(language_code)].title}|「Wikipedia:${local_badge_name}」一覧]]` : `「Wikipedia:${local_badge_name}」一覧`}`;
	content_to_write.push(
		'', '== 記事一覧 ==', CeL.wiki.array_to_table(table, {
			class: 'wikitable sortable',
			caption,
		}),
		// ~~~~~
		'', '== 集計 ==', `Total ${use_language}/${language_code} (${language_name}) = ${local_count.all}/${count} (${(100 * local_count.all / count).to_fixed(1)}%) articles existing in ${local_language_name}.`,
		'', '== 関連項目 ==', `* ${caption}`, '', `{{世界の${Wikimedia_article_badges[badge_entity_id_to_process].icon}|state=uncollapsed}}`, `[[Category:諸言語版の${local_badge_name}|${language_code}]]`
	);
	// free
	row = null;
	table.truncate();

	const page_title = `Wikipedia:諸言語版の${local_badge_name}/${language_name}版`;
	try {
		await wiki.edit_page(page_title, content_to_write.join('\n'), { bot: 1, nocreate: 1, redirects: 1, summary: `[[Wikipedia:Bot作業依頼/定期作成ページのメンテナンス|${local_badge_name}の更新]]: ${language_name} (${language_code})` });
	} catch (e) { }

	Object.assign(summary_table, {
		// 統計: FC数
		count,
		// jaあり
		local_count,
		no_label_count,
		//total_linkcount,
		page_title,
	});
}

async function update_all_sites_menu(options) {
	const { badge_entity_id_to_process, local_badge_name, Wikimedia_article_badges, all_languages_to_process, summary_of_language, badge_entity_ids_to_count } = options;
	CeL.info(`${update_all_sites_menu.name}: Process ${local_badge_name}`);
	const content_to_write = [];
	const table = [];
	let count = 0, article_count = 0, article_with_local_count = 0, local_count = Object.create(null), no_label_count = 0;
	const _badge_entity_ids_to_count = badge_entity_ids_to_count.filter(badge_entity_id => {
		for (const language_code of all_languages_to_process) {
			const summary_table = summary_of_language[language_code];
			if (summary_table.local_count[badge_entity_id]) return true;
		}
	});
	_badge_entity_ids_to_count.forEach(badge_entity_id => local_count[badge_entity_id] = 0);

	for (const language_code of all_languages_to_process) {
		if (language_code === use_language)
			continue;

		const summary_table = summary_of_language[language_code];
		article_count += summary_table.count;
		article_with_local_count += summary_table.local_count.all;
		no_label_count += summary_table.no_label_count;
		const row = [++count, CeL.wiki.title_link_of(summary_table.page_title, summary_table.language_name), `[[:${language_code}:|${language_code}]]`, summary_table.count, summary_table.local_count.all, summary_table.no_label_count];
		_badge_entity_ids_to_count.forEach(badge_entity_id => {
			const count = summary_table.local_count[badge_entity_id];
			row.push(count);
			local_count[badge_entity_id] += count;
		});
		table.push(row);
	}
	// sort by FC数, language code
	table.sort((_1, _2) => _2[3] - _1[3] || (_2[2] < _1[2] ? 1 : -1));
	// reset index
	table.forEach((row, index) => row[0] = index + 1);

	let row = ['data-sort-type="number" | #', '言語', 'code', `data-sort-type="number" | ${Wikimedia_article_badges[badge_entity_id_to_process].icon}数`, `data-sort-type="number" | ${use_language}あり`, 'data-sort-type="number" | ラベル欠如'];
	_badge_entity_ids_to_count.forEach(badge_entity_id => row.push(`data-sort-type="number" | ${use_language}ありの{{icon|${Wikimedia_article_badges[badge_entity_id].icon}}}{{label|${badge_entity_id}}}`));
	table.unshift(row);

	row = ['', '平均', '', (article_count / count).to_fixed(1), (article_with_local_count / count).to_fixed(1), (no_label_count / count).to_fixed(1)];
	_badge_entity_ids_to_count.forEach(badge_entity_id => row.push((local_count[badge_entity_id] / count).to_fixed(1)));
	row.class = 'sortbottom';
	table.push(row);
	row = ['', '合計', '', article_count, article_with_local_count, no_label_count];
	_badge_entity_ids_to_count.forEach(badge_entity_id => row.push(local_count[badge_entity_id]));
	row.class = 'sortbottom';
	table.push(row);

	content_to_write.push(CeL.wiki.array_to_table(table, {
		class: 'wikitable sortable',
		caption: `諸言語版の${local_badge_name}統計`
	}));
	// free
	row = null;
	table.truncate();

	const page_title = `Wikipedia:諸言語版の${local_badge_name}/統計`;
	await wiki.edit_page(page_title, content_to_write.join('\n'), { bot: 1, nocreate: 1, redirects: 1, summary: `[[Wikipedia:Bot作業依頼/定期作成ページのメンテナンス|${local_badge_name}の更新]]` });
}
