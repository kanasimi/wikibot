/*

 2019/9/13 8:59:40	初版試營運

 @see 20160923.modify_link.リンク元修正.js	20170828.search_and_replace.js	20161112.modify_category.js
 @see https://www.mediawiki.org/wiki/Manual:Pywikibot/replace.py

TODO:
https://en.wikipedia.org/wiki/Wikipedia:AutoWikiBrowser/General_fixes
並非所有常規修補程序都適用於所有語言。

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loader.js');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

const remove_token = CeL.wiki.parser.parser_prototype.each.remove_token;

// Load modules.
CeL.run([
	// for CeL.assert()
	'application.debug.log']);

/** {String}預設之編輯摘要。總結報告。編集内容の要約。 */
let summary = '';
/** {String}section title of [[WP:BOTREQ]] */
let section_title = '';

/** {String|Number}revision id. {String}'old/new' or {Number}new */
let diff_id = 0;
/** {Object}pairs to replace. {move_from_link: move_to_link} */
let move_configuration = {};

// ---------------------------------------------------------------------//

/** @inner */
const DELETE_PAGE = Symbol('DELETE_PAGE');


/*
 * 
 * 文章名稱的改變，應考慮上下文的影響。例如： # 是否應採用 [[new|old]]: using {keep_title : true} to
 * preserve title displayed. Default: discard title # 檢查重定向："株式会社[[リクルート]]" →
 * "[[株式会社リクルート]]" instead of "株式会社[[リクルートホールディングス]]"
 * 
 * 作業時檢查是否已經更改過、或者應該更改確沒辦法更改的情況。
 * 
 * 作業完檢查リンク元
 * 
 */

// 2019/9/13 9:14:49
set_language('ja');
diff_id = 73931956;
section_title = '「大阪駅周辺バスのりば」改名に伴うリンク修正';
// 依頼内容:[[move_from_link]] → [[move_to_link]]への変更を依頼します。
move_configuration = { '大阪駅・梅田駅周辺バスのりば': '大阪駅周辺バスのりば' };


set_language('ja');
diff_id = 73650376;
section_title = 'リクルートの改名に伴うリンク修正';
move_configuration = {
	'リクルート': {
		move_from_link: 'リクルートホールディングス',
		keep_title: true
	}
};
// for 「株式会社リクルートホールディングス」の修正
diff_id = 74221568;
summary = '「株式会社リクルートホールディングス」の修正';
move_configuration = { 'リクルートホールディングス': '' };
//
diff_id = 74225967;
summary = 'リクルートをパイプリンクにする';
move_configuration = { 'リクルートホールディングス': '[[リクルートホールディングス|リクルート]]' };


diff_id = 73834996;
section_title = '「Category:時間別に分類したカテゴリ」のリンク元除去依頼';
summary = section_title.replace(/依頼$/, '');
move_configuration = { 'Category:時間別に分類したカテゴリ': 'Category:時間別分類' };

diff_id = 74082270;
section_title = 'Category:指標別分類系カテゴリ群の改名および貼り替え';
summary = '';
move_configuration = {
	'Category:言語別分類': {
		move_to_link: 'Category:言語別',
		do_move_page: { noredirect: true, movetalk: true }
	},
	// 'Category:時間別分類': 'Category:時間別'
};
move_configuration = async (wiki) => {
	const page_data = await wiki.page('Category‐ノート:カテゴリを集めたカテゴリ (分類指標別)/「○○別に分類したカテゴリ」の一覧');
	let configuration = Object.create(null);
	const page_configuration = CeL.wiki.parse_configuration(page_data);
	for (let pair of page_configuration['○○別に分類したカテゴリ系の改名対象候補（143件）']) {
		if (pair[1].startsWith(':Category')) {
			// Remove header ":"
			configuration[pair[0].replace(/^:/g, '')] = {
				move_to_link: pair[1].replace(/^:/g, ''),
				// do_move_page: { noredirect: true, movetalk: true }
			};
		}
	}
	return configuration;
};

set_language('en');
set_language('commons');
diff_id = 364966353;
section_title = 'Remove promotional link';
summary = undefined;
move_configuration = {
	'Category:Photographs by David Falkner': {
		text_processor(wikitext) {
			// `Made with Repix (<a href="http://repix.it" rel="noreferrer
			// nofollow">repix.it</a>)`
			return wikitext.replace(/[\s\n]*Made with Repix \([^)]*\)/g, '')
				.replace(/[\s\n]*<a\s+href=[^<>]+>[\s\S]+?<\/a\s*>/g, '');
		}
	}
};


set_language('ja');
diff_id = '74253402/74253450';
section_title = 'Portal:バス/画像一覧/年別 整理依頼';
summary = undefined;
move_configuration = {
	'Portal:バス/画像一覧/過去に掲載された写真/': {
		list_types: 'prefixsearch',
		text_processor(wikitext, page_data) {
			/** {Array} parsed page content 頁面解析後的結構。 */
			const parsed = page_data.parse();
			let changed;
			const replace_to = '{{Portal:バス/画像一覧/年別}}';
			parsed.each('table', function (token, index, parent) {
				if (token.toString().includes('[[Portal:バス/画像一覧/過去に掲載された写真/')) {
					if (changed) {
						// 每一頁面只更改一次。
						CeL.error('Had modified: ' + CeL.wiki.title_link_of(page_data));
						return;
					}
					parent[index] = replace_to;
					changed = true;
				}
			});
			if (!changed) {
				// verify
				if (!wikitext.includes(replace_to)) {
					CeL.error('Problematic page: Nothing to change: ' + CeL.wiki.title_link_of(page_data));
				}
				return wikitext;
			}
			return parsed.toString();
		}
	}
};


set_language('en');
set_language('commons');
diff_id = 365194769;
section_title = 'author field in info template';
summary = 'C.Suthorn wishes to change the author field of the files uploaded by himself';
move_configuration = {
	'Category:Files by C.Suthorn': {
		text_processor(wikitext, page_data) {
			const replace_from = '|author=[[c:Special:EmailUser/C.Suthorn|C.Suthorn]]';
			const replace_to = '|author={{User:C.Suthorn/author}}';

			let includes_from = wikitext.includes(replace_from);

			if (includes_from) {
			} else if (wikitext.includes('|Author=[[c:Special:EmailUser/C.Suthorn|C.Suthorn]]')) {
				includes_from = true;
				wikitext = wikitext.replace('|Author=[[c:Special:EmailUser/C.Suthorn|C.Suthorn]]', replace_to);
			} else if (wikitext.includes('|photographer=[[User:C.Suthorn|C.Suthorn]]')) {
				includes_from = true;
				wikitext = wikitext.replace('|photographer=[[User:C.Suthorn|C.Suthorn]]', replace_to);
			}

			const includes_to = wikitext.includes(replace_to);

			if (includes_from && !includes_to) {
				// new page to replace
				return wikitext.replace(replace_from, replace_to);
			}
			if (!includes_from && includes_to) {
				// modified
			} else {
				CeL.error('Problematic page: Nothing to change: ' + CeL.wiki.title_link_of(page_data));
			}
			return wikitext;
		},
		list_types: 'categorymembers',
		namespace: 'file',
		// 17000+ too many logs
		log_to: null
	}
};

set_language('ja');
diff_id = 74434567;
section_title = 'Template:基礎情報 アナウンサーの引数変更';
summary = undefined;
move_configuration = {
	'Template:基礎情報_アナウンサー': {
		// parameter updates [[for Template:]] and related
		// removal of deprecated parameters from [[Template:]]
		// 刪除模板中不推薦使用的參數
		replace_parameters: {
			// | 家族 = → | 著名な家族 = に変更。
			家族: value => {
				return { 著名な家族: value };
			}
		}
	}
};

set_language('ja');
diff_id = 74458022;
section_title = 'Template:全国大学保健管理協会の除去';
summary = '';
move_configuration = {
	'Template:全国大学保健管理協会': DELETE_PAGE,
	'Template:日本養護教諭養成大学協議会': DELETE_PAGE,
};

set_language('ja');
diff_id = '74488219/74495273';
section_title = '「ナサケの女〜国税局査察官〜」記事とノートの内部リンク修正依頼';
summary = '';
move_configuration = {
	'ナサケの女 〜国税局査察官〜': 'ナサケの女〜国税局査察官〜',
	'ノート:ナサケの女 〜国税局査察官〜': 'ノート:ナサケの女〜国税局査察官〜'
};

set_language('ja');
diff_id = 74547811;
section_title = 'Template:愛知学長懇話会などの除去';
summary = '';
move_configuration = {
	'Template:愛知学長懇話会': DELETE_PAGE,
};

set_language('ja');
diff_id = 74625844;
section_title = 'Wikipedia:削除依頼/大学テンプレート群関連';
summary = '';
move_configuration = {
	'Template:仏教系大学会議': DELETE_PAGE,
	'Template:日本私立医科大学協会': DELETE_PAGE,
	'Template:私立短期大学図書館協議会': DELETE_PAGE,
	'Template:日本私立短期大学協会': DELETE_PAGE,
};


set_language('zh');
diff_id = 56462719;
section_title = '请求删除多笔常见植物页面中标注为薛聪贤先生的参考来源';
summary = '刪除標註為薛聰賢先生的參考來源';
move_configuration = {
	'"薛聰賢"': {
		list_types: 'search',
		text_processor(wikitext, page_data) {
			/** {Array} parsed page content 頁面解析後的結構。 */
			const parsed = page_data.parse();
			let changed;
			parsed.each('template', function (token, index, parent) {
				if (token.name === 'Clref' && token.toString().includes('薛聰賢')) {
					// *{{clref|薛聰賢|2001|ref={{cite
					// isbn|9579745218|ref=harv|noedit}}}}
					changed = true;
					return remove_token;
				}
			});
			parsed.each('tag', function (token, index, parent) {
				if (token.tag === 'ref' && token.toString().includes('薛聰賢')) {
					// e.g., <ref name="薛">{{cite book
					// zh|title=《台灣蔬果實用百科第一輯》|author=薛聰賢|publisher=薛聰賢出版社|year=2001年|ISBN=957-97452-1-8}}</ref>
					// <ref name="薛">《台灣蔬果實用百科第二輯》，薛聰賢
					// 著，薛聰賢出版社，2001年，ISDN:957-97452-1-8</ref>
					// <ref>{{cite book |author = 薛聰賢 |title = 台灣原生植物景觀圖鑑(3)
					// |publisher = 台灣普綠 |date = 2005-01-30}}</ref>
					changed = true;
					return remove_token;
				}
			});
			parsed.each('template', function (token, index, parent) {
				if (token.name === 'Cite isbn' && (token.parameters[1] in { '9789577441379': true, '9579745218': true })) {
					// e.g., {{cite isbn|9789577441379|ref=harv|noedit}}
					// [[w:zh:Template:Cite_isbn/978957744137]]
					changed = true;
					return remove_token;
				}
				if (/\|\s*publisher\s*=\s*薛聰賢/.test(token.toString())) {
					// e.g., {{cite book zh |title=《台灣蔬果實用百科第一輯》 |author=薛聰賢
					// |publisher=薛聰賢出版社 |year=2001年 |ISBN = 957-97452-1-8 }}
					// {{cite
					// book|author=薛聰賢|year=2003|title=台灣原生景觀植物圖鑑1《蕨類植物‧草本植物》|publisher=薛聰賢|isbn=957-41-0968-2}}
					changed = true;
					return remove_token;
				}
			});
			wikitext = parsed.toString();
			wikitext = wikitext.replace(/\n\*[^\n]+?薛聰賢[^\n]+/g, function (all) {
				// e.g., *《台灣蔬果實用百科第三輯》，薛聰賢 著，薛聰賢出版社，2003年
				// * 薛聰賢 著：《台灣蔬果實用百科（第二輯）》，薛聰賢出版社，2001年
				// * 薛聰賢：《臺灣花卉實用圖鑑 3 球根花卉 多肉植物 150種》，臺灣：台灣普綠有限公司出版部，1996年 ISBN
				// 957-97021-0-1
				// *《台灣蔬果實用百科第一輯》，薛聰賢著，2001年
				changed = true;
				return '';
			});
			if (false)
				wikitext = wikitext.replace(/\n\*\s*\n/g, function (all) {
					changed = true;
					return '\n';
				});
			// verify
			if (wikitext.includes("薛聰賢")) {
				CeL.error('Problematic page: There are still tokens to replace: ' + CeL.wiki.title_link_of(page_data));
			}
			return wikitext;
		}
	}
};


set_language('en');
set_language('commons');
diff_id = 371760584;
section_title = 'Change CAT: to :CAT:';
summary = 'Change "CAT:" to ":CAT:": Any link to a CAT: shortcut has now become a categorization';
move_configuration = {
	'CAT': {
		move_from_link: /\[\[CAT *:/i,
		// search all namespaces
		namespace: '*',
		text_processor(wikitext, page_data) {
			return wikitext.replace(this.move_from_link, '[[:Category:');
		}
	}
};

set_language('ja');
diff_id = 74773136;
section_title = 'Category:日本の男性、女性YouTuber廃止に伴う除去依頼';
summary = null;
move_configuration = {
	move_to_link: 'Category:日本のYouTuber',
	text_processor(wikitext, page_data) {
		const main_category_name = this.move_from_page_name;
		const move_to_page_name = this.move_to_page_name;
		// console.log([main_category_name, move_to_page_name]);

		/** {Array} parsed page content 頁面解析後的結構。 */
		const parsed = page_data.parse();

		let token_日本のYouTuber, token_data_to_rename;
		parsed.each('category', function (token, index, parent) {
			// console.log(token);
			if (token.name === move_to_page_name) {
				token_日本のYouTuber = token;
				return;
			}
			if (token.name === main_category_name) {
				if (token_data_to_rename)
					CeL.error('Problematic page: There are more than one token to replace: ' + CeL.wiki.title_link_of(page_data));
				token_data_to_rename = [token, index, parent];
				return;
			}
		});
		if (!token_data_to_rename) {
			let changed;
			parsed.each('template', function (token, index, parent) {
				if (token.name === 'リダイレクトの所属カテゴリ') {
					token.forEach(function (parameter, index) {
						if (index > 0 && parameter.includes(main_category_name)) {
							token[index] = parameter.replace(main_category_name, move_to_page_name);
							changed = true;
						}
					});
				}
			});
			if (changed) {
				return parsed.toString();
			}

			CeL.error('Problematic page: There is no token to replace: ' + CeL.wiki.title_link_of(page_data));
			return;
		}

		// console.log(token_日本のYouTuber);
		// console.log(token_data_to_rename);
		if (token_日本のYouTuber) {
			// 既に [[Category:日本のYouTuber]] がある場合は[[Category:日本の男性YouTuber]] 及び
			// [[Category:日本の女性YouTuber]] を除去してください。
			CeL.wiki.parser.remove_token(token_data_to_rename[2], token_data_to_rename[1]);
		} else {
			// [[Category:日本のYouTuber]] へ変更
			token_data_to_rename[0][0][1] = move_to_page_name;
		}

		return parsed.toString();
	}
};
move_configuration = {
	'Category:日本の男性YouTuber': move_configuration,
	'Category:日本の女性YouTuber': move_configuration,
};


set_language('ja');
diff_id = '74813987/74814343';
section_title = 'Template:全国保育士養成協議会の除去';
summary = '';
move_configuration = {
	'Template:全国保育士養成協議会': DELETE_PAGE,
};


set_language('ja');
diff_id = 74823411;
section_title = 'ロサンゼルス・ラムズ';
summary = '2016年ロサンゼルスに復帰し、ロサンゼルス・ラムズとなった';
move_configuration = {
	'セントルイス・ラムズ': {
		move_to_link: 'ロサンゼルス・ラムズ',
		keep_title: true
	}
};


set_language('zh');
diff_id = 56927593;
section_title = '替换参数';
summary = '替換 cite 系列模板的舊參數 url-status';
move_configuration = {
	// https://zh.wikipedia.org/wiki/Template:Cite_web
	'替換 url-status 參數': {
		list_types: 'search',
		// insource:"url-status"
		move_from_link: 'insource:"url-status"',
		// search all namespaces
		// namespace: '*',
		text_processor(wikitext, page_data) {
			// console.log(wikitext);
			// console.log(page_data);
			return wikitext.replace(/(\|\s*)url-status(\s*=\s*)(dead|live)/g,
				(all, prefix, equal, status) => prefix + 'dead-url' + equal + (status === 'dead' ? 'yes' : 'no')
			).replace(/(\|\s*)url-status(\s*=\s*)(\||}})/g, '$3');
		}
	}
};


// ---------------------------------------------------------------------//

function for_each_link(token, index, parent) {
	// token: [ page_name, section_title, displayed_text ]
	let page_name = CeL.wiki.normalize_title(token[0].toString());
	if (page_name !== this.move_from_link) {
		return;
	}

	if (false) {
		// for 「株式会社リクルートホールディングス」の修正
		if (!token[2] && index > 0 && typeof parent[index - 1] === 'string' && parent[index - 1].endsWith('株式会社')) {
			// console.log(parent[index - 1]);
			// assert: "株式会社[[リクルートホールディングス]]"
			parent[index - 1] = parent[index - 1].replace('株式会社', '');
			parent[index] = '[[株式会社リクルート]]';
		}
		return;
	}

	// e.g., [[move_from_link]]
	// console.log(token);
	if (this.move_to_link === DELETE_PAGE) {
		CeL.assert(token[2] || !token[1] && this.move_from_ns === CeL.wiki.namespace('Main'));
		// 直接只使用 displayed_text。
		parent[index] = token[2] || token[0];

	} else if (!token[1] && CeL.wiki.normalize_title(token[2]) === this.move_to_link) {
		// e.g., [[move_from_link|move to link]] → [[move_to_link|move to link]]
		// → [[move to link]]
		token.pop();
		token[0] = this.move_to_link;

	} else {
		const matched = this.move_to_link.match(/^([^()]+) \([^()]+\)$/);
		if (matched) {
			// e.g., move_to_link: 'movie (1985)', 'movie (disambiguation)'
			// TODO
		}

		if (this.keep_title) {
			CeL.assert(this.move_from_ns === CeL.wiki.namespace('Main'));
			// 將原先的頁面名稱轉成顯示名稱。
			if (!token[1]) token[1] = '';
			// keep original title
			if (!token[2]) token[2] = token[0];
		}
		// 替換頁面。
		token[0] = this.move_to_link;
	}
}

const for_each_category = for_each_link;

// --------------------------------------------------------

function replace_link_parameter(value, parameter_name, template_token) {
	let move_from_link = this.move_from_link;
	let move_to_link = this.move_to_link;
	// 特別處理模板引數不加命名空間前綴的情況。
	if (template_token.name === 'Catlink') {
		move_from_link = move_from_link.replace(/^Category:/i, '');
		move_to_link = move_to_link.replace(/^Category:/i, '');
	}

	if (value && value.toString() === move_from_link) {
		// e.g., {{Main|move_from_link}}
		// console.log(template_token);
		return parameter_name + '=' + move_to_link;
	}

	if (!move_from_link.includes('#') && value && value.toString().startsWith(move_from_link + '#')) {
		// e.g., {{Main|move_from_link#section title}}
		return parameter_name + '=' + move_to_link + value.toString().slice(move_from_link.length);
	}
}

function check_link_parameter(template_token, parameter_name) {
	const attribute_text = template_token.parameters[parameter_name];
	if (!attribute_text) {
		if (parameter_name == 1) {
			CeL.warn('There is {{' + template_token.name + '}} without the first parameter.');
		}
		return;
	}

	CeL.wiki.parse.replace_parameter(template_token, parameter_name, replace_link_parameter.bind(this));
}

// templates that the first parament is displayed as link.
const first_link_template_hash = ''.split('|').to_hash();
// templates that ALL paraments are displayed as link.
const all_link_template_hash = 'Main|See|Seealso|See also|混同|Catlink'.split('|').to_hash();

function for_each_template(token, index, parent) {

	if (token.name === this.move_from_page_name) {
		if (CeL.is_Object(this.replace_parameters)) {
			CeL.wiki.parse.replace_parameter(token, this.replace_parameters);
		}
		if (this.move_to_link === DELETE_PAGE) {
			return remove_token;
		}
		if (this.move_to_page_name && this.move_from_ns === CeL.wiki.namespace('Template')) {
			// 直接替換模板名稱。
			token[0] = this.move_to_page_name;
			return;
		}
	}

	if (token.name in first_link_template_hash) {
		check_link_parameter.call(this, token, 1);
		return;
	}

	if (token.name in all_link_template_hash) {
		for (let index = 1; index < token.length; index++) {
			check_link_parameter.call(this, token, index);
		}
		return;
	}

	// https://ja.wikipedia.org/wiki/Template:Main2
	if (this.move_to_link && token.name === 'Main2'
		// [4], [6], ...
		&& token[2] && CeL.wiki.normalize_title(token[2].toString()) === this.move_from_link) {
		// e.g., {{Main2|案内文|move_from_link}}
		// console.log(token);
		token[2] = this.move_to_link;
		return;
	}

	if (this.move_to_page_name && token.name === 'Pathnav') {
		// e.g., {{Pathnav|主要カテゴリ|…|move_from_link}}
		// console.log(token);
		if (this.move_from_ns === this.page_data.ns) {
			token.forEach(function (value, index) {
				if (index > 0 && CeL.wiki.normalize_title(value.toString()) === this.move_from_page_name) {
					token[index] = this.move_to_page_name;
				}
			}, this);
		}
		return;
	}

	return;

	// old:
	if (token.name === 'Template:Category:日本の都道府県/下位') {
		// e.g., [[Category:北海道の市町村別]]
		// {{Template:Category:日本の都道府県/下位|北海道|[[市町村]]別に分類したカテゴリ|市町村別に分類したカテゴリ|市町村|*}}
		token.forEach(function (value, index) {
			if (index === 0) return;
			value = CeL.wiki.normalize_title(value.toString());
			if (value.endsWith('別に分類したカテゴリ')) {
				token[index] = value.replace(/別に分類したカテゴリ$/, '別');
			}
		}, this);
		return;
	}

}

function for_each_page(page_data) {
	// console.log(page_data.revisions[0].slots.main);

	if (this.text_processor) {
		return this.text_processor(page_data.wikitext, page_data);
	}

	if (false) {
		// for 「株式会社リクルートホールディングス」の修正
		if (page_data.revisions[0].user !== CeL.wiki.normalize_title(user_name)
			|| !page_data.wikitext.includes('株式会社[[リクルートホールディングス]]')) {
			return Wikiapi.skip_edit;
		}
	}

	if (false) {
		// for リクルートをパイプリンクにする
		if (page_data.revisions[0].user === CeL.wiki.normalize_title(user_name)) {
			return page_data.wikitext.replace(
				new RegExp(CeL.to_RegExp_pattern(CeL.wiki.title_link_of(this.move_from_link)), 'g'),
				this.move_to_link);
		}
		return Wikiapi.skip_edit;
	}


	/** {Array} parsed page content 頁面解析後的結構。 */
	const parsed = page_data.parse();
	// console.log(parsed);
	CeL.assert([page_data.wikitext, parsed.toString()], 'wikitext parser check');

	this.page_data = page_data;

	if (this.move_to_link) {
		parsed.each('link', for_each_link.bind(this));
		if (this.move_from_ns === CeL.wiki.namespace('Category')) {
			parsed.each('category', for_each_category.bind(this));
		}
	}
	parsed.each('template', for_each_template.bind(this));

	// return wikitext modified.
	return parsed.toString();
}

// リンク 参照読み込み 転送ページ
const default_list_types = 'backlinks|embeddedin|redirects|categorymembers'.split('|');

/** {String}default namespace to search and replace */
const default_namespace = 'main|file|module|template|category';
// 'talk|template_talk|category_talk'

async function main_move_process(options) {
	let list_types;
	if (typeof options.move_from_link === 'string') {
		list_types = options.move_from_link.startsWith('insource:') ? 'search' : options.list_types || default_list_types;
	} else if (CeL.is_RegExp(options.move_from_link)) {
		list_types = 'search';
	} else {
		throw new Error('Invalid move_from_link: ' + JSON.stringify(options.move_from_link));
	}

	if (typeof list_types === 'string') {
		list_types = list_types.split('|');
	}
	let list_options = {
		namespace: options.namespace || default_namespace
	};

	if (list_types.join() !== 'search') {
		// separate namespace and page name
		const matched = options.move_from_link.match(/^([^:]+):(.+)$/);
		const namespace = matched && CeL.wiki.namespace(matched[1]) || 0;
		options = {
			...options,
			move_from_ns: namespace,
			// page_name only
			move_from_page_name: namespace ? matched[2] : options.move_from_link,
		};
		if (options.move_to_link && options.move_to_link !== DELETE_PAGE) {
			// assert: typeof options.move_to_link === 'string'
			// get page_name only
			options.move_to_page_name = namespace ? options.move_to_link.replace(/^([^:]+):/, '') : options.move_to_link;
		}

		if (options.move_from_ns !== CeL.wiki.namespace('Category')) {
			list_types = list_types.filter(type => type !== 'categorymembers');
		}
	}

	let page_list = [];
	CeL.info('main_move_process: Get types: ' + list_types);
	// Can not use `list_types.forEach(async type => ...)`
	for (let type of list_types) {
		page_list.append(await wiki[type](options.move_from_link, list_options));
	}

	page_list = page_list.filter((page_data) => {
		return page_data.ns !== CeL.wiki.namespace('Wikipedia')
			&& page_data.ns !== CeL.wiki.namespace('User')
			// && !page_data.title.includes('/過去ログ')
			;
	});
	page_list = page_list.unique(page_data => page_data.title);
	// manually for debug
	// page_list = ['']
	// console.log(page_list);

	await wiki.for_each_page(
		page_list// .slice(0, 1)
		,
		for_each_page.bind(options),
		{
			// for 「株式会社リクルートホールディングス」の修正
			// for リクルートをパイプリンクにする
			// page_options: { rvprop: 'ids|content|timestamp|user' },
			log_to: 'log_to' in options ? options.log_to : log_to,
			summary
		});
}

async function prepare_operation() {
	const _summary = typeof summary === 'string' ? summary : section_title;
	section_title = section_title ? '#' + section_title : '';

	await wiki.login(user_name, user_password, use_language);

	if (typeof move_configuration === 'function') {
		move_configuration = await move_configuration(wiki);
		// console.log(move_configuration);
		// console.log(Object.keys(move_configuration));
		// throw Object.keys(move_configuration).length;
	}

	// Object.entries(move_configuration).forEach(main_move_process);
	for (let pair of (Array.isArray(move_configuration) ? move_configuration : Object.entries(move_configuration))) {
		const [move_from_link, move_to_link] = [pair[1].move_from_link || CeL.wiki.normalize_title(pair[0]), pair[1]];
		let options = CeL.is_Object(move_to_link)
			? move_to_link.move_from_link ? move_to_link : { move_from_link, ...move_to_link }
			// assert: typeof move_to_link === 'string'
			: { move_from_link, move_to_link };

		const _log_to = 'log_to' in options ? options.log_to : log_to;
		// summary = null, undefined : using section_title as summary
		// summary = '' : auto-fill summary with page-to-delete + '改名に伴うリンク修正'
		if (_summary) {
			summary = _summary;
		} else if (options.move_to_link === DELETE_PAGE) {
			if (typeof move_from_link === 'string') {
				summary = CeL.wiki.title_link_of(move_from_link) + 'の除去';
			} else {
				// e.g., /\[\[CAT *:/i
			}
		} else {
			summary = CeL.wiki.title_link_of(options.move_to_link)
				// の記事名変更に伴うリンクの修正 カテゴリ変更依頼
				+ '改名に伴うリンク修正';
		}
		summary = CeL.wiki.title_link_of(diff_id ? 'Special:Diff/' + diff_id + section_title : 'WP:BOTREQ',
			use_language === 'zh' ? '機器人作業請求'
				: use_language === 'ja' ? 'Bot作業依頼' : 'Bot request')
			+ ': ' + summary
			+ (_log_to ? ' - ' + CeL.wiki.title_link_of(_log_to, 'log') : '');

		if (options.do_move_page) {
			if (typeof move_from_link !== 'string') {
				throw new Error('`move_from_link` should be {String}!');
			}
			// 作業前先移動原頁面。
			options.do_move_page = { reason: summary, ...options.do_move_page };
			try {
				const page_data = await wiki.page(move_from_link);
				if (!page_data.missing) {
					// カテゴリの改名も依頼に含まれている
					await wiki.move_to(options.move_to_link, options.do_move_page);
				}
			} catch (e) {
				if (e.code !== 'missingtitle' && e.code !== 'articleexists') {
					if (e.code) {
						CeL.error('[' + e.code + '] ' + e.info);
					} else {
						console.error(e);
					}
					// continue;
				}
			}
		}

		await main_move_process(options);
	}
}

(async () => {
	await prepare_operation();
})();
