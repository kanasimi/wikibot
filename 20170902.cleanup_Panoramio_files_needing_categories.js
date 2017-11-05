/*

Cleanup Panoramio files needing categories
https://commons.wikimedia.org/wiki/Commons:Bots/Requests/Cewbot_4

2017/9/2 16:4:57	初版試營運。
2017/10/1 20:46:50	完成。正式運用。

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
// [[Commons:Bots/Requests/Cewbot 4|bot test]]:
// Remove "needing categories" category which is already including category.
default_summary = 'bot: Remove "needing categories" which has ',
//
edit_options = {
	bot : 1,
	minor : 1,
	nocreate : 1
},
// Mark all subcategories as {{Hiddencat}}
mark_HIDDENCAT = false;

get_files_of_category('Photos from Panoramio needing categories by date');

function get_files_of_category(category, callback) {
	wiki.categorymembers(category, function(list) {
		CeL.debug('All ' + list.length + ' pages get from '
		//
		+ CeL.wiki.title_link_of(category), 1, 'get_files_of_category');
		list.run_async(function(run_next, page) {
			if (page.ns === CeL.wiki.namespace.hash.category) {
				// Search all sub-categories.
				get_files_of_category(page, run_next);
				if (mark_HIDDENCAT) {
					wiki.page(page).edit(function(page_data) {
						var content = CeL.wiki.content_of(page_data);
						if (!content || content.includes('__HIDDENCAT__')
						//
						|| /{{ *Hiddencat/i.test(content)) {
							return [ CeL.wiki.edit.cancel, 'skip' ];
						}
						return content + '\n{{Hiddencat}}';
					}, Object.assign({
						summary : 'Mark all subcategories of ' + category
						//
						+ ' as {{Hiddencat}}'
					}, edit_options));
				}

			} else if (page.ns === CeL.wiki.namespace.hash.file) {
				if (mark_HIDDENCAT) {
					setTimeout(run_next, 0);
					return;
				}
				CeL.debug('處理頁面 ' + CeL.wiki.title_link_of(page), 1,
						'get_files_of_category');
				wiki.page(page, for_file.bind({
					run_next : run_next
				}), page_options);

			} else {
				CeL.log('Skip ' + CeL.wiki.title_link_of(page));
			}
		}, callback);
	}, {
		// limit : 5
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
		this.run_next();
		return;
		return [ CeL.wiki.edit.cancel,
		//
		'No contents: [[' + title + ']]! 沒有頁面內容！' ];
	}

	var revision = CeL.wiki.content_of.revision(page_data), user = revision.user;
	if (('bot' in revision) || CeL.wiki.PATTERN_BOT_NAME.test(user)) {
		// Untouched. e.g., 'Panoramio upload bot'
		this.run_next();
		return;
		return [ CeL.wiki.edit.cancel, 'skip' ];
	}

	var categories = [], categories_to_check = [], needing_categories = [],
	//
	parser = CeL.wiki.parser(content).parse();
	if (content !== parser.toString()) {
		// debug 用. check parser, test if parser working properly.
		console.log(CeL.LCS(content, parser.toString(), 'diff'));
		throw 'Parser error: ' + CeL.wiki.title_link_of(page_data);
	}

	parser.each('category', function(category, index) {
		if (category.name.includes('needing categories')) {
			if (category.name.includes(
			/**
			 * <code>
			remove "Category:Photos from Panoramio needing categories as of 2017-XX-XX"
			but not "Category:Photos from Panoramio ID XXXXXX needing categories", "Category:Media needing category review as of XXX"
			</code>
			 */
			'Category:Photos from Panoramio needing categories as of')) {
				needing_categories.push(category);
			}
		} else if (!/Panoramio|Unidentified|Taken with|taken on/i
				.test(category.name)) {
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
		// e.g., [[File:Eerbeek - panoramio.jpg]]
		CeL.debug(CeL.wiki.title_link_of(page_data)
				+ ': needing_categories.length === '
				+ needing_categories.length + ' !== 1');
	}

	function last_check_and_return() {
		if (categories.length === 0) {
			return [ CeL.wiki.edit.cancel, 'skip' ];
		}

		this.summary = default_summary
		//
		+ categories.map(function(category) {
			return category.toString();
		}).join(', ');

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

	if (categories_to_check.length > 0) {
		CeL.info('Checking categories: ' + categories_to_check);
		// Checking each category to exclude __HIDDENCAT__ categories.
		categories_to_check.forEach(function(category) {
			wiki.page('Category:' + category.name, function(category_page) {
				var meaningful = CeL.wiki.content_of(category_page,
						'expandtemplates');
				meaningful = !meaningful
						|| !meaningful.includes('__HIDDENCAT__')
						//
						|| /{{Photographs taken on navbox *\|/
						//
						.test(meaningful);
				// set cache
				meaningful_categories[category.name] = meaningful;
				if (meaningful) {
					categories.push(category);
				}
			}, {
				expandtemplates : true
			});
		});
	}

	wiki.page(page_data).edit(last_check_and_return, edit_options).run(
			this.run_next);
}
