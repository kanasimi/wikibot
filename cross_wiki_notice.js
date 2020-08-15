/*

 2016/10/23 20:34:46	初版試運行。
 2016/10/27 19:17:15	常態性運行。

 */

'use strict';

globalThis.no_task_date_warning = true;

// Load CeJS library and modules.
require('./wiki loader.js');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'https://zh.moegirl.org.cn/api.php');

// ----------------------------------------------------------------------------

// CeL.set_debug(2);
if (false) {
	wiki.page('User talk:' + owner_name, function(page_data) {
		date_list = CeL.wiki.parse.date(CeL.wiki.content_of(page_data), {
			get_timevalue : true,
			get_all_list : true
		});
		max = Math.max.apply(null, date_list);
		CeL.log(new Date(max));
	});
}

wiki.page('User talk:' + owner_name, function(page_data) {
	if (!CeL.wiki.content_of.page_exists(page_data)) {
		// error?
		return [ CeL.wiki.edit.cancel, '條目已不存在或被刪除' ];
	}

	var revision = CeL.wiki.content_of.revision(page_data),
	//
	user = revision && CeL.wiki.normalize_title(revision.user);
	// console.log(revision);
	if (user === CeL.wiki.normalize_title(owner_name)
	//
	|| user === CeL.wiki.normalize_title(user_name)) {
		return;
	}

	CeL.log('新留言: ' + user + ' @ ' + revision.timestamp);

	var zhwiki = Wiki(true, 'zh');
	zhwiki.page('User talk:' + owner_name, check_talk_page);

	function check_talk_page(page_data) {
		var
		/**
		 * {String}page content, maybe undefined. 條目/頁面內容 = CeL.wiki.revision_content(revision)
		 */
		content = CeL.wiki.content_of(page_data);

		if (content && content.includes(revision.timestamp)) {
			CeL.log('已提醒過此留言。');
			wiki.logout();
			return;
		}

		zhwiki.edit(': ' + user + ' 於 ' + revision.timestamp
				+ ' 在萌娘百科[https://zh.moegirl.org.cn/User_talk:' + owner_name
				+ ' 發了一則新留言] ，煩請撥空前往查看。 --~~~~', {
			section : 'new',
			sectiontitle : '您在moegirl有一則新留言',
			// cross-wiki notification 通知
			summary : '跨wiki新留言提醒',
			nocreate : 1,
			bot : 1
		}, function() {
			wiki.page('User talk:' + owner_name).edit(function(page_data) {
				var
				/**
				 * {String}page content, maybe undefined. 條目/頁面內容 =
				 * CeL.wiki.revision_content(revision)
				 */
				content = CeL.wiki.content_of(page_data);
				if (content) {
					return content.trim()
					//
					+ '\n: 已提醒 [[zhwiki:User talk:' + owner_name
					//
					+ ']]。 --~~~~';
				}
			}, {
				summary : '已作跨wiki留言提醒',
				nocreate : 1,
				bot : 1
			}).logout();
		});
	}

}, {
	rvprop : 'timestamp|user'
});
