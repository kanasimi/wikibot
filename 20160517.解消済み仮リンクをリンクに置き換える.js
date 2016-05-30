// cd ~/wikibot && date && time /shared/bin/node 20160517.解消済み仮リンクをリンクに置き換える.js && date

/*

 [[:ja:Wikipedia:井戸端/subj/解消済み仮リンクを自動的に削除して]]
 2016/5/20 22:22:41	仮運用を行って

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

// Set default language. 改變預設之語言。
set_language('ja');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),

// ((Infinity)) for do all
test_limit = 200;

// ----------------------------------------------------------------------------

prepare_directory(base_directory);

// CeL.set_debug(2);

function for_each_page(page_data, messages) {
	var template_count = 0,
	/** {String}page title = page_data.title */
	title = CeL.wiki.title_of(page_data), changed = [];
	// console.log(CeL.wiki.content_of(page_data));

	function for_each_template(token, index, parent) {
		function check(_changed) {
			if (_changed) {
				if (!changed.includes(_changed)) {
					changed.push(_changed);
					CeL.log('Adapt [[' + page_data.title + ']]: '
							+ token.toString() + ' → ' + _changed);
				}

			} else if (token.error && token.error !== 'missing local') {
				CeL.log(token.error + ': ' + token.toString());
				if (token.message)
					CeL.log(String(token.message));
			}

			CeL.debug('template_count: ' + template_count, 4);
			if (--template_count > 0 || changed.length === 0)
				return;

			var last_content = parser.toString();
			if (CeL.wiki.content_of(page_data) === last_content) {
				CeL.warn('The contents are the same.');
				return;
			}

			if (false) {
				CeL.log('[[' + page_data.title + ']]: ');
				CeL.log(last_content);
				return;
			}
			wiki.page(page_data
			// && 'Wikipedia:サンドボックス'
			)
			//
			.edit(last_content, {
				// section : 'new',
				// sectiontitle : 'Sandbox test section',
				summary : 'bot test: 解消済み仮リンク'
				//
				+ changed.join('、') + 'を内部リンクに置き換える',
				nocreate : 1,
				bot : 1
			});
		}

		function for_local_page(title) {
			if (!title) {
				// 日本語版項目自体存在しないので、パス。
				token.error = 'missing local';
				token.message = token.toString();
				check();
				return;
			}

			if (title !== local_title) {
				if (parameters.label && parameters.label !== local_title) {
					// 日本語版項目名が違う記事なので、パス。
					token.error = 'different local title';
					token.message = ': parameter: [[' + local_title
							+ ']]\n: translated: [[' + title + ']]';
					check();
					return;
				}

				// {{仮リンク|譲渡性個別割当制度|en|Individual fishing quota}}
				// → [[漁獲可能量|譲渡性個別割当制度]]
				parameters.label = local_title;
			}

			// TODO: preserve=1 {{enlink}}

			var link = '[[' + title;
			if (parameters.label && parameters.label !== title) {
				link += '|' + parameters.label;
			} else if (/\([^()]+\)$/.test(title)) {
				// e.g., [[title (type)]] → [[title (type)|title]]
				// 在 <gallery> 中，"[[title (type)|]]" 無效，因此需要明確指定。
				link += '|' + title.replace(/\s*\([^()]+\)$/, '');
			}
			link += ']]';
			// 實際改變頁面結構。
			parent[index] = link;
			check(link);
		}

		function for_foreign_page(foreign_page_data) {
			if (!foreign_page_data || ('missing' in foreign_page_data)) {
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

			if (foreign_page_data.title !== foreign_title) {
				// 他言語版項目リンク先が違う記事なので、パス。
				// should be redirected.
				CeL.log('different foreign title: [[:' + foreign_language + ':'
						+ foreign_title + ']] → [[:' + foreign_language + ':'
						+ foreign_page_data.title + ']] (continue task)');
				foreign_title = foreign_page_data.title;
			}

			CeL.wiki.langlinks([ foreign_language,
			// check the Interlanguage link.
			foreign_title ], for_local_page, use_language);

		}

		function to_String(parameter) {
			parameter = parameters[parameter];
			// normalize
			return parameter
					&& parameter.toString().replace(/<!--.+?-->/g, '').trim();
		}

		// template_name
		// @see
		// https://ja.wikipedia.org/w/index.php?title=%E7%89%B9%E5%88%A5:%E3%83%AA%E3%83%B3%E3%82%AF%E5%85%83/Template:%E4%BB%AE%E3%83%AA%E3%83%B3%E3%82%AF&namespace=10&limit=500&hidetrans=1&hidelinks=1
		if (token.name.toLowerCase() in {
			'仮リンク' : true,
			'ill2' : true,
			'illm' : true,
			'link-interwiki' : true
		}) {
			token.page_data = page_data;
			// console.log(token);
			var parameters = token.parameters,
			// {{仮リンク|記事名|en|title}}
			local_title = to_String(1),
			//
			foreign_language = to_String(2),
			//
			foreign_title = to_String(3);

			if (local_title && foreign_language && foreign_title) {
				template_count++;
				CeL.wiki.page([ foreign_language, foreign_title ],
				//
				for_foreign_page, {
					// TODO: test REDIRECT [[title#section]]
					redirects : 1,
					query_props : 'pageprops'
				});
			} else {
				CeL.log('for_each_page: Invalid template @ [[' + title + ']]: '
						+ token.toString());
			}
		}
	}

	var parser = CeL.wiki.parser(page_data).parse();
	if (CeL.wiki.content_of(page_data) !== parser.toString()) {
		throw 'Parser error: [[' + title + ']]';
	}
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
