/*

	  初版試營運。
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

async function main_process() {

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

	routine_task_done('1 week');
}

