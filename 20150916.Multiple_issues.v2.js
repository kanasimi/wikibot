// cd /d D:\USB\cgi-bin\program\wiki && node 20150916.Multiple_issues.v2.js
// 合併/拆分{{多個問題}}模板

/*

 2015/8/29 機器人作業請求 by Cosine02
 2015/9/13 21:24:16–2015/9/16 21:6:33	0.1 版:處理須拆分的條目
 2015/9/19 7:34:11 初版試營運
 2015/9/25 21:19:56	v2:以 CeL.wiki.cache 實作 cache 作業
 2016/2/3 2:12:44 上路前修正 & 完善
 2016/2/20 21:54:45 prepare_directory()

 @see https://en.wikipedia.org/wiki/Wikipedia:AutoWikiBrowser/General_fixes#Multiple_issues_.28MultipleIssues.29

 TODO:
 (old format templates) Corrects casing of exiting parameters
 When not in zeroth section, includes |section=yes parameter
 Does not operate if an article level-2 section has more than one {{Multiple issues}}


 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

var
/** {String}編輯摘要。總結報告。 */
summary = '規範多個問題模板',

/** {String}{{多個問題}}模板名 */
多個問題_模板名 = '多個問題',
/** {{多個問題}}模板初始別名 alias */
多個問題_模板別名_list = '问题条目'.split('|'),
// assert: 須拆分模板數 < 須合併模板數
須拆分模板數 = 1, 須合併模板數 = 3,
/**
 * 其他可包含在{{多個問題}}模板中之維基百科維護模板(Wikipedia maintenance templates)
 * 
 * @type {Array}
 * 
 * @see [[維基百科:模板訊息/清理]], [[Category:維基百科維護模板]], [[Category:條目訊息模板]], {{Ambox}},
 *      [[WP:HAT#頂註模板]]
 */
其他維護模板名 = ('Wikify|未完結|Lead section|专家|Veil|Non-free|plot|Almanac|Like-resume|Cleanup|cleanup-jargon|Untranslated-jargon|external links|Too many sections|Travel guide|real world|Directory|WP|More footnotes|third-party|名稱爭議|TotallyDisputed|copypaste|merge from|merge to|Plot style|Duplicated citations|人物|BLPsources|Link style|Update|Overly detailed|BLP unsourced|Notability Unreferenced|Globalize|Unreferenced|off-topic|Bare URLs|Cleanup-list|Refimprove|補充來源|Repetition|Proofreader needed|copyedit translation|Expert|Expert-subject|COI|coi|Primary sources|dead end|game guide|NotChineseTitle|title|autobiography|overlinked|Orphan|inappropriate tone|Original research|in-universe|advert|unencyclopedic|prose|blpunsourced|fansite|trivia|pov|newsrelease'
		+ '|Expand|Expand language|Expand English|Expand Japanese|Expand Spanish')
		.split('|'),
/**
 * <q>
 那些會導致刪除的tag（比如substub、關注度、notmandarin、merge那幾個）不要合併進去。
 這幾個已經排除。若還有須排除的維護模板請提出。
 </q>
 * 
 * @type {Array}
 * 
 * @see [[Category:刪除模板]]
 */
須排除之維護模板名list = 'Notability|Merged|Merge|Merge from|Merge to|substub|notmandarin|OR|or|Special characters'
		.split('|'),

// [ 維護模板名, 參數 ]
// [\dT:+\-]{25}
維護模板_PATTERN_old_start = /^([^{}=]+)=\s*(20[01]\d-[01]?\d(?:[^\d].*)?|{{CURRENTTIMESTAMP}})/i,
// old style
維護模板_PATTERN_old = new RegExp(維護模板_PATTERN_old_start.source + '$'),
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),
/** {Object} 維護模板本名[{String}維護模板別名/本名] = {String}root 維護模板本名 */
維護模板本名 = CeL.null_Object(),
/** {Array} 維護模板_by_pageid[pageid] = {Array}維護模板 list */
維護模板_by_pageid = [],
//
normalized_count = CeL.wiki.redirects.count.bind(null, 維護模板本名);

// ---------------------------------------------------------------------//

function show_模板(list) {
	return list.map(function(page_data) {
		return page_data.title.replace(/^Template:/i, '');
	}).sort().unique_sorted();
}

// -----------------------------------------

function 處理須拆分的條目(page_data, messages) {
	if (page_data.ns !== 0)
		return [ CeL.wiki.edit.cancel, '本作業僅處理條目命名空間' ];
	if ('missing' in page_data)
		return [ CeL.wiki.edit.cancel, '條目已不存在或被刪除' ];

	// TODO: 處理把維護模板放在或注解中的條目。
	var matched,
	/** {String}page content, maybe undefined. */
	content = CeL.wiki.content_of(page_data),
	//
	多個問題_模板 = CeL.wiki.parse.template(content, 多個問題_模板別名_list, true);
	if (!多個問題_模板)
		return [ CeL.wiki.edit.cancel, '條目中未發現{{tl|多個問題}}。已變更過，資料非最新？' ];

	var 多個問題_模板內容 = 多個問題_模板[2].replace(/^\s*\|/, '').trim().replace(
			/{{CURRENTTIMESTAMP}}/ig, '2015-09-16T00:00:00+00:00'),
	//
	維護模板_PATTERN = /{{([^{}\|]+)(\|[^{}]+)?}}\s*/g,
	//
	use_維護模板 = [];

	/**
	 * e.g., <code>
	 {{多個問題|
	 {{expand|time=2013-05-24T11:26:24+00:00}}
	 {{WP|ACG|time=2015-04-29T16:05:32+00:00}}
	 {{專家|time=2014-12-20}}
	 }}
	 </code>
	 */
	while (matched = 維護模板_PATTERN.exec(多個問題_模板內容)) {
		var template_name = CeL.wiki.normalize_title(matched[1]);
		if (!(template_name in 維護模板本名)) {
			CeL.error('** 發現{{' + 多個問題_模板[1] + '}}中包含 未列於預設維護模板列表 之模板: {{'
			//
			+ matched[1] + '}} @ [[' + page_data.title + ']]');
			// CeL.log(維護模板本名);
		}
		use_維護模板.push(matched[0]);
	}
	// CeL.log(多個問題_模板);
	// CeL.log(use_維護模板);

	var old_style;
	if (use_維護模板.join('').trim() !== 多個問題_模板內容) {
		if (use_維護模板.length === 0 && 維護模板_PATTERN_old_start.test(多個問題_模板內容)) {
			/**
			 * e.g., <code>
			 {{article issues
			 |expert=2010-03-22T06:56:41+00:00
			 |tone=2007-09-14T09:38:15Z
			 |unref=2007-9
			 }}
			 </code>
			 */
			if (多個問題_模板內容.split('|').every(function(token) {
				if (matched = token.trim().match(維護模板_PATTERN_old)) {
					use_維護模板.push('{{' + matched[1].trim() + '|time='
					//
					+ matched[2].trim() + '}}\n');
					return true;
				}
			})) {
				old_style = true;
				// 採用 new style
				多個問題_模板內容 = use_維護模板.join('');
			} else
				use_維護模板 = null;
		} else
			use_維護模板 = null;
	}

	if (!use_維護模板) {
		return [ CeL.wiki.edit.cancel, '無法完全解析'
		//
		+ 多個問題_模板[0].replace(/{{/g, '{{tl|')
		// + ' @ [[' + page_data.title + ']]!'
		];
	} else if (use_維護模板.length <= 須拆分模板數 || old_style) {
		// 準備 modify (拆分)
		if (old_style && use_維護模板.length >= 須合併模板數)
			多個問題_模板內容 = '{{' + 多個問題_模板[1] + '|\n' + 多個問題_模板內容 + '}}';
		content = content.slice(0, 多個問題_模板.index) + 多個問題_模板內容 + '\n'
				+ content.slice(多個問題_模板.lastIndex).trimStart();
		CeL.debug('→ ' + content.slice(0, 200), 2, '處理須拆分的條目');
		return content;
	} else {
		// 預期應含有((須拆分模板數))以下個(i.e. 不到 2個, 0或1個)
		// 維護模板_by_pageid[page_data.pageid] = [ 維護模板名, 維護模板名, ... ]
		var list = 維護模板_by_pageid[page_data.pageid];
		return [ CeL.wiki.edit.cancel,
		//
		page_data.title + ': 解析出 ' + use_維護模板.length + '個維護模板，預期應'
		//
		+ (list ? '僅含有 ' + list.length + '個維護模板: '
		//
		+ show_模板(list) : '不含有維護模板。') ];
	}
}

// -----------------------------------------

function 處理須合併的條目(page_data, messages) {
	if (page_data.ns !== 0)
		return [ CeL.wiki.edit.cancel, '本作業僅處理條目命名空間' ];
	if ('missing' in page_data)
		return [ CeL.wiki.edit.cancel, '條目已不存在或被刪除' ];

	// 這邊 page_data 為自 API 重新得到，非((須合併的條目))之內容。
	var title = page_data.title,
	// 維護模板_by_pageid[page_data.pageid] = [ 維護模板名, 維護模板名, ... ]
	條目所含維護模板 = 維護模板_by_pageid[page_data.pageid];
	if (false && !條目所含維護模板) {
		// assert: 不應至此!
		CeL.warn('處理須合併的條目: 未設定 .維護模板! [[' + title + ']]');
		return [ CeL.wiki.edit.cancel, '未設定維護模板' ];
	}

	if (false)
		CeL.debug('embeddedin資料庫中，[[' + title + ']]含有 '
				+ normalized_count(條目所含維護模板) + '個未重複的維護模板: [' + 條目所含維護模板 + ']',
				2);

	// TODO: 處理把維護模板放在或注解中的條目。
	/** {String}page content, maybe undefined. */
	var content = CeL.wiki.content_of(page_data),
	// 若本來就已經含有{{多個問題}}模板，表示已經過編輯，則放棄之。
	matched = CeL.wiki.parse.template(content, 多個問題_模板別名_list, true);

	if (matched)
		return [ CeL.wiki.edit.cancel, '已含有{{tl|多個問題}}模板' ];

	// 抽取出所有維護模板，再於首個維護模板出現的地方插入{{多個問題}}模板
	var less_index = Infinity, 多個問題_模板內容 = [], 章節維護模板_count = 0;
	條目所含維護模板.forEach(function(template_name) {
		var matched = CeL.wiki.parse.template(content, template_name, true);
		if (!matched) {
			return;
		}
		// 不處理章節
		if (content.slice(0, matched.index).includes('\n==')) {
			章節維護模板_count++;
			return;
		}
		// CeL.log(matched);
		if (matched.index < less_index)
			less_index = matched.index;
		多個問題_模板內容.push(matched);
		// 抽取出此維護模板
		content = content.slice(0, matched.index)
				+ content.slice(matched.lastIndex).trimStart();
	});
	if (多個問題_模板內容.length < 須合併模板數) {
		return [ CeL.wiki.edit.cancel, '資料庫中含有 ' + normalized_count(條目所含維護模板)
		//
		+ '個未重複的維護模板: [' + show_模板(條目所含維護模板)
		//
		+ ']，但自條目內容首段僅抽取出 ' + 多個問題_模板內容.length + '個頁首維護模板，不作合併。'
		//
		+ (章節維護模板_count > 0 ? '另有 '
		//
		+ 章節維護模板_count + '個章節維護模板。' : '')
		//
		+ (章節維護模板_count + 多個問題_模板內容.length < 須合併模板數
		//
		? '或許條目已被編輯過，或維護模板尚有未登記之別名？' : '') ];
	}
	// 盡可能不改變原先維護模板之順序。
	多個問題_模板內容.sort(function(a, b) {
		return a.index - b.index;
	});

	// 插入{{多個問題}}模板
	content = content.slice(0, less_index) + '{{多個問題|\n'
			+ 多個問題_模板內容.map(function(matched) {
				// 維護模板內容
				return matched[0];
			}).join('\n') + '\n}}\n' + content.slice(less_index);
	// CeL.log(content.slice(0, 400));
	return content;
}

// ---------------------------------------------------------------------//

// main

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
prepare_directory(base_directory, true);

// CeL.set_debug(6);

CeL.wiki.cache([ {
	// part 1: 處理含有{{多個問題}}模板的條目
	file_name : '多個問題_模板別名',
	type : 'redirects',
	list : 多個問題_模板別名_list.concat(多個問題_模板名),
	operator : function(list) {
		// list=list.unique();
		多個問題_模板別名_list = list;
	}
}, {
	// @see [[Category:含有多个问题的条目]]
	file_name : '含有_多個問題_模板之頁面',
	type : 'embeddedin',
	// list : previous one: 多個問題_模板別名_list
	each_file_name : CeL.wiki.cache.title_only,
	retrieve : function(list) {
		return CeL.wiki.unique_list(list);
	},
	operator : function(list) {
		CeL.log('All ' + list.length
		//
		+ ' multiple issues template pages 含有{{多個問題}}模板.');
		this.含有_多個問題_模板之頁面 = list;
	}
}, {
	// part 2: 處理含有多個維護模板的條目
	type : 'page',
	list : 多個問題_模板名,
	redirects : 1,
	operator : function(page_data) {
		// 取得 {{多個問題}} 模板以 parse page
		var template_hash = CeL.null_Object(),
		//
		TEMPLATE_PATTERN = /{{{([^{}\|]+)\|/g,
		/** {String}page content, maybe undefined. */
		content = CeL.wiki.content_of(page_data), matched;

		while (matched = TEMPLATE_PATTERN.exec(content)) {
			if (!/\d$/.test(matched = matched[1]))
				template_hash[CeL.wiki.normalize_title(matched)] = null;
		}
		// 處理 ((其他維護模板名)) setup 其他維護模板名
		其他維護模板名.forEach(function(name) {
			template_hash[CeL.wiki.normalize_title(name)] = null;
		});
		// CeL.log(template_hash);

		this.維護模板名 = Object.keys(template_hash);
	}
}, {
	file_name : '須排除之維護模板別名',
	type : 'redirects',
	list : 須排除之維護模板名list,
	retrieve : function(list) {
		var 須排除之維護模板名_hash = CeL.null_Object();
		if (list)
			list.forEach(function(page_data) {
				須排除之維護模板名_hash[page_data.title] = true;
			});
		return 須排除之維護模板名_hash;
	},
	operator : function(list) {
		this.須排除之維護模板名_hash = list;
	}
}, {
	// 解析出所有維護模板別名
	file_name : '維護模板名',
	type : 'redirects',
	list : function() {
		return this.維護模板名;
	},
	each_retrieve : function(list) {
		if (list.length === 0)
			return;
		var 維護模板名 = [], 本名 = list[0].title,
		//
		須排除之維護模板名_hash = this.須排除之維護模板名_hash;
		list.forEach(function(page_data) {
			CeL.debug('維護模板{{' + 本名 + '}}←{{' + page_data.title + '}}', 3);
			維護模板本名[page_data.title] = 本名;
			if (!(page_data.title in 須排除之維護模板名_hash)) {
				維護模板名.push(page_data);
			}
		});
		return 維護模板名;
	},
	operator : function(list) {
		CeL.log('總共有 ' + list.length + ' 個維護模板名.');
		this.維護模板名 = list;
	}
}, {
	// 含有維護模板的條目
	file_name : '含有維護模板之頁面',
	type : 'embeddedin',
	// list : previous one: this.維護模板名
	each_file_name : CeL.wiki.cache.title_only,
	each : function(pages, operation) {
		var title = operation.list,
		//
		含有維護模板之頁面 = this.含有維護模板之頁面;
		pages.forEach(function(page_data) {
			if (page_data.pageid in 含有維護模板之頁面) {
				含有維護模板之頁面[page_data.pageid].維護模板.push(title);
			} else {
				含有維護模板之頁面[page_data.pageid] = page_data;
				page_data.維護模板 = [ title ];
			}
		});
	},
	retrieve : function() {
		var list = [], 含有維護模板之頁面 = this.含有維護模板之頁面;
		for ( var pageid in 含有維護模板之頁面) {
			var page_data = 含有維護模板之頁面[pageid];
			list.push(page_data);
			var 維護模板 = page_data.維護模板;
			// 當同時包含 Refimprove, RefImprove 時會算作兩個，但實質僅一個。
			if (維護模板.includes('RefImprove') && 維護模板.includes('Refimprove')) {
				page_data.維護模板 = 維護模板.map(function(title) {
					return title !== 'RefImprove';
				});
			}
			if (維護模板.includes('Expand language')
			// 當同時包含 Expand English,Expand language 時會算作兩個，但實質僅一個。
			&& (維護模板.includes('Expand English')
			// 因為各種Expand語言模板由{{Expand language}}生成。
			|| 維護模板.includes('Expand Japanese')
			//
			|| 維護模板.includes('Expand Spanish'))) {
				page_data.維護模板 = 維護模板.map(function(title) {
					return title !== 'Expand language';
				});
			}
		}
		return list;
	},
	operator : function(list) {
		CeL.log('含有維護模板之頁面: ' + list.length + ' page(s).');
		this.含有維護模板之頁面 = list;
	}
}, {
	// part 1+2
	// 對含有過多個維護模板的條目作統計
	file_name : '含有太多維護模板之頁面',
	postfix : '.txt',
	list : function() {
		// ** 就算被包含在{{多個問題}}模板中，只要是用"{{維護模板名}}"而非"|維護模板名="的方式，依然會登記此維護模板。

		// this.含有_多個問題_模板之頁面 = [ page_data, page_data, ... ]
		var 含有_多個問題_模板之頁面_title = CeL.null_Object(),
		//
		須拆分的條目 = this.須拆分的條目 = [],
		//
		須合併的條目 = this.須合併的條目 = [],
		// 含有多個維護模板的條目_list
		含有太多維護模板之頁面 = [];
		this.含有_多個問題_模板之頁面.forEach(function(page_data) {
			含有_多個問題_模板之頁面_title[page_data.title] = null;
		});
		// this.含有維護模板之頁面=[page_data,page_data,...]
		// page_data.維護模板 = [ 維護模板名, 維護模板名, ... ]
		this.含有維護模板之頁面.forEach(function(page_data) {
			var 維護模板_count = normalized_count(page_data.維護模板);
			if (維護模板_count >= 須合併模板數) {
				// 含有((須合併模板數))個以上維護模板的條目_list
				// 含有三個和三個以上維護模板的條目
				// 處理須合併的條目: 維護模板_count>=須合併模板數&&不含有{{多個問題}}模板
				// 在須合併維護模板的條目list中，卻不含有{{多個問題}}模板。
				// 注意:這會忽略把維護模板放在{{多個問題}}模板外的條目
				if (!(page_data.title in 含有_多個問題_模板之頁面_title))
					// this.須合併的條目=[page_data,page_data,...]
					須合併的條目.push(page_data);
				if (維護模板_count > 須合併模板數) {
					// 含有太多維護模板之頁面[維護模板_count]=[page_data,page_data,...]
					if (維護模板_count in 含有太多維護模板之頁面)
						含有太多維護模板之頁面[維護模板_count].push(page_data.title);
					else
						含有太多維護模板之頁面[維護模板_count] = [ page_data.title ];
				}
			} else if (維護模板_count <= 須拆分模板數) {
				// 處理須拆分的條目: 維護模板_count<=須拆分模板數&&含有{{多個問題}}模板
				// 含有{{多個問題}}模板，卻不在可以忽略不處理的條目list或須合併維護模板的條目list中。
				if (page_data.title in 含有_多個問題_模板之頁面_title)
					// this.須拆分的條目=[page_data,page_data,...]
					須拆分的條目.push(page_data);
			}
			// others: 可以忽略不處理的條目
			// 含有((>須拆分模板數))–((<須合併模板數))個維護模板的條目_list
			// 含有2個維護模板的條目。不動這些條目。
		});

		var count = 0,
		// 掛有/含有
		title = 'User:' + user_name + '/含有太多維護模板之條目',
		//
		_summary = summary + ': 紀錄含有太多維護模板之條目',
		//
		content = 含有太多維護模板之頁面.map(function(list, index) {
			// 僅紀錄條目命名空間。
			list = list.filter(function(page) {
				return !page.includes(':');
			});
			count += list.length;
			return list.length > 0 ? '|-\n| ' + index + ' || 共'
			// \n\n
			+ list.length + '條目。\n[[' + list.join(']], [[') + ']]' : '';
		}).reverse().join('\n').replace(/\n{2,}/g, '\n').trim();

		content = '以下列出含有太多維護模板之條目：共' + count + '條目。\n'
		//
		+ '* 本條目會每周更新，毋須手動修正。 --~~~~\n{{see|' + log_to
		//
		+ '}}\n\n{| class="wikitable"\n! 模板數 !! 含有維護模板之條目\n'
		//
		+ content + '\n|}\n\n[[Category:按月分类的维基百科维护分类]]\n[[Category:维基百科维护]]'
		//
		+ '\n[[Category:需要维基化的页面]]\n[[Category:维基百科条目清理]]\n'
		//
		+ '[[Category:需要清理的条目]]\n';

		wiki.page(title + '/計數').edit(String(count), {
			summary : _summary + '數: ' + count
		});

		wiki.page(title).edit(content, {
			summary : _summary + ': ' + count + '條'
		});

		return 含有太多維護模板之頁面.map(function(list, index) {
			return index + '	' + list.join('|');
		}).join('\r\n').replace(/(?:\r\n){2,}/g, '\r\n').trim() + '\r\n';
	}
}, {
	file_name : '須拆分的條目',
	list : function() {
		// 於 '含有太多維護模板之頁面' 中設定。
		return this.須拆分的條目;
	},
	operator : function(list) {
		var 須拆分的條目 = this.須拆分的條目 = list;
		if (須拆分的條目.length > 0)
			CeL.log(
			//
			'現累積須拆分的條目: ' + 須拆分的條目.length + '，自[[' + 須拆分的條目[0].title + ']]起。');
		else
			CeL.log('無須拆分的條目。');
	}
}, {
	// 須合併維護模板的條目
	file_name : '須合併的條目',
	list : function() {
		// 於 '含有太多維護模板之頁面' 中設定。
		return this.須合併的條目;
	},
	operator : function(list) {
		var 須合併的條目 = this.須合併的條目 = list;
		if (須合併的條目.length > 0)
			CeL.log(
			//
			'現累積須合併的條目: ' + 須合併的條目.length + '，自[[' + 須合併的條目[0].title + ']]起。');
		else
			CeL.log('無須合併的條目。');
	}
} ], function() {
	var 須合併的條目 = this.須合併的條目;

	/** {Natural|Array}每一項最大處理頁面數。 */
	// 須合併的條目 = 須合併的條目.slice(2700, 3000);
	// this.須拆分的條目 = this.須拆分的條目.slice(0, 0);
	//
	須合併的條目.forEach(function(page_data) {
		維護模板_by_pageid[page_data.pageid] = page_data.維護模板;
	});
	this.須拆分的條目.forEach(function(page_data) {
		維護模板_by_pageid[page_data.pageid] = page_data.維護模板;
	});

	// callback
	wiki.work({
		each : 處理須拆分的條目,
		summary : summary + ':拆分維護模板',
		log_to : log_to,
		page_cache_prefix : base_directory + 'page/',
		last : function() {
			wiki.work({
				each : 處理須合併的條目,
				summary : summary + ':合併維護模板',
				page_cache_prefix : base_directory + 'page/',
				log_to : log_to
			}, 須合併的條目);
		}
	}, this.須拆分的條目);
}, {
	// default options === this
	// [SESSION_KEY]
	// session : wiki,
	title_prefix : 'Template:',
	// cache path prefix
	prefix : base_directory,
	含有維護模板之頁面 : CeL.null_Object()
});
