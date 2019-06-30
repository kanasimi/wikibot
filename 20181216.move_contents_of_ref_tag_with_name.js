// cd /d D:\USB\cgi-bin\program\wiki && node 20181216.move_ref_name.js
// <ref name="...">の内容を移動する

/*

 2018/12/16 17:1:23	初版試營運

 @see [[ja:Special:Diff/70970184]], [[ja:Category:参照エラーのあるページ]]

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loader.js');

var main_template_name = '基礎情報 テレビ番組',
/** {String}編輯摘要。總結報告。 */
summary = '[[Special:Diff/70970184|Bot依頼]]',

/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'ja'),

param_has_unique_ref = Object.create(null),
// 手動で修正する必要のある記事。
need_fix = Object.create(null);

// ---------------------------------------------------------------------//

function move_ref_contents(value, template, page_data) {
	if (!Array.isArray(value))
		return;

	value.forEach(function(token) {
		// console.log(token);
		if (token.tag !== 'ref')
			return;

		if (!token.attributes.name) {
			param_has_unique_ref[page_data.title] = true;
			return;
		}

		var reference_list = page_data.parsed.parse_references(function(token,
				index, parent) {
			// @see options.add_index @ function for_each_token()
			token.index = index;
			token.parent = parent;
		})[token.attributes.name];
		// console.log(token);
		// console.log(page_data.parsed);
		// console.log(reference_list[token.attributes.name]);

		if (reference_list.length === 1) {
			param_has_unique_ref[page_data.title] = true;
			return;
		}

		if (reference_list.bad_index)
			reference_list.bad_index.push(token.reference_index);
		else
			reference_list.bad_index = [ token.reference_index ];

		if (page_data.reference_list_to_move) {
			if (!page_data.reference_list_to_move.includes(reference_list))
				page_data.reference_list_to_move.push(reference_list);
		} else {
			page_data.reference_list_to_move = [ reference_list ];
		}

		if (token.type !== 'tag') {
			return;
		}

		// assert: !('switch_from' in reference_list)
		reference_list.switch_from = token.reference_index;
	});
}

function move_contents_of_ref_tag_with_name(page_data) {
	if (!page_data || ('missing' in page_data)) {
		// error? 此頁面不存在/已刪除。
		return [ CeL.wiki.edit.cancel, '條目不存在或已被刪除' ];
	}
	if (page_data.ns !== 0 && page_data.title !== 'Wikipedia:サンドボックス') {
		return [ CeL.wiki.edit.cancel,
		// 本作業は記事だけを編集する
		'本作業僅處理條目命名空間或模板或 Category' ];
	}

	/** {String}page title = page_data.title */
	var title = CeL.wiki.title_of(page_data),
	/**
	 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
	 */
	content = CeL.wiki.content_of(page_data);

	var parser = CeL.wiki.parser(page_data).parse();
	// debug 用.
	// check parser, test if parser working properly.
	if (CeL.wiki.content_of(page_data) !== parser.toString()) {
		console.log(CeL.LCS(CeL.wiki.content_of(page_data), parser.toString(),
				'diff'));
		throw 'Parser error: ' + CeL.wiki.title_link_of(page_data);
	}

	parser.each('template', function(token, index) {
		if (token.name !== main_template_name)
			return;
		// console.log(token);
		move_ref_contents(token.parameters.字幕, token, page_data);
		move_ref_contents(token.parameters.データ放送, token, page_data);
	});

	if (page_data.reference_list_to_move) {
		page_data.reference_list_to_move.forEach(function(reference_list) {
			if (isNaN(reference_list.switch_from))
				return;
			var switch_to = 0;
			// find a good place to put <ref>...</ref>
			while (switch_to < reference_list.length) {
				if (reference_list.bad_index.includes(switch_to))
					switch_to++;
				else
					break;
			}
			CeL.debug('switch reference: ' + reference_list.switch_from + ', '
					+ switch_to);
			if (reference_list[switch_to]) {
				CeL.wiki.switch_token(
						reference_list[reference_list.switch_from],
						reference_list[switch_to]);
			}
			// done.
			delete reference_list.switch_from;
		});
	}

	return parser.toString();
}

// ---------------------------------------------------------------------//

// main

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
prepare_directory(base_directory, true);

// CeL.set_debug(6);

CeL.wiki.cache([ {
	// @see [[Category:含有多个问题的条目]]
	list : 'Template:' + main_template_name,
	type : 'embeddedin',
	retrieve : function(list) {
		return CeL.wiki.unique_list(list);
	},
	operator : function(list) {
		if (false)
			CeL.log('All ' + list.length + ' pages transcluding {{'
					+ main_template_name + '}}.');
		// this.transclude_基礎情報_テレビ番組 = list;
	}
} ], function(list) {
	// list.truncate(2);
	// list = [ 'Wikipedia:サンドボックス' ];
	// list = list.slice(0, 20);

	// callback
	wiki.work({
		each : move_contents_of_ref_tag_with_name,
		summary : summary + ': [[Template:' + main_template_name
				+ ']]の「字幕」と「データ放送」欄の参照内容を移動する',
		// [[User:cewbot/log/20181216]]
		log_to : log_to,
		page_cache_prefix : base_directory + 'page/',
		last : function() {
			CeL.info('Done: ' + (new Date).toISOString());
			param_has_unique_ref = Object.keys(param_has_unique_ref);
			if (param_has_unique_ref.length > 0) {
				CeL.warn('pages still has <ref>:\n'
						+ param_has_unique_ref.join('\n'));
			}
			return;

			wiki.page(log_to).edit(function(page_data) {
				/** {String}page title = page_data.title */
				var title = CeL.wiki.title_of(page_data),
				/**
				 * {String}page content, maybe undefined. 條目/頁面內容 =
				 * revision['*']
				 */
				content = CeL.wiki.content_of(page_data);
				if (!content)
					return;

				return content + '\n== refが記事 ==\n * '
				//
				+ param_has_unique_ref.join('\n * ');
			});
		}
	}, list);
}, {
	// default options === this
	// [SESSION_KEY]
	session : wiki,
	// title_prefix : 'Template:',
	// cache path prefix
	prefix : base_directory
});
