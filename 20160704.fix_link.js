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

links = CeL.null_Object();

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
	link_hash = links[title] = {};

	// check_external_link

	// [http://...]
	// {{|url=http://...}}
	var matched, PATTERN_URL = /https?:\/\/[^\s\|{}<>\[\]]+/ig;

	while (matched = PATTERN_URL.exec(content)) {
		// register 登記
		link_hash[matched[0]] = undefined;
	}

	var link_list = Object.keys(link_hash), length = link_list.length;
	if (length === 0) {
		CeL.debug('[[' + title + ']]: 本頁面無 link。', 2, 'for_each_page');
		delete links[title];
		return;
	}

	function final(URL) {
		// CeL.log(length + ': ' + URL + ': ' + link_hash[URL]);
		if (--length > 0) {
			if (false && length < 2) {
				for ( var URL in link_hash) {
					var status = link_hash[URL];
					if (status === undefined) {
						CeL.log(URL + ': ' + status);
					}
				}
			}
			return;
		}

		var reporter = [];
		for ( var URL in link_hash) {
			var status = link_hash[URL];
			if (status !== 200) {
				reporter.push('[' + URL + ' ' + status + ']');
			}
		}

		if (reporter.length) {
			// CeL.log('-'.repeat(80));
			CeL.log('; [[' + title + ']]');
			CeL.log(': ' + reporter.join(' '));
		}
	}

	link_list.forEach(function check_URL(URL) {
		// CeL.log('→ [' + URL + ']');
		CeL.get_URL(URL, function(data) {
			if (typeof data !== 'object'
					|| typeof data.responseText !== 'string') {
				// CeL.log(URL + ': error!');
				link_hash[URL] = 'Unknown error';
				final(URL);
				return;
			}

			var status = data.status;
			link_hash[URL] = status;
			if (status >= 400 || status < 200) {
				// CeL.log(URL + ': ' + status);
			} else if (!data.responseText.trim()) {
				link_hash[URL] = 'Empty contents';
			}
			final(URL);

		}, null, null, {
			onfail : function(error) {
				link_hash[URL] = error;
				final(URL);
			}
		});
	});

}

function finish_work() {
	;
}

// Set the umask to share the xml dump file.
if (typeof process === 'object') {
	process.umask(parseInt('0022', 8));
}

// prepare_directory(base_directory, true);
prepare_directory(base_directory);

// CeL.set_debug(2);
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
