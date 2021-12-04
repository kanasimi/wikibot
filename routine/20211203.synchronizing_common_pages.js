/*

node 20211203.page_synchronizer.js use_project=wikinews

	初版試營運。
	完成。正式運用。

TODO:
+ interwiki links @ wikidata
有權限，並且版權相容的情況下，採用匯入頁面的方式（匯入revision的方式）。

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Load modules.
CeL.run([]);

//login_options.API_URL = 'en';

// Set default language. 改變預設之語言。 e.g., 'zh'
//set_language('ja');
/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

const DEFAULT_min_interval = '1 week';

// ----------------------------------------------------------------------------

let summary_prefix;

// 讀入手動設定 manual settings。
async function adapt_configuration(latest_task_configuration) {
	//console.log(wiki.latest_task_configuration);

	// ----------------------------------------------------

	const { general } = latest_task_configuration;

	// 匯入 工具頁面
	summary_prefix = CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title, CeL.gettext('同步通用頁面')) + ': ';
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
	const site_info = wiki.site_name({ get_all_properties: true });
	//console.log(site_info);

	const Pages = wiki.latest_task_configuration.Pages;
	const page_length = Object.keys(Pages).length;
	let page_count = 0;
	for (const page_id in Pages) {
		let options = Pages[page_id] || Object.create(null);
		if (typeof options === 'string') {
			// TODO: options === 'w:en:title'
			options = { target_title: options };
		}
		const site_name = options?.site || site_info.language + '.wikipedia';
		//console.log(site_name);
		let source_wiki = wiki_Map.get(site_name);
		if (!source_wiki) {
			source_wiki = new Wikiapi({ ...login_options, API_URL: site_name });
			//await wiki.login(login_options);
			source_wiki.processed_page_title_Set = new Set;

			const skip_pages = wiki.latest_task_configuration.general.skip_pages;
			if (Array.isArray(skip_pages)) {
				await source_wiki.register_redirects(skip_pages);
				source_wiki.skip_pages = skip_pages.map(page_title => source_wiki.redirect_target_of(page_title));
				//console.trace(source_wiki.skip_pages);
				//console.trace(source_wiki.skip_pages.includes(source_wiki.redirect_target_of('Template:doc')));
			}

			wiki_Map.set(site_name, source_wiki);
		}
		const source_site_info = source_wiki.site_name({ get_all_properties: true });
		//console.log(source_site_info);

		Object.assign(options, { source_wiki, source_site_info });

		// --------------------------------------------------------------------

		const source_page_title = options.source_title || options.title || page_id;
		const target_page_title = options.target_title || options.title || page_id;

		CeL.info(`${++page_count}/${page_length} Copying ${source_page_title}${source_page_title === target_page_title ? '' : ` → ${target_page_title}`}`);

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
		const parsed = CeL.wiki.parse(`{{${original_title}:0}}`, source_wiki.append_session_to_options());
		if (parsed.type !== 'transclusion') {
			// e.g., "{{int:Group-bot}}" → .type="function"
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
		// 先 redirects_root() 再添加原維基項目頁面的同名重定向。
		const redirects_taregt = await source_wiki.redirects_root(source_page_title);
		if (redirects_taregt)
			source_page_title = target_page_title = redirects_taregt;
	}

	const base_source_page_data = await edit_page(source_page_title, target_page_title, options);
	if (!base_source_page_data) {
		//CeL.warn(``);
		return;
	}

	delete options.depended_on_by;

	if (wiki.is_namespace(target_page_title, 'template')) {
		await edit_page(source_page_title + '/doc', target_page_title + '/doc', options);
		// https://en.wikipedia.org/wiki/Wikipedia:TemplateStyles
		await edit_page(source_page_title + '/styles.css', target_page_title + '/styles.css', options);

		if (source_page_title === target_page_title) {
			// 添加原維基項目頁面的同名重定向。
			const redirects_list = await source_wiki.redirects(base_source_page_data);
			//console.trace(redirects_list);
			if (redirects_list.length > 0) {
				CeL.info(`${for_each_page_pair.name}: 添加原維基項目頁面的同名重定向 ${CeL.wiki.title_link_of(base_source_page_data)} ← ${redirects_list.map(redirects_page_data => CeL.wiki.title_link_of(redirects_page_data)).join(', ')}`);
				for (const redirects_page_data of redirects_list) {
					//console.trace([redirects_page_data, source_wiki.is_namespace(redirects_page_data, base_source_page_data)]);
					if (source_wiki.is_namespace(redirects_page_data, base_source_page_data))
						await edit_page(redirects_page_data, redirects_page_data.title, options);
				}
			}
		}

		// 添加相依模板。 test {{template name}}, {{#invoke:module name|}} in base_source_page_data
		for (const matched of base_source_page_data.wikitext.matchAll(/(?:^|[^{]){{#invoke: *([^{}|\s]+[^{}|]*)\|/g)) {
			const source_module_title = source_wiki.to_namespace(source_wiki.normalize_title(matched[1]), 'module');
			if (need_skip_page(source_module_title, source_wiki))
				continue;
			CeL.info(`${for_each_page_pair.name}: ${CeL.wiki.title_link_of(base_source_page_data)} dependent on module → ${CeL.wiki.title_link_of(source_module_title)}`);
			await for_each_page_pair(source_module_title, source_module_title, { ...options, depended_on_by: base_source_page_data });
		}

		for (const matched of base_source_page_data.wikitext.matchAll(/(?:^|[^{]){{ *([^{}|#\s]+[^{}|#]*)/g)) {
			matched[1] = source_wiki.normalize_title(matched[1]);
			const source_template_title = source_wiki.is_namespace(matched[1], 0) ? source_wiki.to_namespace(matched[1], 'template') : matched[1];
			if (need_skip_page(source_template_title, source_wiki, matched[1]))
				continue;
			CeL.info(`${for_each_page_pair.name}: ${CeL.wiki.title_link_of(base_source_page_data)} dependent on → ${CeL.wiki.title_link_of(source_template_title)}`);
			await for_each_page_pair(source_template_title, source_template_title, { ...options, depended_on_by: base_source_page_data });
		}

	} else if (wiki.is_namespace(target_page_title, 'module')) {
		// copy all pages prefixed with `target_page_title`
		const sub_page_list = await source_wiki.prefixsearch(base_source_page_data.title + '/');
		for (const sub_page_data of sub_page_list) {
			//console.assert(sub_page_data.title.startsWith(base_source_page_data.title + '/'));
			if (!sub_page_data.title.startsWith(base_source_page_data.title + '/')) {
				CeL.warn(`${for_each_page_pair.name}: ${CeL.wiki.title_link_of(sub_page_data.title)} is not starts with ${CeL.wiki.title_link_of(base_source_page_data.title + '/')} `);
				return;
			}
			const postfix = sub_page_data.title.slice((base_source_page_data.title).length);
			console.assert(postfix.startsWith('/'));
			if (/\/(?:sandbox|te?mp|testcases)/i.test(postfix))
				return;
			await edit_page(source_page_title + postfix, target_page_title + postfix, options);
		}

		// 添加相依模板。 test `require('Module:module name')` in base_source_page_data
		for (const matched of base_source_page_data.wikitext.matchAll(/(?:^|\W)require *\( *'([^'\s]+[^']*)' *\)/g)) {
			const source_module_title = source_wiki.normalize_title(matched[1]);
			if (need_skip_page(source_module_title, source_wiki))
				continue;
			CeL.info(`${for_each_page_pair.name}: ${CeL.wiki.title_link_of(base_source_page_data)} dependent on module → ${CeL.wiki.title_link_of(source_module_title)}`);
			await for_each_page_pair(source_module_title, source_module_title, { ...options, depended_on_by: base_source_page_data });
		}
	}
}

async function edit_page(source_page_title, target_page_title, options) {
	const { source_wiki, source_site_info } = options;
	const source_page_data = await source_wiki.page(source_page_title);
	//console.log(source_page_data);
	source_wiki.processed_page_title_Set.add(source_page_title.title);
	if (CeL.wiki.is_page_data(source_page_title))
		source_page_title = source_page_title.title;
	const source_page_link = CeL.wiki.title_link_of(source_site_info.interwiki_prefix + source_page_title);
	const revision = CeL.wiki.content_of.revision(source_page_data);
	// 檢查版本存在 min_interval 以上才複製，避免安全隱患，例如原維基項目頁面被惡意篡改。
	const min_interval = CeL.date.to_millisecond(options.min_interval || DEFAULT_min_interval);
	if (!(Date.now() - Date.parse(revision?.timestamp) > min_interval)) {
		if (revision?.timestamp)
			CeL.warn(`${edit_page.name}: ${source_page_link}: ${revision?.timestamp ? `最新版本為${CeL.date.indicate_date_time(Date.now() - Date.parse(revision?.timestamp))}編輯，時間過近，小於${CeL.date.age_of(Date.now() - min_interval)}` : `不存在此頁面`}，跳過此頁面。`);
		return;
	}
	let wikitext = source_page_data.wikitext;
	//console.log(wikitext);
	if (!wikitext) {
		//CeL.warn(`${edit_page.name}: `);
		return;
	}

	const source_redirect_to = CeL.wiki.parse.redirect(source_page_data);
	const target_page_data = await wiki.page(target_page_title);
	if (source_redirect_to) {
		const target_redirect_to = CeL.wiki.parse.redirect(target_page_data);
		if (target_redirect_to) {
			if (target_redirect_to !== source_redirect_to)
				CeL.warn(`${edit_page.name}: 來源維基項目 ${source_page_link} → ${CeL.wiki.title_link_of(source_redirect_to)}，但目標維基項目 → ${CeL.wiki.title_link_of(target_redirect_to)}，兩者不同！跳過此頁面。`);
			return;
		}
	} else {
		const prefix = `本頁面複製自${source_page_link}，由機器人定期更新。請直接編輯原維基項目頁面，或自設定頁面${CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title)}去除本頁面之後再編輯。`;
		if (wiki.is_namespace(target_page_title, 'template')) {
			if (!target_page_title.includes('/')) {
				// {{info|}}
				wikitext = `<noinclude><!-- ${prefix} --></noinclude>` + wikitext;
			}
		} else if (wiki.is_namespace(target_page_title, 'module')) {
			wikitext = `-- ${prefix}\n` + wikitext;
		}
	}
	if (target_page_data.wikitext !== wikitext && target_page_data.wikitext !== source_page_data.wikitext) {
		if (target_page_data.wikitext) {
			CeL.info(`${edit_page.name}: 覆蓋目標頁面 ${CeL.wiki.title_link_of(target_page_data)}`);
		}
		await wiki.edit_page(target_page_title, wikitext, {
			//nocreate: 1,
			summary: summary_prefix
				// 自中文維基百科匯入Template:Fullurl2的版本58191651
				+ source_page_link + ' ' + CeL.wiki.title_link_of(source_site_info.interwiki_prefix + 'Special:PermanentLink/' + revision.revid, '版本' + revision.revid)
				+ (source_redirect_to ? ` (添加原維基項目頁面的同名重定向 ${CeL.wiki.title_link_of(target_page_title)}→${CeL.wiki.title_link_of(source_redirect_to)})` : '')
				// 受 options.depended_on_by 所依賴
				+ (options.depended_on_by ? ` is depended on by ${CeL.wiki.title_link_of(options.depended_on_by)}` : '')
		});
	}
	return source_page_data;
}
