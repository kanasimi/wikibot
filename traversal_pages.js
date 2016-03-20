// cd ~/wikibot && time node traversal_pages.js

/*

 2016/3/20 18:43:33	初版試營運，約耗時 1.5 hour。

 */

'use strict';

// var CeL_path = 'S:\\cgi-bin\\lib\\JS';
require('./wiki loder.js');
// for CeL.wiki.cache(), CeL.fs_mkdir()
CeL.run('application.platform.nodejs');

var
/** {Object}wiki 操作子. */
wiki = Wiki(true),
/** {String}base directory */
base_directory = bot_directory + script_name + '/';

// ---------------------------------------------------------------------//

// prepare directory
CeL.fs_mkdir(base_directory);

// CeL.set_debug(6);

var filtered = [];
CeL.wiki.traversal({
	wiki : wiki,
	// cache path prefix
	directory : base_directory,
	after : function(messages, titles, pages) {
		CeL.fs_write(base_directory + 'filtered.txt', filtered.join('\n'));
		CeL.log(script_name + ': Done.');
	}
}, function(page_data, messages) {
	/** {String}page title */
	var title = CeL.wiki.title_of(page_data),
	/** {String}page content, maybe undefined. */
	content = CeL.wiki.content_of(page_data);
	if (content && content.includes('\u200E')) {
		filtered.push(title);
		CeL.log(filtered.length + ': [[' + title + ']]');
	}
});
