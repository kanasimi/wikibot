/*
node 20251126.Move_exposed_template_Collapsible_option_to_Navbox_documentation.js use_project=zh
node 20251126.Move_exposed_template_Collapsible_option_to_Navbox_documentation.js use_project=zh "check_page=Template:地质年代|Template:太阳系"

這個任務會清理navbox模板中裸露的{{Collapsible option}}，改用{{Navbox documentation}}。

	初版試營運


*/

'use strict';

// Load replace tools.
const replace_tool = require('../replace/replace_tool.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
//set_language('zh');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// ----------------------------------------------

const template_name_hash = {
	Collapsible_option: 'Collapsible option',
	Navbox_documentation: 'Navbox documentation',
};

// ----------------------------------------------

/**
 * 由設定頁面讀入手動設定 manual settings。
 * 
 * @param {Object}latest_task_configuration
 *            最新的任務設定。
 */
async function adapt_configuration(latest_task_configuration) {
	//console.log(latest_task_configuration);
	// console.log(wiki);

	// ----------------------------------------------------

	if (!latest_task_configuration.general)
		latest_task_configuration.general = Object.create(null);
	const { general } = latest_task_configuration;

	console.trace(wiki.latest_task_configuration.general);
}

// ----------------------------------------------------------------------------

(async () => {
	login_options.configuration_adapter = adapt_configuration;
	//console.log(login_options);
	await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
	await main_process();
	routine_task_done('1 week');
})();

// ----------------------------------------------------------------------------

async function main_process() {
	await wiki.register_redirects(template_name_hash, { namespace: 'Template', no_message: true, update_page_name_hash: true });
	console.log('Redirect targets:', template_name_hash);

	if (CeL.env.arg_hash.check_page && typeof CeL.env.arg_hash.check_page === 'string') {
		// for testing only
		await for_page_list(CeL.env.arg_hash.check_page.split('|'));
		return;
	}


	for await (let page_list of wiki.embeddedin('Template:' + template_name_hash.Collapsible_option, { namespace: 'template', batch_size: 500 })) {
		// [[Module:Documentation/config]]	cfg['doc-subpage'] = 'doc'	cfg['doc-link-display'] = '/doc'
		page_list = page_list.filter(page_data => !page_data.title.endsWith('/doc'));
		await for_page_list(page_list);
	}
}

async function for_page_list(page_list) {
	await wiki.for_each_page(page_list, handle_each_template, {
		redirects: false,
		summary: `${CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title, '清理導航模板中裸露的可折疊選項模板')}，改用{{${template_name_hash.Navbox_documentation}}}。`,
	});
}

async function handle_each_template(page_data) {
	CeL.log_temporary(`${handle_each_template.name}: 處理頁面 ${CeL.wiki.title_link_of(page_data)}`);
	const parsed = page_data.parse();
	let changed = false;
	await parsed.each('template', async template_token => {
		// 對於所有第一層的模板，假如是{{Collapsible option}}則直接轉成{{Navbox documentation}}。
		if (wiki.is_template(template_token, template_name_hash.Collapsible_option)) {
			// replace parameter name only
			template_token[0] = template_name_hash.Navbox_documentation;
			changed = true;
			return;
		}

		if (wiki.is_template(template_token, 'Documentation')) {
			// [[Module:Documentation]]	:wikitext(p._content(args, env))
			// content = args._content or mw.getCurrentFrame():expandTemplate{title = docTitle.prefixedText}
			// parameters.content優先權高於'/doc'子頁面。
			if (template_token.parameters.content) {
				const Navbox_documentation_template = await handle_Documentation_content(template_token.parameters.content);
				if (Navbox_documentation_template) {
					changed = true;
				}
				return Navbox_documentation_template;
				// parameters.content優先權高於'/doc'子頁面。不會再用到'/doc'子頁面，無須再檢查。
			}

			const doc_subpage = await wiki.page(`${page_data.title}/doc`);
			// 避免處理過大的頁面。
			if (doc_subpage.wikitext.trim() && doc_subpage.wikitext.trim().length < 1000) {
				const parsed_doc_subpage = doc_subpage.parse();
				parsed_doc_subpage.each('Template:Documentation subpage', template_token => CeL.wiki.parser.parser_prototype.each.remove_token);
				const Navbox_documentation_template = await handle_Documentation_content(parsed_doc_subpage);
				if (Navbox_documentation_template) {
					changed = true;
				}
				return Navbox_documentation_template;
			}
			return;
		}

	}, { depth: 1, modify: true });

	if (changed) {
		return parsed.toString();
	}
}

async function handle_Documentation_content(content) {
	let parameters_argument;
	// 檢查是否包含{{Collapsible option}}，將剩餘的內容轉成{{{3}}}。
	CeL.wiki.parser.parser_prototype.each.call(content, 'Template:' + template_name_hash.Collapsible_option, template_token => {
		//has_Collapsible_option = true;
		if (parameters_argument) {
			CeL.error(`${handle_Documentation_content.name}: 在同一個說明文件中發現多個{{${template_name_hash.Collapsible_option}}}，無法處理！`);
			parameters_argument = false;
			return CeL.wiki.parser.parser_prototype.each.exit;
		}

		const parameters = template_token.parameters;
		parameters_argument = {
			state: parameters.parameter_name || parameters.state,
			default: parameters[1] || parameters.state || parameters.autocollapse,
			nobase: parameters.nobase,
		};
		return CeL.wiki.parser.parser_prototype.each.remove_token;
	});

	if (!parameters_argument) {
		return;
	}

	content = content.toString().trim();
	if (content) {
		// 改成去掉{{Collapsible option}}後的內容。
		parameters_argument[3] = `
${content}
`;
	}

	const Navbox_documentation_template = CeL.wiki.parse.template_object_to_wikitext(template_name_hash.Navbox_documentation);
	CeL.wiki.parse.replace_parameter(Navbox_documentation_template, parameters_argument, { value_only: true, force_add: true, append_key_value: true });

	return Navbox_documentation_template;
}

