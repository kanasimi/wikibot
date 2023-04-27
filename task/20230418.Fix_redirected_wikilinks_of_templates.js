/*
node 20230418.Fix_redirected_wikilinks_of_templates.js

這個任務會清理導航模板的重導向內部連結。

2023/4/18 6:49:54	初版試營運

*/

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Load modules.
CeL.run('data.CSV');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('zh');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

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

	//

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
	const FF0D_template_list = await get_FF0D_template_list();
	console.log(`${FF0D_template_list.size} FF0D templates to process.`);

	if (false)
		await wiki.for_each_page(FF0D_template_list, for_each_FF0D_template, {
			summary: '[[Special:PermanentLink/76925397#需要進行之善後措施|​因應格式手冊修改]]，[[Wikipedia:格式手册/标点符号#连接号|連接號]]改用 em dash: ',
		});

	await wiki.for_each_page(FF0D_template_list
		//&& [ 'Template:US military navbox' ]
		//&& [ 'Template:中华人民共和国国家级风景名胜区' ]
		//&& ['Template:云南历史']
		//&& ['Template:台灣地景']
		//&& ['Template:文革编年史']
		, for_each_template, {
		summary: '轉換[[Wikipedia:格式手册/链接#模板中的内部链接|模板中的內部連結]]為目標頁面標題: ',
	});
	return;

	await wiki.allpages({
		namespace: 'template',
		for_each_slice: async function (page_list) {
			//console.trace(page_list);
			//console.trace(page_list.slice(0, 10));
			//return CeL.wiki.list.exit;

			//CeL.set_debug();
			await wiki.for_each_page(page_list, for_each_template, {
				page_options: {
					// TODO:
					//prop: 'revisions|links',
					// OK:
					//prop: 'revisions',
					pllimit: 'max'
				},
				summary: '轉換[[Wikipedia:格式手册/链接#模板中的内部链接|模板中的內部連結]]為目標頁面標題: ',
			});
		}
	});

}


async function get_FF0D_template_list() {
	// https://quarry.wmcloud.org/query/72263
	const items = CeL.parse_CSV(await (await fetch('https://quarry.wmcloud.org/run/725605/output/0/tsv')).text(), { has_title: true, skip_title: true });
	//console.log(items);

	const template_list = new Set;
	for (const item of items) {
		template_list.add(item[0]);
	}

	return template_list;
}

async function for_each_FF0D_template(template_page_data) {
	//console.log(template_page_data);

	const parsed = CeL.wiki.parser(template_page_data).parse();

	/**	link from → redirect target */
	const convert_map = new Map;

	parsed.each('link', link_token => {
		const link_title = link_token[0].toString();
		// U+FF0D: '－'
		if (!link_title.includes('\uFF0D'))
			return;

		// TODO: 檢測重新導向標的
		const redirects_title = link_title.replace(/\uFF0D/g, '—');
		link_token[0] = redirects_title;
		convert_map.set(link_title, redirects_title);
	});

	// TODO: 多語言模板也需要處理

	if (convert_map.size === 0)
		return Wikiapi.skip_edit;

	this.summary += Array.from(convert_map).map(pair => CeL.wiki.title_link_of(pair[0]) + '→' + CeL.wiki.title_link_of(pair[1])).join(', ');
	return parsed.toString();
}


function get_converted_title(link_title, redirected_targets) {
	const converted = redirected_targets.original_result.converted;
	if (!converted)
		return link_title;
	//console.trace(link_title);

	for (const data of converted) {
		if (data.from === link_title) {
			//console.trace(data);
			return data.to;
		}
	}

	return link_title;
}

async function for_each_template(template_page_data) {
	//console.trace(template_page_data);
	//console.trace('>> ' + template_page_data.title);

	const parsed = CeL.wiki.parser(template_page_data).parse();
	const link_list = [], link_token_list = [];
	parsed.each('link', link_token => {
		link_list.push(link_token[0].toString());
		link_token_list.push(link_token);
	});

	if (link_list.length === 0) {
		// No link found.
		return Wikiapi.skip_edit;
	}

	const redirected_targets = await wiki.redirects_root(link_list, {
		multi: true,
	});
	//console.trace(redirected_targets.original_result);
	//console.trace(redirected_targets.original_result.redirects);
	if (!redirected_targets.original_result.redirect_from) {
		// There is no redirects in the link_list.
		return Wikiapi.skip_edit;
	}
	// assert: typeof redirected_targets.original_result.redirect_from === 'object'

	const convert_map = new Map;
	if (redirected_targets.length !== link_list.length) {
		// 有重複的標題?
		console.error([link_list, redirected_targets]);
		throw new Error('取得長度不同@' + template_page_data.title);
	}
	for (let index = 0; index < link_list.length; index++) {
		const link_title = link_list[index];
		const redirected_target = redirected_targets[index];
		const matched = redirected_target.match(/^([^#]+)(#.+)$/);
		if (!redirected_targets.original_result.redirect_from[matched ? matched[1] : redirected_target]) {
			// e.g., 繁簡轉換標題。
			continue;
		}
		// 不論命名空間以及空白底線的差異。
		if (wiki.normalize_title(link_title) === wiki.normalize_title(redirected_target))
			continue;

		if (redirected_target.charAt(0) !== link_title.charAt(0)
			// e.g., iMac
			&& redirected_target.charAt(0) === link_title.charAt(0).toUpperCase()) {
			redirected_target = link_title.charAt(0) + redirected_target.slice(1);
		}

		CeL.log(`${for_each_template.name}: ${link_title}\t→${redirected_target}`);
		convert_map.set(link_title, redirected_target);

		const link_token = link_token_list[index];
		if (wiki.is_namespace(redirected_target, 'File') || wiki.is_namespace(redirected_target, 'Category'))
			redirected_target = ':' + redirected_target;
		if (link_token[2]) {
			;
		} else if (
			// 轉換後長度增加太多時才保留原標題為展示文字。
			redirected_target.length - link_title.length > 4
			// e.g. [[Title 1]]→[[Title 2 (type)]]
			|| !/ \([^()]+\)$/.test(link_title) && / \([^()]+\)$/.test(matched ? matched[1] : redirected_target)

			// e.g. [[媧皇宮]]應替換為[[娲皇宫及石刻|媧皇宮]]
			|| redirected_target.length > link_title.length && (redirected_target.includes(link_title)
				// e.g. [[媧皇宮]]應替換為[[娲皇宫及石刻|媧皇宮]]
				|| redirected_target.includes(get_converted_title(link_title, redirected_targets)))

		) {
			//console.trace(link_title);
			// preserve display text
			link_token[2] = link_title;
		}

		// TODO: 保留命名空間之類格式
		if (!matched) {
			link_token[0] = redirected_target;
		} else if (link_token[1].toString()) {
			CeL.error(`${for_each_template.name}: ${link_token}本身已包含網頁錨點，無法改成${CeL.wiki.title_link_of(redirected_target)}`);
		} else {
			if (!link_token[2]) {
				// 保留原標題為展示文字。
				// e.g. [[九九峰自然保留區]]→[[九九峰#九九峰自然保留區|九九峰自然保留區]]
				link_token[2] = link_title;
			}
			link_token[0] = matched[1];
			link_token[1] = matched[2];
		}

		if (!link_token[1] && link_token[2]
			// using wiki.normalize_title()?
			// TODO: [[IMac|iMac]]→[[iMac]], [[IMac#ABC|iMac]]→no change
			&& link_token[0].toString() === link_token[2].toString()) {
			// assert: link_token.length === 2
			link_token.pop();
		}
		//console.trace(link_token.toString(), link_token);
	}

	if (convert_map.size === 0)
		return Wikiapi.skip_edit;

	this.summary += Array.from(convert_map).map(pair => CeL.wiki.title_link_of(pair[0]) + '→' + CeL.wiki.title_link_of(pair[1])).join(', ');
	return parsed.toString();
}
