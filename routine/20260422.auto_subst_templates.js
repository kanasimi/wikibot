/*
node 20260422.auto_subst_templates.js use_project=zhwiki

這個任務會自動替換引用{{Needsubst|auto=yes}}的模板。

2026/4/25 9:31:36	初版試營運


*/

'use strict';

const debug_pages = ['Template:Infobox Twitch streamer', 'Template:Infobox bilibili personality', 'Template:Infobox YouTube personality']
	//&& null
	;


// Load replace tools.
const replace_tool = require('../replace/replace_tool.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
//set_language('zh');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

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

	if (!(0 <= general.max_pages_before_abort && general.max_pages_before_abort <= 500)) {
		// 不取代超過一定嵌入數量的模板。預設為100個。
		general.max_pages_before_abort = 100;
	}

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

function remove_empty_parameters(expanded_code) {
	expanded_code = expanded_code.toString();
	const parsed = CeL.wiki.parser(expanded_code).parse();
	CeL.assert([expanded_code, parsed.toString()],
		// gettext_config:{"id":"wikitext-parser-checking-$1"}
		CeL.gettext('wikitext parser checking: %1', JSON.stringify(expanded_code)));

	let changed = false;
	parsed.each('template', template_token => {
		const parameters = template_token.parameters;
		let _changed;
		for (const parameter_name in parameters) {
			if (parameters[parameter_name].toString().trim() === '') {
				// 警告: 當設定了重複的 parameter_name 時，只會消掉起作用的那個。
				template_token[template_token.index_of[parameter_name]] = '';
				_changed = changed = true;
			}
		}

		if (!_changed)
			return;

		for (let index = 1; index < template_token.length;) {
			if (template_token[index]) {
				index++;
			} else {
				template_token.splice(index, 1);
			}
		}
	});

	if (!changed) {
		return expanded_code;
	}

	return parsed.toString();
}

const KEY_auto_config_parameter = 'auto_config';

async function main_process() {

	for await (const page_list of (debug_pages ? [debug_pages]
		: wiki.categorymembers(wiki.latest_task_configuration.general.category_of_templates_to_be_automatically_substituted, { namespace: 'template', batch_size: 100, }))) {

		const auto_subst_configuration = new Map;

		await wiki.for_each_page(page_list.append(
			page_list
				.filter(page_data => !CeL.wiki.is_TDOC(page_data))
				.map(page_data => CeL.wiki.to_TDOC(page_data))
		), async page_data => {

			// Read configuration from doc page.
			const main_title = CeL.wiki.TDOC_to_main(page_data);
			const parsed = page_data.parse();
			CeL.assert([page_data.wikitext, parsed.toString()],
				// gettext_config:{"id":"wikitext-parser-checking-$1"}
				CeL.gettext('wikitext parser checking: %1', CeL.wiki.title_link_of(page_data)));

			if (wiki.is_namespace(wiki.latest_task_configuration.general.template_name_to_substitute, 'template')) {
				parsed.each(wiki.latest_task_configuration.general.template_name_to_substitute, template_token => {
					if (!template_token.parameters[KEY_auto_config_parameter]) {
						return;
					}
					try {
						const this_auto_subst_configuration = JSON.parse(template_token.parameters[KEY_auto_config_parameter]);
						if (!auto_subst_configuration.get(main_title) || !CeL.wiki.is_TDOC(page_data)) {
							auto_subst_configuration.set(main_title, this_auto_subst_configuration);
						}
					} catch (e) {
						CeL.error(`Failed to parse auto_subst_configuration: ${template_token.parameters[KEY_auto_config_parameter]}`);
					}
					//console.log(template_token);
				});
			}

			if (!auto_subst_configuration.has(main_title)) {
				auto_subst_configuration.set(main_title, undefined);
			}

		});

		for (const [template_title, this_auto_subst_configuration] of auto_subst_configuration) {
			let subst_postfix, must_manually_expand_subst;
			if (this_auto_subst_configuration.subst_postfix === 'remove_empty_parameters') {
				subst_postfix = remove_empty_parameters;
				must_manually_expand_subst = true;
			}

			const move_from_link = template_title;
			const move_to_link = 'subst:';
			//console.log([move_from_link, move_to_link]);
			await replace_tool.replace({
				//[KEY_wiki_session]
				wiki,
				use_language,
				// 嵌入本模板的頁面數量太多，跳過本模板不處理。
				max_pages_before_abort: wiki.latest_task_configuration.general.max_pages_before_abort,
				work_options: { no_message: true, },
				not_bot_requests: true,
				no_move_configuration_from_command_line: true,
				subst_postfix,
				log_to: null,
				summary: `${CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title, '自動替換引用模板')}: ${CeL.wiki.title_link_of(move_from_link)}`
				//+ ' 人工監視檢測中 '
				,
			}, {
				[move_from_link]: {
					//namespace: 'main|Template',
					move_to_link,
				},
			});
		}

	}
}

