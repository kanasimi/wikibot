/*

Cleanup Panoramio files needing categories
https://commons.wikimedia.org/wiki/Commons:Bots/Requests/Cewbot_4

 2017/9/2 16:4:57	初版試營運。
 	完成。正式運用。

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

/* eslint no-use-before-define: ["error", { "functions": false }] */
/* global CeL */
/* global Wiki */

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'commons');

// ----------------------------------------------------------------------------

var meaningful_categories = CeL.null_Object(),
// https://www.mediawiki.org/w/api.php?action=help&modules=query%2Brevisions
page_options = {
	rvprop : 'timestamp|content|user|flags'
},
//
edit_options = {
	bot : 1,
	minor : 1,
	nocreate : 1,
	summary : '[[Commons:Bots/Requests/Cewbot 4|bot test]]: Remove "needing categories" category which is already including category.'
};

get_files_of_category('Photos from Panoramio needing categories by date',
		for_file);

function get_files_of_category(category, for_file) {
	wiki.categorymembers(category, function(list) {
		list.forEach(function(page) {
			if (page.ns === CeL.wiki.namespace.hash.category) {
				// Search all sub-categories.
				get_files_of_category(page, for_file);
			} else if (page.ns === CeL.wiki.namespace.hash.file) {
				wiki.page(page, page_options).edit(for_file, edit_options);
			} else {
				CeL.log('Skip ' + CeL.wiki.title_link_of(page));
			}
		});
	}, {
		limit : 'max'
	});
}

function for_file(page_data, error) {
	/** {String}page title = page_data.title */
	var title = CeL.wiki.title_of(page_data),
	/**
	 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
	 */
	content = CeL.wiki.content_of(page_data);

	if (!content) {
		return [ CeL.wiki.edit.cancel,
		//
		'No contents: [[' + title + ']]! 沒有頁面內容！' ];
	}

	var revision = CeL.wiki.content_of.revision(page_data), user = revision.user;
	if (('bot' in revision) || /bot/i.test(user)) {
		// Untouched. e.g., 'Panoramio upload bot'
		return [ CeL.wiki.edit.cancel, 'skip' ];
	}

	var categories = [], categories_to_check = [], needing_categories = [],
	//
	parser = CeL.wiki.parser(content).parse();
	if (content !== parser.toString()) {
		// debug 用. check parser, test if parser working properly.
		throw 'Parser error: ' + CeL.wiki.title_link_of(page_data);
	}

	parser.each('category', function(category, index) {
		if (category.name.includes('needing categories')) {
			needing_categories.push(category);
		} else if (!/Panoramio|Unidentified|Taken with/i.test(category.name)) {
			// exclude categories marked with __HIDDENCAT__
			if (category.name in meaningful_categories) {
				if (meaningful_categories[category.name]) {
					// 剩下有許多是標示地點的分類
					categories.push(category);
				}
			} else {
				categories_to_check.push(category);
			}
		} else if (category.toString().includes('Panoramio_upload_bot')) {
			category.parent[index] = category.toString().replace(/_/g, ' ');
		}
	}, {
		add_index : true
	});

	if (needing_categories.length !== 1) {
		throw title + ': needing_categories.length !== 1';
	}

	function last_check_and_return() {
		if (categories.length === 0) {
			return [ CeL.wiki.edit.cancel, 'skip' ];
		}

		if (false) {
			CeL.info(CeL.wiki.title_link_of(page_data) + ': ' + user);
			console.log(categories.map(function(category) {
				return category.name;
			}));
		}

		// console.log(needing_categories);
		needing_categories.forEach(function(category) {
			if (category.parent[category.index] !== category) {
				throw title + ': parent.index !== category';
			}
			var parent = category.parent, index = category.index;
			// Remove category
			parent[index] = '';
			// Remove space after category
			while (/^[\s\n]+$/.test(parent[++index])) {
				parent[index] = '';
			}
		});

		// return [ CeL.wiki.edit.cancel, 'skip' ];
		return parser.toString();
	}

	if (categories_to_check.length === 0) {
		return last_check_and_return();
	}

	// Checking each category to exclude __HIDDENCAT__ categories.
	categories_to_check.forEach(function(category) {
		wiki.page(category.name, function(category_page) {
			var meaningful = CeL.wiki.content_of(category_page);
			meaningful = !meaningful || !meaningful.includes('__HIDDENCAT__');
			// set cache
			meaningful_categories[category.name] = meaningful;
			if (meaningful) {
				categories.push(category);
			}
		});
	});
	wiki.page(page_data).edit(last_check_and_return);
	return [ CeL.wiki.edit.cancel, 'skip' ];
}
