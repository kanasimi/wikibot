/*

2021/11/20 20:26:32	初版試營運。	使用 expandtemplates 的方法來展開，再把部分 wikitext 轉換為模板。
2021/11/24 6:56:14	完成。正式運用。

@see
[[分類:標題行模板]]
[[分類:語言模板]]

 */

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// ----------------------------------------------------------------------------

const summary_prefix = '[[Special:PermaLink/6522159#章節模板是否應該刪除？|展開語言標題模板]]: ';
const main_maintenance_category = '待分類詞彙';

(async () => {
	login_options.API_URL = 'zh.wiktionary';
	//console.trace(login_options);
	await wiki.login(login_options);

	const move_configuration = Object.create(null);
	const template_list_to_process = [];
	const maintenance_templates = new Set;
	const base_task_configuration = {
		text_processor,
		list_types: 'embeddedin',
		conversion_Map: new Map,
		template_list_to_process,
		maintenance_templates,
	};
	function add_template(page_data) {
		if (!wiki.is_namespace(page_data, 'template')) return;
		const title = page_data.title;

		// ['-ja-hiragana-', '-fr-', '法語', '-ang-', '越南語漢字詞', '-vi-', '朝鮮語漢字詞', '朝鮮語', '日語-題', '日語', '-en-', '漢語']
		// for debug: 僅處理單一模板
		//if (!title.includes('馬來語')) return;

		if (title in move_configuration) return;
		move_configuration[title] = Object.clone(base_task_configuration);
		template_list_to_process.push(title);
	}
	(await wiki.categorymembers('语言模板')).forEach(add_template);

	//console.log(template_list_to_process);
	//console.trace(move_configuration);
	await wiki.category_tree(main_maintenance_category, {
		for_each(template_page_data) {
			if (!maintenance_templates.has(template_page_data.title))
				maintenance_templates.add(template_page_data.title);
		}
	});
	//console.trace(maintenance_templates);

	await wiki.register_redirects(template_list_to_process);

	await replace_tool.replace({
		log_to: null,
		not_bot_requests: true,
		wiki,
	}, move_configuration);
})();

async function text_processor(wikitext, page_data, work_config) {
	const summary = [];

	const parsed = page_data.parse();
	CeL.assert([wikitext, parsed.toString()], 'wikitext parser check: ' + CeL.wiki.title_link_of(page_data));

	// cache for converted headers
	const conversion_Map = this.conversion_Map;

	function register_and_append_category(category_token, options) {
		//console.trace(category_token.name);
		//console.trace(category_token);
		parsed.append_category(category_token, {
			...options,
			remove_existed_duplicated: true,
			get_key(category_token) {
				if (!conversion_Map.has(category_token.name))
					return;

				// 避免同時存在繁體簡體的 category。
				const category_name = conversion_Map.get(category_token.name);
				category_token.name = category_name;
				//category_token[0][1] = category_name;
				category_token[0] = `Category:${category_name}`;
				return category_name;
			}
		});
	}

	function set_text_size(text, size) {
		if (!(size > 120)) return text;
		if (size < 170) return `{{large|${text}}}`;
		// Font size as a percentage. Default is 180%.
		return size < 190 ? `{{huge|${text}}}` : `{{huge|${text}|${size}%}}`;
	}

	function split_category(wikitext, template_token) {
		const parsed = CeL.wiki.parser(wikitext, wiki.append_session_to_options()).parse();
		CeL.assert([wikitext, parsed.toString()], 'wikitext parser check 2: ' + CeL.wiki.title_link_of(page_data));

		const language_list = [];
		parsed.each('category', category_token => {
			if (category_token.name === main_maintenance_category && category_token.sort_key) {
				language_list.append(category_token.sort_key.split(','));
				language_list.category_token = category_token;
			}
			register_and_append_category(category_token);
			return parsed.each.remove_token;
		}, true);

		wikitext = parsed.toString()
			// remove {{-}}
			.replace(/<div style=\"clear: both; height: 1em\"><\/div>/g, '')
			// remove templatestyles in {{漢字}}, {{vi-nom}}
			.replace(/<templatestyles src="vi-nom\/fonts.css" \/>/g, '')

			// for {{越南文}}, {{漢字|越南語漢字|vi}}
			.replace(/<span class=\"han-nom\" style=\"([^<>]+)>([^<>]*)<\/span>/ig, (all, style, text) => {
				let size = style.match(/font-size:\s*(\d{1,3})%/);
				if (size) size = size[1];
				return set_text_size(`{{vi-nom|${text}}}`, size);
			})
			// 處理 {{中文}}
			.replace(/<span( [^<>]*?xml:lang=\"([\w\-]+)\"[^<>]*)>([^<>]*)<\/span>/g, (all, attributes, lang, text) => {
				//console.log([all, attributes, lang, text]);
				if (!attributes.includes(` lang="${lang}"`)) return all;
				// {{Lang}} 自帶 -{}-
				text = text.replace(/^-{(.+?)}-$/, '$1');
				text = lang === 'vi-Hani' ? `{{vi-nom|${text}}}` : `{{Lang|${lang}|${text}}}`;
				return text;
			})
			.replace(/<span style=\"font-size:\s*(\d{1,3})%\s*\">(.*)<\/span>/g, (all, size, text) => set_text_size(text, size))

			// fix {{漢字}}
			.replace(/-{(［{{vi-nom\|.+?}}］)}-/g, '$1')
			.replace(/-{〈<span style="width: 30px; border: 1px solid #CEDFF2; background: #F5FAFF; font-size:110%([^<>]*)>(.*)<\/span>〉}-/g, (all, attributes, text) => text.includes('{{Lang|') ? `〈${text}〉` : all)
			// e.g., [[英語]]
			.replace(/(〈{{Lang\|.+?}}〉|［{{vi-nom\|.+?}}］)-{zh-hant;zh-hans;?\|的汉字表记。}-/g, '$1的漢字表記。')

			// e.g., '\n==漢語==\n:-{{{huge|{{Lang|zh|啊}}|250%}}}-' is invalid
			.replace(/-{({{.+?}})}-/g, (all, template_wikitext) => template_wikitext.includes('-{') ? all : template_wikitext)
			.trim();

		if (/<\w|-{{{/.test(wikitext
			// e.g., {{-en-v-}}
			.replace(/<span style="[^<>"]*">([^<>]*)<\/span>/g, '$1'))
			// e.g., {{-en-v-|...}}
			|| !/^-en-\w+-$/.test(template_token.name) && wikitext.replace(/{{Lang\|.+?}}/g, '').includes('语')
		) {
			//console.trace([template_token.name, wikitext.replace(/<span style="[^<>"]*">([^<>]*)<\/span>/g, '$1'), wikitext.replace(/{{Lang\|.+?}}/g, '')]);
			throw new Error(`${split_category.name}: ${CeL.wiki.title_link_of(page_data)}: 仍存有 "语", <tag> 或 -{{{template}}}-:\n${wikitext}`);
		}

		return { wikitext, language_list };
	}

	const template_list_to_process = this.template_list_to_process;
	const maintenance_templates = this.maintenance_templates;

	function normalize_header(header) {
		// e.g., {{馬來語}}
		header = CeL.wiki.wikitext_to_plain_text(header, wiki.append_session_to_options()).trim();
		//console.trace(header);
		return header;
	}

	// https://zh.wiktionary.org/wiki/Special:ApiSandbox#action=expandtemplates&format=json&title=%E9%A6%96%E9%A0%81&text=%7B%7B%E6%BC%A2%E8%AA%9E%7C%E5%AD%97%7D%7D&prop=wikitext&utf8=1
	// https://zh.wiktionary.org/wiki/Special:ApiSandbox#action=expandtemplates&format=json&title=%E9%A6%96%E9%A0%81&text=%7B%7B-en-%7D%7D&prop=wikitext&utf8=1
	await parsed.each('template', async template_token => {
		if (wiki.is_template(template_list_to_process, template_token)) {
			summary.push(template_token);
			const expanded_data = await wiki.query({
				action: 'expandtemplates',
				prop: 'wikitext',
				title: page_data.title,
				text: template_token.toString()
			});
			//console.trace(expanded_data);
			let wikitext = expanded_data.expandtemplates.wikitext
				.replace(/<h2>(.+)<\/h2>/g, `==$1==`);

			const header_list = [];
			function add_header(PATTERN) {
				for (const matched of wikitext.matchAll(PATTERN)) {
					const header = normalize_header(matched.groups.header);
					if (!conversion_Map.has(header))
						header_list.push(header);
				}
			}
			add_header(/(==)(?<header>.+)\1/g);
			//add_header(/<h2>(.+)<\/h2>/g);
			if (header_list.length > 0) {
				const converted_header_list = await wiki.convert_Chinese(header_list, { uselang: 'zh-hant' });
				header_list.forEach((header, index) => conversion_Map.set(header, converted_header_list[index]));
				//console.trace(conversion_Map);
			}
			// free
			//header_list.truncate();

			const language_list = [];
			wikitext = wikitext.replace(/==(.+)==/g, (all, header) => {
				header = conversion_Map.get(normalize_header(header));
				console.assert(!!header);
				//console.trace(header);
				language_list.push(header);

				const category_name = wiki.to_namespace(`待分類的${header}詞`, 'category');
				if (!maintenance_templates.has(category_name)) {
					maintenance_templates.add(category_name);
					/*await*/ wiki.edit_page(category_name, `{{Hidden category}}

[[${wiki.to_namespace(main_maintenance_category, 'category')}]]
`, {
						summary: summary_prefix + `創建追縱、維護分類`
					});
				}
				register_and_append_category(category_name, wiki.append_session_to_options());
				return `==${header}==`;
			});
			//console.trace(wikitext);

			const converted_data = split_category(wikitext, template_token);
			const sort_key = language_list.append(converted_data.language_list).unique().join(',') || template_token.name;
			if (converted_data.language_list.category_token) {
				// reuse old category_token
				converted_data.language_list.category_token.set_sort_key_of_category(sort_key);
			} else {
				//register_and_append_category(`${main_maintenance_category}|${sort_key}`, wiki.append_session_to_options());
			}
			//console.trace(converted_data);
			return converted_data.wikitext;
		}
	}, true);
	//console.trace(parsed.toString());

	if (summary.length === 0)
		return Wikiapi.skip_edit;

	work_config.summary = summary_prefix + summary.unique().join(', ');
	return parsed.toString()
		// 去除舊英語詞條, [[異性戀]] 等之 __NOEDITSECTION__
		.replace(/\n?__NOEDITSECTION__/g, '')
		// e.g., [[英語]]
		.replace(/((?:\n|^)(={2})[^=].*?\2)(?! *\n)/g, '$1\n')
		;
}
