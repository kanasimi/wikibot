/*
node 20201008.fix_anchor.js use_language=en
node 20201008.fix_anchor.js use_language=zh
node 20201008.fix_anchor.js use_language=ja

fix archived:
node 20201008.fix_anchor.js use_language=en archives
node 20201008.fix_anchor.js use_language=zh archives
node 20201008.fix_anchor.js use_language=ja archives


2020/10/9 19:0:26	初版試營運
2020/11/17 6:48:13	仮運用を行って。ウィキペディア日本語版における試験運転。

# Listen to edits modifying section title in ARTICLE.
# Checking all pages linking to the ARTICLE.
# If there are links with old anchor, modify it to the newer one.
# If need, the bot will search revisions to find previous renamed section title.
# The bot also notify broken anchors in the talk page via {{tl|Broken anchors}}.

TODO:
因為有延遲，可檢查當前版本是否為最新版本。
fix [[Special:PermanentLink]]


檢核頁面移動的情況。

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

const LINKS_PARAMETER = 'links';

// ----------------------------------------------

// 讀入手動設定 manual settings。
async function adapt_configuration(latest_task_configuration) {
	//console.log(latest_task_configuration);
	// console.log(wiki);

	// ----------------------------------------------------

	const { general } = latest_task_configuration;
	general.archive_template_list = (general.archive_template_list || ['Template:Archive'])
		// remove "Template:" prefix
		.map(name => wiki.remove_namespace(name));
	//"User:ClueBot III/ArchiveThis", "User:MiszaBot/config",
	//[[Category:有存档的讨论页]]
	//console.log(wiki.latest_task_configuration.general.archive_template_list);

	await wiki.register_redirects(['Section link', 'Broken anchors', 'Citation'], {
		namespace: 'Template'
	});
}

// ----------------------------------------------------------------------------

(async () => {
	login_options.configuration_adapter = adapt_configuration;
	await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
	await main_process();
})();

function progress_to_percent(progress, add_brackets) {
	if (0 < progress && progress < 1) {
		const percent = `${(1000 * progress | 0) / 10}%`;
		return add_brackets ? ` (${percent})` : percent;
	}
	return '';
}

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

		await check_page('Wikipedia:互助客栈/技术‎‎', { force_check: true, namespace: '*', has_subpage_archives: true });
		await check_page('Wikipedia:当前的破坏‎‎', { force_check: true, namespace: '*', has_subpage_archives: true });

		// "&amp;"
		await check_page('三井E&Sホールディングス', { force_check: true });
		// 檢核/去除重複或無效的 anchor。
		// 同じ名前の節 duplicated section title [[w:en:Special:Diff/997653871]]
		await check_page('桜木町駅', { force_check: true });

		await check_page('醒井宿', { force_check: true, force_check_talk_page: '醒井宿' });
		return;
	}


	// fix archived: +"archives" argument
	if (CeL.env.arg_hash.archives) {
		const page_list_with_archives = [];
		for (let template_name of wiki.latest_task_configuration.general.archive_template_list) {
			page_list_with_archives
				.append((await wiki.embeddedin('Template:' + template_name))
					.filter(page_data => !/\/(Sandbox|沙盒|Archives?|存檔|存档)( ?\d+)?$/.test(page_data.title)
						&& !/\/(Archives?|存檔|存档|記錄|log)\//.test(page_data.title)));
		}
		//console.trace(page_list_with_archives);
		const length = page_list_with_archives.length;
		while (page_list_with_archives.length > 0) {
			const page_data = page_list_with_archives.shift();
			const NO = length - page_list_with_archives.length;
			process.title = `${NO}/${length}${progress_to_percent(NO / length, true)} ${page_data.title}`;
			try {
				await check_page(page_data, { is_archive: true, force_check: true, namespace: '*', progress: NO / length });
			} catch (e) {
				CeL.error(`Error process ${page_data.title}`);
				console.error(e);
			}
		}
		return;
	}

	wiki.listen(for_each_row, {
		// 檢查的延遲時間。
		// 時間必須長到機器人存檔作業完成後，因此最起碼應該有1分鐘。
		delay: '2m',
		//start: '30D',
		filter: filter_row,
		// also get diff
		with_diff: { LCS: true, line: true },
		// Only check edits in these namespaces. 只檢查這些命名空間中壞掉的文章章節標題。
		//namespace: 0,
		parameters: {
			// 跳過機器人所做的編輯。
			// You need the "patrol" or "patrolmarks" right to request the
			// patrolled flag.
			// rcshow : '!bot',
			rcprop: 'title|ids|sizes|flags|user'
		},
		interval: '5s',
	});

	routine_task_done('1d');
}

function filter_row(row) {
	//console.trace(row);

	// There are too many vandalism by IP users...
	// [[w:en:User talk:Kanashimi#Bot is now erroneously changing links and anchors]]
	if (CeL.wiki.parse.user.is_IP(row.user)) {
		return;
	}

	// 處理有存檔的頁面。
	if (get_sections_moved_to(row, { check_has_subpage_archives_only: true }))
		return true;

	// 處理 articles。
	return wiki.is_namespace(row, 0);

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

	//console.log([wiki.is_namespace(row, 'Draft'), wiki.is_namespace(row, 'User talk')]);
	if (wiki.is_namespace(row, 'Draft')
		//|| wiki.is_namespace(row, 'User talk')
	) {
		// ignore all link to [[Draft:]], [[User talk:]]
		return;
	}

	//CeL.info(`${filter_row.name}: ${row.title}`);
	return true;
}

async function is_bad_edit(page_data) {
	/**
	 * {String}page content, maybe undefined. 條目/頁面內容 =
	 * CeL.wiki.revision_content(revision)
	 */
	const content = CeL.wiki.content_of(page_data, 0);
	if (!content || content.length < 100) {
		//console.trace(`ページの白紙化 or rediects? (${content.length}) ` + JSON.stringify(content).slice(0, 200));
		return true;
	}
}

async function get_sections_moved_to(page_data, options) {
	page_data = await wiki.page(page_data);
	/** {Array} parsed page content 頁面解析後的結構。 */
	const parsed = CeL.wiki.parser(page_data).parse();
	// console.log(parsed);
	/**
	 * {String}page content, maybe undefined. 條目/頁面內容 =
	 * CeL.wiki.revision_content(revision)
	 */
	const content = CeL.wiki.content_of(page_data, 0);
	CeL.assert([content, parsed.toString()], 'wikitext parser check for ' + CeL.wiki.title_link_of(page_data));

	let { has_subpage_archives } = options;
	if (!has_subpage_archives) {
		// check {{Archives}}, {{Archive box}}, {{Easy Archive}}
		parsed.each('template', template_token => {
			if (wiki.latest_task_configuration.general.archive_template_list.includes(template_token.name)) {
				has_subpage_archives = true;
			}
		});
	}

	if (!has_subpage_archives)
		return;

	if (options?.check_has_subpage_archives_only)
		return true;

	CeL.info(`${get_sections_moved_to.name}: Pages with archives: ${CeL.wiki.title_link_of(page_data)}`);

	const subpage_list = await wiki.prefixsearch(page_data.title + '/');
	//console.trace(subpage_list);
	await wiki.for_each_page(subpage_list, async subpage_data => {
		await tracking_section_title_history(subpage_data, { ...options, set_recent_section_only: true, move_to_page_title: subpage_data.title });
	});
}

async function for_each_row(row) {
	if (await is_bad_edit(row)) {
		return;
	}

	//CeL.info(`${for_each_row.name}: ${CeL.wiki.title_link_of(row.title)}`);
	const diff_list = row.diff;
	const removed_section_titles = [], added_section_titles = [];
	diff_list.forEach(diff => {
		//const [removed_text, added_text] = diff;
		// all_converted: 避免遺漏。 e.g., [[w:en:Special:Diff/812844088]]
		removed_section_titles.append(get_all_plain_text_section_titles_of_wikitext(diff[0]));
		added_section_titles.append(get_all_plain_text_section_titles_of_wikitext(diff[1]));
	});

	if (removed_section_titles.length > 3) {
		if (wiki.is_namespace(row, 'User talk') || wiki.is_namespace(row, 'Wikipedia talk')) {
			// 去除剪貼移動式 archive 的情況。
			CeL.info(`${for_each_row.name}: It seems ${CeL.wiki.title_link_of(row.title + '#' + removed_section_titles[0])} is just archived?`);
			return;
		}
	}

	if (removed_section_titles.length > 0) {
		CeL.info(`${for_each_row.name}: ${CeL.wiki.title_link_of(row.title + '#' + removed_section_titles[0])
			}${removed_section_titles.length > 1 ? ` and other ${removed_section_titles.length - 1} section title(s) (#${removed_section_titles.slice(1).join(', #')})` : ''
			} is ${removed_section_titles.length === 1 && added_section_titles.length === 1 ? `renamed to ${JSON.stringify('#' + added_section_titles[0])}` : 'removed'
			} by ${CeL.wiki.title_link_of('User:' + row.revisions[0].user)} at ${row.revisions[0].timestamp}.`);

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

	if (!wikitext) {
		return section_title_list;
	}

	/** {Array} parsed page content 頁面解析後的結構。 */
	const parsed = CeL.wiki.parser(wikitext).parse();
	//CeL.assert([wikitext, parsed.toString()], 'wikitext parser check for wikitext');
	// console.log(parsed);

	parsed.each_section();
	parsed.each('section_title', section_title_token => {
		//console.log(section_title_token);
		const section_title_link = section_title_token.link;
		// TODO: 忽略包含不合理元素的編輯，例如 url。
		if (!section_title_link.imprecise_tokens) {
			// `section_title_token.title` will not transfer "[", "]"
			section_title_list.push(section_title_link.id);

		} else if (section_title_link.tokens_maybe_handlable) {
			// exclude "=={{T}}=="
			CeL.warn(`Title maybe handlable 請檢查是否可處理此標題: ${section_title_token.title}`);
			console.log(section_title_link.tokens_maybe_handlable);
			console.trace(section_title_token);
		}
	});

	// 處理 {{Anchor|anchor|別名1|別名2}}
	parsed.each('template', template_token => {
		if (['Anchor', 'Anchors', 'Visible anchor'].includes(template_token.name)) {
			for (let index = 1; index < template_token.length; index++) {
				const anchor = template_token.parameters[index];
				if (anchor)
					section_title_list.push(anchor.toString().replace(/_/g, ' '));
			}
			return;
		}

		// e.g., {{Cite book|和書|author=[[戸高一成]]|coauthors=|year=2013|month=9|title=[証言録]　海軍反省会5|publisher=株式会社PHP研究所|isbn=978-4-569-81339-4|ref=海軍反省会五}} @ [[日本の原子爆弾開発]]
		// {{Cite journal |和書 |journal=[[BugBug]] |volume=<!-- 23 -->|issue=<!-- 1 -->2014年1月号 |publisher=[[マガジン・マガジン]] |date=2013-12-03 |ref=bugbug_201401 }}
		// {{Citation |和書 |url=https://www.city.maibara.lg.jp/soshiki/keizai_kankyo/kankyo/shizen/mizu/1836.html |format=PDF |accessdate=2020-11-29 |editor=仁連孝昭 |title=スローウォーターなくらし - 未来へ受け継ぐ水源の里まいばらの水文化 |date=2012-07-13 |publisher=[[米原市]]経済環境部環境保全課 |ref=Niren}}
		if (/^Cite [a-z]+/.test(template_token.name) || wiki.is_template('Citation', template_token)) {
			const anchor = template_token.parameters.ref;
			if (anchor)
				section_title_list.push(anchor.toString().replace(/_/g, ' '));
			return;
		}
	});

	// 處理 <span class="anchor" id="anchor"></span>, <ref name="anchor">
	parsed.each('tag', tag_token => {
		const anchor = tag_token.attributes.id || tag_token.attributes.name;
		if (anchor)
			section_title_list.push(anchor.replace(/_/g, ' '));
	});

	//console.trace(section_title_list.length > 100 ? JSON.stringify(section_title_list) : section_title_list);
	return section_title_list.unique();
}

const KEY_latest_page_data = Symbol('latest page_data');
const KEY_got_full_revisions = Symbol('got full revisions');
const KEY_lower_cased_section_titles = Symbol('lower cased section titles');
const MARK_case_change = 'case change';

function reduce_section_title(section_title) {
	return section_title.replace(/[\s_\-–()]/g, '').replace(/（/g, '(').replace(/）/g, ')').toLowerCase();
}

function get_section_title_data(section_title_history, section_title) {
	if (section_title in section_title_history)
		return section_title_history[section_title];

	// get possible section name variants: lowcased
	const reduced_section = reduce_section_title(section_title), original_section_title = section_title_history[KEY_lower_cased_section_titles][reduced_section];
	if (original_section_title) {
		return {
			title: reduced_section,
			rename_to: section_title_history[original_section_title].rename_to || original_section_title,
			variant_of: [[MARK_case_change, original_section_title]],
		};
	}

	// TODO: get possible section name variants: 以文字相似程度猜測
}

function set_section_title(section_title_history, section_title, data, options) {
	if (section_title_history[section_title]?.is_present) {
		// Do not overwrite existed present section titles. 先到先得。
		return section_title_history[section_title];
	}

	section_title_history[section_title] = data;
	if (options?.move_to_page_title) {
		delete data.is_present;
		data.move_to_page_title = options.move_to_page_title;
	}

	const reduced_section = reduce_section_title(section_title);
	if (reduced_section !== section_title && !(reduced_section in section_title_history)) {
		//assert: (section_title in section_title_history)
		if (!(reduced_section in section_title_history[KEY_lower_cased_section_titles]) || data.is_present)
			section_title_history[KEY_lower_cased_section_titles][reduced_section] = section_title;
	}

	return data;
}

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
				record = set_section_title(section_title_history, converted, {
					title: converted,
				});
			}
			if (!record.is_present) {
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
			is_present: true
		},
		[KEY_lower_cased_section_titles]: Object.create(null),
	};

	function set_recent_section_title(wikitext, revision) {
		const section_title_list = get_all_plain_text_section_titles_of_wikitext(wikitext);
		mark_language_variants(section_title_list, section_title_history, revision);
		section_title_list.forEach(section_title =>
			set_section_title(section_title_history, section_title, {
				title: section_title,
				// is present section title
				is_present: revision || true,
				appear: null,
			}, options)
		);
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
				CeL.warn(`${tracking_section_title_history.name}: ${type} of ${wiki.normalize_title(page_data)}#${section_title} is existed! ${JSON.stringify(section_title_history[section_title])
					}`);
				CeL.log(`Older to set ${type}: ${JSON.stringify(revision)}`);
			}
			return true;
		}
		section_title_history[section_title][type] = revision;
	}

	function set_rename_to(from, to) {
		if (from === to || section_title_history[from]?.is_present)
			return;

		let very_different;
		const reduced_from = reduce_section_title(from), reduced_to = reduce_section_title(to);
		// only fixes similar section names (to prevent errors)
		// 當標題差異過大時，不視為相同的意涵。會當作缺失。
		if ((reduced_to.length < 2 || !reduced_from.includes(reduced_to)) && (reduced_from.length < 2 || !reduced_to.includes(reduced_from))
			// @see CeL.edit_distance()
			&& (very_different = 2 * CeL.LCS(from, to, 'diff').reduce((length, diff) => length + diff[0].length + diff[1].length, 0)) > from.length + to.length
		) {
			very_different += `>${from.length + to.length}`;
			CeL.error(`${set_rename_to.name}: Too different to be regarded as the same meaning (${very_different}): ${from}→${to}`);
		} else {
			very_different = false;
		}

		const rename_to_chain = [from], is_directly_rename_to = section_title_history[to]?.is_present;
		while (!section_title_history[to]?.is_present && section_title_history[to]?.rename_to) {
			rename_to_chain.push(to);
			to = section_title_history[to].rename_to;
			if (rename_to_chain.includes(to)) {
				rename_to_chain.push(to);
				CeL.warn(`${tracking_section_title_history.name}: Looped rename chain @ ${CeL.wiki.title_link_of(page_data)}: ${rename_to_chain.join('→')}`);
				return;
			}
		}

		if (!section_title_history[from]) {
			set_section_title(section_title_history, from, {
				title: from
			}, options);
		}
		Object.assign(section_title_history[from], {
			is_directly_rename_to, very_different,
			// 警告: 需要自行檢查 section_title_history[to]?.is_present
			rename_to: to
		});
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

	await get_sections_moved_to(target_page_data, { ...options, section_title_history });
	//console.trace(section_title_history);

	link_from.append((await wiki.backlinks(target_page_data, {
		// Only edit broken links in these namespaces. 只更改這些命名空間中壞掉的文章章節標題。
		namespace: options.namespace ?? (wiki.site_name() === 'enwiki' ? 0 : 'main|file|module|template|category|help|portal')
	})).filter(page_data =>
		!/\/(Sandbox|沙盒|Archives?|存檔|存档)( ?\d+)?$/.test(page_data.title)
		// [[User:Cewbot/log/20151002/存檔5]]
		// [[MediaWiki talk:Spam-blacklist/存档/2017年3月9日]]
		// [[Wikipedia:頁面存廢討論/記錄/2020/08/04]]
		&& !/\/(Archives?|存檔|存档|記錄|log)\//.test(page_data.title)
		// [[Wikipedia:Articles for creation/Redirects and categories/2017-02]]
		// [[Wikipedia:Database reports/Broken section anchors/1]] will auto-updated by bots
		// [[Wikipedia:Articles for deletion/2014 Formula One season (2nd nomination)]]
		&& !/^(Wikipedia:(Articles for deletion|Articles for creation|Database reports))\//.test(page_data.title)
	));

	if (link_from.length > 800 && !options.force_check
		// 連結的頁面太多時，只挑選較確定是改變章節名稱的。
		&& !(options.removed_section_titles && options.removed_section_titles.length === 1 && options.added_section_titles.length === 1)) {
		CeL.warn(`${check_page.name}: Too many pages (${link_from.length}) linking to ${CeL.wiki.title_link_of(target_page_data)}. Skip this page.`);
		return;
	}

	CeL.info(`${check_page.name}: ${progress_to_percent(options.progress)} Checking ${link_from.length} page(s) linking to ${CeL.wiki.title_link_of(target_page_data)}...`);
	//console.log(link_from);

	let working_queue;
	// [[w:zh:Wikipedia:格式手册/链接#章節]]
	// [[w:ja:Help:セクション#セクションへのリンク]]
	// [[w:en:MOS:BROKENSECTIONLINKS]]
	let summary = `${CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title, CeL.gettext('修正失效的章節標題'))}: `;
	//summary = summary + CeL.wiki.title_link_of(target_page_data);
	const for_each_page_options = {
		no_message: true, no_warning: true,
		summary: summary + CeL.wiki.title_link_of(target_page_data),
		bot: 1, minor: 1, nocreate: 1,
		// [badtags] The tag "test" is not allowed to be manually applied.
		//tags: wiki.site_name() === 'enwiki' ? 'bot trial' : '',
	};

	// ----------------------------------------------------

	async function add_note_for_broken_anchors(linking_page_data, anchor_token, record) {
		function add_note_for_broken_anchors(talk_page_data) {
			// Modify from 20200122.update_vital_articles.js
			// TODO: fix disambiguation

			if (CeL.wiki.parse.redirect(talk_page_data)) {
				// prevent [[Talk:Ziaur Rahman]] redirecting to [[Talk:Ziaur Rahman (disambiguation)]]
				// this kind of redirects will be skipped and listed in [[Wikipedia:Database reports/Vital articles update report]] for manually fixing.
				// Warning: Should not go to here!
				CeL.warn(`${add_note_for_broken_anchors.name}: ${CeL.wiki.title_link_of(talk_page_data)} redirecting to ${CeL.wiki.title_link_of(CeL.wiki.parse.redirect(talk_page_data))}`);
				//console.log(talk_page_data.wikitext);
				return Wikiapi.skip_edit;
			}

			// the bot only fix namespace=talk.
			if (!wiki.is_namespace(talk_page_data, 'talk')) {
				// e.g., [[Wikipedia:Vital articles/Vital portals level 4/Geography]]
				CeL.warn(`${add_note_for_broken_anchors.name}: Skip invalid namesapce: ${CeL.wiki.title_link_of(talk_page_data)}`);
				//console.log(article_info);
				return Wikiapi.skip_edit;
			}

			//console.trace(talk_page_data);
			/** {Array} parsed page content 頁面解析後的結構。 */
			const parsed = CeL.wiki.parser(talk_page_data).parse();
			CeL.assert([CeL.wiki.content_of(talk_page_data), parsed.toString()], 'wikitext parser check for ' + CeL.wiki.title_link_of(talk_page_data));

			let has_broken_anchors_template;
			let removed_anchors = 0;
			parsed.each('template', template_token => {
				if (!wiki.is_template('Broken anchors', template_token))
					return;

				has_broken_anchors_template = true;
				const index = template_token.index_of[LINKS_PARAMETER];
				if (!index) {
					if (wikitext_to_add)
						template_token.push(LINKS_PARAMETER + '=' + wikitext_to_add);
					return parsed.each.exit;
				}

				// remove unknown anchors
				parsed.each.call(template_token[index], 'list', list_token => {
					for (let index = 0; index < list_token.length; index++) {
						const first_token = list_token[index][0]?.type && list_token[index][0];
						if (first_token && first_token.type === 'tag' && first_token.tag === 'nowiki'
							&& !main_page_wikitext.includes(first_token[1].toString())) {
							// remove item that is not in main article.
							list_token.splice(index--, 1);
							removed_anchors++;
							continue;
						}

						const link_token = CeL.wiki.parse(first_token[1].toString());
						//console.log([link_token, section_title_history[link_token.anchor]?.is_present]);
						if (section_title_history[link_token.anchor]?.is_present) {
							list_token.splice(index--, 1);
							removed_anchors++;
							continue;
						}
					}

					if (list_token.length === 0) {
						// 移除掉本 list。
						return parsed.each.remove_token;
					}
				});

				const original_text = template_token[index].toString();
				if (!anchor_token
					// have already noticed
					|| original_text.includes(anchor_token)) {
					return parsed.each.exit;
				}

				template_token[index] = original_text + wikitext_to_add;
			});

			parsed.each('template', template_token => {
				if (!wiki.is_template('Broken anchors', template_token))
					return;
				if (template_token.parameters[LINKS_PARAMETER]?.toString()?.trim() === '') {
					// 移除掉整個 {{Broken anchors}}。
					return parsed.each.remove_token;
				}
			});

			if (removed_anchors > 0) {
				this.summary += (anchor_token ? ', ' : '') + CeL.gettext('移除%1個失效章節標題提醒', removed_anchors);
				if (!anchor_token)
					CeL.error(`${add_note_for_broken_anchors.name}: ${CeL.gettext('移除%1個失效章節標題提醒', removed_anchors)}`);
			}

			if (has_broken_anchors_template || !wikitext_to_add) {
				return parsed.toString();
			}

			// Modify from 20200122.update_vital_articles.js
			// 添加在首段文字或首個 section_title 前，最後一個 template 後。
			wikitext_to_add = `{{Broken anchors|${LINKS_PARAMETER}=${wikitext_to_add}\n}}` + '\n\n';
			parsed.each((token, index, parent) => {
				if (typeof token === 'string' ? token.trim() : token.type !== 'transclusion') {
					const previous_node = index > 0 && parent[index - 1];
					// 避免多個換行。
					if (typeof previous_node === 'string' && /\n\n/.test(previous_node)) {
						parent[index - 1] = previous_node.replace(/\n$/, '');
					}
					parent.splice(index, 0, wikitext_to_add);
					wikitext_to_add = null;
					return parsed.each.exit;
				}
			}, {
				max_depth: 1
			});
			if (wikitext_to_add) {
				// 添加在頁面最前面。
				parsed.unshift(wikitext_to_add);
			}
			return parsed.toString();
		}

		const main_page_wikitext = linking_page_data.wikitext;
		const talk_page_title = wiki.to_talk_page(linking_page_data);
		// text inside <nowiki> must extractly the same with the linking wikitext in the main article.
		let wikitext_to_add;
		if (anchor_token) {
			wikitext_to_add = `\n* <nowiki>${anchor_token}</nowiki>${record
				//<syntaxhighlight lang="json">...</syntaxhighlight>
				? ` <!-- ${JSON.stringify(record)} -->` : ''}`;
			CeL.error(`${add_note_for_broken_anchors.name}: ${CeL.gettext('提醒失效的章節標題')}: ${CeL.wiki.title_link_of(talk_page_title)}`);
		}

		await wiki.edit_page(talk_page_title, add_note_for_broken_anchors, {
			//Notification of broken anchor
			notification_name: 'anchor-fixing',
			summary: `${CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title, CeL.gettext('提醒失效的章節標題'))}: ${anchor_token || ''}`,
			bot: 1,
			minor: 1,
			//nocreate: false,
		});
	}

	// ----------------------------------------------------

	function check_token(token, linking_page_data) {
		const page_title = (
			// assert: {{Section link}}
			token.page_title
			// assert: token.type === 'link'
			|| token[0]
			// for [[#anchor]]
			|| linking_page_data.title).toString();
		if (!(wiki.normalize_title(page_title) in target_page_redirects)
			|| !token.anchor || section_title_history[token.anchor]?.is_present
		) {
			return;
		}
		//console.log(section_title_history);
		//console.log([!(wiki.normalize_title(page_title) in target_page_redirects),!token.anchor,section_title_history[token.anchor]?.is_present]);
		//console.trace(token);

		const move_to_page_title = section_title_history[token.anchor]?.move_to_page_title;
		// https://meta.wikimedia.org/wiki/Community_Wishlist_Survey_2021/Bots_and_gadgets#Talk_page_archiving_bot_updating_incoming_links
		if (move_to_page_title) {
			if (token.article_index) {
				if (wiki.normalize_title(token[token.article_index]) === move_to_page_title)
					return;
				token[token.article_index] = move_to_page_title;
			} else {
				if (wiki.normalize_title(token[0]) === move_to_page_title)
					return;
				token[0] = move_to_page_title;
			}
			// [[#A_B]] → [[#A B]]
			const section_title = section_title_history[token.anchor]?.title;
			if (token.anchor_index) {
				token[token.anchor_index] = section_title;
			} else {
				token[1] = '#' + section_title;
			}
			const message = CeL.gettext('更新指向存檔的連結%1：%2', progress_to_percent(options.progress, true), token.toString());
			CeL.error(`${CeL.wiki.title_link_of(linking_page_data)}: ${message}`);
			this.summary = `${summary}${message}`;
			return true;
		}

		if (!section_title_history[KEY_got_full_revisions]) {
			if (working_queue) {
				working_queue.list.push(linking_page_data);
			} else {
				CeL.info(`${check_page.name}: Finding anchor ${token} that is not present in the latest revision of ${CeL.wiki.title_link_of(linking_page_data)}.`);
				// 依照 CeL.wiki.prototype.work, CeL.wiki.prototype.next 的作業機制，在此設定 section_title_history 會在下一批 link_from 之前先執行；不會等所有 link_from 都執行過一次後才設定 section_title_history。
				working_queue = tracking_section_title_history(target_page_data, { section_title_history })
					.catch(error => console.error(error))
					.then(() => wiki.for_each_page(working_queue.list, resolve_linking_page, for_each_page_options))
					.then(() => CeL.info(`${CeL.wiki.title_link_of(linking_page_data)}: Get ${Object.keys(section_title_history).length} section title records from page revisions.`))
					// free
					.then(() => working_queue = null);
				working_queue.list = [linking_page_data];
			}
			return;
		}

		const record = get_section_title_data(section_title_history, token.anchor);
		//console.trace(record);
		let rename_to = record?.rename_to;
		if (rename_to && section_title_history[rename_to]?.is_present) {
			let type;
			record.variant_of?.some(variant => {
				if (variant[1] === rename_to) {
					if (variant[0] === MARK_case_change) {
						type = CeL.gettext('大小寫或空白錯誤的章節標題');
					} else {
						type = CeL.gettext('繁簡不符匹配而失效的章節標題');
					}
					return true;
				}
			});
			const ARROW_SIGN = record?.is_directly_rename_to || type ? '→' : '⇝';
			const hash = '#' + rename_to;

			CeL.info(`${CeL.wiki.title_link_of(linking_page_data)}: ${token}${ARROW_SIGN}${hash} (${JSON.stringify(record)})`);
			CeL.error(`${type ? type + ' ' : ''}${CeL.wiki.title_link_of(linking_page_data)}: #${token.anchor}${ARROW_SIGN}${hash}`);
			this.summary = `${summary}${type || `[[Special:Diff/${record.disappear.revid}|${record.disappear.timestamp}]]${record?.very_different ? ` (${CeL.gettext('差異極大')} ${record.very_different})` : ''}`
				} ${token[1]}${ARROW_SIGN}${CeL.wiki.title_link_of(target_page_data.title + hash)}`;

			if (token.anchor_index) {
				token[token.anchor_index] = rename_to;
			} else {
				token[1] = hash;
			}
			//changed = true;
			return true;
		}

		CeL.warn(`${check_page.name}: Lost section ${token} @ ${CeL.wiki.title_link_of(linking_page_data)} (${token.anchor}: ${JSON.stringify(record)
			})${rename_to && section_title_history[rename_to] ? `\n→ ${rename_to}: ${JSON.stringify(section_title_history[rename_to])}` : ''
			}`);
		if (!options.is_archive && wiki.site_name() === 'jawiki') {
			add_note_for_broken_anchors(linking_page_data, token, record);
		}
	}

	// ------------------------------------------

	let pages_modified = 0;
	function resolve_linking_page(linking_page_data) {
		/** {Array} parsed page content 頁面解析後的結構。 */
		const parsed = linking_page_data.parse();
		// console.log(parsed);
		CeL.assert([linking_page_data.wikitext, parsed.toString()], 'wikitext parser check for ' + CeL.wiki.title_link_of(linking_page_data));
		if (!wiki.is_namespace(linking_page_data, 0) && linking_page_data.wikitext.length > /* 10_000_000 / 500 */ 500_000) {
			CeL.log(`${check_page.name}: Big page ${CeL.wiki.title_link_of(linking_page_data)}: ${CeL.to_KB(linking_page_data.wikitext.length)} chars`);
		}

		let changed;
		// handle [[link#anchor|display text]]
		parsed.each('link', token => {
			if (check_token.call(this, token, linking_page_data))
				changed = true;
		});

		// handle {{Section link}}
		parsed.each('template', (token, index, parent) => {
			if (!wiki.is_template('Section link', token))
				return;

			const ARTICLE_INDEX = 1;
			if (token.parameters[ARTICLE_INDEX]) {
				const matched = token.parameters[ARTICLE_INDEX].toString().includes('#');
				if (matched) {
					token[token.index_of[ARTICLE_INDEX]] = token.parameters[ARTICLE_INDEX].toString().replace('#', '|');
					parent[index] = token = CeL.wiki.parse(token.toString());
				}
			}

			token.page_title = wiki.normalize_title(token.parameters[1].toString()) || linking_page_data.title;
			//console.trace(token);
			token.article_index = ARTICLE_INDEX;
			for (let index = 2; index < token.length; index++) {
				token.anchor_index = token.index_of[index];
				if (!token.anchor_index)
					continue;
				token.anchor = token.parameters[index].toString().replace(/_/g, ' ');
				if (check_token.call(this, token, linking_page_data))
					changed = true;
			}
		});

		if (!changed && CeL.fit_filter(options.force_check_talk_page, linking_page_data.title)) {
			add_note_for_broken_anchors(linking_page_data);
		}

		if (!changed)
			return Wikiapi.skip_edit;

		pages_modified++;
		return parsed.toString();
	}

	await wiki.for_each_page(link_from, resolve_linking_page, for_each_page_options);
	await working_queue;

	return pages_modified;
}
