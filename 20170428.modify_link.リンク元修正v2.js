// (cd ~/wikibot && date && hostname && nohup time node 20170428.modify_link.リンク元修正v2.js; date) >> modify_link/log &

/*

 rename link

 2017/4/28 18:44:12	初版試營運。
 完成。正式運用。

 TODO:
 不處理同名消歧義頁(曖昧さ回避)
 {{混同|page_name|page_name2}}
 {{Pathnav|page_name|page_name2}}

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loader.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('ja');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),

// ((Infinity)) for do all
test_limit = 2,

page_hash = Object.create(null), move_from_list;

// ----------------------------------------------------------------------------

// CeL.set_debug(2);

// current work

/** {String}預設之編輯摘要。總結報告。編集内容の要約。 */
summary = '[[Special:Diff/63854352|Bot作業依頼]]：フライデーへのリンク修正依頼 - [[' + log_to
		+ '|log]]';
page_hash = {
	フライデー : 'フライデー (雑誌)'
}

// -------------------------------------
// archive
if (false) {
	// 2017/4/28 18:44:12
}

// ----------------------------------------------------------------------------

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
prepare_directory(base_directory);

modify_link(page_hash, move_from_list);

function modify_link(page_hash, move_from_list) {
	if (!Array.isArray(move_from_list)) {
		move_from_list = Object.keys(page_hash);
	}
	move_from_list.run_async(function(run_next, page_name, index) {
		CeL.log(index + '/' + move_from_list.length + ' [[' + page_name
				+ ']] → [[' + page_hash[page_name] + ']]');
		main_work(page_name, page_hash[page_name], run_next);
	}, function(params) {
		CeL.log('All ' + move_from_list.length + ' wikilinks done.');
	});
}

function main_work(page_name, move_to, callback) {

	wiki.cache([ {
		type : 'backlinks',
		list : page_name,
		reget : true,
		operator : function(list) {
			this.list = list;
		}

	} ], function() {
		var list = this.list;
		// list = [ '' ];
		CeL.log('Get ' + list.length + ' pages.');
		if (0) {
			// 設定此初始值，可跳過之前已經處理過的。
			list = list.slice(0 * test_limit, 1 * test_limit);
			CeL.log(list.slice(0, 8).map(function(page_data) {
				return CeL.wiki.title_of(page_data);
			}).join('\n') + '\n...');
		}

		wiki.work({
			page_name : page_name,
			PATTERN_link : new RegExp('\\[\\[ *('
					+ CeL.to_RegExp_pattern(page_name)
					// TODO: #...
					+ ') *(?:\\| *([\\s\\S]+?))?\\] *\\]', 'g'),
			move_to : move_to,
			// 不作編輯作業。
			// no_edit : true,
			last : callback,
			log_to : log_to,
			summary : summary + ': [[' + page_name
			//
			+ ']] → [[' + move_to + ']]',
			each : for_each_page
		}, list);

	}, {
		// default options === this
		// include File, Template, Category
		namespace : '0|6|10|14',
		// title_prefix : 'Template:',
		// cache path prefix
		prefix : base_directory
	});
}

// ----------------------------------------------------------------------------

function for_each_page(page_data, messages, config) {
	if (!page_data || ('missing' in page_data)) {
		// error?
		return [ CeL.wiki.edit.cancel, '條目已不存在或被刪除' ];
	}

	if (page_data.ns !== 0 && page_data.ns !== 6 && page_data.ns !== 10
			&& page_data.ns !== 14) {
		throw '非條目:[[' + page_data.title + ']]! 照理來說不應該出現有 ns !== 0 的情況。';
	}

	/** {String}page title = page_data.title */
	var title = CeL.wiki.title_of(page_data),
	/**
	 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
	 */
	content = CeL.wiki.content_of(page_data);

	if (!content) {
		return [ CeL.wiki.edit.cancel,
				'No contents: [[' + title + ']]! 沒有頁面內容！' ];
	}

	// var parser = CeL.wiki.parser(page_data);

	// 已經添加過的page。
	var pages = Object.create(null);

	// 分類名稱重複時，排序索引以後出現者為主。

	content = content.replace(config.PATTERN_link, function(all, page_name,
			show_text) {
		return '[[' + config.move_to + (show_text ? '|' + show_text
		//
		: page_name === config.move_to ? '' : '|' + page_name) + ']]';
	});

	return content;
}
