// cd ~/wikibot && date && time /shared/bin/node "20151002.WPCHECK.改用{{rtl-lang}}處理右至左文字.js" && date
// Traversal all pages. 遍歷所有頁面。簡易版，用於展示概念。

/*

 2016/4/24 13:56:23	初版試營運，採用模板：traversal_pages.clear.js，約耗時 110分鐘執行 1271 pages。

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loader.js');
// for CeL.wiki.cache(), CeL.fs_mkdir()
CeL.run('application.platform.nodejs');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),
/** {String}base directory */
base_directory = bot_directory + script_name + '/',
// 修正維基百科內容的語法錯誤。
/** {String}編輯摘要。總結報告。 */
summary = '[[WP:WPCHECK|修正維基語法]]',
/** {String}緊急停止作業將檢測之章節標題。 */
check_section = '20151002',
/** {String}運作記錄存放頁面。 */
log_to = 'User:' + user_name + '/log/' + check_section,
/** {Array}filtered list = {Array}[ list ] */
filtered = [];

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
	var revision = page_data.revisions && page_data.revisions[0];

	if (!content)
		return;

	if (page_data.ns === 0
	//
	&& /{{lang\s*\|\s*(ar|he|kk|tg-Arab)\s*\|\s*([^{}])/i.test(content)) {
		// need modify
		filtered.push(title);
	}
}

var
// 找出使用了由右至左文字的{{lang}}模板。
// 應該改用{{tl|rtl-lang}}處理右至左文字如阿拉伯語及希伯來語，請參見{{tl|lang}}的說明。
// [ all, language, text ]
PATTERN_LTR_lang = /{{lang\s*\|\s*(ar|he|kk|tg-Arab)\s*\|\s*([^{}\|]+)}}/ig;

function replace_to_rtl_lang(all, language, text) {
	text = text.replace(/[\u200E\u200F]/g, '').trim();
	var matched = text.match(/^('+)([^']+)('+)$/);
	if (matched) {
		text = matched[2];
		matched = matched[1];
	}
	all = '{{rtl-lang|' + language + '|' + text + '}}';
	if (matched) {
		all = matched + all + matched;
	}
	return all;
}

/**
 * Finish up. 最後結束工作。
 */
function finish_work() {
	CeL.log(script_name + ': ' + filtered.length + ' page(s) filtered.');
	if (filtered.length > 0) {
		wiki.work({
			summary : summary
			//
			+ ' 16: 改用[[Template:rtl-lang]]處理右至左文字如阿拉伯語及希伯來語',
			log_to : log_to,
			each : function(page_data) {
				var content = CeL.wiki.content_of(page_data);
				return content.replace(PATTERN_LTR_lang, replace_to_rtl_lang);
			}
		}, filtered);
	}
}

// ----------------------------------------------------------------------------

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
prepare_directory(base_directory);

// Set the umask to share the xml dump file.
if (typeof process === 'object') {
	process.umask(parseInt('0022', 8));
}

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
	last : finish_work
}, for_each_page);
