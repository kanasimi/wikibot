// cd /d D:\USB\cgi-bin\program\wiki && node check_parser.js

/*

 test if parser working properly

 2015/10/2 20:19:48	see [[維基百科:錯誤檢查專題]], https://tools.wmflabs.org/checkwiki/cgi-bin/checkwiki.cgi?project=enwiki&view=high
 2015/10/11 17:54:33	初版試營運

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');
// for CeL.wiki.cache(), CeL.fs_mkdir()
CeL.run('application.platform.nodejs');

/** {String}base directory */
var base_directory = bot_directory + 'WPCHECK/';

// ---------------------------------------------------------------------//

// prepare directory
CeL.fs_mkdir(base_directory);

if (false) {
	var t = "{{Tl|a<ref>[http://a.a.a b|c {{!}} {{CURRENTHOUR}}]</ref>}}",

	p = CeL.wiki.parser(t).parse(), ts = p.toString();
	CeL.log(p);
	CeL.log(ts + '\n' + (t === ts ? 'OK' : 'NG!!!'));
	throw 0;
}

var skip_exists = false,
//
check_OK = 0, check_error = 0;

function check_page(page_data) {
	if (!page_data || ('missing' in page_data))
		return;

	var title = page_data.title,
	// 正規化檔名。
	file_name_prefix = base_directory + 'page/' + title.replace(/\//g, '_');

	if (skip_exists)
		try {
			if (!node_fs.statSync(file_name_prefix + '.json').isFile())
				return;
		} catch (e) {
			return;
		}

	file_name_prefix += '_';

	var content = CeL.wiki.content_of(page_data),
	//
	wiki_page = CeL.wiki.parser(content).parse({
		end_mark : '»',
		postfix : function(wikitext) {
			if (false)
				node_fs.writeFile(file_name_prefix + 'text.txt',
				//
				wikitext.replace(/\0/g, '«'));
		}
	}),
	//
	parsed_String = wiki_page.toString();

	if (false) {
		wiki_page.each_text(function(token) {
			if (token = token.trim())
				CeL.log(token);
		});
		CeL.log('-'.repeat(70) + '' + parsed_String);
	}

	if (content === parsed_String) {
		CeL.log('[[' + title + ']]: OK');
		check_OK++;
	} else {
		CeL.warn('[[' + title + ']]: different contents!');
		node_fs.writeFile(file_name_prefix + 'original.txt', content);
		node_fs.writeFile(file_name_prefix + 'parsed.txt', parsed_String);
		if (check_error++ > 9)
			throw new Error('check_page: Too many errors');
	}
}

function process_page(title) {
	CeL.wiki.cache([ {
		type : 'page',
		list : title,
		prefix : base_directory,
		operator : check_page
	} ]);
}

var checkwiki_api_URL = 'https://tools.wmflabs.org/checkwiki/cgi-bin/checkwiki.cgi?project='
		+ 'zhwiki' + '&view=bots&offset=0&id=';

var node_fs = require('fs');

function check_index(index) {
	CeL.get_URL_cache(checkwiki_api_URL + index, function(page_list) {
		page_list = JSON.parse(page_list);
		// CeL.set_debug(3);
		if (page_list.length === 0)
			return;

		// process pages
		// page_list = 'Microsoft Surface Pro|本-古里安国际机场|麒麟之翼'.split('|');
		page_list.forEach(process_page);

	}, {
		file_name : 'WPCHECK/list_' + index + '.json',
		postprocessor : function(data) {
			if (data.charAt(0) === '<')
				// 僅取得 <pre> 間的 data。
				data = data.between('<pre>', '</pre>');
			data = data.trim().split(/\r?\n/);
			return JSON.stringify(data);
		}
	});
}

var lists = node_fs.readdirSync(base_directory);
lists.forEach(function(filename) {
	var matched = filename.match(/list_(\d+)\.json/);
	if (matched)
		check_index(matched[1]);
});
