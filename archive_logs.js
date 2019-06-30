// cd ~/wikibot && date && time /shared/bin/node archive_logs.js use_language=zh && date
// cd /d D:\USB\cgi-bin\program\wiki && node archive_logs.js use_language=zh
// archive logs. 歸檔封存機器人執行的記錄子頁面。若程式運作紀錄超過1筆，而且長度過長(≥min_length)，那麼就將所有的記錄搬到存檔中。

/*

 2016/3/23 20:16:46	初版試營運。
 2016/6/9 9:36:17	adapt for jawiki. 記録保存作業

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loader.js');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true);

// ---------------------------------------------------------------------//

var
/** {String}只檢查這個命名空間下面的所有頁面。 20: for 20dd年 */
title_prefix = 'User:' + user_name + '/log/20',
/**
 * log_root (所有個別項目之記錄頁面) 的模式。其下視為子頁面，其上不被視作記錄頁面。
 * 
 * matched: [ all title, name space (User, 利用者), user, date ]
 * 
 * @type {RegExp}
 */
PATTERN_LOG_TITLE = /^([^:]+):([^:\/]+)\/log\/(\d{8})$/,
/** {String|RegExp}將移除此標記 後第一個章節開始所有的內容。 */
last_preserve_mark = {
	zh : '運作記錄',
	// 作業結果報告
	ja : '結果',
	// work report, operation report, summary
	en : 'report'
},
/** {Natural}超過了這個長度才會被搬移。 */
min_length = 5000,
/** {Natural}超過了這個長度，才會造出首個存檔。 */
min_length_create = 100000,
/**
 * {Boolean|String}會自動造出首個存檔的最早日期界限。
 * 
 * 記錄檔的最後編輯日期標示超過了這個日期才會造出首個存檔。這是為了避免有已經不會變更的古老記錄檔被強制造出存檔來。
 * 
 * e.g., '20160101'. 當前設定 3個月前
 */
create_first = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 3)
		.format('%4Y%2m%2d'),
/** {Natural}記錄頁面的存檔起始編號。 */
archive_index_starts = 1,
// lastest_archive[title] = last index of archive
lastest_archive = Object.create(null),
// 將第一個 archive_prefix 作為預設 archive_prefix。
default_archive_prefix = {
	zh : '存檔',
	zh_CN : '存档',
	ja : '過去ログ',
	// e.g., "Archive 1"
	en : 'Archive '
},
// archive prefix
archive_prefix = Object.values(default_archive_prefix).join('|'),
// archive_prefix_hash[title] = archive prefix of log page
archive_prefix_hash = Object.create(null),
// [ all, log root, archive prefix, archive index ]
PATTERN_log_archive = new RegExp('^(.+?\/[^\/]+)\/(' + archive_prefix
		+ ')(\\d+)$'),

/** {Number}未發現之index。 const: 基本上與程式碼設計合一，僅表示名義，不可更改。(=== -1) */
NOT_FOUND = ''.indexOf('_');

function archive_title(log_title, archive_index) {
	// 須配合 PATTERN_log_archive。
	return log_title
			+ '/'
			+ (archive_prefix_hash[log_title] || default_archive_prefix[use_language])
			+ (archive_index || lastest_archive[log_title] || archive_index_starts);
}

/**
 * get log pages.
 * 
 * @param {Function}callback
 *            回調函數。 callback(titles)
 */
function get_log_pages(callback) {
	wiki.prefixsearch(title_prefix, function(pages, titles, title) {
		CeL.log('get_log_pages: ' + titles.length + ' subpages.');
		// console.log(titles);
		callback(titles.sort());
	}, {
		limit : 'max'
	});
}

/**
 * 處理每一個記錄頁面。
 * 
 * @param {Object}page_data
 *            log page data
 */
function for_log_page(page_data) {
	/** {String}page title */
	var log_title = CeL.wiki.title_of(page_data),
	/** {String}page content, maybe undefined. */
	content = CeL.wiki.content_of(page_data);

	CeL.log('for_log_page: 處理 [[' + log_title + ']] '
	//
	+ (log_title in lastest_archive ? '最後存檔'
	//
	+ lastest_archive[log_title] : '無存檔過'));

	var matched = content && content.match(last_preserve_mark[use_language]);
	if (!matched) {
		CeL.warn('for_log_page: Invalid log page? (未發現程式運作紀錄標記:'
				+ last_preserve_mark[use_language] + ') [[' + log_title + ']]');
		return;
	}

	/** {RegExp}章節標題。 */
	var PATTERN_TITLE = /\n=[^\n]+=\n/g,
	/** {Number}要搬移的紀錄大小 */
	log_size = content.length - matched.index, needless_reason;

	PATTERN_TITLE.lastIndex = matched.index + matched[0].length;
	// console.log(PATTERN_TITLE.lastIndex + '/' + content.length);
	matched = PATTERN_TITLE.exec(content);

	if (!matched) {
		needless_reason = '未發現程式運作紀錄章節標題（除了標頭說明之外看起來已經沒有任何新的記錄，或許已經存檔過、清空了。）';
		// console.log(content);
		// console.log(PATTERN_TITLE);
	} else if (log_size < min_length) {
		needless_reason = '頁面中之程式運作紀錄過短 (' + log_size + '字)';
	} else if (content.indexOf('\n==', matched.index + matched[0].length) === NOT_FOUND) {
		needless_reason = '僅有1筆程式運作紀錄';

	} else if (!(log_title in lastest_archive)) {
		if (!create_first) {
			needless_reason = true;
		} else if (
		// log_title.replace(/^.+?(\d+)$/, '$1') <= create_first
		CeL.wiki.content_of.edit_time(page_data).format('%4Y%2m%2d') <= create_first) {
			// 檢查最近的變更日期 e.g., ('20170515' <= '20170609')
			needless_reason = ' ' + create_first + ' 之前編輯的紀錄';
		} else if (log_size <= min_length_create) {
			needless_reason = ' ' + min_length_create + ' 字以下的紀錄';
		}

		if (needless_reason) {
			needless_reason = '原先不存在存檔子頁面，且已設定'
					+ (needless_reason || '')
					+ '不造出存檔子頁面。（若需要自動歸檔封存，您需要手動創建首個存檔子頁面'
					+ CeL.wiki.title_link_of(log_title + '/'
							+ default_archive_prefix[use_language] + '1')
					+ '。）';
		}
	}

	if (needless_reason) {
		CeL.info('for_log_page: ' + needless_reason + '；不作歸檔封存: [[' + log_title
				+ ']]');
		return;
	}

	// --------------------------------

	/** {Boolean}已經發生過錯誤 */
	var had_failed,
	/** {String}編輯摘要。總結報告。 */
	summary;

	/** 寫入記錄頁面 */
	function write_log_page() {
		wiki.page(log_title).edit(function(page_data) {
			return content.slice(0, matched.index);
		}, {
			// remove log.
			summary : summary + ' #2/2 移除記錄',
			bot : 1,
			nocreate : had_failed ? 0 : 1
		}, function(title, error) {
			if (error)
				CeL.error('write_log_page: 無法寫入記錄頁面 [['
				//
				+ log_title + ']]! 您需要自行刪除舊程式運作紀錄！');
		});
	}

	/** 寫入記錄頁面的存檔 */
	function write_archive() {
		var archive_page = archive_title(log_title);
		summary = '[[WP:ARCHIVE|歸檔封存作業]]: [[' + log_title + ']] → [['
				+ archive_page + ']] ' + log_size + '字';
		CeL.info('for_log_page: ' + summary);

		var config = {
			// append log. 附加，增補。
			summary : summary + ' #1/2 添附記錄',
			bot : 1,
			section : 'new',
			sectiontitle : (new Date).format('%4Y%2m%2d') + '歸檔封存'
		};

		if (!had_failed && (log_title in lastest_archive)) {
			config.nocreate = 1;
		}

		wiki.page(archive_page).edit(function(page_data) {
			if (CeL.is_debug(3)) {
				console.log('** Edit:');
				console.log(page_data);
			}
			var
			/** {String}page content, maybe undefined. */
			log_page = CeL.wiki.content_of(page_data);

			if (had_failed
			// 即使沒有內容，只要存在頁面就當作可以寫入。
			|| (typeof log_page === 'string' ?
			// 頁面大小系統上限 2,048 KB = 2 MB。
			log_page.length + log_size < 2e6 : !config.nocreate)) {
				return "'''{{font color|#54f|#ff6|存檔長度" + log_size
				// TODO: internationalization
				+ "字元。}}'''\n" + content.slice(matched.index).trim();
			}

		}, config, function(title, error) {
			if (!error) {
				// 正常結束，移除原紀錄內容。
				write_log_page();

			} else if (had_failed) {
				CeL.error('write_archive: 無法寫入存檔 [[' + archive_page + ']]！');
				console.error(error);

			} else {
				if (log_title in lastest_archive) {
					lastest_archive[log_title]++;
				} else {
					CeL.error('write_archive: 創建存檔頁面 [['
					//
					+ archive_page + ']] 失敗，不再作嘗試。');
					console.error(error);
					return;

					lastest_archive[log_title]
					//
					= archive_index_starts + 1;
				}
				had_failed = true;
				CeL.debug('write_archive: 嘗試存到下一個編號: '
				//
				+ lastest_archive[log_title] + '。');
				// retry again.
				write_archive();
			}
		});
	}

	write_archive();
}

// CeL.set_debug(2);

get_log_pages(function(log_pages) {
	CeL.debug(
	//
	'PATTERN_log_archive: ' + PATTERN_log_archive, 1, 'get_log_pages');
	var
	/** {Array}filter log root. e.g., [[User:user_name/log/20010101]] */
	log_root = log_pages.filter(function(title) {
		if (false && !title.includes('20150916')) {
			return;
		}
		// 篩選出存檔頁面
		var matched = title.match(PATTERN_log_archive);
		if (matched) {
			CeL.debug(matched, 1, 'get_log_pages');
			var index = matched[3] | 0;
			if (matched[1] in lastest_archive) {
				if (archive_prefix_hash[matched[1]] !== matched[2]) {
					CeL.warn('[[' + matched[1] + ']] 的存檔頁面有兩種不同的 prefix: '
							+ archive_prefix_hash[matched[1]] + ', '
							+ matched[2] + '。將以數字最大者為主。');
				}
				if (index < lastest_archive[matched[1]]) {
					// 不作設定。
					index = null;
				}
			}
			if (index) {
				// 設定 index
				// 中間即使有空的編號，也會跳號不考慮。
				lastest_archive[matched[1]] = index;
				archive_prefix_hash[matched[1]] = matched[2];
			}
		}
		return PATTERN_LOG_TITLE.test(title);
	});
	// console.log(log_root);
	// console.log(lastest_archive);
	// console.log(archive_prefix_hash);

	wiki.page(log_root, function(pages, error) {
		if (error) {
			CeL.error(error);
		} else {
			pages.forEach(for_log_page);
		}
	}, {
		multi : true
	});
});
