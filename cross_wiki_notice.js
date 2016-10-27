/*

 2016/10/23 20:34:46	初版試運行。
 2016/10/27 19:17:15	常態性運行。

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'https://zh.moegirl.org/api.php');

// ----------------------------------------------------------------------------

// CeL.set_debug(2);
if (false) {
	wiki.page('User talk:Kanashimi', function(page_data) {
		date_list = CeL.wiki.parse.date(CeL.wiki.content_of(page_data), true,
				true);
		max = Math.max.apply(null, date_list);
		CeL.log(new Date(max));
	});
}

wiki.page('User talk:' + owner_name, function(page_data) {
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
		 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
		 */
		content = CeL.wiki.content_of(page_data);

		if (content && content.includes(revision.timestamp)) {
			CeL.log('已提醒過此留言。');
			wiki.logout();
			return;
		}

		zhwiki.edit(': ' + user + ' 於 ' + revision.timestamp
				+ ' 在萌娘百科[https://zh.moegirl.org/User_talk:' + owner_name
				+ ' 發了一則新留言] ，煩請撥空前往查看。 --~~~~', {
			section : 'new',
			sectiontitle : '您在moegirl有一則新留言',
			summary : 'cross-wiki 新留言提醒',
			nocreate : 1,
			bot : 1
		}, function() {
			wiki.page('User talk:' + owner_name).edit(function(page_data) {
				var
				/**
				 * {String}page content, maybe undefined. 條目/頁面內容 =
				 * revision['*']
				 */
				content = CeL.wiki.content_of(page_data);
				if (content) {
					return content.trim() + '\n: 已提醒 [[zhwiki:User talk:' + owner_name + ']]。 --~~~~';
				}
			}, {
				summary : '已作 cross-wiki 留言提醒',
				nocreate : 1,
				bot : 1
			}).logout();
		});
	}

}, {
	rvprop : 'timestamp|user'
});
