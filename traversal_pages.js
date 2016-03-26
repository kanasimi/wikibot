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
dump_session = false && new CeL.wiki.SQL(CeL.wiki.language + 'wiki', function(
		error) {
	if (error)
		CeL.err(error);
}),
//
replica_session = false && new CeL.wiki.SQL(function(error) {
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

	// @see process_dump.js
	var lastest_revid = JSON.parse(CeL.fs_read('dumps/lastest_revid.json',
			'utf8')),
	//
	index = 0, need_API = [];
	need_API.is_id = is_id;

	function next_id() {
		if (index >= id_list.length) {
			// done.
			CeL.log('get_dump_data: ' + (id_list.length - need_API.length)
					+ '/' + id_list.length + ' use dump.');
			run_work(need_API);
			return;
		}

		var id = id_list[index],
		// id_list, rev_list 採用相同的 index。
		revision = rev_list[index++];
		if (index % 1e4 === 0) {
			CeL.log('get_dump_data: ' + index + '/' + id_list.length + ' ('
					+ (100 * index / id_list.length | 0)
					+ '%), use dumped data: ' + (index - 1 - need_API.length)
					+ ' ('
					+ (100 * (index - 1 - need_API.length) / (index - 1) | 0)
					+ '%)');
		}

		if (revision !== lastest_revid[id]) {
			if (false)
				CeL.log('Skip id: ' + id + ', ' + revision + ' !== '
						+ lastest_revid[id]);
			need_API.push(id);
			setTimeout(next_id, 0);
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
			var page_data;
			if (error || !(page_data = rows[0])) {
				CeL.err(error || 'No rows got: ' + id);
				if (false && !error)
					console.log(rows);
				// skip this id
				need_API.push(id);
				setTimeout(next_id, 0);
			} else {
				// 採用 dump
				page_data.revisions = {
					timestamp : page_data.timestamp,
					'*' : page_data.text
				};
				// page_data={pageid,ns,title,revisions:[{timestamp,'*'}]}
				callback(page_data);
				setTimeout(next_id, 0);
			}
		});
	}
	setTimeout(next_id, 0);
}

CeL.wiki.traversal({
	wiki : wiki,
	// cache path prefix
	directory : base_directory,
	// 若不想使用 tools-db，可 comment out 此行。
	filter : dump_session && get_dump_data,
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
