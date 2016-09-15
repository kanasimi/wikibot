﻿// (cd ~/wikibot && date && hostname && nohup time node 20160719.clean_sandbox.js; date) >> clean_sandbox/log &

/*

 2016/7/19 20:46:59	正式營運，轉成常態性運行作業。

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

summary = '沙盒清理作業';

var
/** {Object}wiki operator 操作子. */
wikinews = Wiki(true, 'wikinews');

wikinews.redirect_to('Project:Sandbox', function(redirect_data, page_data) {
	// console.log(page_data.response.query);
	// console.log(redirect_data);

	wikinews.page(redirect_data);
	if (false) {
		// 頂多一開始執行一次。
		wikinews.protect({
			protections : 'move=sysop',
			reason : summary + ': 預防沙盒被隨意移動'
		});
	}
	// <!-- 請注意：請不要變更這行文字以及這行文字以上的部份！ -->\n\n
	wikinews.edit('{{sandbox}}\n== 請在這行文字底下進行您的測試 ==\n', {
		summary : summary,
		nocreate : 1,
		bot : 1
	});
});

var moegirl = Wiki(true, 'https://zh.moegirl.org/api.php');

moegirl.page('Help:沙盒‎‎').edit('{{沙盒顶部}}\n== 請在這行文字底下進行您的測試 ==\n', {
	summary : summary,
	nocreate : 1,
	bot : 1
});
