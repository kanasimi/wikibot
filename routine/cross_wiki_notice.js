/*

 2016/10/23 20:34:46	初版試運行。
 2016/10/27 19:17:15	常態性運行。
 2021/5/6 6:54:33	for multi wikis

 */

'use strict';

globalThis.no_task_date_warning = true;

// Load CeJS library and modules.
require('../wiki loader.js');

var zhwiki = Wiki(true, 'zh');

// ----------------------------------------------------------------------------

notice_wiki('https://zh.moegirl.org.cn/api.php');
notice_wiki('https://lingualibre.org/api.php');

function notice_wiki(API_URL) {

	var
	/** {Object}wiki operator 操作子. */
	wiki = Wiki(true, API_URL);

	// CeL.set_debug(2);
	if (false) {
		wiki.page('User talk:' + login_options.owner_name, function(page_data) {
			date_list = CeL.wiki.parse.date(CeL.wiki.content_of(page_data), {
				get_timevalue : true,
				get_all_list : true
			});
			max = Math.max.apply(null, date_list);
			CeL.log(new Date(max));
		});
	}

	wiki.run(function() {
		wiki.page('User talk:' + login_options.owner_name,
		//
		for_each_foreign_talk_page.bind({
			wiki : wiki
		}), {
			rvprop : 'timestamp|user'
		});
	});
}

function for_each_foreign_talk_page(page_data) {
	if (!CeL.wiki.content_of.page_exists(page_data)) {
		// error?
		return [ CeL.wiki.edit.cancel, '條目已不存在或被刪除' ];
	}

	var revision = this.revision = CeL.wiki.content_of.revision(page_data),
	//
	user = this.user = revision && CeL.wiki.normalize_title(revision.user);
	// console.log(revision);
	if (user === CeL.wiki.normalize_title(login_options.owner_name)
	// login_options.user_name → wiki_session.token.login_user_name
	|| user === this.wiki.token.login_user_name) {
		return;
	}

	CeL.log('新留言: ' + user + ' @ ' + revision.timestamp);

	zhwiki.page('User talk:' + login_options.owner_name,
			check_foreign_talk_page.bind(this));

}

function check_foreign_talk_page(page_data) {
	var wiki = this.wiki;
	var revision = this.revision;
	var user = this.user;

	var
	/**
	 * {String}page content, maybe undefined. 條目/頁面內容 =
	 * CeL.wiki.revision_content(revision)
	 */
	content = CeL.wiki.content_of(page_data);

	if (content && content.includes(revision.timestamp)) {
		CeL.log('已提醒過此留言。');
		wiki.logout();
		return;
	}

	zhwiki.edit(': ' + user + ' 於 ' + revision.timestamp
	//
	+ ' 在 ' + wiki.configurations.sitename
	//
	+ ' [' + wiki.URL_of_page('User talk:' + login_options.owner_name)
	//
	+ ' 發了一則新留言] ，煩請撥空前往查看。 --~~~~', {
		section : 'new',
		sectiontitle : '您在 ' + wiki.configurations.sitename + ' 有一則新留言 '
				+ (new Date).format('%Y-%2m-%2d'),
		// cross-wiki notification 通知
		summary : '跨 wiki 新留言提醒',
		nocreate : 1,
		bot : 1
	}, function() {
		wiki.page('User talk:' + login_options.owner_name)
		//
		.edit(function(page_data) {
			var
			/**
			 * {String}page content, maybe undefined. 條目/頁面內容 =
			 * CeL.wiki.revision_content(revision)
			 */
			content = CeL.wiki.content_of(page_data);
			if (content) {
				return content.trim()
				//
				+ '\n: 已提醒 [[zhwiki:User talk:'
				//
				+ login_options.owner_name + ']]。 --~~~~';
			}
		}, {
			summary : '已作跨 wiki 留言提醒',
			nocreate : 1,
			bot : 1
		}).logout();
	});
}
