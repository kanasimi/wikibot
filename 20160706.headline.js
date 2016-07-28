// cd /d D:\USB\cgi-bin\program\wiki && node 20160706.headline.js

/*

 2016/7/6 19:41:26	import headlines of news papers
 2016/7/9 23:25:45	初版試營運
 2016/7/12 10:42:2	匯入每日香港報紙頭條新聞標題

 @see http://www.vanguardngr.com/category/headlines/

 立即停止作業: see [[n:User:Cewbot/Stop]]

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'wikinews'),

google, customsearch,

// url_cache_hash[url] = {String}title;
url_cache_hash = CeL.null_Object(),
// label_cache_hash[label] = [ {String}url ];
label_cache_hash = CeL.null_Object(),
// headline_hash[publisher] = {String}headline
headline_hash = CeL.null_Object(), headline_data = [],
// locale=香港
locale = CeL.env.arg_hash && CeL.env.arg_hash.locale,
// 已有的頭條新聞標題整合網站。須改 cx & crontab!!
headline_labels = {
	// 世界 全球
	'國際' : {
		'蘋果日報 (台灣)' : [ '"%4Y%2m%2d" "各報頭條搶先報" site:appledaily.com.tw',
				'世界各報頭條' ],
		// 中國評論通訊社: 於當日 UTC+8 23:00 後較能確保登出。
		'中國評論通訊社' : [ '"%m月%d日" "頭條新聞" site:hk.crntt.com', '國際部分' ]
	},

	'香港' : {
		// http://www.orangenews.hk/news/paperheadline/
		// 7月11日你要知的香港頭條新聞-資訊睇睇先-橙新聞
		// 不能確保可靠性
		'橙新聞' : '"%m月%d日" "香港頭條新聞" site:www.orangenews.hk',
		// 中國評論通訊社: 於當日 UTC+8 23:00 後較能確保登出。
		'中國評論通訊社' : [ '"%m月%d日" "頭條新聞" site:hk.crntt.com', '港澳部份' ]
	// TODO: http://www.cyberctm.com/news.php
	},

	// default
	'臺灣' : {
		// usage:
		// label/publisher : {String}query
		// label/publisher : [ {String}query, 擷取數 [標題關鍵字] ]
		// label : [ {String}query, [標題關鍵字], {String}publisher 發布機構 + author 作者
		// ]

		// cn
		// http://finance.sina.com.cn/stock/y/2016-07-06/doc-ifxtsatn8182961.shtml
		// http://finance.eastmoney.com/news/1353,20160706639330278.html

		// http://anm.frog.tw/%E4%BB%8A%E6%97%A5%E6%97%A9%E5%A0%B1%E9%A0%AD%E6%A2%9D%E6%96%B0%E8%81%9E%E6%95%B4%E7%90%86/

		// 中央社商情網 商情新聞中心 早報
		// 有時更新太快，造成 google 沒 cache 到，也可能找不到。有時可能得10點才會出現。
		'中央社商情網' : [ '"%Y年%m月%d日" "頭條新聞標題" site:www.cnabc.com', [ '日報'
		// 台灣主要晚報頭條新聞標題
		// , '晚報'
		] ],
		// 不知為何，Google 得要用這樣的方法才查得到晚報頭條。
		// '中央通訊社' : '台灣主要晚報頭條新聞標題 %Y年 %m月 %d日',
		'中央社商情網晚報' : [ '台灣主要晚報頭條新聞標題 %Y年 %m月 %d日', , '中央社商情網' ],

		'中央社' : '"%m月%d日" "各報頭條" site:www.cna.com.tw',
		'蘋果日報 (台灣)' : [ '"%4Y%2m%2d" "各報頭條搶先報" site:appledaily.com.tw',
				[ '世界各報頭條', '各報頭條' ] ],
		'今日新聞網' : '"%m月%d日" "各報頭條" site:www.nownews.com',
		'中時電子報' : '"%m月%d日" "各報頭版要聞" site:www.chinatimes.com',
		'鉅亨網' : '"%Y年%m月%d日" "報紙頭條" site:news.cnyes.com',
		'華視新聞網' : '"%m月%d日" "各報頭條" site:news.cts.com.tw'
	}
},
// 注意：頭條新聞標題應附上兩個以上之來源，不可全文引用。
// 參考：[[w:Wikipedia:捐赠版权材料/发送授权信|發送授權信]]、[[w:Wikipedia:捐赠版权材料|捐贈版權材料]]、[[w:Wikipedia:请求版权许可|請求版權許可]]
add_source_data = [],
// [ label, label, ... ]
error_label_list = [],
// {Object}parse_error_label_list[label _ NO] = error
parse_error_label_list,

use_date = new Date,

/** {Number}一整天的 time 值。should be 24 * 60 * 60 * 1000 = 86400000. */
ONE_DAY_LENGTH_VALUE = new Date(0, 0, 2) - new Date(0, 0, 1);

// e.g., locale=香港
headline_labels = headline_labels[CeL.env.arg_hash && CeL.env.arg_hash.locale]
		|| headline_labels[locale = '臺灣'];

if (CeL.env.arg_hash && (CeL.env.arg_hash.days_ago |= 0)) {
	// e.g., days_ago=1 : 回溯取得前一天的報紙頭條新聞標題
	use_date = new Date(use_date.getTime() - ONE_DAY_LENGTH_VALUE
			* CeL.env.arg_hash.days_ago);
}

// 手動設定前一天。
// use_date.setDate(-1);

var save_to_page = use_date.format('%Y年%m月%d日') + locale + '報紙頭條',
// 前一天, the day before
day_before = new Date(use_date.getTime() - ONE_DAY_LENGTH_VALUE),
// 後一天, 隔天 the day after
day_after = new Date(use_date.getTime() + ONE_DAY_LENGTH_VALUE),

to_remind = 'kanashimi';

// ---------------------------------------------------------------------//

function finish_up() {
	CeL.debug('更新/清除緩存並重新載入/重新整理/刷新維基新聞首頁。', 0, 'finish_up');
	CeL.get_URL(
	// 極端做法：re-edit the same contents
	// TODO: https://www.mediawiki.org/w/api.php?action=help&modules=purge
	'https://zh.wikinews.org/w/index.php?title=Wikinews:首页&action=purge');

	if (!parse_error_label_list) {
		CeL.debug('No parse error. End.', 0, 'finish_up');
		return;
	}

	var error_message = [ '[[' + save_to_page.title + ']] parse error:' ];
	for ( var label_NO in parse_error_label_list) {
		error_message.push(': ' + label_NO + ': '
		//
		+ (parse_error_label_list[label_NO].message
		//
		|| parse_error_label_list[label_NO]));
	}
	CeL.debug('最後將重大 parse error 通知程式作者。', 0, 'finish_up');
	wiki.page('User talk:' + to_remind + '/parse error').edit(
	//
	error_message.join('\n'), {
		section : 'new',
		sectiontitle : 'News parse error',
		summary : 'News parse error report',
		nocreate : 1
	});
}

function write_data() {
	CeL.debug('寫入報紙頭條新聞標題資料。', 0, 'write_data');

	// console.log(save_to_page);
	wiki.page(save_to_page).edit(function(page_data) {
		// assert: 應已設定好 page
		function headline_link(date, add_year) {
			return '[[' + date.format('%Y年%m月%d日') + locale + '報紙頭條|'
			//
			+ date.format(add_year ? '%Y年%m月%d日' : '%m月%d日') + ']]';
		}

		// 初始模板。
		var content = CeL.wiki.content_of(page_data) || '';

		if (!page_data.has_date) {
			if (/{{ *[Dd]ate[\s\|]/.test(content)) {
				throw '讀取頁面時未發現 {{date}} 模板，'
				//
				+ '寫入頁面時卻檢測到 "{{date"！請確認中途未被寫入，且程式無誤。';
			}

			CeL.debug('add {{date}}.', 0, 'write_data');
			content = '{{date|' + use_date.format('%Y年%m月%d日')
			//
			+ '}}\n\n' + content.trim();
		}

		if (!page_data.has_header) {
			CeL.debug('add header.', 0, 'write_data');
			content = content.replace(/{{date.*?}}\n/, function(section) {
				return section + '{{Headline item/header|'
				//
				+ use_date.format({
					format : locale === '臺灣' ? '[[w:民國紀年|民國]]%R年%m月%d日'
					//
					: '%Y年%m月%d日',
					locale : 'cmn-Hant-TW'
				}) + '|' + locale + '}}\n{{Headline item/footer}}\n';
			});
		}

		if (headline_data.length > 0) {
			CeL.debug('add headline.', 0, 'write_data');
			content = content.replace(/{{Headline item\/header.*?}}\n/,
			//
			function(section) {
				section += headline_data.sort().uniq().join('\n') + '\n';
				return section;
			});
		}

		var has_new_data = add_source_data.length > 0;
		if (has_new_data) {
			CeL.debug('add {{source}}.', 0, 'write_data');
			add_source_data = add_source_data.sort().uniq().join('\n') + '\n';
			content = content.replace(
			//
			/(?:\n|^)==\s*消息來源\s*==\n/, function(section) {
				CeL.debug('add source after section.', 0, 'write_data');
				section += add_source_data;
				add_source_data = null;
				return section;
			});

			if (add_source_data) {
				content = content.replace(
				//
				/(?:\n|^){{ *[Hh]eadline[ _]item\/footer}}\n+/
				//
				, function(section) {
					CeL.debug('add source after {{Headline item/footer}}.',
					//
					0, 'write_data');
					section = section.trimRight()
					//
					+ '\n\n== 消息來源 ==\n' + add_source_data;
					add_source_data = null;
					return section;
				});
			}

			if (add_source_data) {
				CeL.debug('add source at last.', 0, 'write_data');
				// 不具此 section。
				content = content.trim()
				// * 各報報章及其網頁\n
				+ '\n\n== 消息來源 ==\n' + add_source_data;
			}
		}

		if (!page_data.has_navbox) {
			CeL.debug('add 頭條導覽 {{headline navbox}}.', 0, 'write_data');
			// @see [[w:模板:YearTOC]], [[en:Template:S-start]]
			content = content.trim() + '\n\n{{headline navbox|'
			// workaround...
			+ (locale === '臺灣' ? '台灣' : locale) + '|'
			//
			+ use_date.format('%Y年%m月') + '|' + use_date.format('%d日') + '|'
			//
			+ headline_link(day_before) + '|'
			//
			+ headline_link(day_after) + '}}\n';
		}

		if (!page_data.has_stage_tag
		//
		&& (has_new_data || parse_error_label_list)) {
			CeL.debug('標上文章標記: '
			//
			+ (has_new_data ? '有' : '無') + '新 source 資料，'
			//
			+ (parse_error_label_list ? '有' : '無') + ' parse 錯誤。'
			//
			, 0, 'write_data');
			content = content.trim() + '\n'
			// [[維基新聞:文章標記]]: 沒 parse 錯誤才標上{{Publish}}。
			// "發表後24小時不應進行大修改" 新聞於發布後七天進行存檔與保護
			+ (has_new_data && !parse_error_label_list ? '{{Publish}}'
			// 必須有新資料才{{Publish}}。
			: '{{Review}}') + '\n';
		}

		if (error_label_list.length > 0) {
			this.summary += '. Error: ' + error_label_list.join(', ');
		}
		if (parse_error_label_list) {
			this.summary += '. Parse error: '
			//
			+ Object.keys(parse_error_label_list).join(', ');
		}

		CeL.debug('寫入報紙頭條新聞標題資料至[['
		//
		+ page_data.title + ']]。', 0, 'write_data');
		// console.log(save_to_page);
		return content;

	}, {
		bot : 1,
		// 匯入每日報紙頭條新聞標題
		summary : '匯入' + locale + '報紙頭條新聞標題'
	})
	//
	.run(finish_up);

}

function add_headline(publisher, headline) {
	publisher = publisher.replace(/\s+/g, '');
	// 修正報紙標題。
	switch (publisher) {
	case '聯晚':
		publisher = '聯合晚報';
		break;

	case '經濟日報':
		if (locale === '香港') {
			// 已有香港經濟日報條
			publisher = locale + publisher;
			break;
		}
	case '信報':
		if (locale === '香港') {
			// 已有信報財經新聞條
			publisher += '財經新聞';
			break;
		}
	case '文匯報':
	case '蘋果日報':
	case '東方日報':
		publisher += ' (' + locale + ')';
		break;

	default:
	}

	headline = headline.replace(/&nbsp;/g, ' ').replace(/\s{2,}/g, ' ').trim();

	if (headline_hash[publisher]) {
		if (headline_hash[publisher] === headline) {
			// pass 去掉重複的。
			CeL.debug('[' + publisher + '] 已有此 headline: [' + headline
					+ '], skip it.', 0, 'add_headline');
			return;
		}
		CeL.debug('[' + publisher + '] 有不同的 headline: ['
		//
		+ headline_hash[publisher] + '] vs. [' + headline + ']', 0,
				'add_headline');
	}

	CeL.debug('登記此 headline: [' + publisher + ']: [' + headline + '].', 0,
			'add_headline');
	headline_hash[publisher] = headline;

	headline_data.push('{{HI|' + publisher + '|' + headline + '}}');
}

function parse_橙新聞_headline(response, publisher) {
	var count = 0, news_content = response.between(
			'function content() parse begin', 'function content() parse end');
	[ '文匯報', '東方日報', '大公報', '明報', '星島日報', '經濟日報', '頭條日報' ].forEach(function(
			name) {
		if (news_content.includes(name))
			count++;
	});
	if (count < 2) {
		CeL.err('parse_橙新聞_headline: Can not parse [' + publisher + ']!');
		CeL.log('parsed: ' + JSON.stringify(news_content));
		CeL.warn(JSON.stringify(response));
		return;
	}

	var matched,
	// e.g., "<strong>headline</strong>《文匯報》"
	PATTERN = /<strong>([^<>]+)<\/strong>\s*《([^《》]+)》/g;
	count = 0;
	while (matched = PATTERN.exec(news_content)) {
		count++;
		add_headline(matched[2],
		//
		matched[1].replace(/^[【\s]+/, '').replace(/[】\s]+$/, ''));
	}

	// e.g., "<strong>headline《文匯報》</strong>"
	PATTERN = /<strong>([^<>]+)\s*《([^《》]+)》\s*<\/strong>/g;
	while (matched = PATTERN.exec(news_content)) {
		count++;
		add_headline(matched[2],
		//
		matched[1].replace(/^[【\s]+/, '').replace(/[】\s]+$/, ''));
	}

	// e.g.,
	// "<p><strong>《文匯報》：【避答「獨謀」求延覆「確認」</strong><strong>梁天琦圖騙選民】</strong></p>"
	PATTERN = /<p><strong>(.*?)<\/strong><\/p>/g;
	while (matched = PATTERN.exec(news_content)) {
		count++;
		matched = matched[1].replace(/<\/?strong>/g, '');
		var title;
		matched = matched.replace(/《([^《》]+)》/, function($0, $1) {
			title = $1;
			return '';
		}).trim();
		add_headline(title,
		//
		matched.replace(/^[：【\s]+/, '').replace(/[】\s]+$/, ''));
	}

	// 照理來說經過 parse 就應該有東西。
	return count;
}

// TODO: CNML格式
function parse_中國評論新聞_headline(response, publisher) {
	CeL.debug('test 移動版。', 0, 'parse_中國評論新聞_headline');
	var news_content = response.between('detail_content', '</div>')
			.between('>').trim();

	if (!news_content) {
		CeL.debug('test 電腦版。', 0, 'parse_中國評論新聞_headline');
		news_content = response.between('<body ').between('頭條新聞').between(
				'<table width="100%', '</table>').between('<td', '</td>')
				.between('>').trim();
	}

	if (false && !news_content) {
		// 這種方法出來的不能判別年份。
		CeL.debug('test 移動版 2。', 0, 'parse_中國評論新聞_headline');
		news_content = response.between('<body').between('頭條新聞').between(
				'<br>', '</td>').replace(/原文網址/g, '').trim();
	}

	if (!news_content || !response.includes(use_date.format('%Y-'))
			|| !news_content.includes('日報：') && !news_content.includes('文匯報：')) {
		CeL.err('parse_中國評論新聞_headline: Can not parse [' + publisher + ']!');
		CeL.log('parsed: ' + JSON.stringify(news_content));
		CeL.warn(JSON.stringify(response));
		return;
	}

	news_content = news_content.replace(/<br(?:[^<>]+)>/ig, '\n')
	// 去掉所有 tags
	.replace(/<\/?[a-z](?:[^<>]+)>/ig, '');

	var count = 0;
	news_content.split(/[\r\n]{2,}/).forEach(function(item) {
		item = item.trim();
		if (!item) {
			return;
		}
		var matched = item.match(/^([^：～:]+)[：～:](.+)$/);
		if (!matched) {
			CeL.err('parse_中國評論新聞_headline: Can not parse ['
			//
			+ publisher + ']: [' + item + ']');
			return;
		}

		count++;
		add_headline(matched[1],
		// 報紙標題。
		matched[2].replace(/[。\n]+$/, ''));
	});

	// 照理來說經過 parse 就應該有東西。
	return count;
}

// 中央社日報一般過 UTC+8 8:30 才會開始更新，晚報 UTC+8 15:00。
function parse_中央社_headline(response, publisher) {
	var news_content = response.between('news_content').between('新聞本文 開始',
			'新聞本文 結束').between('<div class="box_2">', '</div>');
	if (!news_content.includes('頭條新聞標題如下：')) {
		CeL.err('parse_中央社_headline: Can not parse [' + publisher + ']!');
		CeL.log('parsed: ' + JSON.stringify(news_content));
		CeL.warn(JSON.stringify(response));
		return;
	}

	var count = 0;
	news_content.between('頭條新聞標題如下：').replace(/<br[^<>]*>/ig, '\n')
	//
	.replace(/<[^<>]*>/g, '').split(/[\r\n]+/).forEach(function(item) {
		item = item.trim();
		if (!item) {
			return;
		}
		var matched = item.match(/^([^：～:]+)[：～:](.+)$/);
		if (!matched) {
			CeL.err('parse_中央社_headline: Can not parse ['
			//
			+ publisher + ']: [' + item + ']');
			return;
		}

		count++;
		add_headline(matched[1].replace(/頭條/, ''),
		// 報紙標題。
		matched[2].replace(/[。\n]+$/, ''));
	});

	// 照理來說經過 parse 就應該有東西。
	return count;
}

// 實際解析/既定 parser。
var parse_headline = {
	'橙新聞' : parse_橙新聞_headline,

	'中國評論通訊社' : parse_中國評論新聞_headline,

	'中央社商情網' : parse_中央社_headline,
	'中央社商情網晚報' : parse_中央社_headline
};

function check_headline_data(labels_to_check) {
	if (add_source_data.length === 0) {
		CeL.debug('沒有新 source 資料，或者全部錯誤。', 0, 'check_headline_data');
		// 依然持續執行，因為可能需要補上其他闕漏資料。
		// return;
	}

	// add_source_data.sort();

	for ( var label in labels_to_check) {
		error_label_list.push(label);
	}

	var publisher_to_check = [];
	for ( var publisher in label_cache_hash) {
		if (parse_headline[publisher]) {
			CeL.debug('publisher_to_check += ' + publisher, 0,
					'check_headline_data');
			publisher_to_check.push(publisher);
		}
	}

	var this_label_left;
	function next_label() {
		if (--this_label_left > 0) {
			// 本 label_cache_hash[label] 尚有未處理者。
			return;
		}

		if (publisher_to_check.length === 0) {
			write_data();
			return;
		}
		var label = publisher_to_check.pop();
		this_label_left = label_cache_hash[label].length;

		label_cache_hash[label].forEach(function(url, index) {
			CeL.get_URL(url, function(XMLHttp) {
				var status_code = XMLHttp.status,
				//
				response = XMLHttp.responseText;

				CeL.debug('開始處理 [' + label + '] 的 headline (' + url + ')', 0,
						'next_label');
				try {
					if (!parse_headline[label](response, label)
					// 照理來說經過 parse 就應該有東西。但 add_headline() 會去掉重複的。
					// || headline_data.length === 0
					) {
						throw new Error('[' + label
								+ ']: No headline get! Parse error?');
					}
				} catch (e) {
					if (!parse_error_label_list) {
						parse_error_label_list = CeL.null_Object();
					}
					parse_error_label_list[label + '_' + index] = e;
				}

				next_label();

			}, undefined, undefined, {
				onfail : function(error) {
					CeL.err('next_label: Error to get [' + label + ']: [' + url
							+ ']');
					next_label();
				}
			});
		});

	}

	next_label();
}

// return 有去掉/已處理過。
function remove_completed(labels_to_check, label, title, url, to_add_source) {
	if (!title || typeof title !== 'string' || !(label in labels_to_check))
		return;

	CeL.log('remove_completed: 準備登記已處理過: [' + title
	//
	+ (url ? ']: ' + url : '') + '。');

	if (!/[頭头][版條条]/.test(title)) {
		CeL.debug('非頭條? [' + title + ']', 0, 'remove_completed');
		return;
	}
	// assert: typeof title === 'string'
	var matched = title.match(/(\d+月)(\d+日)/);
	if (matched && use_date.format('%m月%d日') !==
	//
	matched[1].replace(/^0+/, '') + matched[2].replace(/^0+/, '')) {
		CeL.debug('日期(?月?日)不符? [' + matched[0] + ']', 0, 'remove_completed');
		return;
	}
	if (/\d{8}/.test(title) && !title.includes(use_date.format('%Y%2m%2d'))) {
		// e.g., 蘋果日報
		CeL.debug('日期(年 or 月日dddd)不符? [' + title + ']', 0, 'remove_completed');
		return;
	}
	if (/\d{4}/.test(title) && !title.includes(use_date.format('%2m%2d'))
			&& !title.includes(use_date.format('%Y'))) {
		// e.g., 蘋果日報
		CeL.debug('日期(年 or 月日dddd)不符? [' + title + ']', 0, 'remove_completed');
		return;
	}
	matched = title.match(/(\d{4})-\d/)
	if (matched && matched[1] !== use_date.format('%Y')) {
		// e.g., 中國評論通訊社
		CeL.debug('日期(年 dddd)不符? [' + title + ']', 0, 'remove_completed');
		return;
	}
	matched = title.match(/\d+年/);
	if (matched && use_date.format('%Y年') !== matched[0].replace(/^0+/, '')) {
		CeL.debug('日期(?年)不符? [' + matched[0] + ']', 0, 'remove_completed');
		return;
	}

	var new_added = true;
	if (url) {
		// 登記url，以避免重複加入url。
		if (url_cache_hash[url]) {
			new_added = false;
			CeL.log('remove_completed: 重複處理了 [' + url + ']: '
					+ url_cache_hash[url] + ' & ' + title + '.');
		} else {
			url_cache_hash[url] = title;
		}

		if (Array.isArray(label_cache_hash[label])) {
			label_cache_hash[label].push(url);
		} else {
			label_cache_hash[label] = [ url ];
		}
	}

	// 登記並去除已處理之label。
	var label_data = labels_to_check[label],
	// publisher 得要在被 remove_completed() 刪除前先 cache 好!
	// label : [ {String}query, 擷取數 [標題關鍵字], {String}publisher ]
	publisher = Array.isArray(label_data) && label_data[2] || label;

	if (Array.isArray(label_data)) {
		if (!label_data[1]) {
			// label : [ {String}query, , {String}publisher 發布機構 + author 作者 ]
			// →
			// label/publisher : {String}query
			label_data = label_data[0];
		} else if (!Array.isArray(label_data[1])) {
			// label : [ {String}query, 標題關鍵字 ]
			// →
			// label : [ {String}query, [標題關鍵字] ]
			label_data[1] = [ label_data[1] ];
		}
	}

	function _add_source() {
		if (!new_added || !to_add_source) {
			return new_added;
		}

		CeL.debug('add source: label [' + label + '], publisher ' + publisher
				+ ', url=' + url, 0, '_add_source');

		// console.log(labels_to_check);
		// add [[n:Template:source]]
		add_source_data.push('* {{source|url=' + url
		//
		+ '|title=' + title.replace(/[\s\|]+/g, ' ')
		// 不填作者:這些來源有些根本也沒附摘錄者，因此想填作者也不成
		// + '|author=' + publisher
		//
		+ '|pub=' + publisher
		//
		+ '|date=' + use_date.format('%Y年%m月%d日')
		//
		+ (label === publisher ? '' : '|label=' + label) + '}}');

		return new_added;
	}

	if (Array.isArray(label_data)) {
		// label : [ {String}query, [標題關鍵字] ]
		// assert: Array.isArray(label_data[1])
		CeL.debug('檢查標題關鍵字: [' + label_data[1] + '] in "' + title + '"', 0,
				'remove_completed');
		return label_data[1].some(function(key, index) {
			if (title.includes(key)) {
				if (label_data[1].length === 1) {
					CeL.debug('[' + label + ']: 到齊了。', 0, 'remove_completed');
					delete labels_to_check[label];
				} else {
					CeL.debug('[' + label + ']: 去掉本 key [' + key + ']。', 0,
							'remove_completed');
					label_data[1].splice(index, 1);
				}
				return true;
			}
		})
				&& _add_source();
	}

	CeL.debug(
	// label/publisher : {String}query
	'[' + label + ']: 標注已處理過 [' + title + ']。', 0, 'remove_completed');
	delete labels_to_check[label];
	return _add_source();
}

function search_橙新聞(labels_to_check, check_left) {
	var label = '橙新聞', url = 'http://www.orangenews.hk/news/paperheadline/';
	CeL.debug('開始取得 [' + label + '] 的 headline list [' + url + ']', 0,
			'search_橙新聞');
	CeL.get_URL(url, function(XMLHttp) {
		var status_code = XMLHttp.status,
		//
		response = XMLHttp.responseText;

		CeL.debug('開始處理 [' + label + '] 的 headline list', 0, 'search_橙新聞');
		var matched, PATTERN = /<a ([^<>]+)>([^<>]+)<\/a>/g;
		while (matched = PATTERN.exec(response)) {
			CeL.debug('Find [' + matched[0] + ']', 2, 'search_橙新聞');
			if (matched[2].includes('香港頭條新聞')
					&& matched[2].includes(use_date.format('%m月%d日'))) {
				var link = matched[1].match(/href="([^"]+)"/);
				if (link) {
					remove_completed(labels_to_check, label, matched[2].trim(),
							link[1], true);
					PATTERN = null;
					break;
				}
			}
		}

		if (PATTERN) {
			CeL.err('search_橙新聞: No headline get!');
		}

		check_left();

	}, undefined, undefined, {
		onfail : function(error) {
			CeL.err('search_橙新聞: Error to get headline list');
			check_left();
		}
	});
}

function check_labels(labels_to_check) {
	var labels = Object.keys(labels_to_check),
	// 剩下 remain
	left = labels.length;
	CeL.debug('有 ' + left + ' 個 label: ' + labels, 0, 'check_labels');

	if (!left) {
		check_headline_data(labels_to_check);
		return;
	}

	// 從 response 取資訊做查詢添入 add_source_data。
	function for_label(label, error, response) {
		left--;
		if (error) {
			CeL.err('for_label: [' + label + ']: error: ' + error);
			if (!left) {
				check_headline_data(labels_to_check);
			}
			return;
		}

		CeL.log('for_label: Search Google for [' + label + ']: '
				+ response.searchInformation.formattedTotalResults
				+ ' results.');
		if (!response.items || response.items.length === 0) {
			CeL.log('for_label: [' + label + ']: No data get: '
					+ JSON.stringify(response.url));
			if (!left) {
				check_headline_data(labels_to_check);
			}
			return;
		}

		// CeL.log('First result name is ' + response.items[0].title);

		// item: e.g.,
		// {"kind":"customsearch#result","title":"台灣主要日報頭條新聞標題2016年7月5日|即時新聞|中央社商情網",
		// "htmlTitle":"...","link":"http://www.cnabc.com/news/aall/201607050083.aspx","displayLink":"www.cnabc.com","snippet":"...","htmlSnippet":"...","cacheId":"BlsHSMJeb9AJ","formattedUrl":"www.cnabc.com/news/aall/201607050083.aspx","htmlFormattedUrl":"www.cnabc.com/news/aall/201607050083.aspx",
		// "pagemap":{"metatags":[{"viewport":"width=device-width,initial-scale=1.0","og:title":"...","og:image":"http://img1.cna.com.tw/cbp/images/pic_fb.jpg","og:url":"http://www.cnabc.com/news/aall/201607050083.aspx","og:type":"article"}],"cse_image":[{"src":"http://img1.cna.com.tw/cbp/images/pic_fb.jpg"}]}}
		function add_source(item) {
			if (!remove_completed(labels_to_check, label, item.title,
					item.link, true)) {
				CeL.err('add_source: error title: [' + item.title + '] ['
						+ item.link + ']');
				console.log(item);
			}
			CeL.debug('[' + label + ']: '
			//
			+ (labels_to_check[label] ? '尚存有未處理資料，將持續處理下去。'
			//
			: '已無未處理資料，將跳出此項。'), 0, 'add_source');
			// console.log(labels_to_check);
			return labels_to_check[label];
		}

		response.items.every(add_source);

		if (!left) {
			check_headline_data(labels_to_check);
		}
	}

	// 從 labels_to_check 取資訊做查詢。
	function search_Google(label) {
		if (label === '橙新聞') {
			search_橙新聞(labels_to_check, function check_left() {
				left--;
				CeL.debug('Search headline of [' + label + '] finished. '
						+ left + ' left.', 0, 'search_Google');
				if (!left) {
					check_headline_data(labels_to_check);
				}
			});
			return;
		}

		// query string
		var query = labels_to_check[label];
		if (Array.isArray(query)) {
			// label/publisher : [ {String}query, 擷取數 [標題關鍵字] ]
			query = query[0];
		}
		query = use_date.format(query);
		CeL.debug('Search Google for [' + label + ']: [' + query + ']', 0,
				'search_Google');

		if (!customsearch) {
			// 這可能需要十幾秒。
			google = require('googleapis');
			customsearch = google.customsearch('v1');
		}
		// https://github.com/google/google-api-nodejs-client/blob/master/samples/customsearch/customsearch.js
		customsearch.cse.list(Object.assign({
			q : query
		}, API_code), function(error, response) {
			for_label(label, error, response);
		});
	}

	labels.forEach(search_Google);
}

// ----------------------------------------------------------------------------

// CeL.set_debug(2);

wiki.page(save_to_page, function(page_data) {
	save_to_page = page_data;
	CeL.info('採用頁面標題: [[' + page_data.title + ']]');
	var labels_to_check = Object.clone(headline_labels, true);
	if (!page_data || ('missing' in page_data)) {
		CeL.info('[[' + page_data.title + ']]: 此頁面不存在/已刪除。');
		check_labels(labels_to_check);
		return;
	}

	var parser = CeL.wiki.parser(page_data).parse();
	if (CeL.wiki.content_of(page_data) !== parser.toString()) {
		// debug 用. check parser, test if parser working properly.
		throw 'Parser error: [[' + page_data.title + ']]';
	}

	function for_each_template(token, token_index, token_parent) {
		if (page_data.done) {
			return;
		}
		console.log(token);

		switch (token.name) {
		case 'Date':
			page_data.has_date = token.parameters[1];
			break;

		case 'Headline item/header':
			page_data.has_header = true;
			break;

		case 'Headline item':
		case 'HI':
			headline_hash[token.parameters[1]] = token.parameters[2];
			break;

		case 'Source':
			if (token.parameters.url) {
				var label = token.parameters.label || token.parameters.pub;
				remove_completed(labels_to_check, label,
						token.parameters.title, token.parameters.url);
			}
			break;

		case 'Headline navbox':
			page_data.has_navbox = true;
			break;

		case 'Archived':
		case 'Publish':
			// 即使已經Publish，依舊更改。
			// page_data.done = true;
			// return;
		case 'Review':
		case 'Develop':
			// {{develop}}
			// @see [[維基新聞:文章標記]], [[Wikinews:Article stage tags]]
			// [[Category:新闻标记模板]]
			page_data.has_stage_tag = token.name;
			break;
		}

	}

	parser.each('template', for_each_template);
	if (page_data.done) {
		CeL.log('已發布: [[' + page_data.title + ']]');
		return;
	}
	// console.log(labels_to_check);
	check_labels(labels_to_check);
});
