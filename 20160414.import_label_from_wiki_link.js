// cd ~/wikibot && date && time /shared/bin/node 20160414.import_label_from_wiki_link.js && date

/*

 2016/4/14 22:57:45	初版試營運，約耗時 18分鐘執行（不包含 modufy Wikidata，parse and filter page）。約耗時 105分鐘執行（不包含 modufy Wikidata）。
 TODO: parse "[[local title]]（[[:en:foreign title]]）"
 TODO: parse "{{link-en|local title|foreign title}}"
 TODO: catch已經完成操作的label

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
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),
/** {String}base directory */
base_directory = bot_directory + script_name + '/';

var
/** {Natural}所欲紀錄的最大筆數。 */
log_limit = 4000,
//
count = 0, test_limit = 200,
//
use_language = 'zh', data_file_name = 'labels.json';

// ----------------------------------------------------------------------------

wiki.set_data();

var
// label_data['language:title'] = [ {Array}labels, {Array}titles ]
label_data = CeL.null_Object(),
// [ all link, foreign language, title in foreign language, local label ]
PATTERN_link = /\[\[:\s*?([a-z]{2,})\s*:\s*([^\[\]|#]+)\|([^\[\]|#]+)\]\]/g,
// TODO: 改為 non-Chinese
PATTERN_en = /^[a-z,.!:;'"\-\d\s\&<>\\\/]+$/i;

/**
 * Operation for each page. 對每一個頁面都要執行的作業。
 * 
 * @param {Object}page_data
 *            page data got from wiki API. =
 *            {pageid,ns,title,revisions:[{timestamp,'*'}]}
 */
function for_each_page(page_data, messages) {
	// 有必要中途跳出時則須在 callback() 中設定：
	// @ callback(page_data, messages):
	if (count > test_limit) {
		if (messages) {
			// 當在 .work() 執行時。
			messages.quit_operation = true;
			// 在 .edit() 時不設定內容。但照理應該會在 .page() 中。
			return;
		}
		// 當在本函數，下方執行時，不包含 messages。
		return CeL.wiki.quit_operation;
	}

	if (page_data.ns !== 0)
		return [ CeL.wiki.edit.cancel, '本作業僅處理條目命名空間' ];

	/** {String}page title = page_data.title */
	var title = CeL.wiki.title_of(page_data),
	/** {String}page content, maybe undefined. 頁面內容 = revision['*'] */
	content = CeL.wiki.content_of(page_data);

	if (/^\d+月(\d+日)?$/.test(title) || /^\d+年(\d+月)?$/.test(title))
		return [ CeL.wiki.edit.cancel, '跳過日期條目，常會有意象化、隱喻、象徵的表達方式。' ];

	if (!content)
		return;

	var matched;
	while (matched = PATTERN_link.exec(content)) {
		// wikt, wikisource
		if (matched[1].includes('wik')
		// || /^category/i.test(matched[1])
		)
			continue;

		var foreign_title = matched[2].trim().replace(/_/g, ' ');

		if (foreign_title.length < 2
		// e.g., [[:en:wikt:t|t]]
		|| /^[a-z\s]*:/.test(foreign_title)) {
			continue;
		}

		var label = matched[3]
		//
		.replace(/-{([^{}]*)}-/g, function($0, $1) {
			if (!$1.includes(':'))
				return $1;
			var matched = $1.match(/zh-tw:([^;]+)/i)
			//
			|| $1.match(/zh(?:-[a-z]+):([^;]+)/i);
			return matched && matched[1].trim() || $0;
		}).trim().replace(/_/g, ' ').replace(/<br[^<>]*>/ig, ' ').replace(
				/[\s　]{2,}/g, ' ');

		if (label.length < 5
		// && label.length > 1
		// [[:en:Thirty-third government of Israel|第33届]] @ [[以色列总理]]
		// [[en:1st Lok Sabha]] ← [[1屆]] @ [[印度总理]]: [[:en:1st Lok Sabha|1届]]
		// [[en:First Gerbrandy cabinet]] ← [[第一屆]] @ [[荷兰首相]]: [[:en:First
		// Gerbrandy cabinet|第一届]]
		&& /[屆届]$/.test(label)) {
			continue;
		}

		if (label.length > foreign_title.length) {
			var index = label.indexOf(foreign_title);
			if (index > 0 && /[(（]/.test(label.charAt(index - 1))
					&& /[)）]/.test(label.charAt(index + foreign_title.length)))
				label = (label.slice(0, index - 1) + label.slice(index
						+ foreign_title.length + 1)).trim();
		}

		label = label
		// e.g., [[:en:t|''t'']], [[:en:t|《t》]]
		.replace(/['》]+$|^['《]+/g, '').replace(/'{2,}([^']+)'{2,}/g, '$1')
		// e.g., [[:en:t|t{{en}}]]
		.replace(/{{[a-z]{2,3}}}/g, '').replace(/{{·}}/g, '·');

		// 篩除代表資訊過少的辭彙。
		if (label.length < 2
		// 不處理各自包含者。
		|| (foreign_title.length === label.length
		//
		? foreign_title == label
		//
		: foreign_title.length > label.length && foreign_title.includes(label))
		// 去除不能包含的字元。
		// || label.includes('/')
		// || /^[\u0001-\u00ff英法義]$/.test(label)
		// e.g., 法文版, 義大利文版
		|| /[语語文]版?$/.test(label)
		// || label.includes('-{')
		|| PATTERN_en.test(label))
			continue;

		// 後期修正。
		// label = label.replace(/（(.+)）$/, '($1)');
		// TODO: CeL.CN_to_TW() is too slow...
		var tmp = label;
		label = CeL.CN_to_TW(label);
		if (tmp !== label
		// 為人名。
		// "．"
		// || label.includes('·')
		) {
			// 詞條標題中，使用'里'這個字的機會大多了。
			label = label.replace(/裡/g, '里');
			if (foreign_title == label)
				continue;
		}

		var full_title = matched[1] + ':' + foreign_title, data;
		if (!(full_title in label_data)) {
			++count;
			if (count <= log_limit)
				// 此 label 指向
				CeL.log([ count + ':', 'fg=yellow', label, '-fg', '→',
						'fg=cyan', full_title, '-fg',
						'@ [[' + title + ']]: ' + matched[0] ]);
			label_data[full_title] = [ [ label ], [ title ] ];

		} else if (!(data = label_data[full_title])[0].includes(label)) {
			data[0].push(label);
			data[1].push(title);
		}
	}
}

var
/** {Number}未發現之index。 const: 基本上與程式碼設計合一，僅表示名義，不可更改。(=== -1) */
NOT_FOUND = ''.indexOf('_');

function add_item(label) {
	var language = PATTERN_en.test(label) ? 'en' : use_language;
	return {
		language : language,
		value : label,
		add : 1
	};
}

var name_type_hash = {
	5 : '人',
	515 : '城市'
}

// name of person, place, work, book, ...
function name_type(entity) {
	var claims = entity && entity.claims;

	// 作者
	if (claims.P50)
		return '作品名';

	var type,
	// 性質, instance of
	property = claims && entity.claims.P31;
	if (Array.isArray(property)) {
		property.some(function(value) {
			value = value.mainsnak.datavalue.value.value['numeric-id'];
			if (value && (value in name_type_hash))
				return type = name_type_hash[value];
		});

		if (type)
			return type;

		// TODO: 大學
	}

	// 接攘, 所在行政區, 面積
	if (claims.P47 || claims.P131 || claims.P2046)
		return '地名';
}

var summary_prefix = '[[w:' + use_language + ':', summary_postfix = ']]',
//
summary_sp = summary_postfix + ', ' + summary_prefix;

function push_work(full_title) {
	// CeL.log(full_title);
	var foreign_title = full_title.match(/^([a-z]{2,}):(.+)$/),
	//
	language = foreign_title[1],
	//
	labels = label_data[full_title], titles;
	foreign_title = foreign_title[2];
	titles = labels[1];
	labels = labels[0];

	wiki.data({
		title : foreign_title,
		language : language
	}, function(entity) {
		if (count > test_limit)
			return;

		// console.log([ language, foreign_title ]);
		// console.log(entity);

		// 使用Wikidata數據來清理跨語言連結。例如將[[:ja:日露戦争|日俄戰爭]]轉成[[日俄戰爭]]，避免「在條目頁面以管道連結的方式外連至其他語言維基頁面」。

		// TODO: 檢查重定向頁

		// local title
		var local_title = CeL.wiki.data.title_of(entity, use_language);

		if (local_title && (local_title = local_title.title)) {
			// 標的語言wikipedia存在所欲連接/指向的頁面。
			source_hash[full_title].forEach(function(title) {
				wiki.page(title).edit(function(page_data) {
					var
					/**
					 * {String}page content, maybe undefined. 頁面內容 =
					 * revision['*']
					 */
					content = CeL.wiki.content_of(page_data),
					// [ link, local title ]
					pattern = new RegExp('\\[\\[:' + language + '\\s*:\\s*'
					//
					+ CeL.to_RegExp_pattern(foreign_title)
					//
					+ '(?:\\|([^\\[\\]]+))?\\]\\]', 'g');

					return content.replace(pattern, function(link, local) {
						return '[[' + local_title
						//
						+ (local && !foreign_title.toLowerCase()
						// [[:en:Day|地球日]] → [​[日|地球日]]
						.includes(local.toLowerCase())
						// [[:en:name of person, book, place, work|無論是什麼奇怪譯名]] →
						// [​[中文全名]] (譯名已匯入 wikidata aliases)
						&& !name_type(entity)
						//
						? '|' + local
						// [[:en:Day (disambiguation)]] → [​[日 (消歧義)|日]]
						// [[:en:Day (disambiguation)|日]] → [​[日 (消歧義)|日]]
						// [[:en:Day (disambiguation)|Day]] → [​[日 (消歧義)|日]]
						: / \(([^()]+)\)$/.test(local_title) ? '|'
						// [[:en:Day]] → [​[日]]
						// [[:en:Day|日]] → [​[日]]
						// [[:en:Day|Day]] → [​[日]]
						// [[:en:First Last]] → [​[中文全名]]
						// [[:en:First Last|First]] → [​[中文全名]]
						: '')
						//
						+ ']]';
					});
				}, {
					bot : 1,
					summary : 'bot test: 以[[d:' + entity.id
					//
					+ ']]來清理跨語言連結[[' + local_title + ']]'
				});
			});
		}

	}).edit_data(function(entity) {
		if (++count > test_limit) {
			// throw 'Ignored: Test done.';
			return [ CeL.wiki.edit.cancel, 'skip' ];
		}

		if (!entity || ('missing' in entity)) {
			return [ CeL.wiki.edit.cancel,
			//
			'missing [' + (entity && entity.id) + ']' ];
		}

		// 要編輯（更改或創建）的資料。
		var data;

		CeL.log(entity.id
		//
		+ ': [[' + language + ':' + foreign_title + ']]: ' + labels);

		// 注意: 若是本來已有某個值（例如 label），採用 add 會被取代。或須偵測並避免更動原有值。
		if (use_language in entity.labels) {
			var index = labels.indexOf(
			// 去除重複 label。
			entity.labels[use_language].value);
			if (index !== NOT_FOUND) {
				if (labels.length === 1) {
					// assert: index === 0
					return [ CeL.wiki.edit.cancel,
					// No labels to set.
					'已無剩下需要設定之新 label。' ];
				}
				labels.splice(index, 1);
			}

			data = {};

		} else {
			// 直接登錄。
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
		summary : 'bot test: import label/alias from ' + summary_prefix
		//
		+ titles.slice(0, 8).join(summary_sp)
		//
		+ summary_postfix
	});
}

/**
 * Finish up. 最後結束工作。
 */
function finish_work() {
	if (count) {
		CeL.fs_write(
		//
		base_directory + data_file_name, JSON.stringify(label_data), 'utf8');
	} else {
		count = Object.keys(label_data).length;
	}
	CeL.log(script_name + ': All ' + count + ' labels.');
	count = 0;

	for ( var full_title in label_data) {
		push_work(full_title);
	}
}

// ----------------------------------------------------------------------------

// CeL.set_debug();

// rm import_label_from_wiki_link/labels.json
prepare_directory(base_directory);

// read cache.
label_data = CeL.fs_read(base_directory + data_file_name, 'utf8');
if (label_data) {
	// read cache
	label_data = JSON.parse(label_data);
	finish_work();

} else {
	label_data = CeL.null_Object();

	// Set the umask to share the xml dump file.
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
