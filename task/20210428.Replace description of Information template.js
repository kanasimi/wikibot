'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Load modules.
CeL.run([//'application.net.wiki.template_functions',
	// for CeL.assert()
	'application.debug.log']);

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('commons');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// ----------------------------------------------------------------------------

(async () => {
	await wiki.login(login_options);
	await main_process();
})();

async function main_process() {
	await wiki.register_redirects(['Information'], { namespace: 'Template' });

	const data_set = JSON.parse((await wiki.page('Data:Bubenic.tab')).wikitext).data;
	const data_hash = Object.create(null);
	data_set.forEach(data => data_hash[data[0] = wiki.to_namespace(
		// 'File:' +
		data[0], 'File')] = data);
	const page_list = data_set.map(data => data[0]);
	await wiki.for_each_page(page_list, page_data => {
		const parsed = page_data.parse();
		const data = data_hash[page_data.original_title || page_data.title];
		if (!data) {
			CeL.error(`No data of ${CeL.wiki.title_link_of(page_data)}`);
			console.log(page_data);
		}
		const replace_to = {
			Description: data[2],
			Date: data[1]
		};
		if (!replace_to.Date)
			delete replace_to.Date;

		let changed = 0;
		parsed.each('Template:Information', token => {
			if ((token.parameters.Description || '').toString().includes(replace_to.Description)
				&& (!replace_to.Date || (token.parameters.Date || '').toString().includes(replace_to.Date))
			) {
				CeL.debug(`${CeL.wiki.title_link_of(page_data)}: Already replaced.`);
				return;
			}
			if (!token.parameters.Description || token.parameters.Description.toString() === 'PLACEHOLDER') {
				changed += CeL.wiki.parse.replace_parameter(token, replace_to, { value_only: true, force_add: true, append_key_value: true });
			}

			if (!changed) {
				CeL.error(`${CeL.wiki.title_link_of(page_data)}: ${token.parameters.Description}`);
				console.log(replace_to);
			}
			//console.log([changed, token.toString()]);

		});
		if (changed)
			return parsed.toString();
		return Wikiapi.skip_edit;
	}, {
		redirects: 1,
		summary: '[[Special:Diff/555510974#Adding descriptions|Bot request]]: fix PLACEHOLDER descriptions'
	});
}
