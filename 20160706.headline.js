// cd /d D:\USB\cgi-bin\program\wiki && node 20160706.headline.js

/*

 2016/7/6 19:41:26	import headlines of news papers

 @see http://www.vanguardngr.com/category/headlines/

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'wikinews'),

// 須改 cx!!
headline_sites = {
	// cn
	// http://finance.sina.com.cn/stock/y/2016-07-06/doc-ifxtsatn8182961.shtml
	// http://finance.eastmoney.com/news/1353,20160706639330278.html

	// [ query, 擷取數 [標題關鍵字] ]
	'中央社商情網' : [ '"%Y年%m月%d日" "頭條新聞標題" site:www.cnabc.com', [ '日報', '晚報' ] ],
	// 不知為何，Google 得要用這樣的方法才查得到晚報頭條。
	'中央通訊社' : '台灣主要晚報頭條新聞標題 %Y年 %m月 %d日',

	'中央社' : '"%m月%d日" "各報頭條" site:www.cna.com.tw',
	'蘋果日報 (台灣)' : [ '"%4Y%2m%2d" "各報頭條搶先報" site:appledaily.com.tw',
			[ '世界各報頭條', '各報頭條' ] ],
	'今日新聞網' : '"%m月%d日" "各報頭條" site:www.nownews.com',
	'中時電子報' : '"%m月%d日" "各報頭版要聞" site:www.chinatimes.com',
	'鉅亨網' : '"%Y年%m月%d日" "報紙頭條" site:news.cnyes.com',
	'華視新聞網' : '"%m月%d日" "各報頭條" site:news.cts.com.tw',
	'中國評論通訊社' : [ '"%m月%d日" "頭條新聞" site:hk.crntt.com', [ '國際部分', '港澳部份' ] ]
},
//
add_source_data = [],

use_date = new Date;

// use_date = new Date(2016, 7 - 1, 8);

// ---------------------------------------------------------------------//

// 這可能需要十幾秒。
var google = require('googleapis'), customsearch = google.customsearch('v1');

function check_finish(sites_to_check) {
	if (add_source_data.length === 0) {
		// 沒有新資料，或者全部錯誤。
		return;
	}

	add_source_data.sort();

	for ( var site in sites_to_check) {
		add_source_data.push('<!-- Error: ' + site + ' -->');
	}

	// assert: 已設定好 page
	wiki.edit(function(page_data) {
		add_source_data = add_source_data.join('\n');
		/** {Number}一整天的 time 值。should be 24 * 60 * 60 * 1000 = 86400000. */
		var ONE_DAY_LENGTH_VALUE = new Date(0, 0, 2) - new Date(0, 0, 1),

		// 前一天, the day before
		day_before = new Date(use_date.getTime() - ONE_DAY_LENGTH_VALUE),
		// 後一天, 隔天 the day after
		day_after = new Date(use_date.getTime() + ONE_DAY_LENGTH_VALUE);

		function headline_link(date, add_year) {
			return '[[' + date.format('%Y年%m月%d日') + '臺灣報紙頭條|'
					+ date.format(add_year ? '%Y年%m月%d日' : '%m月%d日') + ']]';
		}

		var content = CeL.wiki.content_of(page_data)
		// 初始模板。
		|| ('{{date|' + use_date.format('%Y年%m月%d日')
		//
		+ '}}\n\n以下為[[w:民國紀年|民國]]' + use_date.format({
			format : '%R年%m月%d日',
			locale : 'cmn-Hant-TW'
		})
		//
		+ '[[w:臺灣|臺灣]]報紙頭條：\n\n== 消息來源 ==\n\n\n{{develop}}\n'
		//
		+ '{| class="wikitable" style="text-align: center;"\n'
		//
		+ '|+\'\'\'臺灣報紙頭條\'\'\'\n|-\n|←' + headline_link(day_before)
		//
		+ '||' + headline_link(use_date, true)
		//
		+ '||' + headline_link(day_after) + '→\n|}\n'
		//
		+ '[[Category:報紙頭條]]\n[[Category:臺灣]]\n'
		//
		+ '[[Category:' + use_date.format('%Y年%m月') + '臺灣報紙頭條]]');
		content = content.replace(/(\n|^)==\s*消息來源\s*==\n/, function(section) {
			section += add_source_data;
			add_source_data = null;
			return section;
		});

		if (add_source_data) {
			content += '\n== 消息來源 ==\n' + add_source_data;
		}

		return content;
	}, {
		summary : 'bot test: 匯入每日報紙頭條新聞標題',
		bot : 1
	});
}

// return 有去掉/已處理過。
function remove_completed(sites_to_check, site, title) {
	if (!/[頭头][版條条]/.test(title)) {
		return;
	}
	// assert: typeof title === 'string'
	var matched = title.match(/(\d+月)(\d+日)/);
	if (matched && use_date.format('%m月%d日') !==
	//
	matched[1].replace(/^0+/, '') + matched[2].replace(/^0+/, '')) {
		CeL.debug('日期(月日)不符? [' + matched[0] + ']', 0, 'remove_completed');
		return;
	}
	matched = title.match(/\d+年/);
	if (matched && use_date.format('%Y年') !== matched[0].replace(/^0+/, '')) {
		CeL.debug('日期(年)不符? [' + matched[0] + ']', 0, 'remove_completed');
		return;
	}

	var site_data = sites_to_check[site];
	if (Array.isArray(site_data)) {
		// assert: Array.isArray(site_data[1])
		CeL.debug('檢查標題關鍵字: [' + site_data[1] + '] in "' + title + '"', 0,
				'remove_completed');
		return site_data[1].some(function(key, index) {
			if (title.includes(key)) {
				if (site_data[1].length === 1) {
					CeL.debug('[' + site + ']: 到齊了。', 0, 'remove_completed');
					delete sites_to_check[site];
				} else {
					CeL.debug('[' + site + ']: 去掉本 key [' + key + ']。', 0,
							'remove_completed');
					site_data[1].splice(index, 1);
				}
				return true;
			}
		});
	}

	CeL.debug('[' + site + ']: 標注已處理過 [' + title + ']。', 0, 'remove_completed');
	delete sites_to_check[site];
	return true;
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
			CeL.err('for_site: [' + site + ']: error: ' + error);
			if (!left) {
				check_finish(sites_to_check);
			}
			return;
		}

		CeL.log('for_site: Search Google for [' + site + ']: '
				+ response.searchInformation.formattedTotalResults
				+ ' results.');
		if (!response.items || response.items.length === 0) {
			CeL.log('for_site: [' + site + ']: No data get: '
					+ JSON.stringify(response.url));
			if (!left) {
				check_finish(sites_to_check);
			}
			return;
		}

		// CeL.log('First result name is ' + response.items[0].title);

		// item: e.g.,
		// {"kind":"customsearch#result","title":"台灣主要日報頭條新聞標題2016年7月5日|即時新聞|中央社商情網",
		// "htmlTitle":"...","link":"http://www.cnabc.com/news/aall/201607050083.aspx","displayLink":"www.cnabc.com","snippet":"...","htmlSnippet":"...","cacheId":"BlsHSMJeb9AJ","formattedUrl":"www.cnabc.com/news/aall/201607050083.aspx","htmlFormattedUrl":"www.cnabc.com/news/aall/201607050083.aspx",
		// "pagemap":{"metatags":[{"viewport":"width=device-width,initial-scale=1.0","og:title":"...","og:image":"http://img1.cna.com.tw/cbp/images/pic_fb.jpg","og:url":"http://www.cnabc.com/news/aall/201607050083.aspx","og:type":"article"}],"cse_image":[{"src":"http://img1.cna.com.tw/cbp/images/pic_fb.jpg"}]}}
		function add_source(item) {
			if (remove_completed(sites_to_check, site, item.title)) {
				add_source_data.push('* {{source|url=' + item.link + '|title='
						+ item.title.replace(/[\s\|]+/g, ' ') + '|author='
						+ site + '|pub=' + site + '|date='
						+ use_date.format('%Y年%m月%d日') + '}}');
			} else {
				CeL.err('add_source: error title: [' + item.title + '] ['
						+ item.link + ']');
				console.log(item);
			}
			CeL.debug('add_source: [' + site + ']: '
			//
			+ (sites_to_check[site] ? '尚存有未處理資料，將持續處理下去。' : '已無未處理資料，將跳出此項。'),
					0, 'add_source');
			return sites_to_check[site];
		}

		response.items.every(add_source);

		if (!left) {
			check_finish(sites_to_check);
		}
	}

	sites.forEach(function(site) {
		// query string
		var query = sites_to_check[site];
		if (Array.isArray(query)) {
			query = query[0];
		}
		query = use_date.format(query);
		CeL.debug('check_sites: Search Google for [' + site + ']: [' + query
				+ ']', 0, 'check_sites');

		// https://github.com/google/google-api-nodejs-client/blob/master/samples/customsearch/customsearch.js
		customsearch.cse.list(Object.assign({
			q : query
		}, API_code), function(error, response) {
			for_site(site, error, response);
		});
	});

}

wiki.page(use_date.format('%Y年%m月%d日') + '臺灣報紙頭條', function(page_data) {
	var sites_to_check = Object.clone(headline_sites, true);
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
		// console.log(token);
		if (template_name === 'source' && token.parameters.url
				&& token.parameters.title
				&& (token.parameters.pub in sites_to_check)) {
			CeL.log('for_each_template: 已處理過 ' + token.parameters.pub + '。');
			remove_completed(sites_to_check, token.parameters.pub,
					token.parameters.title);
		}
	}

	parser.each('template', for_each_template);
	// console.log(sites_to_check);
	check_sites(sites_to_check);
});
