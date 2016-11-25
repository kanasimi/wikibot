// 添加維基文庫中提及本年的原始文獻連結。對前699年–1910年批量添加{{wikisource year mention}}。注意，一些條目已經有「參見」章節。

/*

 2016/11/24 6:39:12	初版試運行

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true);

summary = '[[Special:Diff/41767582/41905616|機器人作業請求]]: ' + summary;

var
/** {Number}未發現之index。 const: 基本上與程式碼設計合一，僅表示名義，不可更改。(=== -1) */
NOT_FOUND = ''.indexOf('_');

// ----------------------------------------------------------------------------

var titles = [];
for (var year = -700; year <= 1910; year++) {
	if (year !== 0)
		titles.push((year < 0 ? '前' + -year : year) + '年');
}

if (false) {
	// 這樣出來的結果會不按照順序
	wiki.work({
		each : for_each_page,
		// 不作編輯作業。
		// no_edit : true,
		// last : finish_work,
		// log_to : log_to,
		summary : summary
	}, titles);
}

titles.forEach(function(title) {
	wiki.page(title).edit(for_each_page, {
		bot : 1,
		nocreate : 1,
		summary : summary
	});
});

// ----------------------------------------------------------------------------

if (false) {
	'a\n==逝世==\ntt\n==參見==\ndfff\n'
			.match(/(\n(={2,4})[^=]+(\2) *\n)((?:\n+[^\n=]|[^\n]+)*)$/);
	'a\n==逝世==\ntt\n==參見==\ndfff\n'.replace(
			/(\n(={2,4})[^=]+(\2) *\n)((?:[^\n]+|\n+[^\n=])*)$/,
			'$1{{Wikisource year mention}}\n$3');
}

function for_each_page(page_data) {

	var
	/**
	 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
	 */
	content = CeL.wiki.content_of(page_data);

	if (!content) {
		return [ CeL.wiki.edit.cancel,
				'No contents: [[' + title + ']]! 沒有頁面內容！' ];
	}

	if (/{{ *[Ww]ikisource[ _]year[ _\|}]/.test(content)) {
		return [ CeL.wiki.edit.cancel, 'skip' ];
	}

	var template_string = '\n{{Wikisource year mention}}',
	// 找尋最後一個章節
	index = content.lastIndexOf('\n==');
	if (index !== NOT_FOUND) {
		index = content.indexOf('\n', index + '\n=='.length);
	}
	if (index === NOT_FOUND) {
		content += template_string;
	} else {
		content = content.slice(0, index) + template_string
				+ content.slice(index);
	}

	return content;
}
