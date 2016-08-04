// cd /d D:\USB\cgi-bin\program\wiki && node 20160704.fix_link.js

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
archived_data = CeL.null_Object();

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
		// register 登記
		link_hash[matched[0]] = undefined;
	}

	var link_list = Object.keys(link_hash), link_length = link_list.length;
	if (link_length === 0) {
		CeL.debug('[[' + title + ']]: 本頁面無 link。', 2, 'for_each_page');
		delete links[title];
		return;
	}

	function add_dead_link_mark() {
		var processed = CeL.null_Object();

		function is_NG(URL) {
			URL = URL.toString();
			if (!(URL in link_hash)) {
				CeL.warn('is_NG: 沒處理到的 URL: [' + URL + ']');
				return;
			}
			// 登記已處理過之URL。
			processed[URL] = true;
			return !(link_hash[URL] >= 200 && link_hash[URL] < 300);
		}

		// TODO: 處理原有之 {{dead link}}
		// assert: {{dead link}} 必須與原node在同一階層上，剛好在正後面！
		// token_index
		function get_dead_link_node(index, parent) {
			while (++index < parent.length) {
				if (parent[index].type) {
					if (parent[index].type === 'transclusion'
							&& parent[index].name === 'Dead link') {
						return index;
					}
					break;
				}
			}
			// NOT_FOUND
			return -1;
		}

		var has_new_dead;

		function dead_link_text(token, URL) {
			has_new_dead = true;
			var archived = archived_data[URL];
			return token.toString()
			// [[Template:Dead link]]
			+ '{{dead link|date=' + date_NOW
			//
			+ '|bot=' + user_name + '|status=' + link_hash[URL]
			//
			+ (archived ? '|url=' + archived.archived_url
			//
			: '|broken_url=' + URL
			//
			+ (URL in archived_data ? '|fix-attempted=' + date_NOW : ''))
					+ '}}';
		}

		// 處理外部連結 external link [http://...]
		parser.each('external link', function(token, index, parent) {
			var URL = token[0];
			if (is_NG(URL)) {
				var dead_link_node_index = get_dead_link_node(index, parent);
				if (!(dead_link_node_index > 0)) {
					return dead_link_text(token, URL);
				}
				// assert: 已處理過。
			}
		}, true);

		// 處理 {{|url=http://...}}
		parser.each('template', function(token, index, parent) {
			if (token.name !== 'Source') {
				return;
			}
			// 以編輯時間自動添加 accessdate 參數。
			var stamp = 'accessdate=' + page_data.revisions[0].timestamp;
			if (token.parameters.accessdate) {
				// 更新 stamp。
				// token[token.index_of.accessdate] = stamp;
			} else {
				token.push(stamp);
			}
			var URL = token.parameters.url;
			if (is_NG(URL)) {
				var dead_link_node_index = get_dead_link_node(index, parent);
				if (!(dead_link_node_index > 0)) {
					return dead_link_text(token, URL);
				}
				// assert: 已處理過，有{{dead link}}。
			}
		}, true);

		// 處理 plain links: https:// @ wikitext
		// @see [[w:en:Help:Link#Http: and https:]]

		if (has_new_dead) {
			// 有新東西({{dead link}})才寫入。
			wiki.page(page_data).edit(parser.toString());
		}

		var reporter = [];
		for ( var URL in link_hash) {
			if (link_hash[URL] !== 200 && !processed[URL]) {
				reporter.push('[' + URL + ' ' + link_hash[URL] + ']');
			}
		}

		if (reporter.length) {
			// CeL.log('-'.repeat(80));
			CeL.log('; [[' + title + ']]');
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

	// Wayback Availability JSON API
	// https://archive.org/help/wayback_api.php
	function check_archived(URL, status) {
		CeL.get_URL('http://archive.org/wayback/available?url=' + URL,
		//
		function(data) {
			CeL.debug(URL + ':', 0, 'check_archived');
			console.log(data);
			if (data.status == 200) {
				data = JSON.parse(data.responseText);
				if (data && (data = data.archived_snapshots.closest)
						&& data.available && data.url) {
					var archived_prefix = 'http://web.archive.org/web/';
					if (!data.url.startsWith(archived_prefix)) {
						CeL.warn('check_archived: ' + URL
								+ ': archived URL does not starts with "'
								+ archived_prefix + '": ' + data.url + '.');
					}
					data.archived_url = data.url.between('web/').between('/');
					if (data.archived_url !== URL
					// 可能自動加 port。
					&& data.archived_url.replace(/:\d+\//, '/') !== URL) {
						CeL.warn('check_archived: ' + URL + ' != ['
								+ data.archived_url + '].');
					}
					archived_data[URL] = data;
				} else {
					// 經嘗試未能取得 snapshots。
					archived_data[URL] = false;
				}
			}
			register_URL_status(URL, status);
		}, null, null, {
			onfail : function(error) {
				CeL.debug(URL + ': Error: ' + error, 0, 'check_archived');
				register_URL_status(URL, status);
			}
		});
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
				check_archived(URL, status);
			} else {
				register_URL_status(URL, status);
			}

		}, null, null, {
			onfail : function(error) {
				check_archived(URL, error);
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
if (1) {
	// for debug
	wiki.page('Wikinews:沙盒', for_each_page);
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
