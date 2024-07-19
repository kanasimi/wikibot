/*

node 20221102.create_wikinews_category_and_project_pages.js date=2022/10
node 20221102.create_wikinews_category_and_project_pages.js month_duration=3
node 20221102.create_wikinews_category_and_project_pages.js month_duration=6 date=2024/7


創建每日新聞摘要頁面
2022/11/3 14:9:39	初版試營運。
2022/11/3 16:32:45	完成。正式運用。

TODO:

 */

'use strict';

//globalThis.use_project = 'zh.wikinews';

// Load CeJS library and modules.
require('../wiki loader.js');

// Load modules.
CeL.run([]);

// Set default language. 改變預設之語言。 e.g., 'zh'
//set_language('ja');
/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// ----------------------------------------------------------------------------

/**
 * 由設定頁面讀入手動設定 manual settings。
 * 
 * @param {Object}latest_task_configuration
 *            最新的任務設定。
 */
async function adapt_configuration(latest_task_configuration) {
	const { general } = latest_task_configuration;

	CeL.log('Task configuration:');
	console.log(wiki.latest_task_configuration);
}

// ----------------------------------------------------------------------------

(async () => {
	login_options.API_URL = 'zh.wikinews';
	login_options.configuration_adapter = adapt_configuration;
	//console.log(login_options);
	await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
	await main_process();
	routine_task_done('1 month');
})();

// 平移向後一個月。
function set_1_month_later(date) {
	if (date.getMonth() === 11) {
		date.setFullYear(date.getFullYear() + 1);
		date.setMonth(0);
	} else {
		date.setMonth(date.getMonth() + 1);
	}
}

async function main_process() {
	let start_date = CeL.env.arg_hash?.date?.to_Date() || new Date;
	start_date.setDate(1);
	let end_date = new Date(start_date.getTime());
	if (CeL.env.arg_hash?.month_duration > 0) {
		for (let count = 0; count < CeL.env.arg_hash.month_duration; count++)
			set_1_month_later(end_date);
	} else {
		// 預設生成整個月份的頁面。
		set_1_month_later(end_date);
	}

	async function create_month_year_pages(date) {
		await create_month_category(date);
		await create_month_project_page(date);
		await create_year_category(date);
		await create_year_project_page(date);
	}

	await create_month_year_pages(start_date);

	while (start_date.getTime() < end_date.getTime()) {
		//console.trace(start_date);
		await create_day_category(start_date);
		await create_day_project_page(start_date);
		const old_date = new Date(start_date.getTime());
		start_date.setDate(start_date.getDate() + 1);
		if (start_date.getDate() === 1) {
			await create_month_year_pages(old_date);
		}
	}
}

// ----------------------------------------------------------------------------

async function create_day_category(date) {
	const page_title = date.format('Category:%Y年%m月%d日');
	CeL.log_temporary(page_title);
	await wiki.edit_page(page_title, page_data => {
		if (page_data.wikitext)
			return Wikiapi.skip_edit;

		return `
[[Category:${date.format('%Y年%m月')}|${date.format('%2d日')}]]

[[fr:Category:${date.toLocaleDateString('fr', { year: 'numeric', month: 'long', day: 'numeric' }).replace(/^1 /, '1er ')}]]
`.trimStart();
	}, {
		bot: 1,
		summary: '創建每日新聞分類'
	});
}

async function create_month_category(date) {
	const page_title = date.format('Category:%Y年%m月');
	CeL.log_temporary(page_title);
	await wiki.edit_page(page_title, page_data => {
		if (page_data.wikitext)
			return Wikiapi.skip_edit;

		return `
[[Category:${date.format('%Y年')}|${date.format('%2m月')}]]

[[fr:Category:${date.toLocaleDateString('fr', { year: 'numeric', month: 'long' }).toTitleCase()}]]
`.trimStart();
	}, {
		bot: 1,
		summary: '創建每月新聞分類'
	});
}

async function create_year_category(date) {
	const page_title = date.format('Category:%Y年');
	CeL.log_temporary(page_title);
	await wiki.edit_page(page_title, page_data => {
		if (page_data.wikitext)
			return Wikiapi.skip_edit;

		return `[[Category:按年分类的新闻]]`;
	}, {
		bot: 1,
		summary: '創建每年新聞分類'
	});
}

// ----------------------------------------------------------------------------

async function create_day_project_page(date) {
	const page_title = date.format('Wikinews:%Y年/%m月/%d日');
	CeL.log_temporary(page_title);
	await wiki.edit_page(page_title, page_data => {
		if (page_data.wikitext)
			return Wikiapi.skip_edit;

		return `
<onlyinclude><DynamicPageList>
category=已发布
category=${date.format('%Y年%m月%d日')}
notcategory=删除请求
notcategory=未发表
suppresserrors=true
namespace=0
ordermethod=lastedit
</DynamicPageList></onlyinclude>

[[Category:${date.format('%Y年%m月')}|W${date.format('%2d日')}]]

[[fr:Wikinews:${date.format('%Y')}/${date.toLocaleDateString('fr', { month: 'long' })}/${date.format('%2d')}]]
`.trimStart();
	}, {
		bot: 1,
		summary: '創建每日新聞摘要頁面'
	});
}

// Will modify date!
async function create_month_project_page(date) {
	const page_title = date.format('Wikinews:%Y年/%m月');
	CeL.log_temporary(page_title);
	await wiki.edit_page(page_title, page_data => {
		if (page_data.wikitext)
			return Wikiapi.skip_edit;

		// for date.getDay()
		date.setDate(1);

		const date_of_previous_month = new Date(date.getTime());
		date_of_previous_month.setMonth(date_of_previous_month.getMonth() - 1);
		const date_of_next_month = new Date(date.getTime());
		date_of_next_month.setMonth(date_of_next_month.getMonth() + 1);

		/*
		https://zh.wikinews.org/w/index.php?title=Template:31daymonth0&action=edit
		
		Variables
		month = name of month
		1 = Previous month
		2 = Next month
		3 = Year
		4 = Previous month year
		5 = Next month year
		6 = prefix
		7 = suffix
		color = background colour of header row
		color2 = background colour of calendar body, footer
		float = float direction (left, right, center?)
		EndNote = text in footer
		*/

		// https://zh.wikinews.org/w/index.php?title=Wikinews:2022%E5%B9%B4/1%E6%9C%88&action=edit
		const content = [`
{{Purge}}
{{${date.toLocaleDateString('en', { month: 'long' }).toTitleCase()}Calendar|StartDOW=${date.getDay()}|1=${date_of_previous_month.format('%m月')}|2=${date_of_next_month.format('%m月')}|3=${date.format('%Y年')}|4=${date_of_previous_month.format('%Y年')}|5=${date_of_next_month.format('%Y年')}|6=#|7=日|color=#c0c0ff|color2=#eeeeff|float=right|EndNote=新聞存檔}}__NOTOC__
`.trimStart()];
		const tail = `[[Category:${date.format('%Y年')}|${date.format('%2m月')}]]
[[Category:${date.format('%Y年%m月')}]]

[[fr:Wikinews:${date.format('%Y')}/${date.toLocaleDateString('fr', { month: 'long' })}]]
`.trimStart();

		const month = date.getMonth();
		while (month === date.getMonth()) {
			content.push(`
== [[/${date.format('%d日')}|${date.format('%m月%d日')}]] ==
{{/${date.format('%d日')}}}
`.trimStart());
			date.setDate(date.getDate() + 1);
		}

		content.push(tail);

		return content.join('\n');
	}, {
		bot: 1,
		summary: '創建每月新聞摘要頁面'
	});
}

async function create_year_project_page(date) {
	const page_title = date.format('Wikinews:%Y年');
	CeL.log_temporary(page_title);
	await wiki.edit_page(page_title, page_data => {
		if (page_data.wikitext)
			return Wikiapi.skip_edit;

		return `#REDIRECT [[Category:${date.format('%Y年')}]]`;
	}, {
		bot: 1,
		summary: '創建每年新聞摘要頁面'
	});
}
