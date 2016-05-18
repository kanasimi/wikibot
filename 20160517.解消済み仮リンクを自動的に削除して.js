// cd ~/wikibot && date && time /shared/bin/node 20160517.解消済み仮リンクを自動的に削除して.js && date

/*

 [[:ja:Wikipedia:井戸端/subj/解消済み仮リンクを自動的に削除して]]

 @see
 https://github.com/liangent/mediawiki-maintenance/blob/master/cleanupILH_DOM.php

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');
// for CeL.wiki.cache(), CeL.fs_mkdir()
CeL.run('application.platform.nodejs');
// 在非 Windows 平台上避免 fatal 錯誤。
CeL.env.ignore_COM_error = true;
// load module for CeL.CN_to_TW('简体')
CeL.run('extension.zh_conversion');

// Set default language. 改變預設之語言。
CeL.wiki.set_language('ja');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),
/** {String}base directory */
base_directory = bot_directory + script_name + '/';

var
/** {Natural}所欲紀錄的最大筆數。 */
log_limit = 200,
//
count = 0, length = 0,
// ((Infinity)) for do all
test_limit = 1,
//
ill2_list = [];

// ----------------------------------------------------------------------------

wiki.set_data();

prepare_directory(base_directory);

CeL.wiki.cache([ {
	type : 'categorymembers',
	list : '解消済み仮リンクを含む記事'

}, {
	type : 'page'

} ], function(list) {
	CeL.log('Get ' + list.length + ' item(s).');
	list.slice(0, test_limit).forEach(function(title) {
		wiki.page(title, function(page_data) {
			/** {String}page title = page_data.title */
			var title = CeL.wiki.title_of(page_data),
			/**
			 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
			 */
			content = CeL.wiki.content_of(page_data);

			CeL.wiki.parser(page_data).parse().each('template',
			//
			function(token) {
				if (token[1] === '仮リンク'
				// || token[1] === 'ill2' || token[1] === 'link-interwiki'
				) {
					// {{仮リンク|記事名|en|title}}
					token[2].page_data = page_data;
					ill2_list.push(token[2]);
					console.log(token[2]);
				}
			});
		});
	});

}, {
	// default options === this
	namespace : 0,
	// [SESSION_KEY]
	session : wiki,
	// title_prefix : 'Template:',
	// cache path prefix
	prefix : base_directory
});
