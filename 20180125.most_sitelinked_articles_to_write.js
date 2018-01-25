/*

	初版完成，試營運。


@see


 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

CeL.run('application.storage');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),
//
MIN_COUNT = 50, reget = true,
//
most_sitelinked_items_filename = 'most_sitelinked_items.json';

/** {String}編輯摘要。總結報告。 */
summary = '';

// ----------------------------------------------------------------------------

// CeL.set_debug(6);

var items_without = CeL.null_Object(),
//
SQL_session = new CeL.wiki.SQL(function(error) {
	if (error) {
		throw error;
	}
}, 'wikidata');

get_most_sitelinked_items(function(items_of_count, item_count_pairs) {
	get_most_sitelinked_items_exclude_language('zh', function(items_of_count,
			item_list) {
		get_most_sitelinked_items_exclude_language('ja', function(
				items_of_count, item_list) {
			SQL_session.connection.destroy();
			if (false) {
				console.log(Object.keys(items_of_count.map(function(count) {
					return +count;
				}).sort(function(a, b) {
					return a - b;
				})));
			}
			CeL.info('Done.');
		}, {
			reget : reget,
			item_count_pairs : item_count_pairs
		});
	}, {
		reget : reget,
		item_count_pairs : item_count_pairs
	});
}, {
	reget : reget
});

// get sitelink count of wikidata items
// https://www.mediawiki.org/wiki/Wikibase/Schema/wb_items_per_site
// https://www.wikidata.org/w/api.php?action=help&modules=wbsetsitelink
function get_most_sitelinked_items(callback, options) {
	function write_most_sitelinked_items(error, rows, fields) {
		if (error) {
			throw error;
		}

		CeL.info('All ' + rows.length + ' items more than ' + MIN_COUNT
				+ ' sitelinks.');
		var items_of_count = CeL.null_Object(), item_count_pairs = [];
		rows.forEach(function(row) {
			var item_id = row.ips_item_id, link_count = row.link_count;
			// item_count_pairs = [ [item_id,link_count], ... ]
			item_count_pairs.push([ item_id, link_count ]);
			// items_of_count[link_count] = [ item_id, item_id, item_id, ... ]
			if (items_of_count[link_count]) {
				items_of_count[link_count].push(item_id);
			} else {
				items_of_count[link_count] = [ item_id ];
			}
		});

		CeL.write_file(data_filename, JSON.stringify([ items_of_count,
				item_count_pairs ]));
		callback(items_of_count, item_count_pairs);
	}

	options = CeL.setup_options(options);
	var data_filename = options.filename || most_sitelinked_items_filename;

	if (!options.reget) {
		var JSON_data = CeL.read_file(data_filename);
		if (JSON_data) {
			callback(JSON_data[0], JSON_data[1]);
			return;
		}
	}

	var SQL_get_sitelink_count;
	// 若是採用
	// HAVING SUM(CASE WHEN ips_site_id = "jawiki" THEN 1 ELSE 0 END) = 0
	// ORDER BY `link_count` DESC
	// 之類的方法，將大大增加查詢的時間。
	SQL_get_sitelink_count = 'SELECT ips_item_id, COUNT(*) AS `link_count` FROM wb_items_per_site GROUP BY ips_item_id HAVING `link_count` >= '
			+ MIN_COUNT + ' ORDER BY ips_item_id';

	CeL.info('get_most_sitelinked_items: Run SQL: ' + SQL_get_sitelink_count);

	SQL_session.SQL(SQL_get_sitelink_count, write_most_sitelinked_items);
}

function get_most_sitelinked_items_exclude_language(language, callback, options) {
	function write_most_sitelinked_items_exclude_language(error, rows, fields) {
		if (error) {
			throw error;
		}

		// row: 在 language 這個語言中有的項目。
		CeL.info(language + ': ' + rows.length + ' items more than '
				+ MIN_COUNT + ' sitelinks. Filtering items...');
		var items_of_count = CeL.null_Object(), item_list = [], index_of_rows = 0, id_of_current_row = rows[index_of_rows].ips_item_id;
		// 示意範例: rows = [ 1,3,5 ]
		// item_count_pairs = [ [1,1], [2,1], [3,1], [4,1], [5,1], ]
		options.item_count_pairs.forEach(function(pair) {
			var item_id = pair[0];
			if (item_id === id_of_current_row) {
				id_of_current_row = rows[++index_of_rows]
						&& rows[index_of_rows].ips_item_id;
				return;
			}

			item_list.push(item_id);
			var link_count = pair[1];
			// items_of_count[link_count] = [ item_id, item_id, item_id, ... ]
			if (link_count in items_of_count) {
				items_of_count[link_count].push(item_id);
			} else {
				items_of_count[link_count] = [ item_id ];
			}
		});
		if (id_of_current_row) {
			throw '當前 rows[' + index_of_rows + '] 還有資訊尚未處理!';
		}

		CeL.write_file(data_filename, JSON.stringify([ items_of_count,
				item_list ]));
		callback(items_of_count, item_list);
	}

	options = CeL.setup_options(options);
	var data_filename = options.filename
			|| most_sitelinked_items_filename.replace(/(\.[a-z]+)?$/,
					'.exclude_' + language + '$1');

	if (!options.reget) {
		var JSON_data = CeL.read_file(data_filename);
		if (JSON_data) {
			callback(JSON_data[0], JSON_data[1]);
			return;
		}
	}

	var SQL_get_sitelink_count;
	// Error: ER_OPERAND_COLUMNS: Operand should contain 1 column(s)
	SQL_get_sitelink_count = 'SELECT ips_item_id FROM wb_items_per_site WHERE ips_item_id IN ('
			+ SQL_get_sitelink_count
			+ ') AND ips_site_id = "'
			+ language
			+ 'wiki"';

	SQL_get_sitelink_count = 'SELECT ips_item_id FROM wb_items_per_site WHERE ips_item_id IN (SELECT ips_item_id FROM wb_items_per_site GROUP BY ips_item_id HAVING COUNT(*) >= '
			+ MIN_COUNT
			+ ') AND ips_site_id = "'
			+ language
			+ 'wiki" ORDER BY ips_item_id';

	CeL.info('get_most_sitelinked_items_exclude_language: Run SQL: '
			+ SQL_get_sitelink_count);

	SQL_session.SQL(SQL_get_sitelink_count,
			write_most_sitelinked_items_exclude_language);
}
