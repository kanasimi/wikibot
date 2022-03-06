/*

2021/11/12 15:39:2	初版試營運。
2021/11/12 19:15:10	完成。正式運用。

 */

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// ----------------------------------------------------------------------------

const summary_prefix = '[[Special:PermaLink/6345050#批量文本替换|批量文本替換]]: ';

function text_processor(wikitext, page_data, work_config) {
	const summary = [];

	wikitext = wikitext.replace(/\n(=+) *(?:相關詞彙|相关词汇) *\1[\s\n*]*(?:近義詞|近义词)：[\s\n*]*(?:反義詞|反义词)：[\s\n*]*(?:派生詞|派生词)：[\s\n*]*(?:同音詞（現代標準漢語）|同音词（現代標準漢語）)：[\s\n*]*(?:相關詞彙|相近词汇)：[\s\n*]*(?:常見詞語搭配|常见词语搭配)：(\s*\n)+=/, all => {
		summary.push('移除空白的「相關詞彙」段落');
		return '\n=';
	});

	wikitext = wikitext.replace(/\* *[\u4e00-\u9fa5]+[語语]：\[\[\]\]\s*\n/g, all => {
		summary.push('移除翻譯段落中空白的翻譯');
		return '';
	});

	wikitext = wikitext.replace(/{{漢語讀音\|國=\|漢語拼音=([^|{}=]+)\|粵=\|滬=\|白話字=\|臺羅拼音=}}/, (all, 漢語拼音) => {
		summary.push('只有漢語拼音的{{漢語讀音}}替換成{{zh-pron}}');
		return `{{zh-pron|m=${漢語拼音.trim()}}}`;
	});

	let parsed = CeL.wiki.parser(wikitext, wiki.append_session_to_options()).parse();
	CeL.assert([wikitext, parsed.toString()], 'wikitext parser check 2: ' + CeL.wiki.title_link_of(page_data));
	parsed.each('Template:Transl', template_token => {
		if (Object.keys(template_token.parameters).join('') === '') {
			summary.push('去除空的{{Transl}}');
			return parsed.each.remove_token;
		}

		if (!/^1(?:,2)?$/.test(Object.keys(template_token.parameters).join())) {
			// 跳過不符合所需格式的模板。
			return;
		}

		const 翻譯1 = template_token[1].toString().trim();
		const 翻譯2 = template_token[2]?.toString().trim();
		if (!翻譯1 && !翻譯2) {
			summary.push('去除空的{{Transl}}');
			return parsed.each.remove_token;
		}

		if (/(?:^|\n)[^*#]/.test(翻譯1.replace(/\n{{(?:trans-mid|翻譯-中|翻译-中)}}/i, '')) || 翻譯2 && /(?:^|\n)[^*#]/.test(翻譯2)) {
			//console.trace([/(?:^|\n)[^*#]/.test(翻譯1.replace(/\n{{(?:trans-mid|翻譯-中|翻译-中)}}/i, '')), 翻譯2 && /(?:^|\n)[^*#]/.test(翻譯2)]);
			CeL.warn(`${text_processor.name}: 跳過不符合所需格式的模板:
${template_token}`);
			// e.g., [[drooping]]
			return;
		}

		summary.push('{{Transl}}替換成{{翻譯-頂}}和{{翻譯-底}}');
		return `{{翻譯-頂}}
${翻譯1}${翻譯2 ? `
{{翻譯-中}}
${翻譯2}` : ''}
{{翻譯-底}}`;
	}, true);
	wikitext = parsed.toString();
	// free
	parsed = null;

	if (summary.length === 0)
		return Wikiapi.skip_edit;

	wikitext = wikitext
		.replace(/({{翻译-顶}})[\s\n]*{{翻译-中}}/, '$1')
		.replace(/{{翻译-中}}[\s\n]*({{翻译-底}})/, '$1');

	work_config.summary = summary_prefix + summary.unique().join(', ');
	//console.trace(work_config);
	//return Wikiapi.skip_edit;
	return wikitext;
}

(async () => {
	login_options.API_URL = 'zh.wiktionary';
	//console.trace(login_options);
	await wiki.login(login_options);
	await wiki.register_redirects('Template:Transl');

	await replace_tool.replace({
		log_to: null,
		not_bot_requests: true,
		wiki,
	}, {
		'insource:/\\*.{1,3}语：\\[\\[\\]\\]/': { text_processor, namespace: 'main' },
		'insource:/===相關詞彙===.{0,3}近義詞：.{0,3}反義詞：.{0,3}派生詞：.{0,3}同音詞（現代標準漢語）：.{0,3}相關詞彙：.{0,3}常見詞語搭配：.{0,4}=/': { text_processor, namespace: 'main' },
		'insource:/\\{\\{漢語讀音\\|國=\\|漢語拼音=[^=|]+\\|粵=\\|滬=\\|白話字=\\|臺羅拼音=\\}\\}/': { text_processor, namespace: 'main' },
		'Template:Transl': { text_processor, namespace: 'main' },
	});
})();
