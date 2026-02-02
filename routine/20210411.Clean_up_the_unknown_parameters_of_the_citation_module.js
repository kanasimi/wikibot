/*

TODO:
[[1920年以前香港命案列表]]	"|date=1907-09-25 work=香港華字日報 }}"
{{webarchive}}

*/

'use strict';

// Load replace tools.
const replace_tool = require('../replace/replace_tool.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('zh');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

/** {Array}引文格式1模板 */
let citation_template_list;

CeL.run('data.numeral');

// @see CeL.data.date
const PATTERN_EN_MONTH_YEAR = /^(?:([a-z]{3,9})\s*[.\/\-–－—─~～〜﹣])?\s*([a-z]{3,9})\s+(\d{1,4})$/i;

// ----------------------------------------------

/**
 * 由設定頁面讀入手動設定 manual settings。
 * 
 * @param {Object}latest_task_configuration
 *            最新的任務設定。
 */
async function adapt_configuration(latest_task_configuration) {
	//console.log(latest_task_configuration);
	// console.log(wiki);

	// ----------------------------------------------------

	if (!latest_task_configuration.general)
		latest_task_configuration.general = Object.create(null);
	const { general } = latest_task_configuration;

	//console.trace(wiki.latest_task_configuration.general);
}

// ----------------------------------------------------------------------------

(async () => {
	login_options.configuration_adapter = adapt_configuration;
	//console.log(login_options);
	await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
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

	//CeL.set_debug(9);
	await replace_tool.replace({
		wiki,
		use_language,
		not_bot_requests: true,
		no_move_configuration_from_command_line: true,
		summary: '[[Wikipedia:机器人/申请/Cewbot/25|正規化日期格式、清理引文模組未知參數]]'
		//+ ' 人工監視檢測中 '
		,
	}, {
		'Category:含有未知参数的引用的页面': {
			namespace: 0,
			for_template,
			list_types: 'categorymembers',
			page_list: [],
			//page_list : [ 'Key開發遊戲列表' ],
		},
		'Category:引文格式1错误：日期': {
			namespace: 0,
			for_template,
			list_types: 'categorymembers',
			page_list: ['互联网档案馆'],
		},
	});

	routine_task_done('1 week');
}

function for_template(token, index, parent) {
	// 較慢的版本: if (!wiki.is_template(citation_template_list, token)) return;
	if (!citation_template_list.includes(wiki.redirect_target_of(token))) {
		return;
	}

	let invalid_date;
	const date_parameters_changed = [];

	// check the date format if it is not valid.
	for (const parameter_name in token.parameters) {
		if (!parameter_name.includes('date'))
			continue;

		const original_value = token.parameters[parameter_name].toString();
		// CeL.from_positional_Chinese_numeral(): 正規化 ０１２３４５６７８９
		const value = CeL.from_positional_Chinese_numeral(original_value).toString().replace(/\s*<!--DASHBot-->\s*/, '')
			//e.g., '{{date|2012-10-10|dealurl=no}}'
			.replace(/{{ *Date *\|([^|]+?)(?:\|.+?)?}}/i, '$1').trim();
		//console.trace([parameter_name, original_value, value]);

		// 先檢查所有日期參數，判斷日期格式是否正確。若有錯誤日期格式，嘗試修正之。仍無法改正，則不清除 df參數。但這種日期格式修正只在要去除參數的前提下，才當作一種 [[Wikipedia:AutoWikiBrowser/General fixes]] 順便修改。
		// @see function check_date (date_string, tCOinS_date) @ [[w:zh:Module:Citation/CS1/Date_validation|日期格式驗證函數]]
		// e.g., 2021, 2021-04, 2021-04-12
		if (/^[12]\d{3}(?:-[01]\d(?:-[0-3]\d)?)?$/.test(value)
			// e.g., '2018年', '2018年3月', '2018年3月6日'
			|| /^[12]\d{3}年(?:[01]?\d月(?:[0-3]?\d日)?)?$/.test(value)) {
			//CeL.debug(`${parameter_name} is valid date: ${JSON.stringify(value)}, continue next (可清除 df參數).`);
			continue;
		}

		// --------------------------------------------
		// 排除可 new Date()，但實際上有問題的日期，將之改為無法判別。

		if (/^\d+$/.test(value)
			// e.g., '20060306103740'
			//|| /^[12]\d{3}[01]\d[0-3]\d{6}$/.test(value)
			// e.g., '18-15 July 2010'
			//|| /^[0-3]?\d[.\/\-–－—─~～〜﹣][0-3]?\d\s+[a-z]{3,}\s+[12]\d{3}$/i.test(value)
			|| /^\d+[.\/\-–－—─~～〜﹣]\d+\s+[a-z]{3,}\s+\d+$/i.test(value)
			// e.g., 'May 1-5, 2010'
			|| /^[a-z]{3,}\s+\d+[.\/\-–－—─~～〜﹣]\d+\s*,\s*\d+$/i.test(value)
			// e.g., 'June 30-July 11, 1986'
			|| /^[a-z]{3,}\s*\d+\s*[.\/\-–－—─~～〜﹣]\s*[a-z]{3,}/i.test(value)
			// e.g., '10 12, 2001'
			// e.g., '10 12 2001'
			|| /\d+\s+\d+\s+(?:,\s*)?\d+/.test(value)
			// e.g., '2001, 10 12'
			// e.g., '2001 10 12'
			|| /\d+\s+(?:,\s*)?\d+\s+\d+/.test(value)
			// e.g., '3/17/05'
			|| /^\d{1,3}[\s.\/\-–－—─~～〜﹣]+\d{1,3}[\s.\/\-–－—─~～〜﹣]+\d{1,3}$/.test(value)
			// e.g., '11-16'
			|| /^\d{1,4}[\s.\/\-–－—─~～〜﹣]+\d{1,4}$/.test(value)
			// e.g., '8月5日'
			|| /^[\d\s]+月[\d\s]+日$/.test(value)
			// e.g., '01期'
			|| /^[\d\s]+[^\d\s]*$/.test(value)
		) {
			CeL.debug(`${parameter_name} is invalid date 1: ${JSON.stringify(value)}, continue next.`);
			invalid_date = true;
			continue;
		}

		let matched = value.match(/\d\s*([./])\s*\d/);
		if (matched && (matched = value.split(matched[1])).length === 2) {
			// e.g., '10.12', '10/12'
			// e.g., '1/5, 2010'
			CeL.debug(`${parameter_name} is invalid date 2: ${JSON.stringify(value)}, continue next.`);
			invalid_date = true;
			continue;
		}

		// --------------------------------------------

		let unknown_format;
		if (value && !PATTERN_EN_MONTH_YEAR.test(value)
			// e.g., '9 January 2014'
			&& !/^[0-3]?\d\s*[a-z]{3,9}\s*[12]\d{3}$/i.test(value)
			// e.g., 'July 14, 2020'
			&& !/^[a-z]{3,9}\s+[0-3]?\d\s*,\s*[12]\d{3}$/i.test(value)
			// e.g., '2013-1-24'
			// e.g., '2013--1-24'
			&& !/^[12]\d{3}[.\/\-–－—─~～〜﹣]{1,3}[01]?\d[.\/\-–－—─~～〜﹣]{1,3}[0-3]?\d$/i.test(value)
		) {
			CeL.debug(`${parameter_name} is unknown date format: ${JSON.stringify(value)}.`);
			unknown_format = true;
		}

		const date = value.to_Date();
		if (!date || date.precision && date.precision !== 'day'
			// e.g., '20186-07'
			|| date.getFullYear() > 2100
			// e.g., '2016-08-0%'
			// e.g., '8 October 2004 (Last Updated/Reviewed on 17 October 2008)'
			|| /[~`!@#$%^&*_+={}\[\]()|\\`<>?"']/.test(value)
		) {
			CeL.debug(`${parameter_name} is invalid date 3: ${JSON.stringify(value)}, continue next.`);
			if (unknown_format)
				CeL.log(`Invalid date format: |${parameter_name}=${original_value}|`);
			invalid_date = true;
			continue;
		}

		// e.g., '2/12/2007'
		// e.g., '05.02.2013'
		matched = value.match(/(\d+)[\s.\/\-–－—─~～〜﹣]+(\d+)[\s.\/\-–－—─~～〜﹣]+(\d{4})/);
		if (matched && +matched[1] <= 12 && +matched[2] <= 12 && +matched[1] !== +matched[2]) {
			CeL.log(`Cannot determine month or date: |${parameter_name}=${original_value}|`);
			invalid_date = true;
			continue;
		}

		if (unknown_format)
			CeL.error(`Invalid date format: |${parameter_name}=${original_value}| → ${date.format('%Y-%2m-%2d')}`);

		// 由於要刪除 df參數必須判別日期格式，因此順便修正可讀得懂，但是格式錯誤的日期。
		CeL.debug(`Convert to ISO 8601: |${parameter_name}=${original_value}|	→ ${date.format('%Y-%2m-%2d')}`);
		CeL.wiki.parse.replace_parameter(token, { [parameter_name]: date.format('%Y-%2m-%2d') }, { value_only: true });
		date_parameters_changed.push(parameter_name);
	}

	const parameters_to_remove = [
		// doi-access參數與df參數有所不同，其包含了本站條目所需的有用信息，應通過修改模塊使之發揮作用，而非刪除；
		//'doi-access',
	];
	// 仍無法改正，則不清除 df參數。
	if (!invalid_date && date_parameters_changed.length > 0) {
		// Remove |df=*
		parameters_to_remove.push('df');
	}

	const parameters_changed = date_parameters_changed.slice();
	parameters_to_remove.forEach(parameter_name => {
		const index = token.index_of[parameter_name];
		// TODO: use CeL.wiki.parse.replace_parameter()
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
