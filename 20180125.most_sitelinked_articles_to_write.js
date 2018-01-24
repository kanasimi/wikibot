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

var SQL_session = new CeL.wiki.SQL(function(error) {
	if (error) {
		throw error;
	}
}, 'wikidata');

get_most_sitelinked_items(function(item_of_count) {
	get_most_sitelinked_items(function(item_of_count) {
		get_most_sitelinked_items(function(item_of_count) {
			if (false) {
				console.log(Object.keys(item_of_count.map(function(count) {
					return +count;
				}).sort(function(a, b) {
					return a - b;
				})));
			}
			CeL.info('Done.');
		}, 'ja', reget);
	}, 'zh', reget);
}, null, reget);

// get sitelink count of wikidata items
// https://www.mediawiki.org/wiki/Wikibase/Schema/wb_items_per_site
// https://www.wikidata.org/w/api.php?action=help&modules=wbsetsitelink
function get_most_sitelinked_items(callback, include_language, reget) {
	function write_most_sitelinked_items(error, rows, fields) {
		if (error) {
			throw error;
		}

		if (include_language) {
			CeL.info(include_language + ': ' + rows.length + ' items.');
			item_of_count = rows.map(function(row) {
				return row.ips_item_id;
			});
		} else {
			CeL.info('All ' + rows.length + ' items.');
			item_of_count = CeL.null_Object();
			rows.forEach(function(row) {
				if (item_of_count[row.link_count]) {
					item_of_count[row.link_count].push(row.ips_item_id);
				} else {
					item_of_count[row.link_count] = [ row.ips_item_id ];
				}
			});
		}
		CeL.write_file(include_language ? most_sitelinked_items_filename
				.replace(/(\.[a-z]+)?$/, '.' + include_language + '$1')
				: most_sitelinked_items_filename, item_of_count);
		callback(item_of_count);
	}

	// item_of_count[count] = [ id, id, id ]
	var item_of_count;
	if (!reget
			&& (item_of_count = CeL.read_file(most_sitelinked_items_filename))) {
		callback(item_of_count);
		return;
	}

	var SQL_get_sitelink_count;
	if (include_language) {
		// Error: ER_OPERAND_COLUMNS: Operand should contain 1 column(s)
		SQL_get_sitelink_count = 'SELECT ips_item_id FROM wb_items_per_site WHERE ips_item_id IN ('
				+ SQL_get_sitelink_count
				+ ') AND ips_site_id = "'
				+ include_language + 'wiki"';

		SQL_get_sitelink_count = 'SELECT ips_item_id FROM wb_items_per_site WHERE ips_item_id IN (SELECT ips_item_id FROM wb_items_per_site GROUP BY ips_item_id HAVING COUNT(*) > '
				+ MIN_COUNT
				+ ') AND ips_site_id = "'
				+ include_language
				+ 'wiki"';
	} else {
		// 若是採用
		// HAVING SUM(CASE WHEN ips_site_id = "jawiki" THEN 1 ELSE 0 END) = 0
		// ORDER BY `link_count` DESC
		// 之類的方法，將大大增加查詢的時間。
		SQL_get_sitelink_count = 'SELECT ips_item_id, COUNT(*) AS `link_count` FROM wb_items_per_site GROUP BY ips_item_id HAVING `link_count` > '
				+ MIN_COUNT;
	}

	CeL.info('Run SQL: ' + SQL_get_sitelink_count);

	SQL_session.SQL(SQL_get_sitelink_count, write_most_sitelinked_items);
}
