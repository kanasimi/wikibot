/*

node undo_edit_2024_PIQA.js

2024/2/3 10:8:11	初版試營運

 @see https://en.wikipedia.org/wiki/User_talk:Kanashimi#Another_bot_error

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
set_language('en');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

const summary_piece = CeL.gettext(
	// gettext_config:{"id":"very-sorry.-undo-the-robot-s-wrong-edits.-($1)"}
	"Very Sorry. Undo the robot's wrong edits. (%1)",
	'___separator___').split('___separator___');

//console.trace(summary_piece);

/**當機器人的編輯不是最新版本時，向前回溯取得的編輯版本數量。 */
const backtrack_revision_number = 10;

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
		ucstart: new Date('2024/1/31 6:47 UTC+0'),
		ucend: new Date('2024/2/2 16:30 UTC+0'),
		namespace: 'talk',
	})) {
		//console.trace(page_data);
		await check_page_data(page_data);
	}

}


async function check_page_data(page_data) {
	CeL.log_temporary(`Fetch ${CeL.wiki.title_link_of(page_data)}`);
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
		revision_index_of_bot = 0;
	for (const revisions = page_data.revisions; revision_index_of_bot < revisions.length; revision_index_of_bot++) {
		const revision = revisions[revision_index_of_bot];
		if (revision.user === login_user_name) {
			revision_of_bot = revision;
			revision_prior_to_bot = revisions[revision_index_of_bot + 1];
			break;
		}
		revision_after_bot = revision;
	}

	if (!revision_prior_to_bot) {
		CeL.error(`${check_page_data.name}: 必須取得超過 ${backtrack_revision_number}個 revisions: ${CeL.wiki.title_link_of(page_data)}`);
		//console.trace(login_user_name, page_data.revisions);
		return;
	}

	if (revision_after_bot?.tags.includes('mw-undo')) {
		if (!revision_after_bot.comment || summary_piece.some(piece => !revision_after_bot.comment.includes(piece))) {
			CeL.warn(CeL.wiki.title_link_of(page_data) + ' 已被 ' + revision_after_bot.user + ' undo 過' + (revision_after_bot.comment ? ': ' + revision_after_bot.comment : ''));
		}
		return;
	}

	let diff_list;
	try {
		//console.trace([revision_prior_to_bot, revision_of_bot]);
		let from_wikitext = CeL.wiki.content_of(revision_prior_to_bot).replace(/^[\s\S]+?(\n==)/, '$1');
		let to_wikitext = CeL.wiki.content_of(revision_of_bot).replace(/^[\s\S]+?(\n==)/, '$1');
		//console.trace([from_wikitext, to_wikitext]);
		if (from_wikitext === to_wikitext || !from_wikitext.includes('\n==') && !to_wikitext.includes('\n==')) {
			return;
		}
		from_wikitext = CeL.wiki.content_of(revision_prior_to_bot).replace(/^[\s\S]+?(\n==)/, '$1');

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
		//CeL.log_temporary(`Undo ${CeL.wiki.title_link_of(page_data)}`);
		CeL.info(`${check_page_data.name}: Undo the edit on ${CeL.wiki.title_link_of(page_data)}`);
		await wiki.edit_page(page_data, '', {
			undo: 1, bot: 1, minor: 1, summary: CeL.gettext(
				// gettext_config:{"id":"very-sorry.-undo-the-robot-s-wrong-edits.-($1)"}
				"Very Sorry. Undo the robot's wrong edits. (%1)",
				// 加上時間戳記以方便回復這次 undo 時使用。
				(new Date).toISOString())
		});
		return;
	}


	if (revision_after_bot?.user && revision_after_bot.user !== login_user_name) {
		CeL.warn(CeL.wiki.title_link_of(page_data) + ' 已被 ' + revision_after_bot.user + ' 編輯過' + (revision_after_bot.comment ? ': ' + revision_after_bot.comment : ''));
	}

	CeL.info(`${check_page_data.name}: ${CeL.wiki.title_link_of(page_data)}:`);
	console.trace(diff_list);
}
