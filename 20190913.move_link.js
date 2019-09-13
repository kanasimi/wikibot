// cd /d D:\USB\cgi-bin\program\wiki && node 20190913.move_link.js

/*

 2019/9/13 8:59:40	初版試營運

 @see 20160923.modify_link.リンク元修正.js	20170828.search_and_replace.js	20161112.modify_category.js

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loader.js');
// Load wikiapi module.
const Wikiapi = require('wikiapi');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;


// Load modules.
CeL.run([
	// for CeL.assert()
	'application.debug.log']);

/** {String}預設之編輯摘要。總結報告。編集内容の要約。 */
let summary = '';
/** {String}section title of [[WP:BOTREQ]] */
let section_title = '';

// 'old/new'
let diff_id = 0;
let move_pair = {};

// ---------------------------------------------------------------------//

set_language('ja');

// 2019/9/13 9:14:49
diff_id = 73931956;
section_title = '「大阪駅周辺バスのりば」改名に伴うリンク修正';
// 依頼内容:[[move_from_link]] → [[move_to_link]]への変更を依頼します。
move_pair = { '大阪駅・梅田駅周辺バスのりば': '大阪駅周辺バスのりば' };


// ---------------------------------------------------------------------//

function for_each_link(token) {
	if (token[0].toString().trim() === this.move_from_link) {
		//e.g., [[move_from_link]]
		//console.log(token);
		token[0] = this.move_to_link;
	}
}

function for_each_template(token) {
	if (token.name === 'Main' && token[1].toString().trim() === this.move_from_link) {
		// e.g., {{Main|move_from_link}}
		//console.log(token);
		token[1] = this.move_to_link;
		return;
	}

	if (token.name === 'Pathnav') {
		// e.g., {{Pathnav|主要カテゴリ|…|move_from_link}}
		//console.log(token);
		token.forEach(function (value, index) {
			if (index > 0 && value.toString().trim() === this.move_from_link) {
				token[index] = this.move_to_link;
			}
		});
		return;
	}
}

function for_each_page(page_data) {
	/** {Array}頁面解析後的結構。 */
	const parsed = page_data.parse();
	//console.log(parsed);
	CeL.assert([page_data.wikitext, parsed.toString()], 'wikitext parser check');

	parsed.each('link', for_each_link.bind(this));
	parsed.each('template', for_each_template.bind(this));

	// return wikitext modified.
	return parsed.toString();
}

async function main_move_process(options) {
	const page_list = await wiki.backlinks(options.move_from_link, {
		namespace: '0|1',
	}).map(function (page_data) {
		return page_data.ns !== CeL.wiki.namespace('Wikipedia');
	});
	//console.log(page_list);
	await wiki.for_each_page(
		page_list.slice(0, 1)
		,
		for_each_page.bind(options),
		{
			log_to,
			summary
		});
}

(async () => {
	const _summary = summary || section_title;
	section_title = section_title ? '#' + section_title : '';

	await wiki.login(user_name, user_password, use_language);

	//Object.entries(move_pair).forEach(main_move_process);
	for (let pair of Object.entries(move_pair)) {
		const [move_from_link, move_to_link] = pair;
		summary = CeL.wiki.title_link_of(diff_id ? 'Special:Diff/' + diff_id + section_title : 'WP:BOTREQ',
			use_language === 'ja' ? 'Bot作業依頼'
				: use_language === 'zh' ? '機器人作業請求' : 'Bot request')
			+ ': ' + (_summary || CeL.wiki.title_link_of(move_to_link)
				// の記事名変更に伴うリンクの修正 カテゴリ変更依頼
				+ '改名に伴うリンク修正')
			+ ' - ' + CeL.wiki.title_link_of(log_to, 'log');

		await main_move_process({ move_from_link, move_to_link });
	}
})();
