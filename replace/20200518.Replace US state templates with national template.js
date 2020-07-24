/*

2020/5/18 20:1:53	初版試營運

 */

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');
//import { replace } from './replace_tool.js';

// ----------------------------------------------------------------------------

// Only respect maxlag. 因為數量太多，只好增快速度。
// CeL.wiki.query.default_edit_time_interval = 0;

const states_list = 'Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|District of Columbia|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Alaska|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming'.split('|');
const template_types = 'HousesArc|Arc|ArcDecade|HousesArcDecade|ChurchesArcDecade|BridgesArcDecade'.split('|');

function replace_US_state_templates(wikitext, page_data) {
	/** {Array} parsed page content 頁面解析後的結構。 */
	const parsed = page_data.parse();
	let changed;
	// e.g., "Template:OhioHousesArc"
	const from_template = this.wiki.remove_namespace(this.move_from_link);
	//console.log([from_template, this.state, this.replace_to_template]);
	//console.log(this.needless_templates);
	parsed.each('template', (template_token, index, parent) => {
		if (template_token.name in this.needless_templates) {
			// remove {{US state}}
			return CeL.wiki.parser.parser_prototype.each.remove_token;
		}
		if (template_token.name !== from_template
			// for redirects
			&& template_token.name !== from_template.replace('HousesArc', 'HouseArc')) {
			return;
		}
		changed = true;
		template_token[0] = this.replace_to_template;
		template_token.splice(1, 0, this.states_mapper[this.state] || this.state);
	});
	if (changed) {
		//console.log(parsed.toString());
		return parsed.toString();
	}
}

function remove_needless_templates(wikitext, page_data) {
	/** {Array} parsed page content 頁面解析後的結構。 */
	const parsed = page_data.parse();
	let changed;
	// e.g., "Template:USStateHouseArc"
	const from_template = this.wiki.remove_namespace(this.move_from_link);
	parsed.each('template', (template_token, index, parent) => {
		if (template_token.name in this.needless_templates) {
			changed = template_token;
			// remove {{US state}}
			return CeL.wiki.parser.parser_prototype.each.remove_token;
		}
		if (template_token.name !== from_template) {
			return;
		}
		if (template_token[1].toString() in this.states_mapper) {
			changed = true;
			template_token[1] = this.states_mapper[template_token[1].toString()];
		}
	});
	if (changed) {
		//console.log(parsed.toString());
		return parsed.toString();
	}
}

async function setup_move_configuration(meta_configuration, options) {
	/** {Object}wiki operator 操作子. */
	const wiki = meta_configuration.wiki;

	const needless_templates = Object.create(null);
	for (const template of await wiki.redirects_here(wiki.to_namespace('US states', 'template'))) {
		needless_templates[wiki.remove_namespace(template.title)] = null;
	}

	const replace_to_template_existence = Object.create(null);
	const states_mapper = Object.create(null);
	const list_configurations = Object.create(null);
	for (let state of states_list) {
		if (state.includes(' ')) {
			const _state = state.replace(/\s/g, '');
			states_mapper[_state] = state;
			state = _state;
		}
		for (const template_type of template_types) {
			const replace_to_template = 'USState' + template_type.replace(/ChurchesArc/, 'ChurchArc').replace(/sArc/, 'Arc');
			if (!(replace_to_template in replace_to_template_existence)) {
				const replace_to_template_full_name = wiki.to_namespace(replace_to_template, 'template');
				const replace_to_template_page = await wiki.page(replace_to_template_full_name, { prop: 'info' });
				// Be sure the replace_to_template exists.
				replace_to_template_existence[replace_to_template] = CeL.wiki.content_of.page_exists(replace_to_template_page);
				if (!replace_to_template_existence[replace_to_template]) {
					CeL.log(`Template not exists: ${CeL.wiki.title_link_of(replace_to_template)}`);
					continue;
				}
			} else if (!replace_to_template_existence[replace_to_template]) {
				continue;
			}

			// For start from remove_needless_templates()
			//continue;

			list_configurations[wiki.to_namespace(state + template_type, 'template')] = {
				text_processor: replace_US_state_templates,
				state,
				// template_type,
				replace_to_template,
				needless_templates,
				states_mapper,
			};
		}
	}
	//console.log(states_mapper);

	for (const template of Object.keys(replace_to_template_existence)) {
		list_configurations[wiki.to_namespace(template, 'template')] = {
			text_processor: remove_needless_templates,
			namespace: 'Category',
			needless_templates,
			states_mapper,
			before_get_pages(page_list, edit_options) { edit_options.summary += ' (redundancy {{US states}})'; }
		};
	}

	return list_configurations;
}

//async function main_process()
(async () => {
	await replace_tool.replace({
		language: 'commons',
		//family: 'commons',
		//use_project: 'commons',
		requests_page: 'COM:BR',

		// 可省略 `diff_id` 的條件: 以新章節增加請求，且編輯摘要包含 `/* section_title */`
		// 'small_oldid/big_new_diff' or {Number}new
		//diff_id: '',

		// 可省略 `section_title` 的條件: 檔案名稱即 section_title
		//section_title: '',

		//summary: '',
	}, setup_move_configuration);
})();
