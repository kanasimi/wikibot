// (cd ~/wikibot && date && hostname && nohup time node 20170515.add_sign.js; date) >> modify_link/log &

/*

 2017/5/15 21:30:19	初版試營運。
 2017/8/18 23:50:52 完成。正式運用。

 工作原理:
 # wiki.listen(): 監視最近更改的頁面。
 # wiki.listen(): 取得頁面資料。
 # filter_row(): 從頁面資訊做初步的篩選: 以討論頁面為主。
 # for_each_row(): 解析頁面結構。比較頁面修訂差異。
 # check_diff_pair(): 對於頁面每個修改的部分，都向後搜尋/檢查到章節末。
 # check_sections(): 檢查這一次的修訂中，是不是只添加、修改了模板、章節標題或者沒有具體意義的文字。
 # check_sections(): 確保 to_diff_start_index, to_diff_end_index 這兩個分割點都在段落之間而非段落中間。
 # check_sections(): 檢查每一段的差異、提取出所有簽名，並且做出相應的處理。
 # for_each_row(): 將可能修改了他人文字的編輯寫進記錄頁面 [[User:cewbot/Signature check]]。
 # for_each_row(): 為沒有署名的編輯添加簽名標記。

 一般說來在討論頁留言的用途有:
 在條目的討論頁添加上維基專題、條目里程碑、維護、評級模板。
 當一次性大量加入連續的文字時，僅僅當做一次編輯。例如貼上文件備查。 [[Special:Diff/45239349]]
 用戶在自己的討論頁添加上宣告或者維護模板。
 其他一般討論，應該加上署名。

 @see
 https://commons.wikimedia.org/wiki/Commons:Bots/Requests/SignBot
 https://zh.wikipedia.org/wiki/User:Crystal-bot

 TODO: 跳過這一種把正文搬到討論區的情況. e.g., [[Special:Diff/45401508]], [[Special:Diff/45631002|Wikipedia talk:聚会/2017青島夏聚]]

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),
// 本工具將產生記錄頁面 [[User:cewbot/Signature check]]。
check_log_page = 'User:' + user_name + '/Signature check';

// ----------------------------------------------------------------------------

var
// 只處理此一頁面。
test_the_page_only = "",
// true: 測試模式，將不會寫入簽名或者提醒。
test_mode = false,
// 回溯這麼多時間。最多約可回溯30天。
time_back_to = test_mode ? '31d' : '1d',
// 用戶討論頁提示：如果進行了3次未簽名的編輯，通知使用者記得簽名。
notification_limit_count = 3,
// 除了在編輯維基專題、條目里程碑、維護、評級模板之外，每個段落至少要有一個簽名。
// 因為有些時候可能是把正文中的文字搬移到討論頁備存，因此預設並不開啟。 e.g., [[Special:Diff/45239349]]
sign_each_section = false,
//
whitelist = [ 'Wikipedia:知识问答' ],
//
blacklist = [],

// ----------------------------------------------------------------------------

// 另可以破折號代替橫線。
more_separator = '...\n' + '⸻'.repeat(20) + '\n...',
// 只有ASCII符號。
PATTERN_symbol_only = /^[\t\n -@\[-`{-~]*$/,
// 只標示日期的存檔頁面標題。
PATTERN_date_archive = /\/[12]\d{3}年(?:1?\d(?:[\-~～]1?\d)?月(?:[\-~～](?:[12]\d{3}年)?1?\d月)?)?(?:\/|$)/,
// 跳過封存/存檔頁面。
PATTERN_archive = /{{ *(?:(?:Talk ?)?archive|存檔|(?:讨论页)?存档|Aan|来自已转换的wiki文本讨论页的存档)/i,
// 篩選編輯摘要。排除還原的編輯。
// GlobalReplace: use tool
// https://commons.wikimedia.org/wiki/Commons:GlobalReplace
// "!nosign!": 已經參考、納入了一部分 [[commons:User:SignBot|]] 的做法。
PATTERN_revert_summary = /还原|還原|revert|回退|撤銷|撤销|取消.*(编辑|編輯)|更改回|維護|GlobalReplace|!nosign!/i,
// unsigned_user_hash[user][page title] = unsigned count
unsigned_user_hash = CeL.null_Object(),
// no_link_user_hash[user][page title] = unsigned count
no_link_user_hash = CeL.null_Object(),
//
KEY_COUNT = '#count',
// 非內容的元素。若是遇到這一些元素，就跳過、不算是正式內容。例如章節標題不能算成內文，我們也不會在章節標題之後馬上就簽名；因此處理的時候，去掉最末尾的章節標題。
noncontent_type = {
	category : true,
	section_title : true,
	// assert: 若是有正式具有意義的內容，那麼應該在模板之外也應該要有文字。
	transclusion : true
},
// options to LCS() diff
with_diff = {
	LCS : true,
	// line : true,
	line : false,
	index : 2,
	with_list : true
};

// CeL.set_debug(2);

function show_page(row) {
	CeL.log('* [[User:' + row.user + ']] 編輯了 [[Special:Diff/' + row.revid + '|'
			+ row.title + ']]');
}

function get_parsed_time(row) {
	if (!row.parsed_time) {
		// 補簽的時間戳能不能跟標準簽名格式一樣，讓時間轉換的小工具起效用。
		row.parsed_time = (new Date(row.timestamp))
				.format(CeL.wiki.parse.date.format);
	}

	return row.parsed_time;
}

// 從頁面資訊做初步的篩選
function filter_row(row) {
	if (CeL.is_debug(2)) {
		show_page(row);
	}

	// passed === true: 要繼續處理這個頁面。
	var passed =
	// 為了某些編輯不加 bot flag 的 bot。
	!/bot/i.test(row.user) && row.user !== user_name
	// 篩選頁面標題。跳過封存/存檔頁面。
	&& !/\/(?:archive|檔案|档案|沙盒)/i.test(row.title)
	// /舊?存檔|旧?存档/ e.g., [[Talk:台北車站/2005—2010年存檔]]
	&& !/存檔|存档/i.test(row.title)
	// 只標示日期的存檔
	&& !PATTERN_date_archive.test(row.title)
	// e.g., [[Wikipedia_talk:聚会/2017青島夏聚]]
	// || /^Wikipedia[ _]talk:聚会\// i.test(row.title)

	// 必須是白名單頁面，
	&& (whitelist.includes(row.title) || row.title.startsWith('Wikipedia:')
	// ...或者討論頁面。
	|| CeL.wiki.is_talk_namespace(row.ns)
	// for test
	|| test_the_page_only && row.title === test_the_page_only)

	// 篩選編輯摘要。
	&& !PATTERN_revert_summary.test(row.comment);

	if (!passed) {
		CeL.debug('從頁面資訊做初步的篩選: 直接跳過這個編輯', 2, 'filter_row');
	}

	return passed;
}

function add_count(row, hash, get_count) {
	var pages_to_notify = hash[row.user];
	if (get_count) {
		return pages_to_notify ? pages_to_notify[KEY_COUNT] : 0;
	}

	if (!pages_to_notify) {
		// initialization
		pages_to_notify = hash[row.user] = CeL.null_Object();
		pages_to_notify[KEY_COUNT] = 0;
	}
	pages_to_notify[row.title] = (pages_to_notify[row.title] | 0) + 1;
	return ++pages_to_notify[KEY_COUNT];
}

if (test_the_page_only) {
	CeL.info('處理單一頁面 ' + CeL.wiki.title_link_of(test_the_page_only)
			+ ': 先取得頁面資料。');
	wiki.page(test_the_page_only, function(page_data) {
		var revision = CeL.wiki.content_of.revision(page_data);
		// 解析頁面結構。
		CeL.wiki.parser(page_data).parse();
		// 模擬 wiki.listen() 這個函數的工作。
		// @see add_listener() in CeL.application.net.wiki
		Object.assign(page_data, {
			user : revision.user,
			timestamp : revision.timestamp,
			revid : revision.revid,
			// The edit comment / summary.
			comment : revision.comment,
			from_parsed : CeL.wiki.parser(
					page_data.revisions.length > 1 ? CeL.wiki.content_of(
							page_data, -1) : '').parse()
		});

		page_data.diff = CeL.LCS(page_data.from_parsed.map(function(token) {
			return token.toString();
		}), page_data.parsed.map(function(token) {
			return token.toString();
		}), Object.assign({
			diff : true
		}, with_diff));

		// 處理單一頁面的時候開啟偵錯模式。
		CeL.set_debug(2);
		if (CeL.is_debug(2))
			console.log(page_data);
		for_each_row(page_data);
	}, {
		rvprop : 'ids|timestamp|content|user|comment',
		rvlimit : 2
	});

} else {
	wiki.listen(for_each_row, {
		start : time_back_to,
		// 檢測到未簽名的編輯後，機器人會等待60秒，以使用戶可以自行補簽。
		delay : '60 s',
		filter : filter_row,
		with_diff : with_diff,
		parameters : {
			// 跳過機器人所做的編輯。
			// You need the "patrol" or "patrolmarks" right
			// to request the patrolled flag.
			rcshow : '!bot',
			rcprop : 'title|ids|sizes|flags|user'
		},
		interval : test_mode || time_back_to ? 500 : 60 * 1000
	});
}

// ---------------------------------------------------------

function for_each_row(row) {
	delete row.row;
	// CeL.set_debug(2);
	if (false) {
		console.log(row);
		return;
		console.log(row.diff);
	}

	var
	/** {String}page content, maybe undefined. */
	content = CeL.wiki.content_of(row, 0);

	CeL.debug('做初步的篩選: 以討論頁面為主。', 5);
	if (!row.diff
	// 跳過封存/存檔頁面。 e.g., [[Wikipedia talk:首页/header/preload]]
	|| /\/(?:archive|存檔|存档|檔案|档案|header|preload)/i.test(row.title)
	// e.g., [[Wikipedia_talk:聚会/2017青島夏聚]]
	// || /^Wikipedia[ _]talk:聚会\// i.test(row.title)

	// 黑名單直接封殺
	|| blacklist.includes(row.title)
	// 白名單頁面可以省去其他的檢查
	|| !whitelist.includes(row.title)
	//
	&& row.title.startsWith('Wikipedia:')
	// e.g., [[Wikipedia:頁面存廢討論/記錄/2017/08/12]], [[Wikipedia:机器人/申请/...]]
	// NG: [[Wikipedia:頁面存廢討論]], [[Wikipedia:模板消息/用戶討論名字空間]]
	&& !/(?:討論|讨论|申請|申请)\//.test(row.title)
	//
	&& !row.title.startsWith('Wikipedia:互助客栈/')
	//
	&& !row.title.startsWith('Wikipedia:新条目推荐/候选')

	// 篩選頁面內容。
	|| !content
	// 跳過封存/存檔頁面。
	|| PATTERN_archive.test(content)
	// 跳過重定向頁。
	|| CeL.wiki.parse.redirect(content)
	// [[WP:SIGN]] 可以用 "{{Bots|optout=SIGN}}" 來避免這個任務添加簽名標記。
	|| CeL.wiki.edit.denied(row, user_name, 'SIGN')
	// 可以用 "{{NoAutosign}}" 來避免這個任務添加簽名標記。
	|| content.includes('{{NoAutosign}}')) {
		return;
	}
	if (CeL.is_debug(4)) {
		row.revisions.forEach(function(revision) {
			delete revision['*'];
		});
		delete row.diff;
		console.log(row);
	}

	if (CeL.is_debug(2)) {
		CeL.info('='.repeat(75));
		show_page(row);
		console.log(row);
	}

	// 比較頁面修訂差異。
	// row.parsed, row.diff.to 的每一元素都是完整的 token；並且兩者的 index 相對應。
	// @see add_listener() in CeL.application.net.wiki
	// row.diff.to[index] === row.parsed[index].toString();
	// TODO: 正常情況下 token 都是完整的；但是也要應對一些編輯錯誤或者故意編輯錯誤。
	var to = row.diff.to, to_length = to.length, all_lines = [],
	/** {Integer}第二個段落在row.parsed中的 index。 */
	second_section_index = row.parsed.length;

	row.parsed.some(function(token, index) {
		if (token.type === 'section_title') {
			second_section_index = index;
			return true;
		}
	});
	if (CeL.is_debug(2)) {
		CeL.info('second_section_index: ' + second_section_index + '/'
				+ row.diff.to.length + ', row.diff.length: ' + row.diff.length);
	}

	// -----------------------------------------------------

	var check_log = [], added_signs_or_notice = 0, last_processed_index, queued_start, is_no_link_user, is_unsigned_user;

	// 對於頁面每個修改的部分，比較頁面修訂差異。
	// 有些可能只是搬移，只要任何一行有簽名即可。
	row.diff.forEach(check_diff_pair);

	function check_diff_pair(diff_pair, diff_index) {
		if (CeL.is_debug(2)) {
			CeL.info('-'.repeat(75) + '\ncheck_diff_pair:');
			console.log(diff_pair);
		}

		// [ to_index_start, to_index_end ] = diff_pair.index[1]
		var to_index_start = diff_pair.index[1];
		if (!to_index_start) {
			CeL.debug('跳過: 這一段編輯刪除了文字 / deleted。', 2);
			return;
		}
		var to_index_end = to_index_start[1];
		to_index_start = to_index_start[0];

		if (to_index_end < last_processed_index) {
			CeL.debug('跳過: 這一段已經處理過。', 2);
			return;
		}

		for (var to_index = to_index_start; to_index <= to_index_end; to_index++) {
			var token = row.parsed[to_index];
			if (to_index_start === to_index) {
				if (typeof token === 'string' && !token.trim()) {
					CeL.debug('跳過一開始的空白。', 4);
					to_index_start = to_index + 1;
				}

			} else if (!sign_each_section) {
				continue;

			} else if (token.type === 'section_title') {
				// assert: to_index > to_index_start
				CeL.debug('這一小段編輯跨越了不同的段落。但是我們會檢查每個個別的段落，每個段落至少要有一個簽名。', 4);
				check_sections(to_index_start, to_index - 1, to_index,
						diff_pair, diff_index);
				// reset: 跳過之前的段落。但是之後的還是得繼續檢查。
				to_index_start = to_index;
			}
		}

		if (to_index_start > to_index_end) {
			CeL.debug('跳過: 經過初始篩選，這一段已經不剩下任何內容。', 2);
			last_processed_index = to_index_end;
			return;
		}

		var next_section_index = to_index_end;
		CeL.debug('對於頁面每個修改的部分，都向後搜尋/檢查到章節末。', 4);
		while (++next_section_index < row.parsed.length) {
			var token = row.parsed[next_section_index];
			if (token.type === 'section_title') {
				break;
			}
		}
		// assert: next_section_index === row.parsed.length
		// || row.parsed[next_section_index].type === 'section_title'

		if (!sign_each_section
				&& next_section_index === (row.diff[diff_index + 1]
				// 假如兩段之間沒有段落或者只有空白字元，那將會把他們合併在一起處理。
				&& row.diff[diff_index + 1].index[1] && row.diff[diff_index + 1].index[1][0])) {
			if (!(queued_start >= 0))
				queued_start = to_index_start;
			CeL.debug('合併段落 ' + [ diff_index, diff_index + 1 ]
					+ '，start index: ' + queued_start + '。', 2);
			return;
		}

		if (queued_start >= 0) {
			CeL.debug('之前合併過段落，start index: ' + to_index_start + '→'
					+ queued_start, 2);
			to_index_start = queued_start;
			queued_start = undefined;
		}

		// console.log([ to_index_end, next_section_index, row.parsed.length ]);

		check_sections(to_index_start, to_index_end, next_section_index,
				diff_pair, diff_index);
		last_processed_index = next_section_index;
	}

	function check_sections(to_diff_start_index, to_diff_end_index,
			next_section_index, diff_pair, diff_index) {
		if (CeL.is_debug(2)) {
			CeL.info('-'.repeat(60) + '\ncheck_sections: to of '
					+ CeL.wiki.title_link_of(row) + ':');
			console.log(row.diff.to.slice(to_diff_start_index,
					to_diff_end_index + 1));
			CeL.info('-'.repeat(4) + ' ↑ diff part ↓ list to next section');
			console.log(row.diff.to.slice(to_diff_end_index + 1,
					next_section_index));
		}

		// --------------------------------------

		// this edit paragraph within section
		var this_section_text = '';
		// 檢查這一次的修訂中，是不是只添加、修改了模板、章節標題或者沒有具體意義的文字。
		function this_section_text_may_skip() {
			var token_list = [];
			// 取得最頂端階層、模板之外的 wikitext 文字。
			for (var index = to_diff_start_index; index <= to_diff_end_index; index++) {
				var token = row.parsed[index];
				// 完全忽略註解。
				if (token.type === 'comment') {
					continue;
				}
				this_section_text += token;
				if (noncontent_type[token.type]) {
					continue;
				}
				// console.log([ previous_token, index, token ]);
				if (typeof token === 'string') {
					// 去掉魔術字 Magic words
					token = token.replace(/__[A-Z]{3,16}__/g, '');
				}
				token_list.push(token);
			}
			if (false) {
				// for e.g., "{{t1}}{{t2}}" in the same line.
				token_list = token_list.map(function(token) {
					token = token.toString()
					// 採用這個方法會更好。
					.replace_till_stable(/{{[^{}]+?}}/g, '');
					return token;
				});
			}
			token_list = token_list.join('').trim();
			CeL.debug('本段篩選過的文字剩下 ' + JSON.stringify(token_list), 2);
			// 本段文字只有ASCII符號。
			return PATTERN_symbol_only.test(token_list);
		}

		if (row.ns === CeL.wiki.namespace('user_talk')) {
			CeL.debug('測試是不是用戶在自己的討論頁添加上宣告或者維護模板。', 2);
			// row.title.startsWith(row.user)
			if (CeL.wiki.parse.user(CeL.wiki.title_link_of(row), row.user)) {
				CeL.debug('跳過使用者編輯屬於自己的頁面。', 2);
				if (this_section_text_may_skip()) {
					// Skip return;
				}
				// 對於非宣告的情況，即使是在自己的討論頁中留言，也應該要簽名。
			}
			if (this_section_text_may_skip()) {
				if (/^{{(?:Talk ?archive|讨论页存档|存档页|存檔頁)}}$/i
						.test(this_section_text.trim())) {
					CeL.debug('跳過: 只幫忙加入存檔模板。', 2, 'check_sections');
					return;
				}
				check_log.push([
						'這一段編輯只添加、修改了模板、章節標題或者沒有具體意義的文字',
						row.diff.to.slice(to_diff_start_index,
								to_diff_end_index + 1).join('') ]);
				return;
			}

		} else if (row.title.startsWith('Wikipedia:')
				|| CeL.wiki.is_talk_namespace(row.ns)) {
			CeL.debug('測試是不是在條目的討論頁添加上維基專題、條目里程碑、維護、評級模板。', 2);
			if (this_section_text_may_skip()) {
				// Skip: 忽略僅增加模板的情況。去掉編輯模板的情況。
				// e.g., 增加 {{地鐵專題}} {{臺灣專題|class=Cat|importance=NA}}
				// {{香港專題|class=stub}} {{Maintained|}} {{translated page|}}
				// {{ArticleHistory|}}
				CeL.debug('跳過修改模板中參數的情況。', 1, 'check_sections');
				return;
			}
		}
		// 可能會漏判。

		// --------------------------------------
		// 確保 to_diff_start_index, to_diff_end_index 這兩個分割點都在段落之間而非段落中間。

		// 若是差異開始的地方是在段落中間，那就把開始的index向前移到段落起始之處。
		// e.g., [[Special:Diff/45631425]]
		while (!/\n\s*$/.test(row.diff.to[to_diff_start_index])
		// 分割點的前或者後應該要有換行。
		&& !/^\s*\n/.test(row.diff.to[to_diff_start_index - 1])
		//
		&& to_diff_start_index - 1 > 0) {
			CeL.debug('差異開始的地方是在段落中間，把開始的index向前移到段落起始之處: '
					+ to_diff_start_index + '→' + (to_diff_start_index - 1)
					+ '。', 2);
			to_diff_start_index--;
			// continue; 向後尋找剛好交界在換行的 token。
		}

		// 若是差異結束的地方是在段落中間，那就把結束的index向後移到段落結束之處。
		// e.g., [[Special:Diff/45510337]]
		while (!/\n\s*$/.test(row.diff.to[to_diff_end_index])
		// 分割點的前或者後應該要有換行。
		&& !/^\s*\n/.test(row.diff.to[to_diff_end_index + 1])
		//
		&& to_diff_end_index + 1 < next_section_index) {
			CeL.debug('差異結束的地方是在段落中間，把結束的index向後移到段落結束之處: ' + to_diff_end_index
					+ '→' + (to_diff_end_index + 1) + '。', 2);
			to_diff_end_index++;
			// continue; 向後尋找剛好交界在換行的 token。
		}

		while (to_diff_end_index >= to_diff_start_index) {
			var token = row.parsed[to_diff_end_index];
			if (typeof token === 'string') {
				if (token.trim())
					break;
				--to_diff_end_index;
				// continue; 向前去掉最末尾的空白字元。
			} else if (noncontent_type[token.type]) {
				// e.g., [[Special:Diff/45536065|Talk:青色]]
				CeL.debug('這一次編輯，在最後加上了非內容的元素 ' + token + '。將會把簽名加在這之前。', 2);
				--to_diff_end_index;
				// continue; 向前去掉最末尾的非內容的元素。
			} else {
				// TODO: 向前去掉最末尾的 <br>
				break;
			}
		}

		if (to_diff_start_index > to_diff_end_index) {
			CeL.debug('跳過: 去掉最末尾的非內容的元素之後，就沒有東西了。', 2);
			return;
		}

		// --------------------------------------
		// 檢查每一段的差異、提取出所有簽名，並且做出相應的處理。

		CeL.debug('** 當作其他一般討論，應該加上署名。', 2);

		// 從修改的地方開始，到第一個出現簽名的第一層token為止的文字。
		var section_wikitext = row.diff.to.slice(to_diff_start_index,
				to_diff_end_index + 1);

		for (var index = to_diff_end_index + 1; index < next_section_index; index++) {
			var token = row.diff.to[index];
			section_wikitext.push(token);
			// TODO: 應該使用 function for_each_token()
			if (CeL.wiki.parse.user(token)) {
				break;
			}
		}

		section_wikitext = section_wikitext.join('');

		if (CeL.wiki.content_of.revision(row).length > 1
				&& CeL.wiki.content_of(row, -1).includes(
						section_wikitext.trim())) {
			// 可能需要人工手動檢查。可能是 diff 操作仍有可改善之處。寧可跳過漏報，不可錯殺。
			// e.g., [[Special:Diff/45311637]]
			check_log.push([ '此筆編輯之前就已經有這一段文字', section_wikitext ]);
			return;
		}

		if (PATTERN_symbol_only.test(section_wikitext)) {
			// @see [[Special:Diff/45254729]]
			check_log.push([ '此筆編輯僅僅添加了符號', section_wikitext ]);
			return;
		}

		// TODO: 應該使用 function for_each_token()
		var user_list = CeL.wiki.parse.user.all(section_wikitext);
		CeL.debug('row.user: [' + row.user + ']. 提取出所有簽名: '
				+ user_list.join(', '), 2);
		CeL.debug(section_wikitext, 4);

		// https://www.mediawiki.org/wiki/Transclusion
		var matched = section_wikitext
				.match(/<\/?(noinclude|onlyinclude|includeonly)([ >])/i);
		if (matched) {
			// 這些嵌入包含宣告應該使用在 template: 命名空間，若是要加上簽名，可能會有被含入時出現簽名的問題。
			if (user_list.length > 0 && CeL.wiki.parse.date(section_wikitext)) {
				CeL.debug('這段修改中有嵌入包含宣告<code>&lt;' + matched[1]
						+ '></code>，但是因為有發現簽名，因此不跳過。', 2);
			} else {
				// 但是既然加了，還是得提醒一下。
				check_log.push([
						'這段修改中有[[WP:TRANS|嵌入包含]]宣告<code>&lt;' + matched[1]
								+ '></code>，因此跳過不處理', section_wikitext ]);
				return;
			}
		}

		// --------------------------------------

		/** {Natural}下一個段落前最後一個不同之index。 */
		var last_diff_index_before_next_section = to_diff_end_index,
		// assert:to_next_diff_start_index >= 1
		to_next_diff_start_index = to_diff_end_index + 1;
		// 找出下一個段落前最後一個不同之處。
		for (var index = diff_index; ++index < row.diff.length;) {
			var to_diff_index = row.diff[index].index[1];
			if (!to_diff_index) {
				// 這一段變更只刪除了文字。
				continue;
			}
			to_next_diff_start_index = to_diff_index[1]
					|| to_next_diff_start_index;
			if (to_diff_index[1] >= next_section_index) {
				if (to_diff_index[0] < next_section_index) {
					// 下一段變更開始於段落標題之前。把簽名加在段落標題最前之前。
					last_diff_index_before_next_section = next_section_index - 1;
				}
				break;
			}
			if (to_diff_index[1] < next_section_index) {
				last_diff_index_before_next_section = to_diff_index[1];
				// 繼續檢查下一段變更。
			}
		}

		// --------------------------------------

		var last_token = row.diff.to[last_diff_index_before_next_section];

		// [[Wikipedia:签名]]: 簽名中必須至少包含該用戶的用戶頁、討論頁或貢獻頁其中一項的連結。
		if (user_list.length > 0) {
			if (user_list.includes(row.user)) {
				// has user link
				CeL.debug('直接跳過使用者 ' + row.user
						+ ' 編輯自己署名過的段落。但是這在編輯同一段落中其他人的發言時可能會漏判。', 2);
				return;
			}

			var from_user_list = diff_pair[0].join('');
			if (to_diff_end_index < last_diff_index_before_next_section) {
				// 加上到下一個段落之前相同的部分。但是請注意，這可能造成漏報。
				from_user_list += row.diff.to.slice(to_next_diff_start_index,
						last_diff_index_before_next_section).join('');
			}
			from_user_list = CeL.wiki.parse.user.all(from_user_list);
			user_list = user_list.filter(function(user) {
				// 跳過對機器人的編輯做出的修訂。
				return !/bot/i.test(user)
				// 跳過搬移選舉結果。只有在原先文字中就存在的使用者，才可能是被修改到的。要不然就是本次編輯添加的，例如搬移選舉結果的情況。
				&& from_user_list.includes(user);
			});
			// console.log([ from_user_list, user_list ]);
			if (user_list.length > 0) {
				check_log.push([
						row.user
						// e.g., "{{Ping|Name}}注意[[User:Name]]的此一編輯~~~~"
						+ ' 可能編輯了 ' + user_list.join(', ')
						// e.g., 您創建的條目~~可能侵犯版權
						+ ' 署名的文字（也可能是用戶' + row.user
								+ '代簽名、幫忙修正錯誤格式、特意提及、搬移條目討論，或是還原/撤銷編輯）',
						section_wikitext ]);
			} else {
				CeL.debug('在舊版的文字中並沒有發現簽名。或許是因為整段搬移貼上？', 2);
			}
			CeL.debug('終究是已經署名過了，因此不需要再處理。', 2);
			return;

		} else if (CeL.wiki.parse.user(CeL.wiki.title_link_of(row), row.user)) {
			CeL.debug('在編輯自己的用戶頁，並且沒有發現任何簽名的情況下就跳過。', 2);
			return;

		} else if (row.user.length >= (/^[ -\u007f]*$/.test(row.user) ? 4 : 2)
		// 有簽名，缺少連結。這項測試必須要用戶名稱夠長，以預防漏報。
		&& (new RegExp(CeL.to_RegExp_pattern(row.user)
		// e.g., [[Special:Diff/45178923]]
		.replace(/[ _]/g, '[ _]'), 'i')).test(section_wikitext)
		// 測試假如有加入日期的時候。
		|| CeL.wiki.parse.date(last_token)) {
			// 但是若僅僅在文字中提及時，可能會被漏掉，因此加個警告做紀錄。
			check_log
					.push([
							'用戶 '
									+ row.user
									+ ' 似乎未以連結的形式加上簽名。例如只寫了用戶名或日期（請注意，只寫日期也會被跳過），但是沒有加連結的情況。也有可能把<code>~~<nowiki />~~</code>輸入成<code><nowiki>~~~~~</nowiki></code>了',
							section_wikitext ]);
			is_no_link_user = true;
			added_signs_or_notice++;
			return;
		}

		// --------------------------------------
		// 該簽名而未簽名。未簽補上簽名。

		added_signs_or_notice++;

		var is_IP_user = CeL.wiki.parse.user.is_IP(row.user);

		check_log.push([ (/([12]\d{3})年(1?\d)月([1-3]?\d)日 /.test(last_token)
		//
		? '編輯者或許已經加上日期與簽名，但是並不明確。仍然' : '')
		// 會有編輯動作時，特別加強色彩。可以只看著色的部分，這些才是真正會補簽名的。
		+ '<b style="color:orange">需要在最後補上' + (is_IP_user ? 'IP用戶' : '用戶')
		// <b>中不容許有另一個<b>，只能改成<span>。
		+ ' <span style="color:blue">' + row.user + '</span> 的簽名</b>',
		// 一整段的文字。
		row.diff.to.slice(to_diff_start_index,
		//
		last_diff_index_before_next_section + 1).join('') ]);

		// 添加簽名。
		is_unsigned_user = true;

		row.diff.to[last_diff_index_before_next_section] = last_token
		// {{subst:unsigned|用戶名或IP|時間日期}}
		.replace(/([\s\n]*)$/, '{{subst:unsigned|' + row.user + '|'
				+ get_parsed_time(row) + (is_IP_user ? '|IP=1' : '') + '}}$1');

		CeL.info('需要在最後補簽名的編輯: ' + CeL.wiki.title_link_of(row));
		console.log(row.diff.to.slice(to_diff_start_index,
				last_diff_index_before_next_section + 1).join(''));
		show_page(row);
		CeL.info('-'.repeat(75));
	}

	// -----------------------------------------------------
	// 處理有需要注意的頁面。

	if (check_log.length > 0) {
		if (CeL.is_debug()) {
			CeL.info(CeL.wiki.title_link_of(row) + ': 將可能修改了他人文字的編輯寫進記錄頁面 '
					+ CeL.wiki.title_link_of(check_log_page));
			CeL.info('-'.repeat(75));
		}
		check_log = check_log.map(function(log) {
			if (!Array.isArray(log)) {
				return log;
			}
			// 維基語法元素與包含換行的字串長
			log[0] += ' (本段修改共 ' + log[1].length + ' 字元):\n<pre><nowiki>';
			// 不需要顯示太多換行。
			log[1] = log[1].trim();
			var more = '';
			if (log[1].length > 80 * 2 + more_separator.length + 20) {
				more = more_separator + log[1].slice(-80);
				log[1] = log[1].slice(0, 80);
			}
			// escape
			return log[0] + log[1].replace(/</g, '&lt;')
			// 在<nowiki>中，-{}-仍有作用。
			.replace(/-{/g, '&#x2d;{') + more + '</nowiki></pre>';
		});
		check_log.unshift((row.revisions.length > 1
		// show diff link
		? '; [[Special:Diff/' + row.revid + '|' + row.title + ']]'
		// 新頁面
		: '; [[Special:Permalink/' + row.revid + '|' + row.title + ']] (新頁面)'
		//
		) + ': '
		// add [[Help:編輯摘要]]。
		+ (row.comment ? '<code><nowiki>' + row.comment
		//
		+ '</nowiki></code> ' : '')
		// add timestamp
		+ '--' + row.user + ' ' + get_parsed_time(row)
		//
		);
		wiki.page(check_log_page).edit(check_log.join('\n* '), {
			section : 'new',
			sectiontitle : row.title,
			nocreate : 1,
			bot : 1,
			summary : 'bot: Signature check report of '
			// 在編輯摘要中加上使用者連結，似乎還不至於驚擾到使用者。
			+ '[[User:' + row.user + "]]'s edit in "
			//
			+ CeL.wiki.title_link_of(row.title)
			//
			+ ', [[Special:Diff/' + row.revid + ']].'
			//
			+ (added_signs_or_notice ? ' ** Need add sign or notice **' : '')
		});
	}

	if (!added_signs_or_notice) {
		CeL.debug('本次編輯不需要補上簽名或提醒。', 2);
		return;
	}

	if (test_mode) {
		CeL.debug('本次執行為測試模式，將不會寫入簽名或者提醒。', 2);
		return;
	}

	// -------------------------------------------

	if (is_no_link_user
			&& add_count(row, no_link_user_hash) > notification_limit_count) {
		CeL.debug('用戶討論頁提示：如果留言者簽名沒有連結 ' + notification_limit_count
				+ ' 次，通知使用者記得要改變簽名。', 2);
		var pages_to_notify = Object.keys(no_link_user_hash[row.user]).map(
				function(title) {
					return CeL.wiki.title_link_of(title);
				}).join(', ');
		wiki.page('User:' + row.user).edit('{{subst:Uw-signlink||簽名沒有連結的頁面例如 '
		//
		+ pages_to_notify + '。謝謝您的參與。 --~~~~}}', {
			section : 'new',
			sectiontitle : '您好，可能需要麻煩改變一下您的留言簽名格式',
			summary : 'bot test: 提醒簽名記得加上連結，例如在文中所列的 '
			//
			+ pages_to_notify.length + ' 個頁面'
		});
		// reset no-link count of user
		delete no_link_user_hash[row.user];
	}

	if (!is_unsigned_user) {
		return;
	}

	// -------------------------------------------

	CeL.debug('為沒有署名的編輯添加簽名標記。', 2);
	// 若是row並非最新版，則會放棄編輯。
	wiki.page(row).edit(row.diff.to.join(''), {
		nocreate : 1,
		summary :
		//
		'bot test: 為[[Special:Diff/' + row.revid + '|' + row.user + '的編輯]]補簽名。'
	});

	if (add_count(row, unsigned_user_hash) > notification_limit_count) {
		CeL.debug('用戶討論頁提示：如果未簽名編輯了 ' + notification_limit_count
				+ ' 次，通知使用者記得簽名。', 2);
		var pages_to_notify = Object.keys(unsigned_user_hash[row.user]).map(
				function(title) {
					return CeL.wiki.title_link_of(title);
				}).join(', ');
		wiki.page('User:' + row.user).edit('{{subst:Uw-tilde||可能需要簽名的頁面例如 '
		// [[MediaWiki:Talkpagetext/zh]]
		+ pages_to_notify + '。謝謝您的參與。 --~~~~}}', {
			section : 'new',
			sectiontitle : '請記得在留言時署名',
			summary : 'bot test: 提醒記得簽名，例如在文中所列的 '
			//
			+ pages_to_notify.length + ' 個頁面'
		});
		// reset unsigned count of user
		delete unsigned_user_hash[row.user];
	}

}
