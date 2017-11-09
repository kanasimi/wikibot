/*

	初版完成，試營運。


@see
[[Special:LintErrors]]
https://en.wikipedia.org/wiki/Wikipedia:Picture_tutorial
https://www.mediawiki.org/wiki/Help:Extension:Linter
https://www.mediawiki.org/w/api.php?action=help&modules=query%2Blinterrors

這個任務需要倚賴[https://www.mediawiki.org/w/api.php?action=help&modules=query%2Blinterrors LintErrors API]，因此已經編輯過的頁面就沒有辦法簡單的指定頁面後再重新編輯。這邊另外做了一些編輯給您參考，請在編輯記錄中找尋關鍵字"修正維基語法:"，謝謝。

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

// language support
var i18n = {
	en : {
		'修正維基語法: [[Special:LintErrors/bogus-image-options|有問題的檔案選項]]' : 'Fix LintErrors: [[Special:LintErrors/bogus-image-options|Bogus file options]]'
	},
	ja : {
		format : '表示形式',
		location : '配置位置',
		alignment : '垂直方向の位置',

		// 文件設定の修正
		'修正維基語法: [[Special:LintErrors/bogus-image-options|有問題的檔案選項]]' : 'ウィキ文法修正: [[Special:LintErrors/bogus-image-options|間違った画像オプション]]',
		// [[Help:画像の表示]]
		'刪除空檔案選項' : '空のオプションを削除する',
		'刪除未規範且無效的檔案選項' : '無効なオプションを削除する',
		'刪除需要指定值但未指定值的檔案選項' : '必須引数を指定していない無効なオプションを削除する',
		'刪除與檔名重複且無作用的檔案選項' : 'ファイル名と重複した無効なオプションを削除する',
		'修正尺寸選項為px單位' : 'サイズの単位をpxに修正する',
		'將尺寸選項改為正規形式' : 'サイズ単位の正規化',

		'已指定%1=%2，刪除同類別之非正規且無效的檔案選項' : '%1を"%2"に指定した。同種類の無効なオプションを削除する',
		'已指定%1=%2，刪除同類別之其他語系(%3)的檔案選項' : '%1を"%2"に指定した。他言語(%3)同種類の無効なオプションを削除する',

		'將其他語系(%1)的檔案選項改為本wiki相對應的檔案選項"%2"' : '他言語(%1)のオプションを該当オプション"%2"に変更する',
		'將非正規檔案選項改為效用最接近的檔案選項""%1"' : '非正規オプションを最も近い効果のオプション"%1"に変更する',

		'刪除與"%1"同類別、重複設定之別名' : '"%1"と同種類、重複した別名オプションを削除する',
		'修正"%1"之誤植' : '"%1"の誤植を修正する',
		'修正等號前方的空格，此空格將使選項無效' : '等号の前のスペースを削除する。このスペースはオプションを無効化する。',
		'修正錯誤的圖片替代文字用法(必須用小寫的"alt")' : '代替文の書式を修正する(小文字の"alt"を使用する)',
		'刪除重複的檔案選項' : '重複したオプションを削除する',
		'已指定%1=%2，去掉相同類別的無效檔案選項' : '%1を"%2"に指定した。同種類の無効なオプションを削除する'
	}
};

(function() {
	for ( var language in i18n) {
		if (language === use_language)
			CeL.gettext.set_text(i18n[language], language);
	}
})();

/* eslint no-use-before-define: ["error", { "functions": false }] */
/* global CeL */
/* global Wiki */

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true);

/** {String}編輯摘要。總結報告。 */
summary = CeL
		.gettext('修正維基語法: [[Special:LintErrors/bogus-image-options|有問題的檔案選項]]');
// summary = 'bot test: ' + summary;

// ----------------------------------------------------------------------------

// CeL.set_debug(6);

get_linterrors('bogus-image-options', for_bogus_image_options);

function get_linterrors(category, for_lint_error, options) {
	options = CeL.setup_options(options);

	var action = 'query&list=linterrors&lntcategories=' + category;

	action += '&lntnamespace=' + (CeL.wiki.namespace(options.namespace) || 0);
	action += '&lntlimit=' + (options.limit || ('max' && 800));
	if (options.from >= 0) {
		action += '&lntfrom=' + options.from;
	}

	wiki.query_API(action, function for_error_list(data, error) {
		var linterrors = data.query.linterrors;
		linterrors.for_lint_error = for_lint_error;
		linterrors.processed = 0;
		// 一個一個處理檔案，處理完之後就釋放記憶體，以減少記憶體的消耗。
		CeL.run_serial(get_page_contents, linterrors, function() {
			CeL.info(linterrors.processed
			//
			+ '/' + linterrors.length + ' done.');
		});
	});
}

function get_page_contents(run_next, lint_error_page, index, linterrors) {
	if (lint_error_page.templateInfo.name
	// 問題出在transclusion的模板，而不是本page。
	|| ('multiPartTemplateBlock' in lint_error_page.templateInfo)) {
		run_next();
		return;
	}
	lint_error_page.task_index = index;
	lint_error_page.task_length = linterrors.length;

	if (false && index < 227) {
		run_next();
		return;
	}
	// CeL.set_debug(6);

	if (CeL.is_debug(3)) {
		console.log(lint_error_page);
	}

	// TODO: 一次取得多個個頁面的內容。
	wiki.page(lint_error_page, {
		rvprop : 'content|timestamp|ids'
	}).edit(linterrors.for_lint_error, {
		summary : summary,
		bot : 1,
		minor : 1,
		nocreate : 1
	}, function() {
		linterrors.processed++;
		// free
		linterrors[index] = null;
		run_next();
	});
}

// ----------------------------------------------------------------------------

var
/** {Number}未發現之index。 const: 基本上與程式碼設計合一，僅表示名義，不可更改。(=== -1) */
NOT_FOUND = ''.indexOf('_');

// use edit distance. 較難符合、常用的應置於前。
var options_to_test = 'upright,right,left,thumb,none,middle'.split(','),
// 這些絕不可被拿來當作caption描述者。
not_file_option = {
	links : true,
	size : true,
	auto : true,
	inline : true,
	image : true,
	width : true,
	hright : true,
	align : true,
	position : true,
	caption : true,
	Caption : true,
	'default' : true
},
// 有效選項別名 alias: alias → official name 正式名稱
file_option_alias = {
	// https://de.wikipedia.org/wiki/Hilfe:Bilder#Miniatur
	de : {
		mini : 'thumb',
		miniatur : 'thumb',
		hochkant : 'upright'
	},

	// https://fr.wikipedia.org/wiki/Aide:Ins%C3%A9rer_une_image_(wikicode,_avanc%C3%A9)
	fr : {
		vignette : 'thumb'
	},

	zh : {
		缩略图 : 'thumb',
		有框 : 'frame',
		左 : 'left',
		右 : 'right',
		中 : 'center',
		居中 : 'center'
	},

	// for all language
	'' : {
		float : 'thumb',
		small : 'thumb'
	}
}, local_option_alias, foreign_option_alias = CeL.null_Object(),
// 登記 edit distance 過大者
// wring → right
typo = {
	rghigt : 'right',
	靠右 : 'right',
	靠左 : 'left',
	'valign=center' : 'center',
	'align=right' : 'right',
	central : 'center'
};

(function() {
	for ( var language_code in file_option_alias) {
		var option_alias = file_option_alias[language_code];
		if (language_code === use_language) {
			local_option_alias = option_alias;
		} else {
			for ( var alias in option_alias) {
				foreign_option_alias[alias] = [ language_code,
						option_alias[alias] ];
			}
		}
	}
	local_option_alias = local_option_alias || CeL.null_Object();

	if (false) {
		for ( var key in typo) {
			var value = typo[key];
			CeL.log(key + ' vs ' + value + ': '
			//
			+ CeL.edit_distance(key, value));
		}
	}
})();

// https://en.wikipedia.org/wiki/Wikipedia:Extended_image_syntax
function for_bogus_image_options(page_data) {
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

	var file_text = content.slice(page_data.location[0], page_data.location[1]);
	CeL.debug('Bad token: ' + JSON.stringify(file_text), 3,
			'for_bogus_image_options');
	var file_link = CeL.wiki.parse(file_text), bad_items = page_data.params.items;
	CeL.log(page_data.task_index + '/' + page_data.task_length + ' '
			+ CeL.wiki.title_link_of(page_data) + ': ' + file_link + ' -- '
			+ JSON.stringify(bad_items));
	if (file_link.type !== 'file' || file_text !== file_link.toString()) {
		if (file_link.type !== 'file'
				&& Date.now() - Date.parse(page_data.revisions[0].timestamp) < 60 * 60 * 1000) {
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
			message = CeL.gettext(message) + ':'
					+ JSON.stringify(file_option.trim());
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
		CeL.debug('刪除掉一定是錯的選項。', 3, 'for_bogus_image_options');

		if (file_option === ''
		// 最後一個空白被視為不輸入 caption。
		// 但是經過測試，最後一個為空白時也可以刪掉。
		// && index < file_link.length - 1
		) {
			register_option(index, '刪除空檔案選項');
			file_link.splice(index--, 1);
			continue;
		}

		if ((file_option in not_file_option) || file_option_is_not_caption
		// 這一項所列出的為長度極短、非有意義文字
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
		CeL.debug('測試其他可以判別的檔案選項。', 3, 'for_bogus_image_options');
		// 採取白名單原則，只改變能夠判別的以避免誤殺。
		// 必須放在"刪除掉重複的選項"之前，以處理如[[File:name.jpg|20|2017 CE]]。

		// 這幾個 file option 必須要設定指定的值。
		if (file_option in {
			// 不包含link
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
				// 不可以篩到 200px 之類正規用法!
				.match(/^(?:px=?)?((?:(?:\d{1,3})? *[xX*])? *(?:\d{1,3})) *(?:Px|[Pp]X|p|x|plx|pcx|pix|pxx|pxl|pxb|xp|dx|@x|px\]|pc|pz|[oO][xX])?$/);
		if (matched) {
			register_option(index, '修正尺寸選項為px單位');
			file_link[index] = matched[1].replace(/ /g, '') + 'px';
			continue;
		}
		if (file_option !== '' && !isNaN(file_option)) {
			// 尺寸過大或者過小
			CeL.warn('Invalid number: ' + file_option);
			continue;
		}

		var matched = file_option
				.match(/^(width|height|pi?x) *= *(?:" *)?(\d+)(?: *px)?(?:" *)?$/i);
		if (matched) {
			register_option(index, '將尺寸選項改為正規形式');
			if (matched[1].toLowerCase() === 'height') {
				// e.g., "height=200"
				file_link[index] = 'x' + matched[2] + 'px';
			} else {
				// e.g., "width=200"
				file_link[index] = matched[2] + 'px';
			}
			continue;
		}

		// ----------------------------

		var matched = file_option.match(/^([^=]*)(?:=([\s\S]*))?/),
		// 對於有參數的檔案選項，file_option_name=file_option_value
		file_option_name = matched[1].trim(), file_option_value = matched[2]
				&& matched[2].trim() || undefined;

		if (file_option_name in foreign_option_alias) {
			// 為其他語系
			// [ language_code, official name ]
			var option_alias_data = foreign_option_alias[file_option_name];
			var type = CeL.wiki.file_options[option_alias_data[1]];
			if (file_link[type]
					// 實際使用的檔案選項與當前所要測試的檔案選項(採用其他語系)不同。
					// 對當前所要測試的檔案選項類別，已經有指定了這種類別的檔案選項，但是並不是但是當前所要測試的檔案選項。
					&& (file_link[type] !== file_option_name || file_link[file_link[type]] !== file_option_value)) {
				register_option(index, option_alias_data[0] ? CeL.gettext(
						'已指定%1=%2，刪除同類別之其他語系(%3)的檔案選項', type, file_link[type],
						option_alias_data[0]) : CeL.gettext(
						'已指定%1=%2，刪除同類別之非正規且無效的檔案選項', type, file_link[type]));
				file_link.splice(index--, 1);
				continue;
			}

			// 實際使用的檔案選項與當前所要測試的檔案選項(採用其他語系)相同。
			register_option(index, option_alias_data[0] ? CeL.gettext(
					'將其他語系(%1)的檔案選項改為本wiki相對應的檔案選項"%2"', option_alias_data[0],
					option_alias_data[1])
			// e.g., [[File:i.png|float|right|thumb|...]]
			: CeL.gettext('將非正規檔案選項改為效用最接近的檔案選項""%1"', option_alias_data[1]));
			file_link[index] = option_alias_data[1]
					+ (typeof file_option_value === 'string' ? '='
							+ file_option_value : '');
			continue;
		}

		if ((file_option_name in local_option_alias)
		// 為本wiki語系別名
		&& file_link.some(function(option, _index) {
			return _index >= 2 && index !== _index
			// 跳過 file namespace, section_title 以及自身。
			&& local_option_alias[file_option_name]
			//
			=== option.toString().trim();
		})) {
			// redundant 冗餘
			// e.g., [[File:i.svg|缩略图|thumb]] → [[File:i.svg|thumb]]
			register_option(index, CeL.gettext('刪除與"%1"同類別、重複設定之別名',
					local_option_alias[file_option_name]));
			file_link.splice(index--, 1);
			continue;
		}

		// ----------------------------

		CeL.debug('檢查特別指定的誤植。', 3, 'for_bogus_image_options');
		if (file_option.toLowerCase() in typo) {
			file_option = file_option.toLowerCase();
			register_option(index, CeL.gettext('修正"%1"之誤植', typo[file_option]));
			if (file_link.some(function(option, _index) {
				return _index >= 2 && index !== _index
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

		CeL.debug('以 edit distance 檢查一般的檔案選項誤植。', 3, 'for_bogus_image_options');
		var correct_name = null;
		file_option_name = file_option_name.toLowerCase();
		if (file_option_name
		//
		&& options_to_test.some(function(option) {
			if (file_option_name in CeL.wiki.file_options) {
				// 已經是正規的名稱。
				return;
			}
			var edit_distance = CeL.edit_distance(file_option_name, option);
			if (false) {
				CeL.log('edit_distance('
				//
				+ file_option_name + ', ' + option + ') = ' + edit_distance);
			}
			if (1 <= edit_distance && edit_distance <= 2) {
				correct_name = option;
				return true;
			}
		})) {
			register_option(index, CeL.gettext('修正"%1"之誤植', correct_name));
			file_link[index] = correct_name
					+ (typeof file_option_value === 'string' ? '='
							+ file_option_value : '');
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
		file_option = file_option.replace(/^ *(title|Alt) *=/i,
		//
		function(all, name) {
			if (name === 'alt') {
				// 已經是正確的了。
				return all;
			}
			changed = true;
			return 'alt=';
		});
		if (changed) {
			register_option(index, '修正錯誤的圖片替代文字用法(必須用小寫的"alt")');
			file_link[index] = file_option;
			continue;
		}

		// TODO: 全景圖 "Panorama", "float right", "hochkant=1.5", "260pxright",
		// "leftright", "upright1.5", "framepx200", "<!--...-->", "uptight=1.2",
		// "90%", "topleft", "<center></center>", "thumbtime=11", "250px}right",
		// "May 2007", "upleft=1", "220pxnail", "250pxright", "250pxright",
		// "float right"

		// TODO: [[File:i.svg|caption_1|caption_2]]

		// ------------------------------------------------
		CeL.debug('刪除掉重複的選項。', 3, 'for_bogus_image_options');

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
				// 冗餘重複的檔案選項。
				// e.g., [[File:...|right|right|...]]
				: option === file_option;
			})) {
				register_option(index, '刪除重複的檔案選項');
				file_link.splice(index--, 1);
				continue;
			}
		}

		// TODO: file_option.covers(caption)

		CeL.debug('去掉類別重複的檔案選項: 每種類別只能設定一個值，多出來沒有作用的應該刪掉。', 3,
				'for_bogus_image_options');
		var type = CeL.wiki.file_options[file_option];
		if (type) {
			if (false) {
				CeL.info(type + ': ' + file_link[type] + ' vs. ' + file_option);
			}
			if (file_link[type] && file_link[type] !== file_option) {
				register_option(index, CeL.gettext('已指定%1=%2，去掉相同類別的無效檔案選項',
						type, file_link[type]));
				file_link.splice(index--, 1);
				continue;
			}
		}

	}

	file_link = file_link.toString();

	_this.summary += ' lintId=' + page_data.lintId;
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
