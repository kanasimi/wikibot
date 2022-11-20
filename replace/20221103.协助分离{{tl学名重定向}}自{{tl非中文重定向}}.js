/*

node 20221102.create_wikinews_category_and_project_pages.js date=2022/10
node 20221102.create_wikinews_category_and_project_pages.js month_duration=3


2022/11/3 18:23:34	初版試營運。

TODO:

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Load replace tools.
const replace_tool = require('./replace_tool.js');

// Load modules.
CeL.run([
	// for CeL.assert()
	'application.debug.log',
]);

// Set default language. 改變預設之語言。 e.g., 'zh'
//set_language('ja');
/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

log_to = log_to.replace(/\d+$/, 20190913);

const replace_from = 'Template:非中文重定向';

// ----------------------------------------------------------------------------

(async () => {
	//console.log(login_options);
	await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
	await main_process();
})();

async function main_process() {
	await wiki.register_redirects(replace_from);
	let page_title_list;
	//page_title_list = await (await fetch('https://gist.githubusercontent.com/davidxuang/b74a382abeff455204599598e030a056/raw/487af0421a088136f172c691fb51417982d050bf/scientific_names.txt')).text();
	//page_title_list = page_title_list.trim().split('\n');
	//console.trace(page_title_list);
	await wiki.for_each_page(page_title_list, for_each_page, {
		log_to,
		summary: `[[Special:Diff/74376687/74376713#协助分离%7B%7B学名重定向%7D%7D自%7B%7B非中文重定向%7D%7D|Bot request]]: 將物種名之{{非中文重定向}}換成{{學名重定向}} - [[${log_to}|log]]`,
	});

	// ----------------------------------------------------

	page_title_list = `
Begonia ×semperflorens-cultorum
Begonia ×tuberhybrida ‘Kimjongilia’
Bolbitis ×nanjenensis
Calanthe ×dominii
Canna ×generalis
Citrus ×aurantifolia
Citrus ×aurantium
Citrus ×bergamia
Citrus ×junos
Citrus ×limon
Citrus ×limonia
Citrus ×paradisi
Citrus ×tangerina
Fragaria ×ananassa
Fragaria ×vescana
Magnolia ×alba
Magnolia ×soulangeana
Medicago ×varia
Mentha ×gracilis
Mentha ×piperita
Mentha ×rotundifolia
Nepenthes ×alisaputrana
Nepenthes ×bauensis
Nepenthes ×cantleyi
Nepenthes ×cincta
Nepenthes ×ferrugineomarginata
Nepenthes ×harryana
Nepenthes ×hookeriana
Nepenthes ×kinabaluensis
Nepenthes ×kuchingensis
Nepenthes ×merrilliata
Nepenthes ×mirabilata
Nepenthes ×pangulubauensis
Nepenthes ×sarawakiensis
Nepenthes ×sharifah-hapsahii
Nepenthes ×trichocarpa
Nepenthes ×truncalata
Nepenthes ×trusmadiensis
Nepenthes ×tsangoya
Nepenthes ×ventrata
Nepeta ×faassenii
Petunia ×hybrida
Platanus ×hispanica
Populus ×beijingensis
Populus ×berolinensis
Populus ×canadensis 'Serotina'
Populus ×canadensis ‘Polska-15A’
Populus ×canescens
Populus ×jrtyschensis
Populus ×pseudo-tomentosa
Populus ×xiaozhuanica
Prunus ×yedoensis
Pyrus ×sinkiangensis
Rhododendron ×duclouxii
Rosa ×odorata
Syringa ×chinensis
Syringa ×persica
Viola ×takahashii
×Triticale
`;
	page_title_list = page_title_list.trim().split('\n');

	const task_configuration = Object.create(null);
	page_title_list.forEach(page_title => {
		task_configuration[page_title] = {
			do_move_page: { noredirect: 1, },
			move_to_link: page_title.replace(/×/, '× ')
		};
	});
	await replace_tool.replace({
		//language: 'zh',
		wiki,
		//namespace: '*',
	}, task_configuration);
}

// ----------------------------------------------------------------------------

function for_each_page(page_data) {
	const parsed = page_data.parse();
	CeL.assert([page_data.wikitext, parsed.toString()],
		// gettext_config:{"id":"wikitext-parser-checking-$1"}
		CeL.gettext('wikitext parser checking: %1', CeL.wiki.title_link_of(page_data)));

	let modified;
	parsed.each(replace_from, template_token => {
		if (Object.keys(template_token.parameters).length > 0) {
			CeL.error(`${CeL.wiki.title_link_of(page_data)}: 模板有多餘參數: ${template_token}`);
			return;
		}
		modified = true;
		return '{{學名重定向}}';
	}, true);

	return modified ? parsed.toString() : Wikiapi.skip_edit;
}
