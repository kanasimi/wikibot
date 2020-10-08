/*
node 20201008.fix_anchor.js

	初版試營運

TODO:

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('zh');
/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;


// ----------------------------------------------


// ----------------------------------------------------------------------------

(async () => {
	await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
	await main_process();
})();

async function main_process() {

	if (false) {
		const revision = await wiki.tracking_revisions('安定门 (北京)', '拆除安定门前', { rvlimit: 'max' });
		console.trace(revision);
		return;
	}

	await check_page('臺灣話');
	//await check_page('安定門 (北京)');

	//wiki.listen(check_page);

	//routine_task_done('1d');
}

// ----------------------------------------------------------------------------

function get_all_section_title_of_wikitext(wikitext) {
	const section_title_list = [];

	if (wikitext) {
		const parsed = CeL.wiki.parser(wikitext).parse();
		parsed.each('section_title', token => {
			section_title_list.push(token.title);
		});
	}

	return section_title_list;
}

const KEY_latest_revision = Symbol('latest revision');

// get section title history
async function tracking_section_title_history(page_title) {
	//section_title_history[section_title]={appear:{revid:0},disappear:{revid:0},remane_to:''}
	const section_title_history = Object.create(null);

	function check_and_set(section_title, type, revision) {
		// TODO: 字詞轉換 section_title
		if (!section_title_history[section_title]) {
			section_title_history[section_title] = Object.create(null);
		} else if (section_title_history[section_title][type]) {
			if (CeL.is_debug()) {
				CeL.warn(`${wiki.normalize_title(page_title)}#${section_title} is existed! ${JSON.stringify(section_title_history[section_title])}`);
				CeL.log(`Older to set ${type}: ${JSON.stringify(revision)}`);
			}
			return true;
		}
		section_title_history[section_title][type] = revision;
	}

	function set_remane_to(from, to) {
		if (from === to || section_title_history[from]?.present)
			return;

		const remane_to_chain = [from];
		while (!section_title_history[to]?.present && section_title_history[to]?.remane_to) {
			remane_to_chain.push(to);
			to = section_title_history[to].remane_to;
			if (remane_to_chain.includes(to)) {
				remane_to_chain.push(to);
				CeL.warn(`Looped remane chain @ ${CeL.wiki.title_link_of(page_title)}: ${remane_to_chain.join('→')}`);
				return;
			}
		}

		if (!section_title_history[from])
			section_title_history[from] = Object.create(null);
		section_title_history[from].remane_to = to;
	}

	await wiki.tracking_revisions(page_title, (diff, revision) => {
		if (!section_title_history[KEY_latest_revision]) {
			section_title_history[KEY_latest_revision] = revision;
			get_all_section_title_of_wikitext(CeL.wiki.revision_content(revision))
				.forEach(section_title => section_title_history[section_title] = {
					// is present section title
					present: true
				});
		}

		let minus = diff[0], plus = diff[1];
		minus = get_all_section_title_of_wikitext(minus);
		plus = get_all_section_title_of_wikitext(plus).filter(title => {
			// 警告：在 line_mode，"A \n"→"A\n" 的情況下，
			// "A" 會同時出現在增加與刪除的項目中，此時必須自行檢測排除。
			const index = minus.indexOf(title);
			if (index >= 0) {
				minus.splice(index, 1);
			} else {
				return true;
			}
		});
		if (!plus.length && !minus.length)
			return;

		if (false)
			console.trace([diff, minus, plus, revision]);
		//save memory
		delete revision.slots;

		plus.forEach(section_title => {
			check_and_set(section_title, 'appear', revision);
		});
		minus.forEach(section_title => {
			if (check_and_set(section_title, 'disappear', revision)) {
				return;
			}
			// Using the newer one as .remane_to
			if (plus.length === 1 && minus.length === 1 && section_title_history[plus[0]].appear === revision) {
				//assert: section_title === minus[0]
				set_remane_to(section_title, plus[0]);
			}
		});

		if (plus.length === 1 && minus.length === 1 && !section_title_history[minus[0]]?.remane_to) {
			if (section_title_history[plus[0]]) {
				set_remane_to(minus[0], plus[0]);
			} else {
				console.trace([diff, minus, plus, revision, section_title_history[minus[0]]]);
				throw new Error('Should not go to here! ' + minus[0] + '→' + plus[0]);
			}
		}
	}, {
		search_diff: true,
		rvlimit: 'max'
	});

	return section_title_history;
}

async function check_page(target_page_data) {
	const link_from = await wiki.redirects_here(target_page_data);
	//console.log(link_from);
	const target_page_redirects = Object.create(null);
	link_from
		.forEach(page_data => target_page_redirects[page_data.title] = true);
	// TODO: 字詞轉換 keys of target_page_redirects
	//console.log(Object.keys(target_page_redirects));

	target_page_data = link_from[0];
	if (target_page_data.convert_from)
		target_page_redirects[target_page_data.convert_from] = true;
	const section_title_history = await tracking_section_title_history(target_page_data);
	//console.trace(section_title_history);

	link_from.append(await wiki.backlinks(target_page_data, {
		//namespace: 'main|file|module|template|category|help|portal'
	}));

	CeL.info(`Checking ${link_from.length} pages linking to ${CeL.wiki.title_link_of(target_page_data)}...`);
	await wiki.for_each_page(link_from, linking_page => {
		const parsed = CeL.wiki.parser(linking_page).parse();
		let changed;
		parsed.each('link', token => {
			if (!(wiki.normalize_title(token[0].toString()) in target_page_redirects) || !token.anchor || section_title_history[token.anchor]?.present)
				return;

			let remane_to = section_title_history[token.anchor]?.remane_to;
			if (remane_to) {
				remane_to = '#' + remane_to;
				CeL.info(CeL.wiki.title_link_of(linking_page) + ': ' + token + '→' + remane_to);
				token[1] = remane_to;
				changed = true;
			} else {
				CeL.warn(`Lost section ${token} @ ${CeL.wiki.title_link_of(linking_page)} (${token.anchor}: ${JSON.stringify(section_title_history[token.anchor])})`);
			}
		});
		if (changed) {
			//return parsed.toString();
		}
	}, { no_message: false });

}
