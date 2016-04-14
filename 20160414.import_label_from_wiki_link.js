// cd ~/wikibot && date && time /shared/bin/node 20160414.import_label_from_wiki_link.js && date

/*

 2016/4/14 22:57:45	初版試營運，約耗時 18分鐘執行（不包含 modufy Wikidata，parse）。

 */

'use strict';

require('./wiki loder.js');
// for CeL.wiki.cache(), CeL.fs_mkdir()
CeL.run('application.platform.nodejs');
// 在非 Windows 平台上避免 fatal 錯誤。
CeL.env.ignore_COM_error = true;
// load module for CeL.CN_to_TW('简体')
CeL.run('extension.zh_conversion');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),
/** {String}base directory */
base_directory = bot_directory + script_name + '/';

var
/** {Natural}所欲紀錄的最大筆數。 */
log_limit = 400;

// ----------------------------------------------------------------------------

wiki.set_data();

var count = 0, test_limit = 20,
// label_hash['language:title'] = {String}label || {Array}labels
label_hash = CeL.null_Object(), source_hash = CeL.null_Object(),
// [ all link, foreign language, title in foreign language, local label ]
PATTERN_link = /\[\[:\s*?([a-z]{2,})\s*:\s*([^\[\]\|]+)\|([^\[\]\|]+)\]\]/g,
//
PATTERN_en = /^[a-z,.;\-\d\s]+$/i;

/**
 * Operation for each page. 對每一個頁面都要執行的作業。
 * 
 * @param {Object}page_data
 *            page data got from wiki API. =
 *            {pageid,ns,title,revisions:[{timestamp,'*'}]}
 */
function for_each_page(page_data) {
	if (false && count > test_limit) {
		return;
	}

	/** {String}page title = page_data.title */
	var title = CeL.wiki.title_of(page_data),
	/** {String}page content, maybe undefined. 頁面內容 = revision['*'] */
	content = CeL.wiki.content_of(page_data);

	if (!content)
		return;

	var matched;
	while (matched = PATTERN_link.exec(content)) {
		// wikt, wikisource
		if (matched[1].includes('wik')
		//
		|| /^category/i.test(matched[1])
		// 去除不能包含的字元。
		|| matched[3].includes('/'))
			continue;

		var foreign_title = matched[2]
		// e.g., [[:en:wikt:t|t]]
		.replace(/^[a-z\s]*:/, '').trim(),
		//
		label = CeL.CN_to_TW(matched[3]
		// e.g., [[:en:t|''t'']], [[:en:t|《t》]]
		.replace(/['》]+$|^['《]+/g, '')
		// e.g., [[:en:t|t{{en}}]]
		.replace(/{{[a-z]{2,3}}}/g, '').trim().replace(/\s{2,}/g, ' '));
		if (!foreign_title || !label || (foreign_title.length > label.length
		// 不處理各自包含者。
		? foreign_title.includes(label) : label.includes(foreign_title))
		// e.g., 法文版, 義大利文版
		|| label.endsWith('文版') || PATTERN_en.test(label))
			continue;

		if (label.includes('·'))
			// 為人名。
			label = label.replace(/裡/g, '里');

		foreign_title = matched[1] + ':' + foreign_title;
		if (!(foreign_title in label_hash)) {
			++count;
			if (count < log_limit)
				console.log(count + ': [[' + foreign_title + ']] ← [[' + label
						+ ']] @ [[' + title + ']]: ' + matched[0]);
			label_hash[foreign_title] = [ label ];
			// source_hash[foreign_title] = [ title ];
		} else if (!label_hash[foreign_title].includes(label)) {
			label_hash[foreign_title].push(label);
			// source_hash[foreign_title].push(title);
		}
	}
}

var default_language = 'zh',
/** {Number}未發現之index。 const: 基本上與程式碼設計合一，僅表示名義，不可更改。(=== -1) */
NOT_FOUND = ''.indexOf('_');

function add_item(label) {
	var language = PATTERN_en.test(label) ? 'en' : default_language;
	return {
		language : language,
		value : label,
		add : 1
	};
}

function push_work(full_title) {
	var foreign_title = full_title.match(/^([a-z]{2,}):(.+)$/),
	//
	language = foreign_title[1];
	foreign_title = foreign_title[2];

	wiki.data([ language, foreign_title ], function(data) {
		// console.log(data);
	}).edit_data(function(entity) {
		if (++count > test_limit) {
			// throw 'Test done.';
			return [ CeL.wiki.edit.cancel, 'Ignored: Test done.' ];
		}

		if (!entity || ('missing' in entity)) {
			return [ CeL.wiki.edit.cancel,
			//
			'missing [' + (entity && entity.id) + ']' ];
		}

		var labels = label_hash[full_title], has_label;
		if (entity.labels[default_language]) {
			has_label = labels.indexOf(
			// 去除重複 label。
			entity.labels[default_language].value);
			if (has_label !== NOT_FOUND) {
				labels.splice(has_label, 1);
				if (labels.length === 0)
					return [ CeL.wiki.edit.cancel,
					//
					'No labels to set.' ];
				has_label = true;
			}
		}

		console.log(entity.id
		//
		+ ': [[' + language + ':' + foreign_title + ']]: ' + labels);

		var data;
		// 若是本來已有 label，會被取代。
		if (has_label) {
			data = {};
		} else {
			data = {
				labels : [ add_item(labels[0]) ]
			};
			labels.shift();
		}
		if (labels.length > 0) {
			data.aliases = labels.map(add_item);
		}
		return data;
	}, {
		bot : 1,
		summary : 'bot test: import label from zhwiki link'
	});
}

/**
 * Finish up. 最後結束工作。
 */
function finish_work() {
	if (count) {
		CeL.log('All ' + count + ' labels.');
		CeL.fs_write(
		//
		base_directory + 'labels.json', JSON.stringify(label_hash));
		count = 0;
	}

	for ( var full_title in label_hash) {
		push_work(full_title);
	}
}

// ----------------------------------------------------------------------------

label_hash = CeL.fs_read(base_directory + 'labels.json');
if (label_hash) {
	// read cache
	label_hash = JSON.parse(label_hash);
	finish_work();

} else {
	label_hash = CeL.null_Object();

	prepare_directory(base_directory);

	// share the xml dump file.
	if (typeof process === 'object') {
		process.umask(parseInt('0022', 8));
	}

	// CeL.set_debug(6);
	CeL.wiki.traversal({
		wiki : wiki,
		// cache path prefix
		directory : base_directory,
		// 指定 dump file 放置的 directory。
		// dump_directory : bot_directory + 'dumps/',
		dump_directory : '/shared/dump/',
		// 若 config.filter 非 function，表示要先比對 dump，若修訂版本號相同則使用之，否則自 API 擷取。
		// 設定 config.filter 為 ((true)) 表示要使用預設為最新的 dump，否則將之當作 dump file path。
		filter : true,
		after : finish_work
	}, for_each_page);
}
