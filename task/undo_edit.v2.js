/*

node undo_edit.v2.js use_language=ja

recover, revert error edit
連續發生大量編輯錯誤，要回退時使用的工具。

2026/1/4 14:24:52	初版試營運 改自 undo_edit_2024_PIQA.js

 @see [[m:User:Hoo man/Scripts/Smart rollback]]
 @see https://sigma.toolforge.org/summary.py

TODO:
+ 預估剩餘時間
+ undo function

*/

'use strict';

globalThis.no_task_date_warning = true;

// Load CeJS library and modules.
require('../wiki loader.js');

// Load modules.
CeL.run([
	//'data.CSV',
	// for CeL.assert()
	'application.debug.log']);


// Set default language. 改變預設之語言。 e.g., 'zh'
//set_language('ja');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

const summary_piece = CeL.gettext(
	// gettext_config:{"id":"very-sorry.-undo-the-robot-s-wrong-edits.-($1)"}
	"Very Sorry. Undo the robot's wrong edits. (%1)",
	'___separator___').split('___separator___');

/**加上時間戳記以方便回復這次 undo 時使用。 */
const this_undo_timestamp = (new Date).toISOString();

//console.trace(summary_piece);

/**{Number}當機器人的編輯不是最新版本時，向前回溯取得的編輯版本數量。 */
const backtrack_revision_number = 10;

const fix_namespace = '*';

/**{Number}錯誤編輯的開始時間。 */
const start_time = Date.parse('2026/1/2 23:2 UTC+0');
/**{Number}錯誤編輯的結束時間。 */
const end_time = Date.parse('2026/1/3 12:36 UTC+0');

/**{RegExp}篩選符合此 title 的頁面。 */
const PATTERN_filter_page_title = null;

/**{RegExp}篩選包含此 summary 的編輯。 fix only these edits. */
const PATTERN_filter_summary = /Template:コンピュータ/;

/**{RegExp}篩選包含此 diff from 的內容。 */
const PATTERN_filter_diff_from = /<ref/i;

/**{RegExp}篩選包含此 diff to 的內容。 */
const PATTERN_filter_diff_to = null;

// ----------------------------------------------

(async () => {
	//login_options.configuration_adapter = adapt_configuration;
	//console.log(login_options);
	await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
	await main_process();
})();

// ----------------------------------------------------------------------------

let login_user_name = CeL.wiki.extract_login_user_name(login_options.user_name);

async function main_process() {
	login_user_name = wiki.append_session_to_options().session.token.login_user_name;

	for await (const page_data of wiki.usercontribs(login_user_name, {
		ucstart: new Date(start_time),
		ucend: new Date(end_time),
		namespace: fix_namespace,
	})) {
		//console.trace(page_data);
		if (page_data.title === globalThis.log_to
			|| PATTERN_filter_page_title && !PATTERN_filter_page_title.test(page_data.title)) {
			continue;
		}
		await check_page_data(page_data);
	}

}


async function check_page_data(page_data) {
	CeL.log_temporary(`Fetch ${CeL.wiki.title_link_of(page_data)} ${end_time > Date.parse(page_data.timestamp)
		? `(${(100 * (Date.parse(page_data.timestamp) - start_time) / (end_time - start_time)).to_fixed(2)}%)` : ''}`);
	page_data = await wiki.page(page_data, {
		rvlimit: CeL.wiki.is_page_data(page_data)
			// 不是最新的就多取得一點。
			&& !('top' in page_data) ? backtrack_revision_number : 2,
		rvprop: 'ids|content|timestamp|user|comment|tags'
	});
	// console.trace(page_data);

	/**在機器人編輯之後的一個編輯版本。 */
	let revision_after_bot,
		/**機器人編輯版本。 */
		revision_of_bot,
		/**在機器人編輯之前的一個編輯版本。 */
		revision_prior_to_bot,
		/**機器人編輯版本的 index。 */
		revision_index_of_bot = 0,
		/**有機器人所做出的無關的編輯。 */
		unrelated_edit_by_bot;

	for (const revisions = page_data.revisions; revision_index_of_bot < revisions.length; revision_index_of_bot++) {
		const revision = revisions[revision_index_of_bot];
		if (revision.user === login_user_name) {
			if (!PATTERN_filter_summary || PATTERN_filter_summary.test(revision.comment)) {
				revision_of_bot = revision;
				revision_prior_to_bot = revisions[revision_index_of_bot + 1];
				break;
			}
			unrelated_edit_by_bot = true;
		}
		revision_after_bot = revision;
	}

	if (!revision_prior_to_bot) {
		if (!unrelated_edit_by_bot)
			CeL.error(`${check_page_data.name}: 自編機器人編輯過後已經過太多次其他人的編輯，必須取得超過 ${backtrack_revision_number}個 revisions 才能確認: ${CeL.wiki.title_link_of(page_data)}`);
		//console.trace(login_user_name, page_data.revisions);
		return;
	}

	if (revision_after_bot?.tags.includes('mw-undo')) {
		// Already fixed?
		if (revision_after_bot.user !== login_user_name || !revision_after_bot.comment || summary_piece.some(piece => !revision_after_bot.comment.includes(piece))) {
			CeL.warn(`${CeL.wiki.title_link_of(page_data)} 已被 ${revision_after_bot.user} undo 過${revision_after_bot.comment ? ': ' + revision_after_bot.comment : ''}`);
		}
		return;
	}

	let diff_list;
	try {
		//console.trace([revision_prior_to_bot, revision_of_bot]);
		const from_wikitext = CeL.wiki.content_of(revision_prior_to_bot).replace(/^[\s\S]+?(\n==)/, '$1');
		const to_wikitext = CeL.wiki.content_of(revision_of_bot).replace(/^[\s\S]+?(\n==)/, '$1');
		//console.trace([from_wikitext, to_wikitext]);
		if (from_wikitext === to_wikitext || !from_wikitext.includes('\n==') && !to_wikitext.includes('\n==')) {
			return;
		}

		diff_list = CeL.LCS(from_wikitext, to_wikitext, {
			diff: true,
			// MediaWiki using line-diff
			line: true,
			treat_as_String: true
		});
	} catch (e) {
		// e.g., RangeError: Maximum call stack size exceeded @
		// backtrack()
		CeL.error(`${check_page_data.name}: ${CeL.wiki.title_link_of(page_data)}: ${e}`);
		return;
	}

	if (revision_index_of_bot === 0) {
		if ((PATTERN_filter_diff_from || PATTERN_filter_diff_to)
			&& diff_list.every((/*[removed_text,added_text]*/[from, to]) =>
				!(PATTERN_filter_diff_from && PATTERN_filter_diff_from.test(from))
				&& !(PATTERN_filter_diff_to && PATTERN_filter_diff_to.test(to)))
		) {
			// 不包含錯誤內容，無須 undo。
			return;
		}
		//CeL.log_temporary(`Undo ${CeL.wiki.title_link_of(page_data)}`);
		CeL.info(`${check_page_data.name}: Undo the edit on ${CeL.wiki.title_link_of(page_data)}`);
		await wiki.edit_page(page_data, '', {
			undo: 1, bot: 1, minor: 1,
			summary: summary_piece.join(this_undo_timestamp),
		});
		return;
	}


	if (revision_after_bot?.user && revision_after_bot.user !== login_user_name) {
		CeL.warn(`${CeL.wiki.title_link_of(page_data)} 已被 ${revision_after_bot.user} 編輯過 [[Special:Diff/${revision_after_bot.revid}]]${revision_after_bot.comment ? ': ' + revision_after_bot.comment : ''}`);
	}

	// Show diff for manual fix.
	CeL.info(`${check_page_data.name}: ${CeL.wiki.title_link_of(page_data)}:`);
	console.trace(diff_list);
}
