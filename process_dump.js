// cd ~/wikibot && time ../node/bin/node process_dump.js

// 2016/3/12 11:56:10	初版試營運

// 使用新版 node.js 能加快速度，降低 CPU 與 RAM 使用；
// 2016/3/19 do_write_file 使用時間約需近 20 min，LOAD DATA 使用時間約需近 10 min。

'use strict';

require('./wiki loder.js');
// for CeL.wiki.cache(), CeL.fs_mkdir(), CeL.wiki.read_dump()
CeL.run('application.platform.nodejs');

function process_data(error) {
	if (error)
		CeL.err(error);

	var start_read_time = Date.now(), count = 0, max_length = 0;
	CeL.wiki.read_dump(function(page_data, filename) {
		// filter
		if (false && page_data.ns !== 0)
			return;

		var revision = page_data.revisions[0];

		if (++count % 10000 === 0)
			// e.g., "2660000: 16.546 page/ms Wikipedia:优良条目/2015年8月23日"
			CeL.log(count + ': '
					+ (count / (Date.now() - start_read_time)).toFixed(3)
					+ ' page/ms\t' + page_data.title);
		// var title = page_data.title, content = revision['*'];

		// Check data.

		// 似乎沒 !page_data.title 這種問題。
		if (false && !page_data.title)
			CeL.warn('* No title: [[' + page_data.id + ']]');
		// [[Wikipedia:快速删除方针]]
		if (revision['*'])
			max_length = Math.max(max_length, revision['*'].length);
		else
			CeL.warn('* No content: [[' + page_data.title + ']]');

		// Write to .csv file.

		if (do_write_file) {
			file_stream.write([ page_data.pageid, page_data.ns,
			// escape ',', '"'
			'"' + page_data.title.replace(/"/g, '""') + '"',
			// '2000-01-01T00:00:00Z' → '2000-01-01 00:00:00'
			revision.timestamp.slice(0, -1).replace('T', ' '),
			//
			'"' + revision['*'].replace(/"/g, '""') + '"' ]
			//
			.join(',') + '\n');
		}

		// Write to database.

		if (do_realtime_import)
			connection.query({
				sql : 'INSERT INTO `page`(pageid,ns,title,timestamp,text)'
						+ ' VALUES (?, ?, ?, ?, ?);',
				values : [ page_data.pageid, page_data.ns, page_data.title,
				// '2000-01-01T00:00:00Z' → '2000-01-01 00:00:00'
				revision.timestamp.slice(0, -1).replace('T', ' '),
				revision['*'] ]
			}, function(error) {
				if (error)
					CeL.err(error);
			});
	}, {
		directory : bot_directory + 'dumps/',
		first : function(fn) {
			var filename = fn.replace(/[^.]+$/, 'csv');
			CeL.log('process_data: Write to [' + filename + ']');
			if (do_write_file)
				file_stream = new require('fs').WriteStream(filename, 'utf8');
		},
		last : function() {
			// e.g., "All 2755239 pages, 167.402 s."
			CeL.log('process_data: All ' + count + ' pages, ' + (Date.now() - start_read_time)
					/ 1000 + ' s. Max page length: ' + max_length);

			if (do_write_file) {
				file_stream.end();

				if (!do_realtime_import) {
					setup_SQL(function(error) {
						if (error)
							CeL.err(error);

						CeL.info('process_data: Import data to database...');
						var SQL = "LOAD DATA LOCAL INFILE '" + file_stream.path
						//
						+ "' INTO TABLE `page` FIELDS TERMINATED BY ',' ENCLOSED BY '\"' LINES TERMINATED BY '\n' (pageid,ns,title,timestamp,text);";
						CeL.log(SQL.replace(/\\n/g, '\\n'));
						connection.query(SQL, function(error, rows) {
							if (error)
								CeL.err(error);
							else
								CeL.log(rows);
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
	SQL_session = new CeL.wiki.SQL('zhwiki', function(error) {
		if (error)
			CeL.err(error);

		connection.query('DROP TABLE `page`', function(error) {
			connection.query(create_SQL, callback);
		});

	});
	connection = SQL_session.connection;
}

function endding() {
	CeL.log('endding: All ' + (Date.now() - start_time) / 1000 / 60 + ' min.');
}

var start_time = Date.now(),
/** {Boolean}write to CSV file. */
do_write_file = true, file_stream,
/** {Boolean}import to database */
do_realtime_import = false,
// pageid,ns,title: https://www.mediawiki.org/wiki/Manual:Page_table
// timestamp: https://www.mediawiki.org/wiki/Manual:Revision_table
// text: https://www.mediawiki.org/wiki/Manual:Text_table
create_SQL = 'CREATE TABLE page(pageid INT(10) UNSIGNED NOT NULL, ns INT(11) NOT NULL, title VARBINARY(255) NOT NULL, timestamp TIMESTAMP NOT NULL, text MEDIUMBLOB, PRIMARY KEY (pageid,title))',
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
