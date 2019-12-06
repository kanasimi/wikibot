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

const FLAG_CHECKED = 'OK', FLAG_TO_ADD = 'need add', FLAG_TO_REMOVE = 'not found', FLAG_DUPLICATED = 'duplicated';
// deletion_of_date[page_title]
// = [ {date:'',result:'',...,bot_checked:''}, ... ]
const deletion_of_date = Object.create(null);
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
	if (!deletion_of_date[page_title])
		deletion_of_date[page_title] = [];

	if (!Array.isArray(item)) {
		item = [item];
	}

	item.forEach(function (discussion) {
		if (discussion.date)
			discussion.JDN = CeL.Julian_day(discussion.date.to_Date());
	});

	deletion_of_date[page_title].append(item);
}

async function check_deletion_page(JDN, page_data) {
	if ('missing' in page_data) {
		// The page is not exist now.
		return;
	}

	// CeL.info(CeL.wiki.title_link_of(page_data));
	if (false) {
		// NG: Check the talk page
		const page_title = page_data.title.replace(/:/, ' talk:');
		page_data = await wiki.page(page_title);
		CeL.wiki.template_functions.Old_vfd_multi.parse(page_data, function (item) {
			;
		});
	}

	const page_title = page_data.original_title || page_data.title;
	// assert: 同頁面在同一天內僅存在單一討論。
	const result_of_page = this;
	let result = result_of_page[page_title], target;
	if (page_title === '學士後')
		console.log(result_of_page);
	if (!result && (result = result_of_page[KEY_page_list].convert_from[page_title])) {
		result = result_of_page[result];
	}
	if (!result) {
		CeL.error('check_deletion_page: Failed to get result_of_page: ' + JSON.stringify(page_title));
		console.log(result_of_page);
	}
	if (result.result) {
		target = result.target;
		result = result.result;
	}
	if (result === 'r' && page_data.redirect_from === page_title) {
		// 不處理重定向來源已經過重定向的情況。
		// return;
	}

	const text_of_result = CeL.wiki.template_functions.Old_vfd_multi.text_of(result, true);

	const discussions = deletion_of_date[page_data.title] || pages_to_modify[page_data.title] || (deletion_of_date[page_data.title] = []);
	let bingo, need_modify;
	discussions.forEach(function (discussion) {
		if (discussion.JDN !== JDN)
			return;
		if (bingo) {
			need_modify = true;
			discussion.bot_checked = FLAG_DUPLICATED;
			return;
		}

		bingo = true;
		if (discussion.page !== page_title) {
			discussion.page = page_title;
			need_modify = true;
		}

		if (discussion.hat_result !== result) {
			discussion.hat_result = result;
			if (discussion.result !== result && discussion.result !== text_of_result) {
				discussion.result = text_of_result;
				need_modify = true;
			}
		}
		if (discussion.target !== target) {
			discussion.target = target;
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
			hat_result: result,
			// bot_checked : FLAG_CHECKED,
			JDN: JDN
		});
	}

	if (need_modify && deletion_of_date[page_data.title]) {
		delete deletion_of_date[page_data.title];
		pages_to_modify[page_data.title] = discussions;
	}
}

const Hat_names = CeL.wiki.template_functions.Hat.names;
const KEY_title = Symbol('title');
const KEY_page_list = Symbol('page list');

async function check_deletion_discussion_page(page_data) {
	// console.log(page_data.wikitext);
	const parsed = page_data.parse();
	let page_list = [];
	const result_of_page = Object.create(null);
	result_of_page[KEY_title] = page_data.title;
	function add_page(title, flags) {
		if (!title)
			return;
		title = title.toString().replace(/^:+/, '').trim();
		result_of_page[title] = flags;
		page_list.push(title);
	}

	function for_each_section(section, index) {
		if (index === 0) {
			// Skip the first section
			return;
		}

		let result, target;
		section.each('template', function (token) {
			// {{Talkendh|處理結果}}
			if (token.name in Hat_names) {
				result = token.parameters[1];
				if (result) {
					target = token.parameters[2];
				}
				return parsed.exit;
			}
		});

		if (!result) {
			// Skip non-discussions
			return;
		}

		const flags = target ? { result, target } : result;

		let title;
		if (section.section_title.some((token) => {
			if (typeof token === 'string') {
				// 這會順便忽略 "-->", "->"
				return /[^,;.'"\s→、\/\->「」『』…]/.test(token);
			}
			if (token.tag === 's' || token.tag === 'del')
				return false;
			return title = token;
		}) && title && title.is_link) {
			// e.g., [[Wikipedia:頁面存廢討論/記錄/2008/08/12]]
			if (!title[0].toString().startsWith('Wikipedia:頁面存廢討論/'))
				add_page(title[0], flags);
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
		if (for_Al(title)) return;

		if (title && title.converted) {
			if (title.converted.is_link) {
				// "====-{[[迪奥尼日·波尼亚托夫斯基]]}-===="
				add_page(title.converted[0], flags);
				return;
			}
			if (Array.isArray(title.converted)
				//== -{ {{al|Template:東鐵綫未來發展車站列表|Template:南北線車站列表|Template:南北綫車站列表}} }- ==
				&& title.converted.some(for_Al)) {
				return;
			}
		}

		// 30天仍排上 {{fame}} 或 {{importance}} 模板的條目
		// 30天仍掛上 {{tl|fame}} 或 {{tl|notability}} 模板的[[WP:NOTE|條目]]
		// 30天仍掛上 {{tl|Substub}}、{{tl|小小作品}} 或 {{tl|小小條目}} 模板的[[WP:NOTE|條目]]
		// 30天后仍掛有{{tl|notability}}模板的條目 30天后仍掛有{{tl|notability}}模板的條目
		// 過期小小作品 到期篩選的小小作品 台灣學校相關模板 一堆模板-5 又一堆模板 再一堆模板
		if (//section.section_title.level <= 4 &&
			/天[後后]?仍[排掛][有上]|[過到]期.*作品|相關模板|一堆模板/.test(section.section_title)) {
			return;
		}

		// 去掉無效請求，或最終保留的：無傷大雅。
		if ((result.toString().trim().toLowerCase() in { cc: true, ir: true, rr: true, rep: true, k: true, sk: true, os: true })
			// e.g., 提刪者撤回 提請者收回 請求無效 無效提名 重複提出，無效 全部重複／未到期，請求無效 提案者重复提出，请求失效。见下。
			|| /[撤收]回|[無无失]效|未到期/.test(result)) {
			return;
		}

		const text_of_result = CeL.wiki.template_functions.Old_vfd_multi.text_of(result);
		if (text_of_result.includes('')) {
			;
		}

		if (section.section_title.length === 1 && typeof section.section_title[0] === 'string') {
			CeL.log('check_deletion_discussion_page: ' + CeL.wiki.title_link_of(section.section_title.link[0]) + ' ' + section.section_title[0] + ': ' + text_of_result);
			return;
		}

		CeL.error('check_deletion_discussion_page: 無法解析出欲刪除之頁面標題: ' + section.section_title);
		console.log({ title, flags });
		console.log(section.section_title);
	}
	parsed.each_section(for_each_section, {
		// Wikipedia:頁面存廢討論/記錄/2008/10/11
		// Wikipedia:頁面存廢討論/記錄/2018/06/26
		level_filter: [2, 3, 4]
	});
	if (false) {
		CeL.info(CeL.wiki.title_link_of(page_data) + ': ' + page_list.length + ' discussions.');
		console.log(page_list);
	}

	page_list = await wiki.page(page_list, {
		redirects: true,
		multi: true,
		no_warn: true,
		prop: ''
	});
	result_of_page[KEY_page_list] = page_list;
	// console.log(page_list);

	// console.log(page_data.title);
	const matched = page_data.title.match(/\/(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
	const JDN = CeL.Julian_day.from_YMD(matched[1], matched[2], matched[3]);
	await Promise.all(
		page_list.map(check_deletion_page.bind(result_of_page, JDN)));
}

// ----------------------------------------------------------------------------

async function main_process() {
	// const page_data = await wiki.page(notification_template);
	// console.log(page_data.wikitext);

	const page_list = await wiki.embeddedin(notification_template);
	await page_list.each((page_data) => CeL.wiki.template_functions.Old_vfd_multi.parse(page_data, for_each_vfd_template));
	// console.log(deletion_of_date);

	// ----------------------------------------------------

	const vfd_page_list = [];
	const date_end = Date.now();
	for (let date = new Date(start_date); date - date_end < 0; date.setDate(date.getDate() + 1)) {
		// await check_deletion_page_of_date(JDN);
		vfd_page_list.push(date.format('Wikipedia:頁面存廢討論/記錄/%Y/%2m/%2d'));
	}
	// console.log(vfd_page_list);

	await wiki.for_each_page(vfd_page_list, check_deletion_discussion_page, {
		no_edit: true
	});

	// ----------------------------------------------------

	CeL.info(Object.keys(pages_to_modify).length + ' pages to modify...');

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
		discussions.forEach((discussion) => { delete discussion.JDN; });
		CeL.info('Edit ' + CeL.wiki.title_link_of(page_title));
		console.log(discussions);
		return;
		await wiki.edit_page(page_title, (page_data) =>
			CeL.wiki.template_functions.Old_vfd_multi.replace_by(page_data, discussions)
		);
	}

	CeL.info('Done.');
}

(async () => {
	await wiki.login(user_name, user_password, use_language);
	// await wiki.login(null, null, use_language);
	await main_process();
})();
