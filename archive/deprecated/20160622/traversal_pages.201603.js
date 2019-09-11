// cd ~/wikibot && date && time ../node/bin/node traversal_pages.js && date
// 遍歷所有頁面。

// 工作原理:
// * 經測試，讀取 file 會比讀取 MariaDB 快，且又更勝於經 API 取得資料。
// * 經測試，遍歷 xml dump file 約 3分鐘(see process_dump.js)，會比隨機存取快得多。
// * database replicas @ Tool Labs 無 `text` table，因此實際頁面內容不僅能經過 replicas 存取。
// # 先將最新的 xml dump file 下載到本地(實為 network drive)並解開: read_dump()
// # 由 Tool Labs database replication 讀取所有 ns0 且未被刪除頁面最新版本之版本號 rev_id (包含重定向): traversal_pages() + all_revision_SQL
// # 遍歷 xml dump file，若 dump 中為最新版本，則先用之 (約 95%): get_dump_data()
// # 經 API 讀取餘下 dump 後近 5% 更動過的頁面內容: traversal_pages() + wiki_API.prototype.work
// # 於 Tool Labs，解開 xml 後；自重新抓最新版本之版本號起，整個作業時間約 12分鐘。

/*

 2016/3/20 18:43:33	初版試營運，約耗時 1-2 hour 執行。

 */

'use strict';

require('./wiki loader.js');
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
		CeL.error(error);
}),
//
replica_session = false && new CeL.wiki.SQL(function(error) {
	if (error)
		CeL.error(error);
}, CeL.wiki.language),
//
mysql = require('mysql');

// ----------------------------------------------------------------------------
// 使用 tools-db 的 database。
// 經測試速度過慢，以下方法廢棄 deprecated。

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
				CeL.error(error || 'No rows got: ' + id);
				if (false && !error)
					console.log(rows);
				// skip this id
				need_API.push(id);
				setTimeout(next_id, 0);
			} else {
				// 採用 dump
				page_data.revisions = [ {
					revid : page_data.revid,
					timestamp : page_data.timestamp,
					'*' : page_data.text
				} ];
				// page_data={pageid,ns,title,revisions:[{timestamp,'*'}]}
				callback(page_data);
				setTimeout(next_id, 0);
			}
		});
	}
	setTimeout(next_id, 0);
}

// ----------------------------------------------------------------------------

function read_dump_file(run_work, callback, id_list, rev_list) {
	var start_read_time = Date.now(), length = id_list.length,
	// max_length = 0,
	count = 0, file_size, rev_of_id = [], is_id = id_list.is_id;

	id_list.forEach(function(id, index) {
		if (id in rev_of_id)
			CeL.warn('存在重複之id: ' + id);
		rev_of_id[id] = rev_list[index];
	});

	// release
	id_list = rev_list = null;

	CeL.wiki.read_dump(function(page_data, position, page_anchor) {
		// filter
		if (false && page_data.ns !== 0)
			return;

		if (++count % 1e4 === 0) {
			// e.g.,
			// "2730000 (99%): 21.326 page/ms [[Category:大洋洲火山岛]]"
			CeL.log(
			// 'read_dump_file: ' +
			count + ' (' + (100 * position / file_size | 0) + '%): '
					+ (count / (Date.now() - start_read_time)).toFixed(3)
					+ ' page/ms [[' + page_data.title + ']]');
		}

		// ----------------------------
		// Check data.

		if (false) {
			var revision = page_data.revisions[0];
			// var title = page_data.title;
			var content = CeL.wiki.revision_content(revision);

			// 似乎沒 !page_data.title 這種問題。
			if (false && !page_data.title)
				CeL.warn('* No title: [[' + page_data.pageid + ']]');
			// [[Wikipedia:快速删除方针]]
			if (content) {
				// max_length = Math.max(max_length, content.length);

				// filter patterns

			} else {
				CeL.warn('* No content: [[' + page_data.title + ']]');
			}
		}

		// 註記為 dump。
		page_data.dump = true;
		// page_data.dump = filename;

		callback(page_data);

	}, {
		// directory : base_directory,
		directory : bot_directory + 'dumps/',
		first : function(xml_filename) {
			filename = xml_filename;
			file_size = node_fs.statSync(xml_filename).size;
		},
		filter : function(pageid, revid) {
			if ((pageid in rev_of_id) && rev_of_id[pageid] === revid) {
				// 隨時 delete rev_of_id[] 會使速度極慢。
				// delete rev_of_id[pageid];
				rev_of_id[pageid] = null;
				return true;
			}
		},
		last : function() {
			// e.g., "All 1491092 pages in dump xml file, 198.165 s."
			// includes redirection 包含重新導向頁面.
			CeL.log('read_dump_file: All ' + count + '/' + length
					+ ' pages using dump xml file ('
					+ (1000 * count / length | 0) / 10 + '%), '
					+ (Date.now() - start_read_time) / 1000 + ' s elapsed.');
			var need_API = [];
			need_API.is_id = is_id;
			for ( var id in rev_of_id)
				if (rev_of_id[id] !== null)
					need_API.push(id);
			// release
			rev_of_id = null;

			// CeL.set_debug(3);
			// 一般可以達到 95% 以上採用 dump file 的程度，10分鐘內跑完。
			run_work(need_API);
		}
	});
}

// ----------------------------------------------------------------------------

var all_pages = [];

CeL.wiki.traversal({
	wiki : wiki,
	// cache path prefix
	directory : base_directory,
	page_options : {
		rvprop : 'ids|timestamp|content'
	},
	// 若不想使用 dump，可 comment out 此行。
	// 經測試，全部使用 API，最快可入50分鐘內，一般在 1-2 hours 左右。
	filter : dump_session && get_dump_data || read_dump_file,
	last : function() {
		CeL.fs_write(base_directory + 'filtered.lst', filtered.join('\n'));
		CeL.log(script_name + ': ' + filtered.length + ' page(s) filtered.');
		CeL.fs_write(base_directory + 'all_pages.lst', all_pages.join('\n'));
	}
}, function(page_data) {
	/** {String}page title */
	var title = CeL.wiki.title_of(page_data),
	/** {String}page content, maybe undefined. */
	content = CeL.wiki.content_of(page_data);
	var revision = page_data.revisions && page_data.revisions[0];

	if (false && page_data.pageid === 18) {
		CeL.fs_write(base_directory + 'page/' + title + '.wiki', content);
		throw 'OK';
	}

	all_pages[page_data.pageid] = [ page_data.pageid, title,
			revision && revision.revid,
			typeof content === 'string' ? content.length : content,
			page_data.dump ].join('	');

	if (content && content.includes('\u200E')) {
		filtered.push(title);
		CeL.log(filtered.length + ': [[' + title + ']]');
		CeL.fs_write(base_directory + 'page/' + title + '.wiki', content);
	}
});
