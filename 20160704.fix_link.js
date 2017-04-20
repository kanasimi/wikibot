// (cd ~/wikibot && date && hostname && nohup time node 20160704.fix_link.js; date) >> ../cron-tools.cewbot-20160704.fix_link.out &

/*

 2016/7/4 23:17:28	check external link
 2016/8/7 21:47:39	完成。正式運用。

 @see [[mw:Manual:Pywikibot/weblinkchecker.py]], [[ja:プロジェクト:外部リンク]], [[en:Template:Dead link]], [[en:User:cyberbot II]]

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');
// for CeL.application.net.archive.archive_org()
CeL.run('application.net.archive');

// Set default language. 改變預設之語言。 e.g., 'zh'
// set_language('ja');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'wikinews'),

// 7z a archive/fix_link.7z fix_link
cache_directory = base_directory + 'web/',
// did_not_processed[title] = [ URL, ... ];
did_not_processed = CeL.null_Object(),

date_NOW = (new Date).format('%Y年%m月%d日'),

status_is_OK = CeL.application.net.archive.status_is_OK,

check_URL = CeL.application.net.archive.check_URL,
/** {Object}check_URL.link_status[normalized_URL] = status/error */
link_status = check_URL.link_status,

archive_org = CeL.application.net.archive.archive_org,
/** {Object} cached[URL] = [ return of archived data, error ] */
archived_data = archive_org.cached,
// @see {{dead link}}, [[w:en:Archive site]]
/** {String}URL prefix of cached snapshot. */
archived_prefix = archive_org.URL_prefix;

// ---------------------------------------------------------------------//

// Set the umask to share the xml dump file.
if (typeof process === 'object') {
	process.umask(parseInt('0022', 8));
}

// prepare_directory(base_directory, true);
prepare_directory(base_directory);

prepare_directory(cache_directory);

// CeL.set_debug(2);

function get_status() {
	var status = CeL.get_URL.get_status(), connection_list = status.connection_list;
	delete status.connection_list;
	CeL.debug('#' + ++get_status.count + ' ' + JSON.stringify(status)
	// 剩下
	+ '. pages left: 增加URL中 ' + parse_page_left + ' + parse wikitext 與修改中 '
			+ process_page_left + ' + 準備寫入中 ' + waiting_write_page_left
			+ ' + 處理完畢 ' + pages_finished + ' = 所有頁面 ' + all_pages
			//
			+ '. wiki.actions.length = ' + wiki.actions.length
			+ ', wiki.running = ' + wiki.running + '...', 0, 'get_status');
	if (status.connections === status.requests && connection_list
			&& connection_list.length > 0) {
		console.log(connection_list.slice(0, 20));
	}
	if (wiki.actions.length > 0) {
		console.log(wiki.actions.slice(0, 2));
	}
	if (all_parsed && status.connections === 0 && status.requests === 0
			&& pages_finished === all_pages && wiki.actions.length === 0) {
		clearInterval(get_status.interval_id);
	}
}
get_status.count = 0;

// for debug
get_status.interval_id = setInterval(get_status, 60 * 1000);

if (0) {
	// for debug
	wiki.page('Wikinews:沙盒' && '', for_each_page);
	finish_parse_work();
} else {
	CeL.wiki.traversal({
		// [SESSION_KEY]
		session : wiki,
		// cache path prefix
		directory : base_directory,
		// 指定 dump file 放置的 directory。
		// dump_directory : bot_directory + 'dumps/',
		dump_directory : dump_directory,
		// 若 config.filter 非 function，表示要先比對 dump，若修訂版本號相同則使用之，否則自 API 擷取。
		// 設定 config.filter 為 ((true)) 表示要使用預設為最新的 dump，否則將之當作 dump file path。
		filter : true,
		last : finish_parse_work
	}, for_each_page);
}

// ---------------------------------------------------------------------//

var all_parsed;

function finish_parse_work() {
	CeL.info('finish_parse_work: All page parsed. Start checking URLs...');
	all_parsed = true;
}

// ---------------------------------------------------------------------//

var all_pages = 0, pages_finished = 0, parse_page_left = 0;

function for_each_page(page_data) {
	all_pages++;
	if (!page_data || ('missing' in page_data)) {
		finish_1_page();
		// error?
		return [ CeL.wiki.edit.cancel, '條目已不存在或被刪除' ];
	}
	if (page_data.ns !== 0) {
		finish_1_page();
		return [ CeL.wiki.edit.cancel, '本作業僅處理條目命名空間或模板或 Category' ];
	}

	/** {String}page title = page_data.title */
	var title = CeL.wiki.title_of(page_data),
	/**
	 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
	 */
	content = CeL.wiki.content_of(page_data);

	if (!content) {
		finish_1_page();
		return [ CeL.wiki.edit.cancel,
				'No contents: [[' + title + ']]! 沒有頁面內容！' ];
	}

	// -------------------------------------------------

	parse_page_left++;

	var matched, link_hash = CeL.null_Object(),
	/**
	 * 匹配URL網址。
	 * 
	 * [http://...]<br />
	 * {{|url=http://...}}
	 * 
	 * matched: [ URL ]
	 * 
	 * @type {RegExp}
	 * 
	 * @see PATTERN_URL_GLOBAL @ application.net.wiki
	 */
	PATTERN_URL_GLOBAL_2 = /https?:\/\/([^\s\|<>\[\]{}]+|{[^{}]*})+/ig;

	// 找出所有合 pattern (PATTERN_URL_GLOBAL_2) 之 URL。
	while (matched = PATTERN_URL_GLOBAL_2.exec(content)) {
		var URL = matched[0]
		// 去掉標點。
		.replace(/[，；。！]+$/g, '');
		// 跳過 cache URL。
		if (!URL.startsWith(archived_prefix) && URL.includes('//')) {
			// register 登記 URL。
			link_hash[URL] = true;
		}
	}

	// TODO: 去掉所有已處理之 URL。

	// -------------------------------------------------

	// 一個個處理所有 URL。

	var link_list = Object.keys(link_hash), links_left = link_list.length;
	if (links_left.length === 0) {
		CeL.debug('[[' + title + ']]: 本頁面未發現需處理之外部連結 external link。', 2,
				'for_each_page');
		parse_page_left--;
		finish_1_page();
		return;
	}

	CeL.debug('[[' + title + ']]: 有' + links_left.length
			+ '個需處理之外部連結 external link。', 0, 'for_each_page');

	link_list.forEach(function(URL) {
		check_URL(URL, function(link_status, cached_data) {
			if (--links_left === 0) {
				parse_page_left--;
				add_dead_link_mark(page_data, link_hash);
			} else {
				CeL.debug('[[' + title + ']]: left ' + links_left + ' [' + URL
						+ ']: ' + link_status + '。', 1, 'for_each_page');
			}
		}, {
			write_to_directory : cache_directory
		});
	});

	if (false) {
		var parser = CeL.wiki.parser(page_data);
		// 趁 check_URL(URL) 的閒置時 parse。
		setTimeout(function() {
			parser.parse();
		}, 20);
	}
}

// ---------------------------------------------------------------------//

// TODO: 處理原有之 {{dead link}}
// assert: {{dead link}} 必須與原node在同一階層上，剛好在正後面！
// token_index
function get_dead_link_node(index, parent) {
	// 往後找。
	while (++index < parent.length) {
		var token = parent[index];
		// 跳過純文字(wikitext)
		if (token.type) {
			if (token.type === 'transclusion' && token.name === 'Dead link') {
				return index;
			}
			break;
		}
	}
	// NOT_FOUND
	return -1;
}

// -------------------

function dead_link_text(token, URL, normalized_URL) {
	var archived = archived_data[normalized_URL];
	if (archived) {
		archived = archived[0];
	}
	return token.toString()
	// [[Template:Dead link]]
	+ '{{dead link|date=' + date_NOW
	//
	+ '|bot=' + user_name + '|status=' + link_status[normalized_URL]
	// 允許 archiveurl 以直接連到最近的 cached snapshots，
	// 且 archiveurl 不限於 web.archive.org。
	+ (archived ?
	// '|url=' + archived.archived_url +
	// @see 'archiveurl' or 'archive-url':
	// 與[[w:en:Module:Citation/CS1/Configuration]]同步
	'|archiveurl=' + archived.url
	//
	: '|broken_url=' + URL
	// archive site 中確定沒資料的，表示沒救了。永久失效連結。
	+ (normalized_URL in archived_data ? '|fix-attempted=' + date_NOW : ''))
			+ '}}';
}

// -------------------

var process_page_left = 0, waiting_write_page_left = 0;

function add_dead_link_mark(page_data, link_hash) {
	// post-process of page
	process_page_left++;

	/** {String}page title = page_data.title */
	var title = CeL.wiki.title_of(page_data),
	//
	dead_link_count = 0;

	function process_token(token, index, parent, URL) {
		// 登記已處理過或無須處理之URL。
		delete link_hash[URL];

		var normalized_URL = check_URL.normalize_URL(URL);
		if (normalized_URL.startsWith(archived_prefix)
				|| !normalized_URL.includes('//')) {
			return;
		}

		if (!(normalized_URL in link_status)) {
			if (title in did_not_processed) {
				did_not_processed[title].push(URL);
			} else {
				did_not_processed[title] = [ URL ];
			}
			var message = 'process_token: [[' + title + ']]: 沒處理到的 URL [' + URL
					+ ']';
			if (/^https?:\/\//.test(URL)) {
				// 這些大部分可能是在註解中，或是應該手動更改的。
				// throw new Error(message);
				CeL.error(message);
			}
			CeL.warn(message);
			return;
		}

		if (status_is_OK(link_status[normalized_URL])) {
			return;
		}

		var dead_link_node_index = get_dead_link_node(index, parent);
		CeL.debug('[[' + title + ']]: assert: 已處理過，'
				+ (dead_link_node_index > 0 ? '  有  ' : '**無**')
				+ '{{dead link}}: index ' + index + '⇒' + dead_link_node_index
				+ '。' + token, 3, 'process_token');

		if (!(dead_link_node_index > 0)) {
			dead_link_count++;
			return dead_link_text(token, URL, normalized_URL);
		}
	}

	// -------------------------------------------------

	CeL.debug('[[' + title
			+ ']]: 已檢查過本頁所有 URL 與 archive site。開始添加{{dead link}}。', 1,
			'add_dead_link_mark');

	var parser = CeL.wiki.parser(page_data).parse();
	if (CeL.wiki.content_of(page_data) !== parser.toString()) {
		// debug 用. check parser, test if parser working properly.
		throw 'Parser error: [[' + page_data.title + ']]';
	}

	// assert: parser.parsed === true

	// -------------------

	// 處理 {{|url=http://...}}
	parser.each('template', function(token, index, parent) {
		var URL = token.parameters.url;
		if (URL) {
			// 去掉 tag, <!-- -->
			URL = URL.toString().replace(/<[^<>]+>/g, '').trim();
		}

		if (token.name === 'Dead link') {
			// 登記已處理過或無須處理之URL。
			if (token.parameters.broken_url) {
				delete link_hash[token.parameters.broken_url];
			}
			return;
		}

		if (!URL) {
			if (token.name in {
				Source : true,
				ROC : true,
				VOA : true
			}) {
				CeL.warn('[[' + title + ']]: 未設定 URL: ' + token);
			}
			return;
		}

		var stamp = 'accessdate='
		// 以最後編輯時間自動添加 accessdate 參數。
		+ new Date(page_data.revisions[0].timestamp).format('%Y年%m月%d日');
		if (token.parameters.accessdate) {
			// 更新 stamp。
			token[token.index_of.accessdate] = stamp;
		} else {
			token.push(stamp);
		}
		return process_token(token, index, parent, URL);
	}, true);

	// -------------------

	// 處理外部連結 external link [http://...]
	parser.each('external link', function(token, index, parent) {
		var URL = token[0].toString();
		return process_token(token, index, parent, URL);
	}, true);

	// -------------------

	// 處理 bare / plain URLs in wikitext: https:// @ wikitext
	// @see [[w:en:Help:Link#Http: and https:]]
	parser.each('url', function(token, index, parent) {
		if (!token.is_bare) {
			return;
		}
		var URL = token.toString();
		return process_token(token, index, parent, URL);
	}, true);

	// -------------------------------------------------

	var reporter = [];
	for ( var URL in link_hash) {
		var normalized_URL = check_URL.normalize_URL(URL);
		if (!status_is_OK(link_status[normalized_URL])) {
			reporter.push('[' + URL + ' '
					+ (link_status[normalized_URL] || 'no status') + ']');
		}
	}

	if (reporter.length > 0) {
		// CeL.log('-'.repeat(80));
		CeL.log('; [[' + title + ']] 尚未處理之 URL:');
		CeL.log(': ' + reporter.join(', '));
	}

	// -------------------

	CeL.debug('[[' + title + ']]: 有' + dead_link_count + '個新{{dead link}}。', 1,
			'add_dead_link_mark');

	process_page_left--;
	if (!(dead_link_count > 0)) {
		finish_1_page();
		return;
	}

	waiting_write_page_left++;
	wiki.page(page_data).edit(parser.toString(), {
		summary : '檢查與維護外部連結: ' + dead_link_count + '個失效連結',
		nocreate : 1,
		bot : 1
	}, function(page_data, error, result) {
		waiting_write_page_left--;
		finish_1_page();
		if (error) {
			console.error(error);
			console.trace('[[' + title + ']]: error');
		} else {
			CeL.debug('[[' + title + ']]: 已寫入' + dead_link_count
			//
			+ '個新{{dead link}}之資料。', 1, 'add_dead_link_mark');
		}
	});
	CeL.debug('[[' + title + ']]: 將寫入新資料。', 1, 'add_dead_link_mark');
}

// ---------------------------------------------------------------------//

function finish_1_page() {
	pages_finished++;
	if (!all_parsed || pages_finished < all_pages) {
		return;
	}
	// assert: pages_finished === all_pages

	for ( var title in did_not_processed) {
		CeL.info('[[' + title + ']]: 沒處理到的 URL:\n	'
				+ did_not_processed[title].join('\n	'));
	}

	CeL.log('All done.');

	try {
		clearInterval(get_status.interval_id);
	} catch (e) {
		// TODO: handle exception
	}
}
