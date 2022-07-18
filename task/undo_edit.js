/*

node undo_edit.js use_language=ja

 recover, revert error edit
 連續發生大量編輯錯誤，要回退時使用的工具。

 2019/4/11 13:44	初版試營運

 @see [[m:User:Hoo man/Scripts/Smart rollback]]

TODO:
+ 預估剩餘時間

 */

'use strict';

globalThis.no_task_date_warning = true;

// Load CeJS library and modules.
require('../wiki loader.js');

/** {Object}wiki operator 操作子. */
var wiki = Wiki(true, 'ja');

// ---------------------------------------------------------------------//

var edit_summary = CeL.gettext(
// gettext_config:{"id":"very-sorry.-undo-the-robot-s-wrong-edits.-($1)"}
"Very Sorry. Undo the robot's wrong edits. (%1)",
// 加上時間戳記以方便要回復這次 undo 時使用。
(new Date).toISOString());
// 向前追溯筆數。
var trace_forward_length = 'max';

// fix only these edits.
function filter_summary(summary, page_data) {
	// console.log(summary);
	return summary.includes('護衛艦#多用途護衛艦（DDA）')
	// && wiki.is_namespace(page_data, 'Category')
	;

	var revert_this_edit = summary.includes('まんたんブロードのリンク修正依頼2')
	//
	&& summary.includes('Bot作業依頼')
	// Do not revert [[User:cewbot/log/20190913]]
	&& (!page_data || !page_data.title.includes(20190913));
	// revert_this_edit = summary === 'Robot';
	if (false && revert_this_edit) {
		CeL.info(filter_summary.name + ': ' + CeL.wiki.title_link_of(page_data)
				+ ': ' + summary);
	}
	return revert_this_edit;
}

// ---------------------------------------------------------------------//

wiki.usercontribs(CeL.wiki.extract_login_user_name(login_options.user_name),
//
check_usercontribs, {
	// namespace : 'Category',
	limit : trace_forward_length
});

function check_usercontribs(list) {
	CeL.log('check_usercontribs: ' + 'Get ' + list.length + ' edits from '
			+ CeL.wiki.site_name(wiki));

	var undo_page_hash = Object.create(null);

	// old → new
	list.reverse();
	// console.log(list);
	list.forEach(function filter_contribs(page_data) {
		if (false && Date.now() - Date.parse(page_data.timestamp)
		// filter by date
		> CeL.date.to_millisecond('1D')) {
			// too old
			return;
		}

		// page_title
		var title = CeL.wiki.title_of(page_data);
		if (false && !page_data.title.includes('世宗 (朝鮮王)')) {
			return;
		}

		if (page_data.comment) {
			if (page_data.comment.includes(edit_summary)) {
				// Already fixed.
				delete undo_page_hash[title];
				return;
			}

			// filter by summary
			if (!filter_summary(page_data.comment, page_data)) {
				return;
			}
		}

		// ------------------------------------------------

		undo_page_hash[title] = true;
	});

	list = Object.keys(undo_page_hash);

	CeL.info('check_usercontribs: ' + list.length + ' pages need to test.');
	// console.trace(list.slice(0, 5).join(', '));

	list.run_serial(for_each_page);

}

var check_diff = false;

function filter_content(content) {
	return true;

	var need_fix;
	if (false) {
		// e.g., [[File:Yoon Bomi at Severance Hospital, May 2013.jpg]]
		need_fix = content.match(/{{ *Licensereview *[|}]/g);
		if (need_fix)
			need_fix = need_fix.length > 1;
		// e.g., [[File:Adilson dos Santos.jpg]]
		if (!need_fix)
			need_fix = /{{ *PermissionTicket *[|}]/.test(content);
	}
	return need_fix;
}

function filter_diff(diff) {
	var removed_text = diff[0], added_text = diff[1];
	// console.log(diff);
	var need_fix = added_text
			&& removed_text
			&& added_text.length < removed_text.length
			&& /\[\[ *(?:File|Fichier|檔案|档案|文件|ファイル|Image|圖像|图像|画像|Media|媒[體体](?:文件)?)/i
					.test(added_text);
	if (false && need_fix)
		console.log(diff);
	return need_fix;
}

function for_each_page(run_next, title, index, list) {
	CeL.debug('Test ' + CeL.wiki.title_link_of(title));

	// filter by content and others
	wiki.page(title, function(page_data) {
		CeL.log_temporary((index + 1) + '/' + list.length + ' '
				+ CeL.wiki.title_link_of(page_data));
		// console.log(page_data);

		/** {Object}revision data. 修訂版本資料。 */
		var revision = page_data && page_data.revisions
				&& page_data.revisions[0];

		if (revision.comment && revision.comment.includes(edit_summary)) {
			// Already fixed.
			run_next();
			return;
		}

		if (revision.user !== wiki.token.login_user_name) {
			CeL.warn(CeL.wiki.title_link_of(page_data) + ' 已被 ' + revision.user
					+ ' 編輯過'
					+ (revision.comment ? ': ' + revision.comment : ''));
			run_next();
			return;
		}

		if (revision.comment && !filter_summary(revision.comment)) {
			run_next();
			return;
		}

		// wikitext
		var content = CeL.wiki.revision_content(revision);
		if (!filter_content(content)) {
			run_next();
			return;
		}

		if (check_diff && page_data.revisions[1]) {
			var diff_list = CeL.LCS(CeL.wiki.revision_content(
			//
			page_data.revisions[1]), content, 'diff');
			if (!diff_list.some(filter_diff)) {
				run_next();
				return;
			}
			// console.log(diff_list);
		}

		CeL.log('Undo edit on ' + (index + 1) + '/' + list.length + ' '
				+ CeL.wiki.title_link_of(title));
		if (false) {
			run_next();
			return;
		}

		// console.log(page_data.revisions[1]);
		// console.log(CeL.wiki.content_of(page_data, 1));
		// CeL.set_debug(6);
		wiki.page(page_data).edit('', {
			undo : 1,
			bot : 1,
			minor : 1,
			summary : edit_summary
		}).run(run_next);
	}, {
		rvlimit : check_diff ? 2 : 1,
		rvprop : 'ids|content|timestamp|user|comment'
	});

}
