// cd /d D:\USB\cgi-bin\program\wiki && node 20150916.Multiple_issues.check_or.js

/*

 2016/2/3 5:1:14 初版試營運

 */

'use strict';

// var CeL_path = 'S:\\cgi-bin\\lib\\JS';
require('./wiki loader.js');

var list = JSON.parse(CeL.get_file('Multiple_issues/embeddedin/Or.json')),
//
PATTERN = new RegExp('{{'
		+ CeL.wiki.normalize_title_pattern(JSON.parse(CeL
				.get_file('Multiple_issues/redirects/多個問題.json')), false, true)
		+ '(.{400})'),
/** {Object}wiki 操作子. */
wiki = Wiki(true);

// console.log(list[1]);

wiki.page(list, function(data) {
	data.forEach(function(page_data) {
		var title = page_data.title,
		//
		content = CeL.wiki.content_of(page_data),
		//
		matched = content.match(PATTERN);

		if (matched && matched[1].match(/{{or[^a-z]/i))
			CeL.log(title);
	});
});
