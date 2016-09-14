// (cd ~/wikibot && date && hostname && nohup time node 20160719.clean_sandbox.js; date) >> clean_sandbox/log &

/*

 2016/9/6 18:14:15	初版試營運 公共討論頁的段落(討論串)自動存檔機器人。

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'https://zh.moegirl.org/api.php');

wiki.page('Talk:讨论版', for_board).page('Talk:提问求助区', for_board);

function for_board(page_data) {
	var need_change_count = 0,
	// 每天一次掃描：每個話題(討論串)最後一次回復的10日後進行存檔處理；
	need_archive_10 = Date.now() - 10 * 24 * 60 * 60 * 1000,
	//
	need_archive_3 = Date.now() - 3 * 24 * 60 * 60 * 1000,
	//
	is_day_1_of_month = (new Date).getDate() === 1;

	var parser = CeL.wiki.parser(page_data), sections = [];
	parser.each('section_title', function(token, index) {
		console.log('[' + index + ']' + token.title);
		// 先找出所有 sections 的 index of parser。
		sections.push(index);
	}, false, 1);

	sections.forEach(function(parser_index, section_index) {
		var section_title = parser[parser_index].title,
		// +1: 跳過 section 本身
		slice = [ parser_index + 1,
				sections[section_index + 1] || parser.length ],
		//
		section_text = Array.prototype.slice.apply(parser, slice).join('');
		if (!section_title) {
			CeL.err('No title: ' + section_text);
			return;
		}

		// 跳過已存檔
		if (section_text.length < 300
				&& /^\n*{{(?:Saved|movedto)\s*\|.{10,200}?}}\n+$/i
						.test(section_text)) {
			// 每月1號：刪除所有{{saved}}提示模板。
			if (is_day_1_of_month) {
				need_change_count++;
				for (var i = slice[0]; i < slice[1]; i++) {
					// stupid way
					parser[i] = '';
				}
			}
			return;
		}

		var needless,
		// CeL.log(index+': '+new Date(latest));
		// 都做成10天存檔
		need_archive_date = false
				&& section_title.includes('申请')
				&& (section_title.includes('巡查员') || section_title
						.includes('管理员')) ? need_archive_3 : need_archive_10;
		parser.each('text', function(token, index) {
			if (needless) {
				return;
			}
			var date_list = CeL.wiki.parse.date(section_text, true, true);
			needless = date_list.some(function(date) {
				return date > need_archive_date;
			});
		}, {
			slice : slice
		});
		if (needless) {
			return;
		}

		CeL.log('need archive: ' + section_title);
		// 按照存檔時的月份建立、歸入存檔頁面。模板參見{{Saved/auto}}
		var archive_title = page_data.title + '/存档/'
				+ (new Date).format('%Y年%2m月');
		need_change_count++;
		parser[slice[0]] = '{{Saved|link=' + archive_title + '|title='
				+ section_title + '}}\n';
		for (var i = slice[0] + 1; i < slice[1]; i++) {
			// stupid way
			parser[i] = '';
		}

		var archive_header = '{{'
		// 向存檔頁添加檔案館模板
		+ page_data.title.replace(/^[^:]+:/, '') + '页顶/档案馆}}';

		wiki.page(archive_title).edit(function(page_data) {
			var content = CeL.wiki.content_of(page_data);
			content = content && content.trim() || '';

			if (!content.includes(archive_header))
				content = archive_header + content;

			CeL.log('archive to [[' + archive_title
			//
			+ ']]: "' + section_title + '"');
			if (1) {
				CeL.log(content);
				CeL.log('~'.repeat(80));
				CeL.log(section_text.trim());
			}
			return;
			return content + '\n'
			// append 存檔段落(討論串)內容
			+ section_text.trim();
		}, {
			bot : 1,
			summary : '存檔討論串:' + section_title
		});
	});

	if (need_change_count > 0) {
		CeL.log('[[' + page_data.title + ']]: ' + need_change_count
				+ ' sections need change.');

		return;
		// 將標題進行複製、討論內容進行剪切存檔。標記該段落(討論串)為已存檔
		wiki.page(page_data).edit(parser.toString(), {
			bot : 1,
			nocreate : 1,
			summary : '存檔討論串'
		});
	} else {
		CeL.log('[[' + page_data.title + ']]: Nothing need change.');
	}
}
