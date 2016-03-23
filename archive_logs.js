// cd ~/wikibot && date && time ../node/bin/node archive_logs.js
// archive logs. 若紀錄超過1筆，而且長度過長，那麼就將所有的記錄搬到存檔中。

/*

 2016/03/23 13:34:49	初版試營運。

 */

'use strict';

require('./wiki loder.js');
// for CeL.wiki.cache(), CeL.fs_mkdir()
CeL.run('application.platform.nodejs');

var
/** {Object}wiki 操作子. */
wiki = Wiki(true),
/** {String}base directory */
base_directory = bot_directory + script_name + '/';

// ---------------------------------------------------------------------//

var
/** {String}只檢查這個命名空間下面的所有頁面。 20: for 20dd年 */
title_prefix = 'User:' + user_name + '/log/20',
/**
 * log_root (所有個別項目之記錄頁面) 的模式。其下視為子頁面，其上不被視作記錄頁面。
 * 
 * matched: [ all title, user, date ]
 * 
 * @type {RegExp}
 */
PATTERN_LOG_TITLE = /^User:([^:\/]+)\/log\/(\d{8})$/,
/** {String|RegExp}將移除此 mark 後第一個章節開始所有的內容。 */
last_preserve_mark = '運作記錄',
/** {Natural}若是超過了這個長度則將會被搬移。 */
max_length = 500,
/** {Natural}記錄頁面的存檔起始編號。 */
archive_index_starts = 1,
// lastest_archive[title] = last index of archive
lastest_archive = CeL.null_Object(),
//
archive_prefix = '存檔',
// [ all, log root, archive & index ]
PATTERN_log_archive = new RegExp('\/([^\/]+)\/' + archive_prefix + '(\\d+)$'),

/** {Number}未發現之index。 const: 基本上與程式碼設計合一，僅表示名義，不可更改。(=== -1) */
NOT_FOUND = ''.indexOf('_');

function archive_title(log_title, archive_index) {
	// 須配合 PATTERN_log_archive。
	return log_title + '/' + archive_prefix + (archive_index
	//
	|| lastest_archive[log_title] || archive_index_starts);
}

/**
 * get log pages.
 * 
 * @param {Function}callback
 *            回調函數。 callback(titles)
 */
function get_log_pages(callback) {
	wiki.prefixsearch(title_prefix, function(title, titles, pages) {
		CeL.log('get_log_pages: ' + titles.length + ' log pages.');
		// console.log(titles);
		callback(titles);
	}, {
		limit : 'max'
	});
}

/**
 * 處理每一個記錄頁面。
 * 
 * @param {Object}page_data
 *            page data
 */
function for_log_page(page_data) {
	/** {String}page title */
	var log_title = CeL.wiki.title_of(page_data),
	/** {String}page content, maybe undefined. */
	content = CeL.wiki.content_of(page_data);

	var matched = content && content.match(last_preserve_mark);
	if (!matched) {
		CeL.warn('Invalid log page? [' + log_title + ']');
		return;
	}

	/** {RegExp}章節標題。 */
	var PATTERN_TITLE = /\n==(^\n)+/g,
	/** {Number}要搬移的紀錄大小 */
	log_size = content.length - matched.index;
	PATTERN_TITLE.lastIndex = matched.index + matched[0].length;
	matched = PATTERN_TITLE.exec(content);
	if (!matched
			|| log_size < max_length
			|| content.indexOf('\n==', matched.index + matched[0].length) === NOT_FOUND) {
		CeL.log('頁面紀錄過短，不需要存檔: [' + log_title + ']');
		return;
	}

	/** {Boolean}已經發生過錯誤 */
	var had_failed;

	/** 寫入記錄頁面 */
	function write_log_page() {
		wiki.page(log_title).edit(function(page_data) {
			return content.slice(0, matched.index);
		}, null, function(title, error) {
			if (error)
				CeL.err('write_log_page: 無法寫入記錄頁面 [['
				//
				+ log_title + ']]! 您需要自行刪除舊紀錄!');
		});
	}

	/** 寫入記錄頁面的存檔 */
	function write_archive() {
		var archive_page = archive_title(log_title);

		wiki.page(archive_page).edit(function(page_data) {
			var
			/** {String}page content, maybe undefined. */
			log_page = CeL.wiki.content_of(page_data);

			// 頁面大小系統上限 2,048 KB = 2 MB。
			if (log_page && log_page.length + log_size < 2e6)
				return '存檔長度' + log_size + '\n\n'
				//
				+ content.slice(matched.index);
		}, {
			section : 'new',
			sectiontitle : (new Date).format('%4Y%2m%2d') + '存檔'
		}, function(title, error) {
			if (!error)
				write_log_page();
			else if (had_failed) {
				CeL.err('write_archive: 無法寫入存檔 [[' + archive_page + ']]!');
				console.error(error);
			} else {
				had_failed = true;
				CeL.debug('write_archive: 嘗試存到下一個編號。');
				if (log_title in lastest_archive)
					lastest_archive[log_title]++;
				else
					lastest_archive[log_title]
					//
					= archive_index_starts + 1;
				// retry again.
				write_archive();
			}
		});
	}

	write_archive();
}

get_log_pages(function(log_pages) {
	var
	/** {Array}filter log root. e.g., [[User:user_name/log/20010101]] */
	log_root = log_pages.filter(function(title) {
		// 篩選出存檔頁面
		var matched = title.match(PATTERN_log_archive);
		if (matched) {
			lastest_archive[matched[1]] = Math.max(archive_index_starts,
					+matched[2]);
		}
		return PATTERN_LOG_TITLE.test(title);
	});
	// console.log(log_root);

	log_root.forEach(function for_log_page(log_title) {
		wiki.page(log_title, for_log_page);
	});
});
