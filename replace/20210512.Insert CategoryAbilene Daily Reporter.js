'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('commons');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

const category_name = 'Abilene Daily Reporter';
const vol_string = category_name + ' (Abilene, Tex.), Vol. ';

const diff_id = '559284891/559701848';

// ----------------------------------------------------------------------------

(async () => {
	await wiki.login(login_options);
	await main_process();
})();

// ----------------------------------------------------------------------------

async function main_process() {
	if (false)
		for (let vol = 1; vol < 50; vol++) {
			await replace_category(vol);
		}

	await replace_category();
}

async function replace_category(vol) {
	const sub_category_name = vol ? vol_string + vol : category_name;

	let file_count = 0;
	await replace_tool.replace({
		wiki,
		log_to: null,
		diff_id,
	}, {
		[`intitle:"${sub_category_name}," -incategory:"${sub_category_name}"${vol ? ''
			// 去掉幾個比較大的 category。
			: ` -incategory:"${vol_string}14" -incategory:"${vol_string}34" -incategory:"${vol_string}21" -incategory:"${vol_string}22" -incategory:"${vol_string}33" -incategory:"${vol_string}17"`}`]: {
			namespace: 'file',
			//list_title: `File:${vol_string}5`,
			//list_title: `File:${category_name}. (Abilene, Tex.), No. 3`,
			//list_types: 'prefixsearch',
			text_processor(wikitext, page_data) {
				if (!page_data.title.includes(category_name)) {
					// Do not know why, sometimes we get files without specified "intitle".
					return Wikiapi.skip_edit;
				}

				let matched = page_data.title.match(/\Wvol\.?\s*(\d+)/i);
				if (!matched || matched[1] != vol) {
					return Wikiapi.skip_edit;
				}

				const parsed = page_data.parse();
				let has_token;
				parsed.each('Category', token => {
					if (token.name === sub_category_name) {
						has_token = true;
						return parsed.each.exit;
					}
					if (token.name.includes(category_name)) {
						CeL.warn(`${CeL.wiki.title_link_of(page_data)} is categorized as ${token}`);
						has_token = true;
						return parsed.each.exit;
					}
				});
				if (has_token)
					return Wikiapi.skip_edit;

				matched = page_data.title.match(/\Wno\.?\s*(\d+)/i);
				parsed.insert_layout_element(`[[Category:${sub_category_name}${matched ? '|' + matched[1] : ''}]]`);
				file_count++;
				return parsed.toString();
			}
		}
	});

	if (vol && file_count > 0) {
		const category_page_data = await wiki.page('Category:' + sub_category_name);
		//console.log(category_page_data);
		if ('missing' in category_page_data) {
			await wiki.edit(`[[Category:${category_name}|${vol}]]`, { summary: `Prepare to insert [[Category:${category_name}]] series` });
		}
	}
}
