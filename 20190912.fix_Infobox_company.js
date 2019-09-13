// cd /d D:\USB\cgi-bin\program\wiki && node 20190912.fix_Infobox_company.js

/*

 2019/9/12 18:32:18	初版試營運

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loader.js');
// Load wikiapi module.
const Wikiapi = require('wikiapi');

// Set default language. 改變預設之語言。 e.g., 'zh'
// 採用這個方法，而非 Wiki(true, 'ja')，才能夠連報告介面的語系都改變。
//set_language('ja');

// Load modules.
CeL.run([
	// for CeL.assert()
	'application.debug.log']);

// ---------------------------------------------------------------------//

const summary = '[[Special:Diff/55581265/55581405|BOTREQ]]：清理[[Category:公司信息框使用额外地区代码参数的页面]]';

const main_template_name = 'Infobox company';

// C索引下的條目使用|com_code=xxx，需改為local_code_name=CN| local_code=xxx
// T索引下的條目使用|ROC_UBN=xxx，需改為|local_code_name=TW |local_code=xxx
// J索引下的條目使用|JPN_CN=xxx，需改為local_code_name=JP | local_code=xxx
const parameter_to_country = {
	com_code: 'CN',
	ROC_UBN: 'TW',
	JPN_CN: 'JP',
};

let company_template_hash;

function for_each_token(token) {
	if (!(token.name in company_template_hash)) { return; }

	for (let parameter in parameter_to_country) {
		const local_code = token.parameters[parameter];
		//console.log(parameter + ': ' + local_code);
		if (!local_code) {
			continue;
		}

		CeL.wiki.parser.replace_parameter(token, parameter, {
			local_code_name: parameter_to_country[parameter],
			local_code
		});
		// Only replace once. 一家公司不應歸屬兩個國家。
		return;
	}
}

function for_each_page(page_data) {
	/** {Array}頁面解析後的結構。 */
	const parsed = page_data.parse();
	//console.log(parsed);
	CeL.assert([page_data.wikitext, parsed.toString()], 'wikitext parser check');

	parsed.each('template', for_each_token);

	// return wikitext modified.
	return parsed.toString();
}

// ---------------------------------------------------------------------//
// main

(async () => {
	/** {Object}wiki operator 操作子. */
	const wiki = new Wikiapi;
	await wiki.login(user_name, user_password, 'zh');

	company_template_hash = [
		main_template_name,
		...(await wiki.redirects('Template:' + main_template_name))
			.map((page) => page.title.replace(/^Template:/, ''))
	].to_hash();
	//console.log(company_template_hash);

	const page_list = await wiki.categorymembers('公司信息框使用额外地区代码参数的页面');
	await wiki.for_each_page(
		page_list//.slice(0, 1)
		,
		for_each_page, {
			log_to,
			summary
		});
})();
