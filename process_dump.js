// cd ~/wikibot && date && time ../node/bin/node process_dump.js
// Import Wikimedia database backup dumps data to user-created database on Tool Labs.
// 應用工具: 遍歷所有 dumps data 之頁面，並將資料寫入 .csv file，進而匯入 database。
// @see https://www.mediawiki.org/wiki/Manual:Importing_XML_dumps#Using_importDump.php.2C_if_you_have_shell_access

// 2016/3/12 11:56:10	初版試營運。純粹篩選約需近 3 minutes。

// 使用新版 node.js 能加快寫入 .csv file 之速度，降低 CPU 與 RAM 使用；
// 2016/3/19 do_write_file 使用時間約需近 20 minutes，LOAD DATA 使用時間約需近 10 minutes 執行。

'use strict';

require('./wiki loder.js');
// for CeL.wiki.cache(), CeL.fs_mkdir(), CeL.wiki.read_dump()
CeL.run('application.platform.nodejs');

function process_data(error) {
	if (error)
		CeL.err(error);

	var start_read_time = Date.now(),
	// max_length = 0,
	count = 0;
	CeL.wiki.read_dump(function(page_data, status) {
		// filter
		if (false && page_data.ns !== 0)
			return;

		var revision = page_data.revisions[0];

		if (++count % 1e4 === 0) {
			// e.g., "2660000: 16.546 page/ms Wikipedia:优良条目/2015年8月23日"
			CeL.log('process_data: ' + count + ' ('
					+ (status.pos / status.size | 0) + '%): '
					+ (count / (Date.now() - start_read_time)).toFixed(3)
					+ ' page/ms [[' + page_data.title + ']]');
		}
		// var title = page_data.title, content = revision['*'];

		// ----------------------------
		// Check data.

		// 似乎沒 !page_data.title 這種問題。
		if (false && !page_data.title)
			CeL.warn('* No title: [[' + page_data.pageid + ']]');
		// [[Wikipedia:快速删除方针]]
		if (revision['*']) {
			// max_length = Math.max(max_length, revision['*'].length);

			// filter patterns
			if (false && revision['*'].includes('\u200E'))
				filtered.push(page_data.title);
			if (false && /{{(?:[Nn]o)?[Bb]ots[} |]/.test(revision['*']))
				filtered.push(page_data.title);
		} else {
			CeL.warn('* No content: [[' + page_data.title + ']]');
		}

		// ----------------------------
		// Write to .csv file.

		if (do_write_file) {
			// @see data_structure
			file_stream.write([ page_data.pageid, page_data.ns,
			// escape ',', '"'
			'"' + page_data.title.replace(/"/g, '""') + '"', revision.revid,
			// '2000-01-01T00:00:00Z' → '2000-01-01 00:00:00'
			revision.timestamp.slice(0, -1).replace('T', ' '),
			//
			'"' + revision['*'].replace(/"/g, '""') + '"' ]
			//
			.join(',') + '\n');
		}

		// ----------------------------
		// Write to database.

		if (do_realtime_import)
			connection.query({
				sql : INSERT_SQL,
				// @see data_structure
				values : [ page_data.pageid, page_data.ns, page_data.title,
						revision.revid,
						// '2000-01-01T00:00:00Z' → '2000-01-01 00:00:00'
						revision.timestamp.slice(0, -1).replace('T', ' '),
						revision['*'] ]
			}, function(error) {
				if (error)
					CeL.err(error);
			});
	}, {
		directory : base_directory,
		first : function(fn) {
			var filename = fn.replace(/[^.]+$/, 'csv');
			if (do_write_file === undefined)
				// auto detect
				try {
					// check if file exists
					do_write_file = !require('fs').statSync(filename);
					if (!do_write_file)
						CeL.info('process_data: The CSV file exists, '
								+ 'so I will not import data to database: ['
								+ filename + ']');
				} catch (e) {
					do_write_file = true;
				}

			if (do_write_file) {
				CeL.log('process_data: Write conversed data to [' + filename
						+ ']');
				file_stream = new require('fs').WriteStream(filename, 'utf8');
			}
		},
		last : function() {
			// e.g., "All 2755239 pages, 167.402 s."
			CeL.log('process_data: All ' + count + ' pages, '
					+ (Date.now() - start_read_time) / 1000 + ' s.');
			if (false)
				// 系統上限 2,048 KB
				CeL.log('process_data: Max page length: ' + max_length
						+ ' characters.');

			if (do_write_file) {
				file_stream.end();

				if (!do_realtime_import) {
					setup_SQL(function(error) {
						if (error)
							CeL.err(error);

						CeL.info('process_data: Import data to database...');
						var SQL = LOAD_DATA_SQL + file_stream.path
								+ LOAD_DATA_SQL_post;
						CeL.log(SQL.replace(/\n/g, '\\n'));
						connection.query(SQL, function(error, rows) {
							if (error)
								CeL.err(error);
							endding();
						});
					});
				}
			} else
				endding();
		}
	});
}

function setup_SQL(callback) {
	CeL.info('setup_SQL: Re-creating database...');
	SQL_session = new CeL.wiki.SQL(database_name, function(error) {
		if (error)
			CeL.err(error);

		connection.query('DROP TABLE `' + table_name + '`', function(error) {
			connection.query(CREATE_SQL, callback);
		});

	});
	connection = SQL_session.connection;
}

function endding() {
	CeL.log('endding: All '
			+ ((Date.now() - start_time) / 1000 / 60).toFixed(3) + ' minutes.');
	if (filtered)
		if (filtered.length > 0) {
			var filename = base_directory + 'filtered.lst';
			CeL.info('endding: ' + filtered.length
					+ ' pages filtered, write to [' + filename + '].');
			require('fs').writeFileSync(filename,
					filtered.sort().uniq().join('\n'), 'utf8');
			// console.log(filtered.join('\n'));
		} else
			CeL.info('endding: No page filtered.');
}

function get_sequence(structure) {
	var sequence = [];
	structure.replace(/\)$/, '').replace(/^\(/, '')
	//
	.replace(/\([^()]*\)/g, '').split(',')
	//
	.forEach(function(field) {
		if (!/^\s*(?:PRIMARY\s+)?KEY\s+/i.test(field)) {
			var matched = field.match(/^\s*([^\s]+)/);
			if (matched)
				sequence.push(matched[1]);
		}
	});
	return '(' + sequence.join(',') + ')';
}

var start_time = Date.now(),
/** {Array filtered list */
filtered = [],
/** {String}base directory */
base_directory = bot_directory + 'dumps/',
/** {Boolean}write to CSV file. */
do_write_file, file_stream,
/** {Boolean}import to database realtime: 2016/3/19 Will cause fatal error! */
do_realtime_import = false,
/** {String}database name @ tools-db */
database_name = CeL.wiki.language + 'wiki', table_name = 'page',
// https://www.mediawiki.org/w/api.php?action=help&modules=query%2Brevisions
// page_data = {pageid,ns,title,revisions:[{revid,timestamp,'*'}]}
data_structure = '(pageid INT(10) UNSIGNED NOT NULL, ns INT(11) NOT NULL, title VARBINARY(255) NOT NULL, revid INT(10) UNSIGNED NOT NULL, timestamp TIMESTAMP NOT NULL, text MEDIUMBLOB, PRIMARY KEY (pageid,title))',
// pageid,ns,title: https://www.mediawiki.org/wiki/Manual:Page_table
// revid,timestamp: https://www.mediawiki.org/wiki/Manual:Revision_table
// text: https://www.mediawiki.org/wiki/Manual:Text_table
CREATE_SQL = 'CREATE TABLE `' + table_name + '`' + data_structure,
//
INSERT_SQL = 'INSERT INTO `' + table_name + '`' + get_sequence(data_structure)
		+ ' VALUES (?, ?, ?, ?, ?, ?)',
//
LOAD_DATA_SQL = "LOAD DATA LOCAL INFILE '",
//
LOAD_DATA_SQL_post = "' INTO TABLE `"
		+ table_name
		+ "` FIELDS TERMINATED BY ',' ENCLOSED BY '\"' LINES TERMINATED BY '\n' "
		+ get_sequence(data_structure),
//
SQL_session, connection;

if (do_realtime_import) {
	setup_SQL(function(error) {
		if (error)
			CeL.err(error);

		// FATAL ERROR: JS Allocation failed - process out of memory
		// Aborted
		connection.beginTransaction(process_data);
	});
} else {
	process_data();
}

// --------------------------------------------------------

// TODO
function get_dump_rev_id(pageid) {
	SQL_session = new CeL.wiki.SQL('zhwiki', function(error) {
		if (error)
			CeL.err(error);
	});
	SQL_session.SQL('SELECT revid,text FROM `page` WHERE pageid=' + pageid,
	//
	function(error, rows) {
		if (error)
			CeL.err(error);
		else
			console.log(rows[0].revid);
	});

	SQL_session = new CeL.wiki.SQL(function(error) {
		if (error)
			CeL.err(error);
	}, 'zh');
	SQL_session.SQL('SELECT rev_id FROM `page` WHERE pageid=3233;', function(
			error, rows) {
		if (error)
			CeL.err(error);
		else
			console.log(rows);
	});
}
