'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('zh');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

/** {Array}引文格式1模板 */
let citation_template_list;

// @see CeL.data.date
const PATTERN_EN_MONTH_YEAR = /^(?:([a-z]+)[–\-])?([a-z]+)\s+(\d{1,4})$/i;

// ----------------------------------------------

// 讀入手動設定 manual settings。
async function adapt_configuration(latest_task_configuration) {
	//console.log(latest_task_configuration);
	// console.log(wiki);

	// ----------------------------------------------------

	const { general } = latest_task_configuration;
}

// ----------------------------------------------------------------------------

(async () => {
	//login_options.configuration_adapter = adapt_configuration;
	await wiki.login(login_options);
	await main_process();
})();

// ----------------------------------------------------------------------------

/**
 * 取得所有要檢查的模板名稱。
 */
async function setup_citation_template_list() {
	// get from [[Category:引用模板]]
	let citation_templates = Object.create(null);
	(await wiki.categorymembers('Category:引用模板', { namespace: 'Template' }))
		.forEach(page_data => citation_templates[page_data.title] = null);
	citation_templates = (await wiki.embeddedin('Module:Citation/CS1', { namespace: 'Template' }))
		// 取交集。
		.filter(page_data => page_data.title in citation_templates).map(page_data => page_data.title)
		.append(['Template:Cite iucn',
			//'Template:Speciesbox',
		]);

	await wiki.register_redirects(citation_templates);

	citation_template_list = wiki.redirect_target_of(citation_templates);
	//console.trace(citation_template_list);
}

async function main_process() {
	await setup_citation_template_list();

	await replace_tool.replace({
		use_language,
		not_bot_requests: true,
		summary: '[[Wikipedia:机器人/申请/Cewbot/25|正規化日期格式、清理引文模組未知參數]]',
	}, {
		'Category:含有未知参数的引用的页面': {
			namespace: 0,
			for_template,
			list_types: 'categorymembers',
		}
	});
}

function for_template(token, index, parent) {
	// 較慢的版本: if (!wiki.is_template(citation_template_list, token)) return;
	if (!citation_template_list.includes(wiki.redirect_target_of(token))) {
		return;
	}

	let not_valid_date;
	const date_parameters_changed = [];

	// check the date format if it is not valid.
	for (const parameter_name in token.parameters) {
		if (!parameter_name.includes('date'))
			continue;

		// 先檢查所有日期參數，判斷日期格式是否正確。若有錯誤日期格式，嘗試修正之。仍無法改正，則不清除 df參數。但這種日期格式修正只在要去除參數的前提下，才當作一種 [[Wikipedia:AutoWikiBrowser/General fixes]] 順便修改。
		const value = token.parameters[parameter_name].toString()
			.replace(/\s*<!--DASHBot-->\s*/, '');
		// @see function check_date (date_string, tCOinS_date) @ [[w:zh:Module:Citation/CS1/Date_validation|日期格式驗證函數]]
		// e.g., 2021, 2021-04, 2021-04-12
		if (/^[12]\d{3}(?:-[01]\d(?:-[0-3]\d)?)?$/.test(value)
			// e.g., '2018年', '2018年3月', '2018年3月6日'
			|| /^[12]\d{3}年(?:[01]?\d月(?:[0-3]?\d日)?)?$/.test(value)) {
			// is valid date
			continue;
		}

		// 預防可 new Date()，但實際上有問題的日期。
		if (/^\d+$/.test(value)
			// e.g., '20060306103740'
			//|| /^[12]\d{3}[01]\d[0-3]\d{6}$/.test(value)
			// e.g., '10.12', '10/12'
			|| /^\d{1,2}[^\d]\d{1,2}$/.test(value)
		) {
			not_valid_date = true;
			continue;
		}

		if (value && !PATTERN_EN_MONTH_YEAR.test(value)
			// e.g., '9 January 2014'
			&& !/^[0-3]?\d\s+[a-z]+\s+[12]\d{3}$/i.test(value)
			// e.g., 'July 14, 2020'
			&& !/^[a-z]+\s+[0-3]?\d\s*,\s*[12]\d{3}$/i.test(value)
		) {
			CeL.debug(`Invalid date format: |${parameter_name}=${value}|`, 0);
		}
		const date = value.to_Date();
		if (!date || date.precision && date.precision !== 'day') {
			not_valid_date = true;
			continue;
		}

		// 由於要刪除 df參數必須判別日期格式，因此順便修正可讀得懂，但是格式錯誤的日期。
		// Convert to ISO 8601
		CeL.wiki.parse.replace_parameter(token, { [parameter_name]: date.format('%Y-%2m-%2d') }, 'value_only');
		date_parameters_changed.push(parameter_name);
	}

	const parameters_to_remove = [
		// doi-access參數與df參數有所不同，其包含了本站條目所需的有用信息，應通過修改模塊使之發揮作用，而非刪除；
		//'doi-access',
	];
	// 仍無法改正，則不清除 df參數。
	if (!not_valid_date)
		parameters_to_remove.push('df');

	const parameters_changed = [];
	parameters_to_remove.forEach(parameter_name => {
		const index = token.index_of[parameter_name];
		if (index) {
			token[index] = '';
			parameters_changed.push(parameter_name);
		}
	});

	if (parameters_changed.length > 0) {
		this.discard_changes = false;
		// 日期格式修正只在要去除參數的前提下，才當作一種 [[Wikipedia:AutoWikiBrowser/General fixes]] 順便修改。
		if (date_parameters_changed.length > 0)
			parameters_changed.append(date_parameters_changed);
		this.summary += '; ' + parameters_changed.join(', ');
		return true;
	}

	if (this.discard_changes !== false)
		this.discard_changes = true;
}
