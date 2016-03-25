// cd ~/wikibot && date && time ../node/bin/node traversal_pages.js
// 遍歷所有頁面。

/*

 2016/3/20 18:43:33	初版試營運，約耗時 1-2 hour 執行。

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

// prepare directory
CeL.fs_mkdir(base_directory);

// CeL.set_debug(6);

var filtered = [],
//
dump_session = new CeL.wiki.SQL(CeL.wiki.language + 'wiki', function(error) {
	if (error)
		CeL.err(error);
}),
//
replica_session = new CeL.wiki.SQL(function(error) {
	if (error)
		CeL.err(error);
}, CeL.wiki.language),
//
mysql = require('mysql');

function get_dump_data(run_work, callback, id_list, rev_list) {
	var is_id = id_list.is_id;
	if (!is_id) {
		// lastest_revid[id] 僅能取得 pageid 之 revid。
		run_work(need_API);
		return;
	}

	var lastest_revid = JSON.parse(CeL.fs_read('dumps/lastest_revid.json',
			'utf8')),
	//
	index = 0, need_API = Object.assign([], id_list);

	function next_id() {
		if (index >= id_list.length) {
			// done.
			CeL.log('get_dump_data: ' + (id_list.length - need_API.length)
					+ '/' + id_list.length + ' use dump.');
			run_work(need_API);
			return;
		}

		var id = id_list[index++];
		if (index % 1e4 === 0) {
			CeL.log('get_dump_data: ' + index + '/' + id_list.length + ' ('
					+ (100 * index / id_list.length | 0) + '%)...');
		}

		if (rev_list[id] !== lastest_revid[id]) {
			// skip this id
			need_API.push(id);
			next_id();
			return;
		}

		// 若 revision 相同，從 dump 而不從 API 讀取。
		dump_session.SQL(
		//
		'SELECT `pageid`,`ns`,`title`,`timestamp`,`text` FROM `page` WHERE '
		//
		+ (is_id ? '`pageid`=' + id : '`title`=' + mysql.escape(id)),
		//
		function(error, rows) {
			if (error) {
				CeL.err(error);
				// skip this id
				need_API.push(id);
				next_id();
			} else {
				// 採用 dump
				var page_data = rows[0];
				page_data.revisions = {
					timestamp : page_data.timestamp,
					'*' : page_data.text
				};
				// page_data={pageid,ns,title,revisions:[{timestamp,'*'}]}
				callback(page_data);
				next_id();
			}
		});
	}
	next_id();
}

CeL.wiki.traversal({
	wiki : wiki,
	// cache path prefix
	directory : base_directory,
	filter : get_dump_data,
	after : function() {
		CeL.fs_write(base_directory + 'filtered.lst', filtered.join('\n'));
		CeL.log(script_name + ': ' + filtered.length + ' page(s) filtered.');
	}
}, function(page_data) {
	/** {String}page title */
	var title = CeL.wiki.title_of(page_data),
	/** {String}page content, maybe undefined. */
	content = CeL.wiki.content_of(page_data);

	if (content && content.includes('\u200E')) {
		filtered.push(title);
		CeL.log(filtered.length + ': [[' + title + ']]');
	}
});
