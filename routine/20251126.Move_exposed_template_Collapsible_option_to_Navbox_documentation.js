/*
node 20251126.Move_exposed_template_Collapsible_option_to_Navbox_documentation.js use_project=zh
node 20251126.Move_exposed_template_Collapsible_option_to_Navbox_documentation.js use_project=zh "check_page=Template:地质年代|Template:太阳系"

這個任務會清理navbox模板中裸露的{{Collapsible option}}，改用{{Navbox documentation}}。

2025/12/8 6:39:17	初版試營運
2025/12/27 8:6:32	申請通過後初版

TODO:
整合模板分類: 另開一個常規任務清理所有分類。
另開一個任務刪除無用的 /doc subpage。

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
	Documentation: 'Documentation',
	Sandbox_other: 'Sandbox other',
};

// [[Module:Documentation/config]]	cfg['doc-subpage'] = 'doc'	cfg['doc-link-display'] = '/doc'
const doc_subpage_postfix = '/doc';

/**排除 /doc subpage 的這些模板。 */
const exclude_doc_subpage_template_name_list = ['Documentation subpage',];

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

	if (!(0 <= general.max_doc_subpage_chars_to_move && general.max_doc_subpage_chars_to_move < 200_000)) {
		general.max_doc_subpage_chars_to_move = 2_000;
	}

	if (!general.remove_doc_subpage_comments || !CeL.is_RegExp(general.remove_doc_subpage_comments = general.remove_doc_subpage_comments?.to_RegExp())) {
		delete general.remove_doc_subpage_comments;
	}

	console.trace(wiki.latest_task_configuration.general);
}

let summary_prefix = '清理導航模板中裸露的可折疊選項模板';

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
	summary_prefix = CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title, summary_prefix);

	await wiki.register_redirects(template_name_hash, { namespace: 'Template', no_message: true, update_page_name_hash: true });
	await wiki.register_redirects(exclude_doc_subpage_template_name_list, { namespace: 'Template', no_message: true });
	console.log('Redirect targets:', template_name_hash);

	if (CeL.env.arg_hash.check_page && typeof CeL.env.arg_hash.check_page === 'string') {
		// for testing only
		await for_page_list(CeL.env.arg_hash.check_page.split('|'));
		return;
	}

	for await (let page_list of wiki.embeddedin(wiki.to_namespace(template_name_hash.Collapsible_option, 'template'), { namespace: 'template', batch_size: 500 })) {
		page_list = page_list.filter(page_data => !page_data.title.endsWith(doc_subpage_postfix));
		await for_page_list(page_list);
	}
}

async function for_page_list(page_list) {
	await wiki.for_each_page(page_list, handle_each_template, {
		no_message: true,
		redirects: false,
		summary: `${summary_prefix}，改用{{${template_name_hash.Navbox_documentation}}}。`,
	});
}

async function handle_each_template(page_data) {
	CeL.log_temporary(`${handle_each_template.name}: 處理頁面 ${CeL.wiki.title_link_of(page_data)}`);
	const parsed = page_data.parse();

	// ------------------------------------------------------------------------
	// 正式處理說明文件模板。

	let changed = false;

	await parsed.each('template', async template_token => {
		if (false && wiki.is_template(template_token, template_name_hash.Navbox_documentation)) {
			return;
		}

		// 對於所有第一層的模板，假如是{{Collapsible option}}則直接轉成{{Navbox documentation}}。
		if (wiki.is_template(template_token, template_name_hash.Collapsible_option)) {
			changed = true;

			// 轉成{{Navbox documentation}}。使用handle_Documentation_content()以保留parameters_argument。
			const Navbox_documentation_template = await handle_Documentation_content(template_token, page_data);
			if (Navbox_documentation_template) {
				return Navbox_documentation_template;
			}

			throw new Error(`${handle_each_template.name}: ${CeL.wiki.title_link_of(page_data)}: 無法將{{${template_name_hash.Collapsible_option}}}轉成{{${template_name_hash.Navbox_documentation}}}！`);
			// replace parameter name only
			// 警告: 這邊可能已經變更過 parsed。
			template_token[0] = template_name_hash.Navbox_documentation;
			return;
		}

		if (wiki.is_template(template_token, template_name_hash.Documentation)) {
			// [[Module:Documentation]]	:wikitext(p._content(args, env))
			// content = args._content or mw.getCurrentFrame():expandTemplate{title = docTitle.prefixedText}
			// parameters.content 優先權高於'/doc'子頁面。
			if (template_token.parameters.content) {
				// e.g., [[Template:洲/doc]]
				const Navbox_documentation_template = await handle_Documentation_content(template_token.parameters.content, page_data);
				if (Navbox_documentation_template) {
					changed = true;
				}
				return Navbox_documentation_template;
				// parameters.content 優先權高於'/doc'子頁面。不會再用到'/doc'子頁面，無須再檢查。
			}

			const doc_subpage_title = template_token.parameters[1] || `${page_data.title}${doc_subpage_postfix}`;
			const doc_subpage = await wiki.page(doc_subpage_title);
			const parsed_doc_subpage = doc_subpage.parse();

			// TODO: Skip magic words.
			// e.g., [[w:zh:Template:MacOS]], [[Template:国务院/副总理/1]]

			const Navbox_documentation_template = await handle_Documentation_content(parsed_doc_subpage, page_data, template_token, true);
			if (!Navbox_documentation_template) {
				return;
			}

			// 含入/doc頁面後將之刪除。
			if (wiki.latest_task_configuration.general.delete_doc_subpage_after_move) {
				// TODO: 檢查 doc_subpage 是否為孤立頁面。

				try {
					// 刪除已匯入模板主頁面的/doc頁面。
					await wiki.delete(doc_subpage.title, { reason: `${summary_prefix}：已將內容轉入上層模板之{{${template_name_hash.Navbox_documentation}}}中。` });
				} catch (e) {
					// TODO: 提報刪除。

					// 忽略刪除失敗。
					CeL.error(`${handle_each_template.name}: 刪除說明文件頁面 ${CeL.wiki.title_link_of(doc_subpage)} 失敗：`);
					CeL.error(e);
				}
			}

			changed = true;
			return Navbox_documentation_template;
		}

	}, { depth: 1, modify: true });

	if (!changed) {
		return Wikiapi.skip_edit;
	}

	// ------------------------------------------------------------------------
	// 檢查說明文件模板數量。先去掉{{Collapsible option}}無法處理在章節標題之後的情況，因此放在後面。
	let template_indexes;

	function set_template_indexes() {
		template_indexes = Object.fromEntries(Object.keys(template_name_hash).map(template_name => [template_name, []]));
		parsed.each('template', (template_token, index, parent) => {
			for (let template_name in template_indexes) {
				if (wiki.is_template(template_token, template_name_hash[template_name])) {
					template_indexes[template_name].push([index, parent]);
					return;
				}
			}
		});
	}

	set_template_indexes();

	// 解決多個說明文件模板問題。清理多個{{Navbox documentation}}。
	if (template_indexes.Navbox_documentation.length > 1) {
		// e.g., [[Template:电磁学]], [[Template:苏联加盟共和国]]
		parsed.each('template', (template_token, index, parent) => {
			if (template_indexes.Navbox_documentation.length === 1) {
				// 保留最後一個 {{Navbox documentation}}。
				// e.g., [[Template:臺灣總督]], [[Template:阿西莫夫小说]]
				return CeL.wiki.parser.parser_prototype.each.exit;
			}
			if (wiki.is_template(template_token, template_name_hash.Navbox_documentation)) {
				// remove empty {{Navbox documentation}}
				if (CeL.is_empty_object(template_token.parameters)) {
					template_indexes.Navbox_documentation.shift();
					return CeL.wiki.parser.parser_prototype.each.remove_token;
				}
			}
		});
		// 重新計算 template_indexes。
		set_template_indexes();
	}

	if (template_indexes.Collapsible_option.length + template_indexes.Documentation.length + template_indexes.Navbox_documentation.length > 1) {
		// e.g., [[Template:电磁学]]
		CeL.error(`${handle_each_template.name}: ${CeL.wiki.title_link_of(page_data)}: 在同一個頁面中發現多個說明文件！ ${JSON.stringify(template_indexes)}`);
		return Wikiapi.skip_edit;
	}

	// free memory
	//template_indexes = null;

	// ------------------------------------------------------------------------

	// 清理：移除不應出現於模板文件外的內容；調整（合併）模板分類；移除冗餘代碼。
	parsed.get_categories({ remove_existed_duplicated: true });

	let wikitext = parsed.toString();
	// 清理多餘空行。
	wikitext = wikitext.replace(/(?:(\n)*)(<(?:noinclude|includeonly)>)(?:(\n)*)/ig, '$1$2$3');
	return wikitext;
}

async function handle_Documentation_content(content, page_data, template_token, is_doc_subpage) {
	if (content.type !== 'plain') {
		// e.g., [[Template:物理學分支]]
		// assert: content is plain object. e.g., {String}
		content = [content];
	}

	// ------------------------------------------------------------------------

	CeL.wiki.parser.parser_prototype.each.call(content, (token, index, parent) => {
		switch (token.type) {
			case 'tag':
				// 把 doc_subpage 搬到主 template 頁面中，可去除 <noinclude></noinclude>。
				if (token.tag.toLowerCase() === 'noinclude') {
					// 去掉 <noinclude> 內的內容。
					return CeL.wiki.parser.parser_prototype.each.remove_token;
				}

				if (token.tag.toLowerCase() === 'includeonly') {
					// 直接搬移 <includeonly> 內的內容。
					return token[1];
				}

				if (token.tag.toLowerCase() === 'onlyinclude') {
					// throw new Error(`${handle_each_template.name}: ${CeL.wiki.title_link_of(page_data)}: 發現<onlyinclude>，無法處理！`);
				}
				break;

			case 'link':
				// 模板的跨語言連結通常已過時，不搬移。 e.g., [[Template:洲/doc]]
				if (!token.is_link) {
					return CeL.wiki.parser.parser_prototype.each.remove_token;
				}
				break;

			case 'transclusion':
				if (wiki.is_template(token, exclude_doc_subpage_template_name_list)) {
					return CeL.wiki.parser.parser_prototype.each.remove_token;
				}
				// 清理 Sandbox other 模板。 e.g., [[Template:中華民國行政區劃/doc]]
				if (wiki.is_template(token, template_name_hash.Sandbox_other)) {
					return token.parameters[2];
				}
				break;

			case 'comment':
				// 去掉/doc頁面的這些註解。 e.g., [[Template:Sandbox other]], [[Template:太阳系]], [[Template:洲/doc]]
				if (wiki.latest_task_configuration.general?.remove_doc_subpage_comments.test(token[0])) {
					return CeL.wiki.parser.parser_prototype.each.remove_token;
				}
				break;
		}

	}, wiki.append_session_to_options({ modify: true }));

	// ------------------------------------------------------------------------

	// 處理 {{Collapsible option}} 在章節後的情況。 e.g., `==參數及使用方法==` @ [[Template:中華民國行政區劃/doc]]
	for (let index = 0, latest_section_title; index < content.length; index++) {
		const token = content[index];
		switch (token.type) {
			case 'section_title':
				// 具有章節標題，通常表示說明文件內容較多，可能無法直接搬移。
				latest_section_title = token;
				token.index = index;
				//token.parent = content;
				break;

			case 'transclusion':
				if (!latest_section_title) {
					break;
				}
				if (!wiki.is_template(token, template_name_hash.Collapsible_option)) {
					break;
				}

				// 若本 section 只包括 {{Collapsible option}} 一個模板，則刪掉整個段落，將 {{Collapsible option}} 移到最上方。
				let Collapsible_option_to_move = token;
				for (let _index = latest_section_title.index; ++_index < content.length;) {
					const sibling_token = content[_index];
					if (sibling_token.type === 'section_title') {
						// 遇到下一個章節標題，停止處理。
						break;
					}

					if (sibling_token !== token && CeL.wiki.is_meaningful_token(sibling_token)) {
						// 發現其他有意義的內容，無法搬移。
						Collapsible_option_to_move = null;
						break;
					}
				}

				if (Collapsible_option_to_move) {
					// assert: 本 section 只包括 {{Collapsible option}} 一個模板。
					// 刪掉 {{Collapsible option}} 所在 section title。
					content.splice(latest_section_title.index, index - latest_section_title.index);
					// 調整 index。因為 splice() 已經刪掉一段內容；2: 因為 unshift() 新增了2個內容。
					//index = latest_section_title.index;
					break;
				}

				// 否則跳過本模板不處理。
				CeL.warn(`${handle_Documentation_content.name}: ${CeL.wiki.title_link_of(page_data)}: 發現說明文件中於章節後的{{${template_name_hash.Collapsible_option}}}，無法處理！`);
				//do_not_process_doc_subpage = true;
				return;
			//break;
		}
	}

	// ------------------------------------------------------------------------

	// 本程式不處理過大的/doc頁面。將跳過超過此chars的/doc頁面。
	if (is_doc_subpage && content.toString().trim().length > wiki.latest_task_configuration.general.max_doc_subpage_chars_to_move) {
		return;
	}

	// ------------------------------------------------------------------------

	let parameters_argument;
	let Collapsible_option_index;
	//let has_Collapsible_option = false;
	// 檢查是否包含{{Collapsible option}}，將剩餘的內容轉成{{{3}}}。
	CeL.wiki.parser.parser_prototype.each.call(content, 'Template:' + template_name_hash.Collapsible_option, (template_token, index, parent) => {
		//has_Collapsible_option = true;
		if (parameters_argument) {
			CeL.error(`${handle_Documentation_content.name}: ${CeL.wiki.title_link_of(page_data)}: 在同一個說明文件中發現多個{{${template_name_hash.Collapsible_option}}}，無法處理！`);
			//parameters_argument = false;
			return CeL.wiki.parser.parser_prototype.each.exit;
		}

		parameters_argument = Object.create(null);
		const Collapsible_option_parameters = Object.clone(template_token.parameters);
		for (let [parameter_name, aliases] of Object.entries({
			state: 'parameter_name|state',
			default: '1|state|autocollapse',
		})) {
			for (const alias of aliases.split('|')) {
				if (alias in Collapsible_option_parameters) {
					if (Collapsible_option_parameters[alias] && !(parameter_name in parameters_argument))
						parameters_argument[parameter_name] = Collapsible_option_parameters[alias];
					delete Collapsible_option_parameters[alias];
				}
			}
		}

		// e.g., [[Template:几何术语]]
		// 保留其他參數。 e.g., nobase, statename
		Object.assign(parameters_argument, Collapsible_option_parameters);

		// 記錄{{Collapsible option}}所在位置，以便切割說明文件內容。
		if (parent === content) {
			Collapsible_option_index = index;
		}

		return CeL.wiki.parser.parser_prototype.each.remove_token;
	}, wiki.append_session_to_options());

	if (!parameters_argument) {
		parameters_argument = Object.create(null);
	}

	// ------------------------------------------------------------------------

	// e.g., [[Template:IWork]]
	const doc_subpage_declaration = template_token?.parameters[1] && template_token.parameters[1] !== `${page_data.title}${doc_subpage_postfix}` ? `<!-- [[${template_token.parameters[1]}]] -->\n` : '';

	const intro = Collapsible_option_index && content.splice(0, Collapsible_option_index).join('').trim()
		// 清理多餘空行。
		.replace(/\n{3,}/g, '\n\n');
	if (intro) {
		parameters_argument.intro = `
${doc_subpage_declaration}${intro}
`;
	}

	const Navbox_documentation_template = CeL.wiki.parse(CeL.wiki.parse.template_object_to_wikitext(template_name_hash.Navbox_documentation));
	CeL.wiki.parse.replace_parameter(Navbox_documentation_template, parameters_argument, { value_only: true, force_add: true, append_key_value: true });

	content = content.toString().trim()
		// 清理多餘空行。 e.g., [[Template:土星的卫星/doc]]
		.replace(/\n{3,}/g, '\n\n');
	if (content) {
		// e.g., [[Template:物理學分支]]
		// 改成去掉{{Collapsible option}}後的內容。
		// 這邊才用 CeL.wiki.parse.replace_parameter()，確保這個參數放在最後面。
		CeL.wiki.parse.replace_parameter(Navbox_documentation_template, {
			'3': `
${doc_subpage_declaration}${content}
`
		}, { value_only: true, force_add: true, append_key_value: true });
	} else {
		// e.g., [[Template:洲/doc]]
	}

	return Navbox_documentation_template;
}
