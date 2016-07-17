// (cd ~/wikibot && date && hostname && nohup time node 20160714.archive_news.js; date) >> archive_news/log &

/*

 2016/7/17 14:35:38	正式營運，轉成常態性運行作業。

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');
// for CeL.get_set_complement()
CeL.run('data.math');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'wikinews'),

// ((Infinity)) for do all
test_limit = 1,
// 為了維護頁面的歷史紀錄不被更動，因此不建Category寫入原文章頁面。
write_page = false,

problem_categories_postfix = '的可存檔新聞',

/** {Number}一整天的 time 值。should be 24 * 60 * 60 * 1000 = 86400000. */
ONE_DAY_LENGTH_VALUE = new Date(0, 0, 2) - new Date(0, 0, 1),
/** {Number}未發現之index。 const: 基本上與程式碼設計合一，僅表示名義，不可更改。(=== -1) */
NOT_FOUND = ''.indexOf('_'),

// [[Wikinews:存檔常規]]: 已發表兩週或以上的文章會列入存檔並且可被保護。
time_limit = Date.now() - 14 * ONE_DAY_LENGTH_VALUE,

page_list = [],
// page_status
error_logs = [],

PATTERN_category = /(\[\[ *(?:Category|分類|分类) *:)/i,
//
publish_names, PATTERN_publish_name, PATTERN_publish_template, PATTERN_publish_template_g, PATTERN_publish_before_categories;

log_to = 'Wikinews:管理员通告板/需檢查的可存檔新聞';
summary = '[[WN:ARCHIVE|存檔保護]]作業';

// ----------------------------------------------------------------------------

function check_redirect_to(template_name_hash, callback) {
	var template_name_list = Object.keys(template_name_hash), left = template_name_list.length;
	template_name_list.forEach(function(template_name) {
		wiki.redirect_to(template_name_hash[template_name], function(
				redirect_data, page_data) {
			// console.log(page_data.response.query);
			// console.log(redirect_data);
			CeL.info(template_name + ': ' + template_name_hash[template_name]
					+ ' → ' + redirect_data);
			template_name_hash[template_name] = redirect_data;
			if (--left === 0) {
				callback(template_name_hash);
			}
		});
	});
}

function page_data_to_String(page_data) {
	return page_data.pageid + '|' + page_data.title;
}

function main_work(template_name_redirect_to) {

	CeL.wiki.cache([ {
		type : 'redirects',
		list : template_name_redirect_to.template_publish,
		reget : true,
		operator : function(list) {
			list = list.map(function(page_data) {
				return page_data.title.replace(/^[^:]+:/, '');
			});
			CeL.log('Alias of [['
			//
			+ template_name_redirect_to.template_publish + ']]: ' + list);

			publish_names = CeL.wiki.normalize_title_pattern(list);
			PATTERN_publish_name = new RegExp('^' + publish_names + '\\s*$');
			PATTERN_publish_template = new RegExp('{{\\s*'
			//
			+ publish_names + '\\s*(\\|[^{}]*)?}}');
			PATTERN_publish_template_g
			//
			= new RegExp(PATTERN_publish_template.source, 'g');
			PATTERN_publish_before_categories
			//
			= new RegExp(PATTERN_publish_template.source
			//
			+ '[\\s\\n]*' + PATTERN_category.source, 'i');
		}

	}, {
		type : 'categorymembers',
		list : template_name_redirect_to.published,
		reget : true,
		operator : function(list) {
			this.published = list;
			// this.published = list.map(page_data_to_String);
		}

	}, {
		type : 'categorymembers',
		list : template_name_redirect_to.archived,
		reget : true,
		operator : function(list) {
			this.archived = list;
			// this.archived = list.map(page_data_to_String);
		}

	} ], function() {
		CeL.log(this.archived.length + ' archived, ' + this.published.length
				+ ' published.');
		// 取差集: 從比較小的來處理。
		// get [[:Category:Published]] - [[:Category:Archived]]
		var list = CeL.get_set_complement(this.published, this.archived);

		CeL.log('→ ' + list[1].length + ' archived, ' + list[0].length
				+ ' published left.');

		if (list[1].length) {
			// 依照現在 {{publish}} 的寫法，不應出現此項。
			CeL.err('有' + list[1].length + '個已存檔，但沒有發布之條目！');
		}

		list = list[0];

		// var list = this.list;
		// list = [ '' ];
		CeL.log('Get ' + list.length + ' pages.');
		if (0) {
			CeL.log(list.slice(0, 8).map(function(page_data, index) {
				return index + ': ' + CeL.wiki.title_of(page_data);
			}).join('\n') + '\n...');
			// 設定此初始值，可跳過之前已經處理過的。
			list = list.slice(0 * test_limit, 1 * test_limit);
		}

		wiki.work({
			no_edit : true,
			each : for_each_page_not_archived,
			page_options : {
				rvprop : 'ids|timestamp'
			},
			last : archive_page

		}, list);

	}, {
		// default options === this
		namespace : 0,
		// [SESSION_KEY]
		session : wiki,
		// title_prefix : 'Template:',
		// cache path prefix
		prefix : base_directory
	});

}

function for_each_page_not_archived(page_data) {
	// console.log(page_data);
	CeL.debug('check the articles that are published at least 14 days old. '
			+ '以最後編輯時間後已超過兩周或以上的文章為準。', 3, 'for_each_page_not_archived');
	if (Date.parse(page_data.revisions[0].timestamp) < time_limit) {
		page_list.push(page_data);
	}
}

function archive_page() {
	CeL.log('archive_page: 可存檔 ' + page_list.length + ' 文章。');
	CeL.log('archive_page: {{publish}} pattern: ' + PATTERN_publish_template);
	// console.log(page_list.slice(0, 9));
	var left = page_list.length;
	page_list.forEach(function(page_data) {
		CeL.debug('Get max revisions of [[' + page_data.title + ']].'
				+ ' 以最後編輯時間後已超過兩周或以上的文章為準。', 3, 'for_each_page_not_archived');
		wiki.page(page_data, function(page_data, error) {
			for_each_old_page(page_data, error);
			if (--left === 0) {
				CeL.info('for_each_page_not_archived: Write report: '
						+ error_logs.length + ' lines.');
				error_logs.push('\n[[Category:管理員例行工作]]');
				wiki.page(log_to).edit(error_logs.join('\n'), {
					summary : summary + '報告',
					nocreate : 1,
					bot : 1
				});
			} else {
				CeL.debug(left + ' left', 2, 'for_each_page_not_archived');
			}
		}, {
			rvprop : 'ids|timestamp|content',
			rvlimit : 'max'
		});
	});
}

function for_each_old_page(page_data) {
	// problem categories: 需請管理員檢查的可存檔新聞/文章
	var problem_list = [],
	/**
	 * {String}page content, maybe undefined.
	 */
	contents = CeL.wiki.content_of(page_data), current_content;
	if (!contents) {
		CeL.err('for_each_old_page: [[' + page_data.title + ']]: No content');
		// console.log(page_data);
		return;
	}

	if (typeof contents === 'string') {
		CeL.debug(
		//
		'[[' + page_data.title + ']]: 有1個版本。', 1, 'for_each_old_page');
		// assert: typeof contents === 'string' && contents has
		// {{publish}}
		current_content = contents;

	} else {
		// assert: Array.isArray(contents)
		current_content = contents[0];
		contents = contents.map(function(content) {
			return content.replace(/<nowiki>.*?<\/nowiki>/g, '<nowiki/>')
			// 註解中可能有 {{publish}}!
			.replace(/<!--.*?-->/g, '');
		});

		CeL.debug('[[' + page_data.title + ']]: ' + contents.length + ' 個版本。',
				3, 'for_each_old_page');
		// first revision that has {{publish}}
		var first_has_published = contents.first_matched(
				PATTERN_publish_template, true);

		if (first_has_published === NOT_FOUND) {
			throw '可能存有未設定之{{publish}}別名? [[' + page_data.title + ']]';
		}

		if (first_has_published > 0) {
			// 若非最新版才出現 {{publish}}，則向前尋。
			if (!PATTERN_publish_template.test(contents[first_has_published])
					|| contents[first_has_published + 1]
					&& PATTERN_publish_template
							.test(contents[first_has_published + 1])) {
				// 可能中間有匹配/不匹配交替出現?
				CeL.err(first_has_published + '/' + contents.length + ': ');
				CeL.log(contents[first_has_published]);
				CeL.log('-'.repeat(80));
				if (contents[first_has_published + 1]) {
					CeL.log(contents[first_has_published + 1]);
				}
				throw '出現 {{publish}}';
			}

			// assert: first_has_published >= 0
			var publish_date = Date.parse(
			//
			page_data.revisions[first_has_published].timestamp),
			// 發布時間/發表後2日後不應進行大幅修改。應穩定
			need_stable_date = publish_date + 2 * ONE_DAY_LENGTH_VALUE,
			// 應穩定之index
			need_stable_index = page_data.revisions.search_sorted({
				found : true,
				comparator : function(revision) {
					return need_stable_date - Date.parse(revision.timestamp);
				}
			});

			if (need_stable_index > 0) {
				// 若非最新版=應穩定之index，才向前尋。
				CeL.debug('[[' + page_data.title + ']]: 有多個版本。新聞稿發布時間: '
						+ new Date(publish_date).format('%Y年%m月%d日')
						+ '。檢查大幅修改並列出清單提醒。', 1, 'for_each_old_page');

				// 只檢查首尾字元差距，因為中間的破壞可能被回退了。
				var size = contents[0].length
						- contents[need_stable_index].length, edit_distance;
				if (Math.abs(size) > 300
				// 計算首尾之[[:en:edit distance]]。
				|| (edit_distance = contents[need_stable_index]
				//
				.edit_distance(contents[0])) > 300) {
					// 少很多的，大多是跨語言連結。
					CeL.info('for_each_old_page: [[' + page_data.title
							+ ']]: 發布2日後大幅修改過。');
					problem_list.push('[[Special:Diff/'
							+ page_data.revisions[first_has_published].revid
							+ '|發布]]2日後[[Special:Diff/'
							+ page_data.revisions[need_stable_index].revid
							+ '/'
							+ page_data.revisions[0].revid
							+ '|大幅修改過]]。'
							+ (edit_distance ? '[[w:en:edit distance|編輯距離]]'
									+ edit_distance : (size > 0 ? '多' : '少')
									+ '了' + Math.abs(size) + '字元') + '。');
				}
			}
		}
	}

	current_content = current_content.replace(
			/\[\[ *(?:Category|分類|分类) *(?:: *)?\]\]/ig, '');
	CeL.debug('[[' + page_data.title
			+ ']]: 刪除{{breaking}}、{{expand}}等過時模板，避免困擾。', 2,
			'for_each_old_page');
	current_content = current_content.replace(
			/{{ *(?:breaking|expand)[\s\n]*}}/g, '');

	if (!/{{\s*[Ss]ource[\s\n]*\|/.test(current_content)
	// 原創報導
	&& !/{{\s*[Oo]riginal[\s\n]*\|/.test(current_content)) {
		CeL.info('for_each_old_page: [[' + page_data.title
				+ ']]: 沒有分類，不自動保護，而是另設Category列出。');
		problem_list.push('缺來源模板。');
	}

	var matched, no_category_name = '缺分類。', has_category,
	// [ all category, category name, sort order ]
	PATTERN_category =
	//
	/\[\[ *(?:Category|分類|分类) *: *([^\[\]\|]+)(?:\|([^\[\]]*))?\]\]/ig
	//
	;
	while (matched = PATTERN_category.exec(current_content)) {
		// 檢查非站務與維護分類
		if (!matched[1].includes(problem_categories_postfix)
		//
		&& !PATTERN_publish_name.test(matched[1])) {
			has_category = true;
			break;
		}
	}

	if (!has_category) {
		CeL.info('for_each_old_page: [[' + page_data.title
				+ ']]: 沒有來源，不自動保護，而是另設Category列出。');
		problem_list.push(no_category_name);
	} else if (!PATTERN_publish_before_categories.test(current_content)) {
		CeL.debug('[[' + page_data.title
				+ ']]: 將{{publish}}移至新聞稿下方，置於來源消息後、分類標籤前，以方便顯示。', 2,
				'for_each_old_page');
		current_content = current_content.replace(PATTERN_publish_template_g,
				'')
		//
		.replace(PATTERN_category, '{{publish}}$1');
	}

	if (problem_list.length > 0) {
		CeL.debug('[[' + page_data.title + ']]: 掛分類，由管理員手動操作。', 1,
				'for_each_old_page');
		if (write_page) {
			wiki.page(page_data).edit(current_content.trim() + '\n'
			//
			+ problem_list.map(function(category_name) {
				return '[[Category:' + category_name
				//
				+ problem_categories_postfix + ']]';
			}).join('\n'), {
				summary : summary + '檢查',
				nocreate : 1,
				bot : 1
			});
		}
		error_logs.push('; [[' + page_data.title + ']]: '
				+ problem_list.join(' '));
		return;
	}

	// return;

	function do_protect() {
		CeL.debug('[[' + page_data.title
		//
		+ ']]: 執行保護設定：僅限管理員，無限期。討論頁面不保護。', 0, 'for_each_old_page');
		wiki.protect({
			pageid : page_data.pageid,
			protections : 'edit=sysop|move=sysop',
			reason : summary
		});
	}

	if (current_content === page_data.revisions[0]['*']) {
		do_protect();
		return;
	}

	CeL.debug('[[' + page_data.title + ']]: 將新資料寫入頁面。', 0, 'for_each_old_page');

	wiki.page(page_data).edit(current_content, function() {
		do_protect();
	}, {
		summary : summary + '檢查',
		nocreate : 1,
		bot : 1
	});

}

// ----------------------------------------------------------------------------

prepare_directory(base_directory);

// CeL.set_debug(2);

check_redirect_to({
	published : 'Category:published',
	archived : 'Category:archived',
	template_publish : 'Template:publish'
}, main_work);
