// (cd ~/wikibot && date && hostname && nohup time /shared/bin/node 20160517.解消済み仮リンクをリンクに置き換える.js; date) >> 解消済み仮リンクをリンクに置き換える/log &

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

 TODO: [[:en:Category:Interlanguage link template existing link]]

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

// Set default language. 改變預設之語言。
set_language('ja');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true),

// ((Infinity)) for do all
test_limit = Infinity,

Category_has_local_page = 'Category:解消済み仮リンクを含む記事',

// 剩下尚未處理完畢的頁面數
page_remains,
// 結果報告書 report[local title]
// = { error : [ "error message", "error message", ...], ... }
report = CeL.null_Object(),

/** {Object}L10n messages. 符合當地語言的訊息內容。 */
message_set = {
	invalid_template : 'テンプレートの使用に誤りがある。人工修正が必要。',
	missing_foreign : '他言語版記事自体存在しないので、人工修正が必要。',
	foreign_is_disambiguation : '他言語版項目リンク先が曖昧さ回避ページなので、人工修正が必要。',
	// [[ja:Help:セクション]]
	foreign_redirect_to_section : '他言語版項目リンク先がセクションに転送するので、人工修正が必要。',
	missing_local : '日本語版項目自体存在しないので、人工修正が必要。',
	different_local_title : '日本語版項目名が違う記事なので、人工修正が必要。',
	preserved : '強制表示引数(preserve)を指定するなので、人工修正が必要。',
	from_parameter : '引数から',
	translated_from_foreign_title : '他言語版項目リンク先から',
	not_exist : '存在しない'
};

// ----------------------------------------------------------------------------

prepare_directory(base_directory);

// CeL.set_debug(2);

function check_final_work() {
	if (page_remains > 0)
		return;

	// assert: page_remains === 0
	if (page_remains !== 0 || check_final_work.done) {
		throw page_remains;
	}
	check_final_work.done = true;

	wiki.page('User:cewbot/修正が必要な仮リンク').edit(function() {
		var messages = [];
		for ( var title in report) {
			messages.push('; [[' + title + ']]');
			for ( var error in report[title]) {
				messages.push(':; ' + error);
				messages.append(report[title][error]);
			}
			// log limit
			if (messages.length > 2000) {
				break;
			}
		}
		return messages.join('\n');

	}, {
		// section : 'new',
		// sectiontitle : '結果報告',
		summary : '解消済み仮リンクを内部リンクに置き換える作業の報告',
		// nocreate : 1,
		bot : 1
	});
}

function for_each_page(page_data, messages) {
	var template_count = 0,
	/** {String}page title = page_data.title */
	title = CeL.wiki.title_of(page_data),
	// 記錄確認已經有改變的文字連結。
	changed = [];
	// console.log(CeL.wiki.content_of(page_data));

	function for_each_template(token, index, parent) {
		/**
		 * 每一個頁面的最終處理函數。需要用到 token。
		 * 
		 * 警告: 必須保證每個頁面都剛好執行一次 check_page。
		 * 
		 * @param {String}error
		 *            error message.
		 * @param {String}_changed
		 *            當前處理的 token 已改成了這段文字。
		 */
		function check_page(error, _changed) {
			if (_changed) {
				if (!changed.includes(_changed)) {
					// 記錄確認已經有改變的文字連結。
					changed.push(_changed);
					CeL.log('Adapt [[' + page_data.title + ']]: '
							+ token.toString() + ' → ' + _changed);
				}

			} else if (error && !token.skip_error) {
				CeL.log('check_page: ' + error + ' @ [[' + title + ']]: '
						+ token.toString());
				if (token.error_message) {
					CeL.log(String(token.error_message));
				}

				// 初始化報告。
				if (!report[title]) {
					report[title] = CeL.null_Object();
				}
				if (!report[title][error]) {
					report[title][error] = [];
				}

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
				if (typeof local_title === 'string') {
					token[1] = '[[' + local_title + ']]';
				}
				report[title][error].push(
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
					report[title][error].push(token.error_message);
				}
				// 回復 recover。
				parent[index] = foreign_title;
				local_title = token[1];
			}

			CeL.debug('template_count: ' + template_count + ' / page_remains: '
					+ page_remains, 4);
			if (--template_count === 0)
				--page_remains;

			if (template_count > 0 || changed.length === 0) {
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
				CeL.log('[[' + page_data.title + ']]: ');
				CeL.log(last_content);
				check_final_work();
				return;
			}

			wiki.page(page_data
			// && 'Wikipedia:サンドボックス'
			).edit(last_content, {
				// section : 'new',
				// sectiontitle : 'Sandbox test section',
				summary : 'bot: 解消済み仮リンク'
				//
				+ changed.join('、') + 'を内部リンクに置き換える',
				nocreate : 1,
				bot : 1
			});

			check_final_work();
		}

		function for_local_page(title) {
			if (!title) {
				// 忽略缺乏本地頁面的情況。
				token.skip_error = true;
				check_page(message_set.missing_local);
				return;
			}

			if (title !== local_title) {
				if (parameters.label && parameters.label !== local_title) {
					// 檢查本地連結 local_title 是否最終也導向 title。
					wiki.redirect_to(local_title, function(redirect_data,
							page_data) {
						if (Array.isArray(redirect_data)) {
							// TODO: Array.isArray(redirect_data)
							console.log(redirect_data);
							throw 'Array.isArray(redirect_data)';
						}
						if (title === redirect_data) {
							local_title = redirect_data;
							// [[local_title]] redirect to:
							// [[redirect_data]] = [[title]]
							for_local_page(title);
							return;
						}

						token.error_message
						//
						= redirect_data ? redirect_data === local_title ? ''
								: ' → [[' + redirect_data + ']]' : ': '
								+ message_set.not_exist;

						token.error_message = ':: '
								+ message_set.from_parameter + ': [['
								+ local_title + ']]' + token.error_message
								+ '. '
								+ message_set.translated_from_foreign_title
								+ ': [[' + title + ']]';
						// test:
						// <!-- リダイレクト先の「[[...]]」は、[[:en:...]] とリンク -->
						check_page(message_set.different_local_title);
					});
					return;
				}

				// {{仮リンク|譲渡性個別割当制度|en|Individual fishing quota}}
				// → [[漁獲可能量|譲渡性個別割当制度]]
				parameters.label = local_title;
			}

			// TODO: {{enlink}}

			if (parameters.preserve) {
				token.skip_error = true;
				check_page(message_set.preserved);
				return;
			}

			var link = '[[' + title;
			if (parameters.label && parameters.label !== title) {
				link += '|' + parameters.label;
			} else if (/\([^()]+\)$/.test(title)) {
				// e.g., [[title (type)]] → [[title (type)|title]]
				// 在 <gallery> 中，"[[title (type)|]]" 無效，因此需要明確指定。
				link += '|' + title.replace(/\s*\([^()]+\)$/, '');
			}
			link += ']]';
			// 實際改變頁面結構。將當前處理的 template token 改成這段 link 文字。
			parent[index] = link;
			check_page(null, link);
		}

		function for_foreign_page(foreign_page_data) {
			if (!foreign_page_data || ('missing' in foreign_page_data)) {
				check_page(message_set.missing_foreign);
				return;
			}

			if (!foreign_page_data.pageprops) {
				CeL.warn(
				//
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

		// template_name
		// @see
		// https://ja.wikipedia.org/w/index.php?title=%E7%89%B9%E5%88%A5:%E3%83%AA%E3%83%B3%E3%82%AF%E5%85%83/Template:%E4%BB%AE%E3%83%AA%E3%83%B3%E3%82%AF&namespace=10&limit=500&hidetrans=1&hidelinks=1
		if (token.name.toLowerCase() in {
			'仮リンク' : true,
			'ill2' : true,
			'illm' : true,
			'link-interwiki' : true
		}) {
			template_count++;
			token.page_data = page_data;
			// console.log(token);
			var parameters = token.parameters,
			// {{仮リンク|記事名|en|title}}
			local_title = decodeURIComponent(get_title(1)),
			//
			foreign_language = get_title(2),
			//
			foreign_title = decodeURIComponent(get_title(3));

			if (local_title && foreign_language && foreign_title) {
				// 這裡用 CeL.wiki.page() 太多並列處理，會造成 error.code "EMFILE"。
				wiki.page([ foreign_language, foreign_title ],
				//
				for_foreign_page, {
					query_props : 'pageprops',
					redirects : 1,
					save_response : true
				});
			} else {
				check_page(message_set.invalid_template);
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
}

CeL.wiki.cache([ {
	type : 'categorymembers',
	list : Category_has_local_page,
	operator : function(list) {
		this.list = list;
	}

}, false && {
	// 使用 cache page 此法速度過慢!
	type : 'page'

} ], function() {
	var list = this.list;
	CeL.log('Get ' + list.length + ' pages.');
	if (1) {
		// 設定此初始值，可跳過之前已經處理過的。
		list = list.slice(0 * test_limit, test_limit);
		CeL.log(list.slice(0, 8).map(function(page_data) {
			return CeL.wiki.title_of(page_data);
		}).join('\n') + '\n...');
	}

	page_remains = list.length;
	wiki.work({
		no_edit : true,
		each : for_each_page

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
