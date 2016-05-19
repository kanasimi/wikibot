// cd ~/wikibot && date && time /shared/bin/node 20160517.解消済み仮リンクを自動的に削除して.js && date

/*

 [[:ja:Wikipedia:井戸端/subj/解消済み仮リンクを自動的に削除して]]

 @see
 https://github.com/liangent/mediawiki-maintenance/blob/master/cleanupILH_DOM.php

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');
// for CeL.wiki.cache(), CeL.fs_mkdir()
CeL.run('application.platform.nodejs');
// 在非 Windows 平台上避免 fatal 錯誤。
CeL.env.ignore_COM_error = true;
// load module for CeL.CN_to_TW('简体')
CeL.run('extension.zh_conversion');

var
/** {String}本次任務使用的語言。 */
use_language = 'ja';

// Set default language. 改變預設之語言。
CeL.wiki.set_language(use_language);

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),
/** {String}base directory */
base_directory = bot_directory + script_name + '/';

var
/** {Natural}所欲紀錄的最大筆數。 */
log_limit = 200,
//
count = 0, length = 0,
// ((Infinity)) for do all
test_limit = 3,
//
ill2_list = [];

// ----------------------------------------------------------------------------

prepare_directory(base_directory);

// CeL.set_debug(2);

function for_each_page(page_data, messages) {
	var template_count = 0,
	/** {String}page title = page_data.title */
	title = CeL.wiki.title_of(page_data), changed;
	// console.log(CeL.wiki.content_of(page_data));

	function for_each_template(token, index, parent) {
		function check(_changed) {
			if (_changed) {
				changed = true;
			} else if (token.error) {
				CeL.log(token.error);
				if (token.message)
					CeL.log(token.message);
			}
			if (--template_count > 0 || !changed)
				return;

			var last_content = parser.toString();
			if (CeL.wiki.content_of(page_data) !== last_content)
				wiki.page(page_data)
				// .edit(last_content)
				;
		}

		function for_local_page(title) {
			if (!title) {
				// 日本語版項目自体存在しないので、パス。
				token.error = 'missing local';
				token.message = token.toString();
				check();
				return;
			}

			if (title !== parameters[1].toString()) {
				// 日本語版項目名が違う記事なので、パス。
				token.error = 'different local title';
				token.message = [ parameters[1].toString(), title ];
				check();
				return;
			}

			parent[index] = '[[' + title + ']]';
			check(true);
		}

		function for_foreign_page(foreign_page_data) {
			if ('missing' in foreign_page_data) {
				// 他言語版記事自体存在しないので、パス。
				token.error = 'missing foreign';
				token.message = token.toString();
				check();
				return;
			}

			if ('disambiguation' in foreign_page_data.pageprops) {
				// 他言語版項目リンク先が曖昧さ回避ページなので、パス。
				token.error = 'disambiguation';
				check();
				return;
			}

			if (foreign_page_data.title !== parameters[3].toString()) {
				// 他言語版項目リンク先が違う記事なので、パス。
				token.error = 'different foreign title';
				token.message = [ parameters[3].toString(),
						foreign_page_data.title ];
				check();
				return;
			}

			CeL.wiki.langlinks([ parameters[2].toString(),
			// check the Interlanguage link.
			parameters[3].toString() ], for_local_page, use_language);

		}

		// template_name
		if (token.name === '仮リンク'
		// || token.name === 'ill2'
		// || token.name === 'link-interwiki'
		) {
			template_count++;
			// {{仮リンク|記事名|en|title}}
			token.page_data = page_data;
			ill2_list.push(token);
			console.log(token);
			var parameters = token.parameters;

			CeL.wiki.page([ parameters[2].toString(),
			//
			parameters[3].toString() ], for_foreign_page, {
				redirects : 1,
				query_props : 'pageprops'
			});
		}
	}

	var parser = CeL.wiki.parser(page_data).parse();
	parser.each('template', for_each_template);
}

CeL.wiki.cache([ {
	type : 'categorymembers',
	list : 'Category:解消済み仮リンクを含む記事',
	operator : function(list) {
		this.list = list;
	}

}, false && {
	// 使用 cache page 此法速度過慢!
	type : 'page'

} ], function() {
	var list = this.list;
	CeL.log('Get ' + list.length + ' pages.');
	list = list.slice(0, test_limit);
	CeL.log(list.slice(0, 8).map(function(page_data) {
		return CeL.wiki.title_of(page_data);
	}).join('\n'));

	wiki.work({
		no_edit : true,
		each : for_each_page

	}, list);

}, {
	// default options === this
	namespace : 0,
	// [SESSION_KEY]
	session : wiki,
	// title_prefix : 'Template:',
	// cache path prefix
	prefix : base_directory
});
