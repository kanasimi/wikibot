/*
// gettext_config:{"id":"convert-interlanguage-link-templates-to-wikilinks"}
'Convert interlanguage link templates to wikilinks'

(cd ~/wikibot && date && hostname && nohup time node 20160517.interlanguage_link_to_wikilinks.js use_language=zh; date) >> interlanguage_link_to_wikilinks/log &

node 20160517.interlanguage_link_to_wikilinks.js use_language=zh
node 20160517.interlanguage_link_to_wikilinks.js use_language=simple

node 20160517.interlanguage_link_to_wikilinks.js use_language=en "debug_pages=Wikipedia:Sandbox"
node 20160517.interlanguage_link_to_wikilinks.js use_language=zh "debug_pages=Wikipedia:沙盒"

node 20160517.interlanguage_link_to_wikilinks.js use_language=zh "debug_pages=明智光秀"
node 20160517.interlanguage_link_to_wikilinks.js use_language=zh "start_from_page=嚴凱泰"
node 20160517.interlanguage_link_to_wikilinks.js use_language=zh "debug_pages=斯堪的纳维亚历史"
node 20160517.interlanguage_link_to_wikilinks.js use_language=zh "debug_pages=亞丁"
node 20160517.interlanguage_link_to_wikilinks.js use_language=zh "debug_pages=公路收費站"

node 20160517.interlanguage_link_to_wikilinks.js use_language=en "debug_pages=1911 Revolution"



 [[:ja:Wikipedia:井戸端/subj/解消済み仮リンクを自動的に削除して]]
 [[:ja:Wikipedia:井戸端/subj/仮リンクの解消の作業手順について]]
 2016/5/20 22:22:41	仮運用を行って。ウィキペディア日本語版における試験運転。

 Workflow 工作流程:
 # 自維基百科 message_set.Category_has_local_page 取得所有包含本地連結的頁面標題文字/條目名稱。
 # 以函數 for_each_page() + for_each_template() 檢查每一個頁面，找出所有跨語言模板。
 # 以函數 for_foreign_page() 檢查跨語言模板模板所指引的外語言條目連結是否合適。
 # 以函數 for_local_page() 檢查外語言條目連結所指向的本地條目連結是否合適。
 # 以函數 check_local_creation_date() 檢查本地頁面是否創建夠久(7天)。新文章必須過一禮拜才能當作穩定，跳過一禮拜內新建（或有更新）頁面，有刪除模板的亦跳過之。
 # 以函數 exclude_talk_page() 排除使用者發言。
 # 對於通過測試的跨語言模板連結，以函數 modify_link() 修改跨語言模板。
 # 以函數 check_page() 收尾每一個頁面的工作。
 # 以函數 check_final_work()寫入報告。

 清理跨語言連結：將已存在本地條目之跨語言連結模板（包含{{tl|illm}}以及其他）轉為一般 wikilink。
 本任務已在jawiki與enwiki穩定定期運行過一段時間。特點為能夠產生結果報告，幫助編輯者快速找出問題所在。

 @see
 https://github.com/liangent/mediawiki-maintenance/blob/master/cleanupILH_DOM.php

 TODO:
 如果來自{{Translation/Ref}}所引起的話，則請檢查<article>參數。
 {{main|{{跨語言連結}}}} → {{main|連結}}, NOT {{main|[[連結]]}} 要把連結也拿掉
 模板解析功能放進 CeL.application.net.wiki.template_functions。 Other configurations moving to wiki.latest_task_configuration.general
 Q6099744 [[Template:Interwiki conflict]]
修正錯用漢字，如日文條目名稱未採用日文漢字。 [[User_talk:Kanashimi#Cewbot_清理偽藍連問題請教：日文條目名稱未採用日文漢字]]
檢查轉換標的頁面是否正在被提刪中。是的話先不轉換。

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
// set_language('ja');
// set_language('en');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),

/** {revision_cacher}記錄處理過的文章。 */
processed_data = new CeL.wiki.revision_cacher(base_directory + 'processed.'
		+ CeL.wiki.site_name(wiki) + '.json'),

// ((Infinity)) for do all
test_limit = 2,

ignore_ns = false,

/** {Natural}剩下尚未處理完畢的頁面數。 */
page_remains,

// https://en.wikipedia.org/wiki/Category:Hatnote_templates
// 並且具備 |l1=
hatnote_list = [ 'Main', 'See also', 'Further' ],

// default parameters 預設index/次序集
// c: foreign_language: foreign language code 外文語言代號
// F: foreign_title: foreign title 外文條目名
// L: local_title: local title 中文條目名
// W: wikidata_entity_id: wikidata entity id 維基數據實體id
// label: label text displayed 顯示名
// preserve: Keep foreign language links when displayed
template_orders = {
	LcF_ja : {
		local_title : 1,
		foreign_language : 2,
		foreign_title : 3,
		label : 'label',
		preserve : [ 'preserve', 'display' ]
	},
	LcF_en : {
		local_title : 1,
		foreign_language : 2,
		// will fallback
		foreign_title : [ 3, 1 ],
		// {{{WD|{{{wd}}}}}}
		WD : [ 'WD', 'wd' ],
		label : 'lt',
		preserve : [ 'preserve', 'display' ]
	},
	cLFl_en : {
		foreign_language : [ 1, 'lang' ],
		local_title : [ 2, 'en' ],
		foreign_title : [ 3, 'lang_title', 2, 'en' ],
		label : [ 4, 'lt', 'display', 'en_text' ]
	},
	cFL : {
		foreign_language : 1,
		foreign_title : 2,
		local_title : [ 3, 2 ],
		label : 4
	},
	LF : {
		local_title : 1,
		foreign_title : [ 2, 1 ],
		label : [ 'd', 3 ],
		foreign_language : 'lang-code'
	},
	LW : {
		local_title : 1,
		WD : 2,
		label : 3
	}
},

gettext = CeL.gettext,

/** {Object}L10n messages. 符合當地語言的訊息內容。 */
message_set = {
	ja : {
		// [[Wikipedia:井戸端/subj/Template:仮リンクに関連する提案#4月10日（合意形成）]]

		// 不知為何，有時會有 Template 明明有解消済み仮リンク、頁面本身具[[Category:解消済み仮リンクを含むページ]]，
		// 卻沒被列於[[Category:解消済み仮リンクを含むページ]]。
		// Category_has_local_page : 'Category:解消済み仮リンクを含むページ',
		Category_has_local_page : [ 'Category:解消済み仮リンクを含む記事',
				'Category:解消済み仮リンクを含むページ' ],
		report_page : '修正が必要な仮リンク',
		fix_category : 'Category:修正が必要な仮リンクを含む記事',
		// 網羅所有 interlanguage link templates。
		// @see
		// https://ja.wikipedia.org/w/index.php?title=%E7%89%B9%E5%88%A5:%E3%83%AA%E3%83%B3%E3%82%AF%E5%85%83/Template:%E4%BB%AE%E3%83%AA%E3%83%B3%E3%82%AF&namespace=10&limit=500&hidetrans=1&hidelinks=1
		template_order_of_name : {
			// {{仮リンク|記事1|en|ABC|label|preserve=1}}
			仮リンク : template_orders.LcF_ja,
			// ={{仮リンク}}
			ill2 : template_orders.LcF_ja,
			// ={{仮リンク}}
			illm : template_orders.LcF_ja,
			// ={{仮リンク}}
			'link-interwiki' : template_orders.LcF_ja,

			日本語版にない記事リンク : template_orders.LcF_ja,

			'internal link helper' : template_orders.LF,
			// →{{Internal link helper/en}}
			'link-en' : Object.assign({
				'|foreign_language' : 'en'
			}, template_orders.LF)
		}
	},

	en : {
		Category_has_local_page : 'Category:Interlanguage link template existing link',
		report_page : 'Interlanguage link templates need to fix',
		fix_category : 'Category:Wikipedia backlog',
		// 2016/11 全部統合到 {{Interlanguage link}}
		template_order_of_name : {
			// When article names would be the same in English and foreign
			// language Wikipedia
			// @see [[:en:Template:Interlanguage link]]
			'interlanguage link' : template_orders.LcF_en,
			// ={{interlanguage link}}
			ill : template_orders.LcF_en,
			// ={{interlanguage link}}
			iii : template_orders.LcF_en,
			// ={{interlanguage link}}
			link : template_orders.LcF_en,
			// ={{interlanguage link}}
			'link-interwiki' : template_orders.LcF_en,

			'interlanguage link forced' : Object.assign({
				'|preserve' : 1
			}, template_orders.LcF_en),
			// ={{Interlanguage link forced}}
			ill2 : Object.assign({
				'|preserve' : 1
			}, template_orders.LcF_en),

			// https://en.wikipedia.org/w/index.php?title=Special%3AWhatLinksHere&hidetrans=1&hidelinks=1&target=Template%3Ainterlanguage+link+multi&namespace=
			'interlanguage link multi' : template_orders.LcF_en,
			// ={{interlanguage link multi}}
			illm : template_orders.LcF_en,

			// {{interlanguage link Wikidata}}
			'interlanguage link wikidata' : template_orders.LcF_en,
			// {{Ill-WD}} = {{interlanguage link Wikidata}}
			'ill-wd' : template_orders.LcF_en,

			'red wikidata link' : template_orders.LcF_en,
			// {{redwd|link target|Wikidata item ID|link title}}
			redwd : template_orders.LcF_en
		}
	},

	zh : {
		Category_has_local_page : [
		// 清理代碼錯誤的條目，之後再回歸日常作業。
		// e.g., 'jp' 不是標準的ISO編碼。
		'Category:內部連結助手模板語言代碼錯誤',
		// 'Category:多語言連結已存在連結',
		'Category:有蓝链却未移除内部链接助手模板的页面' ],
		report_page : '需要修正的跨語言連結',
		// fix_category : 'Category:跨語言連結有問題的頁面', Category:連結格式不正確的條目,
		// Category:维基百科积压工作, Category:需要清理的条目, Category:维基百科条目清理
		// [[User_talk:Kanashimi#Cewbot建議]]
		fix_category : 'Category:維基百科連結清理',
		// TODO: 這邊尚未列舉完成
		template_order_of_name : {
			'interlanguage link multi' : template_orders.LcF_en,
			// ={{interlanguage link multi}}
			illm : template_orders.LcF_en,

			tsl : template_orders.cFL,
			translink : template_orders.cFL,

			'link-zh-yue' : Object.assign({
				'|foreign_language' : 'yue'
			}, template_orders.LF),
			'link-zza' : Object.assign({
				'|foreign_language' : 'diq'
			}, template_orders.LF),
			'zza-link' : Object.assign({
				'|foreign_language' : 'diq'
			}, template_orders.LF),
			ly : Object.assign({
				'|foreign_language' : 'yue'
			}, template_orders.LF),
			// ** 'jp' 不是標準的ISO編碼。
			'link-jp' : Object.assign({
				'|foreign_language' : 'ja'
			}, template_orders.LF),
			lj : Object.assign({
				'|foreign_language' : 'ja'
			}, template_orders.LF),
			lk : Object.assign({
				'|foreign_language' : 'ko'
			}, template_orders.LF),
			ld : Object.assign({
				'|foreign_language' : 'de'
			}, template_orders.LF),
			le : Object.assign({
				'|foreign_language' : 'en'
			}, template_orders.LF)
		}
	},

	// default messages
	'*' : {
		report_notification :
		// gettext_config:{"id":"here-is-a-list-of-interlanguage-links-that-need-to-be-manually-corrected.-this-list-will-be-updated-automatically-by-the-robot"}
		gettext('Here is a list of interlanguage links that need to be manually corrected. This list will be updated automatically by the robot.')
	}
};

// 將 message_set 轉成本地 local message set。
message_set = Object.assign(message_set['*'], message_set[use_language]);

if (use_language === 'zh') {
	'ar,az,be,bg,bs,ca,cs,da,de,el,en,eo,es,et,eu,fa,fi,fr,ga,he,hi,hr,hu,hy,id,is,it,ja,ka,kk,ko,ky,la,lo,lt,lv,mn,ms,my,nl,no,pl,pt,ro,ru,sh,sk,sl,so,sq,sr,sv,ta,te,tg,th,tl,tr,uk,ur,uz,vi,gan,lzh,nan,yue'
	// @see [[Template:Internal_link_helper]]
	.split(',').forEach(function(language_code) {
		var order = Object.assign({
			'|foreign_language' : language_code
		}, template_orders.LF);
		message_set.template_order_of_name
		// {{Internal link helper}}子模板
		['internal link helper/' + language_code] = order;
		message_set.template_order_of_name['ilh/' + language_code] = order;
		message_set.template_order_of_name['link-' + language_code] = order;
		message_set.template_order_of_name[language_code + '-link'] = order;
	});
}

function normalize_parameter(token) {
	var template_name = token.name.toLowerCase(),
	//
	index_order = message_set.template_order_of_name[template_name],
	// 實際使用的 index。
	index_order_exactly = Object.create(null);

	if (!index_order) {
		return;
	}

	var parameters = token.parameters,
	// normalized_parameters
	normalized = {
		index_order : index_order_exactly
	}, parameter_name;

	// 自 parameter 取得頁面標題文字/條目名稱。
	function set_title(index) {
		var parameter = parameters[index];
		if (!parameter) {
			return;
		}

		index_order_exactly[parameter_name] = token.index_of[index];
		// normalize parameter
		parameter = parameter.toString()
		// 去除註解 comments。
		.replace(/<\!--[\s\S]*?-->/g, '').trim();
		if (parameter_name === 'foreign_language'
				&& parameter.toLowerCase() in CeL.wiki.language_code_to_site_alias) {
			normalized.bad_foreign_language = parameter.toLowerCase();
			normalized.bad_token_wikitext = token.toString();
			parameter = token[index][2]
			// 為日文特別修正: 'jp' is wrong! 'jp' 不是標準的ISO編碼。
			= CeL.wiki.language_code_to_site_alias[parameter.toLowerCase()];
		}
		try {
			parameter = decodeURIComponent(parameter).trim();
		} catch (e) {
			CeL.error('URI malformed: [' + parameter + ']');
		}
		normalized[parameter_name] = parameter;
		return true;
	}

	for (parameter_name in index_order) {
		// {Number|String}index of
		var index = index_order[parameter_name];

		if (parameter_name.startsWith('|')) {
			// 非 index，而是直接指定值。
			normalized[parameter_name.slice(1)] = index;
			continue;
		}

		if (Array.isArray(index)) {
			index.some(set_title);

		} else {
			set_title(index);
		}
	}

	return normalized;
}

// ----------------------------------------------------------------------------

function check_final_work() {
	--page_remains;
	// CeL.debug('page_remains: ' + page_remains, 0, 'check_final_work');
	// console.trace('page_remains: ' + page_remains);

	if (page_remains > 0) {
		return;
	}

	// assert: page_remains === 0
	if (page_remains !== 0 || check_final_work.done) {
		throw page_remains;
	}
	check_final_work.done = true;

	wiki.page('User:' + wiki.token.login_user_name
	//
	+ '/' + message_set.report_page, {
		redirects : 1,
		converttitles : 1
	}).edit(function() {
		// console.trace(wiki);
		var messages = [], listed = 0, all = 0,
		//
		data = processed_data[processed_data.KEY_DATA];
		// data: 結果報告。
		// data[local title] = { id : 0, error : {
		// "error name" : [ "error message", "error message", ...],
		// "error name" : [ ... ], ... }
		// })
		for ( var title in data) {
			all++;
			// log limit
			if (messages.length > 6e3
			// template 若存有已存在本地條目之跨語言連結模板，常常會影響數十個嵌入的條目，因此盡量顯示之。
			&& !/^template:/i.test(title)) {
				CeL.log('Skip log of ' + CeL.wiki.title_link_of(title));
				continue;
			}
			listed++;

			var report = data[title],
			//
			error_messages = report.error;
			if (!error_messages) {
				// no error
				continue;
			}

			// TODO: +'<span class="plainlinks">'
			messages.push('; '
			// + 'Special:Redirect/revision/' + report.id + '|'
			+ CeL.wiki.title_link_of(title)
			// https://en.wikipedia.org/wiki/Help:Link#Links_containing_URL_query_strings
			// an external link rather than as an wikilink
			// TODO: use {{fullurl}}
			+ ' ([{{fullurl:' + title + '|action=edit}} '
			// gettext_config:{"id":"edit-mark"}
			+ gettext('edit-mark') + '])');

			Object.keys(error_messages).sort().forEach(function(error_name) {
				messages.push(':; ' + error_name);
				var list = error_messages[error_name];
				if (list.length > 20) {
					messages.append(list.slice(0, 20));
					messages.push(':: ' + gettext(
					// gettext_config:{"id":"a-total-of-$1-occurrences"}
					'... A total of %1 {{PLURAL:%1|occurrence|occurrences}}.'
					//
					, list.length));
				} else {
					messages.append(list);
				}
			});
		}

		if (messages.length > 0) {
			messages.unshift('List ' + (listed === all ? 'all ' + all
			//
			: listed + '/' + all + ' (' + (100 * listed / all | 0) + '%)')
			// 本次報告僅列出所有出問題頁面的大約 ?%。
			+ ' of all problematic pages.',
			//
			message_set.report_notification + '\n'
			// [[WP:DBR]]: 使用<onlyinclude>包裹更新時間戳。
			+ '* ' + gettext(
			// gettext_config:{"id":"report-generation-date-$1"}
			'Report generation date: %1', '<onlyinclude>~~~~~</onlyinclude>')
			//
			+ '\n'
			// + '== Problematic pages ==\n'
			);
			this.summary += ' ' + listed + '/' + all;
			if (message_set.fix_category) {
				messages.push('[[' + message_set.fix_category + ']]');
			}
		} else {
			// Nothing to report.
		}
		return messages.join('\n');

	}, {
		// section : 'new',
		// sectiontitle : '結果報告',
		summary : CeL.wiki.title_link_of(message_set.report_page, gettext(
		// gettext_config:{"id":"cleanup-report-for-interlanguage-link-templates"}
		'Cleanup report for interlanguage link templates')),
		nocreate : 1,
		bot : 1
	});

	// Finally: Write to cache file.
	processed_data.write();

	// done. 結束作業。
}

function for_each_page(page_data, messages) {

	// TODO: 處理模板，並 action=purge&forcelinkupdate=1 更新所有包含模板的頁面
	// https://doc.wikimedia.org/mediawiki-core/master/php/ApiPurge_8php_source.html
	this.pages_finished++;

	// page_data =
	// {pageid:0,ns:0,title:'',revisions:[{revid:0,parentid:0,user:'',timestamp:''},...]}

	var _this = this, template_count = 0, template_parsed,
	/** {String}page title = page_data.title */
	title = CeL.wiki.title_of(page_data),
	/** {Array}記錄確認已經有改變的文字連結。 changed ills. */
	resolved_ills = [],
	/** {Array}語言代碼錯誤的ill。將被修正。 */
	bad_foreign_language_ills = [];
	// console.log(CeL.wiki.content_of(page_data));
	process.title = this.pages_finished + '/' + this.initial_target_length
			+ ' ' + title;

	if (CeL.env.arg_hash && CeL.env.arg_hash.start_from_page) {
		CeL.debug(process.title, 1, 'for_each_page');
	}

	if (!ignore_ns
	// category: 可考慮去掉 message_set.Category_has_local_page
	&& !wiki.is_namespace(page_data, [ 'main', 'File', 'Category' ])
	// Wikipedia
	&& (!wiki.is_namespace(page_data, 'Wikipedia') ||
	// 去掉這些頁面。 e.g., [[Wikipedia:典范条目/存档]]
	/^Wikipedia:(?:典范条目|典範條目|特色內容|特色圖片|特色列表|優良條目|优良条目|削除依頼\/)/.test(title))
	// template
	&& (!wiki.is_namespace(page_data, 'Template')
	// 不處理跨語言連結模板系列。
	|| (title.replace(/\/[\s\S]*$/, '').replace(/^[^:]+:/, '').toLowerCase()
	// 去掉 namespace。
	in message_set.template_order_of_name))) {
		check_final_work();
		return [ CeL.wiki.edit.cancel, '本作業僅處理條目命名空間、模板、Category 或 Wikipedia' ];
	}

	// Check if page_data had processed useing revid.
	if (processed_data.had(page_data)) {
		check_final_work();
		return;
	}

	var overall_resolve, overall_reject;
	function denote_page_processed() {
		// console.trace([ page_remains, title ]);
		overall_resolve();
		// check_final_work() 得要放在本函數 return 之前執行。
		// setTimeout(): 您不能在 callback 中呼叫 .edit() 之類的 wiki 函數！
		// 請在 callback 執行完畢後再執行新的 wiki 函數！
		setTimeout(check_final_work, 0);
	}

	function for_each_template(token, token_index, token_parent) {
		var parameters, normalized_param = normalize_parameter(token), local_title, foreign_language, foreign_title,
		// The Wikidata entity id
		WD;

		/**
		 * 每一個頁面的最終處理函數。需要用到 token。
		 * 
		 * 警告: 必須保證每個 template 結束處理時都剛好執行一次 check_page。
		 * 
		 * @param {String}error_name
		 *            error message.
		 * @param {String}is_information
		 *            It's an information instead of error.
		 */
		function check_page(error_name, is_information) {
			// 初始化本頁之 processed data: 只要處理過，無論成功失敗都作登記。
			var data_to_cache = processed_data.data_of(page_data);

			if (error_name && !is_information) {
				if (!is_information) {
					CeL.log('check_page: ' + error_name + ' @ '
							+ CeL.wiki.title_link_of(title) + ': '
							+ token.toString());
					if (token.error_message) {
						CeL.log(String(token.error_message));
					}
				}

				// 初始化報告。
				// error message list
				var error_list = data_to_cache[is_information ? 'info'
						: 'error'];
				if (!error_list) {
					data_to_cache[is_information ? 'info' : 'error'] = error_list = Object
							.create(null);
				}
				if (!error_list[error_name]) {
					error_list[error_name] = [];
				}
				error_list = error_list[error_name];

				var parent = token, index = normalized_param.index_order.foreign_title, foreign_title = parent[index];
				if (Array.isArray(foreign_title)) {
					parent = foreign_title;
					index = 0;
					foreign_title = parent[index];
				}

				// 格式化連結。
				if (foreign_title
						&& typeof foreign_title === 'string'
						&& !foreign_title.includes('=')
						&& normalized_param.foreign_language
						&& /^[a-z\-]{2,20}$/
								.test(normalized_param.foreign_language)) {
					CeL.debug('parent[' + index + '] : ' + parent[index]
							+ '→[[:' + normalized_param.foreign_language + ':'
							+ foreign_title + '|' + foreign_title + ']]', 3,
							'check_page');
					parent[index] = '[[:' + normalized_param.foreign_language
							+ ':' + foreign_title + '|' + foreign_title + ']]';
				}

				// cache 以在之後回復 recover 用。
				// console.trace(normalized_param);
				var local_title = normalized_param.local_title,
				//
				local_title_index = normalized_param.index_order.local_title;
				if (local_title && (typeof local_title === 'string')) {
					CeL.debug('token[' + local_title_index + '] : '
							+ token[local_title_index] + '→'
							+ CeL.wiki.title_link_of(local_title), 3,
							'check_page');
					token[local_title_index] = CeL.wiki
							.title_link_of(local_title);
				}
				error_list.push(
				// @see wiki_toString @ CeL.wiki
				': <span style="color:#aaa;padding:.2em">{{</span>'
				//
				+ token.map(function(text) {
					return text.toString().replace(/</g, '&lt;')
					//
					.replace(/^([a-z]+=)/i,
					//
					'<span style="color:#6b5;padding-right:.2em">$1</span>');
				}).join('<b style="color:#f40;padding:.2em">|</b>')
						+ '<span style="color:#aaa;padding:.2em">}}</span>');
				if (token.error_message) {
					error_list.push(token.error_message);
				}

				// console.trace(token);
				// 回復 recover: 因為其他模板可能被置換，最後 .toString() 會重新使用所有資訊，因此務必回復原先資訊！
				if (local_title_index in token) {
					CeL.debug('recover: token[' + local_title_index + '] = '
							+ local_title, 3, 'check_page');
					token[local_title_index] = local_title;
				}
				if (index in parent) {
					CeL.debug('recover: parent[' + index + '] = '
							+ foreign_title, 3, 'check_page');
					parent[index] = foreign_title;
				}
				// console.trace(token);
			}

			CeL.debug('template_count: ' + template_count + ' / page_remains: '
					+ page_remains, 2, 'check_page');

			if (--template_count > 0 || !template_parsed) {
				// console.trace([ template_count, template_parsed ]);
				if (template_count < 0) {
					CeL.error('check_page: ' + 'template_count < 0! '
							+ '可能有 template_count++ 之前，沒登記到的 check_page() 呼叫？');
				}
				return;
			}

			CeL.debug('從這裡起，一個頁面應該只會執行一次: ' + CeL.wiki.title_link_of(title)
					+ ' / ' + page_remains, 2, 'check_page');

			if (resolved_ills.length === 0
					&& bad_foreign_language_ills.length === 0) {
				// 沒有需要處理的 ill template。
				denote_page_processed();
				return;
			}

			// console.trace(parsed);
			var last_content = parsed.toString();
			if (CeL.wiki.content_of(page_data) === last_content) {
				CeL.warn('The contents are the same.');
				denote_page_processed();
				return;
			}

			// for debug
			if (false) {
				CeL.log('modify ' + CeL.wiki.title_link_of(title) + ': ');
				// CeL.log(last_content);
				denote_page_processed();
				return;
			}

			var summary = [];
			if (resolved_ills.length > 0) {
				// [[内部リンク]]. cf. [[Help:言語間リンク#本文中]]
				// gettext_config:{"id":"convert-$1-to-wikilink"}
				summary.push(gettext('Convert %1 to wikilink',
				// gettext_config:{"id":"Comma-separator"}
				resolved_ills.join(gettext('Comma-separator'))));
			}
			if (bad_foreign_language_ills.length > 0) {
				if (summary.length === 0) {
					summary.push(gettext(
					// gettext_config:{"id":"convert-interlanguage-link-templates-to-wikilinks"}
					'Convert interlanguage link templates to wikilinks'));
				}
				summary.push('('
				// gettext_config:{"id":"also-fix-bad-language-codes-$1"}
				+ gettext('Also fix bad language codes: %1',
				// gettext_config:{"id":"Comma-separator"}
				bad_foreign_language_ills.join(gettext('Comma-separator')))
						+ ')');
			}
			summary.push('('
			// gettext_config:{"id":"the-bot-operation-is-completed-$1$-in-total"}
			+ gettext('The bot operation is completed %1% in total',
			// 整體作業進度 overall progress
			(100 * _this.pages_finished / _this.initial_target_length)
			//
			.to_fixed(1)) + ')');

			// console.trace(page_data);
			// console.log(last_content);
			wiki.page(page_data
			// && 'Wikipedia:サンドボックス'
			).edit(last_content, {
				// section : 'new',
				// sectiontitle : title,
				summary : summary.join(' '),
				nocreate : 1,
				minor : 1,
				bot : 1
			}, denote_page_processed);
		}

		function modify_link(link_target) {
			// @see [[:en:Template:illm]], [[:ja:Template:仮リンク]]
			if (parameters.preserve || parameters.display) {
				// 不提早回傳可檢查錯誤。
				check_page(gettext(
				// gettext_config:{"id":"preserve-interlanguage-links-because-of-the-preserve-parameter-is-set"}
				'Preserve interlanguage links because of the "preserve" parameter is set.'
				//
				), true);
				// always display
				return;
			}

			if (!link_target) {
				link_target = token.use_link_target || local_title;
			}

			/** {String}link 當前處理的 token 已改成了這段文字。summary 用。 */
			var link = '[[' + link_target,
			// @see [[:en:Template:illm]], [[:ja:Template:仮リンク]],
			// [[:en:Template:ill]]
			/** {String}label text displayed */
			text_displayed = normalized_param.label;
			// console.trace(normalized_param);
			if (text_displayed) {
				if (text_displayed !== link_target) {
					link += '|' + text_displayed;
				}
			} else if (false && /\([^()]+\)$/.test(link_target)) {
				// ↑ 盡可能讓表現/顯示出的文字與原先相同。有必要的話，編輯者會使用 .label。
				// e.g., [[Special:Diff/59967187]]

				// e.g., [[title (type)]] → [[title (type)|title]]
				// 在 <gallery> 中，"[[title (type)|]]" 無效，因此需要明確指定。
				link += '|' + link_target.replace(/\s*\([^()]+\)$/, '');
			}
			link += ']]';

			if (!resolved_ills.includes(link)) {
				// console.trace('記錄確認已經有改變的文字連結。');
				resolved_ills.push(link
						+ (token.additional_summary ? '('
								+ token.additional_summary + ')' : ''));
				CeL.log('modify_link: Adapt @ ' + CeL.wiki.title_link_of(title)
						+ ': ' + token.toString() + ' → ' + link);
			}

			if (CeL.wiki.Yesno(parameters.italic)) {
				// retain italic formatting `|italic=y`
				link = "''" + link + "''";
			}

			if (token.inside_hatnote) {
				link = CeL.wiki.parse(link);
				// https://zh.wikipedia.org/w/index.php?title=%E6%96%AF%E5%A0%AA%E7%9A%84%E7%BA%B3%E7%BB%B4%E4%BA%9A%E5%8E%86%E5%8F%B2&diff=prev&oldid=81848024
				var _link = link[0] + (link[1] || '');
				if (link[2]) {
					if (token.inside_hatnote.length === 2) {
						_link += '|l1=' + link[2];
					} else {
						CeL.error('捨棄 display_text of ' + link);
					}
				}
				// console.trace([ link, _link ]);
				link = _link;
			}

			// 實際改變頁面結構。將當前處理的 template token 改成這段 link 文字。
			token_parent[token_index] = link;

			check_page();
		}

		function exclude_talk_page(page_data) {
			if (wiki.is_talk_namespace(page_data)
			// [[利用者‐会話:Kanashimi#Wikipedia空間の投票コメントの書き換え]]
			// Wikipedia空間には投票コメントなど個人の発言が含まれているため修正しないほうがよいでしょう（例えば今回の仮リンクには「当時、記事は存在していなかった」という記号の役割もあります）。もし個人の発言ページを区別するのが困難なのであれば、Wikipedia空間全体をノート同様に書き換え禁止としたほうが安全です。
			// [利用者‐会話:Kanashimi#Wikipedia空間の仮リンク解消]]
			// 「個人発言」「書き加え」「業務連絡」である会話ページ・ノートページ・Wikipedia空間投票関連では、置き換えをされないほうがよいと思われます
			|| /^Wikipedia:(?:削除依頼|リダイレクトの削除依頼)\//.test(page_data.title)) {
				// gettext_config:{"id":"the-task-does-not-process-talk-pages"}
				check_page(gettext('The task does not process talk pages'));
				return;
			}
			modify_link();
		}

		// 檢查本地頁面是否創建夠久(7天)。新文章必須過一禮拜才能當作穩定，跳過一禮拜內新建（或有更新）頁面，有刪除模板的亦跳過之。
		// TODO: 並且檢查沒掛上刪除模板。
		// TODO: リンク先が曖昧さ回避であるもの（{{要曖昧さ回避}}が後置されている場合も有り）
		function check_local_creation_date(converted_local_title) {
			if (false) {
				console.trace([ converted_local_title, title, foreign_language,
						foreign_title ]);
			}
			wiki.page(converted_local_title, function(page_data) {
				// console.trace(page_data);
				// console.trace(page_data.response.query.redirects);
				// console.trace(CeL.wiki.content_of(page_data));
				if (page_data.title === title) {
					// @see [[w:en:MOS:CIRCULAR]]
					CeL.info('Skip '
							+ CeL.wiki.title_link_of(converted_local_title)
							+ ': ' + gettext(
							// gettext_config:{"id":"the-local-link-target-links-back-to-the-page-itself.-mos-circular"}
							'The local link target links back to the page itself. [[MOS:CIRCULAR]]?'
							//
							));
					check_page(gettext(
					// gettext_config:{"id":"the-local-link-target-links-back-to-the-page-itself.-mos-circular"}
					'The local link target links back to the page itself. [[MOS:CIRCULAR]]?'
					//
					));

				} else if (Date.now() - page_data.creation_Date > 7 * 24 * 60
						* 60 * 1000) {
					exclude_talk_page(page_data);

				} else {
					CeL.info('Skip '
					//
					+ CeL.wiki.title_link_of(converted_local_title) + ': '
					//
					+ gettext(
					// gettext_config:{"id":"the-local-page-is-too-new.-will-try-again-next-time"}
					'The local page is too new. Will try again next time.'));
					check_page(gettext(
					// gettext_config:{"id":"the-local-page-is-too-new.-will-try-again-next-time"}
					'The local page is too new. Will try again next time.'),
							true);
				}
			}, {
				// 順便取得頁面內容。
				// prop : 'revisions',
				prop : '',
				redirects : 1,
				converttitles : 1,
				// save_response : true,
				get_creation_Date : true
			});
		}

		function remove_disambiguation_postfix(page_title) {
			// [[忍者 (電影)]] 不等同於 [[忍者 (電視劇)]]
			return page_title.replace(/ \((?:disambiguation|消歧義|消歧义)\)$/i, '');
		}

		function for_local_page(converted_local_title) {
			// converted_local_title: foreign_title 所對應的本地條目。

			if (wiki.is_namespace(converted_local_title,
					[ 'Draft', 'Template' ])) {
				// gettext_config:{"id":"links-to-non-main-namespace"}
				CeL.error('Links to non-main namespace' + ' @ '
						+ CeL.wiki.title_link_of(title) + ': ' + token);
				// gettext_config:{"id":"links-to-non-main-namespace"}
				check_page(gettext('Links to non-main namespace'));
				return;
			}

			if (!converted_local_title || converted_local_title !== local_title
			// Keep interlanguage link template if the target page is redirect.
			// リダイレクトの記事化が望まれる場合。
			// e.g., {{仮リンク|redirect=1}}
			|| parameters.redirect) {
				// TODO: {{仮リンク|譲渡性個別割当制度|en|Individual fishing quota}}
				// → [[漁獲可能量|譲渡性個別割当制度]]

				if (converted_local_title
				// && converted_local_title !== local_title
				&& remove_disambiguation_postfix(converted_local_title)
				//
				=== remove_disambiguation_postfix(local_title)) {
					CeL.log(
					//
					'converted_local_title 與 local_title 僅相差消歧義後綴: '
					//
					+ CeL.wiki.title_link_of(converted_local_title)
					//
					+ ' ' + CeL.wiki.title_link_of(local_title));
					// https://zh.wikipedia.org/w/index.php?title=User_talk:Kanashimi&oldid=prev&diff=81310730#%E5%81%BD%E8%97%8D%E9%80%A3%E6%B8%85%E7%90%86%E5%BB%BA%E8%AD%B0
					// check_local_creation_date(converted_local_title);
					// return;
				}

				// TODO: 處理繁簡轉換的情況:有可能目標頁面存在，只是繁簡不一樣。
				// TODO: 地區詞處理。
				wiki.redirect_to(local_title,
				// 檢查 parameters 指定的本地連結 local_title 是否最終也導向
				// converted_local_title。
				function(redirect_data, page_data) {
					if (false) {
						console.trace(converted_local_title);
						console.log('redirect_data of ' + local_title + ': '
								+ JSON.stringify(redirect_data));
					}
					if (!converted_local_title) {
						// 從外語言條目連結無法取得本地頁面的情況。
						if (redirect_data) {
							// 存在本地頁面。e.g., redirected page
							check_page(gettext(
							// gettext_config:{"id":"missing-converted-local-page-or-the-foreign-local-page-is-not-link-to-wikidata"}
							'缺少轉換後的本地頁面，或者外部/本地頁面未鏈接到維基數據。'));
						} else {
							// 忽略本地頁面不存在，且從外語言條目連結無法取得本地頁面的情況。
							// 此應屬正常。
							check_page('Both not exist', true);
						}
						return;
					}

					if (Array.isArray(redirect_data)) {
						// TODO: Array.isArray(redirect_data)
						console.log(redirect_data);
						throw new Error('Array.isArray(redirect_data)');
					}
					if (redirect_data && redirect_data.to_link) {
						// is #REDIRECT [[title#section]]
						redirect_data = redirect_data.to_link;
					}

					if (redirect_data && parameters.redirect && local_title
					//
					!== CeL.wiki.title_of(redirect_data)) {
						check_page(
						// リダイレクトの記事化が望まれる場合。
						'Keep interlanguage link template for redirected target page.'
						//
						, true);
						return;
					}

					if (redirect_data
					// assert: 若 ((converted_local_title === redirect_data))，
					// 則本地頁面 converted_local_title 存在。
					&& converted_local_title === redirect_data) {
						// local_title 最終導向 redirect_data ===
						// converted_local_title。
						// 直接採用 parameters 指定的 title，不再多做改變；
						// 盡可能讓表現/顯示出的文字與原先相同。
						// e.g., [[w:ja:Special:Diff/59964828]]
						// TODO: [[w:ja:Special:Diff/59964827]]
						check_local_creation_date(converted_local_title);
						return;

						// ↓ deprecated
						if (!parameters.label) {
							// 盡可能讓表現/顯示出的文字與原先相同。
							parameters.label = local_title;
						}
						// local_title 最終導向 redirect_data ===
						// converted_local_title。
						local_title = redirect_data;
						// [[local_title]] redirect to:
						// [[redirect_data]] = [[converted_local_title]]
						for_local_page(converted_local_title);
					}

					if (foreign_title === local_title) {
						if (
						// 必須去除 foreign_title: [[T]] 相對應的 converted_local_title
						// 為 [[T (A)]] 的情況。不過這時該改的是錯誤的多語言模板本身。
						// CeL.wiki.data.is_DAB(local_title_data)
						converted_local_title !== local_title
						// 不包括缺省的設定。
						&& normalized_param.index_order.foreign_title
						//
						!== normalized_param.index_order.local_title) {
							check_page(
							// gettext_config:{"id":"the-local-title-in-the-interlanguage-template-is-same-as-the-foreign-language-title-but-the-foreign-page-directs-to-a-different-local-title"}
							'跨語言模板的本地標題與外語標題相同，但外語頁面導向不同的本地標題。');
							return;
						}

						if (converted_local_title !== local_title) {
							// 可直接換成本地標題。但必須改 link_target。
							token.use_link_target = converted_local_title;
						}
						// [[w:zh:Wikipedia:列明来源#文獻參考的格式]]:
						// 如果參考了非中文文獻，請不要把該參考文獻用中文列出，而是應該使用該文獻的原始語言。
						if (false) {
							parameters.label = foreign_title;
						}
						token.additional_summary = gettext(
						// gettext_config:{"id":"the-local-title-in-the-interlanguage-template-is-same-as-the-foreign-language-title"}
						'跨語言模板的本地標題與外語標題相同');
						check_local_creation_date(converted_local_title);
						return;
					}

					if (converted_local_title
					// 本地頁面標題包含連結中的本地標題。
					&& converted_local_title.includes(local_title)) {
						// 可直接換成本地標題。但必須改 link_target。
						token.use_link_target = converted_local_title;
						token.additional_summary = gettext(
						// gettext_config:{"id":"local-page-title-contains-the-local-title-in-the-interlanguage-template"}
						'Local page title contains the local title in the interlanguage template'
						//
						);
						check_local_creation_date(converted_local_title);
						return;
					}

					token.error_message
					//
					= redirect_data ? redirect_data === local_title ? ''
					//
					: ' → ' + CeL.wiki.title_link_of(redirect_data) : ': '
					// gettext_config:{"id":"does-not-exist"}
					+ gettext('Does not exist');
					token.error_message = ':: '
					// gettext_config:{"id":"from-the-parameter-of-template"}
					+ gettext('From the parameter of template') + ': '
							+ CeL.wiki.title_link_of(local_title) + ' '
							+ token.error_message + '. '
							// gettext_config:{"id":"from-foreign-language-title"}
							+ gettext('From foreign language title') + ': '
							+ (converted_local_title
							//
							? CeL.wiki.title_link_of(converted_local_title)
							// gettext_config:{"id":"does-not-exist"}
							: gettext('Does not exist'));

					// gets form langlinks
					// TODO: Q6099744 [[Template:Interwiki conflict]]
					// 由於一些重定向不是常用的名稱，因此由機器人直接重定向可能不太妥當。這時仍需人工判別。
					// test:
					// <!-- リダイレクト先の「[[...]]」は、[[:en:...]] とリンク -->
					check_page(gettext(
					// gettext_config:{"id":"the-local-title-is-different-from-the-one-given-by-the-template-parameters"}
					'The local title is different from the one given by the template parameters.'
					//
					));
				});
				return;
			}

			// TODO: {{enlink}}

			check_local_creation_date(converted_local_title);
		}

		function for_foreign_page(foreign_page_data) {
			if (!CeL.wiki.content_of.page_exists(foreign_page_data)) {
				// 需要手動修正的錯誤: 可能純粹為了註記關聯性（譯名）而存在，因此缺 foreign page。
				check_page(gettext(
				// gettext_config:{"id":"the-corresponding-foreign-language-page-does-not-exist"}
				'The corresponding foreign language page does not exist.'));
				// TODO: 可能對調了本地語言與外語參數。
				return;
			}

			if (!foreign_page_data.pageprops) {
				CeL.warn(
				// 沒 .pageprops 的似乎大多是沒有 Wikidata entity 的？
				'for_foreign_page: No foreign_page_data.pageprops: [[:'
						+ foreign_language + ':' + foreign_title + ']] @ '
						+ CeL.wiki.title_link_of(title));
			} else if ('disambiguation' in foreign_page_data.pageprops) {
				// 仮リンクに記された「他言語版へのリンク先」が曖昧さ回避であるもの
				// gettext_config:{"id":"the-corresponding-foreign-language-page-is-a-disambiguation-page"}
				check_page(gettext('The corresponding foreign language page is a disambiguation page.'));
				return;
			}

			// @see wiki_API.redirect_to
			// e.g., [ { from: 'AA', to: 'A', tofragment: 'aa' } ]
			var redirect_data = foreign_page_data.response.query.redirects;
			if (redirect_data) {
				if (redirect_data.length !== 1) {
					CeL.warn('for_foreign_page: Get ' + redirect_data.length
							+ ' redirect links for '
							+ CeL.wiki.title_link_of(title) + '!');
					console.log(redirect_data);
				}
				// 僅取用第一筆資料。
				redirect_data = redirect_data[0];
				// test #REDIRECT [[title#section]]
				if (redirect_data.tofragment) {
					// [[ja:Help:セクション]]
					// gettext_config:{"id":"the-corresponding-foreign-language-page-is-redirected-to-a-section"}
					check_page(gettext('The corresponding foreign language page is redirected to a section.'));
					return;
				}
			}

			if (foreign_page_data.title !== foreign_title) {
				// 他言語版項目リンク先が違う記事。
				// 照理來說應該是重定向頁面。
				if (!foreign_page_data.title
						|| foreign_title.toLowerCase() !== foreign_page_data.title
								.toLowerCase()) {
					CeL.log('for_foreign_page: different foreign title: '
							+ CeL.wiki.title_link_of(foreign_language + ':'
									+ foreign_title)
							+ ' → '
							+ CeL.wiki.title_link_of(foreign_language + ':'
									+ foreign_page_data.title) + ' @ '
							+ CeL.wiki.title_link_of(title)
							+ ' (continue task)');
				}
				foreign_title = foreign_page_data.title;
			}

			if (false) {
				console.trace([ foreign_language, foreign_title,
						foreign_page_data ]);
			}
			CeL.wiki.langlinks([ foreign_language,
			// check the Interlanguage link.
			foreign_title ], for_local_page, CeL.wiki.add_session_to_options(
					wiki, {
						// e.g., {{Ill|George B. Sennett|George Burritt
						// Sennett}}
						// @ [[w:en:Special:Diff/1227543178]]
						multi : false,
						redirects : 1,
						converttitles : 1
					}));

		}

		function for_WD(entity, error) {
			if (error || !entity) {
				check_page(gettext(
				// gettext_config:{"id":"the-corresponding-foreign-language-page-does-not-exist"}
				'The corresponding foreign language page does not exist.'));
				return;
			}

			if (CeL.wiki.data.is_DAB(entity)) {
				// gettext_config:{"id":"the-corresponding-foreign-language-page-is-a-disambiguation-page"}
				check_page(gettext('The corresponding foreign language page is a disambiguation page.'));
				return;
			}

			for_local_page(CeL.wiki.data.title_of(entity, use_language));
		}

		// ------------------------------------------------------------------------------
		// main work for each link

		if (!normalized_param) {
			// 非跨語言連結模板。

			if (wiki.is_template(token, hatnote_list)) {
				CeL.wiki.parser.parser_prototype.each.call(token, function(
						subtoken) {
					if (CeL.wiki.is_parsed_element(subtoken))
						subtoken.inside_hatnote = token;
				}, wiki.append_session_to_options({
					add_index : true
				}));
			}
			return;
		}

		// console.trace(normalized_param);
		token.page_data = page_data;
		// console.log(token);
		parameters = token.parameters;
		local_title = normalized_param.local_title;
		if (
		// normalized_param.bad_foreign_language
		normalized_param.bad_token_wikitext) {
			// 同時修正錯誤語言代碼：這邊的token已經是修正過的。
			bad_foreign_language_ills.push(normalized_param.bad_token_wikitext);
		}
		foreign_language = normalized_param.foreign_language;
		foreign_title = normalized_param.foreign_title;
		WD = normalized_param.WD;
		CeL.debug('normalized_param: ' + JSON.stringify(normalized_param));

		// ------------------------------------------------------------------------------
		// `template_count++` 之後所有 return 都必須經過 check_page()。之前皆直接 return。
		template_count++;

		// [[w:en:User talk:Kanashimi/Archive 1#Links to draft]]
		if (wiki.is_namespace(local_title, [ 'Draft', 'Template' ])
				|| wiki.is_namespace(foreign_title, [ 'Draft', 'Template' ])) {
			// gettext_config:{"id":"links-to-non-main-namespace"}
			CeL.error('Links to non-main namespace' + ' @ '
					+ CeL.wiki.title_link_of(title) + ': ' + token);
			// gettext_config:{"id":"links-to-non-main-namespace"}
			check_page(gettext('Links to non-main namespace'));
			return;
		}

		if (local_title && /^https?:\/\//i.test(local_title)
		// e.g., [[Special:PermanentLink/72981220|馮仁稚]]
		|| foreign_title && /^https?:\/\//i.test(foreign_title)) {
			CeL.error('Get URL @ ' + CeL.wiki.title_link_of(title) + ': '
					+ token);
			check_page(gettext(
			// gettext_config:{"id":"syntax-error-in-the-interlanguage-link-template"}
			'Syntax error in the interlanguage link template.'));
			return;
		}

		if (foreign_language && foreign_language.includes('{')
		//
		&& !foreign_language.includes('}')) {
			CeL.error('parser error @ ' + CeL.wiki.title_link_of(title) + '?');
			console.trace(token);
		}

		if (local_title && foreign_language && foreign_title) {
			// 這裡用太多 CeL.wiki.page() 並列處理，會造成 error.code "EMFILE"。
			wiki.page([ foreign_language, foreign_title ], for_foreign_page, {
				// https://www.mediawiki.org/w/api.php?action=help&modules=query%2Bpageprops
				query_props : 'pageprops',
				redirects : 1,
				// 處理繁簡轉換的情況:有可能目標頁面存在，只是繁簡不一樣。
				converttitles : 1,
				save_response : true,
				get_URL_options : {
					onfail : function(error) {
						CeL.error('for_each_page: get_URL error: '
								+ CeL.wiki.title_link_of(foreign_language + ':'
										+ foreign_title) + ':');
						console.error(error);
						if (error.code === 'ENOTFOUND' && CeL.wiki.wmflabs) {
							// 若在 Tool Labs 取得 wikipedia 的資料，
							// 卻遇上 domain name not found，
							// 通常表示 language (API_URL) 設定錯誤。
							check_page(gettext(
							// gettext_config:{"id":"syntax-error-in-the-interlanguage-link-template"}
							'Syntax error in the interlanguage link template.'
							//
							));
						} else {
							check_page(gettext(
							// gettext_config:{"id":"could-not-retrieve-the-foreign-page.-i-will-retry-next-time"}
							'Could not retrieve the foreign page. I will retry next time.'
							//
							));
						}
						/**
						 * do next action. 警告: 若是自行設定 .onfail，則需要自行善後。
						 * 例如可能得在最後自行執行(手動呼叫) wiki.next()， 使
						 * wiki_API.prototype.next() 知道應當重新啟動以處理 queue。
						 */
						wiki.next();
					}
				}
			});

		} else if (local_title && WD) {
			if (foreign_language) {
				CeL.warn('for_each_page: Using language [' + foreign_language
						+ '] in ' + CeL.wiki.title_link_of('d:' + WD) + ' @ '
						+ CeL.wiki.title_link_of(title) + '.');
			}
			// for [[d:Q1]]
			foreign_language = 'd';
			wiki.data(WD, for_WD, {
				get_URL_options : {
					onfail : function(error) {
						// TODO
						throw error;
					}
				}
			});

		} else if (local_title && !foreign_title
		// 確保 foreign_language 非 title。
		&& (!foreign_language || /^[a-z]{2}$/.test(foreign_language))) {
			wiki.redirect_to(local_title,
			//
			function(redirect_data, page_data) {
				if (Array.isArray(redirect_data)) {
					// TODO: Array.isArray(redirect_data)
					console.log(redirect_data);
					throw new Error('Array.isArray(redirect_data)');
				}
				if (!redirect_data) {
					check_page(gettext(
					// gettext_config:{"id":"syntax-error-in-the-interlanguage-link-template"}
					'Syntax error in the interlanguage link template.'));
					return;
				}

				// e.g., {{仮リンク|存在する記事}}, {{仮リンク|存在する記事|en}}
				check_local_creation_date(local_title);
			});

		} else {
			setImmediate(function() {
				check_page(gettext(
				// gettext_config:{"id":"syntax-error-in-the-interlanguage-link-template"}
				'Syntax error in the interlanguage link template.'));
			});
		}

	}

	// 這一步頗耗時間。
	var parsed = CeL.wiki.parser(page_data).parse();
	if (CeL.wiki.content_of(page_data) !== parsed.toString()) {
		CeL.error('Parser error: ' + CeL.wiki.title_link_of(page_data));
		// debug 用. check parser, test if parser working properly.
		throw new Error('Parser error: ' + CeL.wiki.title_link_of(page_data));
	}
	parsed.each('template', for_each_template);
	template_parsed = true;
	// console.trace([ page_remains, title, template_count ]);
	if (template_count === 0) {
		CeL.warn([ 'for_each_page: ', CeL.wiki.title_link_of(title) + ': ', {
			// 記事が読み込んでいるテンプレートの方に仮リンクが使われている場合もあります。
			// gettext_config:{"id":"no-registered-interwiki-link-templates-were-found"}
			T : 'No registered interwiki link templates were found.'
		}, {
			T :
			// gettext_config:{"id":"maybe-there-are-unregistered-interwiki-link-templates-or-some-transcluded-templates-articles-with-interwiki-link-templates-that-have-local-articles-(usually-in-the-last-section-of-the-page)"}
			'也許存在未註冊的跨維基鏈接模板，或者一些包含本地文章（通常在頁面的最後部分）的跨維基鏈接模板的嵌入模板/文章？'
		// 導航模板
		} ]);
		if (false) {
			// gettext_config:{"id":"no-registered-interwiki-link-templates-were-found"}
			check_page(gettext('No registered interwiki link templates were found.'));
		}
		check_final_work();
		return;
	}

	return new Promise(function(resolve, reject) {
		overall_resolve = resolve;
		overall_reject = reject;
	});
}

// ----------------------------------------------------------------------------

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
prepare_directory(base_directory, true);

// CeL.set_debug(2);

function main_work() {
	wiki.register_redirects(hatnote_list, {
		namespace : 'Template'
	});

	CeL.wiki.cache([ {
		// [[w:simple:User talk:Kanashimi#Capitalization issues not getting
		// marked]]
		// type : 'embeddedin', list : 'Template:Interlanguage link',
		type : 'categorymembers',
		list : message_set.Category_has_local_page,

		reget : true,
		operator : function(list) {
			var start_from_page;
			if (!CeL.env.arg_hash) {
			} else if (CeL.env.arg_hash.debug_pages) {
				// only for debug {{ill}}s on specified page
				list = CeL.env.arg_hash.debug_pages.split('|');

			} else if (CeL.env.arg_hash.start_from_page) {
				var start_from_page = CeL.env.arg_hash.start_from_page;
				if (!list.some(function(page_data, index) {
					// 起始頁面 Skip to this page
					if (page_data.title !== start_from_page)
						return;

					CeL.error('Start from ' + (index + 1) + '/' + list.length
					//
					+ ' ' + CeL.wiki.title_link_of(start_from_page));
					list = list.slice(index);
					return true;

				})) {
					CeL.error('列表中未包含起始頁面 '
					//
					+ CeL.wiki.title_link_of(start_from_page) + ' ！');
				}
			}

			// list = [ 'Wikipedia:沙盒' ];
			// list = [ 'Wikipedia:サンドボックス' ];
			// list = [ '泉站' ];
			// list = [ '2022年', '1995年电影' ];
			// list = [ '好莱坞唱片' ];
			// list = [ '台中藍鯨女子足球隊' ];
			// list = [ '2019冠狀病毒病知名去世患者列表' ];
			// list = [ 'Template:Infobox number/box' ];
			// list = [ '香港47人案' ];

			// console.log(list);
			this.list = list;
		}

	}, false && {
		// 使用 cache page 的方法速度過慢！
		type : 'page'

	} ], function() {
		var list = this.list;
		// list = [ '' ];
		// list = [ 'Wikipedia:Sandbox' ];
		// list = [ '最强Jump' ];
		CeL.log('Get ' + list.length + ' page(s).');
		if (false) {
			ignore_ns = true;
			CeL.log(list.slice(0, 8).map(function(page_data, index) {
				return index + ': ' + CeL.wiki.title_of(page_data);
			}).join('\n') + '\n...');
			// 設定此初始值，可跳過之前已經處理過的。
			list = list.slice(0 * test_limit, 1 * test_limit);
		}
		// while (list[0].title !== '爱尔兰') list.shift();

		// CeL.set_debug(6);
		// setup ((page_remains))
		page_remains = list.length;
		wiki.work({
			no_edit : true,
			each : for_each_page,
			pages_finished : 0,
			page_options : {
				rvprop : 'ids|content|timestamp'
			}

		}, list);

	}, {
		// default options === this
		// TODO: add Wikipedia:優良條目/存檔
		// namespace : '0|10|14',
		// [SESSION_KEY]
		session : wiki,
		// title_prefix : 'Template:',
		// cache path prefix
		prefix : base_directory
	});
}

wiki.run(main_work);
