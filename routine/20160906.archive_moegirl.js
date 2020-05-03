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
/** {Array}討論區列表 */
board_list = [], board_left,
/** {String}存檔頁面 postfix */
archive_page_postfix = '/存档/%Y年%2m月',
/** {String} 存檔作業[[Special:tags]] "tag應該多加一個【Bot】tag" */
tags = 'Bot|快速存档讨论串',
/** {Array}標記已完成討論串的模板別名列表 */
resolved_template_aliases = [ 'MarkAsResolved' ],
/** {Number}archive-offset 默認為3天 */
resolved_template_default_days = 3,
// 最快`MIN_archive_offset`天才會存檔
MIN_archive_offset = 1,

// 已存檔討論串數量上限。每當已存檔的討論串數量到達`max_archived_topics`時，每新增一個存檔討論串就移除一個已存檔討論串。
max_archived_topics,

/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'https://zh.moegirl.org/api.php'),
/** {Number}一整天的 time 值。should be 24 * 60 * 60 * 1000 = 86400000. */
ONE_DAY_LENGTH_VALUE = new Date(0, 0, 2) - new Date(0, 0, 1),
// 每天一次掃描：每個話題(討論串)最後一次回復的10日後進行存檔處理；
// 討論串10日無回復，則複製標題、剪切存檔討論內容。
// 在「兩討論區」中，保留標題、內容存檔的討論串，於每月1日0時刪除討論串。
archive_boundary_10 = Date.now() - 10 * ONE_DAY_LENGTH_VALUE,
// NG: 申請擔任巡查員的討論串，將於提權且歡迎結束的3日（即72小時）後進行存檔。
// NG: 申請升職管理員的討論串，將於投票結束且討論結束的3日（即72小時）後進行存檔。
archive_boundary_3 = Date.now() - 3 * ONE_DAY_LENGTH_VALUE,
// 每月1號：刪除所有{{Saved}}提示模板。
monthly_remove_old_notice_section = (new Date(Date.now()
// to UTC+0
+ (new Date).getTimezoneOffset() * 60 * 1000
// Use UTC+8
+ 8 * 60 * 60 * 1000)).getUTCDate() === 1;

// console.log(monthly_remove_old_notice_section);
// monthly_remove_old_notice_section = true;
// CeL.set_debug(2);

wiki.run(main_process);

function main_process() {
	var configuration = wiki.latest_task_configuration
			&& wiki.latest_task_configuration.general;
	// console.log(wiki.task_configuration);
	if (configuration) {
		CeL.info('Configuration:');
		console.log(configuration);
		if (Array.isArray(configuration.board_list))
			board_list = configuration.board_list;
		if (configuration.tags) {
			tags = Array.isArray(configuration.tags) ? configuration.tags
					.join('|')
			// assert: typeof tags === 'string'
			: configuration.tags;
		}
		archive_page_postfix = configuration.archive_page_postfix
				|| archive_page_postfix;
		resolved_template_aliases = configuration.resolved_template_aliases
				|| resolved_template_aliases;
		if (+configuration.resolved_template_default_days >= MIN_archive_offset)
			resolved_template_default_days = +configuration.resolved_template_default_days;
		if (+configuration.max_archived_topics >= 1)
			max_archived_topics = +configuration.max_archived_topics;
	}
	// console.log(board_list);
	// console.log(tags);
	// return;

	// board_list = [ 'Talk:提问求助区' ];
	board_left = board_list.length;
	board_list.forEach(function(board) {
		wiki.page(board, for_board);
	});
}

function for_board(page_data) {
	// 更動 counter
	var archive_count = 0, remove_count = 0;

	var parsed = CeL.wiki.parser(page_data), sections = [];
	if (CeL.wiki.content_of(page_data) !== parsed.toString()) {
		// debug 用. check parser, test if parser working properly.
		throw 'Parser error: ' + CeL.wiki.title_link_of(page_data);
	}

	// 按照存檔時的月份建立、歸入存檔頁面。模板參見{{Saved/auto}}
	var archive_title = page_data.title
			+ (new Date).format(archive_page_postfix);

	// archived_topic_list = [ topic_slice, topic_slice, ... ]
	var archived_topic_list = [];

	var to_exit = parsed.each.exit;

	function for_each_topic(topic_token, section_index) {
		if (section_index === 0) {
			// first_section = section;
			// Skip the first / lead section
			return;
		}

		var section_title = topic_token.section_title;
		if (section_title.level !== 2) {
			return;
		}

		// section_title.toString(true): get inner
		var section_title_text = section_title.toString(true).trim();
		var section_text = topic_token.toString().trim();

		var section_anchor = section_title.link[1];
		var needless = undefined;

		CeL.debug('Process ' + section_title_text + ' (' + section_text.length
				+ ' chars)', 1);

		// 當內容過長的時候，可能是有特殊的情況，就不自動移除。已調高上限。
		if (section_text.length < 200
		// 跳過已存檔 {{Saved}}, {{Movedto}}, {{MovedTo}}, {{Moved to}}
		&& /^{{(?:Saved|Moved ?to)\s*\|.{5,200}?}}\n*$/i
		// {5,200}: e.g., "討論:標題"
		.test(section_text)) {
			archived_topic_list.push(topic_token.range);
			return;
		}

		topic_token.each('template', function(token, index) {
			// https://zh.moegirl.org/Template:MarkAsResolved
			// 2020年3月3日 →
			// 您仍可以繼續在本模板上方回覆，但這個討論串將會在本模板懸掛3日後 (於2020年3月7日凌晨) 存檔。
			if (resolved_template_aliases.includes(token.name)) {
				// console.log(token);
				var matched = token.parameters.time
						&& token.parameters.time
								.match(/^(\d{4})(\d{2})(\d{2})$/);
				if (!matched) {
					if (token.parameters.time) {
						CeL.error(section_title_text + ': 無法辨識 time 參數: '
								+ token.parameters.time);
					}
					return;
				}
				// 機器人只讀得懂`archive-offset=數字`的情況
				var boundary_date = +token.parameters['archive-offset'];
				if (!(boundary_date >= MIN_archive_offset))
					boundary_date = resolved_template_default_days;
				boundary_date = Date.parse(matched[1] + '-' + matched[2] + '-'
						+ matched[3] + ' UTC+8')
						// +1: {{#expr:{{{archive-offset|3}}} + 1}} days}}
						+ (boundary_date + 1) * ONE_DAY_LENGTH_VALUE;
				// console.log([ section_title_text, boundary_date, Date.now()
				// ]);
				needless = Date.now() < boundary_date;
				if (false) {
					CeL.log('[' + section_title_text + ']: 存檔 @ '
							+ new Date(boundary_date) + ' ('
							+ (needless ? 'needless' : 'need') + ')');
				}
			}
		});

		if (needless === undefined) {
			// 所有日期戳記皆在此 archive_boundary_date 前，方進行存檔。
			// CeL.log(index+': '+new Date(latest));
			// 都做成10天存檔
			var archive_boundary_date = false && /申请|巡查员|管理员/
					.test(section_title_text) ? archive_boundary_3
					: archive_boundary_10;

			topic_token.each('text', function(token, index) {
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
				if (needless) {
					return to_exit;
				}
			});

			if (needless === undefined) {
				// 經查本對話串中沒有一般型式的一般格式的日期，造成無法辨識。下次遇到這樣的問題，可以在最後由任何一個人加上本討論串已終結、準備存檔的字樣，簽名並且'''加上一般日期格式'''即可。
				CeL.warn('跳過一個日期文字都沒有的討論串 [' + section_title_text
						+ ']，這不是正常的情況。');
				return;
			}
		}

		if (needless) {
			CeL.info('** needless archive: [' + section_title_text + ']');
			return;
		}

		// console.log(needless);
		CeL.log('need archive: [' + section_title_text + ']');
		archive_count++;
		parsed[topic_token.range[0]] = '\n{{Saved|link=' + archive_title
		// TODO: 依照目標頁面的狀態修正同名討論串的 anchor
		+ '|title=' + section_anchor + '}}\n';
		for (var index = topic_token.range[0] + 1; index < topic_token.range[1]; index++) {
			// stupid way
			parsed[index] = '';
		}
		// return;

		CeL.debug('把本需要存檔的議題段落 [' + section_title_text + '] 寫到存檔頁面 '
				+ CeL.wiki.title_link_of(archive_title) + '。');
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
				return content + '\n\n== ' + section_title_text
				// append 存檔段落(討論串)內容
				+ ' ==\n' + section_text;
			}

			return [ CeL.wiki.edit.cancel, 'skip' ];

		}, {
			bot : 1,
			tags : tags,
			summary : '向存檔頁添加檔案館模板'

		}).edit(function(page_data) {
			CeL.log('archive to ' + CeL.wiki.title_link_of(archive_title)
			//
			+ ': "' + section_title_text + '"');
			if (false) {
				CeL.log('~'.repeat(80));
				CeL.log(section_title_text + section_text);
			}
			// return;
			return section_text;

		}, {
			bot : 1,
			tags : tags,
			// append 存檔段落(討論串)內容
			section : 'new',
			// 章節標題。
			sectiontitle : section_title_text,
			summary : CeL.wiki.title_link_of(
			//
			wiki.task_configuration.configuration_page_title,
			//
			'存檔過期討論串') + ': ' + section_title_text
			//
			+ '←' + CeL.wiki.title_link_of(page_data)
		});
	}

	parsed.each_section(for_each_topic);

	archived_topic_list.total_count = archived_topic_list.length;
	// monthly_remove_old_notice_section: 每月1號：刪除所有{{Saved}}提示模板。
	while (archived_topic_list.length > (monthly_remove_old_notice_section ? 0 :
	// 不移除當天存檔者，除非執行第二次。
	// + archive_count: 移除當天存檔者
	max_archived_topics)) {
		var topic_slice = archived_topic_list.shift();
		// parsed[topic_slice[0] - 1] : section title
		for (var index = topic_slice[0] - 1; index < topic_slice[1]; index++) {
			// stupid way
			parsed[index] = '';
		}
		remove_count++;
	}

	// return;

	CeL.debug('移除需要存檔的議題段落。');
	if (archive_count > 0 || remove_count > 0) {
		var summary_list = [];
		if (remove_count > 0) {
			summary_list.push((monthly_remove_old_notice_section ? '本月首日'
					: '已存檔' + archived_topic_list.total_count
							+ '個討論串，超過存檔討論串數量上限' + max_archived_topics + '，')
					+ '移除' + remove_count + '個已存檔討論串');
		}
		if (archive_count > 0) {
			summary_list.push('存檔' + archive_count + '個過期討論串→'
					+ CeL.wiki.title_link_of(archive_title));
		}
		summary_list = summary_list.join('，');
		// sections need change
		CeL.log(CeL.wiki.title_link_of(page_data.title) + ': ' + summary_list);
		// return;

		CeL.debug('將討論串進行複製、討論內容進行剪切存檔。標記該段落(討論串)為已存檔: '
				+ CeL.wiki.title_link_of(page_data));
		wiki.page(page_data).edit(parsed.toString(), {
			bot : 1,
			nocreate : 1,
			tags : tags,
			summary : CeL.wiki.title_link_of(
			//
			wiki.task_configuration.configuration_page_title,
			//
			'存檔討論串') + ': ' + summary_list
		}, check_board_left);
	} else {
		CeL.log(CeL.wiki.title_link_of(page_data.title)
				+ ': Nothing needs to change.');
		check_board_left();
	}
}

function check_board_left() {
	if (--board_left === 0)
		routine_task_done('1d');
}
