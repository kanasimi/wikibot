// (cd ~/wikibot && date && hostname && nohup time node 20160906.archive_moegirl.js; date) >> archive_moegirl/log &

/*

 2016/9/6 18:14:15	初版試營運 公共討論頁的段落(討論串)自動存檔機器人。
 2016/9/15 9:16:56	上路


 手動存檔工具 快速存檔
 https://annangela.moe/JS/AnnTools/quickSave.js
 https://zh.moegirl.org/User:AnnAngela/js#quick-save

 [[Help:沙盒]]

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'https://zh.moegirl.org/api.php');

wiki.page('Talk:讨论版', for_board).page('Talk:提问求助区', for_board);

var
// 每天一次掃描：每個話題(討論串)最後一次回復的10日後進行存檔處理；
// 討論串10日無回復，則將標題進行複製、討論內容進行剪切存檔。
// 在「兩討論區」中，保留標題、內容存檔的討論串，其標題將於每月1日0時刪除。
need_archive_10 = Date.now() - 10 * 24 * 60 * 60 * 1000,
// NG: 申請擔任巡查員的討論串，將於提權且歡迎結束的3日（即72小時）後進行存檔。
// NG: 申請升職管理員的討論串，將於投票結束且討論結束的3日（即72小時）後進行存檔。
need_archive_3 = Date.now() - 3 * 24 * 60 * 60 * 1000,
// 每月1號：刪除所有{{saved}}提示模板。
remove_old_notice_section = (new Date).getDate() === 1;

function for_board(page_data) {
	var need_change_count = 0;

	var parser = CeL.wiki.parser(page_data), sections = [];
	parser.each('section_title', function(token, index) {
		if (token.level !== 2) {
			return;
		}
		// 先找出所有 sections 的 index of parser。
		sections.push(index);
		console.log('[' + index + ']	' + sections.length.pad(2) + '. '
				+ token.title);
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
			if (remove_old_notice_section) {
				need_change_count++;
				for (var i = slice[0] - 1; i < slice[1]; i++) {
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
		parser[slice[0]] = '\n{{Saved|link=' + archive_title + '|title='
				+ CeL.wiki.normalize_section_title(section_title) + '}}\n';
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

			if (!content.includes(archive_header)) {
				content = archive_header + '\n' + content;
			}

			CeL.log('archive to [[' + archive_title
			//
			+ ']]: "' + section_title + '"');
			if (false) {
				CeL.log(content);
				CeL.log('~'.repeat(80));
				CeL.log(section_text.trim());
			}
			return;
			return content + '\n\n== ' + section_title + ' ==\n'
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

		// 將標題進行複製、討論內容進行剪切存檔。標記該段落(討論串)為已存檔
		wiki.page(page_data).edit(parser.toString(), {
			bot : 1,
			nocreate : 1,
			summary : '存檔討論串: 更動' + need_change_count + '章節'
		});
	} else {
		CeL.log('[[' + page_data.title + ']]: Nothing need change.');
	}
}
