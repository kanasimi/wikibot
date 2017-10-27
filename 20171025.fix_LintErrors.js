/*

	初版試營運。


@see
[[Special:LintErrors]]
https://www.mediawiki.org/wiki/Help:Extension:Linter
https://www.mediawiki.org/w/api.php?action=help&modules=query%2Blinterrors

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

/* eslint no-use-before-define: ["error", { "functions": false }] */
/* global CeL */
/* global Wiki */

// Set default language. 改變預設之語言。 e.g., 'zh'
// 採用這個方法，而非 Wiki(true, 'ja')，才能夠連報告介面的語系都改變。
set_language('ja');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true);

/** {String}編輯摘要。總結報告。 */

// ----------------------------------------------------------------------------
// CeL.set_debug(6);
get_linterrors('bogus-image-options', for_lint_error, {});

function get_linterrors(category, for_lint_error, options) {
	options = CeL.setup_options(options);

	var action = 'query&list=linterrors&lntcategories=' + category;

	action += '&lntnamespace=' + (CeL.wiki.namespace(options.namespace) || 0);
	action += '&lntlimit=' + (options.limit || ('max' && 20));
	if (options.from >= 0) {
		action += '&lntfrom=' + options.from;
	}

	wiki.query_API(action, function for_error_list(data, error) {
		data.query.linterrors.forEach(function(lint_error_page) {
			if (lint_error_page.templateInfo.name) {
				// 問題出在transclusion的模板，而不是本page。
				return;
			}
			// console.log(lint_error_page);
			wiki.page(lint_error_page, for_lint_error);
		});
	});
}

function for_lint_error(page_data) {
	/** {String}page title = page_data.title */
	var title = CeL.wiki.title_of(page_data),
	/**
	 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
	 */
	content = CeL.wiki.content_of(page_data);

	if (!content) {
		return [
				CeL.wiki.edit.cancel,
				'No contents: ' + CeL.wiki.title_link_of(page_data)
						+ '! 沒有頁面內容！' ];
	}

	CeL.log(CeL.wiki.title_link_of(page_data) + ': '
			+ content.slice(page_data.location[0], page_data.location[1])
			+ ' -- ' + JSON.stringify(page_data.params.items));
}
