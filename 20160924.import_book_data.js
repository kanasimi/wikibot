/*

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('ja');

/** {String}預設之編輯摘要。總結報告。編集内容の要約。 */
summary = 'Synchronize data of books';

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),

/** {revision_cacher}記錄處理過的文章。 */
processed_data = new CeL.wiki.revision_cacher(base_directory + 'processed.'
		+ use_language + '.json'),

// ((Infinity)) for do all
test_limit = 1,

set_properties = ('著者,ジャンル,前作,次作'
// 以下為配合各自版本的屬性
+ ',挿絵画家,分類,作品の使用言語,出版日,発行者,ページ数').split(','),
//
set_properties_hash = CeL.null_Object(),

all_properties = {
	著者 : 'author',
	// 原語 : 'P364',
	//
	// ジャンル or: 著作物の主題 (P921): e.g., "[[紀伝体]]の歴史書", "[[長編小説]]",
	// "長編小説、ファンタジー小説、ハイ・ファンタジー、冒険小説"
	ジャンル : 'genre',
	前作 : 'preceded_by',
	次作 : 'followed_by',

	// 以下屬性會另外處置，不放在((set_properties))中。
	題名 : 'title',
	公式サイト : 'website',
	// 著作物の本国
	本国 : 'country',
	// id
	// {{ISBN|...}}
	'ISBN-13' : 'id',
	'ISBN-10' : 'id',
	// {{NCID|...}}
	'CiNii book ID' : 'id',
	// {{OCLC|...}}
	OCLC : 'id',

	// 以下為配合各自版本的屬性
	// 原版之插畫家。但即使原版也應算做版本之一，因此除非原作品已不可能再版，否則還是應該設定於該版本下。
	挿絵画家 : 'illustrator',
	// "訳者"應該配合各版本。須配合各版本的屬性，不應直接設定於主屬性下，而該設定於該版本下。
	訳者 : 'translator',
	// 形態: e.g., "[[上製本]]・並製本", "ハードカバー", "B6版"
	分類 : 'type',
	作品の使用言語 : 'language',
	出版日 : 'published',
	発行者 : 'publisher',
	ページ数 : 'pages',

	読み仮名 : '',
	imported_from : ''
},
//
all_properties_array = Object.keys(all_properties).sort(),

//
PATTERN_ISBN_1 = /{{ *ISBN *\|([^{}]+)}}/ig, PATTERN_ISBN_2 = /ISBN(?:-?1[03][: ]+| *)([\d-]+X?)/ig,
//
PATTERN_NCID = /{{ *NCID *\|([^{}]+)}}/g, PATTERN_OCLC = /{{ *OCLC *\|([^{}]+)}}/g;

function add_property(object, key, value) {
	if (!value) {
		return;
	}
	if (key in object) {
		var old = object[key];
		if (Array.isArray(old)) {
			if (!old.includes(value)) {
				old.push(value);
			}
		} else if (old !== value) {
			object[key] = [ old, value ];
		}
	} else {
		object[key] = value;
	}
}

function add_ISBN(matched, data) {
	if (matched && (matched = matched[1].replace(/-/g, '').trim()
	//
	.replace(/^ISBN\s*/i, ''))) {
		if (matched.length === 13 || matched.length === 10) {
			add_property(data, 'ISBN-' + matched.length, matched);
		} else {
			CeL.err('Invalid ISBN: ' + matched);
		}
	}
}

var PATTERN_only_common_characters = CeL.wiki.PATTERN_only_common_characters,
//
PATTERN_COUNTRY_TEMPLATE = /{{ *[Ff]lag(?:icon)? *\| *([^{}\|]{2,9})}}/g,
/**
 * 振り仮名 / 読み仮名 の正規表現。
 * 
 * @type {RegExp}
 */
PATTERN_読み仮名 = CeL.RegExp(/^[\p{Hiragana}\p{Katakana}ー・･ 　]+$/);

function for_each_page(page_data, messages) {
	if (!page_data || ('missing' in page_data)) {
		// error?
		return [ CeL.wiki.edit.cancel, '條目已不存在或被刪除' ];
	}

	if (page_data.ns !== 0) {
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

	var parser = CeL.wiki.parser(page_data);
	if (CeL.wiki.content_of(page_data) !== parser.toString()) {
		// debug 用. check parser, test if parser working properly.
		throw 'Parser error: [[' + page_data.title + ']]';
	}

	function for_data_template(token) {
		if (token.name !== '基礎情報 書籍') {
			return;
		}

		// console.log(book_title);
		wiki.page(page_data).edit_data(function(entity) {
			var parameters = token.parameters,
			//
			book_title = parameters.title
			//
			&& parameters.title.toString().replace(/^『(.+)』$/, '$1').trim(),
			//
			data_title = entity.value('label'),
			//
			data = CeL.null_Object(),
			//
			value, matched;

			if (book_title) {
				book_title = /<br(?: [^<>]*)?>/i.test(book_title)
				//
				? book_title.split(/\s*<br(?: [^<>]*)?>\s*/i) : [ book_title ];

				book_title = book_title.map(function(title) {
					return CeL.wiki.plain_text(
					//
					title.replace(/^[:：]/, '')
					//
					.replace(/^[（(]([^（()）]+)[)）]$/, '$1')
					//
					.replace(/^『([^『』]+)』$/, '$1')
					//
					.replace(/\s*(?:第\d+|再)版/g, '')
					// 前篇 / 後篇
					// 上 / 中 / 下 / 続
					.replace(/(?:^|\s)[前中後上下続](?:篇|\s*\/|$)/g, ''));

				}).filter(function(title) {
					if (!title || title.length < 2 || title === data_title
					// @see PATTERN_non_CJK @ CeL.wiki
					|| !/[^\u0000-\u2E7F]{2}/i.test(title)
					//
					|| PATTERN_only_common_characters.test(title)) {
						return;
					}
					if (title.includes('{{')) {
						// e.g., "{{lang|en|title}}"
						// e.g., "title{{Small|sub-title}}"
						CeL.err('Invalid parameters.title: [' + title + ']');
					} else if (PATTERN_読み仮名.test(title)) {
						// 對於仮名，或可考慮加至仮名，但有像是[[魏志倭人伝]]，並不全是日文作品。
						// 片仮中点（半角）→ 片仮中点
						data.読み仮名 = title.replace(/･/g, '・');
					} else {
						// TODO: 可能有其他語言，如原文、英語的標題。
						return true;
					}

				}).uniq();

				if (book_title.length < 2) {
					book_title = book_title[0];
				}
			}

			if (book_title) {
				if (data_title && (Array.isArray(book_title) ?
				//
				!book_title.includes(data_title)
				//
				: !data_title.includes(book_title))) {
					CeL.err(
					//
					'Different title: [[' + page_data.title + ']]'
					//
					+ (!book_title || book_title === page_data.title ? ''
					//
					: ' (' + book_title + ')')
					//
					+ ' vs. data: [' + data_title + ']');
				}

				data.題名 = book_title;
			}

			// id:
			CeL.debug(JSON.stringify(entity), 3);
			CeL.debug(JSON.stringify(entity.value(all_properties)), 2);

			for ( var parameter in set_properties_hash) {
				value = parameters[parameter];
				if (value && (value = CeL.wiki.plain_text(value.toString()))) {
					data[set_properties_hash[parameter]]
					// e.g., data.題名 = 'ABC'
					= value;
					// = [ use_language + 'wiki', value ];
				}
			}

			if (value = parameters.country) {
				value = value.toString().trim().replace(
				//
				PATTERN_COUNTRY_TEMPLATE, function(all, code) {
					code = code.trim();
					if (code in country_alias) {
						// [[code]]
						return country_alias[code] + '|';
					}
					// CeL.err('Unknown country code: [' + code + ']');
					return all;

				}).replace(/{{([A-Z\-\d]{2,9})}}/g, function(all, code) {
					if (code in country_alias) {
						// [[code]]
						return country_alias[code] + '|';
					}
					return all;
				});

				value = CeL.wiki.plain_text(value).trim().split(/\s*\|\s*/)
				//
				.filter(function(country) {
					if (/[{\[]{2}/.test(country)) {
						CeL.err('Unknown country: [' + country + ']');
					} else {
						return !!country;
					}
				});
				if (value.length > 0) {
					data.本国 = [ use_language + 'wiki', value ];
				}
			}

			if (value = parameters.website) {
				value = value.toString().trim();
				matched = value.match(/(https?:\/\/[^\s\|]+)/);
				if (matched) {
					matched = matched[1]
					//
					.replace(/\]$/, '').replace(/}}.*/, '');
				}
				if (matched && !matched.includes('{{')) {
					data.公式サイト = matched;
				} else if (CeL.wiki.plain_text(value)) {
					CeL.err('Unknown link: "' + value + '"');
				}
			}

			if (value = parameters.id) {
				value = value.toString();
				while (matched = PATTERN_ISBN_1.exec(value)) {
					add_ISBN(matched, data);
				}
				while (matched = PATTERN_ISBN_2.exec(value)) {
					add_ISBN(matched, data);
				}

				while (matched = PATTERN_NCID.exec(value)) {
					add_property(data, 'CiNii book ID', matched[1].trim());
				}
				while (matched = PATTERN_OCLC.exec(value)) {
					add_property(data, 'OCLC', matched[1].trim());
				}
			}

			if (CeL.is_empty_object(data)) {
				return [ CeL.wiki.edit.cancel, 'skip' ];
			}

			data.references = {
				imported_from : use_language + 'wiki'
			};

			CeL.debug(JSON.stringify(data), 3);
			return data;
		}, {
			bot : 1,
			summary : summary
		});
	}

	parser.each('template', for_data_template);
}

// ----------------------------------------------------------------------------

// CeL.set_debug(2);

prepare_directory(base_directory);

// 因為數量太多，只好增快速度。
CeL.wiki.query.default_lag = 0;

var old_properties = 'P1739,P957,P212,P243,P143,P136,P1104,P407,P856,P577,P31,P155,P110,P495,P156,P123,P50,P655,P1814,P1476';

// console.log(all_properties_array.join(','));
CeL.wiki.data.search.use_cache(all_properties_array, function(id_list) {
	// 與之前的資料做比對，預防萬一被改掉了。
	if (id_list.join(',') !== old_properties) {
		CeL.err('Different properties:\nold: ' + old_properties + '\nnew: '
				+ id_list.join(',') + '\n' + all_properties_array.join(','));
		return;
	}

	set_properties.forEach(function(property) {
		var index = all_properties_array.indexOf(property);
		if (!(index in id_list)) {
			throw 'Not found: ' + property;
		}
		set_properties_hash[all_properties[property]]
		// 採用屬性 id. e.g., 著者: .author = 'P50'
		// = id_list[index]
		// 採用屬性名稱. e.g., 著者: .author = '著者'
		= property;
	});
	// console.log(JSON.stringify(set_properties_hash));

	CeL.wiki.cache([ {
		type : 'embeddedin',
		list : 'Template:基礎情報 書籍',
		reget : true,
		operator : function(list) {
			this.list = list;
		}

	} ], function() {
		var list = this.list;
		// list = [ '' ];
		CeL.log('Get ' + list.length + ' pages.');
		if (1) {
			// 設定此初始值，可跳過之前已經處理過的。
			list = list.slice(0 * test_limit, 1 * test_limit);
			CeL.log(list.slice(0, 8).map(function(page_data) {
				return CeL.wiki.title_of(page_data);
			}).join('\n') + '\n...');
		}

		wiki.work({
			each : for_each_page,
			// 不作編輯作業。
			no_edit : true,
			summary : summary
		}, list);

	}, {
		// default options === this
		namespace : 0,
		// [SESSION_KEY]
		session : wiki,
		// title_prefix : 'Template:',
		// cache path prefix
		prefix : base_directory
	});

}, {
	session : wiki
});

// ----------------------------------------------------------------------------

// https://ja.wikipedia.org/wiki/Template:Flagicon
// [[Template:country flag alias ]]

var country_alias = {
	UK : 'イギリス',
	UN : '国際連合',
	DEU1871 : 'ドイツ帝国',
	DEU1919 : 'ヴァイマル共和政',
	DEU1935 : 'ナチス・ドイツ',
	// 東ドイツ
	DDR : 'ドイツ民主共和国',
	FRG : '西ドイツ',
	GBR2 : 'イギリス',
	GBR3 : 'イギリス',
	GBR4 : 'イギリス',
	GBR5 : 'イギリス帝国',
	RUS1883 : 'ロシア帝国',

	AFG : 'アフガニスタン',
	AIA : 'アンギラ',
	ALB : 'アルバニア',
	ALG : 'アルジェリア',
	AND : 'アンドラ',
	ANG : 'アンゴラ',
	ARG : 'アルゼンチン',
	ARM : 'アルメニア',
	ARU : 'アルバ',
	ASA : 'アメリカ領サモア',
	ATG : 'アンティグア・バーブーダ',
	AUS : 'オーストラリア',
	AUT : 'オーストリア',
	AZE : 'アゼルバイジャン',
	BAH : 'バハマ',
	BAN : 'バングラデシュ',
	BAR : 'バルバドス',
	BDI : 'ブルンジ',
	BEL : 'ベルギー',
	BEN : 'ベナン',
	BER : 'バミューダ諸島',
	BHU : 'ブータン',
	BHR : 'バーレーン',
	BIH : 'ボスニア・ヘルツェゴビナ',
	BIZ : 'ベリーズ',
	BLR : 'ベラルーシ',
	BOL : 'ボリビア',
	BOT : 'ボツワナ',
	BRA : 'ブラジル',
	BRU : 'ブルネイ',
	BUL : 'ブルガリア',
	BUR : 'ブルキナファソ',
	CAF : '中央アフリカ',
	CAM : 'カンボジア',
	CAN : 'カナダ',
	CAY : 'ケイマン諸島',
	CCK : 'ココス諸島',
	CGO : 'コンゴ共和国',
	CHA : 'チャド',
	CHI : 'チリ',
	CHN : '中国',
	CHO : '朝鮮',
	CIV : 'コートジボワール',
	CMR : 'カメルーン',
	COD : 'コンゴ民主共和国',
	COK : 'クック諸島',
	COL : 'コロンビア',
	COM : 'コモロ',
	CPV : 'カーボベルデ',
	CRC : 'コスタリカ',
	CRO : 'クロアチア',
	CUB : 'キューバ',
	CUR : 'キュラソー島',
	CYP : 'キプロス',
	CZE : 'チェコ',
	DEN : 'デンマーク',
	DJI : 'ジブチ',
	DMA : 'ドミニカ国',
	DOM : 'ドミニカ共和国',
	ECU : 'エクアドル',
	EGY : 'エジプト',
	ENG : 'イングランド',
	ERI : 'エリトリア',
	ESA : 'エルサルバドル',
	ESH : '西サハラ',
	ESP : 'スペイン',
	EST : 'エストニア',
	ETH : 'エチオピア',
	FIJ : 'フィジー',
	FIN : 'フィンランド',
	FLK : 'フォークランド諸島',
	FRA : 'フランス',
	FRO : 'フェロー諸島',
	FSM : 'ミクロネシア連邦',
	GAB : 'ガボン',
	GAM : 'ガンビア',
	GBR : 'イギリス',
	GBS : 'ギニアビサウ',
	GEO : 'ジョージア国',
	GEQ : '赤道ギニア',
	GER : 'ドイツ',
	GGY : 'ガーンジー',
	GHA : 'ガーナ',
	GIB : 'ジブラルタル',
	GLP : 'グアドループ',
	GRE : 'ギリシャ',
	GRN : 'グレナダ',
	GRL : 'グリーンランド',
	GUA : 'グアテマラ',
	GUF : 'フランス領ギアナ',
	GUI : 'ギニア',
	GUM : 'グアム',
	GUY : 'ガイアナ',
	HAI : 'ハイチ',
	HKG : '香港',
	HON : 'ホンジュラス',
	HUN : 'ハンガリー',
	IMN : 'マン島',
	INA : 'インドネシア',
	IND : 'インド',
	IOT : 'イギリス領インド洋地域',
	IRI : 'イラン',
	IRL : 'アイルランド',
	IRQ : 'イラク',
	ISL : 'アイスランド',
	ISR : 'イスラエル',
	ISV : 'アメリカ領ヴァージン諸島',
	ITA : 'イタリア',
	IVB : 'イギリス領ヴァージン諸島',
	JAM : 'ジャマイカ',
	JEY : 'ジャージー',
	JOR : 'ヨルダン',
	JPN : '日本',
	KAZ : 'カザフスタン',
	KEN : 'ケニア',
	KGZ : 'キルギス',
	KIR : 'キリバス',
	KOR : '韓国',
	KOS : 'コソボ',
	KSA : 'サウジアラビア',
	KUW : 'クウェート',
	LAO : 'ラオス',
	LAT : 'ラトビア',
	LBA : 'リビア',
	LBR : 'リベリア',
	LCA : 'セントルシア',
	LES : 'レソト',
	LIB : 'レバノン',
	LIE : 'リヒテンシュタイン',
	LTU : 'リトアニア',
	LUX : 'ルクセンブルク',
	MAC : 'マカオ',
	MAD : 'マダガスカル',
	MAR : 'モロッコ',
	MAS : 'マレーシア',
	MAW : 'マラウイ',
	MDA : 'モルドバ',
	MDV : 'モルディブ',
	MEX : 'メキシコ',
	MGL : 'モンゴル',
	MHL : 'マーシャル諸島',
	MKD : 'マケドニア',
	MLI : 'マリ',
	MLT : 'マルタ',
	MNE : 'モンテネグロ',
	MNP : '北マリアナ諸島',
	MOM : 'マルタ騎士団',
	MON : 'モナコ',
	MOZ : 'モザンビーク',
	MRI : 'モーリシャス',
	MSR : 'モントセラト',
	MTN : 'モーリタニア',
	MTQ : 'マルティニーク',
	MYA : 'ミャンマー',
	NAM : 'ナミビア',
	NCA : 'ニカラグア',
	NCL : 'ニューカレドニア',
	NED : 'オランダ',
	NEP : 'ネパール',
	NGR : 'ナイジェリア',
	NIG : 'ニジェール',
	NIR : '北アイルランド',
	NIU : 'ニウエ',
	NOR : 'ノルウェー',
	NRU : 'ナウル',
	NZL : 'ニュージーランド',
	OMA : 'オマーン',
	PAK : 'パキスタン',
	PAN : 'パナマ',
	PAR : 'パラグアイ',
	PCN : 'ピトケアン諸島',
	PER : 'ペルー',
	PHI : 'フィリピン',
	PLE : 'パレスチナ',
	PLW : 'パラオ',
	PNG : 'パプアニューギニア',
	POL : 'ポーランド',
	POR : 'ポルトガル',
	PRK : '北朝鮮',
	PUR : 'プエルトリコ',
	PYF : 'フランス領ポリネシア',
	QAT : 'カタール',
	REU : 'レユニオン（VAR制定）',
	ROC : '中華民国',
	ROU : 'ルーマニア',
	RSA : '南アフリカ共和国',
	RUS : 'ロシア',
	RWA : 'ルワンダ',
	SAM : 'サモア',
	SCO : 'スコットランド',
	SEN : 'セネガル',
	SEY : 'セーシェル',
	SHN : 'セントヘレナ',
	SIN : 'シンガポール',
	SKN : 'セントクリストファー・ネイビス',
	SLD : 'シーランド公国',
	SLE : 'シエラレオネ',
	SLO : 'スロベニア',
	SMR : 'サンマリノ',
	SOL : 'ソロモン諸島',
	SOM : 'ソマリア',
	SRB : 'セルビア',
	SRI : 'スリランカ',
	SSD : '南スーダン',
	STP : 'サントメ・プリンシペ',
	SUD : 'スーダン',
	SUI : 'スイス',
	SUR : 'スリナム',
	SVK : 'スロバキア',
	SWE : 'スウェーデン',
	SWZ : 'スワジランド',
	SXM : 'シント・マールテン',
	SYR : 'シリア',
	TAN : 'タンザニア',
	TGA : 'トンガ',
	THA : 'タイ',
	TIB : 'チベット（ガンデンポタン）',
	TJK : 'タジキスタン',
	TKL : 'トケラウ',
	TKM : 'トルクメニスタン',
	TLS : '東ティモール',
	TOG : 'トーゴ',
	TPE : 'チャイニーズタイペイ',
	TRI : 'トリニダード・トバゴ',
	TRNC : '北キプロス・トルコ共和国',
	TUN : 'チュニジア',
	TUR : 'トルコ',
	TUV : 'ツバル',
	UAE : 'アラブ首長国連邦',
	UGA : 'ウガンダ',
	UKR : 'ウクライナ',
	URU : 'ウルグアイ',
	USA : 'アメリカ合衆国',
	UZB : 'ウズベキスタン',
	VAN : 'バヌアツ',
	VAT : 'バチカン',
	VEN : 'ベネズエラ',
	VIE : 'ベトナム',
	VIN : 'セントビンセント・グレナディーン',
	WAL : 'ウェールズ',
	WLF : 'ウォリス・フツナ',
	YEM : 'イエメン',
	ZAM : 'ザンビア',
	ZIM : 'ジンバブエ',
	EAT : 'タンガニーカ',
	EAZ : 'ザンジバル',
	SRP : 'スルプスカ共和国',
	'GE-AJ' : 'アジャリア自治共和国',
	'GR-69' : 'アトス自治修道士共和国',
	'RS-VO' : 'ヴォイヴォディナ',
	'UZ-QR' : 'カラカルパクスタン共和国',
	ETR : '東トルキスタン',
	SMG : '南モンゴル（内蒙古）'
};
