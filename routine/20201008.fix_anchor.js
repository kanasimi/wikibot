/*
node 20201008.fix_anchor.js use_language=en
node 20201008.fix_anchor.js use_language=zh

2020/10/9 19:0:26	初版試營運

# Listen to edits modifying section title in ARTICLE.
# Checking all pages linking to the ARTICLE.
# If there are links with old anchor, modify it to the newer one.
# If need, the bot will search revisions to find previous renamed section title.

TODO:
# The bot may notice in the talk page for lost anchors.

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Load modules.
CeL.run([
	// for CeL.assert()
	'application.debug.log']);

// Set default language. 改變預設之語言。 e.g., 'zh'
//set_language('zh');
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
		// for debug only
		const revision = await wiki.tracking_revisions('安定门 (北京)', '拆除安定门前');
		console.trace(revision);
		return;

		await check_page('臺灣話', { force_check: true });

		await check_page('民族布尔什维克主义', { force_check: true });
		// [[w:zh:Special:Diff/37559912]]
		await check_page('香港特別行政區區旗', { force_check: true });
		await check_page('新黨', { force_check: true });

		await check_page('Species', { force_check: true });
		return;
	}


	wiki.listen(for_each_row, {
		with_diff: { LCS: true, line: true },
		filter: filter_row,
		namespace: 0,
	});

	routine_task_done('1d');

	CeL.log('Listening...');
	CeL.log('-'.repeat(60));
}

function filter_row(row) {
	// [[Wikipedia:優良條目評選/提名區]]
	// [[Wikipedia:優良條目重審/提名區]]
	// [[Wikipedia:優良條目候選/提名區]]
	// [[Wikipedia:典范条目评选/提名区]]
	// [[User:Cewbot/log/20150916]]
	if (/提名區|提名区|\/log\//.test(row.title)
		// [[Wikipedia:新条目推荐/候选]]
		|| /(\/Sandbox|\/沙盒|\/候选)$/.test(row.title)) {
		return;
	}

	if (wiki.is_namespace(row, 'Draft') || wiki.is_namespace(row, 'User talk')) {
		// ignore all link to [[Draft:]], [[User talk:]]
		return;
	}

	return true;
}

async function for_each_row(row) {
	const diff_list = row.diff;
	const removed_section_titles = [], added_section_titles = [];
	diff_list.forEach(diff => {
		//const [removed_text, added_text] = diff;
		removed_section_titles.append(get_all_plain_text_section_titles_of_wikitext(diff[0]));
		added_section_titles.append(get_all_plain_text_section_titles_of_wikitext(diff[1]));
	});

	if (removed_section_titles.length > 3) {
		if (wiki.is_namespace(row, 'User talk') || wiki.is_namespace(row, 'Wikipedia talk')) {
			// 去除剪貼移動式 archive 的情況。
			CeL.info(`${for_each_row.name}: It seems ${CeL.wiki.title_link_of(row.title + '#' + removed_section_titles[0])} is just archived?`);
			return;
		}
		// TODO: check {{Archives}}, {{Archive box}}, {{Easy Archive}}
	}

	if (removed_section_titles.length > 0) {
		CeL.info(`${for_each_row.name}: ${CeL.wiki.title_link_of(row.title + '#' + removed_section_titles[0])}${removed_section_titles.length > 1 ? ` and other ${removed_section_titles.length - 1} section title(s) (#${removed_section_titles.slice(1).join(', #')})` : ''} is ${removed_section_titles.length === 1 && added_section_titles.length === 1 ? `renamed to ${JSON.stringify('#' + added_section_titles[0])} ` : 'removed'} by ${CeL.wiki.title_link_of('user:' + row.revisions[0].user)} at ${row.revisions[0].timestamp}.`);
		try {
			//console.trace(row.revisions[0].slots);
			const pages_modified = await check_page(row, { removed_section_titles, added_section_titles });
			// pages_modified maybe undefined
			CeL.info(`${for_each_row.name}: ${CeL.wiki.title_link_of(row.title)}: ${pages_modified > 0 ? pages_modified : 'No'} page(s) modified.`);
			if (pages_modified > 0) {
				CeL.error(`${for_each_row.name}: Modify ${pages_modified} page(s) link ${CeL.wiki.title_link_of(row.title)}`);
			}
		} catch (e) {
			console.error(e);
		}
		CeL.log('-'.repeat(60));
	}
}

// ----------------------------------------------------------------------------

function get_all_plain_text_section_titles_of_wikitext(wikitext) {
	const section_title_list = [];

	if (wikitext) {
		const parsed = CeL.wiki.parser(wikitext).parse();
		parsed.each('section_title', token => {
			//console.log(token);
			// TODO: == A [[L]] B ==
			if (token.every(t => typeof t === 'string' || t.type === 'link')) {
				// exclude "=={{T}}=="
				section_title_list.push(token.title);
			}
		});
	}

	return section_title_list;
}

const KEY_latest_page_data = Symbol('latest page_data');
const KEY_got_full_revisions = Symbol('got full revisions');

// 偵測繁簡轉換 字詞轉換 section_title
function mark_language_variants(recent_section_title_list, section_title_history, revision) {
	function mark_list(converted_list) {
		const language_variant = this;
		//console.trace(variant + ': ' + converted_list);
		recent_section_title_list.forEach((section_title, index) => {
			const converted = converted_list[index];
			if (section_title === converted)
				return;
			let record = section_title_history[converted];
			if (!record) {
				section_title_history[converted] = record = {
					title: converted,
				};
			}
			if (!record.present) {
				if (record.rename_to && record.rename_to !== section_title) {
					CeL.error(`${mark_language_variants.name}: rename_to: ${record.rename_to}→${section_title}`);
				}
				record.rename_to = section_title;
			}
			CeL.debug(`${mark_language_variants.name}: ${converted}→${section_title}`);
			if (!record.variant_of)
				record.variant_of = [];
			record.variant_of.push([language_variant, section_title]);
		});
		//console.log(section_title_history);
	}

	for (const language_variant of ['zh-hant', 'zh-hans']) {
		//await
		wiki.convert_Chinese(recent_section_title_list, language_variant).then(mark_list.bind(language_variant));
	}
}

// get section title history
async function tracking_section_title_history(page_data, options) {
	options = CeL.setup_options(options);
	//section_title_history[section_title]={appear:{revid:0},disappear:{revid:0},rename_to:''}
	const section_title_history = options.section_title_history || {
		// 所有頁面必然皆有的 default anchors
		top: {
			present: true
		}
	};

	function set_recent_section_title(wikitext, revision) {
		const section_title_list = get_all_plain_text_section_titles_of_wikitext(wikitext);
		mark_language_variants(section_title_list, section_title_history, revision);
		section_title_list.forEach(section_title => section_title_history[section_title] = {
			title: section_title,
			// is present section title
			present: revision || true,
			appear: null,
		});
		section_title_history[KEY_latest_page_data] = page_data;
	}

	if (options.set_recent_section_only) {
		page_data = await wiki.page(page_data);
		set_recent_section_title(page_data.wikitext);
		return section_title_history;
	}

	function check_and_set(section_title, type, revision) {
		if (!section_title_history[section_title]) {
			section_title_history[section_title] = {
				title: section_title,
				appear: null,
			};
		} else if (section_title_history[section_title][type]) {
			// 已經有比較新的資料。
			if (CeL.is_debug()) {
				CeL.warn(`${tracking_section_title_history.name}: ${type} of ${wiki.normalize_title(page_data)}#${section_title} is existed! ${JSON.stringify(section_title_history[section_title])}`);
				CeL.log(`Older to set ${type}: ${JSON.stringify(revision)}`);
			}
			return true;
		}
		section_title_history[section_title][type] = revision;
	}

	function set_rename_to(from, to) {
		if (from === to || section_title_history[from]?.present)
			return;

		// 當標題差異過大時，不視為相同的意涵。會當作缺失。
		// TODO: CeL.edit_distance()
		if (!from.includes(to) && to.includes(from) &&
			2 * CeL.LCS(from, to, 'diff').reduce((length, diff) => length + diff[0].length + diff[1].length, 0) > from.length + to.length
		) {
			CeL.error(`${set_rename_to.name}: Too different to be regarded as the same meaning: ${from}→${to}`);
		}

		const rename_to_chain = [from];
		while (!section_title_history[to]?.present && section_title_history[to]?.rename_to) {
			rename_to_chain.push(to);
			to = section_title_history[to].rename_to;
			if (rename_to_chain.includes(to)) {
				rename_to_chain.push(to);
				CeL.warn(`${tracking_section_title_history.name}: Looped rename chain @ ${CeL.wiki.title_link_of(page_data)}: ${rename_to_chain.join('→')}`);
				return;
			}
		}

		if (!section_title_history[from])
			section_title_history[from] = {
				title: from
			};
		// 警告: 需要自行檢查 section_title_history[to]?.present
		section_title_history[from].rename_to = to;
	}

	//if (section_title_history[KEY_got_full_revisions]) return section_title_history;

	CeL.info(`${tracking_section_title_history.name}: Trying to traversal all revisions of ${CeL.wiki.title_link_of(page_data)}...`);

	await wiki.tracking_revisions(page_data, (diff, revision) => {
		if (!section_title_history[KEY_latest_page_data]) {
			set_recent_section_title(CeL.wiki.revision_content(revision), revision);
		}

		let [removed_text, added_text] = diff;
		if (false)
			console.trace([diff, removed_text, added_text, revision]);

		removed_text = get_all_plain_text_section_titles_of_wikitext(removed_text);
		added_text = get_all_plain_text_section_titles_of_wikitext(added_text);

		if (removed_text.length === 0 && added_text.length === 0)
			return;

		if (!revision.removed_section_titles) {
			revision.removed_section_titles = [];
			revision.added_section_titles = [];
		}
		revision.removed_section_titles.append(removed_text);
		revision.added_section_titles.append(added_text);

	}, {
		revision_post_processor(revision) {
			// save memory
			delete revision.slots;
			delete revision.diff_list;

			if (!revision.removed_section_titles) {
				// No new section title modified
				return;
			}

			revision.removed_section_titles = revision.removed_section_titles.filter(section_title => {
				// 警告：在 line_mode，"A \n"→"A\n" 的情況下，
				// "A" 會同時出現在增加與刪除的項目中，此時必須自行檢測排除。
				// 亦可能是搬到較遠地方。
				const index = revision.added_section_titles.indexOf(section_title);
				if (index >= 0) {
					revision.added_section_titles.splice(index, 1);
				} else {
					return true;
				}
			});

			let has_newer_data;
			revision.removed_section_titles.forEach(section_title => {
				if (check_and_set(section_title, 'disappear', revision)) {
					has_newer_data = true;
				}
			});
			revision.added_section_titles.forEach(section_title => {
				if (check_and_set(section_title, 'appear', revision)) {
					//has_newer_data = true;
				}
			});

			// 檢查變更紀錄可以找出變更章節名稱的情況。一增一減時，才當作是改變章節名稱。
			// TODO: 整次編輯幅度不大，且一增一減時，才當作是改變章節名稱。
			if (!has_newer_data && revision.removed_section_titles.length === 1 && revision.added_section_titles.length === 1) {
				const from = revision.removed_section_titles[0], to = revision.added_section_titles[0];
				// assert: section_title_history[from].disappear === revision && section_title_history[to].appear === revision
				if (!section_title_history[from].rename_to) {
					// from → to
					set_rename_to(from, to);
				} else if (to !== section_title_history[from].rename_to) {
					// 這個時間點之後，`from` 有再次出現並且重新命名過。
					CeL.warn(`#${from} is renamed to #${section_title_history[from].rename_to} in newer revision, but also renamed to #${to} in older revision`);
					// TODO: ignore reverted edit
				}
			}

		},
		search_diff: true,
		rvlimit: 'max',
	});

	section_title_history[KEY_got_full_revisions] = true;
	return section_title_history;
}

async function check_page(target_page_data, options) {
	options = CeL.setup_options(options);
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
	const section_title_history = await tracking_section_title_history(target_page_data, { set_recent_section_only: true });
	//console.trace(section_title_history);

	link_from.append((await wiki.backlinks(target_page_data, {
		//namespace: 'main|file|module|template|category|help|portal'
	})).filter(page_data =>
		!/\/(Sandbox|沙盒|Archives?|存檔|存档)( ?\d+)?$/.test(page_data.title)
		// [[User:Cewbot/log/20151002/存檔5]]
		// [[MediaWiki talk:Spam-blacklist/存档/2017年3月9日]]
		// [[Wikipedia:頁面存廢討論/記錄/2020/08/04]]
		&& !/\/(Archives?|存檔|存档|記錄|log)\//.test(page_data.title)
		// [[Wikipedia:Articles for creation/Redirects and categories/2017-02]]
		// [[Wikipedia:Database reports/Broken section anchors/1]] will auto-updated by bots
		&& !/^(Wikipedia:(Articles for creation|Database reports))\//.test(page_data.title)
	));

	if (link_from.length > 500 && !options.force_check
		// 連結的頁面太多時，只挑選較確定是改變章節名稱的。
		&& !(options.removed_section_titles && options.removed_section_titles.length === 1 && options.added_section_titles.length === 1)) {
		CeL.warn(`${check_page.name}: Too many pages (${link_from.length}) linking to ${CeL.wiki.title_link_of(target_page_data)}. Skip this page.`);
		return;
	}

	CeL.info(`${check_page.name}: Checking ${link_from.length} page(s) linking to ${CeL.wiki.title_link_of(target_page_data)}...`);

	let working_queue;
	let summary = wiki.site_name() === 'zhwiki' ? '修正失效的章節標題：' : 'Fix broken anchor: ';
	//summary = summary + CeL.wiki.title_link_of(target_page_data);
	const for_each_page_options = {
		no_message: true, no_warning: true,
		summary,
		bot: 1, minor: 1, nocreate: 1,
		// [badtags] The tag "test" is not allowed to be manually applied.
		tags: wiki.site_name() === 'enwiki' ? 'bot trial' : '',
	};

	let pages_modified = 0;
	function resolve_linking_page(linking_page) {
		/** {Array} parsed page content 頁面解析後的結構。 */
		const parsed = linking_page.parse();
		// console.log(parsed);
		CeL.assert([linking_page.wikitext, parsed.toString()], 'wikitext parser check for ' + CeL.wiki.title_link_of(linking_page));
		if (linking_page.ns !== 0 && linking_page.wikitext.length > /* 10_000_000 / 500 */ 500_000) {
			CeL.log(`${check_page.name}: Big page ${CeL.wiki.title_link_of(linking_page)}: ${CeL.show_KiB(linking_page.wikitext.length)} chars`);
		}

		let changed;
		parsed.each('link', token => {
			if (!(wiki.normalize_title(token[0].toString()) in target_page_redirects) || !token.anchor
				|| section_title_history[token.anchor]?.present
			) {
				return;
			}

			if (!section_title_history[KEY_got_full_revisions]) {
				if (working_queue) {
					working_queue.list.push(linking_page);
				} else {
					CeL.info(`${check_page.name}: Finding anchor ${token} that is not present in the latest revision of ${CeL.wiki.title_link_of(linking_page)}.`);
					// 依照 CeL.wiki.prototype.work, CeL.wiki.prototype.next 的作業機制，在此設定 section_title_history 會在下一批 link_from 之前先執行；不會等所有 link_from 都執行過一次後才設定 section_title_history。
					working_queue = tracking_section_title_history(target_page_data, { section_title_history })
						.then(() => wiki.for_each_page(working_queue.list, resolve_linking_page, for_each_page_options))
						.then(() => CeL.info(`${CeL.wiki.title_link_of(linking_page)}: Get ${Object.keys(section_title_history).length} section title records from page revisions.`))
						// free
						.then(() => working_queue = null);
					working_queue.list = [linking_page];
				}
				return;
			}

			const record = section_title_history[token.anchor];
			let rename_to = record?.rename_to;
			if (rename_to && section_title_history[rename_to]?.present) {
				let type;
				if (record.variant_of?.some(variant => variant[1] === rename_to)) {
					type = '修正繁簡不符匹配而失效的章節標題';
				}
				rename_to = '#' + rename_to;
				CeL.info(`${CeL.wiki.title_link_of(linking_page)}: ${token}→${rename_to} (${JSON.stringify(record)})`);
				CeL.error(`${type ? type + ' ' : ''}${CeL.wiki.title_link_of(linking_page)}: #${token.anchor}→${rename_to}`);
				this.summary = `${summary}${type || `[[Special:Diff/${record.disappear.revid}|${record.disappear.timestamp}]]`} ${token[1]}→${CeL.wiki.title_link_of(target_page_data.title + rename_to)}`;

				token[1] = rename_to;
				changed = true;
			} else {
				CeL.warn(`${check_page.name}: Lost section ${token} @ ${CeL.wiki.title_link_of(linking_page)} (${token.anchor}: ${JSON.stringify(record)}${rename_to && section_title_history[rename_to] ? `, ${rename_to}: ${JSON.stringify(section_title_history[rename_to])}` : ''})`);
			}
		});

		if (!changed)
			return Wikiapi.skip_edit;

		pages_modified++;
		return parsed.toString();
	}

	await wiki.for_each_page(link_from, resolve_linking_page, for_each_page_options);
	await working_queue;

	return pages_modified;
}
