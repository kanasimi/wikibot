/*

	初版試營運。
	完成。正式運用。

@see
[[分類:標題行模板]]

 */

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// ----------------------------------------------------------------------------

const summary_prefix = '[[Special:PermaLink/6463191#章節模板是否應該刪除？|展開語言標題模板]]: ';

async function text_processor(wikitext, page_data, work_config) {
	const summary = [];

	const parsed = page_data.parse();
	CeL.assert([wikitext, parsed.toString()], 'wikitext parser check: ' + CeL.wiki.title_link_of(page_data));

	let need_append_new_line = !/\n$/.test(parsed.at(-1));
	function append_category(category_token) {
		if (need_append_new_line) {
			need_append_new_line = false;
			parsed.push('\n');
		}
		parsed.push(category_token, '\n');
	}

	const categories = new Map;
	function add_category(category_token) {
		//console.trace(category_token.name);
		if (!categories.has(category_token.name)) {
			categories.set(category_token.name, category_token);
			append_category(category_token);
			return;
		}
		//console.trace(category_token);

		if (!category_token.sort_key)
			return;

		const old_category_token = categories.get(category_token.name);
		//console.trace(old_category_token);
		if (old_category_token.sort_key) {
			CeL.warn(`${add_category.name}: ${CeL.wiki.title_link_of(page_data)}: Multiple sort key: ${old_category_token}, ${category_token}`);
			append_category(category_token);
		} else {
			// reuse old_category_token
			old_category_token[2] = old_category_token.sort_key = category_token.sort_key;
		}
	}

	parsed.each('category', category_token => categories.set(category_token.name, category_token));
	//console.trace(categories);

	function split_category(wikitext) {
		const parsed = CeL.wiki.parser(wikitext, wiki.append_session_to_options()).parse();
		CeL.assert([wikitext, parsed.toString()], 'wikitext parser check 2: ' + CeL.wiki.title_link_of(page_data));

		parsed.each('category', category_token => {
			add_category(category_token);
			return parsed.each.remove_token;
		}, true);

		let name, need_huge;
		wikitext = parsed.toString()
			// remove {{-}}
			.replace(/<div style=\"clear: both; height: 1em\"><\/div>/g, '')
			// remove templatestyles in {{漢字}}, {{vi-nom}}
			.replace(/<templatestyles src="vi-nom\/fonts.css" \/>/g, '')

			.replace(/<h2>(.+)<\/h2>/g, (all, header) => {
				header = header
					.replace(/([英日])语/g, '$1語')
					.replace(/汉语/g, '漢語').replace(/朝鲜语/g, '韓語')
					;
				return `==${header}==`;
			})

			// for {{越南文}}, {{漢字|越南語漢字|vi}}
			.replace(/<span class=\"han-nom\" style=\"([^<>]+)>([^<>]*)<\/span>/ig, (all, style, text) => {
				const matched = style.match(/font-size:\s*(\d{1,3})%/);
				if (matched) need_huge = matched[1];
				return `{{vi-nom|${text}}}`;
			})
			// 處理 {{中文}}
			.replace(/<span( [^<>]*?xml:lang=\"([\w\-]+)\"[^<>]*)>([^<>]*)<\/span>/g, (all, attributes, lang, text) => {
				//console.log([all, attributes, lang, text]);
				if (!attributes.includes(` lang="${lang}"`)) return all;
				// {{Lang}} 自帶 -{}-
				text = text.replace(/^-{(.+?)}-$/, '$1');
				text = lang === 'vi-Hani' ? `{{vi-nom|${text}}}` : `{{Lang|${lang}|${text}}}`;
				if (need_huge) text = `{{huge|${text}|${need_huge}%}}`;
				return text;
			}).replace(/<span style=\"font-size:\s*(\d{1,3})%\s*\">(.*)<\/span>/g, (all, size, text) => {
				// Font size as a percentage. Default is 180%.
				if (Math.abs(size - 180) > 20) {
					return `{{huge|${text}|${size}%}}`;
				}
				return `{{huge|${text}}}`;
			})

			// fix {{漢字}}
			.replace(/-{(［{{vi-nom\|.+?}}］)}-/g, '$1')
			.replace(/-{〈<span style="width: 30px; border: 1px solid #CEDFF2; background: #F5FAFF; font-size:110%([^<>]*)>(.*)<\/span>〉}-/g, (all, attributes, text) => text.includes('{{Lang|') ? `〈${text}〉` : all)
			// e.g., [[英語]]
			.replace(/(〈{{Lang\|.+?}}〉)-{zh-hant;zh-hans;\|的汉字表记。}-/g, '$1的漢字表記。')

			// e.g., '\n==漢語==\n:-{{{huge|{{Lang|zh|啊}}|250%}}}-' is invalid
			.replace(/-{({{.+?}})}-/g, (all, template_wikitext) => template_wikitext.includes('-{') ? all : template_wikitext)
			.trim();

		if (/<\w|-{{{/.test(wikitext)
			|| wikitext.replace(/{{Lang\|.+?}}/g, '').includes('语')
		) {
			throw new Error(`${split_category.name}: ${CeL.wiki.title_link_of(page_data)}: 仍存有 "语", <tag> 或 -{{{template}}}-:\n${wikitext}`);
		}

		return { wikitext, name };
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
			const converted_data = split_category(expanded_data.expandtemplates.wikitext);
			add_category(CeL.wiki.parser(`[[Category:待分類詞彙|${converted_data.name || template_token.name}]]`, wiki.append_session_to_options()).parse());
			//console.trace(converted_data);
			return converted_data.wikitext;
		}
	}, true);
	//console.trace(parsed.toString());

	if (summary.length === 0)
		return Wikiapi.skip_edit;

	work_config.summary = summary_prefix + summary.unique().join(', ');
	return parsed.toString()
		// 去除舊英語詞條 __NOEDITSECTION__
		.replace(/__NOEDITSECTION__\n*/g, '')
		// e.g., [[英語]]
		.replace(/((?:\n|^)(={2})[^=].*?\2)(?! *\n)/g, '$1\n')
		;
}

const template_list_to_process = ['朝鮮語漢字詞', '朝鮮語', '日語-題', '日語', '-en-', '漢語'];

(async () => {
	login_options.API_URL = 'zh.wiktionary';
	//console.trace(login_options);
	await wiki.login(login_options);

	const base_task_configuration = { text_processor, list_types: 'embeddedin' };
	const move_configuration = Object.create(null);
	template_list_to_process.forEach((template_name, index) => move_configuration[template_list_to_process[index] = wiki.to_namespace(template_name, 'template')] = Object.clone(base_task_configuration));
	//console.trace(move_configuration);

	await wiki.register_redirects(template_list_to_process);

	await replace_tool.replace({
		log_to: null,
		not_bot_requests: true,
		wiki,
	}, move_configuration);
})();
