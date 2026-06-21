/*
node 20260422.auto_subst_templates.js use_project=zhwiki

這個任務會自動替換引用{{.template_name_to_substitute|auto=yes|auto_config=}}的模板。

2026/4/25 9:31:36	初版試營運

TODO:
自嵌入的狀況不會一次替換完。

*/

'use strict';

const debug_pages = ['Template:Infobox Twitch streamer', 'Template:Infobox bilibili personality', 'Template:Infobox YouTube personality']
	&& ['Template:台北捷運色彩']
	&& ['Template:无锡地铁颜色']
	&& ['Template:Citeer web']
	&& ['Template:Lien web']
	&& ['Template:Audio-IPA']
	&& ['Template:越南省市']
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

async function main_process() {

	for await (const page_list of (debug_pages ? [debug_pages]
		: wiki.categorymembers(wiki.latest_task_configuration.general.category_of_templates_to_be_automatically_substituted, {
			//namespace: 'category',
			//namespace: 'template',
			batch_size: 100,
		}))) {

		/**{Map}自動 subst 採用的手動設定 manual settings。 */
		const auto_subst_configuration_Map = await get_auto_subst_configuration(page_list
			//.filter(page_data => /捷運|捷运|Rint\/Kh/.test(CeL.wiki.title_of(page_data)))
		);

		for (const [template_title, this_auto_subst_configuration] of auto_subst_configuration_Map) {
			await do_subst_template(template_title, this_auto_subst_configuration
				// 強制測試 .expand_transclusion()。
				&& { ...this_auto_subst_configuration, must_manually_expand_subst: true }
			);
			// 只測試一個頁面。
			//continue;
		}

	}
}


/**{String}指定手動設定 manual settings 採用的參數名稱。 */
const KEY_auto_config_parameter = 'auto_config';

/**
 * 由頁面之{{.template_name_to_substitute}}讀入自動 subst 採用的手動設定 manual settings。
 * @param {Array} page_data	{{.template_name_to_substitute}}所在頁面資料。
 * @returns {Object|Undefined} auto_subst_configuration 自動 subst 採用的手動設定 manual settings。 e.g., {subst_postfix: 'remove_empty_parameters'}
 */
function get_auto_subst_configuration_from_page(page_data) {
	// Read configuration from doc page.
	const parsed = page_data.parse();
	CeL.assert([page_data.wikitext, parsed.toString()],
		// gettext_config:{"id":"wikitext-parser-checking-$1"}
		CeL.gettext('wikitext parser checking: %1', CeL.wiki.title_link_of(page_data)));

	if (!wiki.is_namespace(wiki.latest_task_configuration.general.template_name_to_substitute, 'template')) {
		return;
	}

	let auto_subst_configuration;
	parsed.each(wiki.latest_task_configuration.general.template_name_to_substitute, template_token => {
		if (!template_token.parameters[KEY_auto_config_parameter]) {
			return;
		}
		let this_auto_subst_configuration;
		try {
			this_auto_subst_configuration = JSON.parse(template_token.parameters[KEY_auto_config_parameter].toString());
			//console.trace([this_auto_subst_configuration, auto_subst_configuration]);
			if (CeL.is_Object(auto_subst_configuration))
				Object.assign(auto_subst_configuration, this_auto_subst_configuration);
			else
				auto_subst_configuration = this_auto_subst_configuration;
		} catch (e) {
			CeL.error(`Failed to parse ${KEY_auto_config_parameter} on ${CeL.wiki.title_link_of(page_data)}: ${template_token.parameters[KEY_auto_config_parameter]}`);
			console.error(e);
		}
	});

	//console.trace(auto_subst_configuration, page_data);
	return auto_subst_configuration;
}

function filter_page_list(page_list) {
	// 只處理 template namespace 的頁面，且排除 sandbox。
	page_list = page_list
		.filter(page_data => wiki.is_namespace(page_data, 'template'))
		.map(page_data => CeL.wiki.title_of(page_data))
		.filter(page_title => !/\/sandbox$/i.test(page_title));

	return page_list;
}

/**
 * 由{{.template_name_to_substitute}}讀入自動 subst 採用的手動設定 manual settings。
 * @param {Array} page_list	{{.template_name_to_substitute}}所在頁面列表。
 * @returns {Map} auto_subst_configuration_Map Map<main_page_title, auto_subst_configuration>
 *  auto_subst_configuration_Map.get(main_page_title) = {
 *  	subst_postfix: 'remove_empty_parameters',
 *  }
 */
async function get_auto_subst_configuration(page_list) {
	const auto_subst_configuration_Map = new Map;
	function merge_auto_subst_configuration(page_data, this_auto_subst_configuration) {
		// Read configuration from doc page.
		const main_page_title = CeL.wiki.TDOC_to_main(page_data);
		//let this_auto_subst_configuration = get_auto_subst_configuration_from_page(page_data);
		const old_auto_subst_configuration = auto_subst_configuration_Map.get(main_page_title);
		if (!old_auto_subst_configuration) {
			// 就算 this_auto_subst_configuration 是 undefined 也要設定。
			auto_subst_configuration_Map.set(main_page_title, this_auto_subst_configuration);
		} else if (this_auto_subst_configuration) {
			if (old_auto_subst_configuration.ignore_duplicate_message) {
				delete old_auto_subst_configuration.ignore_duplicate_message;
			} else {
				CeL.warn(`${CeL.wiki.title_link_of(page_data)} 已經有設定了，合併設定。`);
			}

			if (CeL.wiki.is_TDOC(page_data)) {
				// 以主頁面的模板為主，TDOC 的模板為輔。
				auto_subst_configuration_Map.set(main_page_title, Object.assign(this_auto_subst_configuration, old_auto_subst_configuration));
			} else {
				Object.assign(old_auto_subst_configuration, this_auto_subst_configuration);
			}
		}

	}

	for (const page_data of page_list) {
		if (wiki.is_namespace(page_data, 'category')) {
			let page_list_of_category = await wiki.categorymembers(page_data, { namespace: 'template', });

			const this_auto_subst_configuration = get_auto_subst_configuration_from_page(await wiki.page(page_data));
			if (this_auto_subst_configuration) {
				Object.assign(this_auto_subst_configuration, {
					from_category: page_data.title,
					ignore_duplicate_message: true
				});

				page_list_of_category = filter_page_list(page_list_of_category);

				let nosubst_Set;
				if (this_auto_subst_configuration.nosubst && typeof CeL.wiki.Yesno(token.parameters.nosubst) !== 'boolean') {
					nosubst_Set = new Set(this_auto_subst_configuration.nosubst.toString().split('|'));
					page_list_of_category = page_list_of_category.filter(page_title => !nosubst_Set.has(page_title));
					delete this_auto_subst_configuration.nosubst;
				}

				page_list_of_category
					.forEach(page_title => merge_auto_subst_configuration(page_title, { ...this_auto_subst_configuration }));
			}

			page_list.append(page_list_of_category);
		}
	}

	page_list = filter_page_list(page_list);
	await wiki.register_redirects(page_list.map(page_title => CeL.wiki.TDOC_to_main(page_title)));
	// 自動 subst 採用的手動設定可能位於 TDOC 的 {{.template_name_to_substitute}} 中。
	page_list.append(page_list.map(page_title => CeL.wiki.to_TDOC(page_title)));
	// 移除重複的頁面。
	page_list = page_list.unique();

	await wiki.for_each_page(page_list, page_data => {
		const this_auto_subst_configuration = get_auto_subst_configuration_from_page(page_data);
		merge_auto_subst_configuration(page_data, this_auto_subst_configuration);
		if (page_data.redirect_from) {
			merge_auto_subst_configuration(page_data.redirect_from, this_auto_subst_configuration);
		}
	}, {
		redirects: 1
	});

	return auto_subst_configuration_Map;
}


const subst_postfix_functions = {
	remove_empty_parameters(expanded_code) {
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
					// 有未設定數值的參數。
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
	},

	remove_comments(expanded_code) {
		expanded_code = expanded_code.toString();
		const parsed = CeL.wiki.parser(expanded_code).parse();
		CeL.assert([expanded_code, parsed.toString()],
			// gettext_config:{"id":"wikitext-parser-checking-$1"}
			CeL.gettext('wikitext parser checking: %1', JSON.stringify(expanded_code)));

		let changed = false;
		parsed.each('comment', comment_token => {
			changed = true;
			return CeL.wiki.parser.parser_prototype.each.remove_token;
		});

		if (!changed) {
			return expanded_code;
		}

		return parsed.toString();
	},
};

/**
 *  過濾掉不應該被展開的模板/module。
 *  e.g., {{#invoke:Citation/CS|...}}，這個module不應該被展開。
 * @param {Array} parsed	頁面資料。
 * @param {Object} options	附加參數/設定選擇性/特殊功能與選項。
 * @returns {Boolean} true: 可以被展開； false: 不應該被展開。
 */
function filter_template_to_be_expanded(parsed, options) {
	let has_should_not_be_substituted;
	CeL.wiki.parser.parser_prototype.each.call(parsed, 'magic_word_function', token => {
		let module_name = token.module_name;
		if (module_name
			&& /^(?:Citation\/CS1(?:\/.+)?|CS1 translator|Ilh)$/.test(module_name)
		) {
			has_should_not_be_substituted = true;
			return CeL.wiki.parser.parser_prototype.each.exit;
		}
	});
	return !has_should_not_be_substituted;
}

/**
 * 這些模板不受模板深度限制，就算超過模板深度限制也還是展開。
 * @param {Array} token  模板 token。
 * @returns 
 */
function ignore_template_depth_limit(token) {
	const page_title = token.page_title.toString();
	if (wiki.is_template(page_title, ['Template:Str left', 'Template:Str right'])) {
		return true;
	}
}

/**
 * 替換引用{{.template_name_to_substitute|auto=yes}}的模板。
 * @param {String} template_title	模板標題。 e.g., "Template:Template to be substituted"
 * @param {Object|Undefined} this_auto_subst_configuration	自動 subst 採用的手動設定 manual settings。 e.g., {subst_postfix: 'remove_empty_parameters'}
 */
async function do_subst_template(template_title, this_auto_subst_configuration) {
	let subst_postfix;
	let must_manually_expand_subst = this_auto_subst_configuration?.must_manually_expand_subst;
	const subst_postfix_list = this_auto_subst_configuration?.subst_postfix_list;
	if (this_auto_subst_configuration?.subst_postfix in subst_postfix_functions) {
		subst_postfix = subst_postfix_functions[this_auto_subst_configuration.subst_postfix];
		if (subst_postfix)
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
		log_to: null,
	}, {
		[move_from_link]: {
			//namespace: 'main|Template',
			move_to_link,
			must_manually_expand_subst,
			subst_postfix,
			filter_template_to_be_expanded,
			ignore_template_depth_limit,
			summary: `${CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title, '自動替換引用模板')}: ${CeL.wiki.title_link_of(move_from_link)}${this_auto_subst_configuration?.from_category ? ` (from ${CeL.wiki.title_link_of(this_auto_subst_configuration.from_category)})` : ''}`
			//+ ' 人工監視檢測中 '
			,
		},
	});
}
