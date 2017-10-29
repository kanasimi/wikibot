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
	action += '&lntlimit=' + (options.limit || ('max' && 400));
	if (options.from >= 0) {
		action += '&lntfrom=' + options.from;
	}

	wiki.query_API(action, function for_error_list(data, error) {
		data.query.linterrors.forEach(function(lint_error_page) {
			if (lint_error_page.templateInfo.name
			// 問題出在transclusion的模板，而不是本page。
			|| ('multiPartTemplateBlock' in lint_error_page.templateInfo)) {
				return;
			}
			// console.log(lint_error_page);
			wiki.page(lint_error_page).edit(for_lint_error, {
				summary : 'ウィキ文法修正: '
				// 画像オプション
				+ '[[Special:LintErrors/bogus-image-options|問題のある文件設定]]',
				bot : 1,
				minor : 1,
				nocreate : 1
			});
		});
	});
}

var
/** {Number}未發現之index。 const: 基本上與程式碼設計合一，僅表示名義，不可更改。(=== -1) */
NOT_FOUND = ''.indexOf('_');

// wring → right
var typo = {
	// TODO: use edit distance
	rihgt : 'right',
	light : 'right',
	ight : 'right',
	righ : 'right',
	rigth : 'right',
	rigtht : 'right',
	rightt : 'right',
	nono : 'none',

	uplight : 'upright'
};

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

	var file_text = content.slice(page_data.location[0], page_data.location[1]), file_link = CeL.wiki
			.parse(file_text), bad_items = page_data.params.items;
	CeL.log(CeL.wiki.title_link_of(page_data) + ': ' + file_link + ' -- '
			+ JSON.stringify(bad_items));
	if (file_link.type !== 'file' || file_text !== file_link.toString()) {
		CeL.log(file_text);
		CeL.log('-'.repeat(80));
		CeL.log(file_link.toString());
		console.log(file_link);
		delete page_data.revision;
		console.log(page_data);
		throw (file_text !== file_link.toString() ? 'Parser error: '
				: 'file_link.type = ' + file_link.type + ' !== "file": ')
				+ CeL.wiki.title_link_of(page_data);
	}

	// console.log(file_link);

	var _this = this;

	function register_option(index, message) {
		var file_option = file_link[index].toString();
		if (message) {
			message += ':' + file_option.trim();
			// CeL.info('register_option: ' + message);
			_this.summary += ' ' + message;
		}
		var _index = bad_items.indexOf(file_option);
		if (_index === NOT_FOUND) {
			CeL.info('Delete additional option: '
			//
			+ JSON.stringify(file_option));
		} else {
			bad_items.splice(_index, 1);
		}
	}

	var items_fixed = [];

	// file_link: [ file namespace, section_title,
	// parameters 1, parameters 2, parameters..., caption ]
	for (var index = 2; index < file_link.length; index++) {
		var file_option = file_link[index].toString().trim();
		if (false) {
			CeL.info('Check [' + index + '/' + file_link.length + ']: '
					+ JSON.stringify(file_option));
		}

		// 刪除掉一定是錯的選項。

		if (file_option === ''
		// 最後一個空白被視為不輸入 caption。
		&& index < file_link.length - 1) {
			register_option(index, '刪除空的檔案選項');
			file_link.splice(index--, 1);
			continue;
		}

		// 刪除掉重複的選項。

		if (index + 1 < file_link.length) {
			if (false) {
				CeL.log('Find ' + JSON.stringify(file_option) + ' in:');
				console.log(file_link.slice(index + 1));
			}

			var check_list = file_link.slice(index + 1);
			// 向後搜尋是否有相同的，跳過 caption，不檢查 caption。
			if (check_list.some(function(option, _index) {
				option = option.toString().trim();
				if (false) {
					CeL.log('Check: [' + _index + '/' + (check_list.length - 1)
							+ ']' + option);
				}

				return _index === check_list.length - 1
				// caption 包含本 option
				// e.g., [[File:...|ABC|ABC DEF]]
				? option.covers(file_option)
				// 重複的檔案選項。
				// e.g., [[File:...|right|right|...]]
				: option === file_option;
			})) {
				register_option(index, '刪除重複的檔案選項');
				file_link.splice(index--, 1);
				continue;
			}

			// 去掉類別重複的檔案選項: 每種類別只能設定一個值，多出來沒有作用的應該刪掉。
			var type = CeL.wiki.file_options[file_option];
			if (type) {
				if (false) {
					CeL.info(type + ': ' + file_link[type] + ' vs. '
							+ file_option);
				}
				if (file_link[type] !== file_option) {
					register_option(index, '去掉類別重複的檔案選項');
					file_link.splice(index--, 1);
					continue;
				}
			}
		}

		// 這幾個必須要設定指定的值。
		if (file_option in {
			link : true,
			alt : true,
			lang : true
		}) {
			register_option(index, '刪除指定值的檔案選項');
			file_link.splice(index--, 1);
			continue;
		}

		if (index < file_link.length - 1
		// ↑ 不檢查 caption。
		&& !(file_option in CeL.wiki.file_options)
		// e.g., [[File:name.jpg|name|.jpg]]
		&& file_link[0].toString().covers(file_option)) {
			register_option(index, '刪除與檔名重複的檔案選項');
			file_link.splice(index--, 1);
			continue;
		}

		// 測試其他可以判別的檔案選項。採取白名單原則，只改變能夠判別的以避免誤殺。

		var matched = file_option
				// 不可以篩到 200px 之類!
				.match(/^(?:(?:\d{1,3})? *[xX*])? *(?:\d{1,3})(?: *(?:PX|pix|[oO][xX]))?$/);
		if (matched) {
			register_option(index, '為數值選項加上"px"');
			file_link[index] = file_option.replace(/ /g, '').replace(
					/PX|[oO][xX]/, '')
					+ 'px';
			continue;
		}
		if (file_option !== '' && !isNaN(file_option)) {
			CeL.warn('Invalid number: ' + file_option);
			continue;
		}

		matched = file_option.match(/^(width|height) *= *(\d+)(?: *px)?$/i);
		if (matched) {
			register_option(index, '將尺寸選項改為正規形式');
			if (matched[1].toLowerCase() === 'width') {
				// e.g., "width=200"
				file_link[index] = matched[2] + 'px';
			} else {
				// height
				file_link[index] = 'x' + matched[2] + 'px';
			}
			continue;
		}

		if (file_option in typo) {
			register_option(index, '修正"' + typo[file_option] + '"之誤植');
			file_link[index] = typo[file_option];
			continue;
		}

		if (file_option === 'float' && file_link.type) {
			// e.g., [[File:i.png|float|right|thumb|...]]
			register_option(index, '修正CSS式格式設定');
			file_link.splice(index--, 1);
			continue;
		}

		var changed = false;
		file_option = file_option.replace(
		// 經測試，等號前方不可有空格。
		/^(link|alt|lang|page|thumb|thumbnail) +=/, function(all, option_name) {
			changed = true;
			register_option(index, '修正等號前方不的空格');
			return option_name + '=';
		});
		if (changed) {
			file_link[index] = file_option;
		}

	}

	file_link = file_link.toString();
	if (file_text === file_link) {
		CeL.info('No change: ' + file_text);
	} else {
		var message = [ [ '', file_text ],
				[ '→ ', file_link + ' (' + _this.summary + ')' ] ];
		CeL.log(CeL.display_align(message));
	}
	if (bad_items.length > 0) {
		CeL.warn('Bad item left: ' + JSON.stringify(bad_items));
	}

	return;
	return content.slice(0, page_data.location[0]) + file_link
			+ content.slice(page_data.location[1]);
}
