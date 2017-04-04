// cd ~/wikibot && date && time /shared/bin/node process_dump.js && date
// Import Wikimedia database backup dumps data to user-created database on Tool Labs.
// 應用工具: 遍歷所有 dumps data 之頁面，並將資料寫入 .csv file，進而匯入 database。
// @see https://www.mediawiki.org/wiki/Manual:Importing_XML_dumps#Using_importDump.php.2C_if_you_have_shell_access

// 2016/3/12 11:56:10	初版試營運。純粹篩選約需近 3 minutes。

// 使用新版 node.js 能加快寫入 .csv file 之速度，降低 CPU 與 RAM 使用；
// 2016/3/19 do_write_CSV 使用時間約需近 20 minutes，LOAD DATA 使用時間約需近 10 minutes 執行。

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

function process_data(error) {
	if (error)
		CeL.err(error);

	var start_read_time = Date.now(),
	// max_length = 0,
	count = 0;
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

		var revision = page_data.revisions[0];
		// var title = page_data.title, content = revision['*'];

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
		// Write to rev file.

		if (do_write_rev) {
			lastest_revid[page_data.pageid] = [ revision.revid, page_anchor[0],
					page_anchor[1] ];
		}

		// ----------------------------
		// Write to .csv file.

		if (do_write_CSV) {
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

		if (do_realtime_import) {
			connection.query({
				sql : INSERT_SQL,
				// @see data_structure
				values : [ page_data.pageid, page_data.ns,
				//
				page_data.title, revision.revid,
				// '2000-01-01T00:00:00Z' → '2000-01-01 00:00:00'
				revision.timestamp.slice(0, -1).replace('T', ' '),
						revision['*'] ]
			}, function(error) {
				if (error)
					CeL.err(error);
			});
		}

	}, {
		directory : base_directory,
		first : function(xml_filename) {
			file_size = node_fs.statSync(xml_filename).size;
			var filename = xml_filename.replace(/[^.]+$/, 'csv');
			if (do_write_CSV === undefined)
				// auto detect
				try {
					// check if file exists
					do_write_CSV = !node_fs.statSync(filename);
					if (!do_write_CSV)
						CeL.info('process_data: The CSV file exists, '
								+ 'so I will not import data to database: ['
								+ filename + ']');
				} catch (e) {
					do_write_CSV = true;
				}

			if (do_write_CSV) {
				CeL.log('process_data: Write conversed data to [' + filename
						+ ']');
				file_stream = new node_fs.WriteStream(filename, 'utf8');
			}
		},
		last : function(anchor) {
			// e.g., "All 2755239 pages in dump xml file, 167.402 s."
			// includes redirection 包含重新導向頁面.
			CeL.log('process_data: All ' + count + ' pages in dump xml file, '
					+ (Date.now() - start_read_time) / 1000 + ' s.');
			if (false)
				// 系統上限 2,048 KB
				CeL.log('process_data: Max page length: ' + max_length
						+ ' characters.');

			if (false)
				CeL.fs_write(base_directory + 'anchor.json', JSON
						.stringify(anchor), 'utf8');

			if (do_write_rev) {
				CeL.fs_write(base_directory + 'lastest_revid.json', JSON
						.stringify(lastest_revid), 'utf8');
			}

			if (do_write_CSV) {
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
			} else {
				endding();
			}
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
			node_fs.writeFileSync(filename, filtered.sort().unique_sorted()
					.join('\n'), 'utf8');
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

var node_fs = require('fs'),
//
start_time = Date.now(),
/** {Natural}檔案長度。掌握進度用。 */
file_size,
/** {Array filtered list */
filtered = [],
/** {String}base directory */
base_directory = '/shared/dumps/',
// base_directory = bot_directory + 'dumps/',
/** {Boolean}write to lastest revid file. */
do_write_rev = true,
/** {Boolean}write to CSV file. */
do_write_CSV, file_stream,
/** {Boolean}import to database realtime: 2016/3/19 Will cause fatal error! */
do_realtime_import = false,
/** {String}database name @ tools-db */
database_name = CeL.wiki.language + 'wiki', table_name = 'page',
// https://www.mediawiki.org/w/api.php?action=help&modules=query%2Brevisions
// page_data = {pageid,ns,title,revisions:[{revid,timestamp,'*'}]}
data_structure = '(`pageid` INT(10) UNSIGNED NOT NULL, `ns` INT(11) NOT NULL, `title` VARBINARY(255) NOT NULL, `revid` INT(10) UNSIGNED NOT NULL, `timestamp` TIMESTAMP NOT NULL, `text` MEDIUMBLOB, PRIMARY KEY (`pageid`,`title`))',
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
SQL_session, connection,
// 2016/3/25 當前採用 {Array} 會比 {Object} 更精簡: 37079536/51543528
lastest_revid = [];

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
