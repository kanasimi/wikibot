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
//set_language('en');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// ----------------------------------------------------------------------------

const articleid_property_mapper = {
	pubmed: 'P698',
	pmc: 'P932',
	doi: 'P356',
};
const id_list = Object.entries(articleid_property_mapper).map(pair => {
	const [idtype, property_id] = pair;
	return '?' + idtype;
}).join(' ');
const id_assignment = Object.entries(articleid_property_mapper).map(pair => {
	const [idtype, property_id] = pair;
	return `
	OPTIONAL { ?item wdt:${property_id} ?${idtype}. }`;
}).join('');


const problematic_articles = [];

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

	const date = new Date('2018-05-01');
	// Set to yesterday.
	date.setDate(date.getDate() - 1);
	const PubMed_ID_list = await get_PubMed_ID_list(date)
		//&& ['17246615']
		;

	for (let index = 0; index < PubMed_ID_list.length;) {
		const PubMed_ID = PubMed_ID_list[index++];
		CeL.log_temporary(`${index}/${PubMed_ID_list.length} PubMed_ID ${PubMed_ID}`);
		await for_each_PubMed_ID(PubMed_ID);
	}

	console.trace(problematic_articles);

	routine_task_done('1 day');
}

// ----------------------------------------------------------------------------

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
	const PubMed_article = result[PubMed_ID];
	//console.trace(PubMed_article);

	let en_title = PubMed_article.title || PubMed_article.booktitle;
	if (!en_title) {
		CeL.error(`${for_each_PubMed_ID.name}: No title for PubMed ID ${PubMed_ID}!`);
		return;
	}
	en_title = en_title.trim().replace(/\s*\.$/, '');
	const data_to_modify = {
		labels: { en: en_title },
		claims: [
			{ 'instance of': 'scholarly article' },
			{ title: en_title },
			{
				'author name string': PubMed_article.authors.map((author, index) => {
					return {
						//TODO:
						value: author, qualifiers: { 'series ordinal': index + 1 }
					};
				})
			},
		]
	};

	const id_filter = [];
	id_filter.toString = function () { return this.join(''); };

	// https://www.chinaw3c.org/REC-sparql11-overview-20130321-cn.html
	// http://www.ruanyifeng.com/blog/2020/02/sparql.html
	// https://longaspire.github.io/blog/%E5%9B%BE%E8%B0%B1%E5%AE%9E%E8%B7%B5%E7%AC%94%E8%AE%B02_1/
	const SPARQL = [`
SELECT DISTINCT ?item ?itemLabel ${id_list}
WHERE {`,
		id_filter, `
	{
		?item wdt:P31 wd:Q13442814;
			?label ${JSON.stringify(en_title)}@en.
	}
	SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
	${id_assignment}
}
ORDER BY DESC (?item)
`];

	PubMed_article.articleids.forEach(articleid => {
		const idtype = articleid.idtype;
		let property_id = articleid_property_mapper[idtype];
		if (!property_id) {
			return;
		}

		const id = articleid.value.replace(/^PMC/, '');
		id_filter.push(`
	{ ?item wdt:${property_id} ${JSON.stringify(id)}. } UNION`);

		data_to_modify[property_id] = id;
	});

	//console.trace(SPARQL.join(''));
	const wikidata_item_list = await wiki.SPARQL(SPARQL.join(''));
	//console.trace(wikidata_item_list);
	//console.trace(wikidata_item_list.id_list());

	if (wikidata_item_list.length === 1) {
		// Only one result: Already added. Pass.
		return;
	}

	if (wikidata_item_list.length > 1) {
		// count > 1: error, log the result.
		problematic_articles.push({
			PubMed_ID,
			items: wikidata_item_list.id_list(),
		});
		return;
	}

	// assert: wikidata_item_list.length === 0
	// no result: Need to add.

	console.trace(data_to_modify);
	return;
	await wiki.new_data_item(data_to_modify, { return_API_result: true });

}

