// (cd ~/wikibot && date && hostname && nohup time node 20160517.解消済み仮リンクをリンクに置き換える.js; date) >> 解消済み仮リンクをリンクに置き換える/log &

/*

 [[:ja:Wikipedia:井戸端/subj/解消済み仮リンクを自動的に削除して]]
 [[:ja:Wikipedia:井戸端/subj/仮リンクの解消の作業手順について]]
 2016/5/20 22:22:41	仮運用を行って

 Workflow 工作流程:
 # 自維基百科 Category_has_local_page 取得所有包含本地連結的頁面標題文字/條目名稱。
 # 以函數 for_each_page() + for_each_template() 檢查每一個頁面，找出所有跨語言模板。
 # 以函數 for_foreign_page() 檢查跨語言模板模板所指引的外語言條目連結是否合適。
 # 以函數 for_local_page() 檢查外語言條目連結所指向的本地條目連結是否合適。
 # 以函數 check_page() 收尾每一個頁面的工作。
 # 以函數 check_final_work()寫入報告。

 @see
 https://github.com/liangent/mediawiki-maintenance/blob/master/cleanupILH_DOM.php

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('ja');
set_language('en');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),

// ((Infinity)) for do all
test_limit = 200,

Category_has_local_page = {
	en : 'Category:Interlanguage link template existing link',
	ja : 'Category:解消済み仮リンクを含む記事'
}[use_language],

/** {Natural}剩下尚未處理完畢的頁面數。 */
page_remains,

/** {revision_cacher}記錄處理過的文章。 */
processed_data = new CeL.wiki.revision_cacher(base_directory + 'processed.'
		+ use_language + '.json'),

/** {Object}L10n messages. 符合當地語言的訊息內容。 */
message_set = {
	// summary_prefix : 'bot: 解消済み仮リンク',
	// summary_separator : '、',
	// summary_postfix : 'を内部リンクに置き換える',
	summary_prefix : 'bot test: Convert ',
	summary_separator : ', ',
	// internal link
	summary_postfix : ' to wikilink',

	no_template : 'no interwiki link template found',
	// 仮リンクに記されるべき「他言語版の言語コード」が空白である場合
	// 仮リンクに記されるべき「他言語版へのリンク先」が空白である場合
	invalid_template : 'テンプレートの使用に誤りがある。',
	// 仮リンクに記された「他言語版へのリンク先」が存在せず（赤リンク）、どの記事からもリンクされていないもの
	// manually
	missing_foreign : '他言語版記事自体存在しないので、手動修正必要。',
	// 仮リンクに記された「他言語版へのリンク先」が曖昧さ回避であるもの
	foreign_is_disambiguation : '他言語版項目リンク先が曖昧さ回避ページなので、手動修正必要。',
	// [[ja:Help:セクション]]
	foreign_redirect_to_section : '他言語版項目リンク先がセクションに転送するので、手動修正必要。',
	// リンク先が他言語版とリンクしていないもの
	missing_local : '日本語版項目自体存在しないか、他言語版とリンクしていないので、手動修正必要。',
	// リンク先の他言語版とのリンクが仮リンクに記されているものと違うもの
	// 仮リンクに記された「他言語版へのリンク先」とリンクしている「日本語版のページ名」が「第1引数のリンク先」と一致しないもの
	// TODO: Q6099744
	different_local_title : '日本語版項目名が違う記事なので、手動修正必要。',
	not_exist : '存在しない',
	from_parameter : '引数から',
	translated_from_foreign_title : '他言語版項目リンク先から',

	preserved : '強制表示引数(preserve)を指定するなので、修正の必要がない。',
	retrive_foreign_error : 'Can not retrive foreign page. I will retry next time.'
},

// 次序
template_orders = {
	// local_title, foreign_language code, foreign_title,
	// label text displayed, preserve foreign language link
	LcF : [ 1, 2, 3 ],
	cLF : [ 2, 1, 3, 4 ],
},
// @see
// https://ja.wikipedia.org/w/index.php?title=%E7%89%B9%E5%88%A5:%E3%83%AA%E3%83%B3%E3%82%AF%E5%85%83/Template:%E4%BB%AE%E3%83%AA%E3%83%B3%E3%82%AF&namespace=10&limit=500&hidetrans=1&hidelinks=1
template_order_of_name = {
	en : {
		ill : template_orders.cLF,
		'interlanguage link' : template_orders.cLF,
		illm : template_orders.LcF,
		'interlanguage link multi' : template_orders.LcF
	},
	ja : {
		仮リンク : template_orders.LcF,
		ill2 : template_orders.LcF,
		illm : template_orders.LcF,
		'link-interwiki' : template_orders.LcF
	}
}[use_language];

// ----------------------------------------------------------------------------

function check_final_work() {
	CeL.debug('page_remains: ' + page_remains, 2, 'check_final_work');

	if (--page_remains > 0) {
		return;
	}

	// assert: page_remains === 0
	if (page_remains !== 0 || check_final_work.done) {
		throw page_remains;
	}
	check_final_work.done = true;

	wiki.page('User:' + user_name + '/修正が必要な仮リンク').edit(function() {
		var messages = [], data = processed_data[processed_data.KEY_DATA];
		// data: 結果報告。
		// data[local title] = { id : 0, error : {
		// "error name" : [ "error message", "error message", ...],
		// "error name" : [ ... ], ... }
		// })
		for ( var title in data) {
			var report = data[title],
			//
			error_messages = report.error;
			if (!error_messages) {
				// no error
				continue;
			}

			// TODO: +'<span class="plainlinks">'
			messages.push('; [['
			// + 'Special:Redirect/revision/' + report.id + '|'
			+ title
			// https://en.wikipedia.org/wiki/Help:Link#Links_containing_URL_query_strings
			// an external link rather than as an wikilink
			+ ']] ([{{fullurl:' + title + '|action=edit}} 編])');

			Object.keys(error_messages).sort().forEach(function(error_name) {
				messages.push(':; ' + error_name);
				var list = error_messages[error_name];
				if (list.length > 20) {
					messages.append(list.slice(0, 20));
					// Total n times occurred.
					messages.push(':: ……合計' + list.length + '回発生した。');
				} else {
					messages.append(list);
				}
			});
			// log limit
			if (messages.length > 2000) {
				break;
			}
		}

		if (messages.length > 0) {
			messages.push('[[Category:修正が必要な仮リンクを含む記事]]');
		}
		return messages.join('\n');

	}, {
		// section : 'new',
		// sectiontitle : '結果報告',
		summary : '解消済み仮リンクを内部リンクに置き換える作業の報告',
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

	// page_data =
	// {pageid:0,ns:0,title:'',revisions:[{revid:0,parentid:0,user:'',timestamp:''},...]}

	var template_count = 0, template_parsed,
	/** {String}page title = page_data.title */
	title = CeL.wiki.title_of(page_data),
	// 記錄確認已經有改變的文字連結。
	changed = [];
	// console.log(CeL.wiki.content_of(page_data));

	if (page_data.ns !== 0) {
		return [ CeL.wiki.edit.cancel, '本作業僅處理條目命名空間' ];
	}

	// Check if page_data had processed useing revid.
	if (processed_data.had(page_data)) {
		check_final_work();
		return;
	}

	function for_each_template(token, token_index, token_parent) {
		var parameters, local_title, foreign_language, foreign_title;

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
					CeL.log('check_page: ' + error_name + ' @ [[' + title
							+ ']]: ' + token.toString());
					if (token.error_message) {
						CeL.log(String(token.error_message));
					}
				}

				// 初始化報告。
				// error message list
				var error_list = data_to_cache[is_information ? 'info'
						: 'error'];
				if (!error_list) {
					data_to_cache[is_information ? 'info' : 'error'] = error_list = CeL
							.null_Object();
				}
				if (!error_list[error_name]) {
					error_list[error_name] = [];
				}
				error_list = error_list[error_name];

				var parent = token,
				// parameter[3]
				index = 3, foreign_title = parent[index];
				if (Array.isArray(foreign_title)) {
					parent = foreign_title;
					index = 0;
					foreign_title = parent[index];
				}

				// 格式化連結。
				if (foreign_title && typeof foreign_title === 'string'
						&& !foreign_title.includes('=') && token[2]
						&& /^[a-z\-]{2,20}$/.test(token[2])) {
					parent[index] = '[[:' + token[2] + ':' + foreign_title
							+ '|' + foreign_title + ']]';
				}

				var local_title = token[1];
				if (local_title && (typeof local_title === 'string')) {
					token[1] = '[[' + local_title + ']]';
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
				// 回復 recover: 因為其他模板可能被置換，最後 .toString() 會重新使用所有資訊，因此務必回復原先資訊！
				if (1 in token) {
					token[1] = local_title;
				}
				if (index in parent) {
					parent[index] = foreign_title;
				}
			}

			CeL.debug('template_count: ' + template_count + ' / page_remains: '
					+ page_remains, 2, 'check_page');

			if (--template_count > 0 || !template_parsed) {
				return;
			}

			CeL.debug('從這裡起，一個頁面應該只會執行一次: [[' + title + ']] / ' + page_remains,
					2, 'check_page');

			if (changed.length === 0) {
				// check_final_work() 得要放在本函數 return 之前執行。
				check_final_work();
				return;
			}

			var last_content = parser.toString();
			if (CeL.wiki.content_of(page_data) === last_content) {
				CeL.warn('The contents are the same.');
				check_final_work();
				return;
			}

			if (false) {
				CeL.log('[[' + title + ']]: ');
				CeL.log(last_content);
				check_final_work();
				return;
			}

			wiki.page(page_data
			// && 'Wikipedia:サンドボックス'
			).edit(last_content, {
				// section : 'new',
				// sectiontitle : title,
				summary : message_set.summary_prefix
				// [[内部リンク]]. cf. [[Help:言語間リンク#本文中]]
				+ changed.join(message_set.summary_separator)
				//
				+ message_set.summary_postfix,
				nocreate : 1,
				minor : 1,
				bot : 1
			});

			check_final_work();
		}

		function modify_link(link_target) {
			// @see [[:en:Template:illm]], [[:ja:Template:仮リンク]]
			if (parameters.preserve || parameters.display) {
				check_page(message_set.preserved, true);
				return;
			}

			if (!link_target) {
				link_target = local_title;
			}

			/** {String}link 當前處理的 token 已改成了這段文字。summary 用。 */
			var link = '[[' + link_target,
			// @see [[:en:Template:illm]], [[:ja:Template:仮リンク]],
			// [[:en:Template:ill]]
			/** {String}label text displayed */
			text_displayed = parameters[order[3]]
			// default parameters
			|| parameters.lt || parameters.label || parameters.en_text;
			if (text_displayed) {
				if (text_displayed !== link_target)
					link += '|' + text_displayed;
			} else if (false && /\([^()]+\)$/.test(link_target)) {
				// ↑ 盡可能讓表現/顯示出的文字與原先相同。有必要的話，編輯者會使用 .label。
				// e.g., [[Special:Diff/59967187]]

				// e.g., [[title (type)]] → [[title (type)|title]]
				// 在 <gallery> 中，"[[title (type)|]]" 無效，因此需要明確指定。
				link += '|' + link_target.replace(/\s*\([^()]+\)$/, '');
			}
			link += ']]';

			if (!changed.includes(link)) {
				// 記錄確認已經有改變的文字連結。
				changed.push(link);
				CeL.log('modify_link: Adapt @ [[' + title + ']]: '
						+ token.toString() + ' → ' + link);
			}

			// 實際改變頁面結構。將當前處理的 template token 改成這段 link 文字。
			token_parent[token_index] = link;

			check_page();
		}

		function for_local_page(title) {
			if (!title) {
				// 忽略缺乏本地頁面的情況。
				check_page(message_set.missing_local, true);
				return;
			}

			// title: foreign_title 所對應的本地條目。
			if (title !== local_title) {
				// TODO: {{仮リンク|譲渡性個別割当制度|en|Individual fishing quota}}
				// → [[漁獲可能量|譲渡性個別割当制度]]

				wiki.redirect_to(local_title,
				// 檢查 parameters 指定的本地連結 local_title 是否最終也導向 title。
				function(redirect_data, page_data) {
					if (Array.isArray(redirect_data)) {
						// TODO: Array.isArray(redirect_data)
						console.log(redirect_data);
						throw 'Array.isArray(redirect_data)';
					}
					if (title === redirect_data) {
						// local_title 最終導向 redirect_data === title。
						// 直接採用 parameters 指定的 title，不再多做改變；
						// 盡可能讓表現/顯示出的文字與原先相同。
						// e.g., [[Special:Diff/59964828]]
						// TODO: [[Special:Diff/59964827]]
						modify_link();
						return;

						// ↓ deprecated
						if (!parameters.label) {
							// 盡可能讓表現/顯示出的文字與原先相同。
							parameters.label = local_title;
						}
						// local_title 最終導向 redirect_data === title。
						local_title = redirect_data;
						// [[local_title]] redirect to:
						// [[redirect_data]] = [[title]]
						for_local_page(title);
					}

					token.error_message
					//
					= redirect_data ? redirect_data === local_title ? ''
							: ' → [[' + redirect_data + ']]' : ': '
							+ message_set.not_exist;
					token.error_message = ':: ' + message_set.from_parameter
							+ ': [[' + local_title + ']]' + token.error_message
							+ '. ' + message_set.translated_from_foreign_title
							+ ': [[' + title + ']]';

					// test:
					// <!-- リダイレクト先の「[[...]]」は、[[:en:...]] とリンク -->
					check_page(message_set.different_local_title);
				});
				return;
			}

			// TODO: {{enlink}}
			// TODO: リンク先が曖昧さ回避であるもの（{{要曖昧さ回避}}が後置されている場合も有り）
			// TODO: 檢查本地頁面是否創建夠久(10天)，並沒掛上刪除模板。

			modify_link();
		}

		function for_foreign_page(foreign_page_data) {
			if (!foreign_page_data || ('missing' in foreign_page_data)) {
				check_page(message_set.missing_foreign);
				return;
			}

			if (!foreign_page_data.pageprops) {
				CeL.warn(
				// 沒 .pageprops 的似乎大多是沒有 Wikidata entity 的？
				'for_foreign_page: No foreign_page_data.pageprops: [[:'
						+ foreign_language + ':' + foreign_title + ']] @ [['
						+ title + ']]');
			} else if ('disambiguation' in foreign_page_data.pageprops) {
				check_page(message_set.foreign_is_disambiguation);
				return;
			}

			// @see wiki_API.redirect_to
			// e.g., [ { from: 'AA', to: 'A', tofragment: 'aa' } ]
			var redirect_data = foreign_page_data.response.query.redirects;
			if (redirect_data) {
				if (redirect_data.length !== 1) {
					library_namespace.warn('for_foreign_page: Get '
							+ redirect_data.length + ' redirect links for [['
							+ title + ']]!');
				}
				// 僅取用第一筆資料。
				redirect_data = redirect_data[0];
				// test REDIRECT [[title#section]]
				if (redirect_data.tofragment) {
					check_page(message_set.foreign_redirect_to_section);
					return;
				}
			}

			if (foreign_page_data.title !== foreign_title) {
				// 他言語版項目リンク先が違う記事。
				// 照理來說應該是重定向頁面。
				if (foreign_title.toLowerCase() !== foreign_page_data.title
						.toLowerCase()) {
					CeL.log('for_foreign_page: different foreign title: [[:'
							+ foreign_language + ':' + foreign_title
							+ ']] → [[:' + foreign_language + ':'
							+ foreign_page_data.title + ']] @ [[' + title
							+ ']] (continue task)');
				}
				foreign_title = foreign_page_data.title;
			}

			CeL.wiki.langlinks([ foreign_language,
			// check the Interlanguage link.
			foreign_title ], for_local_page, use_language, {
				redirects : 1
			});

		}

		// 自 parameter 取得頁面標題文字/條目名稱。
		function get_title(parameter) {
			parameter = parameters[parameter];
			// normalize
			return parameter && parameter.toString()
			// 去除註解 comments。
			.replace(/<\!--[\s\S]*?-->/g, '').trim();
		}

		var template_name = token.name.toLowerCase(), order = template_order_of_name[template_name];
		if (order) {
			template_count++;
			token.page_data = page_data;
			// console.log(token);
			parameters = token.parameters;
			// {{仮リンク|記事名|en|title}}
			local_title = decodeURIComponent(get_title(order[0]));
			foreign_language = get_title(order[1]);
			foreign_title = decodeURIComponent(get_title(order[2]));

			if (!foreign_title && use_language === 'en'
			// When article names would be the same in English and foreign
			// language Wikipedia
			&& (template_name === 'ill'
			// @see [[:en:Template:Interlanguage link]]
			|| template_name === 'interlanguage link')) {
				foreign_title = local_title;
			}

			if (local_title && foreign_language && foreign_title) {
				// 這裡用太多 CeL.wiki.page() 並列處理，會造成 error.code "EMFILE"。
				wiki.page([ foreign_language, foreign_title ],
				//
				for_foreign_page, {
					query_props : 'pageprops',
					redirects : 1,
					save_response : true,
					get_URL_options : {
						onfail : function(error) {
							CeL.err('for_each_page: get_URL error: [['
									+ foreign_language + ':' + foreign_title
									+ ']]:');
							console.error(error);
							if (error.code === 'ENOTFOUND'
							//
							&& CeL.wiki.wmflabs) {
								// 若在 Tool Labs 取得 wikipedia 的資料，
								// 卻遇上 domain name not found，
								// 通常表示 language (API_URL) 設定錯誤。
								check_page(message_set.invalid_template);
							} else {
								check_page(message_set.retrive_foreign_error);
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
			} else if (local_title) {
				wiki.redirect_to(local_title,
				//
				function(redirect_data, page_data) {
					if (Array.isArray(redirect_data)) {
						// TODO: Array.isArray(redirect_data)
						console.log(redirect_data);
						throw 'Array.isArray(redirect_data)';
					}
					if (!redirect_data) {
						check_page(message_set.invalid_template);
						return;
					}

					// e.g., {{仮リンク|存在する記事}}, {{仮リンク|存在する記事|en}}
					modify_link();
				});

			} else {
				setImmediate(function() {
					check_page(message_set.invalid_template);
				});
			}
		}
	}

	// 這一步頗耗時間
	var parser = CeL.wiki.parser(page_data).parse();
	if (CeL.wiki.content_of(page_data) !== parser.toString()) {
		// debug 用. check parser, test if parser working properly.
		throw 'Parser error: [[' + title + ']]';
	}
	parser.each('template', for_each_template);
	template_parsed = true;
	if (template_count === 0) {
		// check_page(message_set.no_template);
		check_final_work();
	}
}

// ----------------------------------------------------------------------------

prepare_directory(base_directory);

try {
	// delete cache.
	/**
	 * <code>
	 * cd ~/wikibot && rm 解消済み仮リンクをリンクに置き換える/categorymembers/Category_解消済み仮リンクを含む記事.json
	 * </code>
	 */
	require('fs').unlinkSync(
			base_directory + 'categorymembers/'
					+ Category_has_local_page.replace(':', '_') + '.json');
} catch (e) {
	// TODO: handle exception
}

// CeL.set_debug(2);

CeL.wiki.cache([ {
	type : 'categorymembers',
	list : Category_has_local_page,
	operator : function(list) {
		this.list = list;
	}

}, false && {
	// 使用 cache page 的方法速度過慢！
	type : 'page'

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

	// setup ((page_remains))
	page_remains = list.length;
	wiki.work({
		no_edit : true,
		each : for_each_page,
		page_options : {
			rvprop : 'ids|content|timestamp'
		}

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
