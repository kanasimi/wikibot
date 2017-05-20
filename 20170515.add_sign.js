// (cd ~/wikibot && date && hostname && nohup time node 20170428.modify_link.リンク元修正v2.js; date) >> modify_link/log &

/*

 署名

 [[User talk:蘭斯特/TWA]]
 應掛上{{bot}}或改到[[User:蘭斯特/TWA]]

 // TODO: id error!!!

 2017/5/15 21:30:19	初版試營運。
 完成。正式運用。

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true);

// ----------------------------------------------------------------------------

// CeL.set_debug(2);

wiki.listen(for_each_row, {
	// start : new Date(Date.now() - 60 * 60 * 1000),
	with_diff : {
		LCS : true,
		line : true,
		index : 2,
		with_list : true
	},
	parameters : {
		rcprop : 'title|ids|sizes|flags|user'
	},
	interval : 500
});

function for_each_row(row) {
	delete row.row;
	// console.log([ row.pageid, row.title, row.user, row.revid ]);
	if (false) {
		CeL.set_debug();
		console.log(row);
		return;
		console.log(row.diff);
	}
	// 跳過機器人所做的編輯。
	if (!row.revisions || ('bot' in row)
	// 為了某些編輯不加 bot flag 的 bot。
	|| /bot/i.test(row.user)
	//
	|| /\/archive/.test(row.title)) {
		return;
	}
	if (false) {
		row.revisions.forEach(function(revision) {
			delete revision['*'];
		});
		delete row.diff;
		console.log(row);
	}
	if (!row.diff
			|| !/^[a-z _]*talk:/.test(CeL.wiki.namespace.name_of_NO[row.ns])
			&& !row.title.startsWith('Wikipedia:互助客栈/')) {
		return;
	}

	var to = row.diff.to, to_length = to.length, all_lines = [];
	// 有些可能只是搬移，只要任何一行有簽名即可。
	if (row.diff.some(check_pair) || all_lines.length === 0) {
		return;
	}

	function check_pair(pair) {
		var to_index = pair.index[1];
		if (Array.isArray(to_index)) {
			to_index = to_index[0];
		}
		if (false) {
			console.log('to_index: ' + to_index);
		}
		if (!(to_index >= 0)) {
			return;
		}
		if (false) {
			console.log([ row.pageid, row.title, row.user, row.revid ]);
		}
		var lines = [], line, matched;
		while (to_index < to_length
		// 只向前搜尋到章節末。
		&& !(line = to[to_index++]).startsWith('=')) {
			// TODO: ~編輯了～署名的文字

			// console.log([ 'row.user:', row.user, line ]);
			// [[Wikipedia:签名]] 簽名中必須至少包含該用戶的用戶頁、討論頁或貢獻頁其中一項的連結。
			if (CeL.wiki.parse.user.all(line, row.user)) {
				// has user link
				return true;
			}
			lines.push(line);
		}
		// 忽略僅增加模板的情況。
		if (lines.length === 0 || lines.join('') === ''
		// e.g., {{{{translated page|en}} {{Maintained}} {{地鐵專題}}
		// {{臺灣專題|class=Cat|importance=NA}} }} {{香港專題|class=stub}}
		|| /^\s*(?:{{[^{}]+}}\s*|}}\s*)+$/.test(lines.join(''))) {
			return;
		}

		all_lines.push(lines);
	}

	// 需要處理的diff。
	CeL.info(CeL.wiki.title_link_of(row));
	console.log([ row.pageid, row.title, row.user, row.revid ]);
	console.log(all_lines);
	CeL.info('-'.repeat(75));
}
