// (cd ~/wikibot && date && hostname && nohup time node 20170515.add_sign.js; date) >> modify_link/log &

/*


 [[User talk:蘭斯特/TWA]]
 應掛上{{bot}}或改到[[User:蘭斯特/TWA]]

 // TODO: id error!!!

 2017/5/15 21:30:19	初版試營運。
 完成。正式運用。

 工作原理:
 # 監視最近更改的頁面。
 # 取得頁面資料。
 # 做初步的篩選: 以討論頁面為主。
 # 比較頁面修訂差異。對於頁面每個修改的部分，都向後搜尋/檢查到章節末，提取出所有簽名。跳過修改模板中參數的情況。
 # 將可能修改了他人文字的編輯寫進記錄頁面 。
 # 為沒有署名的編輯添加簽名標記。

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),
//
check_log_page = 'User:' + user_name + '/Signature check';

// ----------------------------------------------------------------------------

// CeL.set_debug(2);

var test_the_page_only = '',
//
with_diff = {
	LCS : true,
	// line : true,
	line : false,
	index : 2,
	with_list : true
};

if (test_the_page_only) {
	wiki.page(test_the_page_only, function(page_data) {
		var revision = CeL.wiki.content_of.revision(page_data);
		page_data.user = revision.user;
		page_data.timestamp = revision.timestamp;

		CeL.wiki.parser(page_data).parse();
		page_data.diff = CeL.LCS(CeL.wiki.parser(
				CeL.wiki.content_of(page_data, -1)).parse().map(
				function(token) {
					return token.toString();
				}), page_data.parsed.map(function(token) {
			return token.toString();
		}), Object.assign({
			diff : true
		}, with_diff));

		// CeL.set_debug(2);
		if (CeL.is_debug(2))
			console.log(page_data);
		for_each_row(page_data);
	}, {
		rvprop : 'timestamp|content|user',
		rvlimit : 2
	});

} else {
	// 監視最近更改的頁面。
	wiki.listen(for_each_row, {
		start : new Date(Date.now() - 70 * 24 * 60 * 60 * 1000),
		// 做初步的篩選。
		filter : function(row) {
			if (false) {
				console.log([ row.title, 'User:' + row.user,
						'Special:Diff/' + row.revid ]);
			}

			var passed =
			// 為了某些編輯不加 bot flag 的 bot。
			!/bot/i.test(row.user)
			// 篩選頁面標題。
			// 跳過封存/存檔頁面。
			&& !/\/(?:archive|存檔|存档|檔案|档案)/i.test(row.title)
			// e.g., [[Wikipedia_talk:聚会/2017青島夏聚]]
			// || /^Wikipedia[ _]talk:聚会\// i.test(row.title)
			// 必須是白名單頁面，
			&& (row.title.startsWith('Wikipedia:互助客栈/')
			// ...或者討論頁面
			|| CeL.wiki.is_talk_namespace(row.ns));

			return passed;
		},
		with_diff : with_diff,
		parameters : {
			// 跳過機器人所做的編輯。
			// You need the "patrol" or "patrolmarks" right to request the
			// patrolled
			// flag.
			rcshow : '!bot',
			rcprop : 'title|ids|sizes|flags|user'
		},
		interval : 500
	});
}

// ---------------------------------------------------------

// 取得頁面資料。
function for_each_row(row) {
	delete row.row;
	if (false) {
		CeL.set_debug();
		console.log(row);
		return;
		console.log(row.diff);
	}
	// 做初步的篩選: 以討論頁面為主。
	if (!row.diff
	// 跳過封存/存檔頁面。
	|| /\/(?:archive|存檔|存档|檔案|档案)/i.test(row.title)
	// e.g., [[Wikipedia_talk:聚会/2017青島夏聚]]
	// || /^Wikipedia[ _]talk:聚会\// i.test(row.title)
	// 必須是白名單頁面
	|| row.title.startsWith('Wikipedia:互助客栈')
	//
	&& !row.title.startsWith('Wikipedia:互助客栈/')
	// 篩選頁面內容。
	|| !row.revisions || !row.revisions[0]
	// 跳過重定向頁。
	|| CeL.wiki.parse.redirect(row.revisions[0]['*'])
	// [[WP:SIGN]]
	|| CeL.wiki.edit.denied(row, user_name, 'SIGN')) {
		return;
	}
	if (false) {
		row.revisions.forEach(function(revision) {
			delete revision['*'];
		});
		delete row.diff;
		console.log(row);
	}

	if (CeL.is_debug(2)) {
		CeL.info('='.repeat(75));
		console.log([ row.title, 'User:' + row.user,
				'Special:Diff/' + row.revid ]);
		console.log(row);
	}

	// 比較頁面修訂差異。
	// TODO: 正常情況下 token 都是完整的；但是也要應對一些編輯錯誤或者故意編輯錯誤。
	// row.parsed, row.diff.to 的每一元素都是完整的 token；並且兩者的 index 相對應。
	// @see add_listener() in CeL.application.net.wiki
	// row.diff.to[index] === row.parsed[index].toString();
	var to = row.diff.to, to_length = to.length, all_lines = [],
	// 第二個段落在row.parsed中的 index。
	second_section_index = row.parsed.length;

	row.parsed.some(function(token, index) {
		if (token.type === 'section_title') {
			second_section_index = index;
			return true;
		}
	});
	if (CeL.is_debug(2))
		CeL.info('second_section_index: ' + second_section_index);

	// -----------------------------------------------------

	var check_log = [], added_signs = 0;

	// 對於頁面每個修改的部分，比較頁面修訂差異。
	// 有些可能只是搬移，只要任何一行有簽名即可。
	row.diff.forEach(check_diff_pair);

	// 除了在編輯首段的維基專題、條目里程碑、維護模板之外，每個段落至少要有一個簽名。
	function check_diff_pair(diff_pair) {
		if (CeL.is_debug(2)) {
			CeL.info('-'.repeat(75) + '\ncheck_diff_pair:');
			console.log(diff_pair);
		}

		// [ to_index_start, to_index_end ] = diff_pair.index[1]
		var to_index_start = diff_pair.index[1];
		if (!to_index_start) {
			// deleted
			return;
		}
		var to_index_end = to_index_start[1];
		to_index_start = to_index_start[0];

		for (var to_index = to_index_start; to_index <= to_index_end; to_index++) {
			var token = row.parsed[to_index];
			if (to_index_start === to_index) {
				if (typeof token === 'string' && !token.trim()) {
					// 跳過一開始的空白。
					to_index_start = to_index + 1;
				}
			} else if (token.type === 'section_title') {
				// assert: to_index > to_index_start
				// 這一小段編輯跨越了不同的段落。但是我們會檢查每個個別的段落，每個段落至少要有一個簽名。
				check_section(to_index_start, to_index - 1, to_index);
				// reset: 跳過之前的段落。但是之後的還是得繼續檢查。
				to_index_start = to_index;
			}
		}

		if (to_index_start >= to_index_end) {
			return;
		}

		var next_section_index = to_index_end;
		// 對於頁面每個修改的部分，都向後搜尋/檢查到章節末，提取出所有簽名。
		while (++next_section_index < row.parsed.length) {
			var token = row.parsed[next_section_index];
			if (token.type === 'section_title') {
				break;
			}
		}

		check_section(to_index_start, to_index_end, next_section_index);
	}

	// 一般說來在討論頁留言的用途有:
	// 在條目的討論頁首段添加上維基專題、條目里程碑、維護模板。
	// TODO: 當一次性大量加入連續的文字時，僅僅當做一次編輯。例如貼上文件備查。 [[Special:Diff/45239349]]
	// 用戶在自己的討論頁首段添加上宣告或者維護模板。
	// 其他一般討論，應該加上署名。

	function check_section(to_diff_start_index, to_diff_end_index,
			next_section_index) {
		if (CeL.is_debug(2)) {
			CeL.info('-'.repeat(60) + '\ncheck_section:');
			console.log(row.diff.to.slice(to_diff_start_index,
					to_diff_end_index + 1));
			CeL.info('-'.repeat(20));
			console.log(row.diff.to.slice(to_diff_end_index + 1,
					next_section_index));
		}

		function top_level_text_may_skip() {
			var token_list = [];
			// 取得最頂端階層、模板之外的wikitext文字。
			for (var index = to_diff_start_index; index <= to_diff_end_index; index++) {
				if (row.parsed[index].type === 'transclusion'
				// 維護模板一般會從新的一行開始。
				&& (index === 0 || row.diff.to[index - 1].endsWith('\n')))
					continue;
				token_list.push(row.parsed[index]);
			}
			return /^[ -@\[-`{-~]{0,4}$/.test(token_list.join('').trim());
		}

		if (to_diff_end_index < second_section_index) {
			if (row.ns === CeL.wiki.namespace('user_talk')) {
				CeL.debug('測試是不是用戶在用戶的討論頁首段添加上宣告或者維護模板。', 2);
				// row.title.startsWith(row.user)
				if (CeL.wiki.parse.user(CeL.wiki.title_link_of(row), row.user)) {
					CeL.debug('跳過使用者編輯屬於自己的頁面。為了抓出修改別人留言的編輯，因此不在先期篩選中將之去除。', 2);
					if (top_level_text_may_skip()) {
						// Skip
						return;
					}
					// 對於非宣告的情況，即使是在自己的討論頁中留言，也應該要簽名。
				}

			} else if (CeL.wiki.is_talk_namespace(row.ns)) {
				CeL.debug('測試是不是在條目的討論頁首段添加上維基專題、條目里程碑、維護模板。', 2);
				if (top_level_text_may_skip()) {
					// Skip: 忽略僅增加模板的情況。去掉編輯頁首模板的情況。
					// e.g., 在首段落增加 {{地鐵專題}} {{臺灣專題|class=Cat|importance=NA}}
					// {{香港專題|class=stub}} {{Maintained|}} {{translated page|}}
					// {{ArticleHistory|}}
					CeL.debug('跳過修改模板中參數的情況。', 1, 'check_section');
					return;
				}
			}
			// 可能會漏判。
		}

		CeL.debug('當作其他一般討論，應該加上署名。', 2);

		// 從修改的地方開始，到第一個出現簽名的第一層token為止的文字。
		var section_wikitext = row.diff.to.slice(to_diff_start_index,
				to_diff_end_index + 1);

		for (var index = to_diff_end_index + 1; index <= next_section_index; index++) {
			var token = row.diff.to[index];
			section_wikitext.push(token);
			// TODO: 應該使用 function for_each_token()
			if (CeL.wiki.parse.user(token)) {
				break;
			}
		}

		section_wikitext = section_wikitext.join('');

		// 提取出所有簽名。
		// TODO: 應該使用 function for_each_token()
		var user_list = CeL.wiki.parse.user.all(section_wikitext);
		// console.log([ 'row.user:', row.user, section_wikitext ]);

		// [[Wikipedia:签名]] 簽名中必須至少包含該用戶的用戶頁、討論頁或貢獻頁其中一項的連結。
		if (user_list.length > 0) {
			CeL.debug('直接跳過使用者編輯屬於自己的頁面。但是這在編輯同一段落中其他人的發言時可能會漏判。', 2);
			if (user_list.includes(row.user)) {
				// has user link
				return;
			}

			check_log.push([ row.user
			// e.g., "{{Ping|Name}}注意[[User:Name]]的此一編輯~~~~"
			+ ' 可能編輯了 ' + user_list.join(', ') + ' 署名的文字（也可能是特意提及，或是搬移選舉結果）',
					section_wikitext ]);
			CeL.debug('終究是已經署名過了，因此不需要再處理。', 2);
			return;

		} else if (CeL.wiki.parse.user(CeL.wiki.title_link_of(row), row.user)) {
			CeL.debug('在編輯自己的用戶頁，並且沒有發現任何簽名的情況下就跳過。', 2);
			return;

		} else if (row.user.length > 4
		// 只寫了用戶名，但是沒有加連結的情況。 e.g., [[Special:Diff/45178923]]
		&& (new RegExp(CeL.to_RegExp_pattern(row.user)
		//
		.replace(/[ _]/g, '[ _]'), 'i')).test(section_wikitext)) {
			// 但是若僅僅在文字中提及時，可能會被漏掉，因此加個警告做紀錄。
			check_log.push([ row.user + '似乎未以連結的形式加上簽名', section_wikitext ]);
			return;
		}

		CeL.info('需要補簽名的diff: ' + CeL.wiki.title_link_of(row));
		console.log(section_wikitext);
		console.log([ row.pageid, row.title, 'User:' + row.user,
				'Special:Diff/' + row.revid ]);
		CeL.info('-'.repeat(75));

		added_signs++;
		row.diff.to[to_diff_end_index] += '{{subst:unsigned|' + row.user + '|'
		// 該簽名而未簽名。未簽補上簽名。
		+ (new Date(row.timestamp)).format({
			format : '%Y年%m月%d日 (%w) %2H:%2M (UTC)',
			zone : 0
		}).replace('星期', '')
		// TODO: for IPv6
		+ (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(row.user) ? '|IP=1' : '') + '}}';
	}

	// -----------------------------------------------------

	if (check_log.length > 0) {
		// TODO: 跳過搬移選舉結果
		if (CeL.is_debug()) {
			CeL.info(CeL.wiki.title_link_of(row) + ': 將可能修改了他人文字的編輯寫進記錄頁面 '
					+ CeL.wiki.title_link_of(check_log_page));
			CeL.info('-'.repeat(75));
		}
		// 寫進記錄頁面。
		check_log = check_log.map(function(log) {
			log[0] += ' (' + log[1].length + ' chars):\n<pre><nowiki>';
			var more = '';
			if (log[1].length > 80 * 2) {
				more = '...<pre><nowiki>' + log[1].slice(-80)
						+ '</nowiki></pre>';
				log[1] = log[1].slice(0, 80);
			}
			return log[0] + log[1].replace(/</g, '&lt;') + '</nowiki></pre>'
					+ more;
		});
		check_log.unshift('; [[Special:Diff/' + row.revid + '|' + row.title
				+ ']]:');
		wiki.page(check_log_page).edit(check_log.join('\n* '), {
			section : 'new',
			sectiontitle : row.title,
			nocreate : 1,
			bot : 1,
			summary : 'Report of [[Special:Diff/' + row.revid + ']]'
		});
	}

	// TODO: 通知使用者記得簽名
	// [[Special:Diff/45360040]]
	// [[MediaWiki:Talkpagetext/zh]]

	// 為沒有署名的編輯添加簽名標記。
	// {{subst:unsigned|用戶名或IP|時間日期}}
	// 若是row並非最新版，則會放棄編輯。
	if (added_signs && undefined)
		wiki.page(row).edit(row.diff.to.join(''));
}
