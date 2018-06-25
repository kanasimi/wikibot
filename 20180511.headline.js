// cd /d D:\USB\cgi-bin\program\wiki && node 20180511.headline.js locale=香港

/*

 2018/5/10 19:38:21	import headlines of news papers
 2018/5/11 19:40:55	初版試營運

 立即停止作業: see [[n:User:Cewbot/Stop]]


 */

// ----------------------------------------------------------------------------
'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

CeL.run(
// CeL.character.load(), 僅在要設定 this.charset 時才需要載入。
'data.character');

CeL.character.load('big5');

var working_queue = CeL.null_Object(),
//
user_agent = 'Mozilla/5.0 (Windows NT 6.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.101 Safari/537.36',

/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'wikinews'),

// url_cache_hash[url] = {String}title;
url_cache_hash = CeL.null_Object(),
// label_cache_hash[label] = [ {String}url ];
label_cache_hash = CeL.null_Object(),
// headline_hash[publisher] = [ {String}headline ]
headline_hash = CeL.null_Object(),
// 需要新加入的 headline_wikitext_list = [ '{{HI|...}}', ... ]
headline_wikitext_list = [],
// 包括已處理與未處理過的headline。
all_headlines = 0,
// locale=香港
locale = CeL.env.arg_hash && CeL.env.arg_hash.locale || '臺灣',

// 注意：頭條新聞標題應附上兩個以上之來源，不可全文引用。
// 參考：[[w:Wikipedia:捐赠版权材料/发送授权信|發送授權信]]、[[w:Wikipedia:捐赠版权材料|捐贈版權材料]]、[[w:Wikipedia:请求版权许可|請求版權許可]]
add_source_data = [],
// [ label, label, ... ]
error_label_list = [],
// {Object}parse_error_label_list[label _ NO] = error
parse_error_label_list,

use_date = new Date,

// copy from data.date.
/** {Number}一整天的 time 值。should be 24 * 60 * 60 * 1000 = 86400000. */
ONE_DAY_LENGTH_VALUE = new Date(0, 0, 2) - new Date(0, 0, 1);

if (CeL.env.arg_hash && (CeL.env.arg_hash.days_ago |= 0)) {
	// e.g., days_ago=1 : 回溯取得前一天的報紙頭條新聞標題
	use_date = new Date(use_date.getTime() - ONE_DAY_LENGTH_VALUE
			* CeL.env.arg_hash.days_ago);
}

// 手動設定前一天。
// use_date.setDate(-1);

// 报纸头条
var save_to_page = use_date.format('%Y年%m月%d日') + locale + '報紙頭條',
// 前一天, the day before
day_before = new Date(use_date.getTime() - ONE_DAY_LENGTH_VALUE),
// 後一天, 隔天 the day after
day_after = new Date(use_date.getTime() + ONE_DAY_LENGTH_VALUE),

to_remind = owner_name;

// ---------------------------------------------------------------------//

// 自動創建不存在的類別
// create Category:2016年9月報紙頭條 2016年9月香港報紙頭條
// [[Category:2016年報紙頭條]]
function create_category() {
	wiki.page('Category:' + use_date.format('%Y年%m月') + '報紙頭條')
	//
	.edit(function(page_data) {
		var content = CeL.wiki.content_of(page_data) || '';
		if (!content || !/\[\[Category:\d{4}年報紙頭條(?:\||\]\])/.test(content)) {
			content = content.trim() + '\n[[Category:'
			//
			+ use_date.format('%Y年') + '報紙頭條]]';
		}

		return content;
	}, {
		bot : 1,
		summary : '自動創建/添加頭條新聞類別'
	});

	var _locale = locale === '臺灣' ? '台灣' : locale;
	wiki.page('Category:' + use_date.format('%Y年%m月') + _locale + '報紙頭條')
	//
	.edit(function(page_data) {
		var content = CeL.wiki.content_of(page_data) || '';
		if (!content
		//
		|| !/\[\[Category:\d{4}年[^\[\]\|]+?報紙頭條(?:\||\]\])/.test(content)) {
			content = content.trim() + '\n[[Category:'
			//
			+ use_date.format('%Y年') + _locale + '報紙頭條|'
			//
			+ use_date.format('%m') + ']]';
		}

		if (!content
		//
		|| !/\[\[Category:\d{4}年1?\d月(?:\||\]\])/.test(content)) {
			content = content.trim() + '\n[[Category:'
			//
			+ use_date.format('%Y年%m月') + '|' + _locale + ']]';
		}

		return content;
	}, {
		bot : 1,
		summary : '自動創建/添加頭條新聞類別'
	});
}

function finish_up() {
	CeL.debug('更新維基新聞首頁。', 1, 'finish_up');
	wiki.purge('Wikinews:首页');

	if (!parse_error_label_list) {
		CeL.debug('No parse error. End.', 1, 'finish_up');
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
	CeL.debug('最後將重大 parse error 通知程式作者。', 1, 'finish_up');
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
	CeL.debug('寫入報紙頭條新聞標題資料。', 1, 'write_data');

	// console.log(save_to_page);
	// console.log(headline_wikitext_list);
	wiki.page(save_to_page).edit(function(page_data) {
		// assert: 應已設定好 page
		function headline_link(date, add_year) {
			return '[[' + date.format('%Y年%m月%d日') + locale + '報紙頭條|'
			//
			+ date.format(add_year ? '%Y年%m月%d日' : '%m月%d日') + ']]';
		}

		var content = CeL.wiki.content_of(page_data) || '',
		//
		has_new_data = add_source_data.length > 0;

		if (!has_new_data && !content) {
			// 須在成功取得最少一份報紙的頭條才建立新聞稿。這樣可以避免浪費人力去刪掉沒有內容的空白新聞稿。
			return;
		}

		// 初始模板。
		if (!page_data.has_date) {
			if (/{{ *[Dd]ate[\s\|]/.test(content)) {
				throw '讀取頁面時未發現 {{Date}} 模板，'
				//
				+ '寫入頁面時卻檢測到 "{{Date"！請確認中途未被寫入，且程式無誤。';
			}

			CeL.debug('add {{Date}}.', 1, 'write_data');
			content = '{{Date|' + use_date.format('%Y年%m月%d日')
			//
			+ '}}\n\n' + content.trim();
		}

		if (!page_data.has_header) {
			CeL.debug('add header.', 1, 'write_data');
			content = content.replace(/{{ *[Dd]ate.*?}}\n/, function(section) {
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

		if (headline_wikitext_list.length === 0
		// 原先已經有資料，並且是Review狀態的時候，還是需要更改一下。
		&& !(page_data.stage_node && page_data.stage_node.name === 'Review'
		// 已經有頭條新聞資料時，直接標示{{Publish}}。
		&& all_headlines > 2)) {
			// 沒有新頭條時不寫入資料。
			CeL.debug('沒有新 headline 資料。Skip.', 1, 'write_data');
			return [ CeL.wiki.edit.cancel, 'skip' ];
		}

		if (headline_wikitext_list.length > 0) {
			CeL.info('write_data: add '
			//
			+ headline_wikitext_list.length + ' headlines');
			this.summary += ': add '
			//
			+ headline_wikitext_list.length + ' headlines'
			content = content.replace(/{{Headline item\/header.*?}}\n/,
			//
			function(section) {
				section += headline_wikitext_list.sort()
				//
				.unique_sorted().join('\n') + '\n';
				return section;
			});
		}

		if (has_new_data) {
			CeL.debug('add {{Source}}.', 1, 'write_data');
			add_source_data = add_source_data.sort()
			//
			.unique_sorted().join('\n') + '\n';
			content = content.replace(
			//
			/(?:\n|^)==\s*消息來源\s*==\n/, function(section) {
				CeL.debug('add {{Source}} after section.', 1, 'write_data');
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
					1, 'write_data');
					section = section.trimEnd()
					//
					+ '\n\n== 消息來源 ==\n' + add_source_data;
					add_source_data = null;
					return section;
				});
			}

			if (add_source_data) {
				CeL.debug('add {{Source}} at last.', 1, 'write_data');
				// 不具此 section。
				content = content.trim()
				// * 各報報章及其網頁\n
				+ '\n\n== 消息來源 ==\n' + add_source_data;
			}
		}

		if (!page_data.has_navbox) {
			CeL.debug('add 頭條導覽 {{Headline navbox}}.', 1, 'write_data');
			// @see [[w:模板:YearTOC]], [[en:Template:S-start]]
			content = content.trim() + '\n\n{{Headline navbox|'
			// workaround...
			+ (locale === '臺灣' ? '台灣' : locale) + '|'
			//
			+ use_date.format('%Y年%m月') + '|' + use_date.format('%d日') + '|'
			//
			+ headline_link(day_before) + '|'
			//
			+ headline_link(day_after) + '}}\n';
		}

		if (CeL.is_debug()) {
			CeL.debug('stage node: ' + page_data.stage_node
			//
			+ ', all_headlines ' + all_headlines
			//
			+ ', headline_wikitext_list['
			//
			+ headline_wikitext_list.length + ']:', 1, 'write_data');
			console.log(headline_wikitext_list);
		}

		if (page_data.stage_node) {
			if (page_data.stage_node.name === 'Review'
			// 已經有頭條新聞資料時，直接標示{{Publish}}。
			&& all_headlines > 2) {
				CeL.debug('已經有頭條新聞資料，直接改' + page_data.stage_node
				//
				+ '標示為{{Publish}}。', 1, 'write_data');
				// page_data.stage_node.name = 'Publish';
				content = content.replace(
				//
				page_data.stage_node.toString(), '{{Publish}}');
			}

		} else if (has_new_data || parse_error_label_list) {
			CeL.debug('標上文章標記: '
			//
			+ (has_new_data ? '有' : '無') + '新 source 資料，'
			//
			+ (parse_error_label_list ? '有' : '無') + ' parse 錯誤。',
			//
			1, 'write_data');
			content = content.trim() + '\n'
			// [[維基新聞:文章標記]]: 沒 parse 錯誤才標上{{Publish}}。
			// "發表後24小時不應進行大修改" 新聞於發布後七天進行存檔與保護
			+ (has_new_data && !parse_error_label_list
			//
			&& headline_wikitext_list.length > 0 ? '{{Publish}}'
			// 必須有新資料才{{Publish}}。
			: '{{Review}}') + '\n';
		}

		if (error_label_list.length > 0) {
			this.summary += '. Fetch error: ' + error_label_list.join(', ');
		}
		if (parse_error_label_list) {
			this.summary += '. Parse error: '
			//
			+ Object.keys(parse_error_label_list).join(', ');
		}

		CeL.debug('寫入報紙頭條新聞標題資料至[['
		//
		+ page_data.title + ']]。', 1, 'write_data');
		// console.log(save_to_page);
		// console.log(content);
		wiki.run(create_category);
		return content;

	}, {
		bot : 1,
		tags : 'import headline',
		// 匯入每日報紙頭條新聞標題
		summary : '匯入' + locale + '報紙頭條新聞標題'
	})
	// .run(create_category)
	.run(finish_up);

}

function preparse_headline_data(headline_data) {
	if (Array.isArray(headline_data)) {
		var matched = headline_data.toString().match(
				/\[([^\[\]\s]+) ([^\[\]]+)\]/);
		if (matched) {
			headline_data = {
				url : matched[1],
				headline : matched[2]
			};
		} else if (matched = headline_data.toString().match(
				/([\s\S]+?)\s+<!--\s(https?:\/\/\S+?)\s-->/)) {
			headline_data = {
				url : matched[2],
				headline : matched[1]
			};
		}
	}

	// console.log(headline_data);
	return headline_data;
}

function add_to_headline_hash(publisher, headline_data, source, is_new) {
	headline_data = preparse_headline_data(headline_data);

	var headline;

	if (typeof headline_data === 'object') {
		if (headline_data.url in url_cache_hash) {
			// 已經處理過這個頭條。
			return;
		}

		if ('headline' in headline_data) {
			if (!headline_data.headline) {
				// 跳過空的頭條。
				return;
			}
			headline = headline_data.headline;
		}
	}

	// 頭條不允許換行。
	headline = (headline || headline_data.toString()).replace(/\n/g, '　');
	CeL.debug('登記此 headline: [' + publisher + ']: [' + headline + '].', 1,
			'add_to_headline_hash');

	all_headlines++;

	var wikitext = '{{HI|' + publisher + '|' + headline
	//
	+ (headline_data.url ? '|url=' + headline_data.url : '')
	//
	+ (source ? '|source=' + source : '')
	//
	+ '}}';

	if (Array.isArray(headline_hash[publisher])) {
		if (headline_hash[publisher].includes(headline)) {
			// pass 去掉重複的。
			CeL.debug('[' + publisher + '] 已有此 headline: [' + headline
					+ '], skip it.', 1, 'add_to_headline_hash');
			return;
		}

		CeL.debug('[' + publisher + '] 添加不同的 headline: ['
		//
		+ headline + '] ⇒ [' + headline_hash[publisher] + ']', 1,
				'add_to_headline_hash');

		headline_hash[publisher].push(headline);
		if (is_new) {
			headline_wikitext_list.push(wikitext);
		}
		return;
	}

	if (publisher in headline_hash) {
		CeL.warn('headline_hash[' + publisher + '] is NOT Array.', 0,
				'add_to_headline_hash');
	}
	headline_hash[publisher] = [ headline ];
	if (is_new) {
		headline_wikitext_list.push(wikitext);
	}
}

function fix_publisher(publisher) {
	publisher = publisher.replace(/&nbsp;/g, ' ').trim()
	//
	.replace(/\s+([^\s])/g, function($0, $1) {
		// e.g., "蘋果日報 (香港)"
		if ($1 === '(') {
			return ' ' + $1;
		}
		return $1;
	});
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

	return publisher;
}

function add_headline(publisher, headline_data, source) {
	publisher = fix_publisher(publisher);

	if (typeof headline_data === 'string') {
		headline_data = headline_data.replace(/&nbsp;/g, ' ').replace(
				/\s{2,}/g, ' ').trim();
	}

	add_to_headline_hash(publisher, headline_data, source, true);
}

// ----------------------------------------------------------------------------

var source_configurations = {
	// 臺灣主要報刊 頭條 要聞
	// 自由時報: 6點的時候可能還是昨天的新聞
	// 人間福報, 青年日報: 可能到下午才會出新訊息
	臺灣 : {
		自由時報 : {
			url : 'http://news.ltn.com.tw/list/newspaper/focus/'
					+ use_date.format('%Y%2m%2d'),
			parser : parser_自由時報_頭版新聞
		},
		蘋果日報 : {
			url : 'https://tw.news.appledaily.com/headline/daily',
			parser : parser_蘋果日報_臺灣
		},
		聯合報 : {
			url : 'https://udn.com/news/cate/2/6638',
			parser : parser_聯合報
		},
		聯合電子報 : {
			url : 'http://paper.udn.com/papers.php?pname=PID0001',
			parser : parser_聯合電子報
		},
		// 聯合財經網 來自最具權威的財經新聞報「經濟日報」
		// TODO: https://money.udn.com/money/index
		經濟日報 : {
			url : 'http://paper.udn.com/papers.php?pname=PID0008',
			parser : parser_聯合電子報
		},
		// udn午後快報
		聯合晚報 : {
			url : 'http://paper.udn.com/papers.php?pname=PID0003',
			parser : parser_聯合電子報
		},

		// 中時電子報 焦點要聞 可以得到完整標題
		中國時報 : {
			// url : 'http://www.chinatimes.com/newspapers/',
			url : 'http://www.chinatimes.com/newspapers/260102',
			parser : parser_中國時報
		},
		// 財經要聞
		工商時報 : {
			url : 'http://www.chinatimes.com/newspapers/260202',
			parser : parser_中國時報
		},
		// 焦點新聞
		旺報 : {
			url : 'http://www.chinatimes.com/newspapers/260301',
			parser : parser_中國時報
		},

		國語日報 : {
			// url : 'http://www.mdnkids.com/',
			// parser : parser_國語日報_top

			// TODO: 國語日報 /news/ 可能遇到 ERR_TOO_MANY_REDIRECTS。
			url : 'http://www.mdnkids.com/news/',
			parser : parser_國語日報
		},
		人間福報 : {
			// 今日新聞/焦點/
			url : 'http://merit-times.net/category/%E4%BB%8A%E6%97%A5%E6%96%B0%E8%81%9E/%E7%84%A6%E9%BB%9E/',
			parser : parser_人間福報
		},
		青年日報 : {
			url : 'https://www.ydn.com.tw/News/List/2',
			parser : parser_青年日報
		},
	},

	香港 : {
		文匯報 : {
			url : 'http://pdf.wenweipo.com/index.html',
			charset : 'big5',
			parser : parser_文匯報
		},
		大公報 : {
			url : 'http://news.takungpao.com/paper/',
			parser : parser_大公報
		},
		星島日報 : {
			url : 'http://std.stheadline.com/daily/daily.php',
			parser : parser_星島日報
		},
		東方日報 : {
			url : 'http://orientaldaily.on.cc/cnt/news/'
					+ use_date.format('%Y%2m%2d') + '/js/articleList-news.js',
			display_url : 'http://orientaldaily.on.cc/cnt/main/'
					+ use_date.format('%Y%2m%2d') + '/index.html',
			parser : parser_東方日報
		},
		蘋果日報 : {
			url : 'https://hk.appledaily.com/catalog/index/',
			parser : parser_蘋果日報_香港
		},
		香港經濟日報 : {
			url : 'http://paper.hket.com/srap001/%E8%A6%81%E8%81%9E',
			parser : parser_香港經濟日報
		},
		成報 : {
			// http://www.singpao.com.hk/index.php?fi=newspdf
			url : 'http://www.singpao.com.hk/index.php?fi=history',
			post_data : {
				date : use_date.format('%Y-%2m-%2d')
			},
			parser : parser_成報
		},
		香港商報 : {
			url : 'http://www.hkcd.com.hk/node_30602.htm',
			parser : parser_香港商報
		},

	// 明報
	// https://news.mingpao.com/pns/%E8%A6%81%E8%81%9E/web_tc/section/20180512/s00001
	},

	// [[澳門報紙列表]]

	// [[中国大陆报纸列表]]
	中國大陸 : {
		人民日报 : {
			// http://paper.people.com.cn/rmrb/
			url : 'http://paper.people.com.cn/rmrb/html/'
					+ use_date.format('%Y-%2m/%2d/')
					+ 'nbs.D110000renmrb_01.htm',
			parser : parser_人民日报
		},
		广州日报 : {
			url : 'http://gzdaily.dayoo.com/pc/html/'
					+ use_date.format('%Y-%2m/%2d/') + 'node_1.htm',
			parser : parser_广州日报
		},
		南方日报 : {
			url : 'http://epaper.southcn.com/nfdaily/html/'
					+ use_date.format('%Y-%2m/%2d/') + 'node_2.htm',
			parser : parser_南方日报
		},
		// http://www.ckxxbao.com/
		参考消息 : {
			url : 'http://www.cankaoxiaoxi.com/china/szyw/',
			parser : parser_参考消息
		},
		环球时报 : {
			url : 'http://www.fx361.com/bk/hqsb/'
					+ use_date.format('%Y-%2m-%2d') + '.html',
			parser : parser_环球时报
		},
	},

	// http://hi2100.com/LIFE/NEWS.htm
	國際 : {
		// 早上七八點的時候可能只有自由時報是今天的新聞，其他都是昨天的。
		自由時報 : {
			url : 'http://news.ltn.com.tw/list/newspaper/world/'
					+ use_date.format('%Y%2m%2d'),
			parser : parser_自由時報
		},
		朝日新聞中文網 : {
			url : 'http://www.asahichinese-f.com/',
			parser : parser_朝日新聞中文網
		},
		// 日经中文网, 日本經濟新聞中文版
		日經中文網 : {
			url : 'http://zh.cn.nikkei.com/',
			parser : parser_日经中文网
		},
		華爾街日報中文網 : {
			url : 'https://cn.wsj.com/zh-hant',
			parser : parser_華爾街日報中文網
		},
		紐約時報中文網 : {
			// https://cn.nytimes.com/tools/r.html?url=/zh-hant/&langkey=zh-hant
			url : 'https://cn.nytimes.com/zh-hant/',
			parser : parser_紐約時報中文網
		},
	},

	東南亞 : {
		菲律宾商报 : {
			url : 'http://www.shangbao.com.ph/',
			parser : parser_菲律宾商报
		},

		// [[馬來西亞報刊列表]]

		/**
		 * <code>
		// use https://projectshield.withgoogle.com/public/
		光华日报 : {
			url : 'http://www.kwongwah.com.my/',
			parser : parser_光华日报
		},
		</code>
		 */
		馬來西亞東方日報 : {
			url : 'http://www.orientaldaily.com.my/',
			parser : parser_馬來西亞東方日報
		},
		星洲网 : {
			url : 'http://www.sinchew.com.my/news/',
			parser : parser_星洲网
		},
		联合早报 : {
			url : 'https://www.zaobao.com.sg/znews/singapore',
			parser : parser_联合早报
		},
	},

}[locale];

function for_source(source_id) {
	var source_data = source_configurations[source_id];
	CeL.debug(source_id + ':	' + source_data.url, 1, for_source);
	working_queue[source_id] = source_data.url;

	CeL.get_URL(source_data.url, function(XMLHttp, error) {
		var html = XMLHttp.responseText,
		//
		headline_list;

		try {
			headline_list = source_data.parser.call(source_data, html);
		} catch (error) {
			if (!parse_error_label_list) {
				parse_error_label_list = CeL.null_Object();
			}
			CeL.debug('Parse [' + source_id + '] (' + source_data.url + '): '
					+ error, 0, 'next_label');
			parse_error_label_list[label + '_' + index] = error;
		}

		if (!headline_list || !headline_list.length) {
			var error = 'No headline got';
			CeL.warn(error + ': ' + source_id);
			error_label_list.push(source_id);
			check_queue(source_id);
			return;
		}

		if (!(source_data.url in label_cache_hash)) {
			CeL.debug('登記url，以避免重複加入url: ' + source_data.url, 1, 'for_source');
			var title = source_id + '頭條要聞', publisher = source_id;
			add_source_data.push('* {{Source|url='
					//
					+ (source_data.display_url ? source_data.display_url
							+ '|source_url=' : '')
					//
					+ source_data.url
					//
					+ '|title=' + title.replace(/[\s\|]+/g, ' ')
					// 不填作者:這些來源有些根本也沒附摘錄者，因此想填作者也不成
					// + '|author=' + publisher
					//
					+ '|pub=' + fix_publisher(publisher)
					// '%Y-%2m-%2d'
					+ '|date=' + use_date.format('%Y年%m月%d日')
					//
					+ (source_id === publisher ? '' : '|label=' + source_id)
					+ '}}');
			label_cache_hash[source_data.url] = add_source_data.length;
		}

		headline_list.forEach(function(headline_data) {
			if (!headline_data.source_id)
				headline_data.source_id = source_id;
			add_headline(source_id, headline_data, source_id);
		});
		// console.log(headline_list);
		check_queue(source_id);
	}, source_data.charset, source_data.post_data, {
		timeout : 30 * 1000,
		headers : Object.assign({
			'User-Agent' : user_agent
		})
	});
}

function check_source() {
	Object.keys(source_configurations).forEach(for_source);
}

function check_queue(finished_work) {
	if (finished_work) {
		delete working_queue[finished_work];
	}

	// 剩下 remain
	if (Object.keys(working_queue).length > 0) {
		// waiting...
		return;
	}

	write_data();
}

// ----------------------------------------------------------------------------

function get_label(html) {
	if (html) {
		return CeL.HTML_to_Unicode(
				html.replace(/<!--[\s\S]*?-->/g, '').replace(
						/\s*<br(?:\/| [^<>]*)?>/ig, '\n').replace(/<[^<>]+>/g,
						'')
				// incase 以"\r"為主。
				.replace(/\r\n?/g, '\n')).trim()
		// .replace(/\s{2,}/g, ' ').replace(/\s?\n+/g, '\n')
		;
	}
}

function is_today(date) {
	var today = new Date(use_date.getTime());
	today.setHours(0, 0, 0, 0);
	var timevalue_diff = (CeL.is_Date(date) ? date : date.date) - today;
	return 0 <= timevalue_diff && timevalue_diff < ONE_DAY_LENGTH_VALUE;
}

function is_yesterday(date) {
	var today = new Date(use_date.getTime());
	today.setHours(3, 0, 0, 0);
	var timevalue_diff = today - (CeL.is_Date(date) ? date : date.date);
	return 0 <= timevalue_diff && timevalue_diff < ONE_DAY_LENGTH_VALUE;
}

// ----------------------------------------------------------------------------

function parser_自由時報(html, type) {
	var list = html.between('<ul class="list">', '</ul>'), headline_list = [],
	//
	PATTERN_headline = /<a href="([^"<>]+)" data-desc="P:\d+:([^"<>]+)"([\s\S]+?)<\/li>/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : 'http://news.ltn.com.tw/' + matched[1],
			headline : matched[2],
			type : matched[3].between(' class="newspapertag">', '<')
		};
		if (!type || headline.type === type)
			headline_list.push(headline);
	}
	return headline_list;
}

function parser_自由時報_頭版新聞(html) {
	return parser_自由時報(html, '頭版新聞');
}

function parser_蘋果日報_臺灣(html) {
	var list = html.between('<header class="schh">', '<header class="schh">'), headline_list = [],
	//
	PATTERN_headline = /<h1><a href="([^"<>]+)">([\s\S]+?)<\/a>/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : matched[1],
			headline : get_label(matched[2])
		};
		headline_list.push(headline);
	}
	return headline_list;
}

function parser_聯合報(html) {
	var list = html.between('<div class="area category_box_list">',
			'<div class="area category_box_list">'), headline_list = [],
	//
	PATTERN_headline = /<a href="([^"<>]+)"[^<>]*><h2>([\s\S]+?)<\/h2><\/a><div class="info"><div class="dt">([\s\S]+?)<\/div>/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : 'https://udn.com' + matched[1].replace(/\?from=[^&]*$/g, ''),
			headline : get_label(matched[2]),
			date : new Date(matched[3])
		};

		if (is_yesterday(headline)) {
			headline_list.push(headline);
			if (headline_list.length >= 2)
				break;
		}
	}
	return headline_list;
}

function parser_聯合電子報(html) {
	var list = html.between('<div class="history_list">', '<script'), headline_list = [],
	//
	PATTERN_headline = /<a class='iframe' href="([^"<>]+)">([\s\S]+?)<\/a>[\s\S]+? class="date">([\d\-]+)<\/li>/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : matched[1],
			headline : get_label(matched[2]),
			date : new Date(matched[3])
		};

		if (is_today(headline)) {
			headline_list.push(headline);
			if (headline_list.length >= 9)
				break;
		}
	}
	return headline_list;
}

function parser_中國時報(html) {
	// 取得完整頭條標題。
	var title_list = html.between('<meta name="description"', '>').between(
			' content="', '"');
	title_list = title_list.between('】') || title_list;
	title_list = title_list.split(';');
	// console.log(title_list);

	var list = html.between('<div class="listRight">',
			'<div class="pagination clear-fix">'), headline_list = [],
	//
	PATTERN_headline = /<h2>[\s\n]*<a href="([^"<>]+)"[^<>]*>([\s\S]+?)<\/a><\/h2>[\s\n]*<div class="kindOf">([\s\S]+?)<\/div>/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : 'http://www.chinatimes.com' + matched[1],
			headline : get_label(matched[2]),
			type : get_label(matched[3])
		};

		matched = matched[1].match(/\/(20\d{2})([01]\d)([0-3]\d)/);
		if (matched) {
			matched = matched[1] + '-' + matched[2] + '-' + matched[3];
			headline.date = new Date(matched);
			if (!is_today(headline))
				continue;
		}

		// 當頭條標題被截斷的時候，以完整的標題取代之。
		if (headline.headline.endsWith('...')) {
			matched = headline.headline.slice(0, -'...'.length);
			title_list.some(function(title) {
				if (title.startsWith(matched)) {
					headline.headline = title;
					return true;
				}
			});
		}

		headline_list.push(headline);
		if (headline_list.length >= 4)
			break;
	}
	return headline_list;
}

function parser_國語日報_top(html) {
	var list = html.between('<div class="topnewstitle">', '</table>'), headline_list = [],
	//
	PATTERN_headline = /<a href="([^"<>]+)" class="topnewstitle"[^<>]*>([\s\S]+?)<\/a>/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : matched[1],
			headline : get_label(matched[2])
		};
		headline_list.push(headline);
	}
	return headline_list;
}

function parser_國語日報(html) {
	var list = html.between('<td colspan="2" class="h25">',
			'<td colspan="2" class="h25">'), headline_list = [],
	//
	PATTERN_headline = /<a href="([^"<>]+)" class="newsbox_menu_txt">([\s\S]+?)<\/a>/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : this.url + matched[1],
			headline : get_label(matched[2])
		};
		headline_list.push(headline);
		if (headline_list.length >= 5)
			break;
	}
	return headline_list;
}

function parser_人間福報(html) {
	var list = html.between('<div class="td-container">') || html, headline_list = [],
	//
	PATTERN_headline = /<h3 class="entry-title td-module-title"><a href="([^"<>]+)"[^<>]*? title="([^"<>]+)">([\s\S]+?)<\/a>[\s\S]+? datetime="([^"<>]+)"/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : matched[1],
			headline : matched[2],
			date : new Date(matched[4])
		};

		if (headline.headline !== '新聞千里眼' && headline.headline !== '一周大事'
				&& !headline.headline.startsWith('社論') && is_today(headline)) {
			headline_list.push(headline);
			if (headline_list.length >= 9)
				break;
		}
	}
	return headline_list;
}

function parser_青年日報(html) {
	var list = html.between('<div class="news-list-hero">') || html, headline_list = [],
	//
	PATTERN_headline = /<a href="([^"<>]+)" class="post-preview" title="([^"<>]+)">\s*(?:<img src="\/ArticleFile\/(\d{8})\/)?([\s\S]+?)<\/li>/g, matched;
	list = list.between(null, '<ul class="news-list">') || list;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : 'https://www.ydn.com.tw' + matched[1],
			headline : matched[2]
		};

		if (matched[3]) {
			matched[3] = matched[3].replace(/(20\d{2})([01]\d)([0-3]\d)/,
					'$1-$2-$3');
			headline.date = new Date(matched[3]);
			if (!is_today(headline))
				continue;
		}

		if (matched[4] = matched[4].match(/<time[^"<>]*>([^"<>]+)<\/time>/)) {
			headline.date = new Date(matched[4][1]);
			if (!is_today(headline))
				continue;
		}

		headline_list.push(headline);
	}
	return headline_list;
}

// ------------------------------------

function parser_文匯報(html) {
	var list = html.between('<h3>A01版面新聞</h3>', '</div>'), headline_list = [],
	//
	PATTERN_headline = /<a href="([^"<>]+)" target="_blank">([\s\S]+?)<\/a>/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : matched[1],
			headline : get_label(matched[2])
		};
		matched = headline.url.match(/\/(20\d{2}\/\d{2}\/\d{2})\//);
		if (matched) {
			headline.date = new Date(matched[1]);
			if (!is_today(headline))
				continue;
		}
		headline_list.push(headline);
	}
	return headline_list;
}

function parser_大公報(html) {
	var list = html.between('<ul class="txtlist">', '<ul class="txtlist">'), headline_list = [],
	//
	PATTERN_headline = /<a href="([^"<>]+)" target="_black">([\s\S]+?)<\/a>/g, matched;
	if (!list.includes('<a href="')) {
		// 20180517: A1為全版廣告
		list = html.between('<ul class="txtlist">')
		// 選擇A2第二版
		.between('<ul class="txtlist">', '<ul class="txtlist">');
	}
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : matched[1],
			headline : get_label(matched[2])
		};
		matched = headline.url.match(/\/(20\d{2})\/(\d{2})(\d{2})\//);
		if (matched) {
			matched = matched[1] + '-' + matched[2] + '-' + matched[3];
			headline.date = new Date(matched);
			if (!is_today(headline))
				continue;
		}
		headline_list.push(headline);
	}
	return headline_list;
}

function parser_星島日報(html) {
	var list = html.between('<div class="top-news">', '</div>'), headline_list = [],
	//
	PATTERN_headline = /<a href="([^"<>]+)" title="([^"<>]+)">/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : 'http://std.stheadline.com/daily/' + matched[1],
			headline : get_label(matched[2])
		};
		headline_list.push(headline);
	}
	return headline_list;
}

function parser_東方日報(html) {
	var list = eval(html.between('=')), headline_list = [];
	// console.log(list);
	list.forEach(function(news) {
		if (!news.is_main_article) {
			return;
		}
		var headline = {
			url : 'http://orientaldaily.on.cc/cnt/news/' + news.pubdate + '/'
					+ news.sect_L3 + '_' + news.priority + '.html',
			headline : news.title,
			date : new Date(news.pubdate.replace(/^(\d{4})(\d{2})(\d{2})$/,
					'$1-$2-$3'))
		};
		if (is_today(headline))
			headline_list.push(headline);
	});
	return headline_list;
}

function parser_蘋果日報_香港(html) {
	var list = html.between('<div class="title">頭條</div>', '</ul>'), headline_list = [],
	//
	PATTERN_headline = /<a href="([^"<>]+)">([\s\S]+?)<\/a>/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : matched[1],
			headline : get_label(matched[2])
		};
		matched = headline.url.match(/article\/(20\d{2})(\d{2})(\d{2})\//);
		if (matched) {
			matched = matched[1] + '-' + matched[2] + '-' + matched[3];
			headline.date = new Date(matched);
			if (!is_today(headline))
				continue;
		}
		headline_list.push(headline);
	}
	return headline_list;
}

function parser_香港經濟日報(html) {
	var list = html.between('>要聞</div>', '<script '), headline_list = [],
	//
	PATTERN_headline = /<a href="([^"<>]+)"[\s\S]*? title="([^"<>]+)">([\s\S]+?)<\/a>/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : encodeURI(matched[1]),
			headline : get_label(matched[2])
		};
		headline_list.push(headline);
		if (headline_list.length >= 4)
			break;
	}
	return headline_list;
}

function parser_成報(html) {
	var list = html.between("<font class='history_title'>要聞港聞</font>",
			"<font class='history_title'>"), headline_list = [],
	//
	PATTERN_headline = /<a href='([^'<>]+)' class='title_bk16'>(?:<img [^<>]+>)?([\s\S]+?)(?:\((\d{4}-\d{2}-\d{2})\))?<\/a>/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : 'http://www.singpao.com.hk/' + matched[1],
			headline : get_label(matched[2])
		};

		if (matched[3]) {
			headline.date = new Date(matched[3]);
			if (!is_today(headline))
				continue;
		}

		headline_list.push(headline);
		if (headline_list.length >= 4)
			break;
	}
	return headline_list;
}

function parser_香港商報(html) {
	var list = html.between('<td class="wenzi">', ' class="wenzi"></td>'), headline_list = [],
	//
	PATTERN_headline = /<a href="([^"<>]+)"[^<>]*>([\s\S]+?)<\/a>\s*(?:\((\d{2}-\d{2} \d{2}:\d{2})\))?/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : 'http://www.hkcd.com.hk/' + matched[1],
			headline : get_label(matched[2])
		};

		if (matched[3]) {
			headline.date = new Date(use_date.format('%Y-') + matched[3]);
			if (!is_today(headline))
				continue;
		}

		headline_list.push(headline);
		if (headline_list.length >= 9)
			break;
	}
	return headline_list;
}

// ------------------------------------

function parser_人民日报(html) {
	var list = html, headline_list = [],
	//
	PATTERN_headline = /<a href=([^"'<>]+)><script>document\.write\(view\("([^"]+)"\)\)<\/script><\/a>/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : 'http://paper.people.com.cn/rmrb/html/'
					+ use_date.format('%Y-%2m/%2d/') + matched[1],
			headline : get_label(matched[2])
		};

		headline_list.push(headline);
		if (headline_list.length >= 4)
			break;
	}
	return headline_list;
}

function parser_广州日报(html) {
	var list = html.between('<div id="btdh"', '</table>'), headline_list = [],
	//
	PATTERN_headline = /<a href="([^"'<>]+)">([\s\S]+?)<\/a>/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : 'http://gzdaily.dayoo.com/pc/html/'
					+ use_date.format('%Y-%2m/%2d/') + matched[1],
			headline : get_label(matched[2])
		};

		if (headline.headline.length > 4) {
			headline_list.push(headline);
			if (headline_list.length >= 4)
				break;
		}
	}
	return headline_list;
}

function parser_南方日报(html) {
	var list = html.between('<li id="bt_nav"><span>标题导航</span>').between(
			'>第A01版：要闻</a>', '<a id=pageLink '), headline_list = [],
	//
	PATTERN_headline = /<a target="_blank" href=([^"'<>]+)>([\s\S]+?)<\/a>/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : 'http://epaper.southcn.com/nfdaily/html/'
					+ use_date.format('%Y-%2m/%2d/') + matched[1],
			headline : get_label(matched[2])
		};

		headline_list.push(headline);
		if (headline_list.length >= 9)
			break;
	}
	return headline_list;
}

function parser_参考消息(html) {
	var list = html.between('<div class="inner">', '</div>'), headline_list = [],
	//
	PATTERN_headline = /<span[\s\S]*?>(\d{4}-\d{1,2}-\d{1,2} \d{1,2}:\d{1,2})<\/span><a href="([^"'<>]+)"[^<>]*?>([\s\S]+?)<\/a>/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : matched[2],
			headline : get_label(matched[3]),
			date : new Date(matched[1]),
		};

		if (is_today(headline)) {
			headline_list.push(headline);
			if (headline_list.length >= 4)
				break;
		}
	}
	return headline_list;
}

function parser_环球时报(html) {
	var list = html.between('<h5>01版：要闻</h5>', '</ul>'), headline_list = [],
	//
	PATTERN_headline = /<a href="([^"<>]+)" title="([^"<>]+)">/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : 'http://www.fx361.com' + matched[1],
			headline : get_label(matched[2])
		};

		headline_list.push(headline);
		if (headline_list.length >= 9)
			break;
	}
	return headline_list;
}

// ------------------------------------

function parser_朝日新聞中文網(html) {
	var list = html.between(' class="Section ZhTopNews"', ' class="Section"'), headline_list = [],
	//
	PATTERN_headline = /<a href="([^"<>]+)">[\s\S]*?<span class="TopHeadline">([\s\S]+?)<\/span>[\s\S]*?<span class="Date">([^<>]+)<\/span>/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : this.url + matched[1],
			headline : get_label(matched[2]),
			date : new Date(matched[3])
		};

		if (is_today(headline)) {
			headline_list.push(headline);
			if (headline_list.length >= 9)
				break;
		}
	}
	return headline_list;
}

function parser_日经中文网(html) {
	var list = html.between('<dl class="newsContent01">', '</ul>'), headline_list = [],
	//
	PATTERN_headline = /<a href="([^"<>]+)"[^<>]*?>([\s\S]+?)<\/a>/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : matched[1],
			headline : get_label(matched[2])
		};
		if (headline.url.includes('/tag/')) {
			continue;
		}
		matched = headline.url.match(/-(20\d{2})-([01]\d)-([0-3]\d)-/);
		if (matched
		// 由網址判斷新聞日期。
		|| (matched = headline.url.match(/-(20\d{2})([01]\d)([0-3]\d)\.html$/))) {
			headline.date = new Date(matched[1] + '-' + matched[2] + '-'
					+ matched[3]);
			if (!is_today(headline))
				continue;
		}

		headline_list.push(headline);
		if (headline_list.length >= 9)
			break;
	}
	return headline_list;
}

function parser_華爾街日報中文網(html) {
	var list = html.between('<span>今日要聞</span>', '<div class="WSJChinaTheme__'), headline_list = [],
	//
	PATTERN_headline = /<h3[^<>]*?><a [^<>]*?href="([^"<>]+)"[^<>]*?>([\s\S]+?)<\/a>/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : matched[1],
			headline : get_label(matched[2])
		};
		matched = headline.url
		// 由網址判斷新聞日期。
		.match(/-(20\d{2})([01]\d)([0-3]\d)([0-2]\d)([0-5]\d)([0-5]\d)/);
		if (matched) {
			headline.date = new Date(matched[1] + '-' + matched[2] + '-'
					+ matched[3] + 'T' + matched[4] + ':' + matched[5] + ':'
					+ matched[6]);
			if (!is_today(headline))
				continue;
		}

		headline_list.push(headline);
		if (headline_list.length >= 9)
			break;
	}
	return headline_list;
}

function parser_紐約時報中文網(html) {
	var list = html.between('<div class="leadNewsContainer"',
			'<div class="headlineOnly'), headline_list = [],
	//
	PATTERN_headline = /Headline"><a [^<>]*?href="([^"<>]+)" title="([^"<>]+)"[^<>]*?>([\s\S]+?)<\/a>/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : 'https://cn.nytimes.com/' + matched[1],
			headline : get_label(matched[3])
		}, date = matched[1].match(/\/(20\d{2})([01]\d)([0-3]\d)\//);
		if (date) {
			headline.date = new Date(date[1] + '-' + date[2] + '-' + date[3]);
			if (!is_today(headline))
				continue;
		}
		if (matched[2] !== headline.headline)
			headline.headline += ' ' + matched[2];

		headline_list.push(headline);
		if (headline_list.length >= 9)
			break;
	}
	return headline_list;
}

// ------------------------------------

function parser_菲律宾商报(html) {
	var list = html.between('<ul class="border-top padding-top10">', '</ul>'), headline_list = [],
	//
	PATTERN_headline = /<a href="([^"<>]+)">([\s\S]+?)<\/li>/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : this.url + matched[1],
			headline : get_label(matched[2])
		};

		headline_list.push(headline);
		if (headline_list.length >= 9)
			break;
	}
	return headline_list;
}

function parser_光华日报(html) {
	var list = html.between('<span>重点新闻</span>', '<span>今日头条'), headline_list = [],
	//
	PATTERN_headline = /<h6 class="entry-title"><a href="([^"<>]+)">([\s\S]+?)<\/a>[\s\S]+?<span class="entry-date[^<>]+>([\s\S]+?)<\/span>/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : matched[1],
			headline : get_label(matched[2]),
			date : new Date(get_label(matched[3]))
		};

		if (is_today(headline)) {
			headline_list.push(headline);
			if (headline_list.length >= 9)
				break;
		}
	}
	return headline_list;
}

function parser_馬來西亞東方日報(html) {
	var list = html.between('<section class="alternate">', '</section>'), headline_list = [],
	//
	PATTERN_headline = /<img [^<>]*?data-original="([^"<>]*)"[^<>]*>[\s\S]*?<a href="([^"<>]+)" title="([^<>"]+)">/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : matched[2],
			headline : get_label(matched[3])
		};

		// 由網址判斷新聞日期。
		matched = matched[1].match(/\/(20\d{2})([01]\d)([0-3]\d)\//);
		if (matched) {
			matched = matched[1] + '-' + matched[2] + '-' + matched[3];
			headline.date = new Date(matched);
			if (!is_today(headline))
				continue;
		}

		headline_list.push(headline);
		if (headline_list.length >= 9)
			break;
	}
	return headline_list;
}

function parser_星洲网(html) {
	var list = html.between(
	//
	'<div class="views-row views-row-1 views-row-odd views-row-first">', '<h1'), headline_list = [],
	//
	PATTERN_headline = /<a href="([^"<>]+)">([\s\S]+?)<\/a>/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : 'http://www.sinchew.com.my' + matched[1],
			headline : get_label(matched[2])
		};

		headline_list.push(headline);
		if (headline_list.length >= 9)
			break;
	}
	return headline_list;
}

function parser_联合早报(html) {
	var list = html.between('<div class="post-list view-content">',
			'<div class="content">'), headline_list = [],
	//
	PATTERN_headline = /<a href="([^"<>]+)"[^<>]*><div class="post-detail">([\s\S]+?)<\/a>[\s\S]+?<span class="datestamp">(\d{2})\/(\d{2})\/(\d{4})<\/span>/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : 'https://www.zaobao.com.sg' + matched[1],
			headline : get_label(matched[2]),
			date : new Date(matched[5] + '-' + matched[4] + '-' + matched[3])
		};

		if (is_today(headline)) {
			headline_list.push(headline);
			if (headline_list.length >= 9)
				break;
		}
	}
	return headline_list;
}

// ----------------------------------------------------------------------------

// CeL.set_debug(2);

// working_queue.parse_headline_page = true;
wiki.page(save_to_page, function parse_headline_page(page_data) {
	save_to_page = page_data;
	CeL.info('採用頁面標題: [[' + page_data.title + ']]');

	if (!page_data || ('missing' in page_data)) {
		CeL.info('parse_headline_page: [[' + page_data.title
				+ ']]: 此頁面不存在/已刪除。');
		// check_queue('parse_headline_page');
		check_source();
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
		// console.log(token);

		switch (token.name) {
		case 'Date':
			page_data.has_date = token.parameters[1];
			break;

		case 'Headline item/header':
			page_data.has_header = true;
			break;

		case 'Headline item':
		case 'HI':
			add_to_headline_hash(token.parameters[1].toString(),
			//
			token.parameters.url ? {
				url : token.parameters.url,
				headline : token.parameters[2].toString()
			} : token.parameters[2], token.parameters.source);
			break;

		case 'Source':
			if (token.parameters.url) {
				var label = token.parameters.label || token.parameters.pub,
				//
				source_url = token.parameters.source_url
						|| token.parameters.url;

				if (label_cache_hash[source_url] >= 0) {
					add_source_data[
					//
					label_cache_hash[source_url]] = '';
				}
				CeL.debug('登記url，以避免重複加入url: ' + source_url, 1,
						'parse_headline_page');
				label_cache_hash[source_url] = label;
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
			// {{Develop}}
			// @see [[維基新聞:文章標記]], [[Wikinews:Article stage tags]]
			// [[Category:新闻标记模板]]
			CeL.debug('stage node: ' + page_data.stage_node, 1);
			page_data.stage_node = token;
			break;
		}

	}

	parser.each('template', for_each_template);
	if (page_data.done) {
		CeL.log('已發布: [[' + page_data.title + ']]');
		return;
	}
	// console.log(labels_to_check);
	delete working_queue.parse_headline_page;
	// check_queue('parse_headline_page');
	check_source();
});
