// cd /d D:\USB\cgi-bin\program\wiki && node 20190913.move_link.js

/*

 2019/9/13 8:59:40	初版試營運

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loader.js');
// Load wikiapi module.
const Wikiapi = require('wikiapi');

// Set default language. 改變預設之語言。 e.g., 'zh'
// 採用這個方法，而非 Wiki(true, 'ja')，才能夠連報告介面的語系都改變。
set_language('ja');

// Load modules.
CeL.run([
	// for CeL.assert()
	'application.debug.log']);

// ---------------------------------------------------------------------//

const summary = '[[Special:Diff/73931956|Bot作業依頼]]：[[大阪駅周辺バスのりば]]改名に伴うリンク修正';

// 依頼内容:[[move_from_link]] → [[move_to_link]]への変更を依頼します。
const move_from_link = '大阪駅・梅田駅周辺バスのりば';
const move_to_link = '大阪駅周辺バスのりば';

function for_each_link(token) {
	if (token[0].toString() === move_from_link) {
		//e.g., [[move_from_link]]
		//console.log(token);
		token[0] == move_to_link;
	}
}

function for_each_template(token) {
	if (token.name === 'Main' && token[1] === move_from_link) {
		// e.g., {{Main|move_from_link}}
		//console.log(token);
		token[1] = move_to_link;
	}
}

function for_each_page(page_data) {
	/** {Array}頁面解析後的結構。 */
	const parsed = page_data.parse();
	//console.log(parsed);
	CeL.assert([page_data.wikitext, parsed.toString()], 'wikitext parser check');

	parsed.each('link', for_each_link);
	parsed.each('template', for_each_template);

	// return wikitext modified.
	return parsed.toString();
}

(async () => {
	/** {Object}wiki operator 操作子. */
	const wiki = new Wikiapi;
	await wiki.login(user_name, user_password, 'ja');

	const page_list = await wiki.backlinks(move_from_link);
	//console.log(page_list);
	await wiki.for_each_page(
		page_list.slice(0, 1)
		,
		for_each_page, {
			log_to,
			summary
		});
})();
