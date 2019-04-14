// cd /d D:\USB\cgi-bin\program\wiki && node 20190413.modify_template_parameter.js

/*

 2019/4/13 18:32:51	初版試營運

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('ja');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true);

// ---------------------------------------------------------------------//
// main

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
// prepare_directory(base_directory);

// CeL.set_debug(6);

wiki.cache({
	// 檢查含有{{Template:Chembox Properties}}之 頁面。
	type : 'embeddedin',
	reget : true,
	list : 'Template:Chembox Properties',
	// namespace : 'Category',
	cache : false
}, function(list) {
	// console.log(list);

	wiki.work({
		each : for_each_page,
		// Bot依頼 #º（序数標識）から°（度）への置換
		summary : '[[Special:Diff/72319509|Bot作業依頼]]：º（序数標識）から°（度）への置換'
				+ ' - [[' + log_to + '|log]]',
		// [[User:cewbot/log/20190413]]
		log_to : log_to,
		last : function() {
			;
		}
	}, list);

}, {
	// default options === this
	// cache path prefix
	prefix : base_directory
});

// ---------------------------------------------------------------------//

function for_each_page(page_data) {
	/** {String}page title = page_data.title */
	var title = CeL.wiki.title_of(page_data),
	/**
	 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
	 */
	content = CeL.wiki.content_of(page_data);

	/** 頁面解析後的結構。 */
	var parsed = CeL.wiki.parser(page_data).parse();
	// debug 用.
	// check parser, test if parser working properly.
	if (CeL.wiki.content_of(page_data) !== parsed.toString()) {
		console.log(CeL.LCS(CeL.wiki.content_of(page_data), parsed.toString(),
				'diff'));
		throw 'Parser error: ' + CeL.wiki.title_link_of(page_data);
	}

	var changed;
	parsed.each('Template', function(token, index) {
		if (token.name === 'Chembox Properties') {
			// console.log(token.toString());
			token = token.toString();
			if (/[º˚]/.test(token) || /゜[CF]/.test(token)) {
				changed = true;
				return token.replace(/[º˚]/g, '°').replace(/゜([CF])/g, '°$1');
			}
		}
	}, true);

	if (changed)
		return parsed.toString();

	return [ CeL.wiki.edit.cancel, 'skip' ];
}
