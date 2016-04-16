// cd ~/wikibot && date && time /shared/bin/node traversal_pages.js && date
// Traversal all pages. 遍歷所有頁面。執行任務版。

/*

 2016/4/1 21:16:32	初版試營運，約耗時 12分鐘執行。
 2016/4/4 22:50:58	add filter function list

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');
// for CeL.wiki.cache(), CeL.fs_mkdir()
CeL.run('application.platform.nodejs');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),
/** {String}base directory */
base_directory = bot_directory + script_name + '/',

// filter function list
filters = [],
/** {Array}filtered list[item] = {Array}[ list ] */
filtered = [],
/** {Natural}所欲紀錄的最大筆數。 */
log_limit = 400;

// ----------------------------------------------------------------------------

/**
 * Operation for each page. 對每一個頁面都要執行的作業。
 * 
 * @param {Object}page_data
 *            page data got from wiki API. =
 *            {pageid,ns,title,revisions:[{timestamp,'*'}]}
 */
function for_each_page(page_data) {
	/** {String}page title = page_data.title */
	var title = CeL.wiki.title_of(page_data),
	/** {String}page content, maybe undefined. 頁面內容 = revision['*'] */
	content = CeL.wiki.content_of(page_data);
	/** {Object}revision data. 修訂版本資料。 */
	// var revision = page_data.revisions && page_data.revisions[0];

	if (!content)
		return;

	filters.forEach(function(filter, index) {
		if (!filter(content, page_data))
			return;

		filtered[index].push(title);
		// filtered 太多則不顯示。
		if (filtered[index].length < log_limit)
			CeL.log('#' + index + '-' + filtered[index].length + ': [[' + title
					+ ']]');
		if (false) {
			// 此法會採用所輸入之 page data 作為 this.last_page，不再重新擷取 page。
			wiki.page(page_data).edit('');
		}
	});
}

/**
 * Finish up. 最後結束工作。
 */
function finish_work() {
	filtered.forEach(function(list, index) {
		CeL.fs_write(base_directory + 'filtered_' + index + '.lst', list
				.join('\n'));
		if (false) {
			// Write to wiki page.
			wiki.page('User:' + user_name + '/filtered_' + index).edit(
					list.join('\n'));
		}
		CeL.log(script_name + ': filter #' + index + ': ' + list.length
				+ ' page(s) filtered.');
	});
}

// ----------------------------------------------------------------------------

prepare_directory(base_directory, true);

// share the xml dump file.
if (typeof process === 'object') {
	process.umask(parseInt('0022', 8));
}

setup_filters();

// CeL.set_debug(6);
CeL.wiki.traversal({
	wiki : wiki,
	// cache path prefix
	directory : base_directory,
	// 指定 dump file 放置的 directory。
	// dump_directory : bot_directory + 'dumps/',
	dump_directory : '/shared/dump/',
	// 若 config.filter 非 function，表示要先比對 dump，若修訂版本號相同則使用之，否則自 API 擷取。
	// 設定 config.filter 為 ((true)) 表示要使用預設為最新的 dump，否則將之當作 dump file path。
	filter : true,
	after : finish_work
}, for_each_page);

// ----------------------------------------------------------------------------

var
/** {Natural|Array}Only check the NO(s). 僅處理此項。 */
only_check;

function setup_filters() {
	for (var checking_index = 0, count = 0; checking_index < 100; checking_index++) {
		var filter_function = eval('typeof filter_' + checking_index
		// global 無效。
		+ ' === "function" && filter_' + checking_index + ';');
		if (!filter_function)
			return;

		if (only_check) {
			if (Array.isArray(only_check)) {
				if (!only_check.includes(checking_index))
					continue;
			} else if (only_check >= 0 && checking_index !== only_check)
				continue;
		}

		count++;
		filters[checking_index] = filter_function;
		filtered[checking_index] = [];
	}

	log_limit = log_limit / count | 0;
	CeL.log('setup_filters: All ' + count + ' filters.');
}

// ↓ 0–4約耗時 18分鐘執行。包含本地 dump，約耗時 35分鐘執行。
;

// 檢查文章中是否包含有 LRM [[左至右符號]] U+200E。
// ↓ 單獨約耗時 12分鐘執行。
function filter_0(content) {
	return content.includes('\u200E');
}

// check Wikimedia projects links.
// 檢查文章 link 中是否包含 Wikimedia projects link。
// e.g., [https://zh.wikipedia.org/
// ↓ 單獨約耗時 15分鐘執行。
function filter_1(content) {
	return /\[[\s\n]*(?:(?:https?:)?\/\/)?[a-z]+\.wikipedia\./i.test(content);
}

// 檢查文章連結/外部連結中是否包含有跨維基計畫/跨語言連結。
// e.g., [[:en:XXX|YYY]], [[:en:XXX]]
function filter_2(content) {
	return /\[\[:[a-z]+:/i.test(content);
}

// 檢查文章中是否包含有控制所有機器人帳戶訪問的模板。
// check: {{bots}}, {{nobots}}
function filter_3(content) {
	return /{{(?:[Nn]o)?[Bb]ots[}\|\s]/.test(content);
}

var filter_4_1 = /\/gate\/big5\//i;
// 檢查文章外部連結中是否包含有字詞轉換/繁簡轉換網關的連結。
// /gate/big5/, http://big5. [[User:Antigng-bot/url]]
function filter_4(content) {
	return filter_4_1.test(content) || /http:\/\/big5\./i.test(content);
}
