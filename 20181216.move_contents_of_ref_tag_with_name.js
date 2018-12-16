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

var main_template_name = '基礎情報 テレビ番組',
/** {String}編輯摘要。總結報告。 */
summary = '[[Template:' + main_template_name + ']]に関する依頼',

/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'ja');

// ---------------------------------------------------------------------//

function move_contents_of_ref_tag_with_name(page_data) {
	if (!page_data || ('missing' in page_data)) {
		// error? 此頁面不存在/已刪除。
		return [ CeL.wiki.edit.cancel, '條目不存在或已被刪除' ];
	}
	if (page_data.ns !== 0) {
		return [ CeL.wiki.edit.cancel,
		// 本作業は記事だけを編集する
		'本作業僅處理條目命名空間或模板或 Category' ];
	}

	/** {String}page title = page_data.title */
	var title = CeL.wiki.title_of(page_data),
	/**
	 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
	 */
	content = CeL.wiki.content_of(page_data);

	var parser = CeL.wiki.parser(page_data).parse();
	// debug 用.
	// check parser, test if parser working properly.
	if (CeL.wiki.content_of(page_data) !== parser.toString()) {
		console.log(CeL.LCS(CeL.wiki.content_of(page_data), parser.toString(),
				'diff'));
		throw 'Parser error: ' + CeL.wiki.title_link_of(page_data);
	}

	parser.each('template', function(token, index) {
		if (token.name !== main_template_name)
			return;
		console.log(token + '');
	});

}

// ---------------------------------------------------------------------//

// main

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
prepare_directory(base_directory, true);

// CeL.set_debug(6);

CeL.wiki.cache([ {
	// @see [[Category:含有多个问题的条目]]
	list : 'Template:' + main_template_name,
	type : 'embeddedin',
	retrieve : function(list) {
		return CeL.wiki.unique_list(list);
	},
	operator : function(list) {
		CeL.log('All ' + list.length + ' transcluding {{' + main_template_name
				+ '}}.');
		// this.transclude_基礎情報_テレビ番組 = list;
	}
} ], function(list) {
	list.truncate(2);
	// callback
	wiki.work({
		each : move_contents_of_ref_tag_with_name,
		summary : summary + ': [[Template:' + main_template_name
				+ ']]の「字幕」と「データ放送」欄の参照内容を移動する',
		log_to : log_to,
		page_cache_prefix : base_directory + 'page/',
		last : function() {
			CeL.info('Done: ' + new Date);
		}
	}, list);
}, {
	// default options === this
	// [SESSION_KEY]
	session : wiki,
	// title_prefix : 'Template:',
	// cache path prefix
	prefix : base_directory
});
