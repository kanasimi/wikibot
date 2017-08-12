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
edit_others_log_to_page = 'User:' + user_name + '/edit others';

// ----------------------------------------------------------------------------

// CeL.set_debug(2);

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
	with_diff : {
		LCS : true,
		// line : true,
		line : false,
		index : 2,
		with_list : true
	},
	parameters : {
		// 跳過機器人所做的編輯。
		// You need the "patrol" or "patrolmarks" right to request the patrolled
		// flag.
		rcshow : '!bot',
		rcprop : 'title|ids|sizes|flags|user'
	},
	interval : 500
});

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

	function check_pair(diff_pair) {
		CeL.info('-'.repeat(75));
		console.log(diff_pair);

		var to_index = diff_pair.index[1], to_index_end = to_index[1];
		to_index = to_index[0];
		if (false) {
			console.log('to_index: ' + to_index);
		}
		if (!(to_index >= 0)) {
			return;
		}
		if (false) {
			console.log([ row.title, 'User:' + row.user,
					'Special:Diff/' + row.revid ]);
		}
		var lines = [], diff_lines = [], line, matched, new_content;
		while (to_index < to_length
		// 比較頁面修訂差異。對於頁面每個修改的部分，都向後搜尋/檢查到章節末，提取出所有簽名。
		&& !(line = to[to_index++].trimEnd()).startsWith('=')) {
			// TODO: [[Special:Diff/45623121]] [[Special:Diff/45628113]]
			if (line.startsWith('}}')) {
				// e.g., 去掉編輯頁首模板的情況。
				// 可能會漏判。
				// TODO: 警告: 若在模板參數中加入了章節標題，則會被當作沒有簽名。
				CeL.debug('跳過修改模板中參數的情況。', 1, 'check_pair');
				// reset: 跳過之前的。但是之後的還是得繼續檢查。
				lines = [];
				diff_lines = [];
				line = line.replace(/.*}}/, '');
				if (!line) {
					return;
				}
			}
			// 提取出所有簽名。
			var user_list = CeL.wiki.parse.user.all(line);
			// console.log([ 'row.user:', row.user, line ]);
			// [[Wikipedia:签名]] 簽名中必須至少包含該用戶的用戶頁、討論頁或貢獻頁其中一項的連結。
			if (user_list.length > 0) {
				// 直接跳過使用者編輯屬於自己的頁面。
				if (user_list.includes(row.user)) {
					// has user link
					return true;
				}
				if (to_index - 1 <= to_index_end) {
					CeL.warn('[[Special:Diff/' + row.revid + ']]: ' + row.user
					// e.g., "{{Ping|Name}}注意[[User:Name]]的此一編輯~~~~"
					+ ' 可能編輯了 ' + user_list.join(', ')
							+ ' 署名的文字（也可能是特意提及，或是搬移選舉結果）:\n' + line);
					edit_others = user_list;
				}
			} else if (row.user.length > 4
					// 只寫了用戶名，但是沒有加連結的情況。 e.g., [[Special:Diff/45178923]]
					&& (new RegExp(CeL.to_RegExp_pattern(row.user).replace(
							/[ _]/g, '[ _]'), 'i')).test(line)) {
				// 但是若僅僅在文字中提及時，可能會被漏掉。
				return true;
			}
			if (to_index - 1 <= to_index_end) {
				diff_lines.push(line);
			}
			lines.push(line);
		}
		// 忽略僅增加模板的情況。
		if (diff_lines.length === 0 || diff_lines.join('') === ''
		// e.g., 在首段落增加 {{地鐵專題}} {{臺灣專題|class=Cat|importance=NA}}
		// {{香港專題|class=stub}} {{Maintained|}} {{translated page|}}
		// {{ArticleHistory|}}
		|| /^\s*(?:{{[^{}]+}}\s*|}}\s*)+$/.test(diff_lines.join(''))) {
			return;
		}

		all_lines.push(lines);
	}

	CeL.info('='.repeat(75));
	console.log([ row.title, 'User:' + row.user, 'Special:Diff/' + row.revid ]);
	console.log(row.diff);

	var to = row.diff.to, to_length = to.length, all_lines = [], edit_others;
	// 對於頁面每個修改的部分，比較頁面修訂差異。
	// 有些可能只是搬移，只要任何一行有簽名即可。
	if (row.diff.some(check_pair) || all_lines.length === 0) {
		return;
	}

	if (edit_others) {
		// TODO: 跳過搬移選舉結果
		CeL.info(CeL.wiki.title_link_of(row) + ': 將可能修改了他人文字的編輯寫進記錄頁面 '
				+ CeL.wiki.title_link_of(edit_others_log_to_page));
		CeL.info('-'.repeat(75));
		// TODO: 寫進記錄頁面。

		// 終究是已經署名過了，因此不需要再處理。
		return;
	}

	// 跳過使用者編輯屬於自己的頁面。為了抓出修改別人留言的編輯，因此不在先期篩選中將之去除。
	// 即使是在自己的討論頁中留言，也應該要簽名。
	if (false && CeL.wiki.parse.user(CeL.wiki.title_link_of(row), row.user)) {
		return;
	}

	CeL.info('需要補簽名的diff: ' + CeL.wiki.title_link_of(row));
	console.log(all_lines);
	console.log([ row.pageid, row.title, 'User:' + row.user,
			'Special:Diff/' + row.revid ]);
	CeL.info('-'.repeat(75));

	// TODO: 通知使用者記得簽名
	// [[Special:Diff/45360040]]
	// [[MediaWiki:Talkpagetext/zh]]

	return;

	// 為沒有署名的編輯添加簽名標記。
	// {{subst:unsigned|用戶名或IP|時間日期}}
	// 若是row並非最新版，則會放棄編輯。
	wiki.page(row).edit(new_content);
}
