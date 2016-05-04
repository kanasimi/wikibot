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
 [[:en:List of Romanian counties by population|排名羅馬尼亞第一]]	[[羅馬尼亞各縣人口列表|排名羅馬尼亞第一]]
 [[:en:7400 series|7400系列]]	[[7400系列]]
 *[[馬來西亞]]之[[:en:Law of Malaysia|法律]]	*[[馬來西亞]]之[[马来西亚法律制度|法律]]
 獲得'''[[:en:Institute of Engineering Education Taiwan|IEET認證]]'''	獲得'''[[中華工程教育學會|IEET認證]]'''
 [[:en:German Labour Front|德意志勞動者陣線]]（1933~1945）{{en}}	[[德意志劳工阵线|德意志勞動者陣線]]（1933~1945）{{en}}
 其他的[[:en:Alien language|外星語言]]{{en icon}}	其他的[[宇宙语言学|外星語言]]{{en icon}}

 NG:
 *《[[兄弟情人]]》（[[:en:From Beginning to End|''Do Começo ao Fim'']]），巴西（2009）	*《[[兄弟情人]]》（[[兄弟情人|''Do Começo ao Fim'']]），巴西（2009）
 [[:en:Atropatene|亞特羅巴特那]]	[[阿特羅帕特尼王國|亞特羅巴特那]]
 [[:en:Sheba|賽佰邑（示巴）]]	[[示巴王國|賽佰邑（示巴）]]
 [[:en:Walking with Monsters|與巨獸共舞]]	[[与巨兽同行|與巨獸共舞]]
 [[马克萨斯群岛]] Îles Marquises（也称“[[:en:Marquesas Islands|侯爵夫人群岛]]”）
 ::1984年起[[朝日電視台]]曾播放[[:ja:ナイトライダー|霹靂遊俠]]
 美国[[科罗拉多学院]]（[[:en:Colorado College|Colorado College]]）。	美国[[科罗拉多学院]]（[[科羅拉多學院]]）。
 詳細人物列表請見[[:en:List of Nobel laureates by university affiliation|英文條目：各個大學的諾貝爾得獎主人物列表]]。	詳細人物列表請見[[各大學諾貝爾獎得主列表|英文條目：各個大學的諾貝爾得獎主人物列表]]。
 見[[連鐵]]或[[:ja:大連都市交通|大連電氣鐵道]]。	見[[連鐵]]或[[連鐵|大連電氣鐵道]]。

 不當使用:
 [[:en:Gambier Islands|甘比爾]]群島	[[甘比爾群島]]群島
 [[:en:Gambier Islands|甘比爾]]島	[[甘比爾群島]]島
 並同時包括鄰近的一些小島嶼和一塊在大陸上的[[:en:Marble Hill, Manhattan|飛地]]。	並同時包括鄰近的一些小島嶼和一塊在大陸上的飛地[[大理石山]]。

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
count = 0, length = 0,
// Infinity for do all
test_limit = 20,
//
use_language = 'zh',
// labels.json
data_file_name = 'labels.json',
// 是否要使用Wikidata數據來清理跨語言連結。
modify_Wikipedia = false;

// ----------------------------------------------------------------------------

wiki.set_data();

var
// label_data['language:title'] = [ { language: {Array}labels }, {Array}titles ]
label_data = CeL.null_Object(),
// @see PATTERN_link @ application.net.wiki
// [ all link, foreign language, title in foreign language, local label ]
PATTERN_link = /\[\[:\s*?([a-z]{2,})\s*:\s*([^\[\]|#]+)\|([^\[\]|#]+)\]\]/g,

// 國名或常用字詞。
PATTERN_common_title,

// 改為 non-Chinese
// 2E80-2EFF 中日韓漢字部首補充 CJK Radicals Supplement
PATTERN_none_used_title = /^[\u0000-\u2E7F]+$/i,
//
PATTERN_language_label = CeL.null_Object(),
// @see common_characters @ application.net.wiki
lang_pattern_source = /^[\s\d_,.:;'"!()\-\&<>\\\/]*lang[\s\d_,.:;'"!()\-\&<>\\\/]*$/.source;

function language_label(language) {
	if (language in PATTERN_language_label)
		return PATTERN_language_label[language];

	return PATTERN_language_label[language]
	//
	= new RegExp(lang_pattern_source.replace('lang', language), 'i');
}

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

	// 增加特定語系註記
	function add_label(foreign_language, foreign_title, label, local_language) {
		if (foreign_title === label)
			return;

		if (!local_language)
			local_language = CeL.wiki.guess_language(label);

		if (use_language === 'zh' && (!local_language
		// assert: use_language === 'zh' 才有可能是簡體
		|| local_language === 'zh-cn' || local_language === 'zh-hans')) {
			// 後期修正/繁簡修正。繁體轉換成簡體比較不容易出錯，因此以繁體為主。

			// TODO: CeL.CN_to_TW() is too slow...
			var label_CHT = CeL.CN_to_TW(label);
			if (label_CHT !== label) {
				// 詞條標題中，使用'里'這個字的機會大多了。
				label_CHT = label_CHT.replace(/裡/g, '里').replace(/佔/g, '占')
						.replace(/([王皇太天])後/g, '$1后');
				// 奧托二世
				if (true || /[·．˙]/.test(label_CHT)) {
					// 為人名。
					label_CHT = label_CHT.replace(/託/g, '托');
				}
				if (label_CHT !== label) {
					// 加上轉換成繁體的 label
					add_label(foreign_language, foreign_title, label_CHT,
							'zh-hant');
					if (!local_language)
						// label 照理應該是簡體 (zh-cn)。
						// treat zh-hans as zh-cn
						local_language = 'zh-cn';
				} else {
					// 繁簡標題相同，採用 local_language = 'zh' 即可。
				}
			}
		}

		var data, full_title = foreign_language + ':' + foreign_title;
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
			if (!data[1].includes(title)) {
				data[1].push(title);
			}
		}

		if (!local_language)
			local_language = use_language;

		if (!data[0][local_language]) {
			data[0][local_language] = [ label ];
		} else if (!data[0][local_language].includes(label)) {
			data[0][local_language].push(label);
		}
	}

	var matched;

	// ----------------------------------------------------

	while (matched = PATTERN_link.exec(content)) {
		// @see function language_to_project(language) @ application.net.wiki
		// 以防 incase wikt, wikisource
		if (matched[1].includes('wik')
		// 光是只有 "Category"，代表還是在本 wiki 中，不算外國語言。
		|| /^category/i.test(matched[1])
		// e.g., "日语维基百科"
		|| /[语語文國国][維维]基/.test(matched[3]))
			continue;

		// 外國語言條目名
		var foreign_title = matched[2].trim().replace(/_/g, ' ');

		if (foreign_title.length < 2
		// e.g., [[:en:wikt:t|t]]
		|| /^[a-z\s]*:/.test(foreign_title)) {
			continue;
		}

		var
		// language of ((label))
		language_guessed,
		// 本地條目名 or 本地實際顯示名
		label = matched[3];

		if (PATTERN_none_used_title.test(label)) {
			// context 上下文 前後文
			// 前面的 foregoing paragraphs, see above, previously stated, precedent
			// 後面的 behind rearwards;back;posteriority;atergo;rearward
			var foregoing = content.slice(matched.index - 80, matched.index)
			// parse 括號後附註
			// "《[[local title]]》 （[[:en:foreign title|foreign]]）"
			// @see PATTERN_duplicate_title
			.match(/\[\[([^\[\]:]+)\]\]\s*['》」』〉】〗〕]?[（(\s]*$/);
			if (!foregoing
			//
			|| PATTERN_none_used_title.test(label = foregoing[1])) {
				continue;
			}
		}

		// 排除 [[:en:Day|en]] 之類。
		if (language_label(matched[1]).test(label)
		// 去除國名或常用字詞。 @see [[瓦倫蒂諾·羅西]]
		|| PATTERN_common_title.test(label))
			continue;

		label = label.replace(/-{([^{}]*)}-/g, function($0, $1) {
			if (!$1.includes(':'))
				return $1;
			// 台灣正體
			var matched = $1.match(/(zh-tw):([^;]+)/i)
			// 香港繁體, 澳門繁體
			|| $1.match(/(zh-(?:hk|hant[^a-z:]*|mo)):([^;]+)/i);
			if (matched) {
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
				label = label.slice(0, index - 1)
						+ label.slice(index + foreign_title.length + 1);
		}

		label = label
		// e.g., [[:en:t|''t'']], [[:en:t|《t》]]
		.replace(/['》」』〉】〗〕]+$|^['《「『〈【〖〔]+/g, '').replace(
				/'{2,}([^']+)'{2,}/g, '$1')
		// e.g., [[:en:t|t{{en}}]]
		.replace(/{{[a-z]{2,3}}}/g, '').replace(/{{·}}/g, '·').trim();

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
		|| /[语語文國国]版?$/.test(label)
		// || label.endsWith('學家')
		|| /[學学][家者]$/.test(label)
		// || label.includes('-{')
		) {
			continue;
		}

		// label = label.replace(/（(.+)）$/, '($1)');

		add_label(matched[1], foreign_title, label, language_guessed);
	}

	// ----------------------------------------------------

	// parse 跨語言連結模板
	CeL.wiki.parse.every('{{link-[a-z]+|[a-z]+-link|tsl|illm}}',
	//
	content, function(token) {
		// console.log(token);
		matched = token;

		var foreign_language, foreign_title, label,
		//
		template_name = token[1].toLowerCase();

		// TODO: parse 跨語言連結模板 {{ilh}}
		switch (template_name) {
		case 'tsl':
			// case 'translink':

			// "{{tsl|en|foreign title|local title}}"
			foreign_language = token[2][0];
			foreign_title = token[2][1];
			label = token[2][2];
			break;

		case 'illm':
			// case 'interlanguage link multi':
			// case '多語言連結':
			label = token[2][0];
			if (token[2].WD) {
				// "{{illm|WD=Q1}}"
				foreign_language = 'WD';
				foreign_title = token[2].WD;
			} else {
				// "{{illm|local title|en|foreign title}}"
				foreign_language = token[2][1];
				foreign_title = token[2][2];
			}
			break;

		default:
			// "{{link-en|local title|foreign title}}"
			foreign_language = template_name.startsWith('link-')
			// 5: 'link-'.length, '-link'.length
			? template_name.slice(5) : template_name.slice(0, -5);
			foreign_title = token[2][1];
			label = token[2][0];
			break;
		}

		add_label(foreign_language, foreign_title, label);
	})
}

// ----------------------------------------------------------------------------

function create_label_data() {
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
		after : function() {
			CeL.fs_write(base_directory + data_file_name,
			//
			JSON.stringify(label_data), 'utf8');

			finish_work();
		}
	}, for_each_page);
}

// ----------------------------------------------------------------------------

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
// [ all, text_1, link_1, title_1, middle, text_2, quote_start, title_2,
// quote_end ]
var PATTERN_duplicate_title = /(['《「『〈【〖〔]*\s*\[\[([^\[\]:\|]+)(\|[^\[\]:]+)?\]\]\s*['》」』〉】〗〕]*)([\s,;.!?\/，；。！？／]*)(([（(])?[\s']*\[\[\2(\|[^\[\]\|]+)?\]\][\s,;.!?\/，；。！？／']*([）)])?)/g,
//
summary_prefix = '[[w:' + use_language + ':', summary_postfix = ']]',
// separator
summary_sp = summary_postfix + ', ' + summary_prefix,
// 跨語言
// 有很多類似的[[中文名]]，原名/簡稱/英文/縮寫為[[:en:XXX|XXX]]
// {{request translation | tfrom = [[:ru:Владивосток|俄文維基百科對應條目]]}}
// {{求翻译}}
// 日本稱{{lang|ja|'''[[:ja:知的財産権|知的財産法]]'''}}）
PATTERN_interlanguage = /原[名文]|[英日德法西義韓諺俄](?:字|[语語文國国]字)|[簡简縮缩稱称]|翻[译譯]|translation|language|tfrom/,
// e.g., {{lang|en|[[:en:T]]}}
PATTERN_lang_link = /{{[lL]ang\s*\|\s*([a-z]{2,3})\s*\|\s*(\[\[:\1:[^\[\]]+\]\])\s*}}/g;

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
	wiki.data(language === 'WD' ? foreign_title : {
		title : foreign_title,
		language : language
	}, 'labels|aliases|claims|sitelinks', modify_Wikipedia && function(entity) {
		if (count > test_limit)
			return;

		if (CeL.wiki.data.is_DAB(entity))
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
				pattern = new RegExp('(?:{{' + language
				// TODO: {{languageicon}}
				+ '(?: icon)?}}\s*)?\\[\\[:' + language + '\\s*:\\s*'
				//
				+ CeL.to_RegExp_pattern(foreign_title)
				//
				+ '(?:\\|([^\\[\\]]+))?\\]\\](?:\s*{{'
				//
				+ language + '(?: icon)?}})?', 'g');

				// TODO: 任[[:en:Island School|英童中學]] (Island
				// School，今稱[[港島中學]]) 創校校長

				var change_to = content
				// "{{lang|en|[[:en:Luke Air Force Base|Luke Field空军基地]]}}"
				// → "[[:en:Luke Air Force Base|Luke Field空军基地]]"
				.replace(PATTERN_lang_link, '$2')
				//
				.replace_check_near(pattern, function(link, local) {
					if (local)
						local = local.replace(
						//
						/(?:\s*\()?[英日德法西義韓俄][语語文國国]\)?$/g, '');

					var converted = '[[' + local_title + (local
					//
					&& !foreign_title.toLowerCase()
					// [[:en:Day|地球日]] → [​[日|地球日]]
					.includes(local.toLowerCase())
					// [[:en:Day|en:]] → [​[日 (消歧義)|日]]
					&& !/^[a-z]{2,3}:$/i.test(local)
					// [[:en:name of person, book, place, work|無論是什麼奇怪譯名]] →
					// [​[中文全名]] (譯名已匯入 wikidata aliases)
					&& !(type === null ? (type = name_type(entity)) : type)
					// ↓採用原先之標籤。
					? local === local_title ? '' : '|' + local
					// ↓放棄原先之標籤，採用條目名稱。
					// [[:en:Day (disambiguation)]] → [​[日 (消歧義)|日]]
					// [[:en:Day (disambiguation)|日]] → [​[日 (消歧義)|日]]
					// [[:en:Day (disambiguation)|Day]] → [​[日 (消歧義)|日]]
					: / \([^()]+\)$/.test(local_title)
					// 在 <gallery> 中，"[[t|]]" 無效。
					? '|' + local_title.replace(/ \([^()]+\)$/, '')
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
					return !PATTERN_interlanguage.test(foregoing.slice(-20));
				}, function(behind) {
					return !PATTERN_interlanguage.test(behind.slice(0, 20));
				})

				// 去除重複連結。
				// TODO: 處理 link_1 重定向至 link_2的情況。
				// e.g., [[率失真理論]]（[[率失真理论|Rate distortion theory]]）
				// TODO: link_1 雖然可能不同於 link_2，也不存在此頁面，但可能已經被列入 alias。
				.replace(PATTERN_duplicate_title,
				//
				function(all, text_1, link_1, title_1, middle,
				//
				text_2, quote_start, title_2, quote_end) {
					if (!quote_start && (
					// "相較於[[F404渦輪扇發動機|F404發動機]]，[[F404渦輪扇發動機|F412發動機]]的風扇直徑加大，"
					middle.trim()
					// "{{Unicode|[[Ԓ]] [[Ԓ|ԓ]]}}"
					|| link_1.toLowerCase() === title_2.toLowerCase())) {
						return all;
					}
					if (quote_start ? quote_end : !quote_end) {
						if (/[a-z\d,;.!]$/i.test(link_1)
						// TODO: 檢查是否所接續之下文亦為英文。
						// && /[a-z\d]$/i.test(接續之下文)
						)
							text_1 += ' ';
						// 前後 quote 皆有或皆無。
						return text_1;
					}
					// quote_start與quote_end僅有其一。
					return text_1 + (quote_start || quote_end);
				});

				if (change_to === content)
					// 可能之前已更改過。
					return [ CeL.wiki.edit.cancel, 'skip' ];

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

		if (CeL.wiki.data.is_DAB(entity))
			return [ CeL.wiki.edit.cancel, 'skip' ];

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

		// console.log(data);

		if (!data)
			return [ CeL.wiki.edit.cancel, 'skip' ];

		return data;

	}, {
		bot : 1,
		summary : 'bot: import label/alias from ' + summary_prefix
		// 一般到第5,6個就會被切掉。
		+ titles.uniq().slice(0, 8).join(summary_sp)
		//
		+ summary_postfix
	});
}

/**
 * Finish up. 最後結束工作。
 */
function finish_work() {
	if (!count) {
		count = Object.keys(label_data).length;
	}
	CeL.log(script_name + ': All ' + count + ' labels.');
	count = 0;

	// console.log(PATTERN_common_title);

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
// prepare_directory(base_directory, true);
prepare_directory(base_directory);

label_data = CeL.fs_read(base_directory + data_file_name, 'utf8');
if (label_data) {
	// read cache
	label_data = JSON.parse(label_data);
	PATTERN_common_title = JSON.parse(CeL.fs_read(base_directory
			+ 'common_title.json', 'utf8'));
	PATTERN_common_title = new RegExp(PATTERN_common_title.source,
			PATTERN_common_title.flags);
	finish_work();

} else {
	label_data = CeL.null_Object();

	// Set the umask to share the xml dump file.
	if (typeof process === 'object') {
		process.umask(parseInt('0022', 8));
	}

	if (use_language === 'zh')
		wiki.page('模块:CGroup/地名', function(page_data) {
			// prepare PATTERN_common_title
			PATTERN_common_title = [];
			var matched, pattern = /, *rule *= *'([^']+)'/g,
			/** {String}page content, maybe undefined. 頁面內容 = revision['*'] */
			content = CeL.wiki.content_of(page_data);
			while (matched = pattern.exec(content)) {
				PATTERN_common_title.append(matched[1].split(/;|=>/).map(
						function(name) {
							return name.replace(/^[a-z\-\s]+:/, '').trim()
							//
							.replace(/(?:(?:王|(?:人民)?共和)?[國国]|[州洲]|群?島)$/, '');
						}));
			}
			PATTERN_common_title = PATTERN_common_title.sort().uniq();
			// 保留 ''，因為可能只符合 postfix。 e.g., '共和國'
			if (false && !PATTERN_common_title[0])
				PATTERN_common_title = PATTERN_common_title.slice(1);
			PATTERN_common_title = new RegExp(
					'^(?:國名)(?:(?:王|(?:人民)?共和)?[國国]|[州洲]|群?島)?$'.replace('國名',
							PATTERN_common_title.join('|')));

			CeL.fs_write(base_directory + 'common_title.json',
			//
			JSON.stringify({
				source : PATTERN_common_title.source,
				flags : PATTERN_common_title.flags
			}), 'utf8');

			create_label_data();
		});
	else
		create_label_data();
}