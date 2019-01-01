// cd /d D:\USB\cgi-bin\program\wiki && node 20190101.featured_articles_maintainer.js

/*

 初版試營運

 // 輪流展示列表

 @see [[]]

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

var

/** {Object}wiki operator 操作子. */
wiki = Wiki(true);

// ---------------------------------------------------------------------//

// ---------------------------------------------------------------------//

// main

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
prepare_directory(base_directory, true);

// CeL.set_debug(6);

var JDN_now = CeL.Julian_day(new Date),
// 開始廢棄"特色條目"，採用"典範條目"的日期。
典範JDN = CeL.Julian_day.from_YMD(2017, 10, 1, true),
//
PATTERN_transcluded = /^\s*\{\{\s*(?:Wikipedia|wikipedia|維基百科|维基百科):(?:特色|典範|典范|优良)(?:條目|条目|列表)\/(?:s\|)?([^\/{}]+)\}\}\s*$/,
//
title_hash = CeL.null_Object();

// 檢查/解析所有過去首頁曾經展示過的特色內容頁面，以確定特色內容頁面最後一次展示的時間。
function get_FA_page(JDN) {
	process.stdout.write(JDN + ': '
			+ CeL.Julian_day.to_YMD(JDN, true).join('/') + ' ...\r');

	wiki.page(CeL.Julian_day.to_Date(JDN).format(
			'Wikipedia:' + (JDN < 典範JDN ? '特色條目' : '典范条目') + '/%Y年%m月%d日'),
	//
	function(page_data) {
		/** {String}page title = page_data.title */
		var title = CeL.wiki.title_of(page_data),
		/**
		 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
		 */
		content = CeL.wiki.content_of(page_data),
		//
		matched = content
				&& content.replace(/<!--.*?-->/g, '')
						.match(PATTERN_transcluded);
		if (matched) {
			title_hash[matched[1].replace(/[‎]/g, '').trim()] = JDN;
		} else {
			CeL.error(title + ': ' + content);
		}
		if (JDN < JDN_now)
			get_FA_page(JDN + 1);
		else
			conclusion();
	}, {
		redirects : 1
	});
}

get_FA_page(CeL.Julian_day.from_YMD(2013, 8, 20, true));

// ---------------------------------------------------------------------//

function conclusion() {
	var title_sorted = Object.keys(title_hash).sort(function(title_1, title_2) {
		return title_hash[title_1] - title_hash[title_2];
	});

	if (false) {
		title_sorted.join('|');
		title_sorted.map(function(title) {
			return title_hash[title]
		});
		console.log(title_sorted.map(function(title) {
			return title + ' - '
			//
			+ CeL.Julian_day.to_YMD(title_hash[title], true).join('/');
		}).join('\n'));
	}

	;
}

// ---------------------------------------------------------------------//

