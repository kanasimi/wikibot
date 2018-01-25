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
MIN_COUNT = 20, reget = true,
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

get_most_sitelinked_items(function(items_of_count, item_count_of) {
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
			item_count_of : item_count_of
		});
	}, {
		reget : reget,
		item_count_of : item_count_of
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

		CeL.info('All ' + rows.length + ' items.');
		var items_of_count = CeL.null_Object(), item_count_of = [];
		rows.forEach(function(row) {
			var item_id = row.ips_item_id, link_count = row.link_count;
			// item_count_of[item_id] = link_count
			item_count_of[item_id] = link_count;
			// items_of_count[link_count] = [ item_id, item_id, item_id, ... ]
			if (items_of_count[link_count]) {
				items_of_count[link_count].push(item_id);
			} else {
				items_of_count[link_count] = [ item_id ];
			}
		});

		CeL.write_file(data_filename, JSON.stringify([ items_of_count,
				item_count_of ]));
		callback(items_of_count, item_count_of);
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
	SQL_get_sitelink_count = 'SELECT ips_item_id, COUNT(*) AS `link_count` FROM wb_items_per_site GROUP BY ips_item_id HAVING `link_count` > '
			+ MIN_COUNT + ' ORDER BY ips_item_id';

	CeL.info('get_most_sitelinked_items: Run SQL: ' + SQL_get_sitelink_count);

	SQL_session.SQL(SQL_get_sitelink_count, write_most_sitelinked_items);
}

function get_most_sitelinked_items_exclude_language(language, callback, options) {
	function write_most_sitelinked_items_exclude_language(error, rows, fields) {
		if (error) {
			throw error;
		}

		CeL.info(language + ': ' + rows.length + ' items. Filtering items...');
		var items_of_count = CeL.null_Object(), item_hash = CeL.null_Object(), item_list = [];
		rows.forEach(function(row) {
			// row: 在language這個語言中有的項目
			item_hash[row.ips_item_id] = undefined;
		});
		var item_count_of = options.item_count_of;
		for ( var item_id in item_count_of) {
			if (item_id in item_hash) {
				return;
			}
			item_list.push(item_id);
			var link_count = item_count_of[item_id];
			// items_of_count[link_count] = [ item_id, item_id, item_id, ... ]
			if (link_count in items_of_count) {
				items_of_count[link_count].push(item_id);
			} else {
				items_of_count[link_count] = [ item_id ];
			}
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

	SQL_get_sitelink_count = 'SELECT ips_item_id FROM wb_items_per_site WHERE ips_item_id IN (SELECT ips_item_id FROM wb_items_per_site GROUP BY ips_item_id HAVING COUNT(*) > '
			+ MIN_COUNT
			+ ') AND ips_site_id = "'
			+ language
			+ 'wiki" ORDER BY ips_item_id';

	CeL.info('get_most_sitelinked_items_exclude_language: Run SQL: '
			+ SQL_get_sitelink_count);

	SQL_session.SQL(SQL_get_sitelink_count,
			write_most_sitelinked_items_exclude_language);
}
