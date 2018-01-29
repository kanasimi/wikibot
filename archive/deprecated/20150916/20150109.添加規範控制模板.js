// cd /d D:\USB\cgi-bin\program\wiki && node 20150109.js

/*

 2015/1/9	初版
 2015/7/22~27	modified

 */

require('./wiki loder.js');

CeL.run([ 'interact.DOM', 'application.debug', 'application.net.wiki' ]);

var from_language = 'en', from_wiki = Wiki(false, from_language),
//
to_language = 'zh', to_wiki = Wiki(true, to_language),
//
summary = from_language + ' wiki 之[[規範控制]] (Authority control) 模板轉移作業',
//
log_to = 'User:cewbot/log/20150109',
//
template_text = CeL.null_Object(),
//
config = {
	summary : summary,
	each : function(content, title, messages, page) {
		if (!content)
			// e.g., [[推进系统]]
			return [ CeL.wiki.edit.cancel, 'No contents!' ];
		var matched = content
				.match(/{{\s*Authority[ _]control[\s\n]*(\|.*?)?}}/i);
		if (matched) {
			if (matched[0] !== template_text[title]) {
				matched[0] += ' (與 ' + from_language + ' '
						+ template_text[title] + ' 不同)';
				matched = '已存在模板 '
						+ matched[0].replace(/{{([^{}]+)}}/g, function($0, $1) {
							return '{{tlx|' + $1.replace(/=/g, '{{=}}') + '}}';
						});
				return [ CeL.wiki.edit.cancel, matched ];
			}
			// 若兩者模板相同，則跳過不紀錄。
			// CeL.log(跳過 [' + title + ']: ' + matched);
			return [ CeL.wiki.edit.cancel, 'skip' ];
		}

		matched = content.match(
		// 依WP:格式手冊/版面布局#附錄排序，{{Good article}}應置放在條目的最底部。嘗試將之移至條目的最底部。
		/{{(?:Featured|Good)[ _](?:article|list)(?:[\s\n\|].*?)?}}/i);
		if (matched && matched.index / content.length < .5) {
			content = content.replace(
			//
			/[\r\n]*{{(?:Featured|Good)[ _](?:article|list)(?:[\s\n\|].*?)?}}[\r\n]*/i
			//
			, '\n') + '\n' + matched[0];
		}

		// [[WP:ORDER]]:
		// https://zh.wikipedia.org/wiki/Wikipedia:%E6%A0%BC%E5%BC%8F%E6%89%8B%E5%86%8A/%E7%89%88%E9%9D%A2%E4%BD%88%E5%B1%80#.E9.99.84.E9.8C.84.E6.8E.92.E5.BA.8F
		// (小)小作品模板: e.g., {{小小條目}}, {{Rubik's Cube-stub}}, {{F1-stub}},
		// {{Japan-Daimyō-stub}}, {{BDSM小作品}}, {{LGBT小作品}}
		// https://zh.wikipedia.org/wiki/Wikipedia:%E5%B0%8F%E4%BD%9C%E5%93%81%E7%B1%BB%E5%88%AB%E5%88%97%E8%A1%A8
		return content
				.replace(
						/{{\s*Persondata(?:[\s\|]|<!--)|{{\s*DEFAULTSORT\s*:|\[\[\s*Category:|{{\s*(?:(?:Sub|Sect|[a-z\d\- _'ō]*-)?stub|[^{} _\d\|]*小作品|小小?條目|(?:Featured|Good)[ _](?:article|list))(?:[\s\n\|}]|<!--)|$/i,
						function($0) {
							return template_text[title] + '\n' + ($0 || '');
						});
	},
	// run_empty: 即使無頁面/未取得頁面，依舊強制執行下去。
	run_empty : true,
	// continue_wiki : from_wiki,
	// write_to : 'Wikipedia:沙盒',
	log_to : log_to,
	// 選擇要紀錄的項目。在大量編輯時，可利用此縮減 log。
	log_item : {
		title : false,
		report : false,
		get_pages : false,
		succeed : false,
		error_skip : false
	}
};

to_wiki.preserve_password = true;

function for_source_pages(pages, titles, title) {
	if (CeL.is_debug(2))
		CeL.show_value(pages, '[[Template:Authority control]] pages');
	// console.log('titles: ' + titles);
	from_wiki.page(pages, function(page_data) {
		titles = [];
		CeL.debug('讀取頁面內容。篩選出 {{Authority control}} 字節。');
		// template_data[from_language title]
		// = [ page_data, {{Authority control}} 字節 ]
		var template_data = CeL.null_Object();
		if (CeL.is_debug(2))
			CeL.show_value(page_data, 'page_data of [' + page_data + ']');
		page_data.forEach(function(page_data) {
			if (!page_data)
				throw new Error('Error to get pages!');

			var content = CeL.wiki.content_of(page_data),
			//
			matched = content
			//
			&& content.match(/{{\s*Authority[ _]control[\s\n]*(\|.*?)?}}/i);
			if (matched) {
				CeL.debug(page_data.title + ' → ' + matched[0]);
				template_data[page_data.title] = [ page_data, matched[0] ];
				titles.push(page_data.title);
			}
		});
		CeL.debug('取得 titles 在目標語系 (' + to_language + ') 之標題。');
		CeL.wiki.langlinks([ from_language, titles ], function(pages) {
			if (!pages)
				// done?
				return;
			titles = [];
			pages.forEach(function(page_data) {
				var title = CeL.wiki.langlinks.parse(page_data, to_language);
				if (!title) {
					CeL.warn('No translated title of [' + page_data.title
							+ ']!');
					return;
				}
				titles.push(title);
				// template_data[page_data.title][0] = title;
				// template_text[to_language title] = '{{Authority control}} 字節'
				template_text[title] = template_data[page_data.title][1];
			});
			// CeL.show_value(template_text);
			// Release memory. 釋放被占用的記憶體.
			template_data = null;
			CeL.debug('讀取' + to_language + '頁面內容。');
			to_wiki.page(titles, function(pages) {
				// CeL.show_value(pages);
				CeL.debug('to_wiki.work()');
				to_wiki.work(config, pages);
			});
		}, to_language, {
			limit : 'max',
			multi : true
		});
	}, {
		limit : 'max',
		multi : true
	});
}

// CeL.set_debug(2);
(config.last = function() {
	from_wiki.embeddedin('Template:Authority_control', for_source_pages, {
		// titles/pageids: Maximum number of values is 50 (500 for bots).
		limit : 50,
		namespace : 0,
		// 後續檢索用索引值. e.g., 'continue'
		continue_wiki : to_wiki,
		get_continue : log_to,
		// eicontinue : "",
		redirects : 1
	});
})();
