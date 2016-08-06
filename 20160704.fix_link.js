// (cd ~/wikibot && date && hostname && nohup time node 20160704.fix_link.js; date) >> ../cron-tools.cewbot-20160704.fix_link.out &

/*

 2016/7/4 23:17:28	check external link

 @see [[mw:Manual:Pywikibot/weblinkchecker.py]], [[ja:プロジェクト:外部リンク]], [[en:Template:Dead link]], [[en:User:cyberbot II]]

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');
// for CeL.application.net.archive.archive_org()
CeL.run('application.net.archive');

// Set default language. 改變預設之語言。 e.g., 'zh'
// set_language('ja');

var dns = require('dns');
// 短時間內 request 過多 host names 會造成 Tool Labs 常常 getaddrinfo ENOTFOUND。
dns.setServers(dns.getServers().append([ '8.8.8.8', '8.8.4.4' ]));

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'wikinews'),

cache_directory = base_directory + 'web/',

date_NOW = (new Date).format('%Y年%m月%d日'),

status_is_OK = CeL.application.net.archive.status_is_OK,

check_URL = CeL.application.net.archive.check_URL,
/** {Object}check_URL.link_status[URL] = status/error */
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

prepare_directory(base_directory, true);
// prepare_directory(base_directory);

CeL.nodejs.fs_mkdir(cache_directory);

// CeL.set_debug(2);
if (0) {
	// for debug
	wiki.page('Wikinews:沙盒' || '', for_each_page);
	finish_work();
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
		last : finish_work
	}, for_each_page);
}

// ---------------------------------------------------------------------//

function finish_work() {
	CeL.info('finish_work: All page parsed. Start checking URLs...');
}

// ---------------------------------------------------------------------//

function for_each_page(page_data) {
	if (!page_data || ('missing' in page_data)) {
		// error?
		return [ CeL.wiki.edit.cancel, '條目已不存在或被刪除' ];
	}
	if (page_data.ns !== 0) {
		return [ CeL.wiki.edit.cancel, '本作業僅處理條目命名空間或模板或 Category' ];
	}

	/** {String}page title = page_data.title */
	var title = CeL.wiki.title_of(page_data),
	/**
	 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
	 */
	content = CeL.wiki.content_of(page_data);

	if (!content) {
		return [ CeL.wiki.edit.cancel,
				'No contents: [[' + title + ']]! 沒有頁面內容！' ];
	}

	// -------------------------------------------------

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
	PATTERN_URL_GLOBAL_2 = /(?:https?:)?\/\/[^\s\|<>\[\]]+/ig;

	while (matched = PATTERN_URL_GLOBAL_2.exec(content)) {
		var URL = matched[0];
		// 跳過 cache URL。
		if (!URL.startsWith(archived_prefix) && URL.includes('//')) {
			// register 登記 URL。
			link_hash[URL] = true;
		}
	}

	var link_list = Object.keys(link_hash), links_left = link_list.length;
	if (links_left === 0) {
		CeL.debug('[[' + title + ']]: 本頁面未發現外部連結 external link。', 2,
				'for_each_page');
		return;
	}

	link_list.forEach(function(URL) {
		check_URL(URL, function(link_status, cached_data) {
			if (--links_left === 0) {
				add_dead_link_mark(page_data, link_hash);
			} else {
				CeL.debug('[[' + title + ']]: left ' + links_left + ' [' + URL
						+ ']: ' + link_status + '。', 1, 'for_each_page');
			}
		}, {
			constent_processor : function(HTML, URL, status) {
				var file_name = URL.replace(/#.*/g, '').replace(
						/[\\\/:*?"<>|]/g, '_');
				try {
					CeL.nodejs.fs_write(cache_directory + file_name);
				} catch (e) {
					console.error(e);
				}
			}
		});
	});

	var parser = CeL.wiki.parser(page_data);
	// 趁 check_URL(URL) 的閒置時 parse。
	setTimeout(function() {
		parser.parse();
	}, 20);
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
	var archived = archived_data[normalized_URL][0];
	return token.toString()
	// [[Template:Dead link]]
	+ '{{dead link|date=' + date_NOW
	//
	+ '|bot=' + user_name + '|status=' + link_status[URL]
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

function add_dead_link_mark(page_data, link_hash) {

	/** {String}page title = page_data.title */
	var title = CeL.wiki.title_of(page_data),
	//
	dead_link_count = 0;

	function process_token(token, index, parent, URL) {
		var normalized_URL = check_URL.normalize_URL(URL);
		// 登記已處理過或無須處理之URL。
		delete link_hash[normalized_URL];

		if (!normalized_URL.includes('//')) {
			return;
		}

		if (!(normalized_URL in link_status)) {
			throw new Error('process_token: [[' + title + ']]: 沒處理到的 URL ['
					+ URL + ']');
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

	var parser = CeL.wiki.parser(page_data);
	// assert: parser.parsed === true

	// -------------------

	// 處理外部連結 external link [http://...]
	parser.each('external link', function(token, index, parent) {
		var URL = token[0].toString();
		return process_token(token, index, parent, URL);
	}, true);

	// -------------------

	// 處理 {{|url=http://...}}
	parser.each('template', function(token, index, parent) {
		var URL = token.parameters && token.parameters.url;
		if (URL) {
			// 去掉 tag, <!-- -->
			URL = URL.toString().replace(/<[^<>]+>/g, '').trim();
		}
		if (token.name !== 'Source') {
			if (token.name === 'Dead link' && URL) {
				// 登記已處理過或無須處理之URL。
				delete link_hash[URL];
			}
			return;
		}

		if (!URL) {
			CeL.warn('[[' + title + ']]: 未設定 URL: ' + token);
			return;
		}

		var stamp = 'accessdate='
		// 以編輯時間自動添加 accessdate 參數。
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
		if (!status_is_OK(link_status[URL])) {
			reporter.push('[' + URL + ' ' + link_status[URL] + ']');
		}
	}

	if (reporter.length > 0) {
		// CeL.log('-'.repeat(80));
		CeL.log('; [[' + title + ']] 尚未處理之 URL:');
		CeL.log(': ' + reporter.join(' '));
	}

	// -------------------

	CeL.debug('[[' + title + ']]: 有' + dead_link_count + '個新{{dead link}}。', 1,
			'for_each_page');

	if (!(dead_link_count > 0)) {
		return;
	}

	wiki.page(page_data).edit(parser.toString(), {
		summary : '檢查與維護外部連結: ' + dead_link_count + '個失效連結',
		nocreate : 1,
		bot : 1
	}, function(page_data, error, result) {
		if (error) {
			console.error(error);
			console.trace('[[' + title + ']]: error');
		} else {
			CeL.debug('[[' + title + ']]: 已寫入' + dead_link_count
			//
			+ '個新{{dead link}}之資料。', 1, 'for_each_page');
		}
	});
	CeL.debug('[[' + title + ']]: 將寫入新資料。 .actions.length = '
			+ wiki.actions.length + ', .running = ' + wiki.running, 1,
			'for_each_page');
	console.log(wiki.actions.slice(0, 2));
}
