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
	// 每天一次掃描：每個話題(討論串)最後一次回復的10日後進行存檔處理；
	var need_archive_10 = Date.now() - 10 * 24 * 60 * 60 * 1000,
	//
	need_archive_3 = Date.now() - 3 * 24 * 60 * 60 * 1000,
	//
	is_day_1_of_month = (new Date).getDate() === 1;

	function for_sections(section_text, index) {
		// 跳過首段
		if (index === 0)
			return;

		var section_title = this.title[index];
		if (!section_title) {
			CeL.err('No title: ' + section_text);
			return;
		}

		// 跳過已存檔
		if (section_text.length < 300
				&& /^==[^=\n]+==\n{{(?:Saved|movedto)\s*\|.{10,200}?}}\n+$/i
						.test(section_text)) {
			// 每月1號：刪除所有{{saved}}提示模板。
			if (is_day_1_of_month) {
				this[index] = '';
			}
			return;
		}

		var date_list = CeL.wiki.parse.date(section_text, true),
		// earliest = Math.min.apply(null, date_list),
		latest = Math.max.apply(null, date_list);
		if (!latest) {
			CeL.err(index + ' error: ' + section_title);
			throw section_title;
		}
		// CeL.log(index+': '+new Date(latest));
		var need_archive_date = section_title.includes('申请')
				&& (section_title.includes('巡查员') || section_title
						.includes('管理员')) ? need_archive_3 : need_archive_10;
		if (latest > need_archive_date) {
			CeL.log(Math.ceil((latest - need_archive_date)
					/ (24 * 60 * 60 * 1000))
					+ ' days: ' + section_title);
			return;
		}

		CeL.log('need archive: ' + section_title);
		// 按照存檔時的月份建立、歸入存檔頁面。模板參見{{Saved/auto}}
		var archive_title = page_data.title + '/存档/'
				+ (new Date).format('%Y年%2m月');
		this[index] = this[index].replace(/^(=[^=\n]+=\n)[\s\S]*$/, '$1')
				+ '{{Saved|link=' + archive_title + '|title=' + section_title
				+ '}}\n';
		wiki.page(archive_title).edit(function(page_data) {
			var content = CeL.wiki.content_of(page_data);
			content = content && content.trim()
			// 向存檔頁添加檔案館模板
			|| '{{提问求助区页顶/档案馆}}';
			return content + '\n'
			// append 存檔段落(討論串)內容
			+ section_text.trim().replace(/^==[^=\n]+==\n+/, '');
		}, {
			bot : 1,
			summary : '存檔討論串:' + section_title
		});
	}

	page_data.sections.forEach(for_sections, page_data.sections);
	// 將標題進行複製、討論內容進行剪切存檔。標記該段落(討論串)為已存檔
	wiki.page(page_data).edit(page_data.sections.toString(), {
		bot : 1,
		nocreate : 1
	});
}
