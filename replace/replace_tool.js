/*

 2019/9/13 8:59:40	初版試營運
 2019/12/21 4:12:49	模組化

Usage:
To use these tool functions, you should create a task file: "YYYYMMDD.section title.js", refering to templete: .replace_template.js
> node "YYYYMMDD.section title.js"
# or:
> node "YYYYMMDD.section title.js" "section_title=select this section title"
> node "YYYYMMDD.section title.js" "select this section title"

The `replace_tool.replace()` will:
# Get section title from task file name (command JavaScript file name)
# Guess language of section title assigned in task file name.
# Get diff_id from edit summary
# Get task configuration from section in request page.
# auto-notice: Starting replace task
# main_move_process(): Starting replace task
# finish_work(): finish up

警告:
每個 task_configuration 必須有獨立的 {Object} 設定，避免先前 prepare_operation() 設定過 .move_from_link 之類。

@see 20160923.modify_link.リンク元修正.js	20170828.search_and_replace.js	20161112.modify_category.js
@see https://www.mediawiki.org/wiki/Manual:Pywikibot/replace.py
@see https://meta.wikimedia.org/wiki/Indic-TechCom/Tools/MassMove
@see https://en.wikipedia.org/wiki/User:Plastikspork/massmove.js

@see [[w:ja:Wikipedia:改名提案]], [[w:ja:Wikipedia:移動依頼]]


文章名稱的改變，應考慮上下文的影響。例如：
# 是否應採用 [[new|old]]: using {keep_display_text : true} to preserve title displayed. Default: discard title
# 檢查重定向："株式会社[[リクルート]]" → "[[株式会社リクルート]]" instead of "株式会社[[リクルートホールディングス]]"

移動 category 時應注意是否需要修改 DEFAULTSORTKEY
另須注意 {{Catmore}} 可能出現斷鏈：[[w:ja:Special:Diff/93070649]]

TODO:
自動處理move from之繁簡轉換
auto add section title @ summary
除重定向頁為 (曖昧さ回避)外，將所有 move_from 的重定向也一起修正
檢查是否為討論頁。 e.g., [[w:ja:Special:Diff/80384825]]
移動頁面相關的機器人或機器使用者需要提出對所有不同頁面內容模型的處理計畫，JSON頁沒有重新導向功能。一般頁面與模板都能重導向。分類頁面則必須移動所有包含的頁面。module 可用<code>return require( 'Module:name' );</code>重導向。

https://en.wikipedia.org/wiki/Wikipedia:AutoWikiBrowser/General_fixes
並非所有常規修補程序都適用於所有語言。

: {{コメント}} {{tl|リンク修正依頼/改名}}を使ってみた。 --~~~~

fix https://ja.wikipedia.org/w/index.php?title=%E3%82%A6%E3%82%A9%E3%83%83%E3%82%AB&diff=86465417&oldid=86454811&diffmode=source

read {{cbignore}}?

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Load modules.
CeL.run([
	'application.net.wiki.template_functions',
	// for CeL.assert()
	'application.debug.log',
	// 載入不同地區語言的功能 for CeL.gettext()。
	'application.locale',
	// CeL.wiki.data.is_DAB()
	'application.net.wiki.data',
]);


// 20190913.replace.js
log_to = log_to.replace(/\d+$/, 20190913);
//console.trace(log_to);

// global variables using in move_configuration
const DELETE_PAGE = Symbol('DELETE_PAGE');
const REDIRECT_TARGET = Symbol('REDIRECT_TARGET');
const remove_token = CeL.wiki.parser.parser_prototype.each.remove_token;

/** {String}Default requests page */
const bot_requests_page = 'Project:BOTREQ';

// ---------------------------------------------------------------------//

// .wiki
const KEY_wiki_session = 'wiki';
async function setup_wiki_session(meta_configuration) {
	/** {Object}wiki operator 操作子. */
	let wiki = meta_configuration[KEY_wiki_session];
	if (!wiki) {
		wiki = meta_configuration[KEY_wiki_session] = new Wikiapi;

		//console.trace(login_options);
		await wiki.login(login_options);
		// await wiki.login(null, null, use_language);
	}

	return wiki;
}

// ---------------------------------------------------------------------//

async function get_all_sections(meta_configuration) {
	meta_configuration = CeL.setup_options(meta_configuration);
	const wiki = await setup_wiki_session(meta_configuration);

	const all_section_data = Object.create(null);

	async function for_each_section(section) {
		//console.log(section);
		const section_title = section.section_title.title;
		//console.log(section_title);
		if (meta_configuration.for_section) {
			await meta_configuration.for_section.apply(/* parsed */this, arguments);
		}
		if (all_section_data[section_title]) {
			throw new Error('Duplicated section title: ' + section_title);
		}
		const section_data = all_section_data[section_title] = Object.create(null);

		const section_wikitext = section.toString();
		let matched;
		function set_process(process) {
			section_data.process = process;
			section_data[process] = matched[1];
		}

		// TODO: 必須避免如 <nowiki>{{確認}}</nowiki>

		matched = section_wikitext.match(/{{ *(Doing|BOTREQ *\| *(?:着手|調査中|準備中|作業中|仕様)) *[|}]/);
		if (matched) {
			set_process('doing');
		}

		matched = section_wikitext.match(/{{ *(Done|完了|BOTREQ *\| *(?:done|済|完了)|利用者の投稿記録リンク) *[|}]/);
		if (matched) {
			set_process('done');
		}

		matched = section_wikitext.match(/{{ *(BOTREQ *\| *(?:impossible|不受理)) *[|}]/);
		if (matched) {
			set_process('deny');
		}

		matched = section_wikitext.match(/{{ *(確認) *[|}]/);
		if (matched) {
			set_process('completed');
		}

		matched = section_wikitext.match(/{{ *(失効|未解決|取り下げ) *[|}]/);
		if (matched) {
			set_process('withdrawed');
		}

		matched = section_wikitext.match(/{{ *(解決済み?|済み|スタック) *[|}]/);
		if (matched) {
			set_process('finished');
		}

		if (section_data.process) {
			return;
		}

		const task_configuration_from_section = await get_move_configuration_from_section(meta_configuration, section, true);
		if (task_configuration_from_section) {
			section_data.task_configuration = task_configuration_from_section;
		}
	}

	//console.trace(meta_configuration);
	await for_bot_requests_section(wiki, meta_configuration, for_each_section,
		//await replace_tool.get_all_sections({ for_section(section, index, parent) { }, for_section_options: { need_edit: true, summary: 'Close request' } });
		meta_configuration.for_section_options);
	//console.trace(all_section_data);
	return all_section_data;
}

// ---------------------------------------------------------------------//

/**
 * Main entry point to replace wiki pages.
 * replace_tool.replace()
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
async function replace_tool__replace(meta_configuration, move_configuration) {
	if (typeof meta_configuration === 'string') {
		meta_configuration = {
			summary: meta_configuration
		}
	} else {
		meta_configuration = CeL.setup_options(meta_configuration);
	}

	get_move_configuration_from_command_line(meta_configuration);
	//console.trace(meta_configuration);
	if (meta_configuration.use_language)
		meta_configuration.language = meta_configuration.use_language;

	if (!meta_configuration.language && meta_configuration[KEY_wiki_session]) {
		meta_configuration.language = meta_configuration[KEY_wiki_session].append_session_to_options().session.language;
	}

	if (!meta_configuration.language) {
		CeL.env.ignore_COM_error = true;
		// Guess language of section title assigned in task file name.
		CeL.run('application.locale.encoding');

		//console.trace(meta_configuration.section_title);
		//CeL.set_debug(9);
		// e.g., 'ja-JP'
		const language_code = CeL.encoding.guess_text_language(meta_configuration.section_title);
		//CeL.set_debug(0);
		const matched = language_code && language_code.match(/^([a-z]+)\-/);
		if (matched) {
			meta_configuration.language = matched[1];
			CeL.info([CeL.env.script_name + ': ', {
				// gettext_config:{"id":"treat-$1-as-language-$2"}
				T: ['Treat %1 as language: %2.', JSON.stringify(meta_configuration.section_title), CeL.gettext.get_alias(language_code) || language_code]
			}]);
		} else {
			const message = CeL.env.script_name + ': '
				// gettext_config:{"id":"cannot-detect-language-of-$1"}
				+ CeL.gettext('Cannot detect language of %1!', JSON.stringify(meta_configuration.section_title));
			CeL.error(message);
			if (!meta_configuration.ignore_language)
				throw new Error(message);
		}
	}

	let original_language;
	if (meta_configuration.language) {
		original_language = use_language;
		// Set default language. 改變預設之語言。 e.g., 'zh'
		set_language(meta_configuration.language);
	}
	if (meta_configuration.API_URL) {
		login_options.API_URL = meta_configuration.API_URL;
	} else if (meta_configuration.project) {
		login_options.project = meta_configuration.project;
		if (meta_configuration.language)
			login_options.language = meta_configuration.language;
		if (login_options.API_URL)
			delete login_options.API_URL;
	}
	//console.trace(login_options);

	/** {Object}wiki operator 操作子. */
	await setup_wiki_session(meta_configuration);

	await prepare_operation(meta_configuration, move_configuration);

	if (original_language) {
		// revert changes
		use_language = original_language;
	}
}

// ---------------------------------------------------------------------//

const work_option_switches = ['keep_display_text', 'keep_initial_case', 'skip_nochange', 'allow_empty'];
const command_line_switches = ['diff_id', 'section_title', 'replace_text', 'replace_text_pattern', 'also_replace_text_insource', 'use_language', 'task_configuration', 'namespace',
	'no_task_configuration_from_section', 'get_task_configuration_from', 'min_list_length',
	'caption', 'allow_eval'].append(work_option_switches);

const command_line_argument_alias = {
	diff: 'diff_id',
	insource: 'also_replace_text_insource',
};

function convert_special_move_to(move_to_link) {
	switch (move_to_link) {
		// remove_page
		case 'DELETE_PAGE':
			return DELETE_PAGE;

		case 'REDIRECT_TARGET':
			return REDIRECT_TARGET;

		case 'subst:':
		// 將會在後面 prepare_operation() 處理。

		default:
	}

	return move_to_link;
}

function convert_special_move_to_of_task(task_configuration) {
	//console.trace(task_configuration);
	for (const [move_from_link, move_to_link] of Object.entries(task_configuration)) {
		//console.trace([move_from_link, move_to_link]);
		task_configuration[move_from_link] = convert_special_move_to(move_to_link);
	}
}

function get_move_configuration_from_command_line(meta_configuration) {
	if (CeL.env.arg_hash) {
		for (const arg_name in command_line_argument_alias) {
			if (arg_name in CeL.env.arg_hash) {
				CeL.env.arg_hash[command_line_argument_alias[arg_name]] = CeL.env.arg_hash[arg_name];
			}

			if (CeL.env.arg_hash.task_configuration) {
				try {
					//console.trace(CeL.env.arg_hash.task_configuration);
					const task_configuration_from_args = JSON.parse(CeL.env.arg_hash.task_configuration);
					//console.trace(task_configuration_from_args);
					convert_special_move_to_of_task(task_configuration_from_args);
					//console.trace(task_configuration_from_args);
					meta_configuration.task_configuration_from_args = task_configuration_from_args;
				} catch (e) {
					//if (!CeL.is_Object(CeL.env.arg_hash.task_configuration))
					CeL.error([get_move_configuration_from_command_line.name + ': ', {
						// gettext_config:{"id":"invalid-task_configuration-(should-be-$2)-{$3}-$1"}
						T: ['Invalid task_configuration (should be %2): {%3} %1', CeL.env.arg_hash.task_configuration, CeL.is_type(JSON), typeof CeL.env.arg_hash.task_configuration]
					}]);
				}
				//assert: !meta_configuration.task_configuration_from_args || CeL.is_Object(meta_configuration.task_configuration_from_args)
			}
		}

		for (const property_name of command_line_switches) {
			let value = CeL.env.arg_hash[property_name];
			//console.log([property_name, value]);
			if (typeof value !== 'boolean' && value !== 0
				&& (!value || typeof value === 'string' && !(value = value.trim())))
				continue;
			//> node "YYYYMMDD.section title.js" "section_title=select this section title"
			// e.g., "20200704.「一条ぎょく子」→「一条頊子」の改名に伴うリンク修正依頼.js"
			//console.trace(CeL.env.arg_hash);
			CeL.info([get_move_configuration_from_command_line.name + ': ', {
				// gettext_config:{"id":"get-parameter-$1=$2-from-command-line"}
				T: ['Get parameter %1=%2 from command line', property_name, value]
			}]);
			meta_configuration[property_name] = value;
		}

		if (meta_configuration.also_replace_text_insource && typeof meta_configuration.also_replace_text_insource === 'string') {
			meta_configuration.also_replace_text_insource = meta_configuration.also_replace_text_insource.split('|');
		}
		//console.trace(meta_configuration);
	}

	if (meta_configuration.section_title) {
		return;
	}

	let section_title;
	if (CeL.env.argv.length > 2 && (section_title = CeL.env.argv[2].trim())) {
		//> node "YYYYMMDD.section title.js" "select this section title"
		//console.trace(CeL.env.argv[2]);
		CeL.info([get_move_configuration_from_command_line.name + ': ', {
			// gettext_config:{"id":"get-section-title-from-command-line-argument-$1"}
			T: ['Get section title from command line argument: %1', section_title]
		}]);
		meta_configuration.section_title = section_title;
		return;
	}

	// 可省略 `section_title` 的條件: 檔案名稱即 section_title
	section_title = script_name;
	if (section_title) {
		CeL.info([get_move_configuration_from_command_line.name + ': ', {
			// gettext_config:{"id":"get-section-title-from-task-file-name-$1"}
			T: ['Get section title from task file name: %1', section_title]
		}]);
		meta_configuration.section_title = section_title;
		return;
	}

	throw new Error('Cannot extract section title from task file name!');
}

function guess_and_fulfill_meta_configuration_from_page(requests_page_data, meta_configuration) {
	//console.log(requests_page_data);
	let section_title = meta_configuration.section_title;

	let user, diff_to, diff_from;
	function set_diff_to(revision) {
		user = revision.user;
		diff_to = revision.revid;
		// diff_from = revision.parentid;
		diff_from = null;
	}

	requests_page_data.revisions.forEach((revision, index, revisions) => {
		// for section_title set from script_name @ get_move_configuration_from_command_line(meta_configuration)
		let comment = revision.comment && revision.comment.match(/^\/\*(.+)\*\//);
		if (comment) {
			comment = comment[1];
			if (section_title === script_name) {
				// 去掉檔名中不能包含的字元。 [\\\/:*?"<>|] → without /\/\*/
				// https://en.wikipedia.org/wiki/Filename#Reserved_characters_and_words
				comment = comment.replace(/[\\\/:*?"<>|]/g, '');
			}
		}
		//console.log(section_title);
		//console.log(comment);
		// console.log(matched);
		if (comment && comment.trim() === section_title.trim()) {
			// console.log(revision);
			if (user === revision.user && diff_to > 0) {
				diff_from = revision.parentid;
				// At last, diff_from should starts
				// from e.g., "→鈴木正人のリンク修正: 新しい節"
			} else {
				set_diff_to(revision);
			}

			if (section_title === script_name) {
				// 復原檔名中不能包含的字元。
				const _section_title = revision.comment.match(/^\/\*(.+)\*\//)[1].trim();
				// console.log([section_title, _section_title]);
				if (section_title !== _section_title) {
					CeL.info([get_move_configuration_from_command_line.name + ': ', {
						// gettext_config:{"id":"change-section-title"}
						T: 'Change section title:'
					}]);
					CeL.log(CeL.display_align([
						['From\t', section_title],
						['To→\t', _section_title]
					]));
					// TODO: parse
					section_title = meta_configuration.section_title = _section_title;
				}
			}

			return;
		}

		if (index > 0) {
			// get diff_id from content
			// @see wiki.tracking_revisions()
			const content = CeL.wiki.revision_content(revision, true);
			if (typeof content === 'string') {
				const diff_list = CeL.LCS(content, CeL.wiki.revision_content(revisions[index - 1]), 'diff');
				if (diff_list.some(diff => {
					const [removed_text, added_text] = diff;
					if (!added_text || typeof added_text !== 'string')
						return;
					const parsed = CeL.wiki.parser(added_text, meta_configuration[KEY_wiki_session].append_session_to_options()).parse();
					let found;
					parsed.each('section_title', section_title_token => {
						//console.log([section_title, section_title_token.title]);
						found = section_title === section_title_token.title;
						if (found) {
							return parsed.each.exit;
						}
					});
					return found;
				})) {
					set_diff_to(revisions[index - 1]);
					return;
				}
			}
		}

		user = null;
	});

	if (diff_to > 0) {
		meta_configuration.diff_id = diff_from > 0 ? diff_from + '/' + diff_to : diff_to;
		CeL.info([get_move_configuration_from_command_line.name + ': ', {
			// gettext_config:{"id":"get-$1-from-edit-summary-$2"}
			T: ['Get %1 from edit summary: %2',
				// gettext_config:{"id":"revision-id"}
				CeL.gettext('revision id') + ` (diff_id)`, CeL.wiki.title_link_of(`Special:Diff/${meta_configuration.diff_id}#${section_title}`)]
		}]);
	}
}

// 從已知資訊解開並自動填寫 `meta_configuration`
async function guess_and_fulfill_meta_configuration(wiki, meta_configuration) {
	const requests_page = meta_configuration.requests_page || bot_requests_page;
	// 可省略 `diff_id` 的條件: 以新章節增加請求，且編輯摘要包含 `/* section_title */`
	const section_title = meta_configuration.section_title;
	//'max'
	const rvlimit = meta_configuration.requests_page_rvlimit || 80;

	//console.trace(section_title);
	if (section_title) {
		CeL.log_temporary({
			// gettext_config:{"id":"get-$2-edit-summaries-of-$1"}
			T: ['Get %2 edit {{PLURAL:%2|summary|summaries}} of %1', CeL.wiki.title_link_of(requests_page), rvlimit]
		});
		const requests_page_data = await wiki.page(requests_page, {
			redirects: 1,
			// rvprop: 'ids|comment|user|content',
			rvprop: 'ids|comment|user',
			// rvlimit: 'max',
			rvlimit,
		});
		//console.log(requests_page_data);
		guess_and_fulfill_meta_configuration_from_page(requests_page_data, meta_configuration);

		if (!meta_configuration.diff_id) {
			// get diff_id from content
			CeL.log_temporary({
				// gettext_config:{"id":"get-$2-revision(s)-of-$1"}
				T: ['Get %2 {{PLURAL:%2|revision|revisions}} of %1', CeL.wiki.title_link_of(requests_page), rvlimit]
			});
			const requests_page_data = await wiki.page(requests_page, {
				redirects: 1,
				rvprop: 'ids|comment|user|content',
				// rvlimit: 'max',
				rvlimit,
			});
			guess_and_fulfill_meta_configuration_from_page(requests_page_data, meta_configuration);
		}

	} else if (meta_configuration.diff_id) {
		// Skip
	} else {
		CeL.error([guess_and_fulfill_meta_configuration.name + ': ', {
			// gettext_config:{"id":"no-section-title-set"}
			T: 'No section title set!'
		}]);
	}

	if (!meta_configuration.diff_id) {
		if (use_language === 'zh' || use_language === 'cmn') {
			CeL.error([guess_and_fulfill_meta_configuration.name + ': ', {
				T: '請注意標題繁體簡體必須相符！'
			}]);
			// e.g., 刪除小天體模板時，[[Template:小天体]] redirect to [[Template:小天體]]?
		}
		// gettext_config:{"id":"unable-to-extract-the-revision-difference-id-from-page-edit-summary-of-$1"}
		throw new Error(CeL.gettext('Unable to extract the revision difference id from page edit summary of %1!', CeL.wiki.title_link_of(requests_page)));
	}

	// throw new Error(meta_configuration.section_title);
}

// Check if there are default move configurations.
async function get_move_configuration_from_section(meta_configuration, section, no_export) {
	function get_discussion_link(meta_token) {
		let discussion_link;
		section.each.call(meta_token, 'link', token => {
			//console.trace(token);
			if (!discussion_link) {
				//discussion_link = token[0] + token[1];
				discussion_link = token;
				return;
			}

			CeL.info([get_move_configuration_from_section.name + ': ', {
				// gettext_config:{"id":"multiple-discussion-links-exist"}
				T: 'Multiple discussion links exist:'
			}]);
			CeL.log(CeL.display_align([
				['\t', CeL.wiki.title_link_of(discussion_link)],
				['\t', token.toString()]
			]));
			discussion_link = null;
			return section.each.exit;
		});
		return discussion_link;
	}

	if (!meta_configuration.discussion_link) {
		section.each('list', token => {
			if (!/議論場所[:：]/.test(token[0]))
				return;

			const discussion_link = get_discussion_link(token[0]);
			if (discussion_link)
				meta_configuration.discussion_link = discussion_link;
			// CeL.wiki.parser.parser_prototype.each.exit
			return section.each.exit;
		});
	}

	// Do not get move configuration from section.
	if (meta_configuration.no_task_configuration_from_section)
		return;

	const task_configuration_from_section = Object.create(null);

	//console.trace(meta_configuration.get_task_configuration_from);
	if (meta_configuration.get_task_configuration_from === 'table') {
		await section.each('table', async table => {
			if (!meta_configuration.caption || table.caption === meta_configuration.caption) {
				await parse_move_pairs_from_link(table, task_configuration_from_section, meta_configuration);
			}
		});
	} else if (meta_configuration.get_task_configuration_from === 'list') {
		await section.each('list', async list_token => {
			//console.log(list_token);
			//console.log(meta_configuration);
			if (list_token.length >= (meta_configuration.min_list_length || 3)) {
				await parse_move_pairs_from_link(list_token, task_configuration_from_section, meta_configuration);
			}
		});
	}
	//console.trace(meta_configuration);
	//console.trace(task_configuration_from_section);

	// Get task configuration from section in request page.
	//[[w:ja:Template:リンク修正依頼/改名]]
	section.each('Template:リンク修正依頼/改名', token => {
		let discussion_link = token.parameters.提案;
		if (!discussion_link) {
		} else if (discussion_link.type === 'link') {
			//discussion_link = discussion_link[0] + discussion_link[1];
		} else {
			discussion_link = get_discussion_link(token.parameters.提案);
		}
		//console.trace([token.parameters.提案, discussion_link]);

		// 警告: 必須確保範圍較狹隘的放在前面!
		let task_options = token.parameters.options;
		if (task_options) {
			//console.log(task_options);
			try {
				task_options = JSON.parse(task_options);
			} catch (e) {
				//console.trace(meta_configuration);
				if (meta_configuration.allow_eval) {
					CeL.error({
						// gettext_config:{"id":"not-json-try-eval()-$1"}
						T: ['Not JSON, try eval(): %1', task_options]
					});
					eval('task_options = ' + task_options);
					//console.trace(task_options);
				} else if (!no_export) {
					CeL.error({
						// gettext_config:{"id":"not-json-you-may-want-to-set-allow_eval=true-$1"}
						T: ['Not JSON, you may want to set "allow_eval=true": %1', task_options]
					});
					throw e;
				}
			}
			//console.log(task_options);
		}

		function match_link(link) {
			if (typeof link !== 'string') {
				// e.g., Symbol(DELETE_PAGE)
				return;
			}
			// e.g., <nowiki>[[title|display text]]</nowiki>
			const matched = link.match(/\[\[([^\[\]]+)\]\]/);
			return matched;
		}

		function normalize_page_token(index, keep_link) {
			//console.log(token.parameters[index]);
			let link = typeof index === 'number' ? token.parameters[index].toString().replace(/<!--[\s\S]*-->/g, '').trim().replace(/{{!}}/g, '|') : index;
			if (!keep_link && match_link(link)) {
				CeL.error(`${get_move_configuration_from_section.name}: 精確指定了連結形式，將僅處理完全符合此形式的連結：${link}`);
				const parsed = CeL.wiki.parse(link);
				// @see function prepare_operation(meta_configuration, move_configuration)
				if (!parsed[1]) parsed[1] = '#';
				if (!parsed[2]) parsed[2] = typeof index === 'number' && index % 2 === 1 ? '' : parsed[0];
				link = match_link(parsed.toString())[1];
			}
			return link;
		}

		for (let index = 1; token.parameters[index] && token.parameters[index + 1]; index += 2) {
			const move_from_link = normalize_page_token(index);
			//if (move_from_link.includes('IOS (Apple)')) { console.trace(`Ignore ${CeL.wiki.title_link_of(move_from_link)}`); continue; }
			let move_to_link = convert_special_move_to(normalize_page_token(index + 1, true));
			const task_configuration = {
				discussion_link,
				...task_options,
			};
			if (match_link(move_to_link)) {
				// assert: 'keep_display_text' in task_configuration === false
				task_configuration.keep_display_text = false;
				move_to_link = normalize_page_token(move_to_link);
			}
			task_configuration.move_to_link = move_to_link;
			if (task_configuration_from_section[move_from_link]) {
				CeL.error([get_move_configuration_from_section.name + ': ', {
					// gettext_config:{"id":"duplicate-task-name-$1!-will-overwrite-old-task-with-new-task-$2→$3"}
					T: ['Duplicate task name %1! Will overwrite old task with new task: %2→%3', JSON.stringify(move_from_link), '\n' + JSON.stringify(task_configuration_from_section[move_from_link]) + '\n', '\n' + JSON.stringify(task_configuration) + '\n']
				}]);
			}
			task_configuration_from_section[move_from_link] = task_configuration;
			if (Array.isArray(meta_configuration.also_replace_text_insource) ? meta_configuration.also_replace_text_insource.includes(move_from_link) : meta_configuration.also_replace_text_insource) {
				// Also replace text in source of **non-linked** pages
				task_configuration_from_section[`insource:"${move_from_link}"`] = Object.clone(task_configuration);
				//console.log(task_configuration_from_section);
			}
		}
	});

	//if (!CeL.is_empty_object(task_configuration_from_section)) return;

	CeL.info([get_move_configuration_from_section.name + ': ', {
		// gettext_config:{"id":"get-$1-task(s)-from-$2"}
		T: ['Get %1 {{PLURAL:%1|task|tasks}} from %2.', Object.keys(task_configuration_from_section).length, section.section_title.link.toString()]
	}]);
	//console.trace(task_configuration_from_section);
	if (!no_export)
		meta_configuration.task_configuration_from_section = task_configuration_from_section;
	return task_configuration_from_section;
}

async function for_bot_requests_section(wiki, meta_configuration, for_section, options) {
	const requests_page = meta_configuration.requests_page || bot_requests_page;
	//console.trace(requests_page);
	const requests_page_data = await wiki.page(requests_page, { redirects: 1 });
	/** {Array} parsed page content 頁面解析後的結構。 */
	const parsed = requests_page_data.parse();
	CeL.assert([requests_page_data.wikitext, parsed.toString()],
		// gettext_config:{"id":"wikitext-parser-checking-$1"}
		CeL.gettext('wikitext parser checking: %1', CeL.wiki.title_link_of(requests_page_data)));

	const section_title = meta_configuration.section_title;
	//console.trace(meta_configuration);
	await parsed.each_section(async function (section) {
		//console.log([section.section_title && section.section_title.title, section_title]);
		//console.log(section.section_title);
		if (!section.section_title || section_title && section.section_title.title !== section_title) {
			return;
		}
		// console.log(section.toString());

		await for_section.apply(parsed, arguments);
	}, {
		get_users: true,
		level_filter: /*use_language === 'zh' ? 3 :*/ 2,
	});

	if (options && options.need_edit) {
		// console.log(parsed.toString());
		await wiki.edit_page(requests_page, parsed.toString(), {
			redirects: 1,
			sectiontitle: section_title,
			//{{BOTREQ|着手}}
			summary: options.summary
		});
	}
}

// 自動提醒/通知
// auto-notice: Starting replace task
async function notice_to_edit(wiki, meta_configuration) {
	const options = {
		// gettext_config:{"id":"the-requested-robot-task-begins"}
		summary: CeL.gettext('The requested robot task begins.')
	};

	await for_bot_requests_section(wiki, meta_configuration, async function (section) {
		//console.trace(section);
		meta_configuration.bot_requests_section = section;
		// 委託人
		meta_configuration.bot_requests_user = section.users[0];
		//console.trace(meta_configuration.bot_requests_user);

		// 必須執行以從章節讀取設定!
		const task_configuration_from_section = await get_move_configuration_from_section(meta_configuration, section);
		//console.trace(task_configuration_from_section);

		const doing_message = meta_configuration.doing_message || (wiki.site_name() === 'jawiki' ?
			//{{BOTREQ|着手}}
			'{{BOTREQ|作業中}}' : '{{Doing}}');
		// let PATTERN = /\n[:* ]*{{BOTREQ\|作業中}}/i;
		// PATTERN =
		// new RegExp(PATTERN.source + ' .+?' + meta_configuration[KEY_wiki_session].token.login_user_name, PATTERN.flags);
		if (section.toString().includes(doing_message) /*PATTERN.test(section.toString())*/) {
			CeL.info({
				// gettext_config:{"id":"already-reminded-that-the-operation-is-in-progress-$1"}
				T: ['Already reminded that the operation is in progress: %1', meta_configuration.section_title]
			});
			options.need_edit = false;
			return;
		}

		let warning_messages = [];
		let had_add_user_notice;
		if (wiki.site_name() === 'jawiki') {
			const disambiguation_removed = [];
			Object.keys(task_configuration_from_section).forEach(move_from_link => {
				const task_configuration = task_configuration_from_section[move_from_link];
				// detect [[title (disambiguation)]] → [[title]]
				if (!task_configuration.force_remove_disambiguation && move_from_link.replace(/ \([^()]+\)$/) === task_configuration.move_to_link) {
					disambiguation_removed.push(`${CeL.wiki.title_link_of(move_from_link)}→${CeL.wiki.title_link_of(task_configuration.move_to_link)}`);
					delete task_configuration_from_section[move_from_link];
				}
			});
			if (disambiguation_removed.length > 0) {
				warning_messages.push(`* ${had_add_user_notice ? '' : CeL.wiki.title_link_of(wiki.to_namespace(meta_configuration.bot_requests_user, 'User')) + ': '
					}${disambiguation_removed.join(', ')}: 項目付きの曖昧さ回避を解消する場合は、各分野のプロジェクト／ポータルにおける曖昧さ回避関連のルールに準拠したものへの付け替えをお勧めします。（[[WP:PRIRDR]]）`);
				had_add_user_notice = true;
				meta_configuration.abort_operation = true;
			}
		}

		const parsed = this;
		const index = section.range[1] - 1;
		// assert: parsed[index] === section.at(-1)
		parsed[index] = parsed[index].toString().trimEnd();
		if (warning_messages.length > 0)
			parsed[index] += '\n' + warning_messages.join('\n');
		if (meta_configuration.abort_operation) {
			// gettext_config:{"id":"add-warning-messages"}
			options.summary = CeL.gettext('Add warning messages.');
		} else {
			parsed[index] += `\n* ${doing_message}`;
		}
		parsed[index] += ' --~~~~\n';
		// TODO: +確認用リンク
		options.need_edit = true;
	}, options);

	if (options.need_edit === undefined) {
		CeL.info([{
			//  gettext_config:{"id":"no-title-found-for-$1"}
			T: ['No title found for %1.', JSON.stringify(meta_configuration.section_title)]
		}, {
			// gettext_config:{"id":"will-not-automatically-notify-the-task-begins"}
			T: 'Will not automatically notify the task begins!'
		}]);
	}
}

async function notice_finished(wiki, meta_configuration) {
	const options = {
		// 完了、確認待ち 
		// +{{解決済み}}: @ general_replace.js
		// gettext_config:{"id":"the-requested-robot-task-finished"}
		summary: CeL.gettext('The requested robot task finished.')
	};
	const _log_to = 'log_to' in meta_configuration ? meta_configuration.log_to : log_to;

	await for_bot_requests_section(wiki, meta_configuration, function (section) {
		const wiki_language = wiki.site_name({ get_all_properties: true }).language;
		const finished_message = meta_configuration.finished_message
			// gettext_config:{"id":"robot-task-completion-notification"}
			|| CeL.gettext('{{Done}} Please check the results and let me know if there is something wrong, thank you.')
			+ (_log_to ? ` - ${CeL.wiki.title_link_of(_log_to, 'log')}` : '');
		if (section.toString().includes(finished_message) /*PATTERN.test(section.toString())*/) {
			CeL.info({
				// gettext_config:{"id":"already-notified-that-the-task-is-finished-$1"}
				T: ['Already notified that the task is finished: %1', meta_configuration.section_title]
			});
			options.need_edit = false;
			return;
		}
		const parsed = this;
		const index = section.range[1] - 1;
		// assert: parsed[index] === section.at(-1)
		parsed[index] = parsed[index].toString().trimEnd()
			// [[mw:Extension:Echo#Usage]]
			+ `\n* ${meta_configuration.bot_requests_user ? `[[User:${meta_configuration.bot_requests_user}|]]: ` : ''}${finished_message} --~~~~\n`;
		options.need_edit = true;
	}, options);

	if (options.need_edit === undefined) {
		CeL.info({
			// gettext_config:{"id":"will-not-automatically-notify-the-task-finished"}
			T: 'Will not automatically notify the task finished!'
		});
	}
}

function unshift_move_configuration(move_configuration, items_to_unshift) {
	if (!items_to_unshift)
		return move_configuration;

	//assert: CeL.is_Object(items_to_unshift)
	if (Array.isArray(move_configuration)) {
		return [
			...Object.entries(items_to_unshift),
			...move_configuration
		];
	}

	return {
		...items_to_unshift,
		...move_configuration
	};
}

async function prepare_operation(meta_configuration, move_configuration) {
	/** {Object}wiki operator 操作子. */
	const wiki = meta_configuration[KEY_wiki_session];

	if (!meta_configuration.not_bot_requests)
		await guess_and_fulfill_meta_configuration(wiki, meta_configuration);

	if (!meta_configuration.no_notice)
		await notice_to_edit(wiki, meta_configuration);

	if (meta_configuration.abort_operation)
		return;

	if (typeof move_configuration === 'function') {
		async function setup_move_configuration(meta_configuration, options) {
			/** {Object}wiki operator 操作子. */
			const wiki = meta_configuration[KEY_wiki_session];
		}
		move_configuration = await move_configuration(meta_configuration, { bot_requests_page });
		// console.log(move_configuration);
		// console.log(Object.keys(move_configuration));
		// throw Object.keys(move_configuration).length;
	}

	// 解構賦值 `({ a, b, c = 3 } = { a: 1, b: 2 })`
	const { summary, section_title } = meta_configuration;
	const _section_title = section_title ? '#' + section_title : '';

	//console.trace(meta_configuration);
	move_configuration = unshift_move_configuration(move_configuration, meta_configuration.task_configuration_from_section);
	move_configuration = unshift_move_configuration(move_configuration, meta_configuration.task_configuration_from_args);
	//console.trace(move_configuration);

	// Object.entries(move_configuration).forEach(main_move_process);
	if (CeL.is_Object(move_configuration)) {
		move_configuration = Object.entries(move_configuration);
	} else {
		// assert: Array.isArray(move_configuration)
	}

	for (let move_configuration_index = 0; move_configuration_index < move_configuration.length; move_configuration_index++) {
		const pair = move_configuration[move_configuration_index];
		const move_from_link = pair[1].move_from_link
			// `CeL.wiki.normalize_title(pair[0])` 可能造成URL、"insource:"出現問題。
			|| pair[0];
		const original_move_to_link = pair[1];
		const task_configuration = CeL.is_Object(original_move_to_link)
			? original_move_to_link.move_from_link ? original_move_to_link : { move_from_link, ...original_move_to_link }
			// assert: typeof move_to_link === 'string' or REDIRECT_TARGET, DELETE_PAGE
			: { move_from_link, move_to_link: original_move_to_link };

		// 中文條目也必須處理語言變體（繁簡轉換）情形。
		if (meta_configuration.language === 'cmn' && !task_configuration.list_title
			// 確認是有必要轉換的，不是完全英文標題。
			// /[\u4e00-\u9fa5]/: 匹配中文。
			&& /[\u4e00-\u9fff]/.test(move_from_link)) {
			let varianttitle = await meta_configuration[KEY_wiki_session].convert_Chinese(move_from_link, { uselang: 'zh-hant' });
			if (varianttitle === move_from_link) {
				varianttitle = await meta_configuration[KEY_wiki_session].convert_Chinese(move_from_link, { uselang: 'zh-hans' });
			}
			if (varianttitle === move_from_link) {
				CeL.warn(`${prepare_operation.name}: ${CeL.wiki.title_link_of(move_from_link)} 可能是繁簡混雜？`);
			} else if (typeof task_configuration.move_to_link === 'string') {
				// ↑ 預防 DELETE_PAGE 之類的 Symbol。
				CeL.warn(`${prepare_operation.name}: ${CeL.wiki.title_link_of(move_from_link)}: 亦自動轉換 ${CeL.wiki.title_link_of(varianttitle)} → ${CeL.wiki.title_link_of(task_configuration.move_to_link)}`);
				move_configuration.splice(move_configuration_index + 1, 0, [pair[0], {
					...task_configuration,
					//is_additional_task_for_varianttitles: true,
					list_title: move_from_link,
					move_from_link: varianttitle
				}]);
				//console.trace(move_configuration);
			}
		}

		if (task_configuration.move_to_link === 'subst:') {
			delete task_configuration.move_to_link;
			Object.assign(task_configuration, {
				//namespace: 0,
				for_template: subst_template,
				for_each_template_options: {
					add_index: 'all'
				},
			});

		} else if (task_configuration.move_to_link === REDIRECT_TARGET) {
			task_configuration.move_to_link = await wiki.redirects_root(move_from_link);
			CeL.info(`${prepare_operation.name}: ${CeL.wiki.title_link_of(move_from_link)} redirects to → ${CeL.wiki.title_link_of(task_configuration.move_to_link)}`);
			if (move_from_link === task_configuration.move_to_link) {
				CeL.error(`${prepare_operation.name}: The moving target is the same as the moving source! ` + CeL.wiki.title_link_of(task_configuration.move_to_link));
			}

		} else if (move_from_link === task_configuration.move_to_link) {
			CeL.warn(`The moving target is the same as the moving source: ${CeL.wiki.title_link_of(move_from_link)}`);
		}
		//console.trace(task_configuration);

		/**<code>

		usage of task_configuration.move_from_link →:

		page_name							→	替換所有連結到 page_name 的頁面。
		page_name#anchor					→	僅針對特定 anchor，即 [[page_name#anchor]], [[page_name#anchor|display_text]] 替換。
		page_name|							→	僅針對特定無 display_text，即 [[page_name]], [[page_name#anchor]] 替換。
		page_name|display_text				→	僅針對特定 display_text 替換，不論 anchor。
		ns:page_name#anchor|display_text	→	針對特定 anchor + display_text 替換。

		-----------------------------------------------------------------------------

		usage of → task_configuration.move_to_link:

		page_name							→	保留 anchor，自動判別是否該保留 display_text。可設定 .keep_display_text 以明確指定。
												想清掉 display_text 應該採用 move_to_link=page_name|page_name 或是 .keep_display_text=false
		page_name#							→	清空/清掉 anchor
		page_name#anchor					→	相當於替換成 [[page_name#anchor|#原display_text]]。
		page_name|							→	相當於替換成 [[page_name#原anchor|]]。	注意: 不是清空/清掉 display_text! ** 應明確指定要改成的標的，避免這種表示法。 **
												想清掉 display_text 應該採用 move_to_link=page_name|page_name 或是 .keep_display_text=false
												TODO: 在 <ref> 之類中將失效。
		page_name|display_text				→	相當於替換成 [[page_name#原anchor|display_text]]。保留 anchor。
		ns:page_name#anchor|display_text	→	亦替換 anchor + display_text。

		-----------------------------------------------------------------------------

		對於允許 [[page_name]]→[[page_name_append]] 的情況，由於預設會 [[page_name]]→[[page_name_append|page_name]]，
		因此應該安排成:
		{"page_name|" : 'page_name_append|page_name_append',
		{page_name : 'page_name_append'}

		</code>*/

		if (/#[^\|]+/.test(task_configuration.move_from_link) && typeof task_configuration.move_to_link === 'string' && !/#[^\|]*/.test(task_configuration.move_to_link)) {
			CeL.warn('prepare_operation: .move_from_link 設定了 anchor 但 .move_to_link 未設定 anchor，將自動清除 anchor！若需要保留 anchor，請明確設定 .move_to_link 之 anchor！');
			task_configuration.move_to_link = task_configuration.move_to_link.replace(/($|\|.*)/, '#$1');
		}

		// TODO: keep_letter_case
		if (!('keep_initial_case' in task_configuration) && typeof task_configuration.move_to_link === 'string') {
			// keep_initial_case for Category. e.g., [[Category:eスポーツ]]
			const initial_char_from = wiki.remove_namespace(move_from_link).charAt(0);
			const initial_char_to = wiki.remove_namespace(task_configuration.move_to_link).charAt(0);
			task_configuration.keep_initial_case
				= initial_char_from.toLowerCase() !== initial_char_from.toUpperCase()
				&& initial_char_to.toLowerCase() !== initial_char_to.toUpperCase();
		}

		// TODO: [[ジェイソン・チャンドラー・ウィリアムス]]→[[ジェイソン・ウィリアムス (1975年生のバスケットボール選手)|ジェイソン・ウィリアムス]]
		if (!('keep_display_text' in task_configuration) && typeof task_configuration.move_to_link === 'string'
			// incase → [[title|display text]]; task_configuration.move_to.display_text
			&& !task_configuration.move_to_link.includes('|')
			// 不包含 [[Category:立憲民主党の衆議院議員]]→[[Category:立憲民主党の衆議院議員 (日本 2017)]]
			&& wiki.is_namespace(move_from_link, 'Main')
			// e.g., 20200101.ブランドとしてのXboxの記事作成に伴うリンク修正.js
			// [[A]] → [[A (細分 type)]]
			&& (task_configuration.move_to_link.toLowerCase().includes(move_from_link.toLowerCase())
				// e.g., [[BOSSコーヒー]]→[[ボス (コーヒー)]]
				|| !/ \([^()]+\)$/.test(move_from_link) && / \([^()]+\)$/.test(task_configuration.move_to_link)
				// [[イジー・ス・ポジェブラト]]→[[イジー]] 亦須設定 .keep_display_text
				|| move_from_link.toLowerCase().includes(task_configuration.move_to_link.toLowerCase().replace(/ \([^()]+\)$/, ''))
				// e.g., 20200121.「離陸決心速度」の「V速度」への統合に伴うリンク修正.js
				|| task_configuration.move_to_link.includes('#')
			)) {
			CeL.warn('prepare_operation: Set .keep_display_text = true. 請注意可能有錯誤的 redirect、{{Pathnav}}、{{Main2}}、{{Navbox}} 等編輯!');
			task_configuration.keep_display_text = true;
		}
		//console.trace(task_configuration);

		// 議論場所 Links to relevant discussions
		const discussion_link = task_configuration.discussion_link || meta_configuration.discussion_link;
		const _summary = typeof summary === 'string' ? summary
			: discussion_link ? CeL.wiki.title_link_of(discussion_link, section_title)
				: section_title;
		const _log_to = 'log_to' in task_configuration ? task_configuration.log_to
			: 'log_to' in meta_configuration ? (task_configuration.log_to = meta_configuration.log_to)
				: log_to;
		//console.trace([log_to, _log_to]);

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
				// to →
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
		if (meta_configuration.not_bot_requests) {
			// Skip check
		} else if (typeof diff_id === 'string') {
			diff_id = diff_id.match(/^(\d+)\/(\d+)$/);
			if (!diff_id) {
				CeL.warn(`${prepare_operation.name}: Invalid diff_id: ${diff_id}`);
			} else if (diff_id[1] > diff_id[2]) {
				CeL.warn(`${prepare_operation.name}: Swap diff_id: ${diff_id[0]}`);
				diff_id = `${diff_id[2]}/${diff_id[1]}`;
			} else if (diff_id[1] === diff_id[2]) {
				CeL.warn(`${prepare_operation.name}: Using diff_id: ${diff_id[1]}`);
				diff_id = diff_id[1];
			} else {
				diff_id = diff_id[0];
			}
		} else if (meta_configuration.speedy_criteria) {
		} else if (typeof diff_id !== 'number' || !(diff_id > 0) || Math.floor(diff_id) !== diff_id) {
			CeL.warn(`${prepare_operation.name}: Invalid diff_id: ${diff_id}`);
		}

		task_configuration.summary = {
			summary: String(task_configuration.summary || summary),
			log_to: _log_to ? ` - ${CeL.wiki.title_link_of(_log_to, 'log')}` : ''
		};
		if (!meta_configuration.not_bot_requests) {
			task_configuration.summary.diff_to_add = CeL.wiki.title_link_of(
				diff_id ? `Special:Diff/${diff_id}${CeL.wiki.section_link_escape(_section_title, true)}`
					// Speedy renaming or speedy merging
					: meta_configuration.speedy_criteria === 'merging' ? 'WP:CFDS'
						: meta_configuration.requests_page || bot_requests_page,
				// [[Wikipedia:Categories for discussion/Speedy]]
				// Speedy renaming or speedy merging
				meta_configuration.speedy_criteria ? 'Speedy ' + meta_configuration.speedy_criteria
					: use_language === 'zh' ? '機器人作業請求'
						: use_language === 'ja' ? 'Bot作業依頼' : 'Bot request');
			//console.trace(task_configuration.summary.diff_to_add);
		}
		if (typeof move_from_link !== 'string' && typeof task_configuration.move_to_link !== 'string') {
			task_configuration.summary.title_to_add = '';
		} else if (move_configuration.length === 1
			&& (typeof move_from_link === 'string' && task_configuration.summary.summary.toLowerCase().includes(move_from_link.toLowerCase())
				|| typeof task_configuration.move_to_link === 'string' && task_configuration.summary.summary.toLowerCase().includes(task_configuration.move_to_link.toLowerCase()))) {
			task_configuration.summary.title_to_add = '';
		} else {
			task_configuration.log_section_title_postfix = `(${typeof task_configuration.move_to_link === 'string' && task_configuration.move_to_link || move_from_link})`;
			task_configuration.summary.title_to_add = ' ' + task_configuration.log_section_title_postfix;
		}
		task_configuration.summary = (task_configuration.summary.diff_to_add
			? task_configuration.summary.diff_to_add + ': ' : '')
			+ task_configuration.summary.summary
			+ task_configuration.summary.title_to_add
			+ task_configuration.summary.log_to;
		//console.trace(task_configuration.summary);

		// .also_move_page
		if (task_configuration.do_move_page) {
			if (typeof move_from_link !== 'string') {
				throw new TypeError('`move_from_link` should be {String}!');
			}
			// 作業前先移動原頁面。
			task_configuration.do_move_page = {
				// https://www.mediawiki.org/wiki/API:Move
				reason: task_configuration.summary,
				movetalk: 1,
				//noredirect: 1, movesubpages: 1,
				...task_configuration.do_move_page
			};
			try {
				const page_data = await wiki.page(move_from_link);
				if (!page_data.missing && CeL.wiki.parse.redirect(page_data) !== task_configuration.move_to_link) {
					// カテゴリの改名も依頼に含まれている
					// TODO: 移動元に即時削除テンプレートを貼っていただくことはできないでしょうか。
					await wiki.move_to(task_configuration.move_to_link, task_configuration.do_move_page);
				}
			} catch (e) {
				if (e.code !== 'missingtitle' && e.code !== 'articleexists') {
					if (e.code) {
						CeL.error([prepare_operation.name + ': ', {
							// gettext_config:{"id":"move-$1-to-$2-failed-$3"}
							T: ['Move %1 to %2 failed: %3', CeL.wiki.title_link_of(move_from_link), CeL.wiki.title_link_of(task_configuration.move_to_link), `[${e.code}] ${e.info}`]
						}]);
					} else {
						console.error(e);
					}
					// continue;
				}
			}
		}

		// Also used in wiki/routine/20211203.synchronizing_common_pages.js
		if (task_configuration.also_replace_display_text) {
			if (!Array.isArray(task_configuration.also_replace_display_text)) {
				// e.g., .also_replace_display_text = "/ムスターカス/ムスタカス/"
				task_configuration.also_replace_display_text = [task_configuration.also_replace_display_text];
			}
			task_configuration.also_replace_display_text = task_configuration.also_replace_display_text.map(pattern => {
				if (typeof pattern === 'string') {
					// e.g., pattern = "/ムスターカス/ムスタカス/"
					return pattern.to_RegExp({ allow_replacement: true });
				}
				// e.g., pattern = ["ムスターカス", "ムスタカス/"]
				return pattern;
			}).filter(pattern => {
				if (Array.isArray(pattern) && pattern.length === 2
					&& typeof pattern[0] === 'string' && pattern[0]
					&& (pattern[1] || pattern[1] === ''))
					return true;
				if (CeL.is_RegExp(pattern) && typeof pattern.replace === 'function')
					return true;
				CeL.error(`Ignore invalid .also_replace_display_text pattern: ${pattern}`);
			});
		}

		if (meta_configuration.replace_text && !('replace_text' in task_configuration))
			task_configuration.replace_text = meta_configuration.replace_text;
		if (meta_configuration.replace_text_pattern && !('replace_text_pattern' in task_configuration))
			task_configuration.replace_text_pattern = meta_configuration.replace_text_pattern;
		if (task_configuration.replace_text || task_configuration.replace_text_pattern) {
			// Initialize `task_configuration.replace_text`
			if (task_configuration.replace_text === true) {
				if (task_configuration.move_to_link.includes('|')) {
					CeL.error('The option .replace_text===true is only for [[from]] → [[to]], NOT for [[from]] → [[to|display_text]]! Please use .replace_text={"":""} instead!');
				}
				task_configuration.replace_text = { [task_configuration.move_from_link]: task_configuration.move_to_link };
			}
			if (task_configuration.replace_text && !task_configuration.replace_text_pattern) {
				// Prevent replace page title in wikilink 必須排除 {{Redirect|text}}, [[text|]] 之類！
				// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions/Assertions#other_assertions
				task_configuration.replace_text_pattern = new RegExp(/(?<!{{ *|\[\[ *)(?:key)/.source.replace('key', Object.keys(task_configuration.replace_text).join('|')), 'g');
			} else if (typeof task_configuration.replace_text_pattern === 'string' && CeL.PATTERN_RegExp_replacement.test(task_configuration.replace_text_pattern)) {
				task_configuration.replace_text_pattern = task_configuration.replace_text_pattern.to_RegExp({ allow_replacement: true });
			}
			if (!CeL.is_RegExp(task_configuration.replace_text_pattern) || !task_configuration.replace_text_pattern.global) {
				CeL.error(`${prepare_operation.name}: "replace_text_pattern" should have global flag! The operation will continue anyway.`);
				console.trace({ replace_text_pattern: task_configuration.replace_text_pattern, replace_text: task_configuration.replace_text });
			}
		}
		//console.trace(task_configuration.replace_text_pattern);

		task_configuration[KEY_wiki_session] = wiki;
		await main_move_process(task_configuration, meta_configuration);
		//console.trace(`Done: ${task_configuration.summary}`);
	}

	if (meta_configuration.external_program_running
		&& meta_configuration.external_program_running.size > 0) {
		await Promise.allSettled(Array.from(meta_configuration.external_program_running.values()));
	}

	await finish_work(meta_configuration);
}

async function finish_work(meta_configuration) {
	/** {Object}wiki operator 操作子. */
	const wiki = meta_configuration[KEY_wiki_session];

	if (!meta_configuration.no_notice)
		await notice_finished(wiki, meta_configuration);
}

// separate namespace and page name
function parse_move_link(link, session) {
	// /^(?<namespace>[^:]+):(?<page_name>.+)$/
	const matched = typeof link === 'string' && session.normalize_title(link, { no_upper_case_initial: true, keep_anchor: true })
		// TODO: use wiki.parse()
		.match(/^((?:([^:]+):)?([^#\|]+))(?:#([^\|]*))?(?:\|(.*))?$/);
	if (!matched)
		return;
	//console.trace([link, matched]);

	const _session = session || CeL.wiki;
	const ns = _session.namespace(matched[2]) || _session.namespace('Main');
	return {
		// "ns:page_name#anchor|display_text"
		// link: matched[0],

		// page_title: 'ns:page_name'	{{FULLPAGENAME}}
		page_title: matched[1],
		// namespace	{{NAMESPACE}}
		ns: ns,
		// page name only, without namespace {{PAGENAME}}
		page_name: matched[3],
		// anchor without '#'
		anchor: matched[4],
		display_text: matched[5],

		need_check_colon: ns === _session.namespace('Category') || ns === _session.namespace('File')
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
	let move_from_link = remove_slash_tail(this.move_from_link);
	let move_to_link = remove_slash_tail(this.move_to_link || this.move_to_url);
	// 避免置換後造成雙重倒斜線 '//'。
	if (move_from_link.endsWith('/') ^ move_to_link.endsWith('/')) {
		if (move_from_link.endsWith('/'))
			move_to_link += '/';
		else
			move_from_link += '/';
	}

	let changed;
	if (!this.external_link_only) {
		// .all_link_pattern
		// [\/]: 避免 https://web.archive.org/web/000000/http://www.example.com/
		// TODO: flag: 'ig'
		const PATTERN_url = new RegExp('(^|\W)' + CeL.to_RegExp_pattern(move_from_link), 'g');
		// console.trace(PATTERN_url);
		wikitext = wikitext.replace(PATTERN_url, function (all, prefix) {
			changed = true;
			return prefix + move_to_link;
		});
		return changed && wikitext;
	}

	/** {Array} parsed page content 頁面解析後的結構。 */
	const parsed = page_data.parse();
	CeL.assert([page_data.wikitext, parsed.toString()], 'wikitext parser check: ' + CeL.wiki.title_link_of(page_data));
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
		CeL.warn(`${text_processor_for_exturlusage.name}: There is still "${CeL.wiki.title_link_of(move_from_link)}" left!`);
	}
	if (changed)
		return wikitext;
}

// ----------------------------------------------

// リンク 参照読み込み 転送ページ
const default_list_types = 'backlinks|embeddedin|redirects|categorymembers|fileusage'.split('|');

// |プロジェクト
/** {String}default namespace to search and replace */
const default_namespace = 'main|file|module|template|category|help|portal';
// 'talk|template_talk|category_talk'

async function get_list(task_configuration, list_configuration) {
	if (!list_configuration) {
		list_configuration = task_configuration;
	} else if (typeof list_configuration === 'string') {
		list_configuration = { move_from_link: list_configuration };
	}

	const wiki = task_configuration[KEY_wiki_session];

	//console.trace([task_configuration, list_configuration]);
	if (list_configuration.get_task_configuration_from && !list_configuration.page_list) {
		const get_list_from_page = list_configuration.get_list_from_page || list_configuration.move_from_link;
		list_configuration.page_list = await parse_move_pairs_from_page(get_list_from_page, { [KEY_wiki_session]: wiki, ...list_configuration, is_list: true });
	}

	let list_types;
	if (list_configuration.list_types) {
		// empty, using page_list to debug: list_types:[],
		list_types = list_configuration.list_types;
	} else if (CeL.is_RegExp(list_configuration.move_from_link)) {
		list_types = 'search';
	} else if (typeof list_configuration.move_from_link !== 'string') {
		throw new Error(`Invalid move_from_link: ${JSON.stringify(list_configuration.move_from_link)}`);
	} else if (/^-?(?:insource|intitle|incategory|linksto|hastemplate|namespace|prefix|deepcat|inlanguage|contentmodel|subpageof|morelike|prefer-recent|neartitle|boost-neartitle|filemime|filesize|filew|filewidth|fileh|fileheight|fileres|filebits):/.test(list_configuration.move_from_link)) {
		list_types = 'search';
	} else if (/^(https?:)\/\//.test(list_configuration.move_from_link)) {
		// should have task_configuration.text_processor()
		list_types = 'exturlusage';
	} else if (!task_configuration.move_to_link && task_configuration.for_template
		//&& wiki.is_namespace(task_configuration.move_from_link, 'Template')
	) {
		// replace template only.
		list_types = 'embeddedin';
	} else {
		list_types = default_list_types;
	}
	if (!task_configuration.list_types)
		task_configuration.list_types = list_types;

	if (typeof list_types === 'string') {
		list_types = list_types.split('|');
	}
	let list_options = {
		// combine_pages: for list_types = 'exturlusage'
		// combine_pages: true,
		// e.g., namespace : 0,
		namespace: list_configuration.namespace ?? task_configuration.namespace ?? default_namespace,
	};

	if (list_types.join() === 'exturlusage') {
		list_configuration.move_from = {
			page_title: list_configuration.move_from_link
		};

		if (task_configuration !== list_configuration) {
			// Skip
		} else if (task_configuration.replace_protocol_to && !task_configuration.move_to_link) {
			// e.g., {'http://www.example.com/':{replace_protocol_to:'https'}}
			// →
			// {'http://www.example.com/':{replace_protocol_to:'https',move_to_url:'https://www.example.com/'}}
			// Overwrite `task_configuration.move_to_url`
			task_configuration.move_to_url = task_configuration.move_from_link.replace(/^.+?:\/\//, task_configuration.replace_protocol_to.replace(/:$/, '') + '://');
		}

		if (task_configuration !== list_configuration) {
			// Skip
		} else if (!task_configuration.text_processor && (task_configuration.move_to_link || task_configuration.move_to_url)) {
			// e.g.,
			// {'http://www.example.com/':{external_link_only:true,move_to_link:'https://www.example.com/'}}
			// {'http://www.example.com/':{replace_protocol_to:'https',external_link_only:true}}
			// {'http://www.example.com/':'https://www.example.com/'}
			task_configuration.text_processor = text_processor_for_exturlusage;
		}

	} else if (list_types.join() !== 'search') {
		if (list_configuration.move_from_link) {
			// separate namespace and page name
			list_configuration.move_from = {
				...parse_move_link(list_configuration.move_from_link, wiki),
				...list_configuration.move_from
			};
			list_configuration.move_from_link = wiki.normalize_title(list_configuration.move_from_link);
			//console.trace([task_configuration.move_from, list_configuration.list_types, list_configuration.move_from.ns]);
			// 手動設定另當別論。
			if (list_types.includes('embeddedin') && list_configuration.move_from.ns !== wiki.namespace('Category')) {
				list_types = list_types.filter(type => type !== 'categorymembers');
				if (list_configuration.move_from.ns === wiki.namespace('Template')) {
					const redirect_list = (await wiki.register_redirects(list_configuration.move_from_link))?.redirect_list;
					if (list_types.includes('embeddedin') && redirect_list?.length > 1
						&& task_configuration.for_template
						//subst:
						&& task_configuration.for_template !== subst_template) {
						CeL.error(`由於 ${list_configuration.move_from_link} 有 redirects，必須對所有 redirects 個別執行 embeddedin，或採用 wiki_session.is_template()，否則會有疏漏未處理之頁面！`);
					}
				}
			}
		} else {
			// There is no list_configuration.move_from_link for list_types: 'allcategories'
		}

		if (task_configuration !== list_configuration) {
			// Skip
		} else {
			const move_to = parse_move_link(task_configuration.move_to_link, wiki);
			if (move_to) {
				task_configuration.move_to = {
					...move_to,
					...task_configuration.move_to
				};

				// display_text_replacer 表記の変更
				// @see .also_replace_text_insource, .replace_text
				// 當設定 .keep_display_text 的時候就不改變 display text。
				if (!task_configuration.keep_display_text
					&& move_to.page_name && task_configuration.move_from.page_name
					&& !move_to.display_text && !task_configuration.move_from.display_text) {
					// [[A (C)]] → [[B (C)]]	則同時把 [[A (C)|A]] → [[B (C)|B]], [[A (C)|A君]] → [[B (C)|B君]]
					// [[A]] → [[B]]			則同時把 [[A|A ...]] → [[B|B ...]]
					// e.g., [[w:ja:Special:Diff/83431400/84451965]]
					// also replace display_text in [[MARの登場人物#anchor|MARの登場人物 ...]]→[[MÄRの登場人物#anchor|MÄRの登場人物 ...]]
					let replace_from = task_configuration.move_from.page_name.match(/^(.+?) +\([^()]+\)$/);
					replace_from = replace_from ? replace_from[1] : task_configuration.move_from.page_name;
					const replace_to = move_to.page_name.replace(/ +\([^()]+\)$/, '');
					if (replace_from
						// 須避免 [[出雲 (列車)]] → [[サンライズ出雲]] 產生 /出雲/サンライズ出雲/g
						// 須避免 [[Girls (テレビドラマ)]] → [[GIRLS/ガールズ]] 產生 /Girls/GIRLS\/ガールズ/g
						&& !replace_to.toLowerCase().includes(replace_from.toLowerCase())) {
						const also_replace_display_text = [new RegExp(CeL.to_RegExp_pattern(replace_from), 'g'), replace_to];
						//console.trace(also_replace_display_text);
						CeL.info({
							// gettext_config:{"id":"automatically-replace-the-display-text-of-links-$1→$2"}
							T: ['Automatically replace the display text of links: %1→%2', also_replace_display_text[0].toString(), also_replace_display_text[1]]
						});
						if (!task_configuration.also_replace_display_text)
							task_configuration.also_replace_display_text = [];
						task_configuration.also_replace_display_text.push(also_replace_display_text);
						//console.trace(task_configuration.also_replace_display_text);
					}
					// TODO: [[マイク・ムスターカス|ムスターカス]] → [[マイク・ムスタカス|ムスタカス]]
				}

				//console.log(task_configuration.move_from);
				//console.log(task_configuration.move_to);
				if (task_configuration.move_from.page_title === task_configuration.move_to.page_title && !task_configuration.move_to.display_text) {
					if (task_configuration.move_to.display_text === '') {
						// @see function prepare_operation()
						CeL.error(`將替換成 [[${CeL.wiki.title_link_of(task_configuration.move_to_link)}]]。應明確指定要改成的標的，避免這種表示法。若您想保持原 display_text，可將 move_to_link 設定為 ${JSON.stringify(`${task_configuration.move_from.page_title}|${task_configuration.move_from.page_title}`)}。`);
					} else if (task_configuration.move_from.display_text) {
						CeL.warn(`移動前後的頁面標題 ${JSON.stringify(list_configuration.move_from_link)} 相同，卻未設定移動後的 display_text。將會消掉符合條件連結之 display_text！`);
					}
				}
			}
		}

	} else if (task_configuration !== list_configuration) {
		// Skip
	} else if (!task_configuration.text_processor && typeof task_configuration.move_to_link === 'string') {
		if (!task_configuration.replace_from) {
			let move_from_string = list_configuration.move_from_link.match(/^insource:(.+)$/);
			if (!move_from_string) {
				CeL.warn(`${get_list.name}: Should set text_processor() with list_types=${list_types}!`);
			} else {
				move_from_string = move_from_string[1];
				let replace_from = move_from_string.match(CeL.PATTERN_RegExp);
				if (replace_from) {
					// Should use {'note':{move_from_link:/move from string/,move_to_link:'move to string'}}
					// instead of {'insource:/move from string/':'move to string'}
					replace_from = new RegExp(replace_from[1], 'g' + (replace_from[2].includes('i') ? 'i' : ''));
				} else {
					// e.g., {'insource:"move from string"':'move to string'}
					replace_from = move_from_string.match(/^"([^"]+)"$/);
					replace_from = new RegExp(CeL.to_RegExp_pattern(replace_from ? replace_from[1] : move_from_string), 'g');
				}
				list_configuration.replace_from = replace_from;
			}
		}
		if (list_configuration.replace_from)
			task_configuration.text_processor = text_processor_for_search;
		// console.log(task_configuration);
	}

	if (!list_configuration.move_from)
		list_configuration.move_from = Object.create(null);

	// for debug or 直接指定頁面列表。
	// 利用 `list_configuration.page_list` 可以直接指定要使用的頁面列表 `page_list`。
	let page_list = list_configuration.page_list;
	if (typeof page_list === 'function') {
		page_list = await page_list.call(list_configuration, task_configuration);
	}

	/** {String|Array} page title (list) to get pages to process. */
	const list_title_list = list_configuration.list_title || list_configuration.move_from?.page_title || list_configuration.move_from_link;
	// TODO: fix if list_title_list !== list_configuration.move_from_link

	//console.trace([list_title_list, CeL.is_RegExp(list_title_list)]);
	const list_label = list_title_list
		? list_types.join() === 'search' ? list_title_list : CeL.wiki.title_link_of(list_title_list)
		: list_types;
	let need_unique;
	if (Array.isArray(page_list)) {
		// Only for get .pageid & .ns
		//page_list = await wiki.page(page_list, { rvprop: 'ids' });
		//console.trace(page_list);
		//console.trace(page_list[0]);
		CeL.info([get_list.name + ': ', {
			// gettext_config:{"id":"processed-$1-pages"}
			T: ['Processed %1 {{PLURAL:%1|page|pages}}.', page_list.length]
		}]);
		need_unique = true;
		// Warning: Should filter 'Wikipedia|User' yourself!
	} else {
		page_list = null;
		const allitional_notes = list_configuration.move_from_link && list_configuration.move_from_link !== list_title_list ? ` (${JSON.stringify(list_configuration.move_from_link)})` : '';
		CeL.info([get_list.name + ': ', list_title_list ? {
			// gettext_config:{"id":"get-list-of-$1-from-$2"}
			T: ['Get list of %1 from %2.',
				(list_types.join() === 'search' ? list_title_list : CeL.wiki.title_link_of(list_title_list)) + allitional_notes,
				wiki.site_name()
			]
		} : allitional_notes, {
			// gettext_config:{"id":"list-types-$1"}
			T: ['List types: %1.',
				// gettext_config:{"id":"Comma-separator"}
				list_types.join(CeL.gettext('Comma-separator'))]
		}, {
			// gettext_config:{"id":"namespaces-$1"}
			T: ['Namespaces: %1.', list_options.namespace]
		}]);
		const list_filter = list_configuration.list_filter;
		for (const list_title of (Array.isArray(list_title_list) ? list_title_list : [list_title_list])) {
			for (const type of list_types) {
				let list_segment = await wiki[type](list_title, list_options);
				if (list_filter) {
					list_segment = list_segment.filter(list_filter);
				}
				if (page_list) {
					page_list.append(list_segment);
					need_unique = true;
				} else
					page_list = list_segment;
				CeL.log_temporary(`${list_label}: ${page_list.length} pages`);
			}
		}

		if (false) {
			page_list = page_list.filter((page_data) => {
				return !wiki.is_namespace(page_data, 'Wikipedia')
					&& !wiki.is_namespace(page_data, 'User')
					// && !page_data.title.includes('/過去ログ')
					;
			});
		}
	}

	// ------------------------------------------------------------------------

	let excluding_pages = new Set();

	// 排除類別。
	if (list_configuration.excluding_categories) {
		for (const category_name of list_configuration.excluding_categories) {
			const excluding_page_list = await wiki.categorymembers(category_name);
			//console.trace([category_name, excluding_page_list]);
			excluding_page_list.forEach(page_data => excluding_pages.add(page_data.title));
		}
		//need_unique = excluding_pages.size > 0;
	}
	//console.trace([list_configuration.excluding_categories, excluding_pages]);

	if (excluding_pages.size > 0) {
		const page_list_Set = new Set();
		const new_page_list = [];
		for (const page_data of page_list) {
			const page_title = page_data.title;
			if (!page_list_Set.has(page_title) && !excluding_pages.has(page_title)) {
				page_list_Set.add(page_title);
				new_page_list.push(page_data);
			}
		}
		page_list = new_page_list;
	} else if (need_unique) {
		page_list = page_list.unique(page_data => CeL.wiki.title_of(page_data));
	}
	//console.trace(page_list);

	if (/*list_configuration.is_tracking_category && */list_configuration.move_from.ns === wiki.namespace('Category')) {
		page_list.forEach(page_data => {
			if (wiki.is_namespace(page_data, 'Template') || wiki.is_namespace(page_data, 'Module')) {
				const title = CeL.wiki.title_of(page_data);
				// ks: '/دَستاویز'
				if (title.endsWith('/doc') || page_list.includes(title + '/doc'))
					return;
				const doc_title = title + '/doc';
				if (page_list.includes(doc_title))
					return;

				CeL.warn(`${get_list.name}: +${CeL.wiki.title_link_of(doc_title)}: 對於追蹤類別 [[Category:Tracking categories]] 或 template/doc 中包含 <includeonly>[[Category:name]]</includeonly>，不會算入 [[Template:name/doc]]。例如 [[Category:Pages using deprecated source tags]]`);
				page_list.push(doc_title);
				page_list.options = { redirects: 1, ...page_list.options };
			}
		});
		//console.log(page_list);
	}
	if (list_configuration.page_limit >= 1) {
		CeL.info(`${get_list.name}: Limit to ${list_configuration.page_limit}/${page_list.length} page(s) got from ${list_label}`);
		const page_list_options = page_list.options;
		page_list = page_list.truncate(list_configuration.page_limit);
		// for debug
		//page_list = page_list.slice(1, 2);
		if (page_list_options)
			page_list.options = page_list_options;
	} else {
		CeL.info([get_list.name + ': ', {
			// gettext_config:{"id":"get-$1-pages-from-$2"}
			T: ['Get %1 {{PLURAL:%1|page|pages}} from %2', page_list.length, list_label]
		}]);
	}

	// for debug
	//page_list = ['Wikipedia:サンドボックス'];

	// console.log(page_list);

	return page_list;
}

async function main_move_process(task_configuration, meta_configuration) {
	//console.trace(meta_configuration);
	//console.trace(task_configuration);

	for (const option of ['namespace']) {
		if (option in meta_configuration) {
			task_configuration[option] = meta_configuration[option];
		}
	}

	let page_list = await get_list(task_configuration);
	//console.log(page_list.length);
	//console.log(page_list.slice(0, 10));

	let list_intersection = task_configuration.list_intersection;
	if (list_intersection && (typeof list_intersection === 'string' || CeL.is_Object(list_intersection))) {
		list_intersection = [list_intersection];
	}
	// 當設定 list_intersection 時，會取得 task_configuration.move_from_link 與各 list_intersection 的交集(AND)。
	if (Array.isArray(list_intersection)) {
		for (const list_configuration of list_intersection) {
			const sub_page_id_hash = Object.create(null);
			// e.g., for redirects
			Object.assign(list_configuration, page_list.options);
			//console.trace(list_configuration);
			(await get_list(task_configuration, list_configuration)).forEach(page_data => { sub_page_id_hash[page_data.pageid] = null; });
			page_list = page_list.filter(page_data => page_data.pageid in sub_page_id_hash);
		}
	}
	//console.log(page_list.length);
	//console.log(page_list.slice(0, 10));

	const wiki = task_configuration[KEY_wiki_session];
	const work_config = {
		// Allow content to be emptied. 允許內容被清空。白紙化。
		allow_empty: /talk/.test(task_configuration.namespace),
		task_configuration,
		// for 「株式会社リクルートホールディングス」の修正
		// for リクルートをパイプリンクにする
		// page_options: { rvprop: 'ids|content|timestamp|user' },
		log_to: 'log_to' in task_configuration ? task_configuration.log_to : log_to,
		summary: task_configuration.summary,
		log_section_title_postfix: task_configuration.log_section_title_postfix,
	};
	//console.trace(work_config);
	for (const option of work_option_switches) {
		//work_config[option] = task_configuration[option] ?? meta_configuration[option];
		if (option in task_configuration) {
			work_config[option] = task_configuration[option];
		} else if (option in meta_configuration) {
			work_config[option] = meta_configuration[option];
		}
	}
	// e.g., for redirects
	work_config.page_options = { ...work_config.page_options, ...page_list.options };
	//console.trace(work_config);
	if (typeof task_configuration.before_get_pages === 'function') {
		await task_configuration.before_get_pages(page_list, work_config, { meta_configuration, bot_requests_page });
	}
	//page_list = page_list.slice(0, 3);
	//page_list = [await wiki.page('Priject:Sandbox')];
	await wiki.for_each_page(page_list, function () {
		// 注意: this !== work_config === `config`

		this.task_configuration = task_configuration;
		//Object.assign(this, { task_configuration });
		return for_each_page.apply(this, arguments);
	}, work_config);

	// TODO: 對於同一個頁面，應該在最後一次更改完後才執行。否則可能干擾本身作業。
	if (task_configuration.fix_anchor) {
		// @see https://nodejs.org/api/vm.html#vm_script_runinnewcontext_contextobject_options
		const command_list = ['../routine/20201008.fix_anchor.js',
			'use_language=' + use_language,
			'check_page=' + task_configuration.move_from.page_title,
			'backlink_of=' + task_configuration.move_to.page_title
		];
		const command_id = 'fix_anchor:' + task_configuration.move_to.page_title;
		const command = command_list.join(' ');
		if (!meta_configuration.external_program_running) {
			meta_configuration.external_program_running = new Map;
		}
		if (meta_configuration.external_program_running.has(command_id)) {
			CeL.info(`${main_move_process.name}: Already executing command${command_id === command ? '' : ` (${command_id})`}: ${command}`);
		} else {
			CeL.info(`${main_move_process.name}: Execute command: ${command}`);
			meta_configuration.external_program_running.set(command_id, new Promise((resolve, reject) => {
				require('child_process').spawn('node', command_list).on('close', code => {
					if (code !== 0) {
						CeL.error(`Command returns ${code}: ${command}`)
						//reject(code);
					}
					resolve(code);
					meta_configuration.external_program_running.delete(command_id);
				});
			}));
		}
	}

	if (task_configuration.postfix) {
		try {
			await task_configuration.postfix();
		} catch (e) {
			console.error(e);
		}
	}
}

// ---------------------------------------------------------------------//

async function for_each_page(page_data) {
	// console.log(page_data.revisions[0].slots.main);
	//console.trace(this);
	const { task_configuration } = this;
	//console.trace(task_configuration);

	if (task_configuration.text_processor) {
		const replace_to = task_configuration.text_processor(page_data.wikitext, page_data, /* work_config */this);
		return typeof replace_to === 'string' && replace_to
			// 完全相同，放棄修改。 options.changed_only
			&& replace_to !== page_data.wikitext ? replace_to : Wikiapi.skip_edit;
	}

	/** {Array} parsed page content 頁面解析後的結構。 */
	const parsed = page_data.parse();
	// console.log(parsed);
	CeL.assert([page_data.wikitext, parsed.toString()], 'wikitext parser check: ' + CeL.wiki.title_link_of(page_data));

	task_configuration.page_data = page_data;

	const list_types = task_configuration.list_types;
	//console.trace([list_types, task_configuration.move_from]);

	if ((list_types.includes('backlinks') || list_types.includes('redirects'))
		&& (task_configuration.move_to_link || task_configuration.for_each_link)) {
		parsed.each('link', for_each_link.bind(task_configuration));
	}
	if (list_types.includes('fileusage') && task_configuration.move_to_link) {
		parsed.each('file', for_each_file.bind(task_configuration));
	}
	if (list_types.includes('categorymembers') && task_configuration.move_to_link && task_configuration.move_from.ns === CeL.wiki.namespace('Category')) {
		parsed.each('category', for_each_category.bind(task_configuration));
	}
	if (list_types.includes('embeddedin') && !task_configuration.move_from.anchor && !task_configuration.move_from.display_text) {
		await parsed.each('template', for_each_template.bind(this, page_data), task_configuration.for_each_template_options);
	}
	//console.trace(`${for_each_page.name}: ${page_data.title}`);

	if (task_configuration.post_text_processor) {
		return task_configuration.post_text_processor(parsed, page_data) || Wikiapi.skip_edit;
	}

	if (this.discard_changes) {
		// 手動放棄修改。
		return Wikiapi.skip_edit;
	}

	let wikitext = parsed.toString();
	// {Object}task_configuration.replace_text: only replace the text in the target pages
	if (task_configuration.replace_text_pattern) {
		// Warning: 必須排除 {{Redirect|text}}, [[text|]] 之類！
		//console.trace([task_configuration.replace_text_pattern.replace, task_configuration.replace_text_pattern, task_configuration.replace_text, wikitext]);
		if (task_configuration.replace_text_pattern.replace) {
			wikitext = task_configuration.replace_text_pattern.replace(wikitext);
		} else {
			wikitext = wikitext.replace(task_configuration.replace_text_pattern, (matched_all, replace_from_text) => {
				const replace_to = task_configuration.replace_text[typeof replace_from_text === 'string' && replace_from_text || matched_all];
				//console.trace([matched_all, replace_from_text, replace_to]);
				return replace_to || matched_all;
			});
		}
	}

	if (wikitext === page_data.wikitext) {
		// 完全相同，放棄修改。 options.changed_only
		return Wikiapi.skip_edit;
	}
	// return wikitext modified.
	return wikitext;
}


// ---------------------------------------------------------------------//

// preserve style: ''' , '' , <span style="color: black;"></span>
const PATTERN_need_to_preserve_style = /''|color\s[:=]/;

// e.g., 'title': { for_each_link: replace_tool.remove_duplicated_display_text },
function remove_duplicated_display_text(token, index, parent) {
	if (token[2] && (token[0] + token[1]).trim() === CeL.wiki.wikitext_to_plain_text(token[2]).trim()
		&& !PATTERN_need_to_preserve_style.test(token[2])) {
		token.pop();
	}
}

function for_each_link(token, index, parent) {
	// token: [ page_name, anchor / section_title, displayed_text ]
	const page_title = this[KEY_wiki_session].normalize_title(token[0].toString() || this.page_data.title);
	const page_title_data = parse_move_link(page_title, this[KEY_wiki_session]);
	//console.trace([page_title, page_title_data, this.move_from]);

	// if (page_title === this.move_from.page_title) console.log(token);
	//if (page_title.includes('アップル')) console.log(token);
	//if (page_title.includes(this.move_from.page_name))console.log(token);

	if (!page_title_data
		// 檢查命名空間是否正確。排除錯誤的命名空間。
		|| page_title_data.ns !== this.move_from.ns
		// this[KEY_wiki_session].normalize_title(this.move_from.page_name): 這邊的 (this.move_from.page_name) 可能是 no_upper_case_initial 的。
		|| page_title_data.page_name !== this[KEY_wiki_session].normalize_title(this.move_from.page_name)
		// 排除錯誤的 anchor。
		|| typeof this.move_from.anchor === 'string' && this.move_from.anchor !== token.anchor
		// 排除錯誤的 display text。
		|| typeof this.move_from.display_text === 'string' && this.move_from.display_text !== (token[2] || '').toString().trim()
		// 排除連結標的與頁面名稱相同的情況。
		//|| this.page_data.title === this.move_to_link
	) {
		return;
	}
	//console.log(token);
	//console.log(page_title);
	//console.log(this);

	if (this.for_each_link) {
		return this.for_each_link(token, index, parent);
	}

	if (this.move_to_link === DELETE_PAGE) {
		// e.g., [[.move_from.page_title]]
		// console.log(token);
		if (this.move_from.ns === this[KEY_wiki_session].namespace('Category')
			|| this.move_from.ns === this[KEY_wiki_session].namespace('File')) {
			return remove_token;
		}
		if (token[2] || !token[1] && this.move_from.ns === this[KEY_wiki_session].namespace('Main')) {
			if (this.move_from.ns !== this[KEY_wiki_session].namespace('Main')) {
				// 直接只使用 displayed_text。
				CeL.info(`${for_each_link.name}: Using displayed text directly: ${CeL[KEY_wiki_session].title_link_of(this.page_data)}`);
			}
			// リンクを外してその文字列にして
			parent[index] = token[2] || token[0];
		} else {
			console.trace(token);
			// e.g., リダイレクト解消
			CeL.assert(token[2] || !token[1] && this.move_from.ns === this[KEY_wiki_session].namespace('Main'), `${for_each_link.name}: namesapce must be main or category / file when delete page`);
		}
		return;
	}

	if (CeL.wiki.data.is_DAB(page_title) && !CeL.wiki.data.is_DAB(this.move_to.page_title)
		// 避免消歧義頁被連結到特定定義頁面。 e.g., [[w:ja:Special:Diff/89467425|沙崙駅 (曖昧さ回避)]]
		&& this.move_to.page_title.startsWith(this.move_from.page_title) && /^ *\([^()]+\)$/.test(this.move_to.page_title.slice(this.move_from.page_title.length))
	) {
		return;
	}

	const matched = this.move_to_link.match(/^([^()]+?) +\([^()]+\)$/);
	if (matched) {
		// e.g., move_to_link: 'movie (1985)', 'movie (disambiguation)'
		// TODO
	}
	//console.trace(token);

	if (this.keep_display_text) {
		// e.g., [[.move_from.page_title]] →
		// [[move_to_link|.move_from.page_title]]
		// [[.move_from.page_title|顯示名稱]] → [[move_to_link|顯示名稱]]
		CeL.assert(this.move_from.ns === this[KEY_wiki_session].namespace('Main') || this.move_from.ns === this[KEY_wiki_session].namespace('Category'), `${for_each_link.name}: keep_display_text: Must be article (namesapce: main) or Category`);
		// 將原先的頁面名稱轉成顯示名稱。
		// keep original title
		// [[原先的頁面名稱#anchor]] → [[move_to_link]]
		if (!token[2]) {
			if (this.keep_display_text === 'title'
				// [[A (B)]] → [[A (C)]] 遇到 `[[A (B)]]` 時不必保留 display_text。
				|| !token[1] && !/ \([^()]+\)$/.test(/* token[0] 可能包含前後空白 */ this.move_from.page_title)) {
				// [[原先的頁面名稱]] → [[move_to_link|原先的頁面名稱]]
				// [[原先的頁面名稱#anchor]] → [[move_to_link|原先的頁面名稱]]
				token[2] = token[0];
			} else if (this.keep_display_text === 'title+anchor') {
				// [[原先的頁面名稱#anchor]] → [[move_to_link|原先的頁面名稱#anchor]]
				token[2] = token[0] + token[1];
			} else if (this.keep_display_text === 'anchor') {
				// [[原先的頁面名稱#anchor]] → [[move_to_link|#anchor]]
				token[2] = token[1];
			} else if (this.keep_display_text === 'anchor name') {
				// [[原先的頁面名稱#anchor]] → [[move_to_link|anchor]]
				token[2] = token[1].toString().replace(/^#/, '');
			} else {
				// e.g., this.keep_display_text === true
				// move_to_link='title': [[原先的頁面名稱#anchor]] → [[move_to_link#anchor]]
				// move_to_link='title#': [[原先的頁面名稱#anchor]] → [[move_to_link]]
			}
		}
	} else {
		const display_text = this.move_to.display_text;
		if (display_text || display_text === '') {
			token[2] = display_text;
		}
		if (/*!this.keep_display_text &&*/ token[2] && !token[1] && token[0].toString().trim() === token[2].toString().trim()) {
			// 必須(!this.keep_display_text)，預防 [[A]] → [[A|A]] → [[A]] → [[A (B)]]
			// 經過 this.keep_display_text 後，可能獲得:
			// [[A (B)|A (B)]] → [[A (B)]]
			// [[title|title]] → [[title]]
			// 也有可能原先就是這樣子的標示。
			token.pop();
		}
	}

	//console.trace(this.also_replace_display_text);
	// 替換 display text。
	if (token[2] && this.also_replace_display_text) {
		token[2] = token[2].toString();
		// assert: this.also_replace_display_text = [ {RegExp} generated by "".to_RegExp(), [replace from, replace to], ... ]
		this.also_replace_display_text.forEach(pattern => {
			// 「[[ノエル (2003年の映画)|NOEL ノエル]]」が「[[NOEL (2003年の映画)|NOEL NOEL]]」という修正になっていました
			if (!token[2].includes(pattern.replace_to || pattern[1]))
				token[2] = pattern.replace ? pattern.replace(token[2]) : token[2].replace(pattern[0], pattern[1]);
		});
	}
	// console.log('~~~~~~~~');
	//console.trace(token);

	// 替換頁面。
	// TODO: using original namesapce
	if (this.move_to.need_check_colon && (
		// e.g., [[title]] → [[:File:f2]]
		!this.move_from.need_check_colon
		// e.g., [[:File:f1]] → [[:File:f2]]
		|| /^(?:w|c|commons)?:/.test(token[0].toString()))) {
		token[0] = ':' + this.move_to.page_title;
	} else {
		// TODO: [[wikinews:File:f1]] will → [[File:f2]], NOT [[:File:f2]]

		let initial_char_original = this.keep_initial_case && this[KEY_wiki_session].remove_namespace(token[0].toString()).charAt(0);
		if (initial_char_original && initial_char_original !== initial_char_original.toUpperCase()) {
			// 對於一些原先就希望是小寫開頭連結文字的處理。
			// e.g., [[the best (髙橋真梨子のアルバム)]] ({{小文字|title=the best}})
			const matched = this.move_to.page_title.match(/^([^:]+:)([^:])(.*)$/);
			// assert: matched[2] is upper cased
			token[0] = matched[1] + matched[2].toLowerCase() + matched[3];
		} else {
			token[0] = this.move_to.page_title;
		}
	}

	if (typeof this.move_to.anchor === 'string') {
		token[1] = this.move_to.anchor ? '#' + this.move_to.anchor : '';
	} else if (
		//this.move_to.ns === 0 &&
		// token[2] maybe NOT {String}
		token[2] && token[0].toString().toLowerCase().includes(token[2].toString().toLowerCase())) {
		//console.trace(token);
		//	A[[ABC|B]]C → [[ABC]]
		//	A[[AB|B]] → [[AB]]
		//	[[AB|A]]B → [[AB]]
		const _index = token[0].indexOf(token[2]);
		// assert: index >= 0 && (header || tail)
		// assert: token.length === 2

		const header = _index > 0 && token[0].slice(0, _index);
		if (header && typeof parent[index - 1] === 'string' && parent[index - 1].endsWith(header)) {
			//	A[[AB|B]] → [[AB|AB]]
			parent[index - 1] = parent[index - 1].slice(0, -header.length);
			token[2] = header + token[2];
		}
		const tail = token[0].slice(_index + token[2].toString().length);
		if (tail && typeof parent[index + 1] === 'string' && parent[index + 1].startsWith(tail)) {
			//	[[AB|A]]B → [[AB|AB]]
			parent[index + 1] = parent[index + 1].slice(tail.length);
			token[2] += tail;
		}
		//console.trace([header, tail, parent[index - 1], token, parent[index + 1]]);
	}

	if (!token[2]) {
		;
	} else if (!token[1] && this[KEY_wiki_session].normalize_title(CeL.wiki.wikitext_to_plain_text(token[2]), { no_upper_case_initial: true }) === this.move_to.page_title) {
		// 去掉與頁面標題相同的 display_text。 preserve 大小寫變化 [[PH|pH]], [[iOS]]。
		// e.g., [[.move_from.page_title|move to link]] →
		// [[.move_to.page_title|move to link]]
		// → [[move to link]] || [[.move_to.page_title]] 預防大小寫變化。
		if (PATTERN_need_to_preserve_style.test(token[2])) {
			token[0] = this.move_to.page_title;
			if (false && /&#/.test(token[2])) {
				token[2] = CeL.HTML_to_Unicode(token[2].toString());
			}
		} else {
			token[0] = /[<>{}|]|&#/.test(token[2]) ? this.move_to.page_title : token[2];
			// assert: token.length === 2
			token.pop();
		}
	} else if (!token[1] && this.move_from.page_title === this.move_to.page_title && this.move_from.display_text && this.move_to.display_text === undefined) {
		// 移動前後的頁面標題相同，卻未設定移動後的 display_text。將會消掉符合條件連結之 display_text！
		// 消除特定 display_text。 e.g., 設定 [[T|d]] → [[T]]
		// assert: token.length === 2
		token.pop();
	} else if (!/ +\([^()]+\)$/.test(this.move_to.page_title) && this.move_from.page_title !== this.move_to.page_title
		&& this.move_from.page_title === /*CeL.wiki.wikitext_to_plain_text(token[2], { no_upper_case_initial: true })*/CeL.HTML_to_Unicode(token[2].toString())) {
		if (!token[1] && token[0] === this.move_to.page_title) {
			// MeToo → ＃MeToo 則 [[MeToo]] 此時為 [[＃MeToo|MeToo]]，直接改成 [[＃MeToo]]。
			token.pop();
		} else {
			// [[AA]] → [[B]]			則同時把 [[AA#anchor|A&#66;]] → [[B#anchor|BB]]
			// @see .also_replace_display_text
			token[2] = this.move_to.page_title;
		}
	}
	//console.trace(token);

	if (token[0] === this.page_data.title && token[1] && token[2]) {
		// TODO: 應該確保不是重定向頁。
		// 連結標的與頁面名稱相同的情況，可省略 page title。
		token[0] = '';
	}

	// TODO: 視 display_text 增加空格
	// [[...字]]A → [[...T]] A
	// A[[字...]] → A[[T...]]

	if (this.move_from.ns === this[KEY_wiki_session].namespace('Category')) {
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

	//console.trace(token);

	if (this.after_for_each_link) {
		return this.after_for_each_link(token, index, parent);
	}
}

const for_each_category = for_each_link;

// --------------------------------------------------------

function for_each_file(token, index, parent) {
	//console.log(this.move_to);
	//console.trace(token);
	if (this.move_from && this.move_from.page_name
		&& this.move_from.page_name === token.name) {
		if (this.move_to_link === DELETE_PAGE) {
			return remove_token;
		}

		// e.g., [[File:move to.jpg|...]]
		token[0] = this.move_to_link;
	}

	//console.trace([this.move_from_link, token.link]);
	if (this.move_from_link === token.link) {
		// e.g., [[File:pic.jpg|link=move to.jpg]]
		token[token.index_of.link] = 'link=' + this.move_to_link;
	}
}

// --------------------------------------------------------

// subst展開 [[mw:Help:Substitution]]
async function subst_template(token, index, parent) {
	token[0] = 'subst:' + token[0];
	const page_title = this.page_to_edit.title;
	//this.task_configuration[KEY_wiki_session].append_session_to_options().session;

	if (CeL.wiki.parser.token_is_children_of(parent,
		parent => parent.type === 'tag' && (parent.tag === 'ref' || parent.tag === 'gallery'
			// e.g., @ [[w:ja:Template:Round corners]]
			|| parent.tag === 'includeonly')
	)) {
		//console.trace([page_title, token.toString(), parent]);
		// [[mw:Help:Cite#Substitution and embedded parser functions]] [[w:en:Help:Substitution#Limitation]]
		// refタグ内ではsubst:をつけても展開されず、そのまま残ります。人間による編集の場合は一旦refタグを外して、差分から展開したソースをコピーする形になります。

		// TODO: this.task_configuration[KEY_wiki_session].expandtemplates(), this.task_configuration[KEY_wiki_session].compare()
		// useless:
		//const expand_data = await new Promise(resolve => CeL.wiki.query(token.toString(), resolve, this.task_configuration[KEY_wiki_session].append_session_to_options()));

		//console.trace(this.task_configuration[KEY_wiki_session].append_session_to_options().session);
		//console.trace(token);
		let wikitext = await this.task_configuration[KEY_wiki_session].query({
			action: "compare",
			fromtitle: page_title,
			fromslots: "main",
			'fromtext-main': "",
			toslots: "main",
			'totext-main': token.toString(),
			topst: 1,
		});
		//console.log(wikitext);
		wikitext = wikitext.compare['*']
			// TODO: shoulld use HTML parser
			// e.g., 2021/12/19:	<td class="diff-addedline"><div>...</div></td>
			// e.g., 2022/3/3:		<td class="diff-addedline diff-side-added"><div>...</div></td>
			.all_between('<td class="diff-addedline', '</td>').map(token => token.between('<div>', { tail: '</div>' })).join('\n');
		wikitext = CeL.HTML_to_Unicode(wikitext);
		if (!wikitext) {
			CeL.warn(`${subst_template.name}: Nothing get for substituting ${token.toString()} inside <${parent.tag}>!`);
		}
		//console.trace([page_title, token.toString(), wikitext]);
		parent[index] = wikitext;
	}
	//this.discard_changes = true;
}

// --------------------------------------------------------

const no_ns_templates = {
	Pathnav: true,
	子記事: true,
	Navbox: true,
	Catlink: true,
	C: true,
	リダイレクトの所属カテゴリ: true,

	'Infobox 鐵道路線': '標誌',
	'Infobox rail system-route': 'logo_filename',
};

function replace_template_parameter(value, parameter_name, template_token) {
	let move_to_link = this.move_to_link;
	if (!move_to_link)
		return;

	const link = parse_move_link(value && value.toString(), this[KEY_wiki_session]);
	if (!link || (template_token.name in no_ns_templates
		? no_ns_templates[template_token.name] !== true && no_ns_templates[template_token.name] !== parameter_name
		|| link.ns || this[KEY_wiki_session].normalize_title(link.page_name) !== this.move_from.page_name
		: this[KEY_wiki_session].normalize_title(link.page_title) !== this.move_from.page_title)) {
		return;
	}
	// assert: link.display_text === undefined

	if (false && template_token.name === 'Pathnav' &&
		// 避免 [[w:ja:Special:Diff/75582728|Xbox (ゲーム機)]]
		task_configuration.page_data.title === this.move_to.page_name) {
		return;
	}

	//console.trace([value, move_to_link]);
	if (move_to_link === DELETE_PAGE) {
		// TODO: remove Category:日本の悪役俳優 @ [[ゆーとぴあ]]
		return CeL.wiki.parse.replace_parameter.KEY_remove_parameter;
	}

	//console.trace(template_token);
	const this_parameter = template_token[template_token.index_of[parameter_name]];
	//console.trace(this_parameter);
	//保留 comments
	parameter_name = this_parameter[0].toString().trim() || parameter_name;
	const factor = {
		[parameter_name]: (template_token.name in no_ns_templates
			// 特別處理模板引數不加命名空間前綴的情況。
			? this.move_to.page_name : this.move_to.page_title)
			// e.g., {{Main|move_from_link#section title}}
			+ (this.move_to.anchor ? '#' + this.move_to.anchor
				: link.anchor ? '#' + link.anchor : '')
	};
	//console.trace([this_parameter, factor]);
	return factor;
}

const no_essential_parameter_templates = {
	// {{{1|{{PAGENAME}}}}}
	Catmore: 1,
	// {{{1-1|{{{1}}}}}}
	リダイレクトの所属カテゴリ: 1,
};

function check_link_parameter(task_configuration, template_token, parameter_name) {
	let options;
	if (Array.isArray(parameter_name)) {
		//TODO
		[options, parameter_name] = parameter_name;
	}

	if (parameter_name === '*') {
		Object.keys(template_token.parameters)
			.forEach(parameter_name => check_link_parameter(task_configuration, template_token, parameter_name));
		return;
	}

	const attribute_text = template_token.parameters[parameter_name];
	if (!attribute_text) {
		if ((isNaN(parameter_name) || parameter_name == 1)
			&& (!(template_token.name in no_essential_parameter_templates)
				|| parameter_name != no_essential_parameter_templates[template_token.name])) {
			CeL.warn(`check_link_parameter: There is {{${template_token.name}}} without essential parameter: ${JSON.stringify(parameter_name)}.`);
		}
		return;
	}

	//console.trace([template_token, parameter_name]);
	CeL.wiki.parse.replace_parameter(template_token, parameter_name, replace_template_parameter.bind(task_configuration));
	//console.trace(template_token.toString());
	if (template_token.toString().includes('|=')) {
		// e.g., `{{pathnav|らんま1/2|=frame=1}}` @ [[らんま1/2 悪夢!春眠香]]
		console.log([template_token, parameter_name, task_configuration.move_to_link]);
		console.trace(template_token.toString());
		const error = new Error(`template includes('|='): ${template_token} (To change parameter ${parameter_name})`);
		//throw error;
		CeL.error(error);
		return error;
	}
}

function replace_link_parameter(task_configuration, template_token, template_hash, increase) {
	if (!(template_token.name in template_hash))
		return false;

	//console.trace([template_token, task_configuration.move_to_link]);
	if (!task_configuration.move_to_link
		|| task_configuration.move_to && !task_configuration.move_to.page_name
		// [[w:ja:Special:Diff/79399447|Template:Latest stable software release/Android]] should not use this
		//|| task_configuration.page_data.ns !== task_configuration.move_from.ns
	) {
		return true;
	}

	// console.log(template_token);
	// console.log(template_token.length);
	let index = template_hash[template_token.name];
	//console.trace(index);
	do {
		check_link_parameter(task_configuration, template_token, index);
	} while (increase > 0 && (index += increase) < template_token.length);
	return true;
}

async function for_each_template(page_data, token, index, parent) {
	const { task_configuration } = this;
	const move_from_is_not_template = !task_configuration.move_from || task_configuration.move_from.ns && task_configuration.move_from.ns !== task_configuration[KEY_wiki_session].namespace('Template');
	const is_move_from = !move_from_is_not_template && task_configuration[KEY_wiki_session].is_template(task_configuration.move_from.page_name, token);
	//console.trace([move_from_is_not_template, is_move_from, task_configuration.move_from.page_name, token.name]);
	//console.trace(task_configuration);

	if ((move_from_is_not_template || is_move_from) && task_configuration.for_template
		// task_configuration.for_template() return: 改變內容，之後會做善後處理。
		&& true === await task_configuration.for_template.call(this, token, index, parent)) {
		// 刪除掉所有空白參數。
		for (let index = token.length; index > 1;) {
			if (!token[--index])
				token.splice(index, 1);
		}
		parent[index] = token = CeL.wiki.parse(token.toString());
	}
	//if (token.toString().includes('Internetquelle')) console.trace(`${for_each_template.name}: [[${page_data.title}]] ${token}`);

	if (is_move_from) {
		//console.trace(parent[index]);

		// options for target template
		if (task_configuration.move_to_link === DELETE_PAGE) {
			return remove_token;
		}

		if (task_configuration.replace_parameters) {
			if (CeL.is_Object(task_configuration.replace_parameters)) {
				// e.g., `{{リンク修正依頼/改名|options={"replace_parameters":{"from_parameter":"to_parameter"},"parameter_name_only":true} }}`
				CeL.wiki.parse.replace_parameter(token, task_configuration.replace_parameters, task_configuration.parameter_name_only ? { parameter_name_only: task_configuration.parameter_name_only } : null);
			} else {
				throw new TypeError('.replace_parameters is not a Object');
			}
		}
		if (task_configuration.move_to?.page_name
			&& task_configuration.move_from.ns === task_configuration.move_to.ns
			&& task_configuration.move_from.ns === task_configuration[KEY_wiki_session].namespace('Template')) {
			// 直接替換模板名稱。注意: 這會刪除最後的 /[\t ]/
			token[0] = task_configuration.move_to.page_name
				// 保留模板名最後的換行。
				+ token[0].toString().match(/\n?[ \t]*$/)[0];
			return;
		}
	}

	// ----------------------------------------------------

	// for jawiki
	if (token.name === 'Battlebox') {
		const matched = task_configuration.move_from.page_name.match(/^[Cc]ampaignbox (.+)$/);
		const campaign = token.parameters.campaign;
		if (matched && campaign && campaign.toString().trim() === matched[1]) {
			CeL.wiki.parse.replace_parameter(token, {
				campaign: task_configuration.move_to.page_name.replace(/^[Cc]ampaignbox /, '')
			}, { value_only: true });
		}
	}

	// for jawiki
	if (token.name === 'Campaignbox-bottom') {
		const matched = task_configuration.move_from.page_name.match(/^[Cc]ampaignbox (.+)$/);
		if (matched && token[1].toString().trim() === matched[1]) {
			token[1] = task_configuration.move_to.page_name.replace(/^[Cc]ampaignbox /, '');
		}
	}

	// for zhwiki
	if (/^Babel(-\d)?$/.test(token.name)) {
		// TODO:
		console.warn(token);
	}

	// ----------------------------------------------------

	// 不可處理: {{改名提案}}
	// TODO: {{仮リンク|鉄原郡 (南)|ko|철원군 (남)|label=鉄原郡|redirect=1}}

	//console.trace(token);

	// templates that ONLY ONE parament is treated as a link.
	if (replace_link_parameter(task_configuration, token, {
		// templates that the first parament is displayed as link.
		// e.g., {{tl|.move_from.page_title}}
		Tl: 1,
		Tlg: 1,
		Tlx: 1,
		// e.g., {{廃止されたテンプレート|old page_title|.move_from.page_title}}
		廃止されたテンプレート: 2,
		// [[w:ja:Template:Navbox]]
		Navbox: 'name',

		// {{Catmore|項目名}}
		Catmore: 1,

		// e.g., {{仮リンク|延白郡|ko|연백군}}
		仮リンク: 1,
		// e.g., {{支流リンク|ラン河}}
		支流リンク: 1,

		LSR: 'article',

		//[[Special:Diff/61197015/61197026#車站編號標誌|Bot request]]
		'Infobox 鐵道路線': '標誌',
		'Infobox rail system-route': 'logo_filename',

		リダイレクトの所属カテゴリ: '*',
	})) return;

	// templates that ALL NUMERAL parameters are treated as links.
	if (replace_link_parameter(task_configuration, token, {
		Main: 1,
		See: 1,
		Seealso: 1,
		'See also': 1,
		混同: 1,
		Catlink: 1,
		// [[w:ja:Template:Pathnav]]
		// e.g., {{Pathnav|主要カテゴリ|…|.move_from.page_title}}
		Pathnav: 1,
		子記事: 1,
		C: 1,
	}, 1)) return;

	// Special cases
	if (replace_link_parameter(task_configuration, token, {
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
		About: 3,
	}, 2)) return;

	// TODO: [[w:zh:Template:Include]] 移除模板沒有被移除
}

// ---------------------------------------------------------------------//

function session_of_options(options) {
	return options && options[KEY_wiki_session] || options;
}

async function get_move_pairs_page(page_title, options) {
	if (page_title.type === 'section') {
		// `page_title` is already section.
		// e.g., meta_configuration.bot_requests_section
		return page_title;
	}

	const wiki = session_of_options(options);
	const list_page_data = await wiki.page(page_title, options);
	/** {Array} parsed page content 頁面解析後的結構。 */
	const parsed = list_page_data.parse();
	CeL.assert([list_page_data.wikitext, parsed.toString()], 'wikitext parser check: ' + CeL.wiki.title_link_of(list_page_data));
	options.on_page_title = list_page_data;

	let section;
	if (options.section_title) {
		const section_title = options.section_title.toString().trim();
		parsed.each_section(section_token => {
			if (!section_token.section_title || section_token.section_title[0].toString().trim() !== section_title) {
				if (false && section_token.section_title)
					console.log([section_token.section_title[0].toString().trim(), section_title.trim()]);
				return;
			}
			// console.log(section.toString());
			section = section_token;
		});
		if (!section) {
			CeL.error('Cannot find section title: ' + section_title);
		}
	}

	return section || parsed;
}

async function parse_move_pairs_from_page(page_title, options) {
	const wiki = session_of_options(options);
	if (wiki !== options) {
		options = wiki.append_session_to_options({ allow_promise: true, ...options });
		// 避免污染。
		//delete options[KEY_wiki_session];
	}

	const section_token = await get_move_pairs_page(page_title, options);

	const move_title_pair = options.is_list ? [] : Object.create(null);

	const using_table = options.using_table || options.get_task_configuration_from === 'table';
	if (using_table || options.caption) {
		await section_token.each('table', async table => {
			if (using_table || table.caption === options.caption)
				await parse_move_pairs_from_link(table, move_title_pair, options);
		});
	} else {
		await section_token.each('list', async list_token => {
			if (list_token.length >= (options.min_list_length || 5))
				await parse_move_pairs_from_link(list_token, move_title_pair, options);
		});
	}

	return move_title_pair;
}

//options = { ucstart: new Date('2020-05-30 09:34 UTC'), ucend: new Date('2020-05-30 09:54 UTC'), session: wiki }
async function parse_move_pairs_from_reverse_moved_page(user_name, options) {
	const wiki = session_of_options(options);
	if (wiki !== options) {
		options = { ...options };
		// 避免污染。
		delete options[KEY_wiki_session];
	}
	const move_title_pair = {};

	const list = await wiki.usercontribs(user_name, options);
	for (const item of list) {
		if (!item.from || !item.to)
			continue;
		//reverse moved page
		move_title_pair[item.to] = item.from;
		//break;
	}
	//console.log(list);

	return move_title_pair;
}

async function parse_move_pairs_from_link(line, move_title_pair, options) {
	if (!line)
		return;

	// list: e.g., task/20200606.Move 500 River articles per consensus on tributary disambiguator.js
	// table: e.g., replace/20200607.COVID-19データ関連テンプレートの一斉改名に伴う改名提案テンプレート貼付.js
	if (line.type === 'list' || line.type === 'table') {
		for (const _line of line) {
			await parse_move_pairs_from_link(_line, move_title_pair, options);
		}
		return;
	}

	// ---------------------------------------------

	const wiki = options[KEY_wiki_session];
	function preprocess_link(link) {
		// move_to: ":File:name.jpg" → "File:name.jpg"
		link = wiki ? wiki.normalize_title(link) : CeL.wiki.normalize_title(link);
		//console.trace(link);
		return link;
	}

	// e.g., [[w:ja:Template:Category link with count]]
	await wiki.register_redirects(wiki.to_namespace(['C', 'Cl', 'Clc', 'Cls'], 'Template'));

	await CeL.wiki.parser.parser_prototype.each.call(line, 'Template', async template_token => {
		if (wiki.is_template(template_token, ['C', 'Cl', 'Clc', 'Cls'])) {
			// 直接回傳連結，避免深入 {{PAGESINCATEGORY:}}。
			return `[[:Category:${wiki.remove_namespace(template_token[1].toString())}]]`;
			return await CeL.wiki.expand_transclusion(template_token, options);
		}
	}, true);

	let from, to;
	CeL.wiki.parser.parser_prototype.each.call(line, 'link', (link_token, index, parent) => {
		// 去掉簽名之後的連結。
		if (wiki.is_namespace(link_token[0].toString(), 'User') && index > 0 && typeof parent[index - 1] === 'string' && parent[index - 1].endsWith('--')) {
			return CeL.wiki.parser.parser_prototype.each.exit;
		}

		if (link_token[1]) {
			CeL.error(`${parse_move_pairs_from_link.name}: Link with anchor: ${line}`);
			throw new Error(`Link with anchor: ${line}`);
		}
		link_token = preprocess_link(link_token[0].toString());
		if (!from) {
			from = link_token;
		} else if (!to) {
			to = link_token;
		} else if (!options.ignore_multiple_link_warnings) {
			CeL.error(`${parse_move_pairs_from_link.name}: Too many links: Still process ${parent[index]}`);
		}
	});

	if (!from && !to) {
		CeL.wiki.parser.parser_prototype.each.call(line, 'url', (link, index, parent) => {
			link = preprocess_link(link[0]);
			if (!from) {
				from = link;
			} else if (!to) {
				to = link;
			} else if (!options.ignore_multiple_link_warnings) {
				CeL.error(`${parse_move_pairs_from_link.name}: Too many urls: Still process ${parent[index]}`);
			}
		});
	}

	if (from && Array.isArray(move_title_pair)) {
		move_title_pair.push(from);
		return;
	}

	//console.log([from, to]);
	if (!from || !to) {
		if (line.type !== 'table_attributes' && !line.type === 'caption' && !(line.type === 'table_row' && line.header_count)) {
			CeL.error('${parse_move_pairs_from_link.name}: Cannot parse:');
			console.log(line);
		}
		return;
	}

	if (CeL.wiki.PATTERN_BOT_NAME.test(wiki.remove_namespace(from))
		|| CeL.wiki.PATTERN_BOT_NAME.test(wiki.remove_namespace(to)))
		return;

	CeL.debug(CeL.wiki.title_link_of(from) + '	→ ' + CeL.wiki.title_link_of(to), 1, parse_move_pairs_from_link.name);
	if (move_title_pair) {
		//task_configuration_from_section[from] = to;
		if (move_title_pair[from]) {
			CeL.error([parse_move_pairs_from_link.name + ': ', {
				// gettext_config:{"id":"duplicate-task-name-$1!-will-overwrite-old-task-with-new-task-$2→$3"}
				T: ['Duplicate task name %1! Will overwrite old task with new task: %2→%3', CeL.wiki.title_link_of(from), CeL.wiki.title_link_of(move_title_pair[from]), CeL.wiki.title_link_of(to)]
			}]);
		}
		move_title_pair[from] = to;
		if (Array.isArray(options.also_replace_text_insource) ? options.also_replace_text_insource.includes(from) : options.also_replace_text_insource) {
			// Also replace text in source of **non-linked** pages
			move_title_pair[`insource:"${from}"`] = to;
			//console.log(move_title_pair);
		}
	}

	return [from, to];
}

async function move_via_title_pair(move_title_pair, options) {
	const wiki = session_of_options(options);
	CeL.info(`${parse_move_pairs_from_link.name}: ${Object.keys(move_title_pair).length} pages to move...`);
	//	console.log(move_title_pair);
	options = {
		movetalk: true,
		//noredirect: false,
		...options
	};

	for (const move_from_title in move_title_pair) {
		const move_to_title = move_title_pair[move_from_title];
		if (move_from_title === move_to_title) {
			CeL.error('The same title: ' + CeL.wiki.title_link_of(move_from_title));
			continue;
		}

		CeL.info(`move page: ${CeL.wiki.title_link_of(move_from_title)} → ${CeL.wiki.title_link_of(move_to_title)}`);
		try {
			await wiki.move_page(move_from_title, move_to_title, options);
		} catch (e) {
			if (e.code === 'articleexists') {
				// Already moved?
			} else {
				console.error(e);
			}
		}
	}
}

// ---------------------------------------------------------------------//
// export

Object.assign(globalThis, { DELETE_PAGE, REDIRECT_TARGET, remove_token });

module.exports = {
	get_all_sections,

	// for modify
	replace: replace_tool__replace,
	remove_duplicated_display_text,

	// for move
	parse_move_pairs_from_page,
	//	parse_move_pairs_from_link,
	parse_move_pairs_from_reverse_moved_page,
	move_via_title_pair,
};
