/*

node 20210429.Auto-archiver.js use_language=zh
node 20210429.Auto-archiver.js use_language=ks
node 20210429.Auto-archiver.js use_language=en
node 20210429.Auto-archiver.js use_project=wikidata
node 20210429.Auto-archiver.js use_project=zh.wikiversity
node 20210429.Auto-archiver.js use_project=zh.wikinews
node 20210429.Auto-archiver.js use_project=zh.wiktionary

自動存檔嵌入{{tl|Auto-archive}}的頁面。

2021/5/2 8:41:44	初版試營運。

[[w:en:Help:Archiving a talk page#Automated archiving]]
https://github.com/kanasimi/wikibot/issues/8

TODO:
{{Save to}}
必須留下頁面最後的分類標記。變通方法: 把分類移動到頁面首段落。

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Load modules.
CeL.run([
	// for template_token.message_expire_date
	'application.net.wiki.template_functions',]);

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

let archive_template_name = 'Auto-archive';

// ----------------------------------------------------------------------------

/**
 * 由設定頁面讀入手動設定 manual settings。
 * 
 * @param {Object}latest_task_configuration
 *            最新的任務設定。
 */
async function adapt_configuration(latest_task_configuration) {
	//console.log(wiki.latest_task_configuration);

	// ----------------------------------------------------

	const { general } = latest_task_configuration;

	if (general?.no_archive_templates)
		wiki.register_redirects(general.no_archive_templates);
	if (general?.archive_template_name)
		archive_template_name = wiki.remove_namespace(general.archive_template_name);

	console.log(wiki.latest_task_configuration);
	//CeL.set_debug(6);
}

// ----------------------------------------------------------------------------

(async () => {
	login_options.configuration_adapter = adapt_configuration;
	//console.log(login_options);
	await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
	//console.trace(wiki.to_namespace(archive_template_name, 'template'));
	await wiki.for_each_page(await wiki.embeddedin(wiki.to_namespace(archive_template_name, 'template')), for_each_discussion_page);

	routine_task_done('1d');
})();

async function for_each_discussion_page(page_data) {
	let archive_root_page = page_data;
	//console.trace(archive_root_page);
	let parsed = archive_root_page.parse();
	// Will use the first matched as configuration.
	const archive_configuration = parsed.find_template(archive_template_name)?.parameters;
	if (!archive_configuration) {
		CeL.error(`Cannot find {{${archive_template_name}}} in ${CeL.wiki.title_link_of(archive_root_page)}`);
		return;
	}
	//console.log(archive_configuration);
	if (archive_configuration.stop)
		return;

	if (archive_configuration.archive_root_page && CeL.wiki.normalize_title(archive_configuration.archive_root_page) !== archive_root_page.title) {
		// archive template 未放置於欲存檔之頁面，須重讀欲存檔之頁面內容。
		archive_root_page = await wiki.page(archive_configuration.archive_root_page);
		parsed = archive_root_page.parse();
	}

	// .archive_exceed_size
	// 紀錄/討論頁面字元數超過此大小(chars)才會被搬移存檔。
	if (archive_root_page.wikitext.length < archive_configuration.min_size_left) {
		return;
	}

	if (archive_configuration.archive_after_last_comment > 0) {
		// Treat number as days
		archive_configuration.archive_after_last_comment += 'day';
	}
	//console.trace(archive_configuration);
	const archive_after_last_comment = CeL.date.to_millisecond(archive_configuration.archive_after_last_comment || '1 week');
	//console.log(CeL.age_of(0, archive_after_last_comment));
	if (!archive_after_last_comment) {
		CeL.error(`Do not know when to archive on configuration of ${CeL.wiki.title_link_of(archive_root_page)}`);
		return;
	}


	let sections_need_to_archive = [];

	parsed.each_section((section, section_index) => {
		if (!section.section_title) {
			// Skip the first section.
			return;
		}

		// --------------------------------------------------------------------

		const NOW = Date.now();
		let not_yet_expired;
		// This section is pinned and will not be automatically archived.
		section.each('template', template_token => {
			// @see 'Pin message' : parse_template_Pin_message() @ CeL.application.net.wiki.template_functions.general_functions
			if (NOW < +template_token.message_expire_date
				|| wiki.is_template(wiki.latest_task_configuration?.general?.no_archive_templates, template_token)) {
				not_yet_expired = true;
				return parsed.each.exit;
			}
		}, {
			max_depth: 1
		});
		if (not_yet_expired) {
			// has not yet expired
			return;
		}

		// --------------------------------------------------------------------

		const latest_timevalue = section.dates.max_timevalue;
		if (not_yet_expired !== false) {
			if (!latest_timevalue) {
				CeL.warn(`${for_each_discussion_page.name}: Cannot get latest date of ${section.section_title.link}`);
				return;
			}
			if (NOW - latest_timevalue < archive_after_last_comment) {
				return;
			}
		}

		sections_need_to_archive.push(section);
		// : ${section.section_title.title}
		CeL.info(`${for_each_discussion_page.name}: Need archive #${sections_need_to_archive.length} ${section.section_title.link.toString()
			}${not_yet_expired !== false && latest_timevalue && latest_timevalue !== -Infinity ? ` (${CeL.age_of(latest_timevalue) || latest_timevalue})` : ''}`);
	}, {
		level_filter: +archive_configuration.section_level,
		get_users: true,
	});

	if (0 < archive_configuration.min_threads_left) {
		// 紀錄/討論頁面最少需要留下幾個議題(章節)。
		//-1: the first section
		const left = Math.floor(parsed.sections.length - 1 - archive_configuration.min_threads_left);
		if (left <= 0)
			return;
		sections_need_to_archive.truncate(left);
	}

	if (0 < archive_configuration.min_threads_to_archive
		// 每次最少存檔幾個議題(章節)，可降低編輯頻率。
		? sections_need_to_archive.length < archive_configuration.min_threads_to_archive
		: sections_need_to_archive.length === 0) {
		return;
	}

	//console.trace({ archive_configuration, sections_need_to_archive, archive_root_page, parsed });
	await archive_page({ archive_configuration, sections_need_to_archive, archive_root_page, parsed });
}

async function select_archive_to_page({ archive_configuration, archive_root_page }) {
	const archive_prefix = archive_root_page.title + '/';
	const subpages = (await wiki.prefixsearch(archive_prefix))
		// Exclude [[archive_root_page.title]]
		.filter(page_data => page_data.title.startsWith(archive_prefix))
		.map(page_data => page_data.title.replace(archive_prefix, ''))
		.filter(page_title => !!page_title);
	// TODO: 將頁面內容存檔至子頁面以外的地方。
	const archive_subpage_generator = (() => {
		if (archive_configuration.archive_to_subpage)
			return CeL.detect_serial_pattern.parse_generator(archive_configuration.archive_to_subpage);
		// Auto detect pattern of subpage title
		const patterns = CeL.detect_serial_pattern(subpages);
		//console.trace([subpages, patterns, archive_subpage_generator]);
		if (patterns) {
			for (const pattern of patterns) {
				// for for [[w:en:User talk:Kanashimi#Auto-archiving seems to choose weird subpages]]
				if (pattern.items.length > 1 || /\D\d$/.test(pattern.items[0]))
					return pattern.generator;
			}
		}
		// Default archive generator. See [[w:en:Template:Archives]]
		return CeL.detect_serial_pattern.parse_generator('Archive %1')
	})();
	CeL.info(`${select_archive_to_page.name}: Using generator: ${archive_subpage_generator()}`);
	let archive_subpage_index = 0, archive_subpage;
	while (true) {
		const subpage = archive_subpage_generator(++archive_subpage_index);
		if (subpages.includes(subpage)) {
			if (archive_subpage === subpage) {
				// e.g., "|archive_to_subpage=Archive %Y/%m", no %1 provided.
				break;
			}
			archive_subpage = subpage;
		} else {
			archive_subpage = archive_subpage || subpage;
			break;
		}
	}
	// assert: archive_subpage: first archive subpage that can use.

	let archive_to_page;
	while (true) {
		archive_to_page = await wiki.page(archive_prefix + archive_subpage);
		// hard limit
		let need_skip = archive_to_page.wikitext.length > 10_000_000
			// 存檔頁面超過此大小(chars)就轉到下一個存檔頁面。 TODO: accept '300K' as 300 KiB
			|| archive_to_page.wikitext.length > archive_configuration.max_archive_page_size;

		if (!need_skip && 1 < archive_configuration.max_archive_page_threads) {
			const parsed = CeL.wiki.parser(page_data);
			// 存檔頁面議題(章節)數超過此數值就轉到下一個存檔頁面。
			need_skip = parsed.sections.length > archive_configuration.max_archive_page_threads;
		}

		if (need_skip) {
			const subpage = archive_subpage_generator(++archive_subpage_index);
			if (archive_subpage === subpage) {
				CeL.error(`Skip archive ${CeL.wiki.title_link_of(archive_prefix + archive_subpage)} (${archive_to_page.wikitext.length} chars): No archive page title available.`);
				return;
			}
			archive_subpage = subpage;
		} else {
			break;
		}
	}

	return archive_to_page;
}

async function archive_page({ archive_configuration, sections_need_to_archive, archive_root_page, parsed }) {
	const archive_to_page = await select_archive_to_page({ archive_configuration, archive_root_page });
	if (!archive_to_page)
		return;

	let archive_wikitext = sections_need_to_archive.map(section => section.section_title + section).join('');
	if ('missing' in archive_to_page) {
		if (0 < archive_configuration.min_size_to_create && archive_wikitext.length < archive_configuration.min_size_to_create) {
			// 字元數超過了這個長度，才會造出首個存檔。
			return;
		}
		// 存檔頁面標頭。未設定時預設為{{tl|Talk archive}}。
		const archive_header = archive_configuration.archive_header ?? wiki.latest_task_configuration?.general?.archive_header
			// default: using Template:Archive
			?? (use_language === 'zh' ? '{{Talk archive}}' : '{{Archive}}');
		if (archive_header) {
			archive_wikitext = archive_header.toString().trim() + '\n\n' + archive_wikitext;
		}
	}

	const summary = [CeL.wiki.title_link_of(
		wiki.to_namespace(archive_template_name, 'template')
		// && 'Project:ARCHIVE'
		,
		// gettext_config:{"id":"archiving-operation"}
		CeL.gettext('Archiving operation')) + ':',
	CeL.wiki.title_link_of(archive_root_page), '→', CeL.wiki.title_link_of(archive_to_page)]
		.join(' ');
	const summary_tail = `: ${sections_need_to_archive.map(section => CeL.wiki.title_link_of('#' + section.section_title.link[1])).join(', ')}`;
	//console.trace([archive_to_page, summary, summary_tail]);

	// 添附記錄: 寫入存檔失敗則 throw，不刪除原討論頁內容。
	await wiki.edit_page(archive_to_page, (archive_to_page.wikitext ? archive_to_page.wikitext.trim() + '\n\n' : '') + archive_wikitext.trim() + '\n\n', {
		bot: 1, minor: 1, summary: summary + ': '
			// TODO: 1件のスレッドを「%1」より過去ログ化 (7日以上経過、過去ログ満杯)
			// gettext_config:{"id":"append-$1-topics"}
			+ CeL.gettext('Append %1 {{PLURAL:%1|topic|topics}}', sections_need_to_archive.length) + summary_tail
	});

	// TODO: updating broken links
	sections_need_to_archive.forEach(
		section => section.replace_by(archive_configuration.left_link
			&& CeL.gettext(archive_configuration.left_link.toString(), section.section_title.link[0] + '#' + section.section_title.link[1])
		)
	);
	// 移除記錄
	// TODO: 1件のスレッドを「%1」へ過去ログ化 (7日以上経過、過去ログ満杯)
	await wiki.edit_page(archive_root_page, parsed.toString(), {
		nocreate: 1, bot: 1, minor: 1, summary: summary + ': '
			// gettext_config:{"id":"remove-$1-topics"}
			+ CeL.gettext('Remove %1 {{PLURAL:%1|topic|topics}}', sections_need_to_archive.length) + summary_tail
	});
}
