// (cd ~/wikibot && date && hostname && nohup time node 20160906.archive_moegirl.js; date) >> archive_moegirl/log &

/*

 2016/9/6 18:14:15	初版試營運 公共討論頁的段落(討論串)自動存檔機器人。
 2016/9/15 9:16:56	正式上路營運


 手動存檔工具 快速存檔
 https://annangela.moe/JS/AnnTools/quickSave.js
 https://zh.moegirl.org/User:AnnAngela/js#quick-save

 [[Help:沙盒]]

 萌娘百科 萬物皆可萌的百科全書
 似乎有設置最短 login 時間間隔?

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'https://zh.moegirl.org/api.php'),
/** {Number}一整天的 time 值。should be 24 * 60 * 60 * 1000 = 86400000. */
ONE_DAY_LENGTH_VALUE = new Date(0, 0, 2) - new Date(0, 0, 1),
// [[Special:tags]] "tag應該多加一個【Bot】tag"
tags = 'Bot|快速存档讨论串',
// 每天一次掃描：每個話題(討論串)最後一次回復的10日後進行存檔處理；
// 討論串10日無回復，則將標題進行複製、討論內容進行剪切存檔。
// 在「兩討論區」中，保留標題、內容存檔的討論串，其標題將於每月1日0時刪除。
archive_boundary_10 = Date.now() - 10 * ONE_DAY_LENGTH_VALUE,
// NG: 申請擔任巡查員的討論串，將於提權且歡迎結束的3日（即72小時）後進行存檔。
// NG: 申請升職管理員的討論串，將於投票結束且討論結束的3日（即72小時）後進行存檔。
archive_boundary_3 = Date.now() - 3 * ONE_DAY_LENGTH_VALUE,
// 每月1號：刪除所有{{Saved}}提示模板。
remove_old_notice_section = (new Date(Date.now()
// to UTC+0
+ (new Date).getTimezoneOffset() * 60 * 1000
// Use UTC+8
+ 8 * 60 * 60 * 1000)).getUTCDate() === 1;

// remove_old_notice_section = true;
// CeL.set_debug(2);

[ 'Talk:讨论版', 'Talk:提问求助区' ].forEach(function(board) {
	wiki.page(board, for_board);
});

function for_board(page_data) {
	// 更動 counter
	var archive_count = 0, remove_count = 0;

	var parser = CeL.wiki.parser(page_data), sections = [];
	if (CeL.wiki.content_of(page_data) !== parser.toString()) {
		// debug 用. check parser, test if parser working properly.
		throw 'Parser error: ' + CeL.wiki.title_link_of(page_data);
	}

	parser.each('section_title', function(token, index) {
		if (token.level !== 2) {
			return;
		}
		// 先找出所有 sections 的 index of parser。
		sections.push(index);
		CeL.debug('[' + index + ']	' + sections.length.pad(2) + '. '
				+ token.title);
	}, false, 1);

	// 按照存檔時的月份建立、歸入存檔頁面。模板參見{{Saved/auto}}
	var archive_title = page_data.title + '/存档/' + (new Date).format('%Y年%2m月');

	sections.forEach(function(parser_index, section_index) {
		// console.log(parser[parser_index]);
		var section_title = parser[parser_index].join('').trim(),
		// +1: 跳過 section title 本身
		slice = [ parser_index + 1,
				sections[section_index + 1] || parser.length ],
		//
		section_text = Array.prototype.slice.apply(parser, slice).join('');
		if (!section_title) {
			CeL.error('No title: ' + section_text);
			return;
		}
		CeL.debug('Process ' + section_title + ' (' + section_text.length
				+ ' chars)');

		// 當內容過長的時候，可能是有特殊的情況，就不自動移除。已調高上限。
		if (section_text.length < 150
				// 跳過已存檔{{Saved}}, {{Movedto}}
				&& /^\n*{{(?:[Ss]aved|[Mm]ovedto)\s*\|.{10,200}?}}\n+$/
						.test(section_text)) {
			// 每月1號：刪除所有{{Saved}}提示模板。
			if (remove_old_notice_section) {
				remove_count++;
				for (var i = slice[0] - 1; i < slice[1]; i++) {
					// stupid way
					parser[i] = '';
				}
			}
			return;
		}

		var section_anchor = parser[parser_index].link[1];
		var needless = undefined;
		parser.each('template', function(token, index) {
			// https://zh.moegirl.org/Template:MarkAsResolved
			// 您仍可以繼續在本模板上方回復，但這個討論串將會在本模板懸掛3日後 (於2020年3月6日) 被存檔。
			if (token.name in {
				标记为完成 : true,
				MAR : true,
				MarkAsResolved : true
			}) {
				// console.log(token);
				var date = token.parameters.time
						&& token.parameters.time
								.match(/^(\d{4})(\d{2})(\d{2})$/);
				if (!date)
					return;
				date = Date.parse(date[1] + '-' + date[2] + '-' + date[3])
						+ (token.parameters['archive-offset']
						// archive-offset 可以省略（默認為3天）
						|| 3) * ONE_DAY_LENGTH_VALUE;
				// console.log([Date.now(), date]);
				needless = Date.now() < date;
				if (1 || false) {
					CeL.log('[' + section_title + ']: 存檔 @ ' + new Date(date)
							+ ' (' + (needless ? 'needless' : 'need') + ')');
				}
			}
		}, {
			slice : slice
		});

		if (needless === undefined) {
			// 所有日期戳記皆在此 archive_boundary_date 前，方進行存檔。
			// CeL.log(index+': '+new Date(latest));
			// 都做成10天存檔
			var archive_boundary_date = false
					&& section_title.includes('申请')
					&& (section_title.includes('巡查员') || section_title
							.includes('管理员')) ? archive_boundary_3
					: archive_boundary_10;

			parser.each('text', function(token, index) {
				if (needless) {
					return;
				}
				var date_list = CeL.wiki.parse.date(token.toString(), {
					get_timevalue : true,
					get_all_list : true
				});
				CeL.debug('[' + token.toString()
				//
				+ '] → date_list: ' + date_list, 4);
				CeL.debug(token, 3);
				if (date_list.length === 0) {
					// 跳過一個日期都沒有的討論串
					return;
				}
				needless = date_list.some(function(date) {
					return date > archive_boundary_date;
				});
			}, {
				slice : slice
			});

			if (needless === undefined) {
				// 經查本對話串中沒有一般型式的一般格式的日期，造成無法辨識。下次遇到這樣的問題，可以在最後由任何一個人加上本討論串已終結、準備存檔的字樣，簽名並且'''加上一般日期格式'''即可。
				CeL.warn('跳過一個日期文字都沒有的討論串 [' + section_title + ']，這不是正常的情況。');
				return;
			}
		}

		if (needless) {
			CeL.info('** needless archive: [' + section_title + ']');
			return;
		}

		// console.log(needless);
		CeL.log('need archive: [' + section_title + ']');
		archive_count++;
		parser[slice[0]] = '\n{{Saved|link=' + archive_title + '|title='
				+ section_anchor + '}}\n';
		for (var i = slice[0] + 1; i < slice[1]; i++) {
			// stupid way
			parser[i] = '';
		}
		// return;

		// 把本需要存檔的議題段落寫到存檔頁面。
		// TODO: 錯誤處理
		wiki.page(archive_title).edit(function(page_data) {
			var content = CeL.wiki.content_of(page_data);
			// CeL.log(content);
			content = content && content.trim() || '';

			var archive_header = '{{'
			// 去掉前綴
			+ page_data.title.replace(/^[^:]+:/, '')
			// 向存檔頁頂端添加檔案館模板。
			.replace(/\/.+/, '页顶/档案馆') + '}}';

			if (!content.includes(archive_header)) {
				content = (archive_header + '\n' + content).trim();
				return content;
			}

			if (false) {
				return content + '\n\n== ' + section_title
				// append 存檔段落(討論串)內容
				+ ' ==\n' + section_text.trim();
			}

		}, {
			bot : 1,
			tags : tags,
			summary : '向存檔頁添加檔案館模板'

		}).edit(function(page_data) {
			CeL.log('archive to ' + CeL.wiki.title_link_of(archive_title)
			//
			+ ': "' + section_title + '"');
			if (false) {
				CeL.log('~'.repeat(80));
				CeL.log(parser[parser_index].toString() + section_text.trim());
			}
			// return;
			return section_text.trim();

		}, {
			bot : 1,
			tags : tags,
			// append 存檔段落(討論串)內容
			section : 'new',
			// 章節標題。
			sectiontitle : section_title,
			summary : '存檔過期討論串:' + section_title
			//
			+ '←' + CeL.wiki.title_link_of(page_data)
		});
	});
	// return;

	// 移除需要存檔的議題段落。
	if (archive_count > 0 || remove_count > 0) {
		var summary_list = [];
		if (remove_count > 0) {
			// 每月首日當天存檔者不會被移除，除非當天執行第二次。
			summary_list.push('本月首日移除' + remove_count + '個討論串');
		}
		if (archive_count > 0) {
			summary_list.push('存檔' + archive_count + '個過期討論串→'
					+ CeL.wiki.title_link_of(archive_title));
		}
		summary_list = summary_list.join('，');
		// sections need change
		CeL.log(CeL.wiki.title_link_of(page_data.title) + ': ' + summary_list);
		// return;

		// 將標題進行複製、討論內容進行剪切存檔。標記該段落(討論串)為已存檔
		wiki.page(page_data).edit(parser.toString(), {
			bot : 1,
			nocreate : 1,
			tags : tags,
			summary : '存檔討論串: ' + summary_list
		});
	} else {
		CeL.log(CeL.wiki.title_link_of(page_data.title)
				+ ': Nothing needs to change.');
	}
}
