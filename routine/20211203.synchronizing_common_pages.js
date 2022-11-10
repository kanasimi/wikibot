/*

node 20211203.synchronizing_common_pages.js use_project=zh.wikinews
node 20211203.synchronizing_common_pages.js use_project=zh.wiktionary

本任務會同步通用頁面。並檢查工具頁面，嘗試載入相依頁面。

2021/12/4 18:57:13	初版試營運。
2021/12/3 17:45:55	完成。正式運用。

TODO:
本地化轉換。
有跨維基匯入權限，並且版權相容的情況下，採用匯入頁面的方式（匯入revision的方式）。

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Load modules.
CeL.run([]);

// Set default language. 改變預設之語言。 e.g., 'zh'
//set_language('ja');
/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

const DEFAULT_min_interval = '1 week';

// ----------------------------------------------------------------------------

let summary_prefix;

// 讀入手動設定 manual settings。
async function adapt_configuration(latest_task_configuration) {
	const { general } = latest_task_configuration;
	if (!general)
		return;

	if (Array.isArray(general.skip_pages)) {
		general.skip_pages = general.skip_pages.map(page_title => {
			const matched = typeof page_title === 'string' && page_title.match(/^\s*\[\[(.+?)\]\]/);
			return matched ? matched[1] : page_title;
		});
	}

	// 匯入 工具頁面
	summary_prefix = CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title,
		// gettext_config:{"id":"synchronizing-common-pages"}
		CeL.gettext('Synchronizing common pages')) + ': ';

	console.log(wiki.latest_task_configuration);
}

// ----------------------------------------------------------------------------

(async () => {
	login_options.configuration_adapter = adapt_configuration;
	//console.log(login_options);
	await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
	await main_process();
})();

// wiki_Map[site_name] = {Wikiapi}wiki session
const wiki_Map = new Map;

const default_options = {
	"site": "來源維基項目。 e.g., zh.wikipedia",
	"source_title": "來源頁面", "target_title": "目標頁面", "title": "來源兼目標頁面",
	"min_interval": "檢查版本存在此時間以上才複製，避免安全隱患，例如原維基項目頁面被惡意篡改。 default: 1 week",
};

async function main_process() {
	//console.log(wiki.append_session_to_options());
	//console.log(wiki.append_session_to_options().session.latest_site_configurations);
	//console.log(wiki.append_session_to_options().session.configurations);
	//console.log(JSON.stringify(wiki.append_session_to_options().session.latest_site_configurations.interwikimap));
	const target_site_info = wiki.site_name({ get_all_properties: true });
	//console.log(target_site_info);

	const Pages = wiki.latest_task_configuration.Pages;
	const page_length = Object.keys(Pages).length;
	let page_count = 0;
	for (const page_id in Pages) {
		let options = Pages[page_id] || Object.create(null);
		if (typeof options === 'string') {
			options = options.trim();
			if (/^:*\w+:/.test(options)) {
				// e.g., 'w:en:title' or 'w:title' or 'en:title'
				const site_info = CeL.wiki.site_name(options, wiki.append_session_to_options({ get_all_properties: true }));
				options = { site: site_info.site, target_title: site_info.page_name };
			} else {
				// e.g., 'title' or ':title', treat as 'w:title'
				options = { target_title: options };
			}
		}
		const site_name = options?.site || target_site_info.language + '.wikipedia';
		//console.log(site_name);
		let source_wiki = wiki_Map.get(site_name);
		if (!source_wiki) {
			source_wiki = new Wikiapi({ ...login_options, API_URL: site_name });
			wiki_Map.set(site_name, source_wiki);
			//await wiki.login(login_options);
			source_wiki.processed_page_title_Set = new Set;

			const skip_pages = wiki.latest_task_configuration.general.skip_pages;
			if (Array.isArray(skip_pages)) {
				await source_wiki.register_redirects(skip_pages);
				source_wiki.skip_pages = skip_pages.map(page_title => source_wiki.redirect_target_of(page_title));
				//console.trace(source_wiki.skip_pages);
				//console.trace(source_wiki.skip_pages.includes(source_wiki.redirect_target_of('Template:doc')));
			}
		}
		const source_site_info = source_wiki.site_name({ get_all_properties: true });
		//console.log(source_site_info);

		Object.assign(options, { source_wiki, source_site_info, target_site_info, rvprop: 'ids|timestamp|user|comment' });

		// --------------------------------------------------------------------

		const source_page_title = options.source_title || options.title || page_id;
		const target_page_title = options.target_title || options.title || page_id;

		CeL.info(`${main_process.name}: ${++page_count}/${page_length} ${CeL.gettext(
			// gettext_config:{"id":"synchronizing-$1"}
			'Synchronizing %1', source_page_title)}${source_page_title === target_page_title ? '' : ` → ${target_page_title}`}`);

		await for_each_page_pair(source_page_title, target_page_title, options);
	}

	routine_task_done('1 week');
}

// ----------------------------------------------------------------------------

function need_skip_page(page_title, source_wiki, original_title) {
	// test magic words
	if (page_title.endsWith(':')) {
		// e.g., {{NAMESPACE:{{...}}}}
		return true;
	}

	if (original_title) {
		const parsed = CeL.wiki.parse(`{{${original_title}}}`, source_wiki.append_session_to_options());
		//console.trace(parsed);
		if (parsed.type !== 'transclusion') {
			// e.g., "{{int:Group-bot}}" → .type === 'magic_word_function'
			return true;
		}
	}

	return source_wiki.skip_pages.includes(source_wiki.redirect_target_of(page_title))
		|| source_wiki.processed_page_title_Set.has(page_title);
}

async function for_each_page_pair(source_page_title, target_page_title, options) {
	const { source_wiki } = options;
	if (need_skip_page(source_page_title, source_wiki))
		return;

	if (wiki.is_namespace(target_page_title, 'template') && source_page_title === target_page_title) {
		// 先 redirects_root() 再添加與原維基項目頁面同名的重定向。
		const redirects_taregt = await source_wiki.redirects_root(source_page_title);
		if (redirects_taregt)
			source_page_title = target_page_title = redirects_taregt;
	}

	const base_source_page_data = await edit_page(source_page_title, target_page_title, options);
	if (!base_source_page_data
		// 更新所依賴的模板與模組。這個選項可每個項目個別設定。
		|| ('update_depended_pages' in options ? options.update_depended_pages : !wiki.latest_task_configuration.general.update_depended_pages)) {
		//CeL.warn(``);
		return;
	}

	// options_for_depended_page: 這個選項不應該帶進其他頁面。
	delete options.replace_text;
	delete options.depended_on_by;

	if (wiki.is_namespace(target_page_title, 'template')) {
		// ks: '/دَستاویز'
		await edit_page(source_page_title + '/doc', target_page_title + '/doc', options);
		// https://en.wikipedia.org/wiki/Wikipedia:TemplateStyles
		await edit_page(source_page_title + '/styles.css', target_page_title + '/styles.css', options);

		if (source_page_title === target_page_title) {
			// 添加與原維基項目頁面同名的重定向。
			const redirects_list = await source_wiki.redirects(base_source_page_data);
			//console.trace(redirects_list);
			if (redirects_list.length > 0) {
				CeL.info(`${for_each_page_pair.name}: ` + CeL.gettext(
					// gettext_config:{"id":"create-a-redirect-with-the-same-name-as-the-original-wiki-project-page-$1"}
					'Create a redirect with the same name as the original wiki project page: %1',
					CeL.wiki.title_link_of(base_source_page_data) + ' ← ' + redirects_list.map(redirects_page_data => CeL.wiki.title_link_of(redirects_page_data)).join(', ')
				));
				for (const redirects_page_data of redirects_list) {
					//console.trace([redirects_page_data, source_wiki.is_namespace(redirects_page_data, base_source_page_data)]);
					if (source_wiki.is_namespace(redirects_page_data, base_source_page_data))
						await edit_page(redirects_page_data, redirects_page_data.title, options);
				}
			}
		}

		// 偵測並添加相依模板。 test {{template name}}, {{#invoke:module name|}} in base_source_page_data
		for (const matched of base_source_page_data.wikitext.matchAll(/(?:^|[^{]){{#invoke: *([^{}|\s]+[^{}|]*)\|/g)) {
			const source_module_title = source_wiki.to_namespace(source_wiki.normalize_title(matched[1]), 'module');
			if (need_skip_page(source_module_title, source_wiki))
				continue;
			CeL.info(`${for_each_page_pair.name}: `
				// gettext_config:{"id":"$1-dependent-on-module-→-$2"}
				+ CeL.gettext('%1 dependent on module → %2', CeL.wiki.title_link_of(base_source_page_data), CeL.wiki.title_link_of(source_module_title))
			);
			await for_each_page_pair(source_module_title, source_module_title, { ...options, depended_on_by: base_source_page_data });
		}

		for (const matched of base_source_page_data.wikitext.matchAll(/(?:^|[^{]){{ *([^{}|#\s]+[^{}|#]*)/g)) {
			matched[1] = source_wiki.normalize_title(matched[1]
				// e.g., "<includeonly>safesubst:</includeonly>User-multi<noinclude>/template</noinclude>"
				.replace(/<(includeonly|noinclude)>[\s\S]*?<\/\1>/g, '').replace(/<(includeonly|noinclude) *\/>/g, ''));
			const source_template_title = !matched[1].includes(':') || source_wiki.is_namespace(matched[1], 0) ? source_wiki.to_namespace(matched[1], 'template') : matched[1];
			if (need_skip_page(source_template_title, source_wiki, matched[1]))
				continue;
			CeL.info(`${for_each_page_pair.name}: `
				// gettext_config:{"id":"$1-dependent-on-→-$2"}
				+ CeL.gettext('%1 dependent on → %2', CeL.wiki.title_link_of(base_source_page_data), CeL.wiki.title_link_of(source_template_title))
			);
			await for_each_page_pair(source_template_title, source_template_title, { ...options, depended_on_by: base_source_page_data });
		}

	} else if (wiki.is_namespace(target_page_title, 'module')) {
		// copy all pages prefixed with `target_page_title`
		const sub_page_list = await source_wiki.prefixsearch(base_source_page_data.title + '/');
		for (const sub_page_data of sub_page_list) {
			//console.assert(sub_page_data.title.startsWith(base_source_page_data.title + '/'));
			if (!sub_page_data.title.startsWith(base_source_page_data.title + '/')) {
				CeL.warn(`${for_each_page_pair.name}: `
					// gettext_config:{"id":"$1-does-not-start-with-$2"}
					+ CeL.gettext('%1 does not start with %2', CeL.wiki.title_link_of(sub_page_data.title), base_source_page_data.title + '/')
				);
				return;
			}
			const postfix = sub_page_data.title.slice((base_source_page_data.title).length);
			console.assert(postfix.startsWith('/'));
			if (/\/(?:sandbox|te?mp|testcases)/i.test(postfix))
				return;
			await edit_page(source_page_title + postfix, target_page_title + postfix, options);
		}

		// 偵測並添加相依模板。 test `require('Module:module name')` in base_source_page_data
		for (const matched of base_source_page_data.wikitext.matchAll(/(?:^|\W)require *\( *'([^'\s]+[^']*)' *\)/g)) {
			const source_module_title = source_wiki.normalize_title(matched[1]);
			if (need_skip_page(source_module_title, source_wiki))
				continue;
			CeL.info(`${for_each_page_pair.name}: `
				// gettext_config:{"id":"$1-dependent-on-module-→-$2"}
				+ CeL.gettext('%1 dependent on module → %2', CeL.wiki.title_link_of(base_source_page_data), CeL.wiki.title_link_of(source_module_title))
			);
			await for_each_page_pair(source_module_title, source_module_title, { ...options, depended_on_by: base_source_page_data });
		}
	}
}

async function edit_page(source_page_title, target_page_title, options) {
	const { source_wiki, source_site_info, target_site_info } = options;
	const source_page_data = await source_wiki.page(source_page_title);
	//console.trace(source_page_data);
	source_wiki.processed_page_title_Set.add(source_page_data.title);
	//console.trace(source_wiki.processed_page_title_Set);
	if (CeL.wiki.is_page_data(source_page_title))
		source_page_title = source_page_title.title;
	const source_page_link = CeL.wiki.title_link_of(source_site_info.interwiki_prefix + source_page_title);
	const revision = CeL.wiki.content_of.revision(source_page_data);
	// 檢查版本存在 min_interval 以上才複製，避免安全隱患，例如原維基項目頁面被惡意篡改。
	const min_interval = CeL.date.to_millisecond(options.min_interval || DEFAULT_min_interval);
	if (!(Date.now() - Date.parse(revision?.timestamp) > min_interval)) {
		if (revision?.timestamp) {
			//console.trace(revision.timestamp);
			CeL.warn(`${edit_page.name}: ${source_page_link}: `
				+ CeL.gettext(
					revision?.timestamp
						// gettext_config:{"id":"the-latest-version-was-edited-in-$1-too-close-to-time-later-than-$2-skip-this-page"}
						? 'The latest version was edited in %1, too close to time, later than %2, skip this page.'
						// gettext_config:{"id":"this-page-does-not-exist-skip-this-page"}
						: 'This page does not exist, skip this page.'
					, CeL.date.indicate_date_time(revision?.timestamp)
					, CeL.date.age_of(Date.now() - min_interval)
				)
			);
		}
		return;
	}
	let wikitext = source_page_data.wikitext;
	//console.log(wikitext);
	if (!wikitext) {
		//CeL.warn(`${edit_page.name}: `);
		return;
	}

	const replace_text = CeL.is_Object(options.replace_text) ? Object.entries(options.replace_text)
		// e.g., replace_text:[["from","to"],["from","to"]]
		: Array.isArray(options.replace_text) && (options.replace_text.length !== 2 || typeof options.replace_text[1] !== 'string' || CeL.PATTERN_RegExp_replacement.test(options.replace_text[1])) ? options.replace_text
			// e.g., replace_text:"/from/to/"
			: options.replace_text ? [options.replace_text]
				: [];
	// patch for 頁面不能直接同步
	replace_text.forEach(replace_text_pattern => {
		if (typeof replace_text_pattern === 'string') {
			// e.g., pattern = "/維基百科/維基新聞/g"
			replace_text_pattern = replace_text_pattern.to_RegExp({ allow_replacement: true });
		}
		// Modify from wiki/replace/replace_tool.js
		if (CeL.is_RegExp(replace_text_pattern) && typeof replace_text_pattern.replace === 'function') {
			wikitext = replace_text_pattern.replace(wikitext);
		} else if (Array.isArray(replace_text_pattern) && replace_text_pattern.length === 2
			&& typeof replace_text_pattern[0] === 'string' && replace_text_pattern[0]
			&& (replace_text_pattern[1] || replace_text_pattern[1] === '')) {
			const replace_from = typeof replace_text_pattern[0] === 'string' ? replace_text_pattern[0].to_RegExp() : replace_text_pattern[0];
			wikitext = wikitext.replace(replace_from, replace_text_pattern[1]);
		} else {
			CeL.error(`Ignore invalid options.replace_text pattern: ${replace_text_pattern}`);
		}
	});

	const source_redirect_to = CeL.wiki.parse.redirect(source_page_data);
	const target_page_data = await wiki.page(target_page_title);
	let additional_description = options?.additional_description?.trim();
	if (source_redirect_to) {
		const target_redirect_to = CeL.wiki.parse.redirect(target_page_data);
		if (target_redirect_to) {
			if (source_wiki.normalize_title(target_redirect_to) !== source_wiki.normalize_title(source_redirect_to)) {
				CeL.error(`${edit_page.name}: `
					// gettext_config:{"id":"the-page-$1-of-the-source-wiki-project-redirects-to-$2-but-the-same-page-of-the-target-wiki-project-redirects-to-$3-they-are-different!-skip-this-page"}
					+ CeL.gettext('The page %1 of the source wiki project redirects to %2, but the same page of the target wiki project redirects to %3, they are different! Skip this page.', source_page_link, CeL.wiki.title_link_of(source_redirect_to), CeL.wiki.title_link_of(target_redirect_to))
				);
			}
			return;
		}

	} else {
		// gettext_config:{"id":"this-page-is-copied-from-$1-and-updated-regularly-by-the-robot.-please-edit-the-original-wiki-project-page-directly-or-edit-this-page-after-removing-it-from-$2-of-the-custom-page"}
		const prefix = CeL.gettext('This page is copied from %1 and updated regularly by the robot. Please edit the original wiki project page directly, or edit this page after removing it from %2 of the custom page.', source_page_link, CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title));
		const is_template = wiki.is_namespace(target_page_title, 'template'), is_module = wiki.is_namespace(target_page_title, 'module');
		if ((is_template || is_module) && target_page_title.endsWith('/doc')) {
			if (!additional_description) {
				// gettext_config:{"id":"template-documentation-to-assist-in-understanding"}
				additional_description = CeL.gettext('Template documentation to assist in understanding');
			}
			// e.g., [[Module:InfoboxImage/doc]]
			wikitext = `<noinclude><!-- ${prefix} --></noinclude>` + wikitext;

		} else if (is_template && target_page_title.endsWith('/styles.css')) {
			// assert: contentmodel:sanitized-css
			if (!additional_description) {
				// gettext_config:{"id":"required-template-style-file"}
				additional_description = CeL.gettext('Required template style file');
			}
			wikitext = `/* ${prefix} */\n` + wikitext;

		} else if (is_template) {
			if (!target_page_title.includes('/')) {
				// {{info|}}
				wikitext = `<noinclude><!-- ${prefix} --></noinclude>` + wikitext;
			}

		} else if (is_module) {
			wikitext = `-- ${prefix}\n` + wikitext;
		}
	}

	if (target_page_data.wikitext !== wikitext && target_page_data.wikitext !== source_page_data.wikitext) {
		if (target_page_data.wikitext) {
			CeL.info(`${edit_page.name}: `
				// gettext_config:{"id":"overwrite-target-page-$1"}
				+ CeL.gettext('Overwrite target page %1', CeL.wiki.title_link_of(target_page_data)));
		}
		try {
			await wiki.edit_page(target_page_title, wikitext, {
				bot: 1,
				//nocreate: 1,
				summary: summary_prefix
					// 自中文維基百科匯入Template:Fullurl2的版本58191651
					+ source_page_link + ' ' + new Date(revision.timestamp).format('%Y-%2m-%2d') + ' '
					+ CeL.wiki.title_link_of(source_site_info.interwiki_prefix + 'Special:PermanentLink/' + revision.revid,
						// gettext_config:{"id":"revision-id-$1"}
						CeL.gettext('Revision id %1', revision.revid))
					// 加上原版本註解
					+ (revision.comment ? ` (${revision.comment})` : '')
					+ (replace_text.length > 0 ? ' '
						// gettext_config:{"id":"fine-tuned"}
						+ CeL.gettext('Fine-tuned') : '')
					// 受 options.depended_on_by 所依賴
					+ (options.depended_on_by ? ' ('
						// gettext_config:{"id":"required-by-$1"}
						+ CeL.gettext('Required by %1', CeL.wiki.title_link_of(options.depended_on_by)) + ')' : '')
					+ (additional_description ? ` (${additional_description})` : '')
					+ (source_redirect_to ? ` (${CeL.gettext(
						// gettext_config:{"id":"create-a-redirect-with-the-same-name-as-the-original-wiki-project-page-$1"}
						'Create a redirect with the same name as the original wiki project page: %1',
						CeL.wiki.title_link_of(target_page_title) + '→' + CeL.wiki.title_link_of(source_redirect_to)
					)})` : '')
			});
		} catch (e) {
			//CeL.error(e);
		}
	}

	// ---------------------------------------------------------------------------

	let data_entity;
	if (target_page_data.pageid > 0) {
		data_entity = await wiki.data(target_page_data);
		//console.trace(data_entity);
		if (!(data_entity.pageid > 0)) {
			// target_page_data exists, but has no link to wikidata.
			// TODO: add new item
			data_entity = null;
		}
	}
	if (!data_entity) {
		data_entity =
			//await source_wiki.data(source_page_data);
			// trick: 別增加太多 wiki data session 實體
			await wiki.data({ ...source_page_data, site: source_site_info.site });
		// + interwiki links @ wikidata
		//console.trace({ sitelinks: { [target_site_info.site]: target_page_data.title } });
		//console.trace(data_entity);
		if (data_entity.pageid > 0) {
			try {
				await data_entity.modify({
					sitelinks: { [target_site_info.site]: target_page_data.title }
				}, {
					bot: 1,
					// gettext_config:{"id":"adding-sitelinks-when-synchronizing-common-pages-$1-→-$2"}
					summary: CeL.gettext('Adding sitelinks when synchronizing common pages: %1 → %2', source_site_info.site, target_site_info.site)
				});
			} catch (e) {
				// Error to edit
				CeL.error(e);
			}
		} else {
			// e.g., /doc 頁面未連結到 wikidata。
		}
	}

	return source_page_data;
}
