/*

2021/9/3 14:29:5	初版試營運。
2021/11/12 13:33:11	完成。正式運用。

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Load additional modules.
//CeL.run([]);

//login_options.API_URL = 'en';

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('en');
/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// ----------------------------------------------------------------------------

let summary_prefix;

// 讀入手動設定 manual settings。
async function adapt_configuration(latest_task_configuration) {
	//console.log(latest_task_configuration);
	// console.log(wiki);

	// ----------------------------------------------------

	const { general } = latest_task_configuration;

	summary_prefix = CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title, CeL.gettext('Maintain challenge templates')) + ': ';
}

// ----------------------------------------------------------------------------

(async () => {
	login_options.configuration_adapter = adapt_configuration;
	//console.log(login_options);
	await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
	await main_process();
})();

async function main_process() {
	const challenge_template_list = [];
	await wiki.category_tree('Wikipedia article challenge templates', { for_each_page(data) { challenge_template_list.push(data); } });
	await wiki.register_redirects(['Template:WikiProject banner shell', 'Template:WikiProject Disambiguation'].append(challenge_template_list));
	for (const template_page_data of challenge_template_list) {
		await for_each_challenge_template(template_page_data);
	}

	routine_task_done('1 day');
}

// ----------------------------------------------------------------------------

async function for_each_challenge_template(template_page_data) {
	const options = wiki.latest_task_configuration.template_list[template_page_data.title];
	if (!options)
		return;

	options.template_page = wiki.remove_namespace(template_page_data.title);
	const list_page_list = await wiki.prefixsearch(options.subpages_of);
	//console.log(list_page_list);
	const talk_page_list = [];
	const pages_transcluding_template = new Set((await wiki.embeddedin(template_page_data)).map(page_data => page_data.title));
	const pages_transcluding_template_count = pages_transcluding_template.size;
	await wiki.for_each_page(list_page_list, page_data => {
		const parsed = CeL.wiki.parser(page_data);
		parsed.each('link', token => {
			const page_title = token[0].toString();
			if (!wiki.is_namespace(page_title, 'main')) return;

			const talk_page_title = wiki.to_talk_page(page_title);
			if (pages_transcluding_template.has(talk_page_title))
				pages_transcluding_template.delete(talk_page_title);
			else if (talk_page_title)
				talk_page_list.push(talk_page_title);
		});
	});
	CeL.info(`${template_page_data.title}: ${pages_transcluding_template_count} pages transcluding this template. ${talk_page_list.length} pages to check.`);
	//console.log(talk_page_list);

	await wiki.for_each_page(talk_page_list, [for_each_item, { operator_options: options }], {
		//tags: 'bot trial',
		nocreate: false, no_message: true,
		page_options: { prop: 'info|revisions', additional_query: { inprop: 'subjectid|associatedpage|varianttitles' } },
		summary: summary_prefix + `Insert challenge template {{${options.template_page}}} `
	});

	await wiki.edit_page(log_to, `* ${talk_page_list.length} pages checked. ~~~~
* ${pages_transcluding_template_count} pages transcluding ${CeL.wiki.title_link_of(template_page_data)}, ${pages_transcluding_template.size} of them seems not listed in [[${options.subpages_of.replace(/\/$/, '')}]]. You may add the page to list, or remove the template manually.
${Array.from(pages_transcluding_template).map(page_title => '# ' + CeL.wiki.title_link_of(page_title)).join('\n')}
`, {
		bot: 1, section: 'new', sectiontitle: `${CeL.wiki.title_link_of(template_page_data)}`,
		summary: `${summary_prefix}Report of ${CeL.wiki.title_link_of(template_page_data)}`
	});
}

// @see function maintain_VA_template_each_talk_page() @ 20200122.update_vital_articles.js
async function for_each_item(talk_page_data) {
	//console.trace(talk_page_data);

	// Do not create orphaned talk page.
	if (!('subjectid' in talk_page_data)) {
		CeL.warn(`${for_each_item.name}: The article of ${CeL.wiki.title_link_of(talk_page_data)} is not exists`);
		return Wikiapi.skip_edit;
	}

	if (CeL.wiki.parse.redirect(talk_page_data)) {
		// assert: ('redirect' in talk_page_data)
		CeL.warn(`${for_each_item.name}: ${CeL.wiki.title_link_of(talk_page_data)} redirecting to ${CeL.wiki.title_link_of(CeL.wiki.parse.redirect(talk_page_data))}`);
		//console.log(talk_page_data.wikitext);
		return Wikiapi.skip_edit;
	}

	// the bot only fix namespace=talk.
	if (!wiki.is_namespace(talk_page_data, 'talk')) {
		CeL.warn(`${for_each_item.name}: Skip invalid namesapce: ${CeL.wiki.title_link_of(talk_page_data)}`);
		return Wikiapi.skip_edit;
	}

	// ------------------------------------------------------------------------

	const options = this.operator_options;
	const parsed = CeL.wiki.parser(talk_page_data);

	let has_template, is_DAB, WikiProject_banner_shell_token;
	//console.log(talk_page_data.title);
	parsed.each('template', token => {
		if (wiki.is_template('WikiProject Disambiguation', token)) {
			// TODO: should test main article
			is_DAB = true;
			return parsed.each.exit;
		}

		// Should have been excluded via `pages_transcluding_template`.
		// But maybe redirects.
		if (wiki.is_template(options.template_page, token)) {
			// get the first one
			has_template = true;
			return parsed.each.exit;
		}

		if (wiki.is_template('WikiProject banner shell', token)) {
			WikiProject_banner_shell_token = token;
			// {{WikiProject banner shell}} has no .class
		}
	});

	if (is_DAB) {
		CeL.warn(`${for_each_item.name}: Skip DAB talk page: ${CeL.wiki.title_link_of(talk_page_data)}`);
		return Wikiapi.skip_edit;
	}

	if (has_template)
		return Wikiapi.skip_edit;

	// ------------------------------------------------------------------------

	let wikitext_to_add = `{{${options.template_page}}}`;
	if (WikiProject_banner_shell_token) {
		this.summary += 'into {{WikiProject banner shell}}';
		CeL.wiki.parse.replace_parameter(WikiProject_banner_shell_token, {
			'1': value => wikitext_to_add + '\n' + (value ? value.toString().trimStart() : '')
		}, 'value_only');
	} else {
		this.summary += 'as a hatnote';
		parsed.insert_layout_token(wikitext_to_add, /* hatnote_templates */'lead_templates_end');
	}

	return parsed.toString();
}
