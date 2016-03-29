// cd ~/wikibot && date && time ../node/bin/node traversal_pages.js && date
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

var node_fs = require('fs'),
//
filename = bot_directory + 'dumps/zhwiki-20160305-pages-articles.xml',
//
filtered = [],
// 經測試發現讀取 tools-db 的 database 速度不會比較快。
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

		// ------------------------------------------------
		// 測試 dump xml file 是否有最新版本。

		var position = lastest_revid[id];
		if (!position || position[0] !== revision) {
			if (false)
				CeL.log(
				//
				'Skip id: ' + id + ', ' + revision + ' !== ' + position);
			need_API.push(id);
			setTimeout(next_id, 0);
			return;
		}

		// ------------------------------------------------
		// 讀取 dump xml file。經測試速度過慢，以下方法廢棄 deprecated。

		CeL.debug('讀取 dump xml file: ' + position, 1, 'get_dump_data');

		var file_stream = new node_fs.ReadStream(filename, {
			start : position[1],
			end : position[1] + position[2],
			// 一次全部讀取進來。
			// 頁面大小系統上限 2,048 KB = 2 MB。
			highWaterMark : 4 * 1024 * 1024,
			encoding : CeL.wiki.encoding
		}), buffer;
		file_stream.on('data', function(chunk) {
			if (!buffer)
				buffer = chunk;
			else
				buffer += chunk;
		});
		file_stream.on('end', function() {
			// page_data={pageid,ns,title,revisions:[{timestamp,'*'}]}
			callback(CeL.wiki.parse_dump_xml(buffer));
			setTimeout(next_id, 0);
		});

		return;

		// ------------------------------------------------
		// 讀取 user database。經測試速度過慢，以下方法廢棄 deprecated。

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

function read_dump_file(run_work, callback, id_list, rev_list) {
	var start_read_time = Date.now(),
	// max_length = 0,
	count = 0, file_size, rev_of_id = [];

	id_list.forEach(function(id, index) {
		rev_of_id[id] = rev_list[index];
	});

	id_list = rev_list = null;

	CeL.wiki.read_dump(function(page_data, position, page_anchor) {
		// filter
		if (false && page_data.ns !== 0)
			return;

		if (++count % 1e4 === 0) {
			// e.g.,
			// "2730000 (99%): 21.326 page/ms [[Category:大洋洲火山岛]]"
			CeL.log(
			// 'process_data: ' +
			count + ' (' + (100 * position / file_size | 0) + '%): '
					+ (count / (Date.now() - start_read_time)).toFixed(3)
					+ ' page/ms [[' + page_data.title + ']]');
		}

		// ----------------------------
		// Check data.

		if (false) {
			var revision = page_data.revisions[0];
			// var title = page_data.title, content = revision['*'];

			// 似乎沒 !page_data.title 這種問題。
			if (false && !page_data.title)
				CeL.warn('* No title: [[' + page_data.pageid + ']]');
			// [[Wikipedia:快速删除方针]]
			if (revision['*']) {
				// max_length = Math.max(max_length, revision['*'].length);

				// filter patterns

			} else {
				CeL.warn('* No content: [[' + page_data.title + ']]');
			}
		}

		callback(page_data);

	}, {
		directory : base_directory,
		filter : function(pageid, revid) {
			return rev_of_id[pageid] === revid;
		},
		first : function(xml_filename) {
			file_size = node_fs.statSync(xml_filename).size;
		},
		last : function() {
			// e.g., "All 2755239 pages, 167.402 s."
			// includes redirection 包含重新導向頁面.
			CeL.log('process_data: All ' + count + ' pages, '
					+ (Date.now() - start_read_time) / 1000 + ' s.');
		}
	});
}

CeL.wiki.traversal({
	wiki : wiki,
	// cache path prefix
	directory : base_directory,
	// 若不想使用 tools-db 的 database，可 comment out 此行。
	filter : dump_session && get_dump_data || read_dump_file,
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
