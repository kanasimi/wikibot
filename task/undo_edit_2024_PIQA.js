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
	'data.CSV',
	// for CeL.assert()
	'application.debug.log']);


// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('en');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// ----------------------------------------------

(async () => {
	//login_options.configuration_adapter = adapt_configuration;
	//console.log(login_options);
	await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
	await main_process();
})();

// ----------------------------------------------------------------------------

const login_user_name = CeL.wiki.extract_login_user_name(login_options.user_name);

async function main_process() {
	for await (const page_data of wiki.usercontribs(login_user_name, {
		ucstart: new Date('2024/1/31 6:47'),
		ucend: new Date('2024/2/3 0:30'),
		namespace: 'talk',
	})) {
		//console.trace(page_data);
		await check_page_data(page_data);
	}

}


async function check_page_data(page_data) {
	CeL.log_temporary(`${check_page_data.name}: Fetch ${CeL.wiki.title_link_of(page_data)}`);
	page_data = await wiki.page(page_data, {
		rvlimit: CeL.wiki.is_page_data(page_data)
			// 不是最新的就多取得一點。
			&& !('top' in page_data) ? 10 : 2,
		rvprop: 'ids|content|timestamp|user|comment'
	});
	// console.trace(page_data);

	let to_revision, from_revision;
	page_data.revisions.some((revision, index, list) => {
		if (revision.user !== login_user_name)
			return;
		to_revision = revision;
		from_revision = list[index + 1];
		return true; // break;
	});

	if (!from_revision) {
		CeL.error(`${check_page_data.name}: 必須取得更多 revisions: ${CeL.wiki.title_link_of(page_data)}`);
		console.trace(login_user_name, page_data.revisions);
		return;
	}

	let diff_list;
	try {
		//console.trace([from_revision, to_revision]);
		let from_wikitext = CeL.wiki.content_of(from_revision).replace(/^[\s\S]+?(\n==)/, '$1');
		let to_wikitext = CeL.wiki.content_of(to_revision).replace(/^[\s\S]+?(\n==)/, '$1');
		//console.trace([from_wikitext, to_wikitext]);
		if (from_wikitext === to_wikitext || !from_wikitext.includes('\n==') && !to_wikitext.includes('\n==')) {
			return;
		}
		from_wikitext = CeL.wiki.content_of(from_revision).replace(/^[\s\S]+?(\n==)/, '$1');

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

	CeL.info(`${check_page_data.name}: ${CeL.wiki.title_link_of(page_data)}:`);
	console.trace(diff_list);
}
