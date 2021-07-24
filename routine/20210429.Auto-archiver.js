/*

node 20210429.Auto-archiver.js use_language=zh
node 20210429.Auto-archiver.js use_project=wikidata
node 20210429.Auto-archiver.js use_project=zh.wikiversity

2021/5/2 8:41:44	初版試營運。

[[w:en:Help:Archiving a talk page#Automated archiving]]

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

const archive_template_name = 'Auto-archive';

// ----------------------------------------------------------------------------

(async () => {
	await wiki.login(login_options);
	await wiki.for_each_page(await wiki.embeddedin('Template:' + archive_template_name), for_each_discussion_page);

	routine_task_done('1d');
})();

async function for_each_discussion_page(page_data) {
	let target_root_page = page_data;
	let parsed = target_root_page.parse();
	// Will use the first matched as configuration.
	const archive_configuration = parsed.find_template(archive_template_name)?.parameters;
	if (!archive_configuration) {
		CeL.console.error(`Cannot find {{${archive_template_name}}} in ${CeL.wiki.title_link_of(page_data)}`);
		return;
	}
	//console.log(archive_configuration);
	if (archive_configuration.stop)
		return;

	if (archive_configuration.target_root_page && archive_configuration.target_root_page !== page_data.title) {
		target_root_page = await wiki.page(archive_configuration.target_root_page);
		parsed = target_root_page.parse();
	}

	// 討論頁面超過此大小才存檔
	if (target_root_page.wikitext.length < archive_configuration.archive_exceed_size) {
		return;
	}

	const archive_after_last_comment = CeL.date.to_millisecond(archive_configuration.archive_after_last_comment || '1 week');
	//console.log(CeL.age_of(0, archive_after_last_comment));
	if (!archive_after_last_comment) {
		CeL.error(`Do not know when to archive on configuration of ${CeL.wiki.title_link_of(page_data)}`);
		return;
	}


	let sections_need_to_archive = [];

	parsed.each_section((section, index) => {
		if (index === 0) {
			// Skip the ffirst section.
			return;
		}

		const latest_timevalue = section.dates.max_timevalue;
		if (!latest_timevalue) {
			CeL.warn(`Cannot get latest date of ${section.section_title.link}`);
			return;
		}
		if (Date.now() - latest_timevalue < archive_after_last_comment) {
			return;
		}

		// This section is pinned and will not be automatically archived.
		if (parsed.find_template.call(section, 'Pin message')
			//
			|| parsed.find_template.call(section, 'Do not archive')) {
			return;
		}

		sections_need_to_archive.push(section);
		CeL.info(`Need archive #${sections_need_to_archive.length} (${CeL.age_of(latest_timevalue)}): ${section.section_title.title}`);
	}, {
		level_filter: archive_configuration.level || 2,
		get_users: true,
	});

	if (0 < archive_configuration.min_threads_left) {
		// 最少需要留下幾個議題(章節)
		//-1: the first section
		const left = Math.floor(parsed.sections.length - 1 - archive_configuration.min_threads_left);
		if (left <= 0)
			return;
		sections_need_to_archive.truncate(left);
	}

	if (0 < archive_configuration.min_threads_to_archive ? sections_need_to_archive.length < archive_configuration.min_threads_to_archive : sections_need_to_archive.length === 0) {
		return;
	}

	await archive_page({ archive_configuration, sections_need_to_archive, target_root_page, parsed });
}

async function select_archive_to_page(configuration) {
	const { archive_configuration, target_root_page } = configuration;

	const archive_prefix = target_root_page.title + '/';
	const subpages = (await wiki.prefixsearch(archive_prefix))
		.map(page_data => page_data.title.replace(archive_prefix, ''));
	const patterns = CeL.detect_serial_pattern(subpages);
	const archive_subpage_generator = archive_configuration.archive_to_subpage ? CeL.detect_serial_pattern.parse_generator(archive_configuration.archive_to_subpage)
		// Auto detect pattern of subpage title
		: patterns[0] ? patterns[0].generator
			// Default archive generator. See [[w:en:Template:Archives]]
			: CeL.detect_serial_pattern.parse_generator('Archive %1');
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
		if (archive_to_page.wikitext.length > archive_configuration.max_archive_page_size
			|| archive_to_page.wikitext.length > 10_000_000) {
			// 存檔頁面超過尺大小就轉到下一個存檔頁面
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

async function archive_page(configuration) {
	const { archive_configuration, sections_need_to_archive, target_root_page, parsed } = configuration;

	const archive_to_page = await select_archive_to_page(configuration);
	if (!archive_to_page)
		return;

	const archive_wikitext = sections_need_to_archive.map(section => section.section_title + section).join('');
	if ('missing' in archive_to_page) {
		if (0 < archive_configuration.min_size_to_create && archive_wikitext.length < archive_configuration.min_size_to_create) {
			// 字元數超過了這個長度，才會造出首個存檔。
			return;
		}
		if (archive_configuration.archive_header) {
			archive_wikitext = archive_configuration.archive_header.toString().trim() + '\n\n' + archive_wikitext;
		}
	}

	const summary = [CeL.wiki.title_link_of('Project:ARCHIVE', use_language === 'zh' ? '歸檔封存作業' : use_language === 'ja' ? '記録保存' : 'Archiving') + ':',
	CeL.wiki.title_link_of(target_root_page), '→', CeL.wiki.title_link_of(archive_to_page)]
		.join(' ');
	const summary_tail = ` ${sections_need_to_archive.length} topic(s): ${sections_need_to_archive.map(section => CeL.wiki.title_link_of('#' + section.section_title.link[1])).join(', ')}`;
	// 寫入存檔失敗則 throw，不刪除。
	await wiki.edit_page(archive_to_page, (archive_to_page.wikitext ? archive_to_page.wikitext.trim() + '\n\n' : '') + archive_wikitext.trim() + '\n\n',
		{ bot: 1, minor: 1, summary: `${summary}: Append${summary_tail}` });

	// TODO: updating broken links
	sections_need_to_archive.forEach(
		section => section.replace_by(archive_configuration.left_link
			&& CeL.gettext(archive_configuration.left_link.toString(), section.section_title.link[0] + '#' + section.section_title.link[1])
		)
	);
	await wiki.edit_page(target_root_page, parsed.toString(), { nocreate: 1, bot: 1, minor: 1, summary: `${summary}: Remove${summary_tail}` });
}
