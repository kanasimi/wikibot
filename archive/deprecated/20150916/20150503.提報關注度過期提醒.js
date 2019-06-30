// cd /d D:\USB\cgi-bin\program\wiki && node 20150503.提報關注度過期提醒.js

/*

 2015/7/21 22:26:22 上路前修正
 2015/7/22 13:19:51 完善

 */

require('./wiki loader.js');

CeL.run([ 'interact.DOM', 'application.debug', 'application.net.wiki' ]);

// 一整天的 time 值。should be 24 * 60 * 60 * 1000 = 86400000.
var ONE_DAY_LENGTH_VALUE = new Date(0, 0, 2) - new Date(0, 0, 1),
//
wiki = Wiki(true), summary = '提報關注度過期提醒',
// 確保關注度模板已掛上足夠長（至少30日）的時間
limit_days = 30,
//
message_set = {
	notified : '已提醒用戶',
	not_notified : '未提醒用戶',
	do_not_notify : '用戶不想接受關注度提醒',
	no_user_talk : '無用戶對話頁面',
	bots_denied : '用戶以bots模板封鎖通知',
	redirected : '條目已重定向',
	deleted : '條目已刪除'
},
// {{Personal announcement|content=請勿在討論頁中加入關注度、動員令訊息}}
PATTERN_DO_NOT_NOTIFY = /勿(?:在討論頁中?)?[加放]入關注度/i,
// 提報關注度頁面中符合此 pattern 者將被 skip。
PATTERN_SKIP = /於\d+天前提報/,
// 運作記錄存放頁面。
log_to = 'User:cewbot/log/20150503',
// 提報關注度頁面 [[WP:NP]], [[Wikipedia:關注度/提報]]
notability_report = 'Wikipedia:关注度/提报';

CeL.log('開始處理 ' + summary + ' 作業', true);

// CeL.set_debug(4);
wiki
// 取得提報關注度頁面內容。
.page(notability_report, function(page_data) {
	var id_pages = Object.create(null), user_denied = Object.create(null),
	// page_status[title] = [ line index of content, status ]
	page_status = Object.create(null), notified_pages = Object.create(null),
	//
	content = CeL.wiki.content_of(page_data),
	//
	last_title;
	if (!content)
		throw new Error('No contents get!');
	content = content.split(/\r?\n/);

	// 一行行分析提報關注度頁面。
	content.forEach(function(line, index) {
		// 單一條目僅處理(提醒)一次。skip 已處理條目。
		if (PATTERN_SKIP.test(line)) {
			if (last_title) {
				notified_pages[last_title] = true;
				if (last_title in page_status)
					delete page_status[last_title];
			}
			return;
		}

		var token = CeL.wiki.template_token(line, 'Findsources');
		if (!token)
			// 無提報資料。
			return;

		last_title = token[2][0];
		if (!last_title || (last_title in notified_pages))
			// 不合理或已處理過之 title。
			return;

		var days = (Date.now() - CeL.wiki.parse.date(line
				.slice(token.lastIndex)))
				/ ONE_DAY_LENGTH_VALUE | 0;
		if (days < limit_days)
			// 時限未到。
			return;

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
			wiki.page('User_talk:' + user, function(page_data) {
				var content = CeL.wiki.content_of(page_data), denied;
				if (false)
					CeL.log('test [' + page_data.title + ']: '
							+ (content && content.slice(0, 200)));
				user_denied[user] = content ? PATTERN_DO_NOT_NOTIFY
						.test(content)
				// [[WP:AFD]]
				? message_set.do_not_notify : (denied = CeL.wiki.edit.denied(
						content, wiki.token.lgname, 'afd'))
						&& (message_set.bots_denied + ': ' + denied)
						: message_set.no_user_talk;
				if (user_denied[user])
					CeL.log(user_denied[user] + ': ' + user);
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
		each : function(content, title, messages, page) {
			// console.log('page_status[' + title + ']:');
			// console.log(page_status[title]);
			if (!page_status[title]) {
				// 或許是 title 在 wikipedia 正規化過程中被改變了。
				// e.g., 'http://' → 'Http://'
				CeL.error('Title altered: ' + title);
			} else if (CeL.wiki.parse.redirect(content))
				page_status[title][1] = message_set.redirected;
			else if ('missing' in page)
				page_status[title][1] = message_set.deleted;
			return [ CeL.wiki.edit.cancel, 'skip' ];
		},
		after : function(messages, pages, titles) {
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
						message += '|' + status;
					if (status !== message_set.deleted) {
						if (!user_denied[user])
							page_list.push(title);
						user_messages.push('{{Notability-talk|'
						// 
						+ message + '}}');
					}
					content[page_status[title][0]]
					//
					+= '\n: <span style="color:#298;">於'
					// 須同時更改 PATTERN_SKIP!!
					+ id_pages[user][title] + '天前提報，'
					//
					+ (status === message_set.deleted ? message_set.deleted
					//
					: user_denied[user]
					//
					|| message_set.notified + '[[User:' + user + '|]]')
					//
					+ '。</span> --~~~~';
				});

				if (page_list.length === 0) {
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
				// 提醒個別用戶，作出通知。
				wiki.page('User_talk:' + user)
				// {{Notability-talk}}此模板前面會自動加上分行，後面須自行加上簽名。參數2將視作對提刪條目之簡單說明，如「條目已重定向」。
				.edit(user_messages.join('\n') + ' --~~~~', {
					section : 'new',
					sectiontitle : summary + ':' + page_list.join('、'),
					summary : 'bot: ' + summary,
					// redirect 常會出現 editconflict
					// redirect : 1,
					nocreate : 1
				});
			});

			// 最終將處理結果寫入提報關注度頁面。
			wiki.page(notability_report).edit(content.join('\n'), {
				summary : 'bot: ' + summary + '處理結果',
				nocreate : 1
			});

			messages.unshift(messages.length
			//
			+ ' 用戶 @ ' + (new Date).format('%4Y%2m%2d'));
			// 將報告結果寫入 log 頁面。
			wiki.page(log_to).edit(messages.join('\n'), {
				section : 'new',
				sectiontitle : summary + ' ' + (new Date).format('%Y%2m%2d'),
				summary : 'bot: ' + summary + '報告',
				bot : 1,
				// redirect : 1,
				nocreate : 1
			});
		},
		log_to : false
	}, pages);
});
