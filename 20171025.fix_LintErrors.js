/*

	初版試營運。


@see
[[Special:LintErrors]]
https://en.wikipedia.org/wiki/Wikipedia:Picture_tutorial
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
summary = use_language === 'zh' ? '修正維基語法: [[Special:LintErrors/bogus-image-options|有問題的檔案選項]]'
		// 文件設定の修正
		: 'ウィキ文法修正: [[Special:LintErrors/bogus-image-options|間違った画像オプション]]';
// summary = 'bot test: ' + summary;

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

			// TODO: 一次取得多個個頁面的內容。
			wiki.page(lint_error_page, {
				rvprop : 'content|timestamp|ids'
			}).edit(for_lint_error, {
				summary : summary,
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

// use edit distance
var options_to_test = 'upright,right,left,thumb,none,middle'.split(','),
// 有效選項別名 alias: alias → official name 正式名稱
file_option_alias = {
	// https://de.wikipedia.org/wiki/Hilfe:Bilder#Miniatur
	de : {
		mini : 'thumb',
		miniatur : 'thumb',
		hochkant : 'upright'
	},

	zh : {
		缩略图 : 'thumb',
		有框 : 'frame',
		左 : 'left',
		右 : 'right'
	},

	'' : {
		float : 'thumb',
		small : 'thumb'
	}
}, local_option_alias = file_option_alias[use_language] || CeL.null_Object(), foreign_option_alias = CeL
		.null_Object(),
// edit distance 過大者
// wring → right
typo = {
	rghigt : 'right',
	'valign=center' : 'center',
	central : 'center'
};

for ( var language_code in file_option_alias) {
	if (language_code !== use_language) {
		var option_alias = file_option_alias[language_code];
		for ( var alias in option_alias) {
			foreign_option_alias[alias] = [ language_code, option_alias[alias] ];
		}
	}
}

if (false) {
	for ( var key in typo) {
		var value = typo[key];
		CeL.log(key + ' vs ' + value + ': ' + CeL.edit_distance(key, value));
	}
}

// https://en.wikipedia.org/wiki/Wikipedia:Extended_image_syntax
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
		if (Date.now() - Date.parse(page_data.revisions[0].timestamp) < 60 * 60 * 1000) {
			return [ CeL.wiki.edit.cancel, '可能是剛剛才做過變更，LintErrors 資料庫還沒有來得及更新？' ];
		}

		CeL.log('='.repeat(80));
		CeL.log('file_text:\n' + file_text);
		CeL.log('-'.repeat(80));
		CeL.log('file_link:\n' + file_link.toString());
		console.log(file_link);
		delete page_data.revisions;
		console.log(page_data);
		throw (file_text !== file_link.toString() ? 'Parser error: '
				: 'file_link.type = "' + file_link.type + '" !== "file": ')
				+ CeL.wiki.title_link_of(page_data);
	}

	// console.log(file_link);

	var _this = this;

	function register_option(index, message) {
		var file_option = file_link[index].toString();
		if (message) {
			message += ':' + JSON.stringify(file_option.trim());
			// CeL.info('register_option: ' + message);
			if (false)
				_this.summary += ' [{{fullurl:' + CeL.wiki.title_of(page_data)
						+ '|action=edit&oldid=' + page_data.revisions[0].revid
						+ '&lintid=' + page_data.lintId + '}} ' + message + ']';
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
		var file_option = file_link[index].toString().trim(),
		//
		file_option_is_not_caption = !file_link.caption
		// 不檢查 caption。
		|| file_option !== file_link.caption.toString().trim();
		if (false) {
			CeL.info('Check [' + index + '/' + file_link.length + ']: '
					+ JSON.stringify(file_option));
		}

		// ------------------------------------------------
		// 刪除掉一定是錯的選項。

		if (file_option === ''
		// 最後一個空白被視為不輸入 caption。
		// 但是經過測試，最後一個為空白時也可以刪掉。
		// && index < file_link.length - 1
		) {
			register_option(index, '刪除空檔案選項');
			file_link.splice(index--, 1);
			continue;
		}

		if (file_option in {
			// 這些絕不可被拿來當作描述。
			links : true,
			size : true,
			align : true,
			position : true,
			'default' : true,
			caption : true

		} || file_option_is_not_caption
		//
		&& (file_option.length === 1 && file_option.charCodeAt(0) < 256
		// e.g., "]"
		|| /^[\[\]!@#$%^&*()_+=~`{}<>,.?\\\/]+$/.test(file_option))
				&& bad_items.includes(file_option)) {
			// 非正規且無效的格式設定
			register_option(index, '刪除未規範且無效的檔案選項');
			file_link.splice(index--, 1);
			continue;
		}

		// ------------------------------------------------
		// 測試其他可以判別的檔案選項。採取白名單原則，只改變能夠判別的以避免誤殺。
		// 必須放在"刪除掉重複的選項"之前，以處理如[[File:name.jpg|20|2017 CE]]。

		// 這幾個必須要設定指定的值。
		if (file_option in {
			link : true,
			alt : true,
			lang : true
		}) {
			// 設定
			register_option(index, '刪除需要指定值但未指定值的檔案選項');
			file_link.splice(index--, 1);
			continue;
		}

		if (file_option_is_not_caption
		//
		&& !(file_option in CeL.wiki.file_options)
		// e.g., [[File:name.jpg|name|.jpg]]
		&& file_link[0].toString().includes(file_option)) {
			register_option(index, '刪除與檔名重複且無作用的檔案選項');
			file_link.splice(index--, 1);
			continue;
		}

		var matched = file_option
				// 不可以篩到 200px 之類!
				.match(/^(?:px=?)?((?:(?:\d{1,3})? *[xX*])? *(?:\d{1,3})) *(?:Px|[Pp]X|p|x|plx|xp|@x|px\]|pc|pix|pxx|[oO][xX])?$/);
		if (matched) {
			register_option(index, '修正尺寸選項為px單位');
			file_link[index] = matched[1].replace(/ /g, '') + 'px';
			continue;
		}
		if (file_option !== '' && !isNaN(file_option)) {
			CeL.warn('Invalid number: ' + file_option);
			continue;
		}

		var matched = file_option.match(/^(width|height) *= *(\d+)(?: *px)?$/i);
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

		// ----------------------------

		var matched = file_option.match(/^([^=]*)(?:=(.*))?/), file_option_name = matched[1], file_option_value = matched[2];

		if (file_option_name in foreign_option_alias) {
			// [ language_code, official name ]
			var option_alias_data = foreign_option_alias[file_option_name];
			var type = CeL.wiki.file_options[option_alias_data[1]];
			if (file_link[type]
					&& (file_link[type] !== file_option_name || file_link[file_link[type]] !== (typeof file_option_value === 'string' ? file_option_value
							.trim()
							: file_option_value))) {
				register_option(index, '已指定' + type + '=' + file_link[type]
						+ '，刪除同類別之非正規且無效的檔案選項');
				file_link.splice(index--, 1);
				continue;
			}

			register_option(index, option_alias_data[0] ? '將其他語系('
					+ option_alias_data[0] + ')的檔案選項改為本wiki相對應的檔案選項"'
					+ option_alias_data[1] + '"'
			// e.g., [[File:i.png|float|right|thumb|...]]
			: '將非正規且無效之檔案選項改為效用最接近的檔案選項"' + option_alias_data[1] + '"');
			file_link[index] = option_alias_data[1]
					+ (typeof file_option_value === 'string' ? '='
							+ file_option_value : '');
			continue;
		}

		if ((file_option_name in local_option_alias)
		//
		&& file_link.some(function(option, _index) {
			return _index > 2 && index !== _index
			// 跳過 file namespace, section_title 以及自身。
			&& local_option_alias[file_option_name]
			//
			=== option.toString().trim();
		})) {
			// e.g., [[File:i.svg|缩略图|thumb]] → [[File:i.svg|thumb]]
			register_option(index, '刪除"' + local_option_alias[file_option_name]
					+ '"同類別之別名');
			file_link.splice(index--, 1);
			continue;
		}

		// ----------------------------

		// 檢查特別指定的誤植。
		if (file_option.toLowerCase() in typo) {
			file_option = file_option.toLowerCase();
			register_option(index, '修正"' + typo[file_option] + '"之誤植');
			if (file_link.some(function(option, _index) {
				return _index > 2 && index !== _index
				//
				&& typo[file_option] === option.toString().trim();
			})) {
				// e.g., [[File:i.svg|righ|right]] → [[File:i.svg|right]]
				file_link.splice(index--, 1);
			} else {
				// e.g., [[File:i.svg|righ]] → [[File:i.svg|right]]
				file_link[index] = typo[file_option];
			}
			continue;
		}

		// 檢查一般的檔案選項誤植。
		var correct_name = null;
		if (options_to_test.some(function(option) {
			if (file_option in CeL.wiki.file_options) {
				// 已經是正規的名稱。
				return;
			}
			var edit_distance = CeL.edit_distance(file_option.toLowerCase(),
					option);
			if (false) {
				CeL.log('edit_distance(' + file_option + ', ' + option + ') = '
						+ edit_distance);
			}
			if (1 <= edit_distance && edit_distance <= 2) {
				correct_name = option;
				return true;
			}
		})) {
			register_option(index, '修正"' + correct_name + '"之誤植');
			file_link[index] = correct_name;
			continue;
		}

		// ----------------------------

		var changed = false;
		file_option = file_option.replace(
		// @see parse_wikitext() @ CeL.wiki
		/^(thumb|thumbnail|upright|link|alt|lang|page|thumbtime|start|end|class) +=/
		// 經測試，等號前方不可有空格。
		, function(all, option_name) {
			changed = true;
			return option_name + '=';
		});
		if (changed) {
			register_option(index, '修正等號前方的空格，此空格將使選項無效');
			file_link[index] = file_option;
			continue;
		}

		var changed = false;
		file_option = file_option.replace(/^(title|Alt) *(=|$)/,
		//
		function(all, name, sign) {
			if (name === 'alt') {
				return all;
			}
			changed = true;
			return 'alt' + sign;
		});
		if (changed) {
			register_option(index, '修正錯誤的圖片替代文字用法');
			file_link[index] = file_option;
			continue;
		}

		// TODO: 全景圖 "Panorama", "float right", "hochkant=1.5", "260pxright",
		// "leftright", "upright1.5", "framepx200", "<!--...-->", "uptight=1.2",
		// "90%", "topleft", "<center></center>", "thumbtime=11", "250px}right",
		// "May 2007", "upleft=1", "220pxnail", "vignette"

		// TODO: [[File:i.svg|caption_1|caption_2]]

		// ------------------------------------------------
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
				// 去掉正規的檔案選項。
				&& !(file_option in CeL.wiki.file_options)
						&& !/^\d+px$/.test(file_option)
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
		}

		// TODO: file_option.covers(caption)

		// 去掉類別重複的檔案選項: 每種類別只能設定一個值，多出來沒有作用的應該刪掉。
		var type = CeL.wiki.file_options[file_option];
		if (type) {
			if (false) {
				CeL.info(type + ': ' + file_link[type] + ' vs. ' + file_option);
			}
			if (file_link[type] && file_link[type] !== file_option) {
				register_option(index, '已指定' + type + '=' + file_link[type]
						+ '，去掉相同類別的無效檔案選項');
				file_link.splice(index--, 1);
				continue;
			}
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
		CeL.warn('Bad item(s) left: ' + JSON.stringify(bad_items));
	}

	// return;
	return content.slice(0, page_data.location[0]) + file_link
			+ content.slice(page_data.location[1]);
}
