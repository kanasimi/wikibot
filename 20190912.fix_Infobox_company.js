// cd /d D:\USB\cgi-bin\program\wiki && node 20190912.fix_Infobox_company.js

/*

 2019/9/12 18:32:18	初版試營運

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loader.js');
// Load wikiapi module.
const Wikiapi = require('wikiapi');

// ---------------------------------------------------------------------//
// main

CeL.run('application.debug.log');

(async () => {
	const wiki = new Wikiapi;
	await wiki.login(user_name, user_password, 'zh');

	let company_template_hash = (await wiki.redirects('Template:Infobox company')).map((page) => page.title.replace(/^Template:/, ''));
	company_template_hash.unshift('Infobox company');
	company_template_hash = company_template_hash.to_hash();
	//console.log(company_template_hash);

	// C索引下的條目使用|com_code=xxx，需改為local_code_name=CN| local_code=xxx
	// T索引下的條目使用|ROC_UBN=xxx，需改為|local_code_name=TW |local_code=xxx
	// J索引下的條目使用|JPN_CN=xxx，需改為local_code_name=JP | local_code=xxx
	const parameter_to_country = {
		com_code: 'CN',
		ROC_UBN: 'TW',
		JPN_CN: 'JP',
	};

	const page_list = await wiki.categorymembers('公司信息框使用额外地区代码参数的页面');
	await wiki.for_each_page(page_list.slice(0, 1), (page_data) => {
		const parsed = page_data.parse();
		//console.log(parsed);
		CeL.assert([CeL.wiki.content_of(page_data), parsed.toString()], 'parser check');

		parsed.each('template', (token) => {
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
				return;
			}
		});

		return parsed.toString();
	}, {
			log_to,
			summary: '[[Special:Diff/55581265/55581405|BOTREQ]]：清理[[Category:公司信息框使用额外地区代码参数的页面]]'
		});

})();
