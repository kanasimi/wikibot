// cd /d D:\USB\cgi-bin\program\wiki && node 20181216.move_ref_name.js
// <ref name="...">の内容を移動する

/*

 初版試營運

 @see [[ja:Special:Diff/70970184]]

 TODO:


 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

var
/** {String}編輯摘要。總結報告。 */
summary = 'ref tagの内容を移動する',

/** {Object}wiki operator 操作子. */
wiki = Wiki(true);

// ---------------------------------------------------------------------//

// ---------------------------------------------------------------------//

// main

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
prepare_directory(base_directory, true);

// CeL.set_debug(6);

CeL.wiki.cache([ {
	// @see [[Category:含有多个问题的条目]]
	list : 'Template:基礎情報 テレビ番組',
	type : 'embeddedin',
	retrieve : function(list) {
		return CeL.wiki.unique_list(list);
	},
	operator : function(list) {
		CeL.log('All ' + list.length + ' transcluding {{基礎情報 テレビ番組}}.');
		this.transclude_基礎情報_テレビ番組 = list;
	}
} ], function() {
	return;

	// callback
	wiki.work({
		each : 處理須拆分的條目,
		summary : summary + ': 拆分維護模板',
		log_to : log_to,
		page_cache_prefix : base_directory + 'page/',
		last : function() {
			wiki.work({
				each : 處理須合併的條目,
				summary : summary + ': 合併維護模板',
				page_cache_prefix : base_directory + 'page/',
				log_to : log_to
			}, 須合併的條目);
		}
	}, this.須拆分的條目);
}, {
	// default options === this
	// [SESSION_KEY]
	// session : wiki,
	// title_prefix : 'Template:',
	// cache path prefix
	prefix : base_directory
});
