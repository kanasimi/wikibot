// cd /d D:\USB\cgi-bin\program\wiki && node check_link.js

/*

 2016/6/24	check external link 

 @see [[mw:Manual:Pywikibot/weblinkchecker.py]], [[ja:プロジェクト:外部リンク]]

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('ja');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(),

links = CeL.null_Object();

// ---------------------------------------------------------------------//

// prepare directory
CeL.fs_mkdir(base_directory);

function check_external_link(title) {
	wiki.page(title, function(page_data) {
		var
		/**
		 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
		 */
		content = CeL.wiki.content_of(page_data);

		if (!content) {
			return;
		}

		/** {String}page title = page_data.title */
		var title = CeL.wiki.title_of(page_data),
		//
		link_hash = links[title] = {};

		// [http://...]
		// {{|url=http://...}}
		var matched, PATTERN_URL = /https?:\/\/[^\s\|{}]+/ig;

		while (matched = PATTERN_URL.exec(content)) {
			link_hash[matched[0]] = undefined;
		}

		var link_list = Object.keys(link_hash), length = link_list.length;
		if (length === 0) {
			delete links[title];
			return;
		}

		function final(URL) {
			// console.log(length + ': ' + URL + ': ' + link_hash[URL]);
			if (--length > 0) {
				if (false && length < 2) {
					for ( var URL in link_hash) {
						var status = link_hash[URL];
						if (status === undefined) {
							console.log(URL + ': ' + status);
						}
					}
				}
				return;
			}

			// console.log('-'.repeat(80));
			console.log('[[' + title + ']]:');
			for ( var URL in link_hash) {
				var status = link_hash[URL];
				if (status !== 200) {
					console.log(URL + ': ' + status);
				}
			}
		}

		link_list.forEach(function check_URL(URL) {
			// console.log('→ ' + URL);
			CeL.get_URL(URL, function(data) {
				if (typeof data !== 'object'
						|| typeof data.responseText !== 'string') {
					// console.log(URL + ': error!');
					link_hash[URL] = 'Unknown error';
					final(URL);
					return;
				}
				var status = data.status;
				link_hash[URL] = status;
				if (status >= 400 || status < 200) {
					// console.log(URL + ': ' + status);
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

	});

}

check_external_link('ラタノプロスト');
