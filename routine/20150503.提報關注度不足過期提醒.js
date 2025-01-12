﻿// cd /d D:\USB\cgi-bin\program\wiki && node 20150503.提報關注度不足過期提醒.js
// 提報關注度不足過期提醒 notability reminder

/*

 2015/7/21 22:26:22	上路前修正。
 2015/7/22 13:19:51	完善
 2015/9/19 11:20:48	v2:清空((delete_days))天前提報不符合關注度指引/關注度不足的條目，以保持頁面整潔。
 2015/10/24–25 不提醒已經提刪的。

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// CeL.run([ 'interact.DOM', 'application.debug', 'application.net.wiki' ]);

var
/** {Natural}確保關注度不足模板已掛上足夠長（至少30日）的時間。 */
limit_days = 30,
/**
 * 移除((delete_days))日或以前之提報以保持頁面整潔。<br />
 * assert: 1 ≤ limit_days ≤ delete_days
 * 
 * @type {Natural}
 */
delete_days = 35,
/** {Object}L10n messages. 符合當地語言的訊息內容。 */
message_set = {
	notified : '已提醒',
	not_notified : '未提醒用戶',
	do_not_notify : '用戶不想接受關注度不足提醒',
	no_user_talk : '無用戶對話頁面',
	bots_denied : '用戶以bots模板封鎖通知',
	redirected : '條目已重定向',
	// 此條目已被提交存廢討論。已經先提刪了。
	proposed : '條目已掛上提刪模板',
	// 包括繁簡轉換被刪除之例。
	deleted : '條目已刪除'
},
// e.g., {{Personal announcement|content=請勿在討論頁中加入關注度、動員令訊息}}
PATTERN_DO_NOT_NOTIFY = /請?勿(?:在討論頁?中?)?[加放]入關注度/i,
// 提報關注度不足頁面中符合此 pattern 者將被 skip。
// 本bot會以此判斷是否已提報過。若您需要手動提報，可在{{tl|Findsources}}條目後手動加上此註記，即可自動跳過提醒。
PATTERN_SKIP = /於\d{1,2}(?:\.\d+)?天前提報|已經?(?:手動|通知|提醒)/,
// 提報關注度不足頁面 [[WP:NP]], [[Wikipedia:關注度/提報]]
// 2025/1 [[Wikipedia:互助客栈/方针#提議將WP:關注度改名]]: [[Wikipedia:关注度/提报]] → [[Wikipedia:收錄標準/提報]]
notability_report = 'Wikipedia:收錄標準/提報',
// 從第一個出現{{Findsources}}的line刪除到第一個未過期的line。
// 但這需要保證所有提報皆按時間順序由舊到新，且執行中不可改變 index。
移除過期_start_line, 移除過期_end_line,
// [ , last date title ]
空白日章節_PATTERN = /\n===\s*(?:\d+月)?\d+日\s*===[\s\n]*?\n(===\s*(?:\d+月)?\d+日\s*===|==\s*\d+月\s*==)[\s\n]*?\n/g,
// [ , last date title ]
空白月章節_PATTERN = /\n==\s*\d+月\s*==[\s\n]*?\n(==\s*\d+月\s*==|=\s*\d+年\s*=)[\s\n]*?\n/g,
// [ , last date title ]
空白年章節_PATTERN = /\n=\s*\d+年\s*=[\s\n]*?\n(=\s*\d+年\s*=)[\s\n]*?\n/g,
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),
// copy from data.date.
/** {Number}一整天的 time 值。should be 24 * 60 * 60 * 1000 = 86400000. */
ONE_DAY_LENGTH_VALUE = new Date(0, 0, 2) - new Date(0, 0, 1);

CeL.log('開始處理 ' + summary + ' 作業');

// CeL.set_debug(4);
// 取得提報關注度不足頁面內容並且處理。
wiki.page(notability_report, report_notability, {
	redirects : 1
});

function report_notability(page_data) {
	var id_pages = Object.create(null), user_denied = Object.create(null),
	// page_status[title] = [ line index of content, status ]
	page_status = Object.create(null), notified_pages = Object.create(null),
	// 關注度不足提報頁面內容 contents
	關注度不足提報頁面內容 = CeL.wiki.content_of(page_data),
	//
	last_title;
	if (!關注度不足提報頁面內容)
		throw new Error('No contents get!');
	關注度不足提報頁面內容 = 關注度不足提報頁面內容.split(/\r?\n/);

	CeL.debug('一行行分析提報關注度不足頁面。');
	關注度不足提報頁面內容.forEach(function(line, index) {
		// 單一條目僅處理(提醒)一次。skip 已處理條目。
		if (PATTERN_SKIP.test(line)) {
			if (last_title) {
				notified_pages[last_title] = true;
				if (last_title in page_status)
					delete page_status[last_title];
			}
			return;
		}

		var token = CeL.wiki.parse.template(line, 'Findsources');
		if (!token) {
			// 本 line 無提報資料。
			return;
		}

		if (isNaN(移除過期_start_line))
			移除過期_start_line = index;

		last_title = token[2][1];
		if (!last_title) {
			// 不合理之 title。
			return;
		}
		if (last_title in notified_pages) {
			CeL.log('重複提報關注度不足/已處理過 title: [[' + last_title + ']]。');
			return;
		}

		var days = (Date.now() - CeL.wiki.parse.date(line
				.slice(token.lastIndex)))
				/ ONE_DAY_LENGTH_VALUE | 0;
		if (days < limit_days)
			// 時限未到。
			return;
		if (delete_days <= days)
			移除過期_end_line = index;

		var user = CeL.wiki.parse.user(line.slice(token.lastIndex));
		if (!user) {
			CeL.error('No user specified: [' + line + ']');
			return;
		}
		CeL.debug(days + ' days: [[' + last_title + ']] by ' + user, 2);

		if (!(user in id_pages)) {
			// 初始化 user。
			id_pages[user] = Object.create(null);
			// 在 wiki.work() 前檢測完所有 user talk。
			wiki.page('User talk:' + user, function(page_data) {
				/** {String}page content, maybe undefined. */
				var content = CeL.wiki.content_of(page_data, 'header'), denied;
				if (false) {
					CeL.log('test [[' + page_data.title + ']]: '
							+ (content && (', ' + content.slice(0, 200))));
				}
				user_denied[user] = content
				//
				? (denied = content.match(PATTERN_DO_NOT_NOTIFY))
				//
				? message_set.do_not_notify + ': ' + denied[0]
				// [[WP:AFD]]
				: (denied = CeL.wiki.edit.denied(content,
						wiki.token.login_user_name, 'AFD'))
						&& (message_set.bots_denied + ': ' + denied)
						: message_set.no_user_talk;
				if (user_denied[user])
					CeL.log(user_denied[user] + ': ' + user);
			}, {
				redirects : 1,
				flow_view : 'header'
			});
		}
		// 登記。
		id_pages[user][last_title] = days;
		page_status[last_title] = [ index ];
	});

	// ------------------------------------------------------------------------

	var users = Object.keys(id_pages),
	//
	pages = Object.keys(page_status);
	CeL.log(users.length + ' users, ' + pages.length + ' pages @ queue.');

	wiki.work({
		each : function(page_data, messages) {
			var title = page_data.title;
			if (false) {
				CeL.log('page_status[' + title + ']:');
				CeL.log(page_status[title]);
			}
			if (!page_status[title]) {
				// 或許是 title 在 wikipedia 正規化過程中被改變了。
				// e.g., 'http://' → 'Http://'
				CeL.error('Title altered: ' + title);
			} else if (!CeL.wiki.content_of.page_exists(page_data))
				page_status[title][1] = message_set.deleted;
			else {
				/** {String}page content, maybe undefined. */
				var content = CeL.wiki.content_of(page_data), matched;
				if (CeL.wiki.parse.redirect(content))
					page_status[title][1] = message_set.redirected;
				else if (matched = CeL.wiki.parse.template(content,
						'vfd|afd|rfd|ffd|tfd|mfd')) {
					// 已經提刪的就不再提醒提報者。
					matched = (matched = matched[2].date)
							&& /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(matched) ? '/'
							+ matched : '';
					// add link to 頁面存廢討論
					page_status[title][1] = '[[WP:頁面存廢討論/記錄' + matched + '#'
							+ title + '|' + message_set.proposed + ']]';
				}
			}
			// 僅作檢測，不改變任何條目。
			return [ CeL.wiki.edit.cancel, 'skip' ];
		},
		after : function(messages, pages) {
			// reset messages.
			messages.length = 0;
			// 對每位用戶一頁頁處理。
			users.forEach(function(user) {
				var page_list = [], user_messages = [];
				Object.keys(id_pages[user])
				// 一頁頁處理。
				.forEach(function(title) {
					var message = title,
					//
					status = page_status[title];
					if (!status)
						// skip 已處理條目。
						return;
					if (status = status[1])
						// 參數2將視作對提刪條目之簡單說明，如「條目已重定向」。
						message += '|' + status;
					/** 重新構建提報關注度不足過期提醒頁面。 */
					// 2015/10/24–2016/1/12的處理方法是在bot執行檢查時，[[Special:Diff/37255825|條目已經刪除/不存在頁面直接清除]]，不作提醒。
					// 但有時頁面狀態與提刪不同步，因此會出問題。[[Special:Diff/38732798/38738338|亦有可能是掛模版的條目有任何原因被移動，然後原條目因題目格式問題被刪]]。
					// 是故即使條目已經刪除，還是需要保留。
					if (false && (status === message_set.deleted
					// [[Special:Diff/37825761|如果目標是個重定向也直接清除不處理]]。
					|| status === message_set.redirected)) {
						// 無須提醒的情況。會把[[Wikipedia:關注度/提報]]中的提報紀錄給刪掉。
						// 執行中不可改變 index，因此僅設為空。
						關注度不足提報頁面內容[page_status[title][0]] = '';

					} else {
						var
						/** {Boolean}此為無須提醒之條目。 */
						no_notice = status && (status === message_set.deleted
						//
						|| status.includes(message_set.proposed));

						if (!user_denied[user] && !no_notice)
							page_list.push(title);
						// 若是最後反正必須通知，則一併加入 no_notice 的條目。
						// 不加 ":" 的話，在多個提醒同列時，會擠在一起不分行。
						user_messages.push(': {{Notability-talk|'
						//
						+ message + '}}');

						關注度不足提報頁面內容[page_status[title][0]]
						//
						+= '\n: <span style="color:#298;">於'
						// 須同時更改 PATTERN_SKIP!!
						+ (id_pages[user][title] | 0) + '天前提報，'
						//
						+ (no_notice ? status : user_denied[user]
						// [[User:]], [[用戶:' + user + ']]
						// [[Special:Diff/40279223]]
						|| message_set.notified + '用戶:' + user)
						//
						+ '。</span> --~~~~';
					}
				});

				if (page_list.length === 0) {
					// 無條目須提醒。
					if (false)
						messages.push('Skip user ' + user + ': No page left.');
					if (user_denied[user])
						messages.push('* [[User_talk:' + user
						//
						+ '|]]: <span style="color:#888;">'
						//
						+ user_denied[user] + '</span>');
					return;
				}

				messages.push('* [[User_talk:' + user + '|]]: '
				//
				+ page_list.join('<span style="color:#777;">、</span>'));
				var edit_options = {
					// for .page()
					redirects : 1,

					// 若您不想接受關注度提醒，請利用{{bots|optout=afd}}模板。
					notification_name : 'afd',
					section : 'new',
					sectiontitle : summary + ':' + page_list
					// 避免繁簡轉換「劉杰叡」變成「劉傑叡」
					// Flow 沒有辦法使用語言轉換，還是別用好了。
					// .map(function(page_title){return '-{'+page_title+'}-';})
					.join('、'),
					summary : 'bot: ' + summary,
					// tags : 'user talk page editing',
					// redirect 常會出現 editconflict
					// redirect : 1,
					nocreate : 1
				};
				// 提醒個別用戶，作出通知。
				wiki.page('User talk:' + user, edit_options)
				// {{Notability-talk}}此模板前面會自動加上分行，對非WP:Flow頁面，後面須自行加上簽名。
				.edit(user_messages.join('\n') + ' --~~~~', edit_options);
			});

			var user_count = messages.length;

			var edit_options = {
				// for .page()
				redirects : 1,

				summary : 'bot: ' + summary + '處理結果',
				bot : 1,
				nocreate : 1
			};
			// 最終將處理結果寫入提報關注度不足頁面。
			wiki.page(notability_report, edit_options).edit(
					關注度不足提報頁面內容.join('\n'), edit_options);
			if (0 <= 移除過期_start_line && 移除過期_start_line < 移除過期_end_line
			// 未做空白章節test，會造成僅僅有空白章節時，卻不會被消掉。但這還是會在下次有東西消除時除去。
			// || 空白日章節_PATTERN.test(關注度不足提報頁面內容.join('\n'))
			) {
				messages.push('移除過期關注度不足提報頁面內容: ' + 移除過期_start_line + '–'
						+ 移除過期_end_line + '/' + 關注度不足提報頁面內容.length + '行');
				var date_mark = [];
				關注度不足提報頁面內容.splice(移除過期_start_line,
						移除過期_end_line - 移除過期_start_line)
				// 從被切掉的部分找尋最接近的日期標記，留下最新的。
				.forEach(function(line) {
					var matched = line.endsWith('=') && line.match(/^=+/);
					// 僅擷取章節 title。
					if (matched)
						date_mark[matched[0].length - 1] = line;
				});
				date_mark = date_mark.join('\n').trim().replace(/\n{2,}/g, '');
				if (date_mark) {
					CeL.debug('插入切掉部分的章節 title:\n' + date_mark, 2);
					關注度不足提報頁面內容.splice(移除過期_start_line, 0, date_mark);
				}
				CeL.debug('清理空白無用/重複之日期章節。');
				關注度不足提報頁面內容 = 關注度不足提報頁面內容.join('\n')
				// 移除無用之日章節。
				.replace(空白日章節_PATTERN, '\n$1\n')
				// 移除無用之月章節。
				.replace(空白月章節_PATTERN, '\n$1\n')
				// 移除無用之年章節。
				.replace(空白年章節_PATTERN, '\n$1\n');
				CeL.debug('關注度不足提報頁面內容:\n' + 關注度不足提報頁面內容.slice(0, 600), 2);
				var edit_options = {
					// for .page()
					redirects : 1,

					summary : 'bot: 清空' + delete_days
					//
					+ '天前提報關注度不足的條目，以保持頁面整潔。',
					bot : 1,
					nocreate : 1
				};
				wiki.page(notability_report, edit_options).edit(關注度不足提報頁面內容,
						edit_options);
			}

			messages.unshift(user_count + ' 用戶 @ '
					+ (new Date).format('%4Y%2m%2d'));
			var edit_options = {
				// for .page()
				redirects : 1,

				section : 'new',
				sectiontitle : summary + ' ' + (new Date).format('%Y%2m%2d'),
				summary : 'bot: ' + summary + '報告',
				bot : 1,
				// redirect : 1,
				nocreate : 1,
				// 就算設定停止編輯作業，仍強制編輯。一般僅針對自己的頁面，例如寫入 log。
				skip_stopped : true
			};
			// 將報告結果寫入 log 頁面。
			wiki.page(log_to, edit_options).edit(messages.join('\n'),
					edit_options);
		},
		log_to : false
	}, pages);
}
