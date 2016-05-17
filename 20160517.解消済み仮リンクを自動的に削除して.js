// cd ~/wikibot && date && time /shared/bin/node 20160517.解消済み仮リンクを自動的に削除して.js && date

/*

 [[:ja:Wikipedia:井戸端/subj/解消済み仮リンクを自動的に削除して]]

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
test_limit = Infinity;

// ----------------------------------------------------------------------------

wiki.set_data();

wiki.categorymembers('解消済み仮リンクを含む記事', function(list) {
	result = list;
	console.log(list.length);
});
