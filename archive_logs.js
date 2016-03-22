// cd ~/wikibot && date && time ../node/bin/node archive_logs.js
// archive logs.

/*

 初版試營運。

 */

'use strict';

require('./wiki loder.js');
// for CeL.wiki.cache(), CeL.fs_mkdir()
CeL.run('application.platform.nodejs');

var
/** {Object}wiki 操作子. */
wiki = Wiki(true),
/** {String}base directory */
base_directory = bot_directory + script_name + '/';

// ---------------------------------------------------------------------//

// get log pages
function get_log_pages(callback) {
	// 20: for 20dd年
	wiki.prefixsearch('User:' + user_name + '/log/20', function(title, titles,
			pages) {
		CeL.log('get_log_pages: ' + titles.length + ' log pages.');
		// console.log(titles);
		callback(titles);
	}, {
		limit : 'max'
	});
}

// [ all title, user, date ]
var PATTERN_LOG_TITLE = /^User:([^:\/]+)\/log\/(\d{8})$/;

get_log_pages(function(log_pages) {
	// filter log root.
	// e.g., [[User:user_name/log/20010101]]
	var log_root = log_pages.filter(function(title) {
		return PATTERN_LOG_TITLE.test(title);
	});
	console.log(log_root);

	log_root.forEach(function(title) {
		wiki.page(title, function(page_data) {
			;
		});
	});
});
