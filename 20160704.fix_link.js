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

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'wikinews'),

//
date_NOW = (new Date).format('%Y年%m月%d日'),
/** {Object}link_status[page_data.pageid][URL] = status/error */
link_status = CeL.null_Object(),
//
archive_org = CeL.application.net.archive.archive_org,
/** {Object} cached[URL] = [ return of archived data, error ] */
archived_data = archive_org.cached,
// @see {{dead link}}, [[w:en:Archive site]]
/** {String}URL prefix of cached snapshot. */
archived_prefix = archive_org.URL_prefix;

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
	link_hash = link_status[page_data.pageid] = CeL.null_Object();

	CeL.debug('[[' + title + ']]: check_external_link', 0, 'for_each_page');

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
		delete link_status[title];
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
			var archived = archived_data[URL][0];
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
				CeL.debug('[[' + title + ']]: assert: 已處理過，'
						+ (dead_link_node_index > 0 ? '  有  ' : '**無**')
						+ '{{dead link}}: index ' + index + '⇒'
						+ dead_link_node_index + '。' + token, 0,
						'process_token');
				if (!(dead_link_node_index > 0)) {
					return dead_link_text(token, URL);
				}
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

		// -------------------

		CeL.debug(
				'[[' + title + ']]: 有' + dead_link_count + '個新{{dead link}}。',
				0, 'for_each_page');

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
				+ '個新{{dead link}}之資料。', 0, 'for_each_page');
			}
		});
		CeL.debug('[[' + title + ']]: 將寫入新資料。 .actions.length = '
				+ wiki.actions.length + ', .running = ' + wiki.running, 0,
				'for_each_page');
		console.log(wiki.actions.slice(0, 2));
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

		CeL.debug('[[' + title
				+ ']]: 已檢查過本頁所有 URL 與 archive site。開始添加{{dead link}}。', 0,
				'register_URL_status');
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
				// 會先 check archive site 再註銷此 URL，確保處理頁面時已經有 archived data。
				archive_org(URL, function() {
					register_URL_status(URL, status);
				});
			} else {
				register_URL_status(URL, status);
			}

		}, null, null, {
			// use new agent
			agent : true,
			onfail : function(error) {
				archive_org(URL, function() {
					// 會先 check archive site 再註銷此 URL，確保處理頁面時已經有 archived data。
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

// ---------------------------------------------------------------------//

function finish_work() {
	CeL.info('finish_work: All page parsed. Start checking URLs...');
}

// ---------------------------------------------------------------------//

// Set the umask to share the xml dump file.
if (typeof process === 'object') {
	process.umask(parseInt('0022', 8));
}

prepare_directory(base_directory, true);
// prepare_directory(base_directory);

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
