/*
node 20260620.convert_interwiki_links.js use_project=zhwiki

這個任務會將所有 interwiki links （如 Wikimedia projects）的外部連結轉為 wiki計畫間連結（wikilinks）。

2026/6/20 11:29:59	初版試營運
2026/6/29 20:48:49	增加 general.* 設定

TODO:
[[Super Wings]]: {{作品名稱|name=[[:ja:]] 不該轉為模板
對於有本地頁面的使用者連結直接替換為本地連結 

*/

'use strict';

const debug_pages =
	['澤蘭宮']
	&& ['Wikipedia:沙盒'] && ['User:Cewbot/log/20260620/testcases']
	&& ['聖顯者', '胡锡进', '撒奇萊雅族']
	&& null
	;


'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

CeL.env.ignore_COM_error = true;

// Load modules.
CeL.run([
	// for CeL.assert()
	'application.debug.log',
	// for CeL.guess_text_language()
	'application.locale.encoding',
]);

// Set default language. 改變預設之語言。 e.g., 'zh'
//set_language('zh');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

const remove_token = CeL.wiki.parser.parser_prototype.each.remove_token;

// ----------------------------------------------

/**
 * 由設定頁面讀入手動設定 manual settings。
 * 
 * @param {Object}latest_task_configuration
 *            最新的任務設定。設定頁面所獲得之手動設定。
 */
async function adapt_configuration(latest_task_configuration) {
	/** {Object}一般性設定。 general settings. */
	const { general } = latest_task_configuration;

	// Debug:
	CeL.log('Task configurations:');
	console.log(wiki.latest_task_configuration);
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

const task_name = '整理跨語言連結與 Wikimedia projects 連結';

let local_language_code;
/**
 * 測試文字是否與本地語言相同。
 * @param {String} text	欲測試的文字。
 * @param {String} specified_language_code	原連結所指定，`text` 的語言代碼。
 * @returns {Boolean} 若與本地語言相同，則回傳 true。
 */
function same_as_local_language(text, specified_language_code) {
	const full_language_code = CeL.guess_text_language(text.toString());
	if (full_language_code) {
		if (full_language_code.replace(/-.*$/, '') === local_language_code) {
			if (local_language_code === 'cmn' && specified_language_code === 'ja') {
				// 有時日文會被誤判為中文，這時不警告。
				return false;
			}
			return true;
		}
		return false;
	}

	if (/[^\w\d\s_\-–\\\/&:'"()\[\],.!×]/.test(text)) {
		// English?
		CeL.warn(`Cannot guess language of ${JSON.stringify(text)}.`);
	}
	return false;
}

async function main_process() {
	local_language_code = CeL.gettext.to_standard(use_language).replace(/-.*$/, '');
	let summary_prefix = CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title, task_name);

	await wiki.register_redirects(['Translating', 'Webarchive', 'Wayback'], { namespace: 'Template' });

	for await (const page_list of (debug_pages ? [debug_pages]
		: wiki.allpages({
			//apfrom: '乌尔都语维基百科',
			//namespace: 'category',
			//namespace: 'template',
			namespace: wiki.latest_task_configuration.general.namespace,
			batch_size: 100,
		}))) {

		await wiki.for_each_page(page_list, for_each_page, {
			no_message: true,
			redirects: false,
			summary: `${summary_prefix}: `,
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

	let changed_tokens = [];
	changed_tokens.remove_archive_template_count = 0;

	function check_external_link(external_link_token) {
		const interwiki_data = CeL.wiki.parse.interwiki_url(external_link_token, wiki.append_session_to_options({
			page_data,
			postfix_url(url) {
				// [[丘昌泰]]: [https://zh.wikipedia-on-ipfs.org/wiki/張四明 張四明]
				url = url.replace('.wikipedia-on-ipfs.org', '.wikipedia.org');
				// [[史托龍科]]: [https://en.m.wikipedia-mirror.org/wiki/Digital_object_identifier dio]
				url = url.replace('.wikipedia-mirror.org', '.wikipedia.org');
				return url;
			}
		}));
		if (!interwiki_data) {
			let url = external_link_token[0].url;
			url = url && CeL.URI(CeL.HTML_to_Unicode(url));
			const hostname = url && url.hostname;
			if (hostname && hostname.includes('wikipedia')
				// 不警告非 Wikimedia projects 維基姐妹計畫的網站網址。
				// [[最受欢迎网站列表]]: [https://Wikipedia.org wikipedia.org]
				&& !(hostname === 'wikipedia.org'
					// [[中国历史]]: [http://www.chinawikipedia.com/chinesehistorytimeline.html 中國歷史時間表]
					// [[安都陵]]: [http://www.chinawikipedia.com/chinahistory.html History of China:  A good catalogue of info]
					|| hostname.includes('.chinawikipedia.com')
					// [[亚伦·斯沃茨]]: [http://thewikipedian.net/2013/01/14/remembering-aaron-swartz/ 纪念亚伦斯沃]
					|| hostname.includes('.thewikipedian.net')
					// [[刻托]]: [https://www-loebclassics-com.wikipedialibrary.idm.oclc.org/view/hesiod-theogony/2018/pb_LCL057.21.xml 21&ndash;23]
					// [[伊里斯]]: [https://www-loebclassics-com.wikipedialibrary.idm.oclc.org/view/valerius_flaccus-argonautica/1934/pb_LCL286.191.xml 4.60-78 ff]
					// [[种族清洗]]: [https://wikipedialibrary.idm.oclc.org/login?auth=production&url=https://search.ebscohost.com/login.aspx?direct=true&db=hft&AN=509635905&site=eds-live&scope=site "Nagorno Karabakh: Forgotten People in a Forgotten War."]
					|| hostname.includes('wikipedialibrary.idm.oclc.org')
					// [[广州湾]]: [https://zh.wikipedia.ecnu.cf/w/index.php?title=%E5%B9%BF%E5%B7%9E%E6%B9%BE&direction=next&oldid=14679025#/media/File:Indochine_fran%C3%A7aise_(1913).jpg 1913年之法属印度支那及广州湾]
					|| hostname.includes('.wikipedia.ecnu.cf')
					// [[打印维基百科]]: [http://printwikipedia.com printwikipedia官方網站]
					|| hostname.includes('printwikipedia.com')
					// [[新格罗夫音乐与音乐家辞典]]: [https://wikipedialibrary.wmflabs.org/partners/90/ 维基百科图书馆：牛津音乐在线]
					|| hostname.includes('wikipedialibrary.wmflabs.org')
					// [[維基競賽]]: [http://wikipediagame.org The Wiki Game]
					|| hostname.includes('wikipediagame.org')
					// [[韓語維基百科]]: [//ko.wikipedia.com ko.wikipedia.com]
					|| hostname.includes('.wikipedia.com')
					// [[頁面存廢討論]]: [https://wikipediaart.org/legal/032309-Isenberg.pdf Giga Law Firm letter]
					|| hostname.includes('wikipediaart.org')
					// [[LibreOffice]]: [http://en.wikipedia.hfut.cf/wiki/Pylaia-Chortiatis Pylaia-Chortiatis]ct on the teacher]]  
					|| hostname.includes('.wikipedia.hfut.cf')
					// [[亚伦·斯沃茨]]: [http://thewikipedian.net/2013/01/14/remembering-aaron-swartz/ 纪念亚伦斯沃]
					|| hostname.includes('thewikipedian.net')
				)
			) {
				CeL.warn(`${CeL.wiki.title_link_of(page_data)}: Cannot parse ${external_link_token.toString()}`);
			}
			return;
		}

		if (interwiki_data.is_invalid_page_title) {
			return;
		}

		if (interwiki_data.is_interlanguage ? !wiki.latest_task_configuration.general.convert_interlanguage_links
			: interwiki_data.is_wiki_family ? !wiki.latest_task_configuration.general.convert_wiki_family_links
				: !wiki.latest_task_configuration.general.convert_non_local_interwiki_links
		) {
			return;
		}

		if (interwiki_data.wikilink) {
			CeL.log(`${CeL.wiki.title_link_of(page_data)}: ${interwiki_data.wikilink} ← ${external_link_token.toString()}`);
			const token = CeL.wiki.parse(interwiki_data.wikilink, wiki.append_session_to_options());
			token.changed = true;
			return token;
		}

		if (interwiki_data.url_magic_word && wiki.latest_task_configuration.general.convert_to_magic_word) {
			CeL.log(`${CeL.wiki.title_link_of(page_data)}: [${interwiki_data.url_magic_word}] ← ${external_link_token.toString()}`);
			external_link_token[0] = interwiki_data.url_magic_word + decodeURIComponent(interwiki_data.url.hash);
			external_link_token.changed = true;
			return external_link_token;
		}

	}

	function check_wikilink(link_token, index, parent_token) {
		if (!wiki.latest_task_configuration.general.convert_interlanguage_links_to_templates || !link_token.is_link || link_token.anchor) {
			return;
		}

		if (false) {
			// 問題並非出在位於 <ref> 中。
			// [[w:zh:Special:Diff/93081490]]
			let _parent_token = parent_token;
			while (_parent_token) {
				if (parent_token.type === 'tag' && parent_token.tag === 'ref') {
					return;
				}
				parent_token = parent_token.parent;
			}
		}

		const interwiki_data = CeL.wiki.parse.interwiki_link(link_token, wiki.append_session_to_options());
		if (!interwiki_data.interlanguage || !interwiki_data.interwiki
			// 非文章不採用 {{tsl}}
			|| interwiki_data.interlanguage.NAMESPACENUMBER
			// e.g., [[:zh:wikt:和稀泥|此處]]
			|| interwiki_data.interlanguage.wiki_family
			// e.g., [[s:es:Circular a las provincias del interior del 27 de mayo de 1810|1810年5月27日发给内陆各省的通知]] @ [[五月革命]]
			|| interwiki_data.interlanguage.prefix !== interwiki_data.interwiki.prefix
			// e.g., [[w:en:ABC]]
			&& !interwiki_data.localinterwiki_prefix) {
			return;
		}

		// console.trace(link_token.page_title.match(wiki.configurations.PATTERN_language_startup));
		// wiki.latest_site_configurations.interwikimap.mapper[interwiki_data.interwiki.prefix]

		function set_template(template_name) {
			const foreign_title = interwiki_data.interlanguage.title;
			if (same_as_local_language(foreign_title, interwiki_data.interlanguage.prefix)) {
				CeL.warn(`${CeL.wiki.title_link_of(page_data)}: 外語標題 ${JSON.stringify(foreign_title)} 似乎非外語，而是本地語言？`);
			}
			parameters = [template_name, interwiki_data.interlanguage.prefix, foreign_title];

			const display_text = link_token.display_text;
			if (display_text && display_text !== interwiki_data.interlanguage.title) {
				if (wiki.latest_task_configuration.general.detect_display_text_as_title
					&& typeof display_text === 'string'
					// e.g., 日語 原始数据
					&& !/維基|维基|百科|wiki|[語语]|数据|數據|資料/.test(display_text)
					// 若 display_text 與本地語言（中文）相同，則將之視為標題。
					&& same_as_local_language(display_text, interwiki_data.interlanguage.prefix)) {
					parameters[3] = display_text;
				} else {
					parameters[4] = display_text;
				}
			}
		}

		let parameters;
		switch (use_language) {
			case 'zh':
				// [[w:zh:Wikipedia:机器人/作业请求#請求建機器人批次處置不合規範的跨語言連結]]
				set_template('tsl');
				break;

			case 'en':
				break;

			case 'ja':
				break;

		}

		if (parameters) {
			const wikitext = CeL.wiki.parse.template_object_to_wikitext(parameters);
			CeL.log(`${CeL.wiki.title_link_of(page_data)}: ${link_token} → ${wikitext}`);
			const token = CeL.wiki.parse(wikitext, wiki.append_session_to_options());
			token.changed = true;
			return token;
		}
	}

	function check_archive_template(template_token, index, parent_token) {
		while (index > 0) {
			const previous_element = parent_token[--index];
			switch (previous_element.type) {
				case 'link':
				// TODO: test if the link target is the same as template_token

				case 'transclusion':
				// TODO: test if the target is the same as template_token

				case 'comment':
					continue;
			}

			if (typeof previous_element === 'string') {
				if (previous_element.trim())
					return;
				continue;
			}

			return;
		}
	}

	parsed.each((token, index, parent) => {
		let _changed;
		if (!token?.type && typeof token !== 'string') {
			// e.g., "'''b''bi'''i''"
			while (parent.parent?.toString().length < 200) {
				parent = parent.parent;
			}
			CeL.warn(`${CeL.wiki.title_link_of(page_data)}: Invalid wikitext? ${JSON.stringify(parent.toString())}`);
			return;
		}

		// 可能跑完 check_external_link() 後再跑 check_wikilink()，因此不能用 switch。
		if (token.type === 'external_link') {
			token = check_external_link(token) || token;
			if (token.changed) _changed = true;
		}

		if (token.type === 'link'
			// 不處理{{Translating}}中的 wikilinks，避免誤判。
			// e.g., [[1993年國際足協U-17世界錦標賽]]
			// token.parent: parameter_unit
			&& !wiki.is_template(token.parent?.parent, 'Translating')) {
			token = check_wikilink(token) || token;
			if (token.changed) _changed = true;
		}

		if (_changed) {
			changed_tokens.push(token);
			return token;
		}

		if (wiki.is_template(token, ['Webarchive', 'Wayback'])) {
			_changed = check_archive_template(token);
			if (_changed) {
				changed_tokens.remove_archive_template_count++;
				return remove_token;
			}
		}
	}, { modify: true, add_index: true });

	// ------------------------------------------------------------------------

	const summary_note = [];
	if (changed_tokens.remove_archive_template_count > 0) {
		//為何要移除存檔模板
		//這些存檔模板存檔的內容為 Wikimedia projects，且因其參照之 external link 轉為 wikilink 或模板，已不再更新而失去作用。
		summary_note.push(`移除${changed_tokens.remove_archive_template_count}個存檔模板`);
	}

	if (changed_tokens.length > 0) {
		summary_note.push(`(${changed_tokens.length}) ${changed_tokens.map(token => token.toString()).join(', ')}`);
	}

	if (summary_note.length === 0)
		return Wikiapi.skip_edit;

	this.summary += summary_note.join(', ');

	//return Wikiapi.skip_edit;
	return parsed.toString();
}
