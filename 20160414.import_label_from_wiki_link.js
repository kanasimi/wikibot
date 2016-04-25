// cd ~/wikibot && date && time /shared/bin/node 20160414.import_label_from_wiki_link.js && date

/*

 2016/4/14 22:57:45	初版試營運，約耗時 18分鐘執行（不包含 modufy Wikidata，parse and filter page）。約耗時 105分鐘執行（不包含 modufy Wikidata）。
 TODO:
 catch已經完成操作的label
 parse [[西利西利]]山（Mauga Silisili）
 [[默克公司]]（[[:en:Merck & Co.|Merck & Co.]]） → [[默克藥廠]]
 [[哈利伯顿公司]]（[[:en:Halliburton|Halliburton]]） → [[哈里伯顿]]


 https://www.wikidata.org/wiki/Special:Contributions/Cewbot?uselang=zh-tw

 OK:
 [[:en:Urban agriculture|城市農業]]	[[都市農業]]
 [[:en:Time 100: The Most Important People of the Century|时代100：本世纪最重要的人]] [[时代100人：本世纪最重要的人物]]
 [[:en:William Sadler (actor)|威廉·桑德勒]]	[[威廉·托马斯·桑德勒]]
 [[:en:Clancy Brown|克藍西·布朗]]	[[克蘭西·布朗]]
 [[:en:Gil Bellows|吉爾·貝羅斯]]	[[吉爾·貝羅斯]]
 [[莫斯科]]的[[:en:State Historical Museum|國立歷史博物館]]]]	[[莫斯科]]的[[俄羅斯國家歷史博物館]]]]
 [[:en:Pride Week (Toronto)|同性戀自豪節]]	[[骄傲周|同性戀自豪節]]
 [[:en:Wilmslow|威姆斯洛]]	[[威姆斯洛]]
 [[:en:Peshmerga|自由斗士]]	[[佩什梅格|自由斗士]]
 [[:en:Jean-François Lyotard|利奥塔]]	[[让-弗朗索瓦·利奥塔]]
 [[:en:Alexander II of Epirus|亞歷山大二世]]	[[亞歷山大二世 (伊庇魯斯)|亞歷山大二世]]
 [[:en:Taranto|塔蘭托]]	[[塔兰托]]
 [[:en:Piano Concerto No. 2 (Shostakovich)|F大調第2號鋼琴協奏曲]]	[[第2號鋼琴協奏曲 (蕭士達高維契)|F大調第2號鋼琴協奏曲]]
 [[:en:John Flamsteed|弗拉姆斯蒂德]]	[[約翰·佛蘭斯蒂德]]
 [[:en:Samuel Pepys|塞缪尔·匹普斯]]	[[塞缪尔·皮普斯]]
 [[:en:Royal Observatory, Edinburgh|爱丁堡皇家天文台]]	[[愛丁堡皇家天文台]]
 [[:en:Magdalen College, Oxford|牛津大学莫德林学院]]旧图书	[[牛津大学莫德林学院]]旧图书馆
 [[:en:2006 Chinese Grand Prix|2006年中国大奖赛]]	[[2006年中国大奖赛]]
 [[:en:2012 Brazilian Grand Prix|2012年巴西大奖赛]]	[[2012年巴西大奖赛]]
 [[:en:Kármán line|卡門線]]	[[卡門線]]
 [[:en:Colchis|科爾基斯]]	[[科爾基斯]]
 [[:en:Benetton Formula|贝纳通车队]]	[[贝纳通车队]]


 NG:
 *《[[兄弟情人]]》（[[:en:From Beginning to End|''Do Começo ao Fim'']]），巴西（2009）	*《[[兄弟情人]]》（[[兄弟情人|''Do Começo ao Fim'']]），巴西（2009）
 [[:en:German Labour Front|德意志勞動者陣線]]（1933~1945）{{en}}	[[德意志劳工阵线|德意志勞動者陣線]]（1933~1945）{{en}}
 [[:en:Atropatene|亞特羅巴特那]]	[[阿特羅帕特尼王國|亞特羅巴特那]]
 [[:en:Sheba|賽佰邑（示巴）]]	[[示巴王國|賽佰邑（示巴）]]
 [[:en:Walking with Monsters|與巨獸共舞]]	[[与巨兽同行|與巨獸共舞]]

 不當使用:
 [[:en:Gambier Islands|甘比爾]]群島	[[甘比爾群島]]群島
 [[:en:Gambier Islands|甘比爾]]島	[[甘比爾群島]]島

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
count = 0, test_limit = 700,
//
use_language = 'zh', data_file_name = 'labels.json',
// 是否要使用Wikidata數據來清理跨語言連結。
modify_Wikipedia = true;

// ----------------------------------------------------------------------------

wiki.set_data();

var
// label_data['language:title'] = [ { language: {Array}labels }, {Array}titles ]
label_data = CeL.null_Object(),
// [ all link, foreign language, title in foreign language, local label ]
PATTERN_link = /\[\[:\s*?([a-z]{2,})\s*:\s*([^\[\]|#]+)\|([^\[\]|#]+)\]\]/g,
// 改為 non-Chinese
// 2E80-2EFF 中日韓漢字部首補充 CJK Radicals Supplement
PATTERN_none_used_title = /^[\u0000-\u2E7F]+$/i;

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
		// TODO: parse "{{link-en|local title|foreign title}}"

		// wikt, wikisource
		if (matched[1].includes('wik')
		// 光是只有 "category"，代表還是在本 wiki 中，不算外語言。
		|| /^category/i.test(matched[1]))
			continue;

		var foreign_title = matched[2].trim().replace(/_/g, ' ');

		if (foreign_title.length < 2
		// e.g., [[:en:wikt:t|t]]
		|| /^[a-z\s]*:/.test(foreign_title)) {
			continue;
		}

		var original_label = matched[3], 不須轉換成繁體 = use_language !== 'zh',
		// language of ((label))
		language_guessed,
		//
		label = matched[3];

		if (PATTERN_none_used_title.test(label)) {
			// context 上下文 前後文
			// 前面的 foregoing paragraphs, see above, previously stated, precedent
			// 後面的 behind rearwards;back;posteriority;atergo;rearward
			var foregoing = content.slice(matched.index - 80, matched.index)
			// parse "《[[local title]]》 （[[:en:foreign title|foreign]]）"
			// @see PATTERN_duplicate_title
			.match(/\[\[([^\[\]:]+)\]\]\s*['》」]?[（(\s]*$/);
			if (!foregoing
			//
			|| PATTERN_none_used_title.test(label = foregoing[1])) {
				continue;
			}
		}

		label = label.replace(/-{([^{}]*)}-/g, function($0, $1) {
			if (!$1.includes(':'))
				return $1;
			// 台灣正體
			var matched = $1.match(/(zh-tw):([^;]+)/i)
			// 香港繁體, 澳門繁體
			|| $1.match(/(zh-(?:hk|hant[^a-z:]*|mo)):([^;]+)/i);
			if (matched) {
				不須轉換成繁體 = true;
				language_guessed = matched[1].toLowerCase();
				return matched[2].trim();
			}
			matched = $1.match(/zh(?:-[a-z]+):([^;]+)/i);
			return matched && matched[1].trim() || $0;
		})
		// 去掉 "|..." 之後之 label。
		.replace(/\|.*/, '').trim().replace(/_/g, ' ').replace(/<br[^<>]*>/ig,
				' ').replace(/[\s　]{2,}/g, ' ');

		if (label.length < 5
		// && label.length > 1
		// [[:en:Thirty-third government of Israel|第33届]] @ [[以色列总理]]
		// [[en:1st Lok Sabha]] ← [[1屆]] @ [[印度总理]]: [[:en:1st Lok Sabha|1届]]
		// [[en:First Gerbrandy cabinet]] ← [[第一屆]] @ [[荷兰首相]]: [[:en:First
		// Gerbrandy cabinet|第一届]]
		&& /[屆届]$/.test(label)
		// 跳過日期 label
		|| /^\d+月(\d+日)?$/.test(label) || /^\d+年(\d+月)?$/.test(label)) {
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
		.replace(/['》」]+$|^['《「]+/g, '').replace(/'{2,}([^']+)'{2,}/g, '$1')
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
		) {
			continue;
		}

		// 後期修正/繁簡修正。
		// label = label.replace(/（(.+)）$/, '($1)');
		var label_before_convert;
		if (!不須轉換成繁體
		//
		&& (!(language_guessed = CeL.wiki.guess_language(label))
		//
		|| language_guessed === 'zh-cn' || language_guessed === 'zh-hans')) {
			不須轉換成繁體 = true;
			language_guessed = 'zh-hant';
			label_before_convert = label;
			// TODO: CeL.CN_to_TW() is too slow...
			label = CeL.CN_to_TW(label);
			if (label_before_convert !== label) {
				// 詞條標題中，使用'里'這個字的機會大多了。
				label = label.replace(/裡/g, '里').replace(/([王皇太天])後/g, '$1后');
				// 奧托二世
				if (true || /[·．]/.test(label)) {
					// 為人名。
					label = label.replace(/託/g, '托');
				}
			}
		}

		if (foreign_title === label)
			continue;

		// 增加特定語系註記
		function add_label(label, language) {
			var data;
			if (!(full_title in label_data)) {
				++count;
				if (count <= log_limit)
					// 此 label 指向
					CeL.log([ count + ':', 'fg=yellow', label, '-fg', '→',
							'fg=cyan', full_title, '-fg',
							'@ [[' + title + ']]: ' + matched[0] ]);
				label_data[full_title] = data = [ {}, [ title ] ];

			} else {
				data = label_data[full_title];
				if (!data[1].includes(label)) {
					data[1].push(title);
				}
			}

			if (!data[0][language]) {
				data[0][language] = [ label ];
			} else if (!data[0][language].includes(label)) {
				data[0][language].push(label);
			}
		}

		var full_title = matched[1] + ':' + foreign_title;
		add_label(label, language_guessed || use_language);
		if (不須轉換成繁體 && label_before_convert !== label) {
			// 加上 label_before_convert，照理應該是簡體 (zh-cn)。
			// treat zh-hans as zh-cn
			add_label(label_before_convert, 'zh-cn');
		}
	}
}

var
/** {Number}未發現之index。 const: 基本上與程式碼設計合一，僅表示名義，不可更改。(=== -1) */
NOT_FOUND = ''.indexOf('_');

var name_type_hash = {
	5 : '人',
	515 : '城市'
}

// name of person, place, work, book, ...
function name_type(entity) {
	var claims = entity && entity.claims;
	if (!claims)
		return;

	// P50: 作者
	if (claims.P50)
		return '作品名';

	// P57: 導演
	if (claims.P57)
		return '影片名';

	var type,
	// P31: 性質, instance of
	property = claims.P31;
	if (Array.isArray(property)) {
		property.some(function(value) {
			value = value.mainsnak.datavalue.value['numeric-id'];
			if (value && (value in name_type_hash))
				return type = name_type_hash[value];
		});

		if (type)
			return type;

		// TODO: 大學
	}

	// P47: 接攘, P131: 所在行政區, P2046: 面積
	if (claims.P47 || claims.P131 || claims.P2046)
		return '地名';
}

// 去除重複連結用。
// " \t": 直接採 "\s" 會包括 "\n"。
// [ all, text_1, link_1, title_1, text_2, title_2 ]
var PATTERN_duplicate_title = /(['《「]*\s*\[\[([^\[\]:\|]+)(\|[^\[\]:]+)?\]\]\s*['》」]*)\s*([（(]?\s*\[\[\2(\|[^\[\]\|]+)?\]\]\s*[）)]?)/g,
//
summary_prefix = '[[w:' + use_language + ':', summary_postfix = ']]',
//
summary_sp = summary_postfix + ', ' + summary_prefix;

function push_work(full_title) {
	// CeL.log(full_title);
	var foreign_title = full_title.match(/^([a-z]{2,}):(.+)$/),
	//
	language = foreign_title[1],
	//
	labels = label_data[full_title], titles = labels[1];
	foreign_title = foreign_title[2];
	labels = labels[0];

	// TODO: 一次取得多筆資料。
	wiki.data({
		title : foreign_title,
		language : language
	}, 'labels|aliases|claims|sitelinks', modify_Wikipedia && function(entity) {
		if (count > test_limit)
			return;

		// console.log([ language, foreign_title ]);
		// console.log(entity);

		// 使用Wikidata數據來清理跨語言連結。例如將[[:ja:日露戦争|日俄戰爭]]轉成[[日俄戰爭]]，避免「在條目頁面以管道連結的方式外連至其他語言維基頁面」。

		// local title
		var local_title = CeL.wiki.data.title_of(entity, use_language);

		if (!local_title) {
			return;
		}

		// cache
		var type = null;

		// 標的語言wikipedia存在所欲連接/指向的頁面。
		titles.forEach(function(title) {
			wiki.page(title).edit(function(page_data) {
				var
				/**
				 * {String}page content, maybe undefined. 頁面內容 = revision['*']
				 */
				content = CeL.wiki.content_of(page_data),
				// [ link, local title ]
				pattern = new RegExp('\\[\\[:' + language + '\\s*:\\s*'
				//
				+ CeL.to_RegExp_pattern(foreign_title)
				//
				+ '(?:\\|([^\\[\\]]+))?\\]\\]', 'g');

				// TODO: 任[[:en:Island School|英童中學]] (Island
				// School，今稱[[港島中學]]) 創校校長

				var change_to = content.replace_check_near(
				//
				pattern, function(link, local) {
					var converted = '[[' + local_title
					//
					+ (local && !foreign_title.toLowerCase()
					// [[:en:Day|地球日]] → [​[日|地球日]]
					.includes(local.toLowerCase())
					// [[:en:name of person, book, place, work|無論是什麼奇怪譯名]] →
					// [​[中文全名]] (譯名已匯入 wikidata aliases)
					&& !(type === null ? (type = name_type(entity)) : type)
					//
					? local === local_title ? '' : '|' + local
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
					CeL.log('replace ' + use_language
					//
					+ ': ' + link + ' → ' + converted);
					return converted;

				}, function(foregoing) {
					// 有很多類似的[[中文名]]，原名/簡稱/英文/縮寫為[[:en:XXX|XXX]]
					// {{request translation | tfrom =
					// [[:ru:Владивосток|俄文維基百科對應條目]]}}
					return !/原名|[文簡简縮缩]|tfrom/.test(foregoing);
				}, function(behind) {
					return !/原名|[文簡简縮缩]/.test(behind);
				})
				// 去除重複連結。
				// TODO: link_1 雖然可能不同於 link_2，也不存在此頁面，但可能已經被列入 alias。
				// TODO: [[率失真理論]]（[[率失真理论|Rate distortion theory]]）
				.replace(PATTERN_duplicate_title, '$1');

				if (change_to !== content)
					return change_to;

			}, {
				bot : 1,
				summary : 'bot test: 以[[d:' + entity.id
				//
				+ ']]清理跨語言連結[[' + local_title + ']]'
				//
				+ (type ? ' (' + type + ')' : '')
			});
		});

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

		CeL.log(entity.id + ': [[' + language + ':' + foreign_title
		//
		+ ']]: ' + JSON.stringify(labels));

		// 要編輯（更改或創建）的資料。
		var data = CeL.wiki.edit_data.add_labels(labels, entity);

		if (false && data) {
			console.log(data);
			throw 1;
		}

		return data;

	}, {
		bot : 1,
		summary : 'bot: import label/alias from ' + summary_prefix
		//
		+ titles.uniq().slice(0, 8).join(summary_sp)
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
	if (modify_Wikipedia) {
		wiki.run(function() {
			CeL.log(script_name + ': 已更改完 Wikidata。開始處理 ' + use_language
					+ ' Wikipedia 上的頁面。');
		});
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
