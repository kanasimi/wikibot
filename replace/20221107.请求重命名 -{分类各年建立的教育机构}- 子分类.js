'use strict';

/*
2022/11/8 17:7:2	初版試營運。

*/

// Load replace tools.
const replace_tool = require('./replace_tool.js');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// ----------------------------------------------------------------------------

(async () => {
	//login_options.API_URL = 'zh';
	//console.trace(login_options);
	await wiki.login(login_options);

	const task_configuration = Object.create(null);
	let move_from_link_list = [];
	// TODO: use wiki.category_tree()
	async function load_meta_category(category_title, depth) {
		category_title = wiki.to_namespace(category_title, 'Category');
		CeL.log_temporary(category_title);
		for (let category_data of await wiki.categorymembers(category_title)) {
			const category_title = category_data.title;
			if (/創建|创建/.test(category_title))
				move_from_link_list.push(category_title);
			if (depth > 0)
				await load_meta_category(category_title, depth - 1);
		}
	}
	await load_meta_category('各年建立的教育機構');
	// Category:各世紀建立的教育機構，其下級的分類中也有一些需要移動
	await load_meta_category('各世紀建立的教育機構', 2);
	//move_from_link_list = ['Category:1810年創建的教育機構'];

	let move_from_link_TW = await wiki.convert_Chinese(move_from_link_list, { uselang: 'zh-hant' });
	let move_from_link_CN = await wiki.convert_Chinese(move_from_link_list, { uselang: 'zh-hans' });
	let move_to_link_list = await wiki.convert_Chinese(move_from_link_list.map(category_title => {
		return category_title.replace(/創建|创建/g, '建立');
	}), { uselang: 'zh-hant' });

	//console.trace({ move_from_link_list, move_to_link_list });
	const move_to_link = Object.create(null);
	move_from_link_list.forEach((from, index) => {
		const move_to_link = move_to_link_list[index];
		const TW = wiki.remove_namespace(move_from_link_TW[index]), CN = wiki.remove_namespace(move_from_link_CN[index]);
		task_configuration[from] = {
			do_move_page: { noredirect: 1, },
			move_to_link,
			replace_text_pattern: `/(?:${TW}|${CN})/${wiki.remove_namespace(move_to_link)}/g`,
			//replace_text_pattern: new RegExp('(?:' + TW + '|' + CN + ')', 'g'),
			//replace_text: { [TW]: wiki.remove_namespace(move_to_link), [CN]: wiki.remove_namespace(move_to_link), }
		};
	});
	// free
	move_from_link_list = move_to_link_list = move_from_link_TW = move_from_link_CN = null;
	//console.trace(task_configuration);

	await replace_tool.replace({
		//language: 'zh',
		wiki,
		//namespace: '*',
	}, task_configuration);
})();
