// cd ~/wikibot && date && time ../node/bin/node traversal_dump_db.js
// 遍歷所有頁面。

/*

 2016/3/25 18:22:18	初版試營運

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loader.js');
// for CeL.wiki.cache(), CeL.fs_mkdir()
CeL.run('application.platform.nodejs');

var
/** {Object}wiki 操作子. */
wiki = Wiki(true),
/** {String}base directory */
base_directory = bot_directory + script_name + '/';

// ---------------------------------------------------------------------//

require('./wiki loader.js');
var dump_session = new CeL.wiki.SQL('zhwiki', function(error) {
	if (error)
		CeL.error(error);
});
var start_time = Date.now(),
//
query = dump_session.connection.query('SELECT `title`,`text` FROM `page`'),
//
list = [], count = 0;
query.on('error', function(error) {
	console.error(error);

}).on('result', function(row) {
	var content = row.text && row.text.toString('utf8') || '';
	if (++count % 1e4 === 0)
		CeL.log(count + ': ' + (count / (Date.now() - start_time)).toFixed(3)
		//
		+ ' page/ms [[' + row.title.toString('utf8') + ']] ('
		//
		+ content.length + ' characters)');

	if (content.includes('\u200E'))
		list.push(row.title.toString('utf8'));

}).on('end', function() {
	// includes redirection 包含重新導向頁面.
	CeL.log('All ' + list.length + '/' + count + ' pages filtered.');
	dump_session.connection.end();
});
