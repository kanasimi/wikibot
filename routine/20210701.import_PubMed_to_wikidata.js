/*

node 20210701.import_PubMed_to_wikidata.js wbeditentity_only_for_main=true


2021/7/1 7:55:3	初版。
2022/1/20 2:46:48	再開。
2022/1/23 6:54:23	初版試營運。
	完成。正式運用。

TODO:
刪除重複項目
	先檢查引用。沒有引用就直接刪除，否則標記。


添加 corrigendum / erratum (P2507) 勘誤的標示
	https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=PMCID:PMC1201098&resulttype=core&format=json


[[Q39686984]]: de label

remove bad cite
merge items

依照 series ordinal 調整作者排序
https://www.wikidata.org/wiki/Wikidata:Requests_for_permissions/Bot/Orcbot
P921 https://www.wikidata.org/w/index.php?title=Q69566581&diff=prev&oldid=1566235568&diffmode=source

一個學術類資源搜尋器: 找出所有符合搜尋條件者。對每一筆項目回傳固定格式的資料。

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Load modules.
CeL.run([
	// For JSON.from_XML()
	'data.XML',
	// For CeL.assert()
	'application.debug.log',
]);

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('en');


/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// ----------------------------------------------------------------------------

/**
 * Default options for data modification, such as creating new item or modifying existing item.
 * @type {Object}
 */
const default_data_modify_options = {
	bot: 1,
	// 避免 cites work (P2860) 佔據太多記憶體。
	search_without_cache: true,
	no_skip_attributes_note: true,
	// 合併請求。
	wbeditentity_only: CeL.env.arg_hash?.wbeditentity_only_for_main,
};

//CeL.get_URL.default_user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4710.4 Safari/537.36';

// Only respect maxlag. 因為數量太多，只好增快速度。
CeL.wiki.query.default_edit_time_interval = 0;

/** PMC API articleid name to wikidata property id mapping */
const NCBI_articleid_properties_mapping = {
	// idtype: property_id
	pubmed: 'P698',
	pmc: 'P932',
	// NCBI Bookshelf ID https://en.wikipedia.org/wiki/National_Center_for_Biotechnology_Information#NCBI_Bookshelf
	bookaccession: '',
	// =doi or doi 的後半部?
	pii: '',
	doi: 'P356',
	// EMSID
	mid: '',
	rid: '',
	// electronic identification?
	eid: '',
	pmcid: '',
	// https://www.nlm.nih.gov/pubs/techbull/ja03/ja03_technote_medline_unique_identifier.html
	// MEDLINEÂ® Unique Identifier (UI in PubMedÂ®) To Be Discontinued
	// There is potential confusion in having two identifying numbers on the same citation. Therefore, when MEDLINE is updated with 2004 MeSH vocabulary in December, 2003, the PMID will be the only unique number used in PubMed and on records distributed to licensees.
	// https://github.com/JabRef/jabref/issues/2379
	medline: '',

	// ???
	version: '',
	'version-id': '',
};
const articleid_properties_id_list = Object.entries(NCBI_articleid_properties_mapping)
	.reduce((filtered, pair) => pair[1] ? filtered + ' ?' + pair[0] : filtered, '');
const articleid_properties_id_assignment = Object.entries(NCBI_articleid_properties_mapping)
	.reduce((filtered, pair) => pair[1] ? filtered + `OPTIONAL { ?item wdt:${pair[1]} ?${pair[0]}. }` : filtered, '');

const NCBI_pubstatus_to_entity_id_mapping = {
	entrez: 'Q1345229',
	pubmed: 'Q180686',
	medline: 'Q1540899',
};

// https://query.wikidata.org/#SELECT%20%3Fitem%20%3FitemLabel%0AWHERE%0A%7B%0A%20%20%3Fitem%20wdt%3AP31%20wd%3AQ235557.%0A%20%20SERVICE%20wikibase%3Alabel%20%7B%20bd%3AserviceParam%20wikibase%3Alanguage%20%22en%22.%20%7D%0A%7D
const Europe_PMC_documentStyle = {
	// NG: HTML (Q8811) 超文本標記語言
	html: 'Q62626012',
	pdf: 'Q42332',
	//txt: 'Q86920',
};

const language_code_mapping__file_path = base_directory + 'language_code_mapping.json';
const language_code_mapping = new Map((() => {
	let data = CeL.read_file(language_code_mapping__file_path);
	if (data) return JSON.parse(data.toString());
	return Object.entries({
		//eng: 'Q1860',
	});
})());

const main_subject_mapping__file_path = base_directory + 'main_subject_mapping.json';
const main_subject_mapping = new Map((() => {
	let data = CeL.read_file(main_subject_mapping__file_path);
	if (data) return JSON.parse(data.toString());
	// 改用 async function fill_main_subject_mapping()
	return Object.entries({
		//'cell biology': 'Q7141',

		// [[d:User talk:Kanashimi#Adding subjects that are scholarly articles]]
		// for [[Q33956142]]: "Qualitative Methods" not Q35230960
		'qualitative methods': 'Q839486',
		// [[d:Talk:Q72419165#wrong links to this item]]
		'orthopedics and sports medicine': 'Q7104851',
	}).map(([main_subject, entity_id]) => [normalize_main_subject(main_subject), entity_id]);
})());

const published_source_mapping__file_path = base_directory + 'published_source_mapping.json';
const published_source_mapping = new Map((() => {
	let data = CeL.read_file(published_source_mapping__file_path);
	if (data) return JSON.parse(data.toString());
	return Object.entries({
		//Genetics: 'Q3100575',
		'Orthopedics and sports medicine': 'Q96321268',
	}).map(([source_key, entity_id]) => [normalize_source_name(source_key), entity_id]);
})());

const journal_title_mapping = new Map([]);

// problematic items
const problematic_data_page_title = log_to + '/problematic articles';
let problematic_data_list = [['PubMed ID', 'Problem']];
const MAX_error_reported = 1000;

// ----------------------------------------------


function extract_item_ids(list) {
	if (!Array.isArray(list))
		return [];

	const item_ids = [];
	//console.log(list);
	list.forEach((item_id) => {
		if (!item_id)
			return;

		item_id = String(item_id);
		const matched = item_id.match(/{{\s*Q\s*\|\s*Q?(\d{1,10})\s*}}/);
		if (matched) {
			item_id = 'Q' + matched[1];
		} else if (!/^Q(\d{1,10})$/.test(item_id)) {
			CeL.warn(`${extract_item_ids.name}: Ignore invalid item_id: ${item_id}`);
			return;
		}

		item_ids.push(item_id);
	});

	return item_ids;
}

/**
 * 由設定頁面讀入手動設定 manual settings。
 * 
 * @param {Object}latest_task_configuration
 *            最新的任務設定。
 */
async function adapt_configuration(latest_task_configuration) {
	//console.log(latest_task_configuration);
	// console.log(wiki);

	// ----------------------------------------------------

	const { general } = latest_task_configuration;

	if (!Array.isArray(general.main_subject_types)) {
		general.main_subject_types = [
			// study type (Q78088984)
			'Q78088984',
			// academic discipline (Q11862829)
			'Q11862829',
			// structural class of chemical compounds (Q47154513)
			'Q47154513',
			// biological process (Q2996394)
			'Q2996394',
		];
	}

	general.main_subject_types = extract_item_ids(general.main_subject_types);

	general.non_main_subject_types_Set = new Set(extract_item_ids(general.non_main_subject_types));

	console.log(latest_task_configuration);
}

// ----------------------------------------------------------------------------

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
prepare_directory(base_directory);
// prepare_directory(base_directory, true);

(async () => {
	login_options.configuration_adapter = adapt_configuration;
	login_options.API_URL = 'wikidata';
	//console.log(login_options);
	await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
	// 設定只要遇到 badtoken 就直接跳出。
	wiki.append_session_to_options()[CeL.wiki.KEY_SESSION].max_retry_login = 0;
	await main_process();
})();

async function main_process() {
	//await fetch_ORCID_data_from_service('0000-0003-0626-8879');

	if (language_code_mapping.size < 100)
		await fill_language_code_mapping();

	if (main_subject_mapping.size < 1000)
		await fill_main_subject_mapping();

	for (const [main_subject, entity_id] of Object.entries({
		'cell biology': 'Q7141',
		'qualitative methods': 'Q839486',
		'orthopedics and sports medicine': 'Q7104851',
	})) {
		CeL.assert([main_subject_mapping.get(main_subject), entity_id], 'Check main_subject_mapping: ' + main_subject);
	}

	if (published_source_mapping.size < 1000)
		await fill_published_source_mapping();

	for (const [source_key, entity_id] of Object.entries({
		genetics: 'Q3100575',
		'biochemical and biophysical research communications': 'Q864228',
		'orthopedics and sports medicine': 'Q96321268',
	})) {
		CeL.assert([published_source_mapping.get(source_key), entity_id], 'Check published_source_mapping: ' + source_key);
	}

	await load_problematic_data_list();

	// --------------------------------------------------------------------------------------------

	// 註解此行以 debug。
	await infinite_execution();

	const start_date = new Date('2021-02-01');
	// Set to yesterday.
	start_date.setDate(start_date.getDate() - 1);
	let end_date;
	end_date = new Date(start_date.getTime() + 1e8);
	const PubMed_ID_list =
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from
		Array.from({ length: 1000 }, (v, i) => i + /* start ordinal */1 + /* start from PubMed ID */200)

		// https://query.wikidata.org/#SELECT%20%3Fitem%20%3FitemLabel%20%3FitemDescription%20%3Fvalue%20%3Fst%20%3Fids%20%3Fsl%0AWHERE%0A%7B%0A%20%20SERVICE%20bd%3Asample%20%7B%20%3Fitem%20wdt%3AP698%20%3Fvalue.%20bd%3AserviceParam%20bd%3Asample.limit%20200%20%7D%0A%20%20OPTIONAL%20%7B%20%3Fitem%20wikibase%3Astatements%20%3Fst%20%3B%20wikibase%3Aidentifiers%20%3Fids%20%3B%20wikibase%3Asitelinks%20%3Fsl%20%7D%0A%20%20SERVICE%20wikibase%3Alabel%20%7B%20bd%3AserviceParam%20wikibase%3Alanguage%20%22%5BAUTO_LANGUAGE%5D%2Cen%22.%20%7D%0A%7D%0A
		// 11373397: PubMed 經常進行某種標題翻譯 https://www.wikidata.org/wiki/Wikidata:Requests_for_permissions/Bot/LargeDatasetBot
		// PMID: 19790808 was deleted because it is a duplicate of PMID: 9541661
		// Tested:
		//|| [19790808, '17246615', '1201098', '32650478', '33914448', '33932783', '11373397', '34380020', '34411149', '34373751', '33772245', '34572048', '34433058', '33914447', '33914446', '33915672', '33910271', '33910272', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, '10615162', '10615163', '10615181', '10615182',  '21451737', '21456434', '21456435', '21456436', '28210669', '28210670', '28210672', '28955519', '33693211', '33733121', '33747299', '33778691', '30830320', '30830336', '30830341', '30830358', '32126504', '32294188', '32294189', '32626077', 33513662, 4721605]
		&& [/*166623, 165946, 168322, 178485, 178486, 178685,*/178686, 178687, 178688,]

		//|| (await get_PubMed_ID_list(start_date, end_date)).slice(0, 10)

		// [[d:User talk:Kanashimi#Adding subjects that are scholarly articles]]
		//&& [20811529]

		// [[d:User talk:Kanashimi#Duplicate items created for articles]]
		&& [26121349]
		;

	const link_list = [];
	const start_time = Date.now();
	for (let index = 0; index < PubMed_ID_list.length;) {
		const PubMed_ID = PubMed_ID_list[index++];
		process.title = `${index}/${PubMed_ID_list.length} PubMed ID ${PubMed_ID}`;
		CeL.log_temporary(`${index}/${PubMed_ID_list.length} PubMed ID ${PubMed_ID}`);
		try {
			const result = await for_each_PubMed_ID(PubMed_ID);
			//console.trace(result);
			// New item has .id, no .title
			if (result?.id) {
				link_list.push(CeL.wiki.title_link_of(result.id, PubMed_ID));
			}
		} catch (e) {
			// Still import next article.
			console.error(e);
		}
	}

	if (problematic_data_list.length >/* 1: the header */ 1) {
		//await write_problematic_data_list();
	}

	if (link_list.length > 0)
		CeL.info(`Average ${CeL.age_of(0, (Date.now() - start_time) / link_list.length)} per item. Articles processed: PubMed ID ` + link_list.join(', '));
	console.log(PubMed_ID_list);

	routine_task_done('1 day');
}

async function infinite_execution() {
	const latest_processed_file_path = base_directory + 'latest_processed.json';
	let latest_processed_data = CeL.read_file(latest_processed_file_path);
	latest_processed_data = latest_processed_data ? JSON.parse(latest_processed_data.toString()) : Object.create(null);
	if (!(latest_processed_data.id >= 1)) latest_processed_data.id = 1;

	while (true) {
		CeL.log_temporary(process.title = `PubMed ID ${latest_processed_data.id}`);
		try {
			const result = await for_each_PubMed_ID(latest_processed_data.id++);
			CeL.write_file(latest_processed_file_path, JSON.stringify(latest_processed_data));
		} catch (e) {
			// Still import next article.
			console.error(e);
		}
	}
}

// ----------------------------------------------------------------------------

async function fill_language_code_mapping() {

	async function set_language_code_item_list(property_id) {
		const language_code_item_list = await wiki.SPARQL(`
SELECT ?item ?itemLabel ?value
WHERE 
{
	?item wdt:${property_id} ?value.
	SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
`);
		language_code_item_list.forEach(language_data => {
			const language_code = CeL.wiki.data.value_of(language_data.value);
			if (!language_code_mapping.has(language_code)) {
				const entity_id = CeL.wiki.data.value_of(language_data.item).match(/\/(Q\d+)$/)[1];
				language_code_mapping.set(language_code, entity_id);
			}
		});
	}

	// ISO 639-3 code
	await set_language_code_item_list('P220');

	// ISO 639-2 code
	await set_language_code_item_list('P219');

	// ISO 639-1 code
	await set_language_code_item_list('P218');

	CeL.write_file(language_code_mapping__file_path, JSON.stringify(Array.from(language_code_mapping)));

}


function normalize_main_subject(main_subject) {
	return main_subject.toString().replace(/[,;:.]/g, '').trim().toLowerCase();
}

/** 預先登記會混淆的主題。 */
async function fill_main_subject_mapping() {

	async function set_main_subject_item_list(entity_id) {
		const main_subject_item_list = await wiki.SPARQL(`
SELECT ?item ?itemLabel
WHERE 
{
	?item wdt:P31 wd:${entity_id}.
	SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
`);
		//console.trace(entity_id, main_subject_item_list);
		main_subject_item_list.forEach(main_subject_data => {
			const main_subject = normalize_main_subject(CeL.wiki.data.value_of(main_subject_data.itemLabel));
			if (main_subject_mapping.has(main_subject)) {
				return;
			}

			// e.g., [[L1401142]]
			let entity_id = CeL.wiki.data.value_of(main_subject_data.item).match(/\/(Q\d+)$/);
			if (!entity_id) {
				CeL.warn(`${fill_main_subject_mapping.name}: Not an entity: ${CeL.wiki.title_link_of(CeL.wiki.data.value_of(main_subject_data.itemLabel))} ${main_subject_data.item}`);
				return;
			}

			entity_id = entity_id[1];
			main_subject_mapping.set(main_subject, entity_id);
		});
	}

	for (const entity_id of wiki.latest_task_configuration.general.main_subject_types) {
		await set_main_subject_item_list(entity_id);
	}

	CeL.write_file(main_subject_mapping__file_path, JSON.stringify(Array.from(main_subject_mapping)));
}


function normalize_source_name(source_name) {
	return source_name.toString().replace(/[,;:.]/g, '').trim().toLowerCase();
}

async function fill_published_source_mapping(id) {
	if (!id) {
		// read cache
		for (id of ['Q5633421', 'Q737498']) {
			await fill_published_source_mapping(id);
		}
		CeL.write_file(published_source_mapping__file_path, JSON.stringify(Array.from(published_source_mapping)));
		CeL.info(`${fill_published_source_mapping.name}: Get ${published_source_mapping.size} sources.`);
		return;
	}

	CeL.log_temporary(`Get ${id}`);
	const initial_size = published_source_mapping.size;
	const source_item_list = await wiki.SPARQL(`
SELECT ?item ?itemLabel
WHERE 
{
	?item wdt:P31 wd:${id}.
	SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
#LIMIT 10
`);

	for (const source_data of source_item_list) {
		const entity_id = CeL.wiki.data.value_of(source_data.item).match(/\/(Q\d+)$/)[1];
		let source_name = CeL.wiki.data.value_of(source_data.itemLabel);
		let source_key = normalize_source_name(source_name);
		//console.log([source_name, source_key, entity_id]);
		if (!published_source_mapping.has(source_key))
			published_source_mapping.set(source_key, entity_id);

		// "Acta Crystallographica Section B: Structural Science, Crystal Engineering and Materials"
		// should NOT match 'Acta crystallographica. Section B, Structural science'
	}

	CeL.debug(`${published_source_mapping.size - initial_size}/${source_item_list.length} sources filled.`, 1, 'fill_published_source_mapping');
}

const MAX_slice_length = 2000;
/**
 * Get DOI to item id mapping
 * @param {Array} DOI_list 
 * @returns {Map} DOI_to_item_id_mapping.get(DOI) = [ item id, itemLabel ]
 */
async function search_DOIs(DOI_list) {
	const DOI_to_item_id_mapping = new Map();

	for (let index = 0; index < DOI_list.length;) {
		let this_slice = '';
		while (index < DOI_list.length && this_slice.length < MAX_slice_length) {
			// https://www.wikidata.org/wiki/Property_talk:P356
			// Uppercase recommended.
			const DOI = DOI_list[index++].toUpperCase();
			this_slice += JSON.stringify(DOI) + ' ' + JSON.stringify(DOI.toLowerCase()) + ' ';
		}
		const item_list = await wiki.SPARQL(`
SELECT ?doi ?item ?itemLabel WHERE {
	VALUES ?doi { ${this_slice} }
	?item wdt:P356 ?doi.
	SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`);
		item_list.forEach(item_data =>
			DOI_to_item_id_mapping.set(
				CeL.wiki.data.value_of(item_data.doi).toUpperCase(),
				// [ item id, itemLabel ]
				[CeL.wiki.data.value_of(item_data.item).match(/\/(Q\d+)$/)[1], CeL.wiki.data.value_of(item_data.itemLabel)]
			)
		);
	}


	// https://www.mediawiki.org/wiki/Help:Extension:WikibaseCirrusSearch
	if (false) {
		const DOI_entity_list = await wiki.search('haswbstatement:' + JSON.stringify(DOI_list.map(DOI => 'P356=' + DOI).join('|')), { namespace: 0 });
		DOI_entity_list.forEach(item_data =>
			DOI_to_item_id_mapping.set(
				// TODO
			)
		);

		for (let DOI of DOI_list) {
			DOI = DOI.toUpperCase();
			const DOI_entity_list = await wiki.search('haswbstatement:' + JSON.stringify('P356=' + DOI), { namespace: 0 });
			DOI_entity_list.forEach(item_data => {
				if (!DOI_to_item_id_mapping.has(DOI))
					DOI_to_item_id_mapping.set(
						DOI,
						// [ item id, itemLabel ]
						[item_data.title]
					)
			});
		}
	}


	//console.trace(DOI_to_item_id_mapping);
	return DOI_to_item_id_mapping;
}

// ----------------------------------------------------------------------------

/**
 * get PubMed Central ID list
 * @param {String} start_date start date to get
 * @param {String} end_date end date to get 
 * @returns {Array} PubMed IDs
 */
async function get_PubMed_ID_list(start_date, end_date) {
	// https://www.ncbi.nlm.nih.gov/home/develop/api/
	// https://www.ncbi.nlm.nih.gov/books/NBK25499/#chapter4.ESearch
	const NCBI_API_URL = new CeL.URI('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi');
	NCBI_API_URL.search_params.set_parameters({
		db: "pubmed",
		retmode: "json",
		// retstart: 1,
		retmax: 100000,
		//sort: 'pub+date',
		mindate: start_date.format('%Y/%2m/%2d'),
		maxdate: (end_date || start_date).format('%Y/%2m/%2d'),
	});

	//console.trace(NCBI_API_URL.toString());
	const esearchresult = (await (await CeL.fetch(NCBI_API_URL.toString())).json()).esearchresult;
	const PubMed_ID_list = esearchresult.idlist
		// 轉成從舊到新。
		.reverse();
	//console.trace(PubMed_ID_list);
	return PubMed_ID_list;
}

// ----------------------------------------------------------------------------

const summary_source_posifix = ` [[${problematic_data_page_title}|from NCBI, Europe PMC and CrossRef]]`
	&& ` from NCBI, Europe PMC and CrossRef`;

async function fetch_PubMed_ID_data_from_service(PubMed_ID) {
	// https://www.ncbi.nlm.nih.gov/books/NBK25499/#chapter4.ESummary
	// e.g., https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=33932783,33932782
	const NCBI_API_URL = new CeL.URI('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi');
	NCBI_API_URL.search_params.set_parameters({
		db: "pubmed",
		retmode: "json",
		id: PubMed_ID,
	});

	// https://europepmc.org/RestfulWebService
	// https://europepmc.org/docs/EBI_Europe_PMC_Web_Service_Reference.pdf
	// https://www.ebi.ac.uk/europepmc/webservices/rest/search?resulttype=core&format=json&query=EXT_ID:33932783%20AND%20SRC:MED
	const Europe_PMC_API_URL = new CeL.URI('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
	Europe_PMC_API_URL.search_params.set_parameters({
		resulttype: "core",
		format: "json",
		query: "SRC:MED AND EXT_ID:" + PubMed_ID
	});

	// ----------------------------------------------------

	const results = Object.create(null);
	await Promise.allSettled([
		//(await (await CeL.fetch(NCBI_API_URL.toString())).json()).result[PubMed_ID]
		CeL.fetch(NCBI_API_URL.toString()).then(result => result.json()).then(result => results.NCBI_article_data = result.result[PubMed_ID], error => { CeL.error('fetch_PubMed_ID_data_from_service: ' + NCBI_API_URL.toString()); console.error(error); }),
		CeL.fetch(Europe_PMC_API_URL.toString()).then(result => result.json()).then(result => results.Europe_PMC_article_data = result.resultList.result[0], error => { CeL.error('fetch_PubMed_ID_data_from_service: ' + Europe_PMC_API_URL.toString()); console.error(error); }),
	]);

	// ----------------------------------------------------

	if (results.NCBI_article_data) {
		results.NCBI_article_data.wikidata_references = {
			// stated in (P248) 載於 NCBI: National Center for Biotechnology Information (Q82494); or PubMed Central (Q229883)?
			P248: 'Q82494',
			[NCBI_articleid_properties_mapping.pubmed]: PubMed_ID,
			// 來源網址
			P854: NCBI_API_URL.toString(),
			// 檢索日期
			P813: new Date,
		};
	}

	if (results.Europe_PMC_article_data) {
		results.Europe_PMC_article_data.wikidata_references = {
			// stated in (P248) 載於 Europe PMC, Europe PubMed Central (Q5412157)
			P248: 'Europe PubMed Central',
			[NCBI_articleid_properties_mapping.pubmed]: PubMed_ID,
			// 來源網址
			P854: Europe_PMC_API_URL.toString(),
			// 檢索日期
			P813: new Date,
		};
	}

	//console.trace(results);
	return results;
}

async function fetch_DOI_data_from_service(DOI) {
	// https://www.wikidata.org/wiki/Property_talk:P356
	// Uppercase recommended.
	DOI = DOI.toUpperCase();

	// https://api.crossref.org/swagger-ui/index.html
	// https://api.crossref.org/works/10.1107/S0108768100019121
	const CrossRef_API_URL = new CeL.URI('https://api.crossref.org/works/' + DOI);
	if (false) {
		CrossRef_API_URL.search_params.set_parameters({
			mailto: 'https://www.wikidata.org/wiki/User:' + login_options.owner_name
		});
	}

	// ----------------------------------------------------

	const results = Object.create(null);
	await Promise.allSettled([
		CeL.fetch(CrossRef_API_URL.toString(), {
			// https://api.crossref.org/swagger-ui/index.html
			headers: { 'User-Agent': 'CeL; mailto:https://www.wikidata.org/wiki/User_talk:Kanashimi' },
		})
			.then(result => result.json())
			.then(result => results.CrossRef_article_data = result.message, error => {
				CeL.error('fetch_DOI_data_from_service: ' + CrossRef_API_URL); console.error(error);
			}),
	]);

	// ----------------------------------------------------

	if (results.CrossRef_article_data) {
		results.CrossRef_article_data.wikidata_references = {
			// stated in (P248) 載於: source website for the property (P1896)
			P248: 'Q5188229',
			[NCBI_articleid_properties_mapping.doi]: DOI,
			// reference URL (P854) 來源網址: formatter URL (P1630)
			P854: CrossRef_API_URL.toString(),
			// retrieved date (P813) 檢索日期
			P813: new Date,
		};
	}

	//console.trace(results);
	return results;
}

async function get_entity_id_of_ORCID({ ORCID, author_name, wanted_keys, PubMed_ID }) {
	if (!ORCID) return;

	// https://query.wikidata.org/#%23%20items%20with%20property%20P496%20and%20most%20identifiers%0A%23%20added%20by%20User%3AJura1%2C%202017-07-30%0ASELECT%20%3Fitem%20%3FitemLabel%20%3Fvalue%20%3Fids%0A%7B%0A%20%20%3Fitem%20wdt%3AP496%20%220000-0002-7122-2650%22.%0A%20%20SERVICE%20wikibase%3Alabel%20%7B%20bd%3AserviceParam%20wikibase%3Alanguage%20%22%5BAUTO_LANGUAGE%5D%2Cen%22.%20%7D%0A%7D%0AORDER%20BY%20DESC%28%3Fids%29%20%3Fitem
	CeL.log_temporary(`${get_entity_id_of_ORCID.name}: Get entity_id of ORCID=${ORCID}${author_name ? ` (${author_name})` : ''}`);
	const author_item_list = await wiki.SPARQL(`
SELECT ?item ?itemLabel
{
	?item wdt:P496 "${ORCID}".
	SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
}
`);
	if (author_item_list.length > 0) {
		if (author_item_list.length > 1) {
			CeL.warn(`${get_entity_id_of_ORCID.name}: ${author_item_list.length} authors get with author_name=${author_name} ORCID=${ORCID}: ${author_item_list.id_list().join(', ')}`);
		}

		const itemLabel = CeL.wiki.data.value_of(author_item_list[0].itemLabel);
		const get_keys = itemLabel.toLowerCase().split(/\s+/);
		const entity_id = author_item_list.id_list()[0];
		if (wanted_keys.some(key => get_keys.includes(key))) {
			return entity_id;
		}

		CeL.error(`${get_entity_id_of_ORCID.name}: The best matched author get from wikidata ${JSON.stringify(itemLabel)}, ORCID=${ORCID} do not match wanted data: author_name=${JSON.stringify(author_name)}, wanted_keys=${JSON.stringify(wanted_keys)}`);
		// 有問題的 ORCID
		if (false) {
			// [[User:Cewbot/log/20210701/problematic ORCIDs]]成為 Wikidata 中編輯次數第三多的頁面。
			await wiki.edit_page(log_to + '/problematic ORCIDs', `
; PubMed_ID
: ${PubMed_ID}
; entity_id
: {{Q|${entity_id}}}
; itemLabel
: ${itemLabel}
; wanted author
: ${author_name}
; wanted keys
: ${JSON.stringify(wanted_keys)}
`, {
				bot: 1, nocreate: 1, summary: `Error report for ORCID ${ORCID}`,
				section: 'new', sectiontitle: `ORCID ${ORCID}`,
			});
		}
	}

	return await for_unregistered_ORCID(ORCID, author_name);
}

async function get_entity_id_of_ISSN(ISSN) {
	if (!ISSN) return;

	CeL.log_temporary(`${get_entity_id_of_ISSN.name}: Get entity_id of ISSN=${ISSN}`);
	const item_list = await wiki.SPARQL(`
SELECT ?item ?itemLabel
{
	?item wdt:P236 "${ISSN}".
	SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
}
`);
	if (item_list.length === 0) {
		// TODO: create item
	}
	const entity_id = item_list.id_list()[0];
	return entity_id;
}

// ----------------------------------------------------------------------------

// For Europe_PMC_article_data.title & NCBI_article_data.title
//https://www.wikidata.org/wiki/Wikidata:Requests_for_permissions/Bot/LargeDatasetBot
// 撇開 mathml 之類的問題不談，它似乎經常在文章標題的末尾添加句號
// 標題的翻譯，用方括號括起來。
// https://www.ebi.ac.uk/europepmc/webservices/rest/search?resulttype=core&format=json&query=EXT_ID:33932783%20AND%20SRC:MED
function normalize_article_title(title) {
	if (!title || title.includes('\ufffd')) {
		// 不匯入含有 U+FFFD � REPLACEMENT CHARACTER 的 title。
		// e.g., Q67435361
		return [];
	}

	// e.g., https://www.wikidata.org/w/index.php?diff=2372466697
	title = CeL.HTML_to_Unicode(title)
		// remove <i>...</i>. https://www.wikidata.org/wiki/Q97521125
		.replace(/<[\/\w][^<>]*>/g, '').trim()
		// https://api.crossref.org/works/10.1148/rycan.2019190022
		// Do not need too many spaces.
		.replace(/\s+/g, ' ').trim()
		// https://www.ebi.ac.uk/europepmc/webservices/rest/search?resulttype=core&format=json&query=SRC%3AMED%20AND%20EXT_ID%3A33915672
		// [title].
		.replace(/\s*\.$/, '')
		// https://www.ebi.ac.uk/europepmc/webservices/rest/search?resulttype=core&format=json&query=SRC%3AMED%20AND%20EXT_ID%3A10615162
		.replace(/\s*\[In Process Citation\]/i, '');
	const title_converted = /^\[([^\[\]]+)\]/.test(title);
	if (title_converted) {
		title = title
			.replace(/\[([^\[\]]+)\]/g, '$1')
			// https://www.wikidata.org/w/index.php?title=Q42169511&oldid=1565788442
			.replace(/\s*\.$/, '');
	}
	return [title, title_converted];
}

/**
 * 為不精確的日期
 * @param {String} date_string 日期
 * @returns {Boolean} 為不精確的日期
 */
function is_imprecise_date(date_string) {
	return /^\d{4} [a-z]{3,}$/i.test(date_string)
		|| /^[a-z]{3,},? \d{4}$/i.test(date_string);
}


// https://www.w3.org/International/questions/qa-personal-names
function normalize_person_name(name) {
	name = name.trim().replace(/\s+/g, ' ');
	let matched = name.match(/^([\w ]+),\s+([\w ]+)$/);
	if (matched) {
		name = matched[2] + ' ' + matched[1];
	} else {
		// e.g., "Chylack LT Jr", "Hartman HA Jr"
		name = name.replace(/( [A-Z]+) (?:Jr|2nd|3rd|[4-9]th)$/, '$1');
	}
	// https://en.wikipedia.org/wiki/Latin-1_Supplement
	// https://en.wikipedia.org/wiki/Latin_Extended-A
	// [[德語字母]], [[:de:Deutsches Alphabet]]
	matched = name.match(/^((?:(?:(?:Mc|Mac|L'|D'|O'|La|la |d'|da |de |del |dos |Den|Des|Da|De|[Dd]e la |Di|Du|Ja|v |vd |von |[Vv]an (?:den |der )?|el-|ter )?[A-Z]([a-z'\u00df-\u00f6\u00f8-\u00ff\u0101-\u017f]+|[A-Z]{3,})(?:-[A-Z]([a-z'\u00df-\u00f6\u00f8-\u00ff\u0101-\u017f]+))?|der)\s+)+)([A-Z]+)$/);
	//console.log(matched);
	if (matched && matched[2] === matched[2].toLowerCase() && (!matched[3] || matched[3] === matched[3].toLowerCase())) {
		// "Huennekens FM" → "F M Huennekens"
		name = matched[4].split('').join(' ') + ' ' + matched[1].trimEnd();
	} else if (matched && matched[2] === matched[2].toUpperCase() && (!matched[3] || matched[3] === matched[3].toUpperCase())) {
		// "MAPSON LW" → "L W MAPSON"
		name = matched[4].split('').join(' ') + ' ' + matched[1].trimEnd();
	}
	name = name.replace(/\./g, '')
		// 保留姓氏全稱，其他改縮寫。
		.replace(/([A-Z])[a-z'\u00df-\u00f6\u00f8-\u00ff\u0101-\u017f]+\s/g, '$1 ');
	return name;
}

[
	["S. W. Hawking", "S W Hawking"],
	["Adam Smith", "A. Smith"],
	["Stephen William Hawking", "Stephen W. Hawking", "S. W. Hawking"],
	["Huennekens FM", "F M Huennekens"],
	["Zöller H", "H. Zöller"],
	["Van Zeeland AA", "A. A. Van Zeeland"],
	["Van der Eb AJ", "A. J. Van der Eb"],
	["van Bogaert LJ", "L. J. van Bogaert"],
	["Schülke B", "B. Schülke"],
	["Cissée H", "H. Cissée"],
	["Drazd'áková M", "M. Drazd'áková"],
	["Crouzat-Reynes G", "G. Crouzat-Reynes"],
	["Büttner-Ennever JA", "J. A. Büttner-Ennever"],
	["McKaigney E", "E. McKaigney"],
	["L'Hermite M", "M. L'Hermite"],
	["DenBesten L", "L. DenBesten"],
	["dos Santos RR", "R. R. dos Santos"],
	["Timoşca SF", "S. F. Timoşca"],
	["DiBona DR", "D. R. DiBona"],
	["Mazanek-Szymańska E", "E. Mazanek-Szymańska"],
	["Serafińska D", "D. Serafińska"],
	["Sokołowska K", "K. Sokołowska"],
	["Cantù P", "P. Cantù"],
	["Grimm-Jørgensen Y", "Y. Grimm-Jørgensen"],
	["Chylack LT Jr", "L. T. Chylack"],
	["Hartman HA Jr", "H. A. Hartman"],
	["Pusateri RJ 3rd", "R. J. Pusateri"],
	["Woods RD 2nd", "R. D. Woods"],
	["de Mello RT", "R. T. de Mello"],
	["LaBelle JW", "J. W. LaBelle"],
	["da Silva LA", "L. A. da Silva"],
	["MacDonald DM", "D. M. MacDonald"],
	["D'Incalci M", "M. D'Incalci"],
	["DuCharme LL", "L. L. DuCharme"],
	["d'Azambuja S", "S. d'Azambuja"],
	["del Castillo J", "J. del Castillo"],
	["DeSanctis RW", "R. W. DeSanctis"],
	["JaRo MF", "M. F. JaRo"],
	["van den Broek PJ", "P. J. van den Broek"],
	["van der Meer JW", "J. W. van der Meer"],
	["el-Azab EA", "E. A. el-Azab"],
	["O'Fallon JR", "J. R. O'Fallon"],
	["von Strandtmann M", "M. von Strandtmann"],
	["De la Cruz A", "A. De la Cruz"],
	["DaMassa AJ", "A. J. DaMassa"],
	["Van den Eijnden DH", "D. H. Van den Eijnden"],
	["vd Heiden C", "C. vd Heiden"],
	["v Sprang FJ", "F. J. v Sprang"],
	["de la Vega PF", "P. F. de la Vega"],
	["DesRosiers C", "C. DesRosiers"],
	["ter Laak HJ", "H. J. ter Laak"],
	["la Labarthe B", "B. la Labarthe"],
	// Q82053131
	["MAPSON LW", "L. W. MAPSON"],
	/*
	TODO:
	["Stephen William Hawking", "Hawking, Stephen"],
	["Rautenshteĭn IaI", "Ia I. Rautenshteĭn"],
	["Savranskaia SIa", "S. Ia Savranskaia"],
	["Filippov IuV", "Iu V. Filippov"],
	["Riznichenko GIu", "G. Iu Riznichenko"],
	["Ganbarov KhG", "Kh G. Ganbarov"],
	["Khimerik TIu", "T. Iu Khimerik"],
	["Sloventantor VIu", "V. Iu Sloventantor"],
	["Khmelevskiĭ IaM", "Ia M. Khmelevskiĭ"],
	["Il'inskiĭ IuA", "Iu A. Il'inskiĭ"],
	["Chicherin IuV", "Iu V. Chicherin"],
	["Kozlova IuI", "Iu I. Kozlova"],
	["Korogodina IuV", "Iu V. Korogodina"],
	["Malashenko IuR", "Iu R. Malashenko"],
	["Chicherin IuV", "Iu V. Chicherin"],
	["Bol'shakova NIa", "N. Ia Bol'shakova"],
	["Sidorovskiĭ IuI", "Iu I. Sidorovskiĭ"],
	["Khaliullina KhV", "Kh V. Khaliullina"],
	["Beburov MIu", "M. Iu Beburov"],
	["Sharets IuD", "Iu D. Sharets"],
	["Melikova MIu", "M. Iu Melikova"],
	["Grosser PIu", "P. Iu Grosser"],
	["Popov Ch", "Ch. Popov"],
	["Mangoni di S Stefano C", "C. Mangoni di S Stefano"],
	["Semenov KhKh", "Kh Kh Semenov"],
	["Smirnov IuV", "Iu V. Smirnov"],
	["Zadvornov IuN", "Iu N. Zadvornov"],
	["Velichko AIa", "A. Ia Velichko"],
	*/
].forEach(pair => CeL.assert([normalize_person_name(pair[0]), normalize_person_name(pair[1])], `${normalize_person_name.name}: ${pair} (${[normalize_person_name(pair[0]), normalize_person_name(pair[1])]})`));

/**
 * 測試兩姓名是否等價。
 * 
 * 警告: 等價不代表相同一個人。
 * 
 * @param {String} name_1 姓名1
 * @param {String} name_2 姓名2
 * @returns {Boolean} 兩姓名等價
 */
function are_equivalent_person_names(name_1, name_2) {
	if (!name_1 || !name_2) return false;

	//console.trace([name_1, normalize_person_name(name_1), name_2, normalize_person_name(name_2)]);

	if (normalize_person_name(name_1) === normalize_person_name(name_2)) return true;
}

// ------------------------------------

/*
Method to add language:
# Get the `language_code` (using https://www.wikidata.org/wiki/Special:EntityData/Q5418627.json or get from Google Translate URL "&tl=language_code")
# check if `every_date.toLocaleDateString(`language_code`, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })` supports this language AS `toLocaleDateString_supports`
# Be sure the pattern of "scientific article" AND (toLocaleDateString_supports ? "scientific article published on every_date" : "scientific article published on every_year") translated to the language AS `type` AND `description_with_date`
	https://translate.google.com.tw/?hl=en&sl=auto&tl=el&text=scientific%20article%0A%0Ascientific%20article%20published%20on%201991%0A%0Ascientific%20article%20published%20on%20July%201%2C%201931%0A%0Ascientific%20article%20published%20on%20March%202%2C%202021%0A%0Ascientific%20article%20published%20on%20April%203%2C%201945%0A%0Ascientific%20article%20published%20on%20May%2023%2C%202001%0A&op=translate
# Be sure the `type` is the same with the description listed in https://www.wikidata.org/wiki/Q13442814 scholarly article (Q13442814)
# Check the most commonly used description pattern in wikidata using https://query.wikidata.org/#SELECT%20%3Fitem%20%3FitemLabel%20%3FitemDescription%0AWHERE%0A%7B%0A%20%20SERVICE%20bd%3Asample%20%7B%20%3Fitem%20wdt%3AP698%20%3Fvalue.%20bd%3AserviceParam%20bd%3Asample.limit%202000%20%7D%0A%20%20SERVICE%20wikibase%3Alabel%20%7B%20bd%3AserviceParam%20wikibase%3Alanguage%20%22es%22.%20%7D%0A%7D%0AORDER%20BY%20DESC%28%3FitemDescription%29
	Be sure it is the same with the translations (`type` AND `description_with_date`).
# Add the `type` AND `description_with_date` to `descriptions_configuration`.
*/
const descriptions_configuration = {
	en: [is_book => `scientific ${is_book ? 'book' : 'article'}`, (type, date) => `${type} published on ${date}`],
	fr: ['article scientifique', (type, date) => `${type} publié le ${date}`],
	it: ['articolo scientifico', (type, date) => `${type} pubblicato il ${date}`],
	es: ['artículo científico', (type, date) => `${type} publicado el ${date}`],
	pt: ['artigo científico', (type, date) => `${type} publicado em ${date}`],
	sq: ['artikull shkencor', (type, date) => `${type} i botuar më ${date}`],
	pl: ['artykuł naukowy', (type, date) => `${type} opublikowany ${date}`],
	// https://www.wikidata.org/wiki/Wikidata:Requests_for_permissions/Bot/XabatuBot
	ast: ['artículu científicu', (type, date) => `${type} espublizáu en ${date}`, 'year'],
	cs: ['vědecký článek', (type, date) => `${type} publikovaný ${date}`],
	sk: ['vedecký článok', (type, date) => `${type} publikovaný ${date}`],
	sv: ['vetenskaplig artikel', (type, date) => `${type} publicerad den ${date}`],
	da: ['videnskabelig artikel', (type, date) => `${type} offentliggjort den ${date}`],
	nl: ['wetenschappelijk artikel', (type, date) => `${type} gepubliceerd op ${date}`],
	lt: ['mokslinis straipsnis', (type, date) => `${type}, publikuotas ${date}`],
	sl: ['znanstveni članek', (type, date) => `${type} objavljen ${date}`],
	sr: ['научни чланак', (type, date) => `${type} објављен ${date}`],
	bg: ['научна статия', (type, date) => `${type}, публикувана на ${date}`],
	ru: ['научная статья', (type, date) => `${type} опубликованная ${date}`],
	// [[d:User talk:Kanashimi#On descriptions for scientific articles in Ukrainian]]
	uk: ['наукова стаття', (type, date) => `${type}, опублікована ${date.replace(/\s*р\.$/, '')}`],
	vi: ['bài báo khoa học', (type, date) => `${type} xuất bản ngày ${date}`],
	tr: ['bilimsel makale', (type, date) => `${date}'de yayımlanmış ${type}`],

	de: ['wissenschaftlicher Artikel', (type, date) => `im ${date} veröffentlichter ${type}`],

	'zh-hant': [is_book => '學術' + (is_book ? '書籍' : '文章'), (type, year) => `${year}年${type}`, 'year'],
	'zh-hans': [is_book => '学术' + (is_book ? '书籍' : '文章'), (type, year) => `${year}年${type}`, 'year'],
	// https://zh-min-nan.wikipedia.org/wiki/Ha%CC%8Dk-su%CC%8Dt_k%C3%AE-khan
	// https://zh-min-nan.wikipedia.org/wiki/L%C5%ABn-b%C3%BBn
	// https://zh-min-nan.wikipedia.org/wiki/Chheh
	nan: [is_book => is_book ? 'ha̍k-su̍t chu' : 'lūn-bûn', (type, year) => `${year} nî ê ${type}`, 'year'],
	ja: [is_book => is_book ? '学術書' : '学術論文', (type, year) => `${year}年の${type}`, 'year'],
	ko: ['논문', (type, year) => `${year}년 ${type}`, 'year'],

	'tg-cyrl': ['мақолаи илмӣ'],
	'tg-latn': ['maqolai ilmiy'],
	eo: ['scienca artikolo'],
	ca: ['article científic'],
	ro: ['articol științific'],
	id: ['artikel ilmiah'],
	bn: ['বৈজ্ঞানিক নিবন্ধ'],
	nb: ['vitenskapelig artikkel'],
	he: ['מאמר מדעי'],
	nn: ['vitskapeleg artikkel'],
	ar: ['مقالة علمية'],
	gl: ['artigo científico'],
};
// aliases / The same description pattern
for (const [alias, language_code] of Object.entries({
	// [[d:User talk:Kanashimi#Bot problems]]
	// en-gb is a slight variation of en. The en description is fine in en-gb (we never use the short mm/dd/yyyy form, but "d month year" and "month d, year" are used interchangeably), so you should only add en.
	// It would be helpful if you could also remove the redundant descriptions when they are the same (or equivalent, for things like en-gb).
	//'en-gb': 'en',

	//'pt-br': 'pt',

	// [[d:User talk:Kanashimi#Bot problems]]
	// sr and sr-ec are the same. Ideally we would use sr-cyrl but that isn't available yet, so I suggest only adding sr.
	//'sr-ec': 'sr',

	'zh': 'zh-hant',
	/*
	'zh-tw': 'zh-hant',
	'zh-hk': 'zh-hant',
	'zh-mo': 'zh-hant',
	*/
	yue: 'zh-hant',
	/*
	'zh-cn': 'zh-hans',
	'zh-sg': 'zh-hans',
	'zh-my': 'zh-hans',
	*/
	wuu: 'zh-hans',
})) {
	descriptions_configuration[alias] = descriptions_configuration[language_code];
}

const descriptions_date_options = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };

// +descriptions https://www.wikidata.org/wiki/User:Mr.Ibrahembot
function adapt_time_to_descriptions(data_to_modify, publication_date) {
	const year = publication_date?.getUTCFullYear();

	if (!data_to_modify.descriptions)
		data_to_modify.descriptions = Object.create(null);

	for (const [language_code, configuration] of Object.entries(descriptions_configuration)) {
		let [ /* description without publication_date */ type, time_adaptor, toLocaleDateString_options] = configuration;

		if (typeof type === 'function')
			type = type(data_to_modify.is_book);

		if (!publication_date || !time_adaptor) {
			if (type) {
				data_to_modify.descriptions[language_code] = type;
			}
			continue;
		}

		if (time_adaptor.length > 1 && !toLocaleDateString_options) {
			toLocaleDateString_options = true;
		}

		data_to_modify.descriptions[language_code]
			= time_adaptor(
				type || data_to_modify.descriptions[language_code],
				// 'year': e.g., .toLocaleDateString() 無法顯示正確日期
				toLocaleDateString_options === 'year' ? year
					: toLocaleDateString_options && publication_date.toLocaleDateString(language_code, toLocaleDateString_options === true ? descriptions_date_options : toLocaleDateString)
			);
	}
}

// ----------------------------------------------------------------------------

/**
 * 根據文章 ID（如 PubMed ID、DOI、PMC ID 等）來獲取對應的 Wikidata 項目 ID，並檢查是否存在重複項目。
 *
 * 這個函數會根據提供的文章 ID 類型來構建 SPARQL 查詢，並使用 Wikidata 的 SPARQL 端點來執行查詢。
 *
 * @param {Number} PubMed_ID - 文章的 PubMed ID。
 * @param {Object} NCBI_article_data - 包含 NCBI 文章數據的對象，應該包含 articleids 屬性，其中包含不同類型的文章 ID。
 * @param {Object} Europe_PMC_article_data - 包含 Europe PMC 文章數據的對象，應該包含 title 屬性和其他相關信息。
 * @param {Object} data_to_modify - 包含要修改的數據的{Object}。包含 claims 屬性，用於存儲要添加到 Wikidata 項目的聲明。
 * @returns {Promise<Array>} 返回一個包含找到的 Wikidata 項目 ID 的數組。
 */
async function get_article_entities_by_ids({ PubMed_ID, NCBI_article_data, Europe_PMC_article_data, data_to_modify }) {

	const id_filter = [];
	id_filter.toString = function () { return this.join(''); };

	// https://www.chinaw3c.org/REC-sparql11-overview-20130321-cn.html
	// http://www.ruanyifeng.com/blog/2020/02/sparql.html
	// https://longaspire.github.io/blog/%E5%9B%BE%E8%B0%B1%E5%AE%9E%E8%B7%B5%E7%AC%94%E8%AE%B02_1/
	const SPARQL_check_duplicates = [`
SELECT DISTINCT ?item ?itemLabel ${articleid_properties_id_list}
WHERE {`,
		id_filter, `
	{
		?item wdt:P31 wd:Q13442814;
			?label ${JSON.stringify(data_to_modify.labels.en)}@en.
	}
	SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
	${articleid_properties_id_assignment}
}
ORDER BY DESC (?item)
`];

	// ids of NCBI are relatively complete
	NCBI_article_data.articleids.forEach(articleid => {
		const idtype = articleid.idtype;
		//console.trace([articleid, idtype]);
		if (!(idtype in NCBI_articleid_properties_mapping)) {
			//console.trace(NCBI_article_data);
			throw new Error(`${PubMed_ID}: Unknown idtype: ${JSON.stringify(idtype)}. Please add it to NCBI_articleid_properties_mapping!`);
		}
		let property_id = NCBI_articleid_properties_mapping[idtype];
		if (!property_id) {
			// Do not use this id. e.g., rid, eid
			return;
		}

		let id = articleid.value;
		if (!id) {
			// 未提供本種類 ID
			// https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pmc&retmode=json&id=1201098
			return;
		}

		switch (idtype) {
			case 'doi':
				// https://www.wikidata.org/wiki/Property_talk:P356
				// Uppercase recommended.
				id = id.toUpperCase();
				// For case-insensitive search
				id_filter.push(`
				{ ?item wdt:${property_id} ${JSON.stringify(id)}. } UNION`, `
				{ ?item wdt:${property_id} ${JSON.stringify(id.toLowerCase())}. } UNION`);
				break;

			case 'pmc':
				id = id.replace(/^PMC/, '');
				if (CeL.is_digits(id)) {
					id_filter.push(`
					{ ?item wdt:${property_id} ${JSON.stringify(id)}. } UNION`);
				}
				break;

			case 'pubmed':
				if (CeL.is_digits(id)) {
					id_filter.push(`
						{ ?item wdt:${property_id} ${JSON.stringify(id)}. } UNION`);
				}
				break;
		}

		data_to_modify.claims.push({
			[property_id]: id,
			references: NCBI_article_data.wikidata_references
		});
	});

	const doi = (Europe_PMC_article_data.doi || NCBI_article_data.articleids.doi || '').toUpperCase();
	//console.trace(SPARQL_check_duplicates.join(''));
	const article_item_list = await wiki.SPARQL(SPARQL_check_duplicates.join(''), {
		filter(item) {
			if (item?.pubmed?.value && +item.pubmed.value === PubMed_ID)
				return true;
			// [[d:User talk:Kanashimi#Duplicate items created for articles]]
			// 有些文章具多個 PubMed ID。
			return !item?.doi?.value || item.doi.value.toUpperCase() === doi;
		}
	});

	return article_item_list;
}


// ----------------------------------------------------------------------------

async function load_problematic_data_list() {
	const page_data = await wiki.page(problematic_data_page_title);
	const array = CeL.wiki.table_to_array(page_data);
	//console.trace([problematic_data_page_title, array]);
	if (array.length > 1) {
		problematic_data_list = array;
		rebuild_problematic_data_mapping();
		CeL.info(`${load_problematic_data_list.name}: ${problematic_data_list.mapping.size}/${MAX_error_reported} problematic data loaded.`);
	} else {
		rebuild_problematic_data_mapping();
	}
	//console.trace(problematic_data_list);
}

function rebuild_problematic_data_mapping() {
	problematic_data_list.mapping = new Map;
	problematic_data_list.forEach((line, index) => {
		const PubMed_ID = +line[0];
		if (PubMed_ID > 0) {
			line[0] = PubMed_ID;
			problematic_data_list.mapping.set(PubMed_ID, index);
		}
	});
}

async function add_problematic_data(PubMed_ID, problematic_data) {
	if (problematic_data_list.length > MAX_error_reported) {
		return;
	}

	PubMed_ID = +PubMed_ID;
	const index = problematic_data_list.mapping.get(PubMed_ID);
	if (!(index > 0)) {
		problematic_data_list.mapping.set(PubMed_ID, problematic_data_list.length);
		problematic_data_list.push([PubMed_ID, problematic_data]);
	} else if (!problematic_data_list[index] || !problematic_data_list[index].toString().includes(problematic_data)) {
		problematic_data_list[index] = problematic_data_list[index] ? problematic_data_list[index] + '\n' + problematic_data : problematic_data;
	}

	await write_problematic_data_list();
}

async function write_problematic_data_list() {
	problematic_data_list.sort((line_1, line_2) => {
		let id_1 = +line_1[0]; if (!(id_1 > 0)) id_1 = line_1[0];
		let id_2 = +line_2[0]; if (!(id_2 > 0)) id_2 = line_2[0];
		return id_1 < id_2 ? -1 : id_1 > id_2 ? 1 : 0;
	});
	rebuild_problematic_data_mapping();

	//console.trace(problematic_data_list);
	//console.trace(CeL.wiki.array_to_table(problematic_data_list, { 'class': "wikitable" }));
	//console.trace(wiki.append_session_to_options());
	const wikitext = (new Date).format('%Y-%2m-%2d') + '\n\n' + CeL.wiki.array_to_table(problematic_data_list, { 'class': "wikitable" });
	await wiki.edit_page(problematic_data_page_title, wikitext, { bot: 1, nocreate: 1, summary: `Error report: ${problematic_data_list.length - 1} article(s)` });
}


// ----------------------------------------------------------------------------

/**
 * 清理不需要的屬性。用於釋放被占用的記憶體。
 * @param {Object} data_to_modify - 包含要修改的數據的{Object}。包含 claims 屬性，用於存儲要添加到 Wikidata 項目的聲明。
 */
function clean_data_to_modify(data_to_modify) {
	delete data_to_modify.is_non_English_title;
	delete data_to_modify.is_book;
	delete data_to_modify.publication_date_claim;
	delete data_to_modify.publication_date;
	delete data_to_modify.publication_in_claim_qualifiers;
	delete data_to_modify.title_list;
	delete data_to_modify.author_list;
	delete data_to_modify.main_subject;
	delete data_to_modify.available_at;
}


// ----------------------------------------------------------------------------

async function for_each_PubMed_ID(PubMed_ID) {
	console.assert(CeL.is_digits(String(PubMed_ID)));
	const { NCBI_article_data, Europe_PMC_article_data } = await fetch_PubMed_ID_data_from_service(PubMed_ID);
	//console.trace(NCBI_article_data, Europe_PMC_article_data);
	if (NCBI_article_data?.error) {
		// e.g., PubMed_ID=19790808
		CeL.error(`${for_each_PubMed_ID.name}: PubMed ID=${PubMed_ID}: NCBI error: ${NCBI_article_data.error}`);
		return;
	}
	if (!NCBI_article_data || !Europe_PMC_article_data) {
		CeL.error(`${for_each_PubMed_ID.name}: PubMed ID=${PubMed_ID}: Failed to get data!`);
		return;
	}
	console.assert(PubMed_ID.toString() === NCBI_article_data.uid && NCBI_article_data.uid === Europe_PMC_article_data.id && Europe_PMC_article_data.id === Europe_PMC_article_data.pmid);

	let CrossRef_article_data;
	if (Europe_PMC_article_data.doi || Array.isArray(NCBI_article_data.articleids)) {
		let DOI = Europe_PMC_article_data.doi;
		if (DOI || NCBI_article_data.articleids.some(
			articleid => articleid.idtype === 'doi' && (DOI = articleid.value)
		)) {
			NCBI_article_data.articleids.doi = DOI;
			CrossRef_article_data = (await fetch_DOI_data_from_service(DOI)).CrossRef_article_data;
			//console.trace(CrossRef_article_data);
		}
	}
	CrossRef_article_data = CrossRef_article_data || Object.create(null);

	// ----------------------------------------------------------------------------------------------------------------
	// Generate data to modify

	// @see
	// https://www.wikidata.org/wiki/Wikidata:Requests_for_permissions/Bot/LargeDatasetBot

	/**
	 * 包含要修改的數據的{Object}。
	 * @type {Object}
	 * @property {Object} labels - 包含要修改的項目的標籤。鍵是語言代碼，值是對應語言的標籤文本。
	 * @property {Array} claims - 包含要添加到 Wikidata 項目的聲明的數組。每個聲明是一個對象，包含屬性 P31（實例）和其他相關信息。
	 * @property {Set} title_list - 用於跟踪已添加的標題，以避免添加重複的標題。
	 * @property {Object} descriptions - 包含要修改的項目的描述。鍵是語言代碼，值是對應語言的描述文本。
	 * @property {Boolean} is_non_English_title - 指示是否存在非英語標題的布爾值。
	 * @property {Object} [其他屬性] - 包含其他與修改相關的屬性，例如出版日期、作者等。
	 */
	const data_to_modify = {
		labels: {
			en: normalize_article_title(NCBI_article_data.title || NCBI_article_data.booktitle)[0]
		},
		claims: [
			{
				// 'instance of': 'scholarly article',
				P31: 'Q13442814',
				//references: NCBI_article_data.wikidata_references
			},
		]
	};

	// --------------------------------------------------------------
	// title

	// CrossRef may have the original title.
	// But sometimes Europe_PMC has better title.
	// e.g., https://www.wikidata.org/w/index.php?diff=2303393245	https://www.wikidata.org/w/index.php?diff=2372466697
	let [main_title, title_converted] = normalize_article_title(CrossRef_article_data.title && CrossRef_article_data.title[0]);

	// also: Europe_PMC_article_data.language, CrossRef_article_data.language
	if (Array.isArray(NCBI_article_data.lang)) {
		// "eng", "spa"
		NCBI_article_data.lang.forEach(language_code => {
			const language_entity_id = language_code_mapping.get(language_code);
			if (language_entity_id) {
				data_to_modify.is_non_English_title = language_entity_id !== language_code_mapping.get('eng');
				data_to_modify.claims.push({
					// language of work or name (P407)
					P407: language_entity_id,
					references: NCBI_article_data.wikidata_references
				});
			} else {
				CeL.warn(`Unknown language code: ${language_code} (${main_title})`);
			}
		});
	}

	data_to_modify.title_list = new Set();

	function title_to_id(title) {
		return title.toUpperCase();
	}

	function add_title_claim(references, title, language) {
		if (!title)
			title = main_title;

		const claim = {
			// title 標題 (P1476)
			P1476: title,
			references
		};

		const title_id = title_to_id(title);
		if (data_to_modify.title_list.has(title_id)) {
			// 無須添加重複的標題。
			return;
		}

		data_to_modify.title_list.add(title_id);
		if (!data_to_modify.title_list.preferred_claim) {
			// 把第一個當最佳的。
			data_to_modify.title_list.preferred_claim = claim;
		}

		if (language)
			claim.language = language;

		if (/* title_converted || */ data_to_modify.is_non_English_title) {
			// https://www.wikidata.org/wiki/Property:P1476#P1476$f785f365-4c6d-6e2c-c3ab-8ab2d109f9df
			// set English title in square brackets to deprecated rank
			// https://www.wikidata.org/wiki/Wikidata:Project_chat#Should_cites_IMDb_(Q103598310),_cites_Wikidata_(Q103598309)_and_cites_Wikipedia_(Q103598308)_exist?
			claim.rank = 'deprecated';
			claim.qualifiers = {
				// reason for deprecated rank (P2241) = translation instead of the original (Q110678154)
				P2241: 'Q108180274'
			};
		}

		data_to_modify.claims.push(claim);
	}

	if (main_title
		// 不採用全大寫標題。全大寫標題改採用 Europe_PMC_article_data。 e.g., @ https://www.wikidata.org/wiki/Q5418627
		&& main_title !== main_title.toUpperCase()) {
		// No .language @ https://api.crossref.org/works/10.1107/s0108768100019121
		const language = CrossRef_article_data.language || use_language;
		data_to_modify.labels[language] = main_title;
		//const language_entity_id = language_code_mapping.get(language);
		add_title_claim(CrossRef_article_data.wikidata_references, null, language);
	} else {
		[main_title, title_converted] = normalize_article_title(Europe_PMC_article_data.title
			// Should not go to here!
			|| data_to_modify.labels.en);
		if (!main_title) {
			CeL.error(`${for_each_PubMed_ID.name}: No title for PubMed ID ${PubMed_ID}!`);
			return;
		}
		add_title_claim(Europe_PMC_article_data.wikidata_references);
	}

	// Add more variants, usually English translation in NCBI_article_data and Europe_PMC_article_data.
	if (main_title !== normalize_article_title(Europe_PMC_article_data.title)[0]) {
		const [Europe_PMC_title, title_converted] = normalize_article_title(Europe_PMC_article_data.title);
		if (!Array.isArray(CrossRef_article_data.title) || !CrossRef_article_data.title.some(title => normalize_article_title(title)[0] === Europe_PMC_title)) {
			// Europe_PMC_title: Usually English translation. https://www.ebi.ac.uk/europepmc/webservices/rest/search?resulttype=core&format=json&query=SRC%3AMED%20AND%20EXT_ID%3A33932783
			add_title_claim(Europe_PMC_article_data.wikidata_references, Europe_PMC_title);
		}
	}

	if (main_title !== normalize_article_title(NCBI_article_data.title || NCBI_article_data.booktitle)[0]) {
		// NCBI_article_data.vernaculartitle may contains original title. e.g., https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=33932783
		const [NCBI_title, title_converted] = normalize_article_title(NCBI_article_data.title || NCBI_article_data.booktitle);
		if (NCBI_title && NCBI_title !== normalize_article_title(Europe_PMC_article_data.title)[0]) {
			// Should not go to here.
			add_title_claim(NCBI_article_data.wikidata_references, NCBI_title);
		}
	}

	// --------------------------------------------------------------
	// author

	// data_to_modify.author_list[ordinal] = author_name
	data_to_modify.author_list = [,];
	data_to_modify.author_list.has_item = [];
	data_to_modify.author_list.no_item_count = 0;
	// Europe_PMC_article_data.authorIdList maybe error. e.g., https://www.ebi.ac.uk/europepmc/webservices/rest/search?resulttype=core&format=json&query=SRC%3AMED%20AND%20EXT_ID%3A20
	if (Array.isArray(Europe_PMC_article_data.authorList?.author)) {
		// authors of NCBI are relatively complete
		const author_list = data_to_modify.author_list;
		let index = 0;
		for (const author_data of Europe_PMC_article_data.authorList.author) {
			const author_name = author_data.firstName && author_data.lastName
				// "H Schenk" → "H. Schenk" https://www.wikidata.org/wiki/Q29029898
				// "Abeer H" → "Abeer H." https://www.wikidata.org/wiki/Q29029898
				// "K E" → "K. E." https://www.wikidata.org/wiki/Q27905658
				? author_data.firstName.trim().replace(/(?<![A-Z])([A-Z])(?= )/, '$1.').replace(/( [A-Z])$/, '$1.') + (author_data.firstName === author_data.initials ? '.' : '') + ' ' + author_data.lastName.trim()
				: author_data.fullName?.trim()
				// e.g., PubMed_ID 33914447
				|| author_data.collectiveName.trim();

			author_list.push(author_name);
			// The robot will now check for ORCID. If found, it will populate the ORCID and note the API representation. If not found, only the API representation will be entered.
			let author_item_id = author_data.authorId?.type === "ORCID"
				&& await get_entity_id_of_ORCID({
					ORCID: author_data.authorId.value,
					author_name: author_data.fullName,
					wanted_keys: (author_data.firstName.toLowerCase().split(/\s+/) || []).append(author_data.lastName?.toLowerCase().split(/\s+/)),
					PubMed_ID,
				});
			if (author_item_id) {
				data_to_modify.claims.push({
					// author (P50) 作者
					P50: author_item_id,
					qualifiers: {
						// series ordinal (P1545) 系列序號
						P1545: ++index,
						// stated as (P1932)
						P1932: author_name,
					},
					references: Europe_PMC_article_data.wikidata_references
				});
				author_list.has_item[index] = true;
				continue;
			}

			if (author_name) {
				const qualifiers = {
					// series ordinal (P1545) 系列序號
					P1545: ++index
				};
				if (author_data.authorId?.type === "ORCID") {
					qualifiers.P496 = author_data.authorId.value;
				}
				data_to_modify.claims.push({
					// author name string (P2093) 作者姓名字符串
					P2093: author_name,
					qualifiers,
					references: Europe_PMC_article_data.wikidata_references
				});
				author_list.no_item_count++;
			} else {
				CeL.error('Cannot parse author_data! Skip this article!');
				console.error(author_data);
				return;
			}
		}

	} else if (Array.isArray(NCBI_article_data.authors)) {
		// Should not use these.
		NCBI_article_data.authors.forEach((author_data, index) => {
			// https://www.wikidata.org/wiki/Wikidata:Requests_for_permissions/Bot/LargeDatasetBot
			// PubMed 還刪除了作者姓名首字母后面的句點字符並顛倒過來，以便姓氏在前，因此在 PubMed（和導入的）中，名稱類似於“Peschar R”而不是原始出版物的“R. Peschar” . 
			const author_name = author_data.name.replace(/^(.+) ([A-Z])$/, '$2. $1');

			// 這邊的資料不好，不採用。
			//data_to_modify.author_list.push(author_name);

			data_to_modify.claims.push({
				// author name string (P2093) 作者姓名字符串
				P2093: author_name,
				qualifiers: {
					// series ordinal (P1545) 系列序號
					P1545: index + 1
				},
				references: NCBI_article_data.wikidata_references
			});
		});
	}

	// --------------------------------------------------------------
	// 設定 data_to_modify.publication_date_claim, data_to_modify.publication_date

	data_to_modify.publication_date_claim = Object.create(null);
	if (Europe_PMC_article_data.firstPublicationDate) {
		// UTC+0: 確保日期不跑掉
		const publication_date = (Europe_PMC_article_data.firstPublicationDate + ' UTC+0').to_Date();
		if (!isNaN(publication_date?.getTime())
			// 假如只能取得當月1號的日期，則直接採用 NCBI_article_data.pubdate 就好
			&& (publication_date.getUTCDate() > 1 || !NCBI_article_data.pubdate)) {
			data_to_modify.publication_date = publication_date;
			//console.trace([publication_date.getUTCDate(), NCBI_article_data.pubdate, Europe_PMC_article_data.firstPublicationDate, publication_date, publication_date.precision]);
			Object.assign(data_to_modify.publication_date_claim, {
				// publication date (P577) 出版日期
				P577: publication_date,
				references: Europe_PMC_article_data.wikidata_references
			});
		}
	}
	// TODO: NCBI_article_data.sortpubdate
	if (!data_to_modify.publication_date && (NCBI_article_data.pubdate || NCBI_article_data.epubdate)) {
		// UTC+0: 確保日期不跑掉
		const publication_date = (((!NCBI_article_data.pubdate
			// 避免不精確的日期 "2021 May" 被認作當月1號 https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=33910271
			// "1975 Jun" https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=1
			|| is_imprecise_date(NCBI_article_data.pubdate)) && NCBI_article_data.epubdate || NCBI_article_data.pubdate) + ' UTC+0').to_Date();
		if (!isNaN(publication_date?.getTime())) {
			data_to_modify.publication_date = publication_date;
			Object.assign(data_to_modify.publication_date_claim, {
				// publication date (P577) 出版日期
				P577: publication_date,
				references: NCBI_article_data.wikidata_references
			});
		}
	}
	if (!data_to_modify.publication_date_claim.P577 && Array.isArray(NCBI_article_data.history) && NCBI_article_data.history.length > 0) {
		// e.g., NCBI_article_data.pubdate==="2021 May"
		const PMC_publication_date = NCBI_article_data.history.filter(record => {
			if (record.date && (record.pubstatus in NCBI_pubstatus_to_entity_id_mapping)) {
				const time_value = Date.parse(record.date + ' UTC+0');
				if (!isNaN(time_value)) {
					record.time_value = time_value;
					return true;
				}
			}
		}).sort((record_1, record_2) => {
			// 取最早的日期。
			return record_1.time_value - record_2.time_value;
		});
		if (PMC_publication_date.length > 0) {
			// assert: dates are early to late
			const record = PMC_publication_date[0];
			// UTC+0: 確保日期不跑掉
			const publication_date = new Date(record.time_value);
			//console.trace([record.date, publication_date, publication_date.precision]);
			// assert: !isNaN(publication_date?.getTime())
			Object.assign(data_to_modify.publication_date_claim, {
				// publication date (P577) 出版日期
				P577: publication_date,
				qualifiers: {
					// published in (P1433) 發表於
					P1433: NCBI_pubstatus_to_entity_id_mapping[record.pubstatus],
				},
				references: NCBI_article_data.wikidata_references
			});
		}
	}

	// @seealso Europe_PMC_article_data.hasBook==="Y"
	data_to_modify.is_book = NCBI_article_data.doctype === 'book';
	//data_to_modify.is_book = 'bookid' in Europe_PMC_article_data;
	if (Array.isArray(Europe_PMC_article_data.pubTypeList?.pubType)) {
		// TODO: 這邊的數據似乎更能判別文章型態
		// https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:17246615%20AND%20SRC:MED&resulttype=core&format=json
		// https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=PMCID:PMC1201098&resulttype=core&format=json
		// https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:33914448%20AND%20SRC:MED&resulttype=core&format=json
	}

	// publication date (P577) 出版日期
	if (data_to_modify.publication_date_claim.P577) {
		data_to_modify.claims.push(data_to_modify.publication_date_claim);
		const publication_date = data_to_modify.publication_date_claim.P577;
		//console.trace([publication_date, publication_date.precision]);
		adapt_time_to_descriptions(data_to_modify, publication_date);
	} else {
		adapt_time_to_descriptions(data_to_modify);
	}
	//delete data_to_modify.publication_date_claim;

	// --------------------------------------------------------------
	// 設定 data_to_modify.publication_in_claim_qualifiers

	data_to_modify.publication_in_claim_qualifiers = {};
	if (NCBI_article_data.volume) {
		// 可能為 ""
		// volume (P478) 卷
		data_to_modify.publication_in_claim_qualifiers.P478 = NCBI_article_data.volume;
	}
	if (NCBI_article_data.issue) {
		// issue (P433) 期號
		data_to_modify.publication_in_claim_qualifiers.P433 = NCBI_article_data.issue;
	}
	if (NCBI_article_data.pages) {
		// 可能為 ""
		// page(s) (P304) 頁碼
		data_to_modify.publication_in_claim_qualifiers.P304 = NCBI_article_data.pages.replace(/^(\d+)-(\d+)$/, '$1–$2');
	}
	if (data_to_modify.publication_date) {
		// publication date (P577) 出版日期
		data_to_modify.publication_in_claim_qualifiers.P577 = data_to_modify.publication_date;
	}
	//delete data_to_modify.publication_date;
	if (NCBI_article_data.issn || NCBI_article_data.essn) {
		const source_entity_id = await get_entity_id_of_ISSN(NCBI_article_data.issn) || await get_entity_id_of_ISSN(NCBI_article_data.essn);
		if (source_entity_id) {
			data_to_modify.claims.push({
				// published in (P1433) 發表於
				P1433: source_entity_id,
				qualifiers: data_to_modify.publication_in_claim_qualifiers,
				references: NCBI_article_data.wikidata_references
			});
			delete data_to_modify.publication_in_claim_qualifiers;
		}
	}
	// TODO: using Europe_PMC_article_data.journalInfo.journal.issn
	if (data_to_modify.publication_in_claim_qualifiers && NCBI_article_data.fulljournalname) {
		// Using ISSN/ESSN is better than NCBI_article_data.fulljournalname. https://www.wikidata.org/wiki/Q110634863
		// PubMed_ID=17246615
		const source_name = normalize_source_name(NCBI_article_data.fulljournalname);
		const source_entity_id = published_source_mapping.get(source_name);
		if (!source_entity_id) {
			//console.trace(NCBI_article_data);
			CeL.error(`${PubMed_ID}: Unknown fulljournalname: ${JSON.stringify(source_name)}. Please add it to published_source_mapping!`);
		}
		// https://www.wikidata.org/wiki/Special:EntityData/Q5418627.json
		data_to_modify.claims.push({
			// published in (P1433) 發表於
			P1433: source_entity_id,
			qualifiers: data_to_modify.publication_in_claim_qualifiers,
			references: NCBI_article_data.wikidata_references
		});
	}
	delete data_to_modify.publication_in_claim_qualifiers;

	// --------------------------------------------------------------
	// publisher

	if (data_to_modify.is_book) {
		data_to_modify.claims.push({
			// distribution format: printed book
			P437: 'Q11396303',
			references: NCBI_article_data.wikidata_references
		});
	}

	if (NCBI_article_data.publishername) {
		// PubMed_ID=33914448
		const publisher = {
			// publisher (P123)
			P123: NCBI_article_data.publishername
				// 去掉縮寫。 e.g., "Institute for Quality and Efficiency in Health Care (IQWiG)" @ https://www.wikidata.org/wiki/Q110643313
				.replace(/ +\(\w+\)$/, ''),
			references: NCBI_article_data.wikidata_references
		};
		if (NCBI_article_data.publisherlocation) {
			publisher.qualifiers = {
				// "Southampton (UK)" → "Southampton, UK"
				P291: NCBI_article_data.publisherlocation.replace(/ +\((.+)\)$/, ', $1')
			};
		}
		data_to_modify.claims.push(publisher);
	}

	// --------------------------------------------------------------
	// full work available at URL (P953) 全作品可見於

	// https://www.wikidata.org/wiki/User:PintochBot
	if (Array.isArray(Europe_PMC_article_data.fullTextUrlList?.fullTextUrl)) {
		// https://www.ebi.ac.uk/europepmc/webservices/rest/search?resulttype=core&format=json&query=SRC%3AMED%20AND%20EXT_ID%3A34572048
		// May test Europe_PMC_article_data.hasPDF, Europe_PMC_article_data.isOpenAccess
		Europe_PMC_article_data.fullTextUrlList.fullTextUrl.forEach(document_data => {
			if (document_data.availability !== 'Open access'
				// https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=PMCID:PMC1201098&resulttype=core&format=json
				&& document_data.availability !== 'Free'
			) {
				return;
			}

			const qualifiers = {
				P2701: Europe_PMC_documentStyle[document_data.documentStyle] || document_data.documentStyle,
				// reason for preferred rank: Open Access
				//P7452: 'Q232932',
				// online access status (P6954): Open Access
				P6954: 'Q232932',
				// content deliverer (P3274) 內容遞送者
				P3274: document_data.site,
			};

			data_to_modify.claims.push({
				// full work available at URL (P953) 全作品可見於
				P953: document_data.url,
				qualifiers,
				references: Europe_PMC_article_data.wikidata_references
			});
		});
	}

	if (Array.isArray(CrossRef_article_data.link)) {
		CrossRef_article_data.link.forEach(document_data => {
			let file_format = document_data.URL?.match(/\.(\w+)$/);
			if (file_format) {
				file_format = file_format[1].toLowerCase();
				if (!/^(?:pdf|html|txt)$/.test(file_format))
					file_format = null;
			}

			const qualifiers = file_format && {
				P2701: Europe_PMC_documentStyle[file_format] || file_format,
			};

			data_to_modify.claims.push({
				// full work available at URL (P953) 全作品可見於
				P953: document_data.URL,
				qualifiers,
				references: CrossRef_article_data.wikidata_references
			});
		});
	}

	// --------------------------------------------------------------
	// main subject (P921)

	data_to_modify.main_subject = Object.create(null);
	async function add_main_subject(key, references, object_of_statement_has_role) {
		if (!key) return;

		if (Array.isArray(key)) {
			for (const _key of key) {
				add_main_subject(_key, references, object_of_statement_has_role);
			}
			return;
		}

		key = key.trim().toLowerCase();
		//console.trace([key, key in data_to_modify.main_subject]);
		if (key in data_to_modify.main_subject) return;
		// 登記已處理過。
		data_to_modify.main_subject[key] = null;

		let main_subject = main_subject_mapping.get(key);
		if (!main_subject) {
			main_subject = key;
		}
		if (main_subject) {
			const qualifiers = {
				// object named as (P1932)
				P1932: key,
			};

			// [[d:User talk:Kanashimi#Use of keywords]]
			if (object_of_statement_has_role) {
				// object of statement has role (P3831)
				qualifiers.P3831 = object_of_statement_has_role;
			}

			const claim = {
				// main subject (P921)
				P921: main_subject,

				// [[d:User talk:Kanashimi#please check before adding properties to scholarly article items]]
				// 必須採用更嚴謹的篩選方式。
				// TODO: 順便刪除錯誤的主題。
				async filter(item, key) {
					if (!CeL.wiki.data.search.default_filter(item, key))
						return false;

					// episode: [[Q111180311]], [[Q112193307]], [[Q111905581]]
					if (/scientific article|publication|episode/i.test(item.description))
						return false;

					const item_data = await wiki.data(item.id);
					// Test instance of (P31) or subclass of (P279)
					// e.g., [[Q70709021]]
					const class_ids = CeL.wiki.data.value_of(item_data?.claims?.P31 || item_data?.claims?.P279);
					if (!class_ids
						|| (Array.isArray(class_ids) ? class_ids : [class_ids]).some(class_id => wiki.latest_task_configuration.general.non_main_subject_types_Set.has(class_id))) {
						return false;
					}

					return true;
				},

				qualifiers,

				// based on heuristic (P887)
				//references: + P887:'inferred from keyword and API search'
				references
			};
			// 這邊頻繁搜尋 key 可能造成 cache 肥大，且有拖延時間的問題。因此一次執行不能處理太多項目!
			data_to_modify.claims.push(claim);
		}
	}

	//console.trace(Europe_PMC_article_data.keywordList?.keyword);
	await add_main_subject(Europe_PMC_article_data.keywordList?.keyword, Europe_PMC_article_data.wikidata_references,
		// object of statement has role (P3831) : index term (Q13422207)
		'Q13422207'
	);

	// 醫學主題詞。
	await add_main_subject(
		Europe_PMC_article_data.meshHeadingList?.meshHeading
			//?.filter(data => data.majorTopic_YN === 'Y')?.map(data => data.descriptorName)
			?.reduce((filtered, data) => {
				if (data.majorTopic_YN === 'Y') filtered.push(data.descriptorName);
				return filtered;
			}, []),
		Europe_PMC_article_data.wikidata_references,
		// Medical Subject Headings (Q199897) MeSH
		'Q199897'
	);

	//await add_main_subject(Europe_PMC_article_data.subsetList?.subset, Europe_PMC_article_data.wikidata_references);

	await add_main_subject(CrossRef_article_data.subject, CrossRef_article_data.wikidata_references);

	// --------------------------------------------------------------
	// cites work (P2860)
	// https://www.wikidata.org/wiki/User:Citationgraph_bot
	// TODO: https://api.opencitations.net/

	if (Array.isArray(CrossRef_article_data.reference)) {
		// 不是每一筆記錄皆有 https://api.crossref.org/works/10.3390/genes12020166
		const DOI_to_item_id_mapping = await search_DOIs(CrossRef_article_data.reference
			//.filter(reference_data => reference_data.DOI).map(reference_data => reference_data.DOI)
			.reduce((filtered, reference_data) => {
				if (reference_data.DOI) filtered.push(reference_data.DOI);
				return filtered;
			}, [])
		);
		//console.trace(DOI_to_item_id_mapping);

		for (let index = 0; index < CrossRef_article_data.reference.length;) {
			const reference_data = CrossRef_article_data.reference[index];

			const qualifiers = {
				// series ordinal (P1545) 系列序號
				P1545: ++index,
			};

			const claim = {
				qualifiers,
				// [[d:User talk:Kanashimi#please check before adding properties to scholarly article items]]
				// 必須採用更嚴謹的篩選方式。
				// TODO: 順便刪除錯誤的主題。
				// TODO: Test instance of (P31)
				async filter(item, key) {
					if (!CeL.wiki.data.search.default_filter(item, key))
						return false;

					// "Moot Point" @ https://www.wikidata.org/w/index.php?title=Q34318047&oldid=prev&diff=2299781576&diffmode=source
					// https://www.wikidata.org/w/index.php?title=Q55056964&oldid=prev&diff=2300931637&diffmode=source
					if (/episode/i.test(item.description))
						return false;

					if (/scientific article/i.test(item.description))
						return true;

					return true;
				},

				references: CrossRef_article_data.wikidata_references
			};

			let cites_work_title;

			if (reference_data.DOI) {
				const DOI = reference_data.DOI.toUpperCase();
				if (!DOI_to_item_id_mapping.has(DOI))
					continue;
				const reference_item_id = DOI_to_item_id_mapping.get(DOI)[0];
				// TODO: 去掉與自己相同的引用。 e.g., [[d:User talk:Kanashimi#Self link cites work (P2860)]]

				//qualifiers[NCBI_articleid_properties_mapping.doi] = DOI;
				cites_work_title = DOI_to_item_id_mapping.get(DOI)[0];

			} else if (reference_data['article-title']) {
				// 找出確實的文章項目。例如 Q37036571 的參考資料。
				// native label (P1705)
				// qualifiers.P1705 = reference_data['article-title'];
				cites_work_title = reference_data['article-title'];

			} else if (reference_data['journal-title']) {
				let journal_title = reference_data['journal-title'];
				journal_title = journal_title_mapping.get(journal_title) || journal_title;
				// 去掉太過簡短的期刊標題與縮寫。
				// e.g., https://api.crossref.org/works/10.1007/BF02773739 https://api.crossref.org/works/10.1177/030089167906500317 ("journal-title":"Bl.")
				if (!/^[\w.]{1,10}$/.test(journal_title)) {
					cites_work_title = journal_title;
					// 下面這幾個都跟隨 ['journal-title'] or ['series-title']
					if (reference_data.volume) {
						// volume (P478) 卷
						qualifiers.P478 = reference_data.volume;
					}
					if (reference_data['first-page']) {
						// page(s) (P304) 頁碼
						qualifiers.P304 = reference_data['first-page'];
						// cf. number of pages (P1104)
					}
					if (reference_data.author) {
						// author name string (P2093) 作者姓名字符串
						qualifiers.P2093 = reference_data.author;
					}
					if (reference_data.year) {
						// publication date (P577) 出版日期
						qualifiers.P577 = reference_data.year.to_Date({ zone: 0 });
					}
				}
			}

			if (cites_work_title) {
				// cites work (P2860)
				claim.P2860 = cites_work_title;
				data_to_modify.claims.push(claim);
				continue;
			}

			if (
				// title only
				reference_data['series-title']
				// 供應商尚未處理。
				|| reference_data.unstructured
				// key only
				|| Object.keys(reference_data).join() === 'key'
			) {
				continue;
			}

			// PubMed ID=440090: {"key":"10.1016/0076-6879(79)59126-5_BIB4","first-page":"81","volume":"Vol. 4","author":"Cooperman","year":"1978"}
			// PubMed ID=9214306: {"key":"atypb1/atypb2","volume-title":"Biochemistry 34, 3286−3299","author":"Agashe V. R.","year":"1995"}
			CeL.error(`${for_each_PubMed_ID.name}: PubMed ID=${PubMed_ID}: Skip unknown reference: ${JSON.stringify(reference_data)}`);
		}
	}

	// TODO: Europe_PMC_article_data.citedByCount

	// ----------------------------------------------------------------------------------------------------------------
	// get article id + 檢查是否有重複項目

	if (Array.isArray(Europe_PMC_article_data.fullTextIdList?.fullTextId)) {
		// TODO:
	}

	const article_item_list = await get_article_entities_by_ids({ PubMed_ID, NCBI_article_data, Europe_PMC_article_data, data_to_modify });
	//console.trace(article_item_list);
	//console.trace(article_item_list.id_list());

	if (article_item_list.length > 1) {
		// 如果找到多個項目，則將它們標記為有問題的數據，以便後續處理。
		CeL.warn(`${for_each_PubMed_ID.name}: There are ${article_item_list.length} articles that PubMed_ID=${PubMed_ID} or title=${JSON.stringify(main_title)}!${article_item_list.length < 30 ? ' (' + article_item_list.id_list().join(', ') + ')' : ''}`);
		// count > 1: error, log the result.
		await add_problematic_data(PubMed_ID, article_item_list.id_list().map(id => `{{Q|${id}}}`).join(', ')
			//, NCBI_article_data
		);
		return article_item_list;
	}

	// ----------------------------------------------------

	//console.log(JSON.stringify(data_to_modify));
	//console.trace(data_to_modify);
	//return;
	//CeL.set_debug(6);

	if (article_item_list.length === 0) {
		// no result: Need to add.
		clean_data_to_modify(data_to_modify);
		CeL.info(`${for_each_PubMed_ID.name}: Create new item for PubMed ID=${PubMed_ID}: ${main_title}`);
		//throw new Error('No existing item found');
		return await wiki.new_data_entity(data_to_modify, Object.assign(Object.create(null), default_data_modify_options, {
			summary: `Import new ${NCBI_article_data.doctype} PubMed ID = ${PubMed_ID}${summary_source_posifix}`,
		}));
	}

	// assert: article_item_list.length === 1
	// Only one result: Already added. Append.
	const article_item = await wiki.data(article_item_list.id_list()[0]);
	//console.trace([article_item_list[0], article_item]);

	// 檢查 PubMed ID 是否一致。
	{
		const PubMed_IDs = CeL.wiki.data.value_of(article_item.claims[NCBI_articleid_properties_mapping.pubmed]);
		// assert: Array.isArray(PubMed_IDs) ? PubMed_IDs.includes(article_item_list[0].pubmed.value) : PubMed_IDs === article_item_list[0].pubmed.value
		if (PubMed_IDs && (Array.isArray(PubMed_IDs) ? !PubMed_IDs.some(pubmed => +pubmed === PubMed_ID) : PubMed_IDs !== PubMed_ID)) {
			CeL.warn(`${for_each_PubMed_ID.name}: PubMed ID ${PubMed_ID}: Found an item [[${article_item.id}]] with different PubMed ID(s) ${PubMed_IDs}!`);
			await add_problematic_data(PubMed_ID, `Found an item [[${article_item.id}]] with different PubMed ID(s) ${PubMed_IDs}!`);
			return;
		}
	}

	// 檢查標題是否差太多。
	if (4 * CeL.edit_distance(CeL.wiki.data.value_of(article_item.labels.en), data_to_modify.labels.en) > data_to_modify.labels.en.length + 8) {
		CeL.warn(`${for_each_PubMed_ID.name}: PubMed ID ${PubMed_ID}: 跳過標題差太多的 article item [[${article_item.id}]]!
wiki 標題	${JSON.stringify(article_item.labels.en)}
自 PMC 取得	${JSON.stringify(data_to_modify.labels.en)}`);
		await add_problematic_data(PubMed_ID, `${JSON.stringify(data_to_modify.labels.en)} is too different from the title of {{Q|${article_item.id}}}`);
		return;
	}

	// 不覆蓋原有更好的描述。
	for (const [language_code, modify_to] of Object.entries(data_to_modify.descriptions)) {
		const original_value = CeL.wiki.data.value_of(article_item.descriptions[language_code]);
		//console.log([original_value, modify_to]);

		// [[d:User talk:Kanashimi#On descriptions for scientific articles in Ukrainian]]
		// appropriate substitutions in Wikidata
		if (language_code === 'uk' && original_value && original_value.replace(/\s*р\.$/, '').length < modify_to.length)
			continue;

		if (original_value?.length >= modify_to.length)
			delete data_to_modify.descriptions[language_code];
	}

	// 刪除原有的、有問題且正規化後會重複的 title 標題 (P1476)，例如標題結尾有 "."。
	// 作業原則: 盡可能不動到原有的標題。
	// 若是原有標題有轉成id之後重複的，則選擇最接近正規化的標題留存。
	if (Array.isArray(article_item.claims.P1476)) {
		// original_title_list.get(title_id) === [ original_title, original_title === normalized_title ]
		const original_title_list = new Map();
		for (const statement of article_item.claims.P1476) {
			const original_title = CeL.wiki.data.value_of(statement);
			const normalized_title = normalize_article_title(original_title)[0];
			const title_id = title_to_id(normalized_title);
			//console.trace([normalized_title, title_id, original_title === normalized_title, data_to_modify.title_list.has(title_id), original_title_list.has(title_id)]);
			if (original_title === normalized_title) {
				// 要以現在這個原有的標題為主。
				if (data_to_modify.title_list.has(title_id)) {
					data_to_modify.title_list.delete(title_id);
					data_to_modify.claims = data_to_modify.claims.filter(statement => {
						// 跳過重複的新設定。
						return statement.P1476 !== normalized_title;
					});
				}
				if (!original_title_list.has(title_id)) {
					original_title_list.set(title_id, [original_title, true]);
					continue;
				}

				// 去掉重複的原有標題。假如先前的標題已經是正規化後的標題就留存下來，刪掉現在這個標題。否則刪掉先前的原有標題。
				data_to_modify.claims.push({
					P1476: original_title_list.get(title_id)[1] ? original_title : original_title_list.get(title_id)[0],
					remove: true
				});
				if (!original_title_list.get(title_id)[1])
					original_title_list.set(title_id, [original_title, true]);
				continue;
			}

			if (!original_title_list.has(title_id) && !data_to_modify.title_list.has(title_id)) {
				// Left the original title untouched.
				original_title_list.set(title_id, [original_title, false]);
				continue;
			}

			// 要以新的設定為主。
			if (original_title_list.has(title_id)) {
				original_title_list.delete(title_id, [original_title, false]);
			}

			data_to_modify.claims.push({
				// 刪掉現在這個標題。
				P1476: original_title,
				remove: true
			});
		}
	}

	// 超過一個標題，應該選出一個最佳標題。
	if (data_to_modify.title_list.size > 1
		// 必須原文是英文，才該把最佳標題設成英文標題。
		&& !data_to_modify.is_non_English_title
		&& data_to_modify.title_list.preferred_claim
		&& !data_to_modify.title_list.preferred_claim.qualifiers) {
		data_to_modify.title_list.preferred_claim.rank = 'preferred';
		data_to_modify.title_list.preferred_claim.qualifiers = {
			// reason for preferred rank (P7452) = most precise value (Q71536040)
			P7452: 'Q71536040'
		};
	}
	// TODO: 去除非英語標題, Q40043914
	//console.trace(data_to_modify.claims);

	// 檢測原先就有的 author (P50) 作者，例如手動加入的。
	if (Array.isArray(article_item.claims.P50) && (data_to_modify.author_list.no_item_count || Array.isArray(article_item.claims.P2093))) {
		//console.trace(article_item.claims.P50);
		const author_list = data_to_modify.author_list;
		// author (P50) 作者
		for (const statement of article_item.claims.P50) {
			let ordinal = CeL.wiki.data.value_of(statement.qualifiers?.P1545);
			if (!ordinal || !((ordinal = +ordinal[0]) > 0) || author_list.has_item[ordinal]) return;
			const entity_id = CeL.wiki.data.value_of(statement);
			const original_value = CeL.wiki.data.value_of((await wiki.data(entity_id, { props: 'labels' }))?.en);
			//console.trace([ordinal, original_value, author_list[ordinal], author_list.has_item[ordinal]]);
			if (!are_equivalent_person_names(original_value, author_list[ordinal])) {
				// 跳過不等價的姓名。
				continue;
			}
			author_list.has_item[ordinal] = true;
			data_to_modify.claims = data_to_modify.claims.filter(statement => {
				// author name string (P2093) 作者姓名字符串
				return statement.P2093 !== author_list[ordinal];
			});
		}
	}

	// 請注意，文章可能有多個作者有相同的姓名。

	// https://www.wikidata.org/wiki/Wikidata:Requests_for_permissions/Bot/StreetmathematicianBot_2
	// turn author name string (P2093) statements into disambiguated author (P50) statements based on ORCID iDs.
	if (Array.isArray(article_item.claims.P2093)) {
		//console.trace(article_item.claims.P2093);
		const author_list = data_to_modify.author_list;
		// author name string (P2093) 作者姓名字符串
		for (let index = 0; index < article_item.claims.P2093.length; index++) {
			const statement = article_item.claims.P2093[index];
			let ordinal = CeL.wiki.data.value_of(statement.qualifiers?.P1545);
			if (!ordinal || !((ordinal = +ordinal[0]) > 0)) continue;
			const original_value = CeL.wiki.data.value_of(statement);
			//console.trace([ordinal, original_value, author_list[ordinal], author_list.has_item[ordinal]]);
			if (original_value === author_list[ordinal] && !author_list.has_item[ordinal]) continue;
			if (!are_equivalent_person_names(original_value, author_list[ordinal])) {
				// 跳過不等價的姓名。
				CeL.warn(`${for_each_PubMed_ID.name}: Skip inequivalent author names with the same ordinal ${ordinal}: ${JSON.stringify(original_value)} ≢ ${JSON.stringify(author_list[ordinal])}`);
				continue;
			}
			if (original_value.replace(/\s+/g, ' ').replace(/\./g, '').length
				> author_list[ordinal].replace(/\s+/g, ' ').replace(/\./g, '').length) {
				// 原來的項目已經有更好更完整的資料。
				// TODO: Do not add this name.
				continue;
			}

			// remove the author name string (P2093) statement
			data_to_modify.claims.push({
				P2093: original_value,
				remove: true
			});
		}
	}


	data_to_modify.available_at = new Set;
	// full work available at URL (P953) 全作品可見於
	if (Array.isArray(article_item.claims.P953)) {
		article_item.claims.P953.forEach(statement => {
			// Register original value. 登記原有值
			data_to_modify.available_at.add(CeL.wiki.data.value_of(statement));
		});
	}

	// Remove duplicates.
	data_to_modify.claims = data_to_modify.claims.filter(statement => {
		// full work available at URL (P953) 全作品可見於
		if (statement.P953) {
			if (data_to_modify.available_at.has(statement.P953))
				return false;
			// Register the value set this time. 登記本次設定的值。
			data_to_modify.available_at.add(statement.P953);
		}
		return true;
	});


	// Release memory. 釋放被占用的記憶體。
	clean_data_to_modify(data_to_modify);

	const summary_prefix = `${CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title, 'Modify PubMed ID')}: ${PubMed_ID} `;
	CeL.info(`${for_each_PubMed_ID.name}: Modify PubMed ID:${PubMed_ID} ${article_item_list.id_list()[0]}: ${CeL.wiki.data.value_of(article_item_list[0].itemLabel)}`);
	//console.trace(data_to_modify);
	const summary = `${summary_prefix}${NCBI_article_data.doctype} data${summary_source_posifix}`;
	if (data_to_modify.descriptions && !CeL.is_empty_object(data_to_modify.descriptions)) {
		const descriptions = data_to_modify.descriptions;
		delete data_to_modify.descriptions;
		// https://doc.wikimedia.org/Wikibase/master/php/md_docs_topics_changeop_serializations.html
		for (const [language_code, description] of Object.entries(descriptions)) {
			descriptions[language_code] = { language: language_code, value: description };
		}
		//console.trace(descriptions);
		await article_item.modify({ descriptions }, Object.assign(Object.create(null), default_data_modify_options, {
			summary,
		}));
	}

	//console.trace(data_to_modify);
	await article_item.modify(data_to_modify, Object.assign(Object.create(null), default_data_modify_options, {
		summary,
	}));
	return article_item;
}

// ----------------------------------------------------------------------------

async function fetch_ORCID_data_from_service(ORCID) {
	const ORC_data = Object.create(null);

	// https://info.orcid.org/documentation/api-tutorials/api-tutorial-read-data-on-a-record/#easy-faq-2570
	// https://info.orcid.org/documentation/api-tutorials/api-tutorial-searching-the-orcid-registry/#easy-faq-2707
	for (const type of ['record',/* 'external-identifiers', 'researcher-urls' */]) {
		try {
			JSON.from_XML((await (await CeL.fetch(`https://pub.orcid.org/v3.0/${ORCID}/${type}`)).text()).replace(/(<\/?)(\w+):\2([ >])/g, '$1$2$3'))[type]
				.forEach(item => put_to_data(type === 'record' ? ORC_data : (ORC_data.person[type] = Object.create(null)), item));
		} catch (e) {
			return;
		}
	}

	function put_to_data(data_to_put_to, item) {
		for (let [key, value] of Object.entries(item)) {
			//if (!value || key === 'path' || key === 'visibility') continue;

			key = key.replace(/^[^:]+:/, '');

			if (Array.isArray(value))
				value = value.reduce(put_to_data, Object.create(null));

			const original_value = data_to_put_to[key];
			if (!original_value) {
				data_to_put_to[key] = value;
			} else {
				if (!Array.isArray(original_value))
					data_to_put_to[key] = [original_value];
				data_to_put_to[key].push(value);
			}
		}
		return data_to_put_to;
	}

	//console.trace(ORC_data);
	//console.trace(JSON.stringify(ORC_data));
	return ORC_data;
}

// https://www.wikidata.org/wiki/Wikidata:Requests_for_permissions/Bot/Orcbot
async function for_unregistered_ORCID(ORCID, author_name) {
	// TODO: create author item
	return;

	const ORC_data = await fetch_ORCID_data_from_service('0000-0003-0626-8879');
	if (!ORC_data)
		return;

	// create_ORCID_item()

	//return person item
}
