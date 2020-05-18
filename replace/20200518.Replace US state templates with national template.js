/*

2020/5/18 20:1:53	初版試營運

 */

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');
//import { replace } from './replace_tool.js';

// ----------------------------------------------------------------------------

const states_list = 'Ohio'.split('|');
const template_types = 'HousesArc|Arc|ArcDecade|HousesArcDecade|ChurchesArcDecade|BridgesArcDecade'.split('|');

function replace_US_state_templates(wikitext, page_data) {
	/** {Array} parsed page content 頁面解析後的結構。 */
	const parsed = page_data.parse();
	let changed;
	// e.g., "Template:OhioHousesArc"
	const from_template = this.wiki.remove_namespace(this.move_from_link);
	//console.log([from_template, this.state, this.replace_to_template]);
	parsed.each('template', (US_state_template, index, parent) => {
		if (US_state_template.name !== from_template)
			return;
		changed = true;
		US_state_template[0] = this.replace_to_template;
		US_state_template.splice(1, 0, this.state);
	});
	if (changed) {
		//console.log(parsed.toString());
		return parsed.toString();
	}
}

async function setup_move_configuration(meta_configuration) {
	/** {Object}wiki operator 操作子. */
	const wiki = meta_configuration.wiki;

	const list_configurations = Object.create(null);
	for (const state of states_list) {
		for (const template_type of template_types) {
			const replace_to_template = 'USState' + template_type.replace(/sArc/, 'Arc');
			const replace_to_template_full_name = wiki.to_namespace(replace_to_template, 'template');
			const replace_to_template_page = await wiki.page(replace_to_template_full_name, { prop: 'info' });
			// check if replace_to_template exists
			if (!CeL.wiki.content_of.page_exists(replace_to_template_page)) {
				CeL.log(`Not exists: ${CeL.wiki.title_link_of(replace_to_template_full_name)}`);
				continue;
			}

			list_configurations[`Template:${state}${template_type}`] = {
				text_processor: replace_US_state_templates,
				state,
				// template_type,
				replace_to_template,
			};
		}
	}

	return list_configurations;
}

//async function main_process()
(async () => {
	await replace_tool.replace({
		language: 'commons',
		family: 'commons',
		requests_page: 'COM:BR',

		// 可省略 `diff_id` 的條件: 以新章節增加請求，且編輯摘要包含 `/* section_title */`
		// 'small_oldid/big_new_diff' or {Number}new
		//diff_id: '',

		// 可省略 `section_title` 的條件: 檔案名稱即 section_title
		//section_title: '',

		//summary: '',
	}, setup_move_configuration);
})();
