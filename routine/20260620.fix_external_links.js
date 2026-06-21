/*
node 20260620.fix_external_links.js use_project=zhwiki

這個任務會將維基姐妹計畫的外部連結轉為 wikilink。

2026/6/20 11:29:59	初版試營運

TODO:

*/

'use strict';

const debug_pages =
	['澤蘭宮']
	&& ['Wikipedia:沙盒']
	//&& null
	;


'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Load modules.
CeL.run([
	// for CeL.assert()
	'application.debug.log']);

// Set default language. 改變預設之語言。 e.g., 'zh'
//set_language('zh');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// ----------------------------------------------

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

	if (!latest_task_configuration.general)
		latest_task_configuration.general = Object.create(null);
	const { general } = latest_task_configuration;


	console.trace(wiki.latest_task_configuration.general);
}

// ----------------------------------------------------------------------------

(async () => {
	login_options.configuration_adapter = adapt_configuration;
	//console.log(login_options);
	await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
	await main_process();
	routine_task_done('1 week');
})();

// ----------------------------------------------------------------------------


async function main_process() {
	let summary_prefix = CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title, '整理維基姐妹計畫的外部連結');

	for await (const page_list of (debug_pages ? [debug_pages]
		: wiki.allpages({
			//namespace: 'category',
			//namespace: 'template',
			batch_size: 100,
		}))) {

		await wiki.for_each_page(page_list, for_each_page, {
			no_message: true,
			redirects: false,
			summary: `${summary_prefix}`,
		});
	}
}


async function for_each_page(page_data) {
	//console.log(page_data);
	const wikitext = page_data.wikitext;
	if (!wikitext || !/\[\[ *:[^:]+:/.test(wikitext) && !/\[ *https?:\/\//.test(wikitext))
		return Wikiapi.skip_edit;

	CeL.log_temporary(`${for_each_page.name}: 處理頁面 ${CeL.wiki.title_link_of(page_data)}`);
	const parsed = page_data.parse();
	CeL.assert([page_data.wikitext, parsed.toString()],
		// gettext_config:{"id":"wikitext-parser-checking-$1"}
		CeL.gettext('wikitext parser checking: %1', CeL.wiki.title_link_of(page_data)));

	// ------------------------------------------------------------------------

	let changed = false;

	parsed.each('external_link', external_link_token => {
		const interwiki_data = CeL.wiki.parse.interwiki_url(external_link_token, wiki.append_session_to_options());
		if (!interwiki_data)
			return;

		if (interwiki_data.wikilink) {
			CeL.log(`${CeL.wiki.title_link_of(page_data)}: ${interwiki_data.wikilink} ← ${external_link_token.toString()}`);
			changed = true;
			return interwiki_data.wikilink;
		}

		if (interwiki_data.url_magic_word && !interwiki_data.display_text) {
			CeL.log(`${CeL.wiki.title_link_of(page_data)}: ${interwiki_data.url_magic_word} ← ${external_link_token.toString()}`);
			changed = true;
			return interwiki_data.url_magic_word;
		}

	}, { modify: true });

	// ------------------------------------------------------------------------

	parsed.each('link', link_token => {
		if (!link_token.is_link) {
			return;
		}

		const interwiki_data = CeL.wiki.parse.interwiki_link(link_token, wiki.append_session_to_options());
		if (!interwiki_data.interlanguage || !interwiki_data.interwiki
			// e.g., [[s:es:Circular a las provincias del interior del 27 de mayo de 1810|1810年5月27日发给内陆各省的通知]] @ [[五月革命]]
			|| interwiki_data.interlanguage.prefix !== interwiki_data.interwiki.prefix) {
			return;
		}

		// console.trace(link_token.page_title.match(wiki.configurations.PATTERN_language_startup));
		// wiki.latest_site_configurations.interwikimap.mapper[interwiki_data.interwiki.prefix]

		let template_name, parameters;
		switch (use_language) {
			case 'zh':
				// [[w:zh:Wikipedia:机器人/作业请求#請求建機器人批次處置不合規範的跨語言連結]]
				template_name = 'tsl';
				parameters = [, interwiki_data.interlanguage.prefix,
					interwiki_data.interlanguage.title];
				if (link_token.display_text
					&& link_token.display_text !== interwiki_data.interlanguage.title) {
					parameters[4] = link_token.display_text;
				}
				break;

			case 'en':
				break;

			case 'ja':
				break;

		}

		if (template_name) {
			const wikitext = CeL.wiki.parse.template_object_to_wikitext(template_name, parameters);
			CeL.log(`${CeL.wiki.title_link_of(page_data)}: ${link_token} → ${wikitext}`);
			changed = true;
			return wikitext;
		}
	}, { modify: true });

	// ------------------------------------------------------------------------

	if (!changed)
		return Wikiapi.skip_edit;

	//return Wikiapi.skip_edit;
	return parsed.toString();
}
