// cd /d D:\USB\cgi-bin\program\wiki && node 20150929.校訂繁簡轉換，修正錯別字.js

/*

 2015/9/28 see [[Wikisource:机器人#繁體錯字自動修正]]
 2015/9/30 18:1:18 初版試營運
 上路前修正
 完善

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loader.js');

// [[維基百科:Unihan繁簡體對照表]]
// corresponding

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'zh.wikisource');

var conversion_pair = new CeL.data.Convert_Pairs(CeL.get_file('校訂繁簡轉換，修正錯別字 轉換表.txt'));

// CeL.set_debug(3);
wiki.work({
	each : function(page_data) {
		/** {String}page content, maybe undefined. */
		var content = CeL.wiki.content_of(page_data);
		// add 分類:原文為繁體中文, 分類:原文為简体中文
		// 卷001 -> 卷1
		// 卷二 -> 卷2
		return conversion_pair.convert(content);
	},
	// 更正
	summary : summary,
	log_to : log_to
}, new Array(130).fill(null).map(function(i, index) {
	return '晉書/卷' + (index + 1).pad(3);
}));
