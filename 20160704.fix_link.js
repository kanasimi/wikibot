// (cd ~/wikibot && date && hostname && nohup time node 20160704.fix_link.js; date) >> ../cron-tools.cewbot-20160704.fix_link.out &

/*

 2016/7/4 23:17:28	check external link

 @see [[mw:Manual:Pywikibot/weblinkchecker.py]], [[ja:プロジェクト:外部リンク]], [[en:Template:Dead link]], [[en:User:cyberbot II]]

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
// set_language('ja');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'wikinews'),
//
date_NOW = (new Date).format('%Y年%m月%d日'),
// links[page_data.pageid][URL] = status/error
links = CeL.null_Object(),
// archived_data[URL] = return of archived
archived_data = CeL.null_Object(),
// @see {{dead link}}, [[w:en:Archive site]]
// http://www.webcitation.org/archive
archived_prefix = 'http://web.archive.org/web/';

// ---------------------------------------------------------------------//

// Wayback Availability JSON API
// https://archive.org/help/wayback_api.php
// archive.org此API只能檢查是否有snapshot，不能製造snapshot。
// 短時間內call過多次(10次?)將503?
// callback(closest_snapshots, error);
function check_archive_site(URL, callback) {
	if (URL in archived_data) {
		callback(archived_data[URL]);
		return;
	}
	// 登記。
	archived_data[URL] = undefined;

	// 延遲 time in ms。
	var need_lag = 2000 - (Date.now() - check_archive_site.last_call);
	if (need_lag > 0) {
		setTimeout(function() {
			CeL.debug('Wait ' + need_lag + ' ms...', 0, 'check_archive_site');
			check_archive_site(URL, callback);
		}, need_lag);
		return;
	}
	check_archive_site.last_call = Date.now();

	CeL.get_URL('http://archive.org/wayback/available?url=' + URL,
	//
	function(data) {
		CeL.debug(URL + ':', 0, 'check_archive_site');
		console.log(data);
		if (data.status !== 200) {
			callback(undefined, data);
			return;
		}

		data = JSON.parse(data.responseText);
		if (!data || !(data = data.archived_snapshots.closest)
				|| !data.available || !data.url) {
			// 經嘗試未能取得 snapshots。
			archived_data[URL] = false;
			callback();
			return;
		}

		if (!data.url.startsWith(archived_prefix)) {
			CeL.warn('check_archive_site: ' + URL
					+ ': archived URL does not starts with "' + archived_prefix
					+ '": ' + data.url + '.');
		}

		var archived_url = data.archived_url = data.url.between('web/')
				.between('/');
		if (archived_url !== URL
		// 可能自動加 port。
		&& archived_url.replace(/:\d+\//, '/') !== URL
		// 可能自動轉 https。
		&& archived_url.replace('http://', 'https://') !== URL) {
			CeL.warn('check_archive_site: [' + URL + '] != [' + archived_url
					+ '].');
		}

		// 登記。
		archived_data[URL] = data;
		callback(data);

	}, null, null, {
		// use new agent
		agent : true,
		onfail : function(error) {
			CeL.debug(URL + ': Error: ' + error, 0, 'check_archive_site');
			callback(undefined, error);
		}
	});
}

// ---------------------------------------------------------------------//

function for_each_page(page_data) {
	if (!page_data || ('missing' in page_data)) {
		// error?
		return [ CeL.wiki.edit.cancel, '條目已不存在或被刪除' ];
	}

	var
	/**
	 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
	 */
	content = CeL.wiki.content_of(page_data);

	if (!content) {
		return [ CeL.wiki.edit.cancel,
				'No contents: [[' + title + ']]! 沒有頁面內容！' ];
	}

	/** {String}page title = page_data.title */
	var title = CeL.wiki.title_of(page_data),
	//
	link_hash = links[page_data.pageid] = CeL.null_Object();

	// check_external_link

	var matched,
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
	 * @see PATTERN_URL_GLOBAL, PATTERN_URL_prefix, PATTERN_WIKI_URL,
	 *      PATTERN_wiki_project_URL
	 */
	PATTERN_URL_GLOBAL = /(?:https?:)?\/\/[^\s\|{}<>\[\]]+/ig;

	while (matched = PATTERN_URL_GLOBAL.exec(content)) {
		var URL = matched[0];
		// 去掉 port。
		if (URL.replace(':80/', '/') in link_hash) {
			CeL.debug('[[' + title + ']]: Skip 已添加過之URL [' + URL + ']。', 0,
					'for_each_page');
			// console.log(link_hash);
		} else if (!URL.startsWith(archived_prefix)) {
			// 跳過 cache URL。
			// register 登記 URL。
			link_hash[URL] = undefined;
		}
	}

	var link_list = Object.keys(link_hash), link_length = link_list.length;
	if (link_length === 0) {
		CeL.debug('[[' + title + ']]: 本頁面未發現外部連結 external link。', 0,
				'for_each_page');
		delete links[title];
		return;
	}

	function add_dead_link_mark() {
		var processed = CeL.null_Object();

		// -------------------

		function is_NG(URL) {
			URL = URL.toString();
			if (!(URL in link_hash)) {
				CeL.warn('is_NG: 沒處理到的 URL: [' + URL + ']');
				return;
			}
			// 登記已處理過或無須處理之URL。
			processed[URL] = true;
			return !(link_hash[URL] >= 200 && link_hash[URL] < 300);
		}

		// -------------------

		// TODO: 處理原有之 {{dead link}}
		// assert: {{dead link}} 必須與原node在同一階層上，剛好在正後面！
		// token_index
		function get_dead_link_node(index, parent) {
			// 往後找。
			while (++index < parent.length) {
				var token = parent[index];
				// 跳過純文字(wikitext)
				if (token.type) {
					if (token.type === 'transclusion'
							&& token.name === 'Dead link') {
						return index;
					}
					break;
				}
			}
			// NOT_FOUND
			return -1;
		}

		// -------------------

		var dead_link_count = 0;

		function dead_link_text(token, URL) {
			dead_link_count++;
			var archived = archived_data[URL];
			return token.toString()
			// [[Template:Dead link]]
			+ '{{dead link|date=' + date_NOW
			//
			+ '|bot=' + user_name + '|status=' + link_hash[URL]
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
			+ (URL in archived_data ? '|fix-attempted=' + date_NOW : ''))
					+ '}}';
		}

		// -------------------

		function process_token(token, index, parent, URL) {
			if (is_NG(URL)) {
				var dead_link_node_index = get_dead_link_node(index, parent);
				if (!(dead_link_node_index > 0)) {
					return dead_link_text(token, URL);
				}
				CeL.debug('[[' + title
						+ ']]: assert: 已處理過，有{{dead link}}: index ' + index
						+ '⇒' + dead_link_node_index + '。', 0, 'process_token');
			}
		}

		// -------------------------------------------------

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
				URL = URL.toString().replace(/<[^<>]+>/g, '');
			}
			if (token.name !== 'Source') {
				if (token.name === 'Dead link' && URL) {
					// 登記已處理過或無須處理之URL。
					processed[URL] = true;
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

		if (dead_link_count > 0) {
			CeL.debug('[[' + title + ']]: 有新{{dead link}}，寫入新資料。', 0,
					'for_each_page');
			wiki.page(page_data).edit(parser.toString(), {
				summary : '檢查與維護外部連結: ' + dead_link_count + '個失效連結',
				nocreate : 1,
				bot : 1
			});
		}

		// -------------------

		var reporter = [];
		for ( var URL in link_hash) {
			if (link_hash[URL] !== 200 && !processed[URL]) {
				reporter.push('[' + URL + ' ' + link_hash[URL] + ']');
			}
		}

		if (reporter.length > 0) {
			// CeL.log('-'.repeat(80));
			CeL.log('; [[' + title + ']] 尚未處理之 URL:');
			CeL.log(': ' + reporter.join(' '));
		}
	}

	function register_URL_status(URL, status) {
		link_hash[URL] = status;
		CeL.debug('[[' + title + ']]: left ' + link_length + ' [' + URL + ']: '
				+ status + '。', 0, 'check_URL');
		if (--link_length > 0) {
			if (false && link_length < 2) {
				for ( var URL in link_hash) {
					if (status === undefined) {
						CeL.log(URL + ': ' + status);
					}
				}
			}
			return;
		}

		CeL.debug('[[' + title + ']]: 已檢查過本頁所有URL。', 0, 'register_URL_status');
		add_dead_link_mark();
	}

	function check_URL(URL) {
		CeL.debug('[[' + title + ']]: 檢查URL → [' + URL + ']。', 0, 'check_URL');
		CeL.get_URL(URL, function(data) {
			if (typeof data !== 'object'
					|| typeof data.responseText !== 'string') {
				register_URL_status(URL, 'Unknown error');
				return;
			}

			var status = data.status,
			// has error.
			has_error = status >= 300 || status < 200;
			if (!has_error && !data.responseText.trim()) {
				status = 'Empty contents';
				has_error = true;
			}
			if (has_error) {
				check_archive_site(URL, function(closest_snapshots, error) {
					register_URL_status(URL, status);
				});
			} else {
				register_URL_status(URL, status);
			}

		}, null, null, {
			// use new agent
			agent : true,
			onfail : function(error) {
				check_archive_site(URL, function(closest_snapshots) {
					register_URL_status(URL, error);
				});
			}
		});
	}

	link_list.forEach(check_URL);

	var parser = CeL.wiki.parser(page_data);
	// 趁 check_URL(URL) 的閒置時 parse。
	setTimeout(function() {
		parser.parse();
	}, 20);
}

function finish_work() {
	CeL.info('finish_work: All page parsed. Start checking URLs...');
}

// Set the umask to share the xml dump file.
if (typeof process === 'object') {
	process.umask(parseInt('0022', 8));
}

// prepare_directory(base_directory, true);
prepare_directory(base_directory);

// CeL.set_debug(2);
if (0) {
	// for debug
	wiki.page(
	// 'Wikinews:沙盒'
	'EDWIN與CUELLO遭統一獅隊解約'
	//
	, for_each_page);
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
