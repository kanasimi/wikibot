// cd ~/wikibot && time ../node/bin/node process_dump.js

/*

 2016/3/12 11:56:10	初版試營運
 上路前修正
 完善

 */

'use strict';

require('./wiki loder.js');
// for CeL.wiki.cache(), CeL.fs_mkdir(), CeL.wiki.read_dump()
CeL.run('application.platform.nodejs');

function import_data(error) {
	if (error)
		console.error(error);

	CeL.wiki.read_dump(function(page_data, filename) {
		if (++count % 10000 === 0)
			// e.g., "2660000: 16.546 page/ms Wikipedia:优良条目/2015年8月23日"
			CeL.log(count + ': '
					+ (count / (Date.now() - start_time)).toFixed(3)
					+ ' page/ms\t' + page_data.title);
		// var title = page_data.title, content = page_data.revisions[0]['*'];
		// 似乎沒這種問題。
		if (false && !page_data.title)
			CeL.warn('* No title: [[' + page_data.id + ']]');
		// [[Wikipedia:快速删除方针]]
		if (!page_data.revisions[0]['*'])
			CeL.warn('* No content: [[' + page_data.title + ']]');

		// Write to .csv

		var title = page_data.title;
		if (title.includes('"'))
			// escape
			title = '"' + title.replace(/"/g, '""') + '"';
		if (do_write_file) {
			file_stream.write([ page_data.pageid, page_data.ns, title,
			// '2000-01-01T00:00:00Z' → '2000-01-01 00:00:00'
			page_data.revisions[0].timestamp.slice(0, -1).replace('T', ' '),
			//
			'"' + page_data.revisions[0]['*'].replace(/"/g, '""') + '"' ]
			//
			.join(',') + '\n');
		}

		// Write to database

		if (do_realtime_import)
			connection.query({
				sql : 'INSERT INTO `page`(pageid,ns,title,timestamp,text)'
						+ ' VALUES (?, ?, ?, ?, ?);',
				values : [ page_data.pageid, page_data.ns, page_data.title,
				// '2000-01-01T00:00:00Z' → '2000-01-01 00:00:00'
				page_data.revisions[0].timestamp.slice(0, -1).replace('T', ' '),
				page_data.revisions[0]['*'] ]
			}, function(error) {
				if (error)
					console.error(error);
			});
	}, {
		directory : bot_directory + 'dumps/',
		first : function(fn) {
			var filename = fn.replace(/[^.]+$/, 'csv');
			CeL.log('Write to [' + filename + ']');
			if (do_write_file)
				file_stream = new require('fs').WriteStream(filename, 'utf8');
		},
		last : function() {
			if (do_write_file) {
				file_stream.end();
				if (!do_realtime_import) {
					setup_SQL(function(error) {
						if (error)
							console.error(error);

						connection.query("LOAD DATA LOCAL INFILE '" + file_stream.path
						//
						+ "' INTO TABLE `page` FIELDS TERMINATED BY ',' ENCLOSED BY '\"' LINES TERMINATED BY '\n' (pageid,ns,title,timestamp,text);");
					});
				}
			}
			// e.g., "All 2755239 pages, 167.402 s."
			CeL.log('All ' + count + ' pages, ' + (Date.now() - start_time)
					/ 1000 + ' s.');
		}
	});
}


function setup_SQL(callback) {
	SQL_session = new CeL.wiki.SQL('zhwiki', function(error) {
		if (error)
			console.error(error);

		connection.query('DROP TABLE `page`', function(error) {
			connection.query(create_SQL, callback);
		});

	});
	connection = SQL_session.connection;
}


var start_time = Date.now(), count = 0,
/** {Boolean}import to database */
do_realtime_import,
// 使用新版 node.js 能加快速度，降低 CPU 與 RAM 使用，使用時間約需近 20 min。
/** {Boolean}write to CSV file. */
do_write_file = true, file_stream,
// pageid,ns,title: https://www.mediawiki.org/wiki/Manual:Page_table
// timestamp: https://www.mediawiki.org/wiki/Manual:Revision_table
// text: https://www.mediawiki.org/wiki/Manual:Text_table
create_SQL = 'CREATE TABLE page(pageid INT(10) UNSIGNED NOT NULL, ns INT(11) NOT NULL, title VARBINARY(255) NOT NULL, timestamp TIMESTAMP NOT NULL, text MEDIUMBLOB, PRIMARY KEY (pageid,title))',
//
SQL_session, connection;


if (do_realtime_import) {
	setup_SQL(function(error) {
		if (error)
			console.error(error);

		// FATAL ERROR: JS Allocation failed - process out of memory
		// Aborted
		connection.beginTransaction(import_data);
	});
} else {
	import_data();
}

/**
 * <code>
 LOAD DATA INFILE 'dumps/zhwiki-20160305-pages-articles.csv'
 INTO TABLE `page`
 FIELDS TERMINATED BY ','
 ENCLOSED BY '"'
 LINES TERMINATED BY '\n'
 IGNORE 1 ROWS;
 </code>
 */
