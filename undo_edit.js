// cd /d D:\USB\cgi-bin\program\wiki && node undo_edit.js

/*

 recover, revert error edit
 連續發生大量編輯錯誤，要回退時使用的工具。

 2019/4/11 13:44	初版試營運

 @see [[m:User:Hoo man/Scripts/Smart rollback]]

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loader.js');

/** {Object}wiki operator 操作子. */
var wiki = Wiki(true/* , 'ja' */);

// ---------------------------------------------------------------------//

user_name = CeL.wiki.normalize_title(user_name);

summary = 'fix error made by bot';

// fix these edits.
function filter_summary(summary) {
	// return summary.includes('16: Unicode');
	return summary.includes('16: 去除條目中之不可見字符');
}

// ---------------------------------------------------------------------//

wiki.usercontribs(user_name, function(list) {
	CeL.log('Get ' + list.length + ' pages');

	var undo_page_hash = Object.create(null);

	list.reverse();
	list.forEach(function filter_contribs(page_data) {
		if (Date.now() - Date.parse(page_data.timestamp) >
		// filter by date
		1 * 24 * 60 * 60 * 1000) {
			// too old
			return;
		}

		// page_title
		var title = CeL.wiki.title_of(page_data);

		if (page_data.comment) {
			if (page_data.comment.includes(summary)) {
				// Already fixed.
				delete undo_page_hash[title];
				return;
			}

			// filter by summary
			if (!filter_summary(page_data.comment)) {
				return;
			}
		}

		// ------------------------------------------------

		undo_page_hash[title] = true;
	});

	list = Object.keys(undo_page_hash);

	CeL.log('' + list.length + ' pages need to test.');

	list.run_serial(for_each_page);

}, {
	limit : 800
});

function for_each_page(run_next, title, index, list) {
	CeL.debug('Test ' + CeL.wiki.title_link_of(title));

	wiki.page(title, function(page_data) {
		// console.log(page_data);

		/** {Object}revision data. 修訂版本資料。 */
		var revision = page_data && page_data.revisions
				&& page_data.revisions[0];

		if (revision.comment && revision.comment.includes(summary)) {
			// Already fixed.
			run_next();
			return;
		}

		if (revision.user !== user_name) {
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

		CeL.log('Try to undo edit on ' + (index + 1) + '/' + list.length + ' '
				+ CeL.wiki.title_link_of(title));
		if (false) {
			run_next();
			return;
		}

		wiki.page(title).edit('', {
			undo : 1,
			summary : summary
		}).run(run_next);
	}, {
		rvprop : 'ids|content|timestamp|user|comment'
	});

}
