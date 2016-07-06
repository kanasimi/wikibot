// cd /d D:\USB\cgi-bin\program\wiki && node 20160706.headline.js

/*

 2016/7/6 19:41:26	import headlines of news papers

 @see http://www.vanguardngr.com/category/headlines/

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
// set_language('ja');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'wikinews'),

headline_sites = {
	'中央社' : '"%m月%d日" "頭條新聞標題" site:www.cnabc.com',
	'蘋果日報 (台灣)' : '"%4Y%2m%2d" "各報頭條搶先報" site:appledaily.com.tw',
	'今日新聞網' : '"%m月%d日" "各報頭條" site:www.nownews.com',
	'中時電子報' : '"%m月%d日" "各報頭版要聞" site:www.chinatimes.com'
},
// 擷取數
headline_sites_retrieve = {
	'中央社' : 2,
	'蘋果日報 (台灣)' : 2,
},
//
add_source_data = [],

use_date = new Date();

// ---------------------------------------------------------------------//

var google = require('googleapis'), customsearch = google.customsearch('v1');

function check_finish(sites_to_check) {
	for ( var site in sites_to_check) {
		add_source_data.push('<!-- Error: ' + site + ' -->');
	}

	if (add_source_data.length === 0) {
		return;
	}

	wiki.edit(function(page_data) {
		add_source_data = add_source_data.join('\n');
		var content = CeL.wiki.content_of(page_data) || '';
		content = content.replace(/(\n|^)==\s*消息來源\s*==\n/, function(section) {
			section += add_source_data;
			add_source_data = null;
			return section;
		});
		if (add_source_data) {
			content += '\n== 消息來源 ==\n' + add_source_data
			//
			+ '\n\n{{develop}}\n';
		}
		return content;
	}, {
		summary : 'bot test: 匯入每日報紙頭條新聞標題',
		bot : 1
	});
}

function check_sites(sites_to_check) {
	var sites = Object.keys(sites_to_check),
	// 剩下 remain
	left = sites.length;

	if (!left) {
		check_finish(sites_to_check);
		return;
	}

	function for_site(site, error, response) {
		left--;
		if (error) {
			CeL.err('[' + site + ']: error: ' + error);
			if (!left) {
				check_finish(sites_to_check);
			}
			return;
		}

		CeL.log('Result: ' + response.searchInformation.formattedTotalResults);
		if (!response.items || response.items.length === 0) {
			CeL.log('[' + site + ']: No data get: '
					+ JSON.stringify(response.url));
			if (!left) {
				check_finish(sites_to_check);
			}
			return;
		}

		// CeL.log('First result name is ' + response.items[0].title);

		// 標注已處理。
		delete sites_to_check[site];

		// item: e.g.,
		// {"kind":"customsearch#result","title":"台灣主要日報頭條新聞標題2016年7月5日|即時新聞|中央社商情網",
		// "htmlTitle":"...","link":"http://www.cnabc.com/news/aall/201607050083.aspx","displayLink":"www.cnabc.com","snippet":"...","htmlSnippet":"...","cacheId":"BlsHSMJeb9AJ","formattedUrl":"www.cnabc.com/news/aall/201607050083.aspx","htmlFormattedUrl":"www.cnabc.com/news/aall/201607050083.aspx",
		// "pagemap":{"metatags":[{"viewport":"width=device-width,initial-scale=1.0","og:title":"...","og:image":"http://img1.cna.com.tw/cbp/images/pic_fb.jpg","og:url":"http://www.cnabc.com/news/aall/201607050083.aspx","og:type":"article"}],"cse_image":[{"src":"http://img1.cna.com.tw/cbp/images/pic_fb.jpg"}]}}
		function add_source(item) {
			add_source_data.push('{{source|url=' + item.link + '|title='
					+ item.title.replace(/[\s\|]+/g, ' ') + '|author=' + site
					+ '|pub=' + site + '|date=' + use_date.format('%Y年%m月%d日')
					+ '}}');
		}

		response.items.slice(0, headline_sites_retrieve[site] || 1).forEach(
				add_source);

		if (!left) {
			check_finish(sites_to_check);
		}
	}

	sites.forEach(function(site) {
		sites_to_check[site] = use_date.format(sites_to_check[site]);
		// https://github.com/google/google-api-nodejs-client/blob/master/samples/customsearch/customsearch.js
		customsearch.cse.list(Object.assign({
			q : sites_to_check[site]
		}, API_code), function(error, response) {
			for_site(site, error, response);
		});
	});

}

wiki.page(
// use_date.format('%Y年%m月%d日') + '臺灣報紙頭條'
'Wikinews:沙盒', function(page_data) {
	var sites_to_check = Object.clone(headline_sites);
	if (!page_data || ('missing' in page_data)) {
		check_sites(sites_to_check);
		return;
	}

	var parser = CeL.wiki.parser(page_data).parse();
	if (CeL.wiki.content_of(page_data) !== parser.toString()) {
		// debug 用. check parser, test if parser working properly.
		throw 'Parser error: [[' + page_data.title + ']]';
	}

	function for_each_template(token, token_index, token_parent) {
		var template_name = token.name.toLowerCase();
		console.log(token);
		if (template_name === 'source' && token.parameters.url
				&& (token.parameters.pub in sites_to_check)) {
			// 已處理過。
			delete sites_to_check[token.pub];
		}
	}

	parser.each('template', for_each_template);
	check_sites(sites_to_check);
});
