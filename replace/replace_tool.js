/*

 2019/9/13 8:59:40	初版試營運
 2019/12/21 4:12:49	模組化

 @see 20160923.modify_link.リンク元修正.js	20170828.search_and_replace.js	20161112.modify_category.js
 @see https://www.mediawiki.org/wiki/Manual:Pywikibot/replace.py

TODO:
https://en.wikipedia.org/wiki/Wikipedia:AutoWikiBrowser/General_fixes
並非所有常規修補程序都適用於所有語言。

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Load modules.
CeL.run([
	// for CeL.assert()
	'application.debug.log']);


// 20190913.replace.js
log_to = log_to.replace(/\d+$/, 20190913);
const bot_requests_page = 'WP:BOTREQ';

// global variables using in move_configuration
const DELETE_PAGE = Symbol('DELETE_PAGE');
const remove_token = CeL.wiki.parser.parser_prototype.each.remove_token;

// ---------------------------------------------------------------------//

/**
 * Main entry point to replace wiki pages.
 * 
 * @param {Object|String}meta_configuration {
 *            {String}summary 預設之編輯摘要。總結報告。編集内容の要約。,<br />
 *            {String|Number}diff_id revision id.<br />
 *            diff_id: {String}'small_oldid/big_new_diff' or {Number}new_diff,<br />
 *            {String}section_title section title of [[WP:BOTREQ]]<br />
 *            ... }
 * @param {Object}move_configuration
 *            pairs to replace. { {String}move_from_link: move_to_link, ... }
 */
async function replace_tool(meta_configuration, move_configuration) {
	if (typeof meta_configuration === 'string') {
		meta_configuration = {
			summary: meta_configuration
		}
	} else {
		meta_configuration = CeL.setup_options(meta_configuration);
	}

	let original_language;
	if (meta_configuration.language) {
		original_language = use_language;
		// Set default language. 改變預設之語言。 e.g., 'zh'
		set_language(meta_configuration.language);
	}

	await prepare_operation(meta_configuration, move_configuration);

	if (original_language) {
		// revert changes
		use_language = original_language;
	}
}

// ---------------------------------------------------------------------//

// 從已知資訊解開並自動填寫 `meta_configuration`
async function guess_and_fulfill_meta_configuration(wiki, meta_configuration) {
	// 可省略 `section_title` 的條件: 檔案名稱即 section_title
	if (!meta_configuration.section_title) {
		if (script_name) {
			CeL.info(`Get section title from task file name: ${script_name}`);
			meta_configuration.section_title = script_name;
		} else {
			throw new Error('Can not extract section title from task file name!');
		}
	}

	// 可省略 `diff_id` 的條件: 以新章節增加請求，且編輯摘要包含 `/* section_title */`
	let section_title = meta_configuration.section_title;
	if (!meta_configuration.diff_id) {
		if (section_title) {
			// TODO: get diff_id from content
			const bot_requests_page_data = await wiki.page(bot_requests_page, {
				redirects: 1,
				// rvprop: 'ids|comment|user|content',
				rvprop: 'ids|comment|user',
				// rvlimit: 'max',
				rvlimit: 80,
			});
			let user, diff_to, diff_from;
			bot_requests_page_data.revisions.forEach(revision => {
				const comment = section_title === script_name
					// 去掉檔名中不能包含的字元。
					? revision.comment.replace(/:/g, '') : revision.comment;
				// console.log(section_title);
				// console.log(comment);
				const matched = comment.match(/^\/\*(.+)\*\//);
				// console.log(matched);
				if (matched && matched[1].includes(section_title)) {
					// console.log(revision);
					if (user === revision.user && diff_to > 0) {
						diff_from = revision.parentid;
						// At last, diff_from should starts
						// from e.g., "→‎鈴木正人のリンク修正: 新しい節"
					} else {
						user = revision.user;
						diff_to = revision.revid;
						// diff_from = revision.parentid;
						diff_from = null;
					}

					if (section_title === script_name) {
						// 復原檔名中不能包含的字元。
						const _section_title = revision.comment.match(/^\/\*(.+)\*\//)[1].trim();
						// console.log([section_title, _section_title]);
						if (section_title !== _section_title) {
							CeL.info(`Change section_title: ${section_title}→${_section_title}`);
							// TODO: parse
							section_title = meta_configuration.section_title = _section_title;
						}
					}
				} else {
					user = null;
				}
			});
			if (diff_to > 0) {
				meta_configuration.diff_id = diff_from > 0 ? diff_from + '/' + diff_to : diff_to;
				CeL.info(`Get diff_id from edit summary: [[Special:Diff/${meta_configuration.diff_id}#${section_title}]]`);
			} else {
				throw new Error(`Can not extract diff id from ${CeL.wiki.title_link_of(bot_requests_page)} edit summary!`);
			}

		} else {
			CeL.error(`Did not set diff_id!`);
		}
	}

	// throw new Error(section_title);
}

// auto-notice: start to edit
async function note_to_edit(wiki, meta_configuration) {
	const bot_requests_page_data = await wiki.page(bot_requests_page, { redirects: 1 });
	/** {Array} parsed page content 頁面解析後的結構。 */
	const parsed = bot_requests_page_data.parse();
	let need_edit;

	const section_title = meta_configuration.section_title;
	//console.log(section_title);
	parsed.each_section(section => {
		//console.log(section.section_title && section.section_title.link[1]);
		if (!section.section_title || !section.section_title.link[1].includes(section_title)) {
			return;
		}
		// console.log(section.toString());
		let PATTERN = /\n[:* ]*{{BOTREQ\|作業中}}/i;
		// PATTERN =
		// new RegExp(PATTERN.source + ' .+?' + user_name, PATTERN.flags);
		if (PATTERN.test(section.toString())) {
			CeL.info(`Already noticed: ${section_title}`);
			return;
		}
		// assert: parsed[section.range[1] - 1] ===section[section.length - 1]
		parsed[section.range[1] - 1] += '\n* {{BOTREQ|作業中}} --~~~~';
		need_edit = true;
	});

	if (need_edit) {
		await wiki.edit_page(bot_requests_page, parsed.toString(), {
			redirects: 1,
			summary: 'Starting bot request task: ' + section_title
		});
	}
}

async function prepare_operation(meta_configuration, move_configuration) {
	/** {Object}wiki operator 操作子. */
	const wiki = new Wikiapi;

	await wiki.login(user_name, user_password, use_language);

	await guess_and_fulfill_meta_configuration(wiki, meta_configuration);

	await note_to_edit(wiki, meta_configuration);

	// 解構賦值 `({ a, b, c = 3 } = { a: 1, b: 2 })`
	const { summary, section_title } = meta_configuration;
	const _summary = typeof summary === 'string' ? summary : section_title;
	const _section_title = section_title ? '#' + section_title : '';

	if (typeof move_configuration === 'function') {
		move_configuration = await move_configuration(wiki);
		// console.log(move_configuration);
		// console.log(Object.keys(move_configuration));
		// throw Object.keys(move_configuration).length;
	}

	// Object.entries(move_configuration).forEach(main_move_process);
	for (let pair of (Array.isArray(move_configuration) ? move_configuration : Object.entries(move_configuration))) {
		const [move_from_link, move_to_link] = [pair[1].move_from_link || CeL.wiki.normalize_title(pair[0]), pair[1]];
		const task_configuration = CeL.is_Object(move_to_link)
			? move_to_link.move_from_link ? move_to_link : { move_from_link, ...move_to_link }
			// assert: typeof move_to_link === 'string'
			: { move_from_link, move_to_link };

		if (!('keep_title' in task_configuration) && typeof task_configuration.move_to_link === 'string'
			// e.g., 20200101.ブランドとしてのXboxの記事作成に伴うリンク修正.js
			&& (task_configuration.move_to_link.includes(move_from_link)
				// e.g., 20200121.「離陸決心速度」の「V速度」への統合に伴うリンク修正.js
				|| task_configuration.move_to_link.includes('#')
			)) {
			CeL.warn('prepare_operation: Set .keep_title = true. 請注意可能有錯誤的 redirect、{{Pathnav}}、{{Main2}}、{{Navbox}} 等編輯!');
			task_configuration.keep_title = true;
		}

		const _log_to = 'log_to' in task_configuration ? task_configuration.log_to : log_to;
		// summary = null, undefined : using section_title as summary
		// summary = '' : auto-fill summary with page-to-delete + '改名に伴うリンク修正'
		if (_summary) {
			task_configuration.summary = _summary;
		} else if (task_configuration.move_to_link === DELETE_PAGE) {
			if (typeof move_from_link === 'string') {
				task_configuration.summary = CeL.wiki.title_link_of(move_from_link) + 'の除去';
			} else {
				// e.g., /\[\[CAT *:/i
			}
		} else {
			if (use_language !== 'ja' && typeof move_from_link === 'string' && typeof task_configuration.move_to_link === 'string') {
				// `Moving ${CeL.wiki.title_link_of(move_from_link)}
				// to
				// ${CeL.wiki.title_link_of(task_configuration.move_to_link)}`
				task_configuration.summary = `[[${move_from_link}]]→[[${task_configuration.move_to_link}]]`;
			} else {
				task_configuration.summary = CeL.wiki.title_link_of(task_configuration.move_to_link)
					// の記事名変更に伴うリンクの修正 カテゴリ変更依頼
					+ '改名に伴うリンク修正';
			}
		}

		let { diff_id } = meta_configuration;
		if (diff_id > 0) {
			diff_id = +diff_id;
		} else if (Array.isArray(diff_id) && diff_id.length === 2) {
			diff_id = diff_id.sort().join('/');
		}
		if (typeof diff_id === 'string') {
			diff_id = diff_id.match(/^(\d+)\/(\d+)$/);
			if (!diff_id) {
				CeL.warn(`prepare_operation: Invalid diff_id: ${diff_id}`);
			} else if (diff_id[1] > diff_id[2]) {
				CeL.warn(`prepare_operation: Swap diff_id: ${diff_id[0]}`);
				diff_id = `${diff_id[2]}/${diff_id[1]}/`;
			} else if (diff_id[1] === diff_id[2]) {
				CeL.warn(`prepare_operation: Using diff_id: ${diff_id[1]}`);
				diff_id = diff_id[1];
			} else {
				diff_id = diff_id[0];
			}
		} else if (meta_configuration.speedy_criteria) {
		} else if (typeof diff_id !== 'number' || !(diff_id > 0) || Math.floor(diff_id) !== diff_id) {
			CeL.warn(`prepare_operation: Invalid diff_id: ${diff_id}`);
		}
		task_configuration.summary = CeL.wiki.title_link_of(
			diff_id ? `Special:Diff/${diff_id}${_section_title}`
				// Speedy renaming or speedy merging
				: meta_configuration.speedy_criteria === 'merging' ? 'WP:CFDS'
					: 'WP:BOTREQ',
			// [[Wikipedia:Categories for discussion/Speedy]]
			// Speedy renaming or speedy merging
			meta_configuration.speedy_criteria ? 'Speedy ' + meta_configuration.speedy_criteria
				: use_language === 'zh' ? '機器人作業請求'
					: use_language === 'ja' ? 'Bot作業依頼' : 'Bot request')
			+ ': ' + (task_configuration.summary || summary)
			+ (_log_to ? ' - ' + CeL.wiki.title_link_of(_log_to, 'log') : '');

		if (task_configuration.do_move_page) {
			if (typeof move_from_link !== 'string') {
				throw new Error('`move_from_link` should be {String}!');
			}
			// 作業前先移動原頁面。
			task_configuration.do_move_page = {
				reason: task_configuration.summary,
				...task_configuration.do_move_page
			};
			try {
				const page_data = await wiki.page(move_from_link);
				if (!page_data.missing) {
					// カテゴリの改名も依頼に含まれている
					await wiki.move_to(task_configuration.move_to_link, task_configuration.do_move_page);
				}
			} catch (e) {
				if (e.code !== 'missingtitle' && e.code !== 'articleexists') {
					if (e.code) {
						CeL.error(`[${e.code}] ${e.info}`);
					} else {
						console.error(e);
					}
					// continue;
				}
			}
		}

		task_configuration.wiki = wiki;
		await main_move_process(task_configuration);
	}
}


// separate namespace and page name
function parse_move_link(link, session) {
	// /^(?<namespace>[^:]+):(?<page_name>.+)$/
	const matched = typeof link === 'string' && link.trim().match(/^((?:([^:]+):)?([^#\|]+))(?:#([^\|]*))?(?:\|(.*))?$/);
	if (!matched)
		return;

	return {
		// "ns:page_name#anchor|display_text"
		// link: matched[0],

		// page_title: 'ns:page_name'
		page_title: matched[1],
		// namespace
		ns: session ? session.namespace(matched[2]) || session.namespace('Main') : CeL.wiki.namespace(matched[2]) || CeL.wiki.namespace('Main'),
		// page name only, without namespace
		page_name: matched[3],
		// anchor without '#'
		anchor: matched[4],
		display_text: matched[5]
	};
}

// ----------------------------------------------

// as task_configuration.text_processor()
function text_processor_for_search(wikitext, page_data) {
	return wikitext.replace(this.replace_from, this.move_to_link);
}

// ------------------------------------

function remove_slash_tail(url) {
	// 'http://www.example.com/' → 'http://www.example.com'
	return /:\/\/[^\/\s]+\/$/.test(url) ? url.replace(/\/$/, '')
		// e.g., 'http://www.example.com/path/' → no change
		: url;
}

// replace_external_link: as task_configuration.text_processor()
function text_processor_for_exturlusage(wikitext, page_data) {
	const move_from_link = remove_slash_tail(this.move_from_link);
	const move_to_link = remove_slash_tail(this.move_to_link || this.move_to_url);

	if (!this.external_link_only) {
		// .all_link_pattern
		// [\/]: 避免 https://web.archive.org/web/000000/http://www.example.com/
		// TODO: flag: 'ig'
		const PATTERN = new RegExp('(^|[^\w\/])' + CeL.to_RegExp_pattern(move_from_link), 'g');
		return wikitext.replace(PATTERN, '$1' + move_to_link);
	}

	/** {Array} parsed page content 頁面解析後的結構。 */
	const parsed = page_data.parse();
	let changed;
	parsed.each('external_link', link_token => {
		const link = link_token[0].toString();
		if (link.includes(move_from_link)) {
			link_token[0] = link.replace(move_from_link, move_to_link);
			changed = true;
		}
	});

	wikitext = parsed.toString();
	if (wikitext.includes(move_from_link)) {
		// e.g., {{Cite web|url=...}}
		CeL.warn(`text_processor_for_exturlusage: There is still "${move_from_link}" left!`);
	}
	if (changed)
		return wikitext;
}

// ----------------------------------------------

// リンク 参照読み込み 転送ページ
const default_list_types = 'backlinks|embeddedin|redirects|categorymembers'.split('|');

/** {String}default namespace to search and replace */
const default_namespace = 'main|file|module|template|category';
// 'talk|template_talk|category_talk'

async function main_move_process(task_configuration) {
	const wiki = task_configuration.wiki;

	let list_types;
	if (task_configuration.list_types) {
		// empty, using page_list to debug: list_types:[],
		list_types = task_configuration.list_types;
	} else if (CeL.is_RegExp(task_configuration.move_from_link)) {
		list_types = 'search';
	} else if (typeof task_configuration.move_from_link !== 'string') {
		throw new Error(`Invalid move_from_link: ${JSON.stringify(task_configuration.move_from_link)}`);
	} else if (/^-?(?:insource|intitle|incategory|linksto|hastemplate|namespace|prefix|deepcat|inlanguage|contentmodel|subpageof|morelike|prefer-recent|neartitle|boost-neartitle|filemime|filesize|filew|filewidth|fileh|fileheight|fileres|filebits):/.test(task_configuration.move_from_link)) {
		list_types = 'search';
	} else if (/^https?:\/\//.test(task_configuration.move_from_link)) {
		// should have task_configuration.text_processor()
		list_types = 'exturlusage';
	} else if (!task_configuration.move_to_link && task_configuration.for_template) {
		// replace template only.
		list_types = 'embeddedin';
	} else {
		list_types = default_list_types;
	}

	if (typeof list_types === 'string') {
		list_types = list_types.split('|');
	}
	let list_options = {
		// combine_pages: for list_types = 'exturlusage'
		// combine_pages: true,
		namespace: task_configuration.namespace || default_namespace
	};

	if (list_types.join() === 'exturlusage') {
		task_configuration.move_from = {
			page_title: task_configuration.move_from_link
		};
		if (task_configuration.replace_protocol_to && !task_configuration.move_to_link) {
			// e.g., {'http://www.example.com/':{replace_protocol_to:'https'}}
			// →
			// {'http://www.example.com/':{replace_protocol_to:'https',move_to_url:'https://www.example.com/'}}
			// Overwrite `task_configuration.move_to_url`
			task_configuration.move_to_url = task_configuration.move_from_link.replace(/^.+?:\/\//, task_configuration.replace_protocol_to.replace(/:$/, '') + '://');
		}
		if (!task_configuration.text_processor && (task_configuration.move_to_link || task_configuration.move_to_url)) {
			// e.g.,
			// {'http://www.example.com/':{external_link_only:true,move_to_link:'https://www.example.com/'}}
			// {'http://www.example.com/':{replace_protocol_to:'https',external_link_only:true}}
			// {'http://www.example.com/':'https://www.example.com/'}
			task_configuration.text_processor = text_processor_for_exturlusage;
		}

	} else if (list_types.join() !== 'search') {
		// separate namespace and page name
		task_configuration.move_from = Object.assign(parse_move_link(task_configuration.move_from_link, wiki), task_configuration.move_from);
		const move_to = parse_move_link(task_configuration.move_to_link, wiki);
		if (move_to)
			task_configuration.move_to = Object.assign(move_to, task_configuration.move_to);
		// console.log(task_configuration.move_from);

		if (task_configuration.move_from.ns !== CeL.wiki.namespace('Category')) {
			list_types = list_types.filter(type => type !== 'categorymembers');
		}

	} else if (!task_configuration.text_processor && typeof task_configuration.move_to_link === 'string') {
		if (!task_configuration.replace_from) {
			let move_from_string = task_configuration.move_from_link.match(/^insource:(.+)$/);
			if (!move_from_string) {
				CeL.warn(`main_move_process: Should set text_processor() with list_types=${list_types}!`);
			} else {
				move_from_string = move_from_string[1];
				let replace_from = move_from_string.match(/^\/(.+)\/([ig]*)$/);
				if (replace_from) {
					// Should use {'note':{move_from_link:/move from
					// string/,move_to_link:'move to string'}}
					// instead of {'insource:/move from string/':'move to
					// string'}
					replace_from = new RegExp(replace_from[1], 'g' + (replace_from[2].includes('i') ? 'i' : ''));
				} else {
					// e.g., {'insource:"move from string"':'move to string'}
					replace_from = move_from_string.match(/^"([^"]+)"$/);
					replace_from = new RegExp(CeL.to_RegExp_pattern(replace_from ? replace_from[1] : move_from_string), 'g');
				}
				task_configuration.replace_from = replace_from;
			}
		}
		if (task_configuration.replace_from)
			task_configuration.text_processor = text_processor_for_search;
		// console.log(task_configuration);
	}

	let page_list = task_configuration.page_list;
	if (page_list) {
		// assert: Array.isArray(task_configuration.page_list)
		CeL.info(`main_move_process: Process ${page_list.length} pages`);
	} else {
		page_list = [];
		CeL.info(`main_move_process: Get types: ${list_types}`
			+ (task_configuration.move_from.page_title ? ` of ${use_language}: ${CeL.wiki.title_link_of(task_configuration.move_from.page_title)}` : '')
			+ (task_configuration.move_from_link && task_configuration.move_from_link !== task_configuration.move_from.page_title ? ` (${JSON.stringify(task_configuration.move_from_link)})` : ''));
		// Can not use `list_types.forEach(async type => ...)`
		for (let type of list_types) {
			page_list.append(await wiki[type](task_configuration.move_from.page_title, list_options));
		}
	}

	page_list = page_list.filter((page_data) => {
		return page_data.ns !== CeL.wiki.namespace('Wikipedia')
			&& page_data.ns !== CeL.wiki.namespace('User')
			// && !page_data.title.includes('/過去ログ')
			;
	});
	page_list = page_list.unique(page_data => page_data.title);
	if (task_configuration.page_limit >= 1)
		page_list = page_list.truncate(task_configuration.page_limit);
	// manually for debug
	// page_list = [''];

	// page_list.truncate(2);
	// console.log(page_list);

	await wiki.for_each_page(
		page_list,
		for_each_page.bind(task_configuration),
		{
			// for 「株式会社リクルートホールディングス」の修正
			// for リクルートをパイプリンクにする
			// page_options: { rvprop: 'ids|content|timestamp|user' },
			log_to: 'log_to' in task_configuration ? task_configuration.log_to : log_to,
			summary: task_configuration.summary
		});
}


// ---------------------------------------------------------------------//

function for_each_page(page_data) {
	// console.log(page_data.revisions[0].slots.main);
	// console.log(this);

	if (this.text_processor) {
		return this.text_processor(page_data.wikitext, page_data) || Wikiapi.skip_edit;
	}

	/** {Array} parsed page content 頁面解析後的結構。 */
	const parsed = page_data.parse();
	// console.log(parsed);
	CeL.assert([page_data.wikitext, parsed.toString()], 'wikitext parser check');

	this.page_data = page_data;

	if (this.move_to_link || this.for_each_link) {
		parsed.each('link', for_each_link.bind(this));
	}
	if (this.move_to_link) {
		parsed.each('file', for_each_file_link.bind(this));
	}
	if (this.move_to_link && this.move_from.ns === CeL.wiki.namespace('Category')) {
		parsed.each('category', for_each_category.bind(this));
	}
	if (!this.move_from.anchor && !this.move_from.display_text) {
		parsed.each('template', for_each_template.bind(this, page_data));
	}

	// return wikitext modified.
	return parsed.toString();
}


// ---------------------------------------------------------------------//

function for_each_link(token, index, parent) {
	// token: [ page_name, anchor / section_title, displayed_text ]
	const page_title = CeL.wiki.normalize_title(token[0].toString());
	const page_title_data = parse_move_link(page_title, this.wiki);
	// if (page_title === this.move_from.page_title) console.log(token);
	if (!page_title_data
		|| page_title_data.ns !== this.move_from.ns || page_title_data.page_name !== this.move_from.page_name
		|| typeof this.move_from.anchor === 'string' && this.move_from.anchor !== token.anchor
		|| typeof this.move_from.display_text === 'string' && this.move_from.display_text !== (token[2] || '').toString().trim()
		// 排除連結標的與頁面名稱相同的情況。
		|| this.page_data.title === this.move_to_link
	) {
		return;
	}
	// console.log(token);
	// console.log(page_title);
	// console.log(this);

	if (this.for_each_link) {
		return this.for_each_link(token, index, parent);
	}

	if (this.move_to_link === DELETE_PAGE) {
		// e.g., [[.move_from.page_title]]
		// console.log(token);
		if (token[2] || !token[1] && this.move_from.ns === this.wiki.namespace('Main')) {
			if (this.move_from.ns !== this.wiki.namespace('Main')) {
				// 直接只使用 displayed_text。
				CeL.info(`Using displayed text directly: ${CeL.wiki.title_link_of(this.page_data.title)}`);
			}
			// リンクを外してその文字列にして
			parent[index] = token[2] || token[0];
		} else {
			// e.g., リダイレクト解消
			CeL.assert(token[2] || !token[1] && this.move_from.ns === this.wiki.namespace('Main'), 'for_each_link: namesapce must be main when delete page');
		}
		return;
	}

	const matched = this.move_to_link.match(/^([^()]+) \([^()]+\)$/);
	if (matched) {
		// e.g., move_to_link: 'movie (1985)', 'movie (disambiguation)'
		// TODO
	}

	if (this.keep_title) {
		// e.g., [[.move_from.page_title]] →
		// [[move_to_link|.move_from.page_title]]
		// [[.move_from.page_title|顯示名稱]] → [[move_to_link|顯示名稱]]
		CeL.assert(this.move_from.ns === this.wiki.namespace('Main') || this.move_from.ns === this.wiki.namespace('Category'), 'for_each_link: keep_title: Must be article (namesapce: main) or Category');
		// 將原先的頁面名稱轉成顯示名稱。
		// keep original title
		if (!token[2]) token[2] = token[0];
	} else {
		if (this.move_to.display_text || this.move_to.display_text === '')
			token[2] = this.move_to.display_text;
	}
	// console.log('~~~~~~~~');
	// console.log(token);

	// 替換頁面。
	// TODO: using original namesapce
	token[0] = this.move_to.page_title;
	if (typeof this.move_to.anchor === 'string')
		token[1] = this.move_to.anchor ? '#' + this.move_to.anchor : '';

	// preserve [[PH|pH]]
	if (!token[1] && token[2] && CeL.wiki.normalize_title(token[2].toString()) === this.move_to.page_title) {
		// e.g., [[.move_from.page_title|move to link]] →
		// [[.move_to.page_title|move to link]]
		// → [[move to link]]
		token[0] = token[2];
		// assert: token.length === 2
		token.pop();
	}

	if (this.move_from.ns === this.wiki.namespace('Category')) {
		if (this.page_data.hook && this.page_data.hook[this.move_to.page_title]) {
			// 相同類別只允許單一 [[Category:]]。刪除當前（後面）的。
			if (token[2] && !this.page_data.hook[this.move_to.page_title][2])
				this.page_data.hook[this.move_to.page_title][2] = token[2];
			return remove_token;
		}
		if (!this.page_data.hook)
			this.page_data.hook = Object.create(null);
		this.page_data.hook[this.move_to.page_title] = token;
	}
}

const for_each_category = for_each_link;

// --------------------------------------------------------

function for_each_file_link(token, index, parent) {
	if (this.move_to_link && this.move_to_link !== DELETE_PAGE
		&& token.link === this.move_from_link) {
		// console.log(token);
		for (let index = 1; index < token.length; index++) {
			if (token[index] && token[index].type === 'plain'
				&& token[index][0] === 'link' && token[index][0] === '='
				&& typeof token[index][2] === 'string' && token[index][2].trim() === this.move_from_link) {
				// assert: token[index].length === 3
				token[index][2] = this.move_to_link;
			}
		}
	}
}

// --------------------------------------------------------

const no_ns_templates = {
	Pathnav: true,
	Navbox: true,
	Catlink: true,
};

function replace_template_parameter(value, parameter_name, template_token) {
	let move_to_link = this.move_to_link;
	if (!move_to_link)
		return;

	const link = parse_move_link(value && value.toString(), this.wiki);
	if (!link || (template_token.name in no_ns_templates
		? link.ns || CeL.wiki.normalize_title(link.page_name) !== this.move_from.page_name
		: CeL.wiki.normalize_title(link.page_title) !== this.move_from.page_title)) {
		return;
	}
	// assert: link.display_text === undefined

	if (false && template_token.name === 'Pathnav' &&
		// 避免 [[w:ja:Special:Diff/75582728|Xbox (ゲーム機)]]
		task_configuration.page_data.title === this.move_to.page_name) {
		return;
	}

	return {
		[parameter_name]: (template_token.name in no_ns_templates
			// 特別處理模板引數不加命名空間前綴的情況。
			? this.move_to.page_name : this.move_to.page_title)
			// e.g., {{Main|move_from_link#section title}}
			+ (this.move_to.anchor ? '#' + this.move_to.anchor
				: link.anchor ? '#' + link.anchor : '')
	};
}

function check_link_parameter(task_configuration, template_token, parameter_name) {
	const attribute_text = template_token.parameters[parameter_name];
	if (!attribute_text) {
		if (isNaN(parameter_name) || parameter_name == 1) {
			CeL.warn(`There is {{${template_token.name}}} without essential parameter ${parameter_name}.`);
		}
		return;
	}

	CeL.wiki.parse.replace_parameter(template_token, parameter_name, replace_template_parameter.bind(task_configuration));
}

function replace_link_parameter(task_configuration, template_token, template_hash, increase) {
	if (!(template_token.name in template_hash))
		return false;

	if (!task_configuration.move_to_link || task_configuration.move_to && !task_configuration.move_to.page_name
		|| task_configuration.page_data.ns !== task_configuration.move_from.ns) {
		return true;
	}

	// console.log(template_token);
	// console.log(template_token.length);
	let index = template_hash[template_token.name];
	do {
		check_link_parameter(task_configuration, template_token, index);
	} while (increase > 0 && (index += increase) < template_token.length);
	return true;
}

function for_each_template(page_data, token, index, parent) {

	if (token.name === this.move_from.page_name) {
		if (this.for_template) {
			this.for_template.call(page_data, token, index, parent);
		}
		if (this.replace_parameters) {
			if (CeL.is_Object(this.replace_parameters))
				CeL.wiki.parse.replace_parameter(token, this.replace_parameters);
			else
				throw new TypeError('.replace_parameters is not a Object');
		}
		if (this.move_to_link === DELETE_PAGE) {
			return remove_token;
		}
		if (this.move_to.page_name && this.move_from.ns === CeL.wiki.namespace('Template')) {
			// 直接替換模板名稱。
			token[0] = this.move_to.page_name;
			return;
		}
	}

	// ----------------------------------------------------

	// 不可處理: {{改名提案}}

	// templates that ONLY ONE parament is displayed as link.
	if (replace_link_parameter(this, token, {
		// templates that the first parament is displayed as link.
		// e.g., {{tl|.move_from.page_title}}
		Tl: 1,
		// e.g., {{廃止されたテンプレート|old page_title|.move_from.page_title}}
		廃止されたテンプレート: 2,
		// [[w:ja:Template:Navbox]]
		Navbox: 'name',
	})) return;

	// templates that ALL paraments are displayed as link.
	if (replace_link_parameter(this, token, {
		Main: 1,
		See: 1,
		Seealso: 1,
		'See also': 1,
		混同: 1,
		Catlink: 1,
		// [[w:ja:Template:Pathnav]]
		// e.g., {{Pathnav|主要カテゴリ|…|.move_from.page_title}}
		Pathnav: 1,
	}, 1)) return;

	if (replace_link_parameter(this, token, {
		// [1], [3], ...
		// [[w:ja:Template:Redirect]]
		Redirect: 1,

		// [2], [4], ...
		// [[w:ja:Template:Main2]]
		// e.g., {{Main2|案内文|.move_from.page_title}}
		Main2: 2,

		// [3], [5], ...
		// [[w:ja:Template:Otheruseslist]]
		Otheruseslist: 3,
		Otheruses: 3,
	}, 2)) return;
}

// ---------------------------------------------------------------------//
// export

Object.assign(globalThis, { DELETE_PAGE, remove_token });

module.exports = {
	// modify
	replace: replace_tool
};
