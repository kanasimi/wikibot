// cd /d D:\USB\cgi-bin\program\wiki && node 20190215.clean_overcategorization.js

/*

 2019/2/19	初版試營運

 TODO: {{CatCat}}, {{MetaCat}}, {{CatDiffuse}}

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'commons');

// ---------------------------------------------------------------------//
// main

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
// prepare_directory(base_directory);

// CeL.set_debug(6);

wiki.cache({
	// 檢查含有{{Template:Categorise}}之 Category: 頁面。
	type : 'embeddedin',
	reget : true,
	list : 'Template:Categorise',
	namespace : 'Category',
	cache : false
}, function(base_category_list) {
	// 指定 category
	// base_category_list = [ 'Category:Cultural heritage monuments in Italy' ];

	// 因為每一個包含入{{Categorise}}基礎模板的處理量太大，只好採用序列方式執行。
	base_category_list.run_async(for_each_base_category, finish);

}, {
	// default options === this
	// cache path prefix
	prefix : base_directory
});

// ---------------------------------------------------------------------//

function for_each_base_category(run_next_base_category, base_category, index,
		base_category_list) {
	CeL.info('Process base category ' + (index + 1) + '/'
			+ base_category_list.length + ': '
			+ CeL.wiki.title_link_of(base_category));

	wiki.cache({
		// get Subcategories
		type : 'categorymembers',
		reget : true,
		list : base_category,
		namespace : 'Category|File',
		cache : false
	}, function(categorymember_list) {
		// CeL.log('Get ' + categorymember_list.length + ' item(s).');
		for_base_categorymember_list(categorymember_list, base_category,
		//
		run_next_base_category);
	}, {
		// cache path prefix
		prefix : base_directory
	});
}

// ---------------------------------------------------------------------//

// return NOT sub category
function add_sub_category(page_data, sub_category_list, parent_category) {
	if (page_data.ns !== CeL.wiki.namespace('Category')) {
		// assert: [[File:...]]
		return true;
	}

	var title = CeL.wiki.title_of(page_data);
	// without known IDs, with known IDs
	if (title.includes(' with known ') || title.includes(' without known ')
			|| title.includes(' needing categories')
			|| title.includes(' uploaded from ')
			|| title.includes(' uploaded by ')) {
		// Skip 跳過指示性 category
		return;
	}

	if (!(title in sub_category_list.hash)) {
		// add new sub category
		sub_category_list.hash[title] = parent_category;
		sub_category_list.push(title);
	}
}

function for_base_categorymember_list(categorymember_list, base_category,
		run_next_base_category) {
	// console.log(categorymember_list);
	var base_category_pageid_hash = CeL.null_Object(), sub_category_list = [];
	sub_category_list.hash = CeL.null_Object();
	categorymember_list.forEach(function(page_data) {
		if (add_sub_category(page_data, sub_category_list, base_category))
			base_category_pageid_hash[page_data.pageid] = null;
	});

	traversal_each_sub_categories(sub_category_list, base_category_pageid_hash,
	// base_category === categorymember_list.query_title
	base_category, run_next_base_category);
}

// ---------------------------------------------------------------------//

function traversal_each_sub_categories(sub_category_list,
		base_category_pageid_hash, base_category, run_next_base_category) {
	if (sub_category_list.length === 0) {
		// done.
		run_next_base_category();
		return;
	}

	// get next sub category
	var sub_category = sub_category_list.shift();
	var parent_category = sub_category_list.hash[sub_category];

	wiki.cache({
		type : 'categorymembers',
		reget : true,
		list : sub_category,
		namespace : 'Category|File',
		cache : false
	}, function(list) {
		// CeL.log('Get ' + list.length + ' item(s).');
		list.run_async(function(run_next, page_data, index) {
			if (add_sub_category(page_data, sub_category_list, sub_category)
					&& (page_data.pageid in base_category_pageid_hash)) {
				// 注銷登記
				delete base_category_pageid_hash[page_data.pageid];
				clean_overcategorization_pages(run_next, page_data,
						base_category, sub_category, sub_category_list);
			} else
				run_next();
		}, function() {
			// check next sub_category
			traversal_each_sub_categories(sub_category_list,
					base_category_pageid_hash, base_category,
					run_next_base_category);
		});
	}, {
		// cache path prefix
		prefix : base_directory
	});
}

// ---------------------------------------------------------------------//

function clean_overcategorization_pages(run_next, page_data, base_category,
		parent_category, sub_category_list) {
	// console.log([ base_category, parent_category ]);
	var category = parent_category, hierarchy = [],
	// remove prefix "Category:"
	base_category_name = CeL.wiki.title_of(base_category)
			.replace(/^[^:]+:/, '');
	while (category) {
		hierarchy.unshift(CeL.wiki.title_link_of(category));
		// assert: base_category in sub_category_list.hash === false
		category = sub_category_list.hash[category];
	}
	hierarchy = hierarchy.join('←');
	// console.log(CeL.wiki.PATTERN_category);
	// console.log(hierarchy);

	wiki.page(page_data).edit(function(page_data) {
		/** {String}page title = page_data.title */
		var title = CeL.wiki.title_of(page_data),
		/**
		 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
		 */
		content = CeL.wiki.content_of(page_data);

		if (!content) {
			CeL.error('No contents: ' + CeL.wiki.title_link_of(page_data)
			// or: 此頁面不存在/已刪除。
			+ '! 沒有頁面內容！');
			return;
		}

		var replaced = false;
		content = content.replace(CeL.wiki.PATTERN_category,
		//
		function(all_category_text, category_name, sort_order, post_space) {
			if (false) {
				console.log([ base_category, all_category_text,
				//
				category_name, sort_order, post_space ]);
			}
			if (CeL.wiki.normalize_title(category_name)
			//
			=== base_category_name) {
				replaced = true;
				return '';
			}
			return all_category_text;
		});

		if (!replaced) {
			CeL.error('Did not replaced '
			//
			+ CeL.wiki.title_link_of(base_category) + ': '
			//
			+ CeL.wiki.title_link_of(page_data));
		}

		return content;
	}, {
		summary : '[[Commons:Bots/Requests/Cewbot 6'
		//
		+ '|Claen overcategorization]]: ' + hierarchy,
		nocreate : 1,
		bot : 1,
		minor : 1
	}).run(run_next);
}

// ---------------------------------------------------------------------//

function finish() {
	CeL.info('All ' + base_category_list.length + ' categories done.');
}
