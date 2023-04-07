/*
node 20230406.Clean_up_redirected_categories.js use_project=zh.wikinews

這個任務會清理嵌入{{tl|Category redirect}}的分類，把已經重定向的分類下面的頁面搬到新分類下面。

2023/4/6 19:56:3	初版試營運

*/

'use strict';

// Load replace tools.
const replace_tool = require('../replace/replace_tool.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('zh');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

const MULTIPLE_TARGETS = { MULTIPLE_TARGETS: true };

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

	if (!general.redirect_template_name)
		general.redirect_template_name = 'Template:Category redirect';
	let min_interval = general.min_interval && CeL.to_millisecond(general.min_interval);
	if (!(min_interval >= 0))
		general.min_interval = CeL.to_millisecond('1d');

	console.trace(wiki.latest_task_configuration.general);
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

async function main_process() {
	const redirect_template_data = await wiki.register_redirects(wiki.latest_task_configuration.general.redirect_template_name);

	const category_list = await wiki.embeddedin(redirect_template_data.title, { namespace: 'Category' });
	await wiki.for_each_page(category_list, for_category);
}

async function for_category(category_page_data) {
	if (true) {
		// 分類重定向24小時後再操作，以免破壞者惡意重定向分類導致機器人大量錯誤編輯。
		const page_modify_time = Date.parse(category_page_data.revisions[0].timestamp);
		const page_age = Date.now() - page_modify_time;
		if (page_age < wiki.latest_task_configuration.general.min_interval) {
			CeL.info(`${for_category.name}: 跳過${CeL.indicate_date_time(page_modify_time)}更改的分類: ${CeL.wiki.title_link_of(category_page_data)}`);
			return;
		}
	}

	const parsed = category_page_data.parse();
	let move_to_link = null;

	parsed.each(wiki.latest_task_configuration.general.redirect_template_name, token => {
		let move_to = token.parameters[1];
		if (!move_to)
			return;

		move_to = wiki.to_namespace(move_to, 'Category');
		if (move_to_link) {
			CeL.error(`Also set to ${move_to}`);
			move_to_link = MULTIPLE_TARGETS;
			return;
		}

		move_to_link = move_to;
		CeL.info(`${for_category.name}: ${category_page_data.title.padEnd(40)}\t→ ${move_to_link}`);
	});

	if (move_to_link === MULTIPLE_TARGETS)
		return;

	if (false && !wiki.is_namespace(move_to_link, 'Category')) {
		CeL.error('僅處理 category');
		return;
	}

	// 確保 move_to_link 存在。
	if (true) {
		const target_page_data = await wiki.page(move_to_link);
		if (('missing' in target_page_data) || ('invalid' in target_page_data)) {
			CeL.error(`重定向標的不存在: ${move_to_link}`);
			return;
		}
		//console.log(target_page_data.wikitext);
	}

	await replace_tool.replace({
		wiki,
		use_language,
		not_bot_requests: true,
		no_move_configuration_from_command_line: true,
		summary: `${CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title, '清理重定向的分類')}: ${CeL.wiki.title_link_of(category_page_data)}→${CeL.wiki.title_link_of(move_to_link)}`
		//+ ' 人工監視檢測中 '
		,
	}, {
		[category_page_data.title]: {
			namespace: 'main|Category',
			move_to_link,
			list_types: 'categorymembers',
		},
	});
}
