// cd /d D:\USB\cgi-bin\program\wiki && node 20150916.Multiple_issues.v2.js use_language=en
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
require('../wiki loader.js');

login_options.configuration_adapter = adapt_configuration;

var reget_data = true,

/** {String}編輯摘要。總結報告。 */
summary = '規範多個問題模板',

/** {Object}設定頁面所獲得之手動設定 manual settings。 */
configuration,

/** {String}{{Multiple issues}}/{{多個問題}}模板名 */
Multiple_issues_template_name = 'Multiple issues',
/** {Array}{{多個問題}}模板初始別名 alias */
Multiple_issues_template_alias_list = [],
// assert: template_count_to_be_split < template_count_to_be_merged
/** {Number}須拆分模板數 */
template_count_to_be_split = 1,
/** {Number}須合併模板數 */
template_count_to_be_merged = 3,
/** {Number}列入報表的最低模板數 */
template_count_to_be_reported = template_count_to_be_merged + 1,
/**
 * 其他可包含在{{多個問題}}模板中之維基百科維護模板(Wikipedia maintenance templates)
 * 
 * 2018/12/2 remove {{NotChineseTitle}}
 * 
 * @type {Array}
 * 
 * @see [[維基百科:模板訊息/清理]], [[Category:維基百科維護模板]], [[Category:條目訊息模板]], {{Ambox}},
 *      [[WP:HAT#頂註模板]], [[Category:Wikipedia maintenance templates]]
 */
maintenance_template_list = [],
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
maintenance_template_list_to_be_excluded = [],

// [ 維護模板名, 參數 ]
// [\dT:+\-]{25}
維護模板_PATTERN_old_start = /^([^{}=]+)=\s*(20[01]\d-[01]?\d(?:[^\d].*)?|{{CURRENTTIMESTAMP}})/i,
// old style
維護模板_PATTERN_old = new RegExp(維護模板_PATTERN_old_start.source + '$'),
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),
/** {Object} 維護模板本名[{String}維護模板別名/本名] = {String}root 維護模板本名 */
維護模板本名 = Object.create(null),
/** {Array} 維護模板_by_pageid[pageid] = {Array}維護模板 list */
維護模板_by_pageid = [],
//
normalized_count = CeL.wiki.redirects_here.count.bind(null, 維護模板本名);

// ---------------------------------------------------------------------//

// 讀入手動設定 manual settings。
function adapt_configuration(latest_task_configuration) {
	configuration = latest_task_configuration;
	// console.log(configuration);
	// console.log(wiki);

	Multiple_issues_template_name = configuration.Multiple_issues_template_name
			|| Multiple_issues_template_name;
	Multiple_issues_template_alias_list = configuration.Multiple_issues_template_alias_list
			|| Multiple_issues_template_alias_list;

	template_count_to_be_split = +configuration.template_count_to_be_split
			|| template_count_to_be_split;
	template_count_to_be_merged = +configuration.template_count_to_be_merged
			|| template_count_to_be_merged;
	template_count_to_be_reported = +configuration.template_count_to_be_reported
			|| template_count_to_be_reported;
	if (!(1 <= template_count_to_be_split)
			|| !(template_count_to_be_split < template_count_to_be_merged)) {
		throw new Error('模板數量不合理');
	}

	// 維護模板名
	maintenance_template_list = configuration['maintenance template list']
			|| maintenance_template_list;
	maintenance_template_list_to_be_excluded = configuration['maintenance template list to be excluded']
			|| maintenance_template_list_to_be_excluded;

	// 報表添加維護分類
	if (configuration['Categories adding to report']) {
		if (!Array.isArray(configuration['Categories adding to report'])) {
			configuration['Categories adding to report'] = [ configuration['Categories adding to report'] ];
		}
		configuration['Categories adding to report'] = configuration['Categories adding to report']
		//
		.map(function(category_name) {
			return '[[Category:' + category_name + ']]\n';
		}).join('');
	} else {
		configuration['Categories adding to report'] = '';
	}

	// CeL.log('Configuration:');
	// console.log(configuration);
}

// ---------------------------------------------------------------------//

function show_模板(list) {
	return list.map(function(page_data) {
		return page_data.title.replace(/^Template:/i, '');
	}).sort().unique_sorted();
}

// -----------------------------------------

function 處理須拆分的條目(page_data, messages) {
	if (!CeL.wiki.content_of.page_exists(page_data))
		return [ CeL.wiki.edit.cancel, '條目不存在或已被刪除' ];
	if (page_data.ns !== 0)
		return [ CeL.wiki.edit.cancel, '本作業僅處理條目命名空間' ];

	// TODO: 處理把維護模板放在或注解中的條目。
	var matched,
	/** {String}page content, maybe undefined. */
	content = CeL.wiki.content_of(page_data),
	//
	多個問題_模板 = CeL.wiki.parse.template(content,
			Multiple_issues_template_alias_list, true);
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
			+ matched[1] + '}} @ [[' + page_data.title + ']]。可能為被排除之維護模板？');
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
	} else if (use_維護模板.length <= template_count_to_be_split || old_style) {
		// 準備 modify (拆分)
		if (old_style && use_維護模板.length >= template_count_to_be_merged)
			多個問題_模板內容 = '{{' + 多個問題_模板[1] + '|\n' + 多個問題_模板內容 + '}}';
		content = content.slice(0, 多個問題_模板.index) + 多個問題_模板內容 + '\n'
				+ content.slice(多個問題_模板.lastIndex).trimStart();
		CeL.debug('→ ' + content.slice(0, 200), 2, '處理須拆分的條目');
		return content;
	} else {
		// 預期應含有((template_count_to_be_split))以下個(i.e. 不到 2個, 0或1個)
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
	if (!CeL.wiki.content_of.page_exists(page_data))
		return [ CeL.wiki.edit.cancel, '條目不存在或已被刪除' ];
	if (page_data.ns !== 0)
		return [ CeL.wiki.edit.cancel, '本作業僅處理條目命名空間' ];

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
	matched = CeL.wiki.parse.template(content,
			Multiple_issues_template_alias_list, true);

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
	if (多個問題_模板內容.length < template_count_to_be_merged) {
		return [ CeL.wiki.edit.cancel, '資料庫中含有 ' + normalized_count(條目所含維護模板)
		//
		+ '個未重複的維護模板: [' + show_模板(條目所含維護模板)
		//
		+ ']，但自條目內容首段僅抽取出 ' + 多個問題_模板內容.length + '個頁首維護模板，'
		//
		+ (章節維護模板_count > 0 ? '另有 '
		//
		+ 章節維護模板_count + '個章節維護模板，' : '') + '不作合併。'
		//
		+ (章節維護模板_count + 多個問題_模板內容.length < template_count_to_be_merged
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

var maintenance_template_hash = Object.create(null);
function check_maintenance_template_name(page_data) {
	/** {Array} parsed page content 頁面解析後的結構。 */
	var parsed = CeL.wiki.parser(page_data).parse();
	// debug 用.
	// check parser, test if parser working properly.
	if (CeL.wiki.content_of(page_data) !== parsed.toString()) {
		console.log(CeL.LCS(CeL.wiki.content_of(page_data), parsed.toString(),
				'diff'));
		throw 'Parser error: ' + CeL.wiki.title_link_of(page_data);
	}

	var changed;
	// using for_each_token()
	parsed.each('template', function(token, index) {
		if (!Multiple_issues_template_alias_list.includes(token.name))
			return;

		parsed.each.call(token.parameters[1], 'template', function(template) {
			if (!(template.name in maintenance_template_hash)) {
				maintenance_template_hash[template.name] = null;
				changed = true;
			}
		});
	});

	if (changed) {
		maintenance_template_list = Object.keys(maintenance_template_hash);
		CeL.log(JSON.stringify(maintenance_template_list));
	}
}

// ---------------------------------------------------------------------//

// main

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
prepare_directory(base_directory, reget_data);

// CeL.set_debug(6);

wiki.cache([ {
	// part 1: 處理含有{{多個問題}}模板的條目
	file_name : 'Multiple_issues_template_alias_list.'
	//
	+ CeL.wiki.site_name(wiki),
	postfix : '.json',
	type : 'redirects_here',
	reget : reget_data,
	list : function() {
		return Multiple_issues_template_alias_list
		//
		.concat(Multiple_issues_template_name);
	},
	operator : function(list) {
		// list = list.unique();
		// console.log(list);
		Multiple_issues_template_alias_list = list.map(function(template) {
			return template.title.replace(/^Template:/, '');
		});
		Multiple_issues_template_name
		// The first one is the redirect target.
		= Multiple_issues_template_alias_list[0];
	}
}, {
	// @see [[Category:含有多个问题的条目]]
	file_name : 'pages_including_Multiple_issues_template.'
	//
	+ CeL.wiki.site_name(wiki),
	postfix : '.json',
	type : 'embeddedin',
	reget : reget_data,
	// NG: list : previous one: Multiple_issues_template_alias_list
	list : function() {
		return [ Multiple_issues_template_name ];
	},
	// for debug / test
	// limit : 50,
	each_file_name : CeL.wiki.cache.title_only,
	retrieve : function(list) {
		return list;
		return CeL.wiki.unique_list(list);
	},
	operator : function(list) {
		CeL.log('All ' + list.length
		// 含有_多個問題_模板之頁面
		+ ' multiple issues template pages 含有{{多個問題}}模板.');
		if (false) {
			// find all maintenance templates
			wiki.work({
				each : check_maintenance_template_name,
				last : function() {
					process.exit();
				}
			}, list);
			list = [];
			maintenance_template_list = [];
			maintenance_template_list_to_be_excluded = [];
			Multiple_issues_template_name = [];
		}
		this.pages_including_Multiple_issues_template = list;
	}
}, {
	// part 2: 處理含有多個維護模板的條目
	type : 'page',
	// title: title_prefix + Multiple_issues_template_name
	list : function() {
		return Multiple_issues_template_name;
	},
	redirects : 1,
	operator : function(page_data) {
		// 取得 {{多個問題}} 模板以 parse page
		var template_hash = Object.create(null),
		//
		TEMPLATE_PATTERN = /{{{([^{}\|]+)\|/g,
		/** {String}page content, maybe undefined. */
		content = CeL.wiki.content_of(page_data), matched;

		while (matched = TEMPLATE_PATTERN.exec(content)) {
			if (!/\d$/.test(matched = matched[1]))
				template_hash[CeL.wiki.normalize_title(matched)] = null;
		}
		// 處理 ((maintenance_template_list)) setup maintenance_template_list
		maintenance_template_list.forEach(function(name) {
			template_hash[CeL.wiki.normalize_title(name)] = null;
		});
		// CeL.log(template_hash);

		this.維護模板名 = Object.keys(template_hash);
		// CeL.log(JSON.stringify(this.維護模板名));
	}
}, {
	file_name : '須排除之維護模板別名.' + CeL.wiki.site_name(wiki),
	postfix : '.json',
	type : 'redirects_here',
	list : function() {
		return maintenance_template_list_to_be_excluded;
	},
	each_retrieve : function(list) {
		if (list.length > 0) {
			// console.log(list);
			// The first one is the redirect target.
			this.須排除之維護模板名_hash[list[0].title] = null;
		}
	}
}, {
	// 解析出所有維護模板別名
	file_name : '維護模板名.' + CeL.wiki.site_name(wiki),
	postfix : '.json',
	type : 'redirects_here',
	list : function() {
		return this.維護模板名;
	},
	each_retrieve : function(list) {
		if (list.length === 0)
			return list;
		var 本名 = list[0].title;
		if (本名 in this.須排除之維護模板名_hash)
			return [];
		list.forEach(function(page_data) {
			維護模板本名[page_data.title] = 本名;
		});
		return list.slice(0, 1);
	},
	operator : function(list) {
		CeL.log('總共有 ' + list.length + ' 個維護模板名.');
		// console.log(list);
		this.維護模板名 = list;
	}
}, {
	// 含有維護模板的條目
	file_name : '含有維護模板之頁面.' + CeL.wiki.site_name(wiki),
	postfix : '.json',
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
	file_name : '含有太多維護模板之頁面.' + CeL.wiki.site_name(wiki),
	postfix : '.txt',
	list : function() {
		// ** 就算被包含在{{多個問題}}模板中，只要是用"{{維護模板名}}"而非"|維護模板名="的方式，依然會登記此維護模板。

		// this.pages_including_Multiple_issues_template
		// = [ page_data, page_data, ... ]
		var 含有_多個問題_模板之頁面_title = Object.create(null),
		//
		須拆分的條目 = this.須拆分的條目 = [],
		//
		須合併的條目 = this.須合併的條目 = [],
		// 含有多個維護模板的條目_list
		含有太多維護模板之頁面 = [];
		this.pages_including_Multiple_issues_template
		//
		.forEach(function(page_data) {
			含有_多個問題_模板之頁面_title[page_data.title] = null;
		});
		// this.含有維護模板之頁面=[page_data,page_data,...]
		// page_data.維護模板 = [ 維護模板名, 維護模板名, ... ]
		this.含有維護模板之頁面.forEach(function(page_data) {
			var 維護模板_count = normalized_count(page_data.維護模板);
			if (維護模板_count >= template_count_to_be_merged) {
				// 含有((template_count_to_be_merged))個以上維護模板的條目_list
				// 含有三個和三個以上維護模板的條目
				// 處理須合併的條目:
				// 維護模板_count>=template_count_to_be_merged&&不含有{{多個問題}}模板
				// 在須合併維護模板的條目list中，卻不含有{{多個問題}}模板。
				// 注意:這會忽略把維護模板放在{{多個問題}}模板外的條目
				if (!(page_data.title in 含有_多個問題_模板之頁面_title))
					// this.須合併的條目=[page_data,page_data,...]
					須合併的條目.push(page_data);
			} else if (維護模板_count <= template_count_to_be_split) {
				// 處理須拆分的條目:
				// 維護模板_count<=template_count_to_be_split&&含有{{多個問題}}模板
				// 含有{{多個問題}}模板，卻不在可以忽略不處理的條目list或須合併維護模板的條目list中。
				if (page_data.title in 含有_多個問題_模板之頁面_title)
					// this.須拆分的條目=[page_data,page_data,...]
					須拆分的條目.push(page_data);
			} else {
				// others: 可以忽略不處理的條目
				// 含有((>template_count_to_be_split))–((<template_count_to_be_merged))個維護模板的條目_list
				// 含有2個維護模板的條目。不動這些條目。
			}

			if (維護模板_count >= template_count_to_be_reported) {
				// 含有太多維護模板之頁面[維護模板_count]=[page_data,page_data,...]
				if (維護模板_count in 含有太多維護模板之頁面)
					含有太多維護模板之頁面[維護模板_count].push(page_data.title);
				else
					含有太多維護模板之頁面[維護模板_count] = [ page_data.title ];
			}
		});

		var count = 0,
		// 掛有/含有
		title = configuration.report_page
		//
		|| 'User:' + user_name + '/含有太多維護模板之條目',
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
			+ list.length + '條目。\n[['
			// 避免顯示過多。
			+ (list.length <= 1e4 ? list : list.slice(0, 1e4))
			//
			.join(']], [[') + ']]' : '';
		}).reverse().join('\n').replace(/\n{2,}/g, '\n').trim();

		content = '以下列出含有太多維護模板之條目：共' + count + '條目。\n'
		//
		+ '* 本條目會每周更新，毋須手動修正。您可以從'
		//
		+ CeL.wiki.title_link_of(
		//
		configuration.configuration_page_title, '這個頁面')
		//
		+ '更改設定參數。\n'
		// [[WP:DBR]]: 使用<onlyinclude>包裹更新時間戳。
		+ '* 產生時間：<onlyinclude>~~~~~</onlyinclude>\n\n' + '{{see|' + log_to
		//
		+ '}}\n\n{| class="wikitable"\n! 模板數 !! 含有維護模板之條目\n'
		//
		+ content + '\n|}\n\n' + configuration['Categories adding to report'];

		var postfix = ' (template_count_to_be_reported: '
		//
		+ template_count_to_be_reported + ')';

		wiki.page(configuration.counter_page
		//
		|| title + '/計數').edit(String(count), {
			summary : _summary + '數: ' + count + postfix,
			redirects : 1
		});

		wiki.page(title).edit(content, {
			summary : _summary + ': ' + count + '條' + postfix,
			redirects : 1
		});

		return 含有太多維護模板之頁面.map(function(list, index) {
			return index + '	' + list.join('|');
		}).join('\r\n').replace(/(?:\r\n){2,}/g, '\r\n').trim() + '\r\n';
	}
}, {
	file_name : '須拆分的條目.' + CeL.wiki.site_name(wiki),
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
	file_name : '須合併的條目.' + CeL.wiki.site_name(wiki),
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
		summary : summary + ': 拆分維護模板',
		log_to : log_to,
		page_cache_prefix : base_directory + 'page/',
		last : function() {
			wiki.work({
				each : 處理須合併的條目,
				summary : summary + ': 合併維護模板',
				page_cache_prefix : base_directory + 'page/',
				log_to : log_to,
				last : function() {
					routine_task_done('1 week');
				}
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
	含有維護模板之頁面 : Object.create(null),
	須排除之維護模板名_hash : Object.create(null),
});
