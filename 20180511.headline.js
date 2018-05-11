// cd /d D:\USB\cgi-bin\program\wiki && node 20180511.headline.js

/*

 2018/5/10 19:38:21	import headlines of news papers
 2018/5/11 19:40:55	初版試營運

 立即停止作業: see [[n:User:Cewbot/Stop]]

 TODO:
 自動創建不存在的類別

 */

// ----------------------------------------------------------------------------
'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

var working_queue = CeL.null_Object(),
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

var save_to_page = use_date.format('%Y年%m月%d日') + locale + '報紙頭條',
// 前一天, the day before
day_before = new Date(use_date.getTime() - ONE_DAY_LENGTH_VALUE),
// 後一天, 隔天 the day after
day_after = new Date(use_date.getTime() + ONE_DAY_LENGTH_VALUE),

to_remind = owner_name;

// ---------------------------------------------------------------------//

function finish_up() {
	CeL.debug('更新維基新聞首頁。', 0, 'finish_up');
	wiki.purge('Wikinews:首页');

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

	// TODO: create Category:2016年9月報紙頭條 2016年9月香港報紙頭條
	// [[Category:2016年報紙頭條]]
}

function write_data() {
	CeL.debug('寫入報紙頭條新聞標題資料。', 0, 'write_data');

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

			CeL.debug('add {{Date}}.', 0, 'write_data');
			content = '{{Date|' + use_date.format('%Y年%m月%d日')
			//
			+ '}}\n\n' + content.trim();
		}

		if (!page_data.has_header) {
			CeL.debug('add header.', 0, 'write_data');
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
			CeL.debug('沒有新 headline 資料。Skip.', 0, 'write_data');
			return [ CeL.wiki.edit.cancel, 'skip' ];
		}

		if (headline_wikitext_list.length > 0) {
			CeL.debug('add '
			//
			+ headline_wikitext_list.length + ' headlines.', 0, 'write_data');
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
			CeL.debug('add {{Source}}.', 0, 'write_data');
			add_source_data = add_source_data.sort()
			//
			.unique_sorted().join('\n') + '\n';
			content = content.replace(
			//
			/(?:\n|^)==\s*消息來源\s*==\n/, function(section) {
				CeL.debug('add {{Source}} after section.', 0, 'write_data');
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
					section = section.trimEnd()
					//
					+ '\n\n== 消息來源 ==\n' + add_source_data;
					add_source_data = null;
					return section;
				});
			}

			if (add_source_data) {
				CeL.debug('add {{Source}} at last.', 0, 'write_data');
				// 不具此 section。
				content = content.trim()
				// * 各報報章及其網頁\n
				+ '\n\n== 消息來源 ==\n' + add_source_data;
			}
		}

		if (!page_data.has_navbox) {
			CeL.debug('add 頭條導覽 {{Headline navbox}}.', 0, 'write_data');
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

		CeL.debug('stage node: ' + page_data.stage_node
		//
		+ ', all_headlines ' + all_headlines
		//
		+ ', headline_wikitext_list['
		//
		+ headline_wikitext_list.length + ']:', 0, 'write_data');
		console.log(headline_wikitext_list);
		if (page_data.stage_node) {
			if (page_data.stage_node.name === 'Review'
			// 已經有頭條新聞資料時，直接標示{{Publish}}。
			&& all_headlines > 2) {
				CeL.debug('已經有頭條新聞資料，直接改' + page_data.stage_node
				//
				+ '標示為{{Publish}}。', 0, 'write_data');
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
			+ (parse_error_label_list ? '有' : '無') + ' parse 錯誤。'
			//
			, 0, 'write_data');
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
		+ page_data.title + ']]。', 0, 'write_data');
		// console.log(save_to_page);
		// console.log(content);
		return content;

	}, {
		bot : 1,
		tags : 'import headline',
		// 匯入每日報紙頭條新聞標題
		summary : '匯入' + locale + '報紙頭條新聞標題'
	})
	//
	.run(finish_up);

}

function add_to_headline_hash(publisher, headline_data, source, is_new) {
	if (Array.isArray(headline_data)) {
		var matched = headline_data.toString().match(
				/\[([^\[\]\s]+) ([^\[\]]+)\]/);
		if (matched) {
			headline_data = {
				url : matched[1],
				headline : matched[2]
			};
		} else if (matched = headline_data.toString().match(
				/([\s\S]+?)\s+<!--\s(http\S+?)\s-->/)) {
			headline_data = {
				url : matched[2],
				headline : matched[1]
			};
		}
	}

	var headline = typeof headline_data === 'object' && headline_data.headline
			|| headline_data.toString();

	if (typeof headline_data === 'object') {
		if (url_cache_hash[headline_data.url])
			return;
	}

	CeL.debug('登記此 headline: [' + publisher + ']: [' + headline + '].', 0,
			'add_to_headline_hash');

	all_headlines++;

	var wikitext = '{{HI|' + publisher + '|'
	//
	+ (headline_data.url ? headline_data.url.includes('=')
	//
	? headline + ' <!-- ' + headline_data.url + ' -->'
	//
	: '[' + headline_data.url.replace(/=/g, '%3D') + ' ' + headline
	//
	+ ']' : headline)
	//
	+ (source ? '|source=' + source : '') + '}}';

	if (Array.isArray(headline_hash[publisher])) {
		if (headline_hash[publisher].includes(headline)) {
			// pass 去掉重複的。
			CeL.debug('[' + publisher + '] 已有此 headline: [' + headline
					+ '], skip it.', 0, 'add_to_headline_hash');
			return;
		}

		CeL.debug('[' + publisher + '] 添加不同的 headline: ['
		//
		+ headline + '] ⇒ [' + headline_hash[publisher] + ']', 0,
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

function add_headline(publisher, headline_data, source) {
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

	if (typeof headline_data === 'string') {
		headline_data = headline_data.replace(/&nbsp;/g, ' ').replace(
				/\s{2,}/g, ' ').trim();
	}

	add_to_headline_hash(publisher, headline_data, source, true);
}

// ----------------------------------------------------------------------------

var
// 臺灣主要報刊 頭條 要聞
source_configurations = {
	自由時報 : {
		url : 'http://news.ltn.com.tw/list/newspaper/focus/'
				+ (new Date).format('%Y%2m%2d'),
		parser : parser_自由時報
	},
	蘋果日報 : {
		url : 'https://tw.news.appledaily.com/headline/daily',
		parser : parser_蘋果日報
	},
	聯合報 : {
		url : 'https://udn.com/news/cate/2/6638',
		parser : parser_聯合報
	},
	// 中時電子報
	中國時報 : {
		// url : 'http://www.chinatimes.com/newspapers/',
		url : 'http://www.chinatimes.com/newspapers/2601',
		parser : parser_中國時報
	},
	工商時報 : {
		url : 'http://www.chinatimes.com/newspapers/2602',
		parser : parser_中國時報
	},
	旺報 : {
		url : 'http://www.chinatimes.com/newspapers/2603',
		parser : parser_中國時報
	},
	國語日報 : {
		url : 'http://www.mdnkids.com/',
		parser : parser_國語日報
	},
	人間福報 : {
		// 今日新聞/焦點/
		url : 'http://merit-times.net/category/%E4%BB%8A%E6%97%A5%E6%96%B0%E8%81%9E/%E7%84%A6%E9%BB%9E/',
		parser : parser_人間福報
	},
};

Object.keys(source_configurations).forEach(function(source_id) {
	var source_data = source_configurations[source_id];
	working_queue[source_id] = source_data.url;
	CeL.log(source_id + ':	' + source_data.url);

	CeL.get_URL(source_data.url, function(XMLHttp, error) {
		var html = XMLHttp.responseText,
		//
		headline_list = source_data.parser.call(source_data, html);

		if (!label_cache_hash[source_data.url]) {
			label_cache_hash[source_data.url] = source_id;
			var title = source_id + '頭條要聞', publisher = source_id;
			add_source_data.push('* {{Source|url=' + source_data.url
			//
			+ '|title=' + title.replace(/[\s\|]+/g, ' ')
			// 不填作者:這些來源有些根本也沒附摘錄者，因此想填作者也不成
			// + '|author=' + publisher
			//
			+ '|pub=' + publisher
			// '%Y-%2m-%2d'
			+ '|date=' + use_date.format('%Y年%m月%d日')
			//
			+ (source_id === publisher ? '' : '|label=' + source_id) + '}}');
		}

		headline_list.forEach(function(headline_data) {
			if (!headline_data.source_id)
				headline_data.source_id = source_id;
			add_headline(source_id, headline_data, source_id);
		});
		// console.log(headline_list);
		check_queue(source_id);
	});
});

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
				html.replace(/\s*<br(?:\/| [^<>]*)?>/ig, '\n').replace(
						/<[^<>]+>/g, '')
				// incase 以"\r"為主。
				.replace(/\r\n?/g, '\n')).trim()
		// .replace(/\s{2,}/g, ' ').replace(/\s?\n+/g, '\n')
		;
	}
}

// ----------------------------------------------------------------------------

function parser_自由時報(html) {
	var list = html.between('<ul class="list">', '</ul>'), headline_list = [],
	//
	PATTERN_headline = /<a href="([^"<>]+)" data-desc="P:\d+:([^"<>]+)"([\s\S]+?)<\/li>/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : 'http://news.ltn.com.tw/' + matched[1],
			headline : matched[2],
			type : matched[3].between(' class="newspapertag">', '<')
		};
		if (headline.type === '頭版新聞')
			headline_list.push(headline);
	}
	return headline_list;
}

function parser_蘋果日報(html) {
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
		}, today = new Date();
		today.setHours(3, 0, 0);
		var diff = today - headline.date;
		if (0 < diff && diff < ONE_DAY_LENGTH_VALUE) {
			headline_list.push(headline);
			if (headline_list.length >= 2)
				break;
		}
	}
	return headline_list;
}

function parser_中國時報(html) {
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
		headline_list.push(headline);
		if (headline_list.length >= 3)
			break;
	}
	return headline_list;
}

function parser_國語日報(html) {
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

function parser_人間福報(html) {
	var list = html.between('<div class="td-container">') || html, headline_list = [],
	//
	PATTERN_headline = /<h3 class="entry-title td-module-title"><a href="([^"<>]+)"[^<>]*? title="([^"<>]+)">([\s\S]+?)<\/a>/g, matched;
	while (matched = PATTERN_headline.exec(list)) {
		var headline = {
			url : matched[1],
			headline : matched[2]
		};
		if (headline.headline !== '新聞千里眼')
			headline_list.push(headline);
		if (headline_list.length >= 3)
			break;
	}
	return headline_list;
}

// ----------------------------------------------------------------------------

// CeL.set_debug(2);

working_queue.parse_headline_page = true;
wiki.page(save_to_page, function parse_headline_page(page_data) {
	save_to_page = page_data;
	CeL.info('採用頁面標題: [[' + page_data.title + ']]');

	if (!page_data || ('missing' in page_data)) {
		CeL.info('parse_headline_page: [[' + page_data.title
				+ ']]: 此頁面不存在/已刪除。');
		check_queue('parse_headline_page');
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
			add_to_headline_hash(token.parameters[1].toString(),
					token.parameters[2].toString(), token.parameters.source);
			break;

		case 'Source':
			if (token.parameters.url) {
				var label = token.parameters.label || token.parameters.pub;
				// 登記url，以避免重複加入url。
				label_cache_hash[token.parameters.url] = label;
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
			CeL.debug('stage node: ' + page_data.stage_node, 0);
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
	check_queue('parse_headline_page');
});
