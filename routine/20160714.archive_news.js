// (cd ~/wikibot && date && hostname && nohup time node 20160714.archive_news.js; date) >> archive_news/log &

/*

 2016/7/17 14:35:38	正式營運，轉成常態性運行作業。

 @see
 https://en.wikipedia.org/wiki/Wikipedia:Link_rot
 https://en.wikipedia.org/wiki/Wikipedia:Citing_sources#Preventing_and_repairing_dead_links
 https://meta.wikimedia.org/wiki/InternetArchiveBot
 https://web.archive.org/
 http://archive.is/
 http://archivebot.at.ninjawedding.org:4567/

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');
// for CeL.get_set_complement()
CeL.run('data.math');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'wikinews'),

// ((Infinity)) for do all
test_limit = 10,
// 不管日期多新都處理。
ignore_date = false,
// 為了維護頁面的歷史紀錄不被更動，因此不建Category寫入原文章頁面。
write_page = false,

problem_categories_postfix = '的可存檔新聞',

/** {Number}一整天的 time 值。should be 24 * 60 * 60 * 1000 = 86400000. */
ONE_DAY_LENGTH_VALUE = new Date(0, 0, 2) - new Date(0, 0, 1),
/** {Number}未發現之index。 const: 基本上與程式碼設計合一，僅表示名義，不可更改。(=== -1) */
NOT_FOUND = ''.indexOf('_'),

// [[Wikinews:存檔常規]]: 已發表七日(1週)或以上的文章會列入存檔並且可被保護。
time_limit = Date.now() - 7 * ONE_DAY_LENGTH_VALUE,

page_list = [],
// page_status
error_logs = [],

PATTERN_category_start = /(\[\[ *(?:Category|分類|分类) *:)/i,
//
publish_name_list, publish_names, PATTERN_publish_template,
//
PATTERN_publish_category = /\[\[\s*Category\s*:\s*(?:已發布|已发布)\s*\]\]/ig, source_templates;

log_to = 'Wikinews:管理员通告板/需檢查的可存檔新聞';
summary = CeL.wiki.title_link_of('WN:ARCHIVE', '存檔保護') + '作業';

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
		type : 'redirects_here',
		list : template_name_redirect_to.template_publish,
		reget : true,
		operator : function(list) {
			publish_name_list = list.map(function(page_data) {
				return page_data.title.replace(/^[^:]+:/, '');
			});
			// TODO: + 繁簡轉換
			publish_name_list.push('已發布');
			CeL.log('Alias of ' + CeL.wiki.title_link_of(
			//
			template_name_redirect_to.template_publish)
			//
			+ ': ' + publish_name_list);

			publish_names
			//
			= CeL.wiki.normalize_title_pattern(publish_name_list);
			PATTERN_publish_template = new RegExp('{{\\s*'
			//
			+ publish_names + '\\s*(\\|[^{}]*)?}}');
		}

	}, {
		type : 'categorymembers',
		list : template_name_redirect_to.source,
		reget : true,
		namespace : 'template',
		operator : function(list) {
			source_templates = list.map(function(page_data) {
				return page_data.title.replace(/^Template:/, '');
			});
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

		if (list[1].length > 0) {
			// 依照現在 {{publish}} 的寫法，不應出現此項。
			CeL.error('有' + list[1].length + '個已存檔，但沒有發布之條目！');
		}

		list = list[0];

		// var list = this.list;
		// list = [ '' ];
		CeL.log('Get ' + list.length + ' pages.');
		if (false) {
			ignore_date = true;
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
				prop : 'revisions|info',
				rvprop : 'ids|timestamp',
				// https://www.mediawiki.org/w/api.php?action=help&modules=query%2Binfo
				// https://www.mediawiki.org/wiki/API:Info#inprop.3Dprotection
				additional_query : 'inprop=protection'
			},
			last : archive_pages

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
			+ '以最後編輯時間後已超過 time limit (1周)或以上的文章為準。', 3,
			'for_each_page_not_archived');
	// console.log(page_data);
	// console.log(CeL.wiki.is_protected(page_data));
	// 不列出已經保護的新聞。
	if (!CeL.wiki.is_protected(page_data)
			&& (ignore_date || Date.parse(page_data.revisions[0].timestamp) < time_limit)) {
		page_list.push(page_data);
	}
}

function archive_pages() {
	CeL.log('archive_pages: 可存檔 ' + page_list.length + ' 文章。');
	CeL.debug('{{publish}} pattern: ' + PATTERN_publish_template, 1,
			'archive_pages');
	// console.trace(page_list.slice(0, 9));
	var left = page_list.length;
	page_list.forEach(function(page_data) {
		CeL.debug('Get max revisions of ' + CeL.wiki.title_link_of(page_data)
				+ '.' + ' 以最後編輯時間後已超過兩周或以上的文章為準。', 3,
				'for_each_page_not_archived');
		wiki.page(page_data, function(page_data, error) {
			for_each_old_page(page_data, error);
			if (--left === 0) {
				var error_count = error_logs.length;
				CeL.info('for_each_page_not_archived: Write report: '
						+ error_count + ' lines.');
				if (error_count > 0) {
					error_logs.unshift('<!-- 本頁面會定期更新，毋須手動修正。 -->\n'
							+ '請幫忙修復這些文章。機器人將在修復完畢、待時限過後自動保護。 --~~~~');
					error_logs.push(
					//
					'\n<noinclude>[[Category:管理員例行工作]]\n'
					//
					+ '[[Category:需要校對的頁面]]</noinclude>');
				} else {
					error_logs = [ ': 本次檢查未發現問題頁面。 --~~~~' ];
				}
				wiki.page(log_to).edit(error_logs.join('\n'), {
					summary : summary + '報告: ' + error_count + '筆錯誤',
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
	function replace_simulated_category_token() {
		if (has_category && has_category.token) {
			if (has_category.parent[has_category.index].type !== 'category')
				throw new Error('Not a category token!');
			// 刪掉模擬用的分類 node。
			has_category.parent[has_category.index] = has_category.token;
			has_category = true;
		}
	}

	// problem categories: 需請管理員檢查的可存檔新聞/文章
	var problem_list = [],
	/**
	 * {String}page content, maybe undefined.
	 */
	contents = CeL.wiki.content_of(page_data), current_content;
	if (!contents) {
		CeL.error('for_each_old_page: ' + CeL.wiki.title_link_of(page_data)
				+ ': No content');
		// console.log(page_data);
		return;
	}

	if (typeof contents === 'string') {
		CeL.debug(CeL.wiki.title_link_of(page_data)
		//
		+ ': 只有1個版本。', 1, 'for_each_old_page');
		// assert: typeof contents === 'string' && contents has
		// {{publish}}
		current_content = contents;

	} else {
		// assert: Array.isArray(contents)
		current_content = contents[0];
		contents = contents.map(function(content) {
			return content.replace(/<nowiki>.*?<\/nowiki>/g, '<nowiki/>')
			// 註解中可能有 {{publish}}!
			.replace(/<\!--[\s\S]*?-->/g, '');
		});

		CeL.debug(CeL.wiki.title_link_of(page_data) + ': ' + contents.length
				+ ' 個版本。', 3, 'for_each_old_page');
		var PATTERN_publish = PATTERN_publish_template,
		// first revision that has {{publish}}
		first_has_published = contents.first_matched(PATTERN_publish, true);

		if (first_has_published === NOT_FOUND) {
			// 照理來說不該使用[[Category:~]]
			PATTERN_publish = new RegExp(PATTERN_publish_category.source, 'i');
			first_has_published = contents.first_matched(PATTERN_publish, true);
		}
		if (first_has_published === NOT_FOUND) {
			throw new Error('可能存有未設定之{{publish}}別名? '
					+ CeL.wiki.title_link_of(page_data));
		}

		if (first_has_published > 0) {
			// 若非最新版才出現 {{publish}}，則向前尋。
			if (!PATTERN_publish.test(contents[first_has_published])
					|| contents[first_has_published + 1]
					&& PATTERN_publish.test(contents[first_has_published + 1])) {
				// 可能中間有匹配/不匹配交替出現?
				CeL.error(first_has_published + '/' + contents.length + ': ');
				CeL.log(contents[first_has_published]);
				CeL.log('-'.repeat(80));
				if (contents[first_has_published + 1]) {
					CeL.log(contents[first_has_published + 1]);
				}
				throw new Error('出現 {{publish}}');
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
				CeL.debug(CeL.wiki.title_link_of(page_data)
						+ ': 有多個版本。新聞稿發布時間: '
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
					CeL.info('for_each_old_page: '
							+ CeL.wiki.title_link_of(page_data)
							+ ': 發布2日後大幅修改過。');
					problem_list.push('[[Special:Diff/'
							+ page_data.revisions[first_has_published].revid
							+ '|發布]]2日後[[Special:Diff/'
							+ page_data.revisions[need_stable_index].revid
							+ '/'
							+ page_data.revisions[0].revid
							+ '|大幅修改過]]。'
							+ (edit_distance ? '[[w:en:edit distance|編輯距離]]'
									+ edit_distance : (size > 0 ? '多' : '少')
									+ '了' + Math.abs(size) + '字元')
							+ "。請管理員檢核過後'''手動保護'''這篇文章。");
				}
			}
		}
	}

	contents = CeL.wiki.parser(current_content,
			CeL.wiki.add_session_to_options(wiki)).parse();
	if (current_content !== contents.toString()) {
		// debug 用. check parser, test if parser working properly.
		throw new Error('Parser error: ' + CeL.wiki.title_link_of(page_data));
	}
	current_content = contents;

	if (false) {
		// 去掉空分類 [[Category:]]。
		current_content.each('link', function(token) {
			if (/^Category/i.test(token[0].toString()))
				return '';
		}, true);
	}

	CeL.debug(CeL.wiki.title_link_of(page_data)
			+ ': 刪除{{breaking}}、{{expand}}等過時模板，避免困擾。', 2, 'for_each_old_page');
	current_content.each('template', function(token) {
		if (token.name === 'Breaking' || token.name === 'Expand')
			return '';
	}, true);

	var do_not_need_source =
	// 2018/6/6 19:34:4
	page_data.title.includes('香港天氣報告') || page_data.title.includes('深圳天气预报‎‎')
	// accept 報紙頭條 without source per IRC
	// || page_data.title.includes('報紙頭條')
	// || page_data.title.includes('报纸头条')
	;
	CeL.debug(CeL.wiki.title_link_of(page_data) + ': '
			+ (do_not_need_source ? 'do not ' : '') + 'need source', 2,
			'for_each_old_page');
	if (!do_not_need_source) {
		var has_source;
		current_content.each('template', function(token) {
			// [[分類:來源模板|新聞源/資料來源引用模板]]
			if (source_templates.includes(token.name)) {
				has_source = true;
				// 可跳出。
				return current_content.each.exit;
			}
		});

		if (!has_source) {
			// 允許使用 reference
			current_content.each('tag', function(token) {
				if (token[1].toString().trim()) {
					has_source = true;
					// TODO: 可跳出。
				}
			});
		}

		if (!has_source) {
			CeL.info('for_each_old_page: ' + CeL.wiki.title_link_of(page_data)
					+ ': 沒有來源，不自動保護，而是另設Category列出。');
			problem_list.push('缺'
					+ CeL.wiki.title_link_of('Category:來源模板', '來源模板') + '。');
		}
	}

	current_content.each('template', function(token) {
		// [[分類:來源模板|新聞源/資料來源引用模板]]
		if (token.name in {
			扩充 : true,
			擴充 : true
		}) {
			problem_list.push('需要{{tl|' + token.name + '}}。');
			return current_content.each.exit;
		}
	});

	// do not need category: {{headline navbox}} 自帶 Category，不需要分類。
	var do_not_need_category = /{{ *[Hh]eadline[ _]navbox *\|/
			.test(current_content), has_category;
	if (!do_not_need_category) {
		// 檢查並修正新聞稿格式、分類、錯字、標點符號等小錯誤，若無分類或來源請協助添加。
		current_content.each('category', function(token) {
			if (!token.name.includes(problem_categories_postfix)
			// TODO: 檢查非站務與維護分類
			&& !publish_name_list.includes(token.name)) {
				has_category = true;
				return current_content.each.exit;
			}
		});
		if (!has_category) {
			CeL.debug('將已加入[[Template:分類]]視為有效分類，並執行保護。'
					+ '將{{cat}}及{{category}}視作有加分類。');
			// console.trace(current_content);
			current_content.each('Template:分類', function(token, index, parent) {
				// CeL.log('{{分類}}: ' + token);
				has_category = {
					parent : parent,
					index : index,
					token : token
				};
				// 模擬出一個分類 node，方便作業。
				parent[index] = CeL.wiki.parse('[[Category:category]]');
				return current_content.each.exit;
			});
		}
	}

	if (!do_not_need_category && !has_category) {
		CeL.info('for_each_old_page: ' + CeL.wiki.title_link_of(page_data)
				+ ': 沒有分類，不自動保護，而是另設Category列出。');
		problem_list.push('缺' + CeL.wiki.title_link_of('Category:频道', '屬性分類')
				+ '。');

	} else {
		CeL.debug(CeL.wiki.title_link_of(page_data)
				+ ': 將{{publish}}移至新聞稿下方，置於來源消息後、分類標籤前，以方便顯示。', 2,
				'for_each_old_page');
		var order_list = [ 'transclusion', publish_name_list, 'DEFAULTSORT',
				'category' ],
		//
		publish_order = order_list.indexOf(publish_name_list),
		//
		index = current_content.length, last_pointer, publish_pointer;
		while (index-- > 0) {
			var order = CeL.wiki.parser.footer_order(current_content[index],
					order_list);
			// CeL.log('> ' + order + ': ' + current_content[index]);
			// console.trace(current_content[index]);
			if (order > publish_order) {
				last_pointer = index;
			} else if (order === publish_order) {
				publish_pointer = index;
			} else if (typeof order === 'number') {
				break;
			}
		}

		replace_simulated_category_token();
		if (false && publish_pointer >= 0) {
			console.log('[' + publish_pointer + '] publish: '
					+ current_content[publish_pointer]);
		}

		if (last_pointer > 0) {
			if (false) {
				console.log('[' + last_pointer + '] last pointer: '
						+ current_content[last_pointer]);
			}
			if (last_pointer < publish_pointer) {
				// {{publish}}被放在[[Category:~]]後。
				current_content[publish_pointer] = '';
				publish_pointer = undefined;
			}
			current_content.each('template', function(token) {
				if (token.name === 'Publish'
						&& token !== current_content[publish_pointer]) {
					// 去掉其他所有{{publish}}。
					return '';
				}
			}, true);
			if (isNaN(publish_pointer)) {
				// 插入{{publish}}。
				// 置於來源消息後、分類標籤前
				current_content.splice(last_pointer, 0, '{{publish}}\n');
			}
		} else if (do_not_need_category) {
			// skip error
			;
		} else {
			problem_list.push('分類似乎沒依規範掛在文章最後，在其之後尚有其他元件？也請注意其前後不可有空白。');
		}
	}

	replace_simulated_category_token();

	if (problem_list.length > 0) {
		CeL.debug(CeL.wiki.title_link_of(page_data) + ': 掛分類，由管理員手動操作。', 1,
				'for_each_old_page');
		if (write_page && false) {
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
		error_logs.push("# '''" + CeL.wiki.title_link_of(page_data)
				+ "'''\n#: " + problem_list.join(' '));
		return;
	}

	function do_protect() {
		CeL.debug(CeL.wiki.title_link_of(page_data)
				+ ': 執行保護設定：僅限管理員，無限期。討論頁面不保護。', 1, 'for_each_old_page');
		wiki.protect({
			pageid : page_data.pageid,
			tags : 'archive',
			protections : 'edit=sysop|move=sysop',
			reason : summary
		});
	}

	current_content = current_content.toString()
	// 去掉過多之空白字元。
	.replace(/\n{3,}/g, '\n\n');

	// 無更動 沒有變更 No modification made
	if (current_content === CeL.wiki.revision_content(page_data.revisions[0])) {
		do_protect();
		return;
	}

	CeL.debug(CeL.wiki.title_link_of(page_data) + ': 將新資料寫入頁面。', 1,
			'for_each_old_page');

	// TODO: 封存時對非編輯不可的文章，順便把<!-- -->註解清掉。
	wiki.page(page_data).edit(current_content, {
		summary : summary + '檢查與修正',
		nocreate : 1,
		bot : 1
	}, function() {
		do_protect();
	});

}

// ----------------------------------------------------------------------------

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
prepare_directory(base_directory);

// CeL.set_debug(2);

wiki.run(function() {
	wiki.register_redirects('Template:分類');
	check_redirect_to({
		published : 'Category:published',
		archived : 'Category:archived',
		// [[分類:來源模板|新聞源/資料來源引用模板]]
		source : 'Category:來源模板',
		template_publish : 'Template:publish'
	}, main_work);
});
