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
set_language('zh');

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

	if ('namespace' in options) {
		action += '&lntnamespace=' + (CeL.namespace(options.namespace) || 0);
	}
	action += '&lntlimit=' + (options.limit || ('max' && 2));
	if (options.from >= 0) {
		action += '&lntfrom=' + options.from;
	}

	CeL.wiki.query(action, function for_error_list(data, error) {
		data.query.linterrors.forEach(for_lint_error);
	}, null, {
		// [KEY_SESSION]
		session : wiki
	});
}

function for_lint_error(error_data) {
	console.log(error_data);
}
