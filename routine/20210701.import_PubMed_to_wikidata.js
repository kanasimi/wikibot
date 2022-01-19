/*

2021/7/1 7:55:3	初版。
2022/1/20 2:46:48	再開。
	初版試營運。
	完成。正式運用。

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Load modules.
CeL.run([]);

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('en');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// ----------------------------------------------------------------------------

/** PMC API articleid name to wikidata property id mapping */
const articleid_properties_mapper = {
	pubmed: 'P698',
	pmc: 'P932',
	// NCBI Bookshelf ID https://en.wikipedia.org/wiki/National_Center_for_Biotechnology_Information#NCBI_Bookshelf
	bookaccession: '',
	doi: 'P356',
	rid: '',
	eid: '',
	pmcid: '',
};
const articleid_properties_id_list = Object.entries(articleid_properties_mapper).map(pair => {
	const [idtype, property_id] = pair;
	return '?' + idtype;
}).join(' ');
const articleid_properties_id_assignment = Object.entries(articleid_properties_mapper).filter(pair => !!pair[1]).map(pair => {
	const [idtype, property_id] = pair;
	return `
	OPTIONAL { ?item wdt:${property_id} ?${idtype}. }`;
}).join('');

const published_source_mapper = new Map(Object.entries({
	//Genetics: 'Q3100575',
}));

const problematic_articles = [];
const MAX_error_reported = 100;

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
	login_options.API_URL = 'wikidata';
	//console.log(login_options);
	await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
	await main_process();
})();

async function main_process() {

	await fill_published_source_mapper();
	console.assert(published_source_mapper.get('Genetics') === 'Q3100575');

	const date = new Date('2021-05-01');
	// Set to yesterday.
	date.setDate(date.getDate() - 1);
	const PubMed_ID_list = (await get_PubMed_ID_list(date)).slice(0, 1)
		//&& ['17246615', '33914448']
		;

	for (let index = 0; index < PubMed_ID_list.length;) {
		const PubMed_ID = PubMed_ID_list[index++];
		CeL.log_temporary(`${index}/${PubMed_ID_list.length} PubMed_ID ${PubMed_ID}`);
		await for_each_PubMed_ID(PubMed_ID);
	}

	if (problematic_articles.length > 0) {
		//console.trace(problematic_articles);
		problematic_articles.unshift(['PubMed ID', 'Items']);
		//console.trace(CeL.wiki.array_to_table(problematic_articles, { 'class': "wikitable" }));
		//console.trace(wiki.append_session_to_options());
		const wikitext = date.format('%Y-%2m-%2d') + '\n\n' + CeL.wiki.array_to_table(problematic_articles, { 'class': "wikitable" });
		await wiki.edit_page(log_to + '/PubMed ID duplicates', wikitext, { bot: 1, nocreate: 1, summary: `Error report: ${problematic_articles.length - 1} article(s)` });
	}

	routine_task_done('1 day');
}

// ----------------------------------------------------------------------------

async function fill_published_source_mapper() {
	const initial_size = published_source_mapper.size;
	const source_item_list = await wiki.SPARQL(`
SELECT ?item ?itemLabel 
WHERE 
{
	?item wdt:P31 wd:Q5633421.
	SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
#LIMIT 10
`);

	for (const source_data of source_item_list) {
		const source_name = CeL.wiki.data.value_of(source_data.itemLabel);
		const entity_id = CeL.wiki.data.value_of(source_data.item).match(/\/(Q\d+)$/)[1];
		//console.log([source_name, entity_id]);
		if (!published_source_mapper.has(source_name))
			published_source_mapper.set(source_name, entity_id);
	}

	CeL.info(`fill_published_source_mapper: ${published_source_mapper.size - initial_size}/${source_item_list.length} sources filled.`);
}

// ----------------------------------------------------------------------------

/**
 * get PubMed Central ID list
 * @param {String} date date to get 
 * @returns {Array} PubMed IDs
 */
async function get_PubMed_ID_list(date) {
	// https://www.ncbi.nlm.nih.gov/home/develop/api/
	// https://www.ncbi.nlm.nih.gov/books/NBK25499/#chapter4.ESearch
	const PubMed_API_URL = new CeL.URI('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi');
	PubMed_API_URL.search_params.set_parameters({
		db: "pubmed",
		retmode: "json",
		// retstart: 1,
		retmax: 100000,
		mindate: date.format('%Y/%2m/%2d'),
		maxdate: date.format('%Y/%2m/%2d'),
	});

	//console.trace(PubMed_API_URL.toString());
	const esearchresult = (await (await CeL.fetch(PubMed_API_URL.toString())).json()).esearchresult;
	const PubMed_ID_list = esearchresult.idlist;
	//console.trace(PubMed_ID_list);
	return PubMed_ID_list;
}

// ----------------------------------------------------------------------------

async function for_each_PubMed_ID(PubMed_ID) {
	// https://www.ncbi.nlm.nih.gov/books/NBK25499/#chapter4.ESummary
	const PubMed_API_URL = new CeL.URI('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi');
	PubMed_API_URL.search_params.set_parameters({
		db: "pubmed",
		retmode: "json",
		id: PubMed_ID,
	});

	// https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=33932783,33932782
	// or: https://www.ebi.ac.uk/europepmc/webservices/rest/search?resulttype=core&format=json&query=EXT_ID:33932783%20AND%20SRC:MED
	// @see https://www.wikidata.org/wiki/User:Citationgraph_bot
	const result = (await (await CeL.fetch(PubMed_API_URL.toString())).json()).result;
	const PubMed_article_data = result[PubMed_ID];
	//console.trace(PubMed_article_data);

	let en_title = PubMed_article_data.title
		//
		|| PubMed_article_data.booktitle;
	if (!en_title) {
		CeL.error(`${for_each_PubMed_ID.name}: No title for PubMed ID ${PubMed_ID}!`);
		return;
	}
	en_title = en_title.trim().replace(/\s*\.$/, '');
	const data_to_modify = {
		labels: { en: en_title },
		claims: [
			{
				// 'instance of': 'scholarly article' },
				P31: 'Q13442814',
			}, {
				// title 標題 (P1476)
				P1476: en_title
			}, {
				// author name string (P2093) 作者姓名字符串
				P2093: PubMed_article_data.authors.map((author, index) => {
					return {
						value: author.name,
						qualifiers: {
							// series ordinal (P1545) 系列序號
							P1545: index + 1
						}
					};
				})
			},
		]
	};

	if (Array.isArray(PubMed_article_data.history) && PubMed_article_data.history.length > 0) {
		let publication_date = PubMed_article_data.history.filter(history => !!history.date);
		const PMC_publication_date = publication_date.filter(history => history.pubstatus === 'pubmed');
		if (PMC_publication_date.length > 0)
			publication_date = PMC_publication_date;
		if (publication_date.length > 0) {
			data_to_modify.claims.push({
				// publication date (P577) 出版日期
				P577: publication_date[0].date
			});
		}
	}

	if (PubMed_article_data.fulljournalname) {
		// PubMed_ID=17246615
		if (!published_source_mapper.has(PubMed_article_data.fulljournalname)) {
			console.trace(PubMed_article_data);
			throw new Error(`${PubMed_ID}: Unknown fulljournalname: ${PubMed_article_data.fulljournalname}. Please add it to published_source_mapper!`);
		}
		const source_property_id = published_source_mapper.get(PubMed_article_data.fulljournalname);
		// https://www.wikidata.org/wiki/Special:EntityData/Q5418627.json
		data_to_modify.claims.push({
			// published in (P1433) 發表於
			P1433: {
				value: source_property_id,
				qualifiers: {
					P478: PubMed_article_data.volume,
					P433: PubMed_article_data.issue,
					P304: PubMed_article_data.pages//.replace(/^(\d+)-(\d+)$/, '$1–$2')
				},
				references: {
					// 載於 NCBI: National Center for Biotechnology Information
					P248: 'Q82494',
					P698: PubMed_ID,
					// 來源網址
					P854: PubMed_API_URL.toString(),
					// 檢索日期
					P813: new Date,
				}
			}
		});
	}

	if (PubMed_article_data.publishername) {
		// PubMed_ID=33914448
	}

	// ----------------------------------------------------

	const id_filter = [];
	id_filter.toString = function () { return this.join(''); };

	// https://www.chinaw3c.org/REC-sparql11-overview-20130321-cn.html
	// http://www.ruanyifeng.com/blog/2020/02/sparql.html
	// https://longaspire.github.io/blog/%E5%9B%BE%E8%B0%B1%E5%AE%9E%E8%B7%B5%E7%AC%94%E8%AE%B02_1/
	const SPARQL = [`
SELECT DISTINCT ?item ${articleid_properties_id_list}
WHERE {`,
		id_filter, `
	{
		?item wdt:P31 wd:Q13442814;
			?label ${JSON.stringify(en_title)}@en.
	}
	SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
	${articleid_properties_id_assignment}
}
ORDER BY DESC (?item)
`];

	PubMed_article_data.articleids.forEach(articleid => {
		const idtype = articleid.idtype;
		if (!(idtype in articleid_properties_mapper)) {
			console.trace(PubMed_article_data);
			throw new Error(`${PubMed_ID}: Unknown idtype: ${idtype}. Please add it to articleid_properties_mapper!`);
		}
		let property_id = articleid_properties_mapper[idtype];
		if (!property_id) {
			// Do not use this id.
			return;
		}

		let id = articleid.value;
		if (idtype === 'pmc')
			id = id.replace(/^PMC/, '');
		id_filter.push(`
	{ ?item wdt:${property_id} ${JSON.stringify(id)}. } UNION`);

		data_to_modify.claims.push({ [property_id]: id });
	});

	//console.trace(SPARQL.join(''));
	const article_item_list = await wiki.SPARQL(SPARQL.join(''));
	//console.trace(article_item_list);
	//console.trace(article_item_list.id_list());

	if (article_item_list.length === 1) {
		// Only one result: Already added. Pass.
		return;
	}

	if (article_item_list.length > 1 && problematic_articles.length < MAX_error_reported) {
		// count > 1: error, log the result.
		problematic_articles.push([
			PubMed_ID,
			article_item_list.id_list().map(id => `{{Q|${id}}}`).join(', '),
			//PubMed_article_data,
		]);
		return;
	}

	// assert: article_item_list.length === 0
	// no result: Need to add.

	console.log(PubMed_article_data);
	console.trace(data_to_modify);
	//return;
	await wiki.new_data_item(data_to_modify, { return_API_result: true });

}

