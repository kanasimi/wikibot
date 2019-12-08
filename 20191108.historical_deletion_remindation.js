/*

 	初版試營運

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loader.js');

CeL.run('application.net.wiki.template_functions');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;
// globalThis.use_language = 'zh';
use_language = 'zh';

const notification_template = 'Template:Old vfd multi';
const start_date = '2008-08-12';
const end_date = '2010/11/20'.to_Date() && Date.now();

const FLAG_CHECKED = 'OK', FLAG_TO_ADD = 'need add', FLAG_TO_REMOVE = 'not found', FLAG_DUPLICATED = 'duplicated';
// deletion_flags_of_page[page_title]
// = [ {date:'',result:'',...,bot_checked:''}, ... ]
const deletion_flags_of_page = Object.create(null);
// pages_to_modify[page_title] = [ {date:'',result:'',...,bot_checked:''}, ... ]
const pages_to_modify = Object.create(null);

// ----------------------------------------------------------------------------

function for_each_vfd_template(item, page_data) {
	if (!item) {
		CeL.warn('No Hat template found: ' + CeL.wiki.title_link_of(page_data));
		// console.log(page_data);
		return;
	}

	const page_title = item.page_title;
	// delete item.page_title;
	if (!deletion_flags_of_page[page_title])
		deletion_flags_of_page[page_title] = [];

	if (!Array.isArray(item)) {
		item = [item];
	}

	item.forEach((discussion) => {
		if (discussion.date)
			discussion.JDN = CeL.Julian_day(discussion.date.to_Date());

		if (CeL.is_digits(discussion.page)) {
			CeL.warn('for_each_vfd_template: ' + CeL.wiki.title_link_of(page_data) + ': detects numeral page: ' + discussion.page);
		}
	});

	deletion_flags_of_page[page_title].append(item);
}

async function check_deletion_page(JDN, page_data) {
	if ('missing' in page_data) {
		// The page is not exist now. No-need to add `notification_template`.
		return;
	}

	const normalized_page_title = page_data.title;

	// CeL.info(CeL.wiki.title_link_of(page_data));
	if (false) {
		// NG: Check the talk page
		const page_title = normalized_page_title.replace(/:/, ' talk:');
		page_data = await wiki.page(page_title);
		CeL.wiki.template_functions.Old_vfd_multi.parse(page_data, (item) => {
			;
		});
	}

	const page_title = page_data.original_title || normalized_page_title;
	// assert: 同頁面在同一天內僅存在單一討論。
	const flags_of_page = this;
	//console.log(flags_of_page);
	let flags = flags_of_page[page_title], target;
	if (!flags && (flags = flags_of_page[KEY_page_list].convert_from[page_title])) {
		flags = flags_of_page[flags];
	}
	if (!flags) {
		CeL.error('check_deletion_page: Failed to get flags_of_page: ' + JSON.stringify(page_title));
		console.log(flags_of_page);
	}
	if (flags.result === 'r' && page_data.redirect_from === page_title) {
		// 不處理重定向來源已經過重定向的情況。
		// return;
	}

	const text_of_result = CeL.wiki.template_functions.Old_vfd_multi.text_of(flags.result, true);

	const discussions = deletion_flags_of_page[normalized_page_title]
		|| pages_to_modify[normalized_page_title]
		// 直接列入要改變的。
		|| (pages_to_modify[normalized_page_title] = []);
	//console.log(discussions);
	let bingo, need_modify;
	discussions.forEach((discussion) => {
		if (discussion.JDN !== JDN)
			return;
		if (bingo) {
			need_modify = true;
			discussion.bot_checked = FLAG_DUPLICATED;
			return;
		}

		bingo = true;
		if (discussion.page !== (flags.page || page_title)) {
			// using `flags.page` as anchor
			discussion.page = flags.page || page_title;
			need_modify = true;
		}

		if (discussion.hat_result !== flags.result) {
			discussion.hat_result = flags.result;
			if (discussion.result !== flags.result && discussion.result !== text_of_result) {
				discussion.result = text_of_result;
				need_modify = true;
			}
		}
		if (discussion.target !== flags.target) {
			discussion.target = flags.target;
			need_modify = true;
		}
		// discussion.bot_checked = FLAG_CHECKED;
	});

	if (!bingo) {
		need_modify = true;
		discussions.push({
			date: CeL.Julian_day.to_Date(JDN).format('%Y/%m/%d'),
			page: page_title,
			result: text_of_result,
			hat_result: flags.result,
			// bot_checked : FLAG_CHECKED,
			JDN
		});
		//console.log(discussions);
	}

	if (discussions.some(discussion => CeL.is_digits(discussion.page) && discussion.page === '0')) {
		CeL.warn('check_deletion_page: ' + CeL.wiki.title_link_of(page_data) + ' ' + normalized_page_title + ': detects numeral page "0" to modify:');
		console.log(discussions);
		console.log(flags_of_page);
		//throw new Error(normalized_page_title);
	}

	if (need_modify && deletion_flags_of_page[normalized_page_title]) {
		delete deletion_flags_of_page[normalized_page_title];
		pages_to_modify[normalized_page_title] = discussions;
	}
}

const Hat_names = CeL.wiki.template_functions.Hat.names;
const KEY_title = Symbol('title');
const KEY_page_list = Symbol('page list');

async function check_deletion_discussion_page(page_data) {
	// console.log(page_data.wikitext);
	const parsed = page_data.parse();
	let page_list = [];
	const flags_of_page = Object.create(null);
	flags_of_page[KEY_title] = page_data.title;
	if (pages_to_modify[0]) {
		CeL.warn('pages_to_modify[0] setted @ ' + CeL.wiki.title_link_of(page_data));
	}

	function for_each_section(section, index) {

		function add_page(title, flags) {
			title = title && title.toString();
			var page = CeL.wiki.normalize_title(title);
			if (!page)
				return;
			//跳過無效的刪除請求：這些請求沒必要特別註記。
			if (flags.result in { ir: true, rr: true, sk: true, drep: true, nq: true, ne: true, rep: true })
				return;

			if (CeL.is_digits(title)
				&& section.section_title.link.title !== '[[' + title + ']]'
				&& !/{{al(\|\d+)+}}/i.test(section.section_title.link.title)) {
				//debug
				CeL.warn('add_page: Add numerals: ' + title);
				console.log(section.section_title.link);
				console.log(flags);
			}
			// using `flags.page` as anchor
			flags.page = title;
			flags_of_page[page] = flags;
			page_list.push(page);
		}

		if (index === 0) {
			// Skip the first section
			return;
		}

		const flags = Object.create(null);
		section.each('template', (token) => {
			// {{Talkendh|處理結果}}
			if (token.name in Hat_names) {
				flags.result = token.parameters[1];
				if (flags.result && token.parameters[2]) {
					flags.target = token.parameters[2];
				}
				return parsed.exit;
			}
		});

		if (!flags.result) {
			// Skip non-discussions
			return;
		}

		const section_title_text = section.section_title.join('').trim();
		// [[31]]天仍掛上 {{tl|fame}} 或 {{tl|notability}} 模板的[[WP:NOTE|條目]]
		// 30天仍排上 {{fame}} 或 {{importance}} 模板的條目
		// 30天仍掛上 {{tl|fame}} 或 {{tl|notability}} 模板的[[WP:NOTE|條目]]
		// 30天仍掛上 {{tl|Substub}}、{{tl|小小作品}} 或 {{tl|小小條目}} 模板的[[WP:NOTE|條目]]
		// 30天后仍掛有{{tl|notability}}模板的條目 30天后仍掛有{{tl|notability}}模板的條目
		// 過期小小作品 到期篩選的小小作品 台灣學校相關模板 一堆模板-5 又一堆模板 再一堆模板 废弃的化学信息框相关模板 一些年代条目
		// 關注度提刪 關注度到期 批量模板提刪 批量提刪
		if (// section.section_title.level <= 4 &&
			/天[後后]?仍[排掛][有上]|[過到]期.*作品|相[關关]模板|關注度|(?:一[堆些]|[幾\d]個|批量).*(?:模板|頁面|页面|條目|条目|列表|討論頁|讨论页|提刪)/.test(section_title_text)
			// 模板重定向 繁简重定向 一些外語重定向 绘文字重定向
			|| /重定向$/.test(section_title_text)
			|| /^(?:模板|頁面|页面|條目|条目|列表|討論頁|讨论页|提刪)$/.test(section_title_text)
		) {
			return;
		}

		// ----------------------------------------------------------

		flags.result = flags.result.toString();

		let title_to_delete;
		section.section_title.some((token) => {
			if (typeof token === 'string') {
				// 這會順便忽略 "-->", "->"
				return /[^,;:.'"\s→、\[\]\/\->「」『』…]/.test(token);
			}
			if (token.tag === 's' || token.tag === 'del') {
				return false;
			}
			return title_to_delete = token;
		});

		if (!title_to_delete && section.section_title.length === 1) {
			//e.g., ==<s>[[:AngelTalk]]</s>==
			title_to_delete = section.section_title[0];
		}

		if (title_to_delete && title_to_delete.is_link) {
			// e.g., [[Wikipedia:頁面存廢討論/記錄/2008/08/12]]
			if (!title_to_delete[0].toString().startsWith('Wikipedia:頁面存廢討論/'))
				add_page(title_to_delete[0], flags);
			return;
		}
		function for_Al(title_token) {
			if (title_token && title_token.type === 'transclusion' && title_token.name === 'Al') {
				title_token.forEach((_title, index) => {
					if (index > 0) add_page(_title, flags);
				});
				return true;
			}
		}
		if (for_Al(title_to_delete)) return;

		if (title_to_delete && title_to_delete.converted) {
			if (title_to_delete.converted.is_link) {
				// "====-{[[迪奥尼日·波尼亚托夫斯基]]}-===="
				add_page(title_to_delete.converted[0], flags);
				return;
			}
			if (Array.isArray(title_to_delete.converted)
				// == -{ {{al|Template:東鐵綫未來發展車站列表|Template:南北線車站列表|Template:南北綫車站列表}} }- ==
				&& title_to_delete.converted.some(for_Al)) {
				return;
			}
		}

		// 去掉無效請求，或最終保留的：無傷大雅。
		if ((flags.result.toString().trim().toLowerCase() in { cc: true, ir: true, rr: true, rep: true, k: true, sk: true, os: true })
			// e.g., 提刪者撤回 提請者收回 請求無效 無效提名 重複提出，無效 全部重複／未到期，請求無效
			// 提案者重复提出，请求失效。见下。 改掛關注度模板，三十天後再議
			|| /[撤收]回|[無无失]效|未到期|天後再議/.test(flags.result)) {
			return;
		}

		const text_of_result = CeL.wiki.template_functions.Old_vfd_multi.text_of(flags.result);

		if (section.section_title.length === 1 && typeof section.section_title[0] === 'string') {
			CeL.log('check_deletion_discussion_page: ' + CeL.wiki.title_link_of(section.section_title.link[0]) + ' ' + section.section_title[0] + ': ' + text_of_result);
			return;
		}

		CeL.error('check_deletion_discussion_page: ' + CeL.wiki.title_link_of(section.section_title.link[0]) + ' 無法解析出欲刪除之頁面標題: ' + section_title_text);
		//console.log({ title, flags });
		//console.log(section.section_title);
	}
	parsed.each_section(for_each_section, {
		// Wikipedia:頁面存廢討論/記錄/2008/10/11
		// Wikipedia:頁面存廢討論/記錄/2018/06/26
		level_filter: [2, 3, 4]
	});
	page_list = page_list.unique();
	if (false) {
		CeL.info(CeL.wiki.title_link_of(page_data) + ': ' + page_list.length + ' discussions.');
		console.log(page_list);
	}

	flags_of_page[KEY_page_list] = page_list;
	// console.log(page_list);

	// console.log(page_data.title);
	const matched = page_data.title.match(/\/(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
	const JDN = CeL.Julian_day.from_YMD(matched[1], matched[2], matched[3]);
	await wiki.for_each_page(page_list, check_deletion_page.bind(flags_of_page, JDN), {
		// no warning like "wiki_API.work: 取得 10/11 個頁面，應有 1 個重複頁面。"
		no_warning: true,
		page_options: {
			redirects: true,
			prop: ''
		}
	});
	//console.log(pages_to_modify);

	if (pages_to_modify[0]) {
		CeL.warn('pages_to_modify[0] setted @ ' + CeL.wiki.title_link_of(page_data));
		console.log(pages_to_modify[0]);
		throw new Error(page_data.title);
	}
}

// ----------------------------------------------------------------------------

async function main_process() {
	// const page_data = await wiki.page(notification_template);
	// console.log(page_data.wikitext);

	CeL.info('Get pages embeddedin ' + CeL.wiki.title_link_of(notification_template) + '...');
	let page_list = await wiki.embeddedin(notification_template);
	await page_list.each((page_data) => CeL.wiki.template_functions.Old_vfd_multi.parse(page_data, for_each_vfd_template));
	// console.log(deletion_flags_of_page);

	// ----------------------------------------------------

	CeL.info('Get all archived deletion discussions...');
	const vfd_page_list = [];
	//if (typeof end_date === 'string') end_date = end_date.to_Date();
	for (let date = new Date(start_date); date - end_date < 0; date.setDate(date.getDate() + 1)) {
		// await check_deletion_page_of_date(JDN);
		vfd_page_list.push(date.format('Wikipedia:頁面存廢討論/記錄/%Y/%2m/%2d'));
	}
	// console.log(vfd_page_list);

	await wiki.for_each_page(vfd_page_list, check_deletion_discussion_page);

	// ----------------------------------------------------

	CeL.info('Check ' + Object.keys(pages_to_modify).length + ' pages if need modify...');
	//console.log(pages_to_modify);
	CeL.write_file('historical_deletion_remindation.pages_to_modify.json', pages_to_modify);

	for (let [page_title, discussions] of Object.entries(pages_to_modify)) {
		// TODO: check if the main page does not exist.
		const namespace = page_title.match(/^([^:]+):/);
		if (!namespace) {
			page_title = 'Talk:' + page_title;
		} else if (/ talk$/.test(namespace[1])) {
			CeL.log('Modify talk page: ' + page_title);
		} else {
			page_title = 'Talk:' + page_title;
		}
		discussions.forEach((discussion) => {
			// 清除不需要的屬性。
			delete discussion.JDN;
		});

		CeL.info('Edit ' + CeL.wiki.title_link_of(page_title));
		console.log(discussions);
		const page_data = await wiki.page(page_title);
		console.log(CeL.wiki.template_functions.Old_vfd_multi.replace_by(page_data, discussions));
		return;

		await wiki.edit_page(page_title, (page_data) =>
			CeL.wiki.template_functions.Old_vfd_multi.replace_by(page_data, discussions)
		);
	}

	CeL.info((new Date).format() + '	' + Object.keys(pages_to_modify).length + ' pages done.');
}

(async () => {
	await wiki.login(user_name, user_password, use_language);
	// await wiki.login(null, null, use_language);
	await main_process();
})();
