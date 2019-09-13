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

/** {String|Number}revision id.  {String}'old/new' or {Number}new */
let diff_id = 0;
/** {Object}pairs to replace. {move_from_link: move_to_link} */
let move_pair = {};

// ---------------------------------------------------------------------//

// 2019/9/13 9:14:49
set_language('ja');
diff_id = 73931956;
section_title = '「大阪駅周辺バスのりば」改名に伴うリンク修正';
// 依頼内容:[[move_from_link]] → [[move_to_link]]への変更を依頼します。
move_pair = { '大阪駅・梅田駅周辺バスのりば': '大阪駅周辺バスのりば' };


set_language('ja');
diff_id = 73650376;
section_title = 'リクルートの改名に伴うリンク修正';
move_pair = { 'リクルート': 'リクルートホールディングス' };
// for 「株式会社リクルートホールディングス」の修正
diff_id = 74221568;
section_title = 'リクルートの改名に伴うリンク修正';
summary = '「株式会社リクルートホールディングス」の修正';
move_pair = { 'リクルートホールディングス': '' };


diff_id = 73834996;
section_title = '「Category:時間別に分類したカテゴリ」のリンク元除去依頼';
summary = section_title.replace(/依頼$/, '');
move_pair = { 'Category:時間別に分類したカテゴリ': 'Category:時間別分類' };

diff_id = 74082270;
section_title = 'Category:指標別分類系カテゴリ群の改名および貼り替え';
summary = '';
move_pair = { 'Category:言語別分類': 'Category:言語別' };


// ---------------------------------------------------------------------//

// templates that the paraments will display as link.
const link_template_hash = 'Main|See|Seealso|See also'.split('|').to_hash();

function for_each_link(token, index, parent) {
	// token: [ page_name, section_title, displayed_text ]
	let page_name = token[0].toString().trim();
	if (Array.isArray(token[0]) && token[0][0].toString().trim() === '') {
		page_name = page_name.replace(/^:\s*/, '');
	}
	if (page_name !== this.move_from_link) {
		return;
	}

	if (false) {
		// for 「株式会社リクルートホールディングス」の修正
		if (!token[2] && index > 0 && typeof parent[index - 1] === 'string' && parent[index - 1].endsWith('株式会社')) {
			//console.log(parent[index - 1]);
			// assert: "株式会社[[リクルートホールディングス]]"
			parent[index - 1] = parent[index - 1].replace('株式会社', '');
			parent[index] = '[[株式会社リクルート]]';
		}
		return;
	}

	//e.g., [[move_from_link]]
	//console.log(token);
	if (!token[1] && token[2] === this.move_to_link) {
		token.truncate();
		token[0] = this.move_to_link;
	} else {
		const matched = this.move_to_link.match(/^([^()]+) \([^()]+\)$/);
		if (matched) {
			//TODO
		}
		token[0] = this.move_to_link;
	}
}

function for_each_template(token) {

	if (token.name in link_template_hash) {
		if (!token[1]) {
			CeL.warn('There is {{' + token.name + '}} without the link parameter.');
		}
		let value = token[1] && token[1].toString().trim();
		if (value === this.move_from_link) {
			// e.g., {{Main|move_from_link}}
			//console.log(token);
			token[1] = this.move_to_link;
		}
		if (!this.move_from_link.includes('#') && value.startsWith(this.move_from_link + '#')) {
			// e.g., {{Main|move_from_link#section title}}
			token[1] = this.move_to_link + value.slice(this.move_from_link.length);
		}
		return;
	}

	// https://ja.wikipedia.org/wiki/Template:Main2
	if (token.name === 'Main2'
		// [4], [6], ...
		&& token[2] && token[2].toString().trim() === this.move_from_link) {
		// e.g., {{Main2|案内文|move_from_link}}
		//console.log(token);
		token[2] = this.move_to_link;
		return;
	}

	if (token.name === 'Pathnav') {
		// e.g., {{Pathnav|主要カテゴリ|…|move_from_link}}
		//console.log(token);

		// separate namespace and page name
		const matched = this.move_from_link.match(/^([^:]+):(.+)$/);
		const namespace = matched && CeL.wiki.namespace(matched[1]) || 0;

		if (namespace === this.page_data.ns) {
			const page_name = namespace ? matched[2] : this.move_from_link;
			const to_page_name = namespace ? this.move_to_link.replace(/^([^:]+):/, '') : this.move_to_link;

			token.forEach(function (value, index) {
				if (index > 0 && value.toString().trim() === page_name) {
					token[index] = to_page_name;
				}
			}, this);
		}
		return;
	}
}

function for_each_page(page_data) {
	//console.log(page_data.revisions[0].slots.main);

	if (false) {
		// for 「株式会社リクルートホールディングス」の修正
		if (page_data.revisions[0].user !== CeL.wiki.normalize_title(user_name)
			|| !page_data.wikitext.includes('株式会社[[リクルートホールディングス]]')) {
			return;
		}
	}

	/** {Array}頁面解析後的結構。 */
	const parsed = page_data.parse();
	//console.log(parsed);
	CeL.assert([page_data.wikitext, parsed.toString()], 'wikitext parser check');

	this.page_data = page_data;

	parsed.each('link', for_each_link.bind(this));
	parsed.each('template', for_each_template.bind(this));

	// return wikitext modified.
	return parsed.toString();
}

async function main_move_process(options) {
	const page_list = (await wiki.backlinks(options.move_from_link, {
		namespace: 'main|module|template|category',
		//namespace: 'talk|template_talk|category_talk',
	})).filter(function (page_data) {
		return page_data.ns !== CeL.wiki.namespace('Wikipedia')
			&& page_data.ns !== CeL.wiki.namespace('User')
			//過去ログ
			//&& !page_data.title.includes('ログ')
			;
	});
	//console.log(page_list);

	await wiki.for_each_page(
		page_list.slice(0, 1)
		,
		for_each_page.bind(options),
		{
			// for 「株式会社リクルートホールディングス」の修正
			//page_options: { rvprop: 'ids|content|timestamp|user' },
			log_to,
			summary
		});
}

(async () => {
	const _summary = typeof summary === 'string' ? summary : section_title;
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
