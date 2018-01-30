// (cd ~/wikibot && date && hostname && nohup time node 20160719.clean_sandbox.js; date) >> clean_sandbox/log &

/*

 沙盒（公共測試、實驗模擬區）清理作業。ボットによる砂場ならし。

 2016/7/19 20:46:59	正式營運，轉成常態性運行作業。

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

// 其實正有點「公共測試區是從二級標題旁的編輯按鈕開始進行編輯」這樣的意思。為了使瀏覽者知道此頁之特殊性質，因此才保留{{沙盒頂部}}與編輯提示。公共測試區應該是任何編輯者想測試時都能清爽的做測試。當測試完成便告一段落。若想保留較長時間，可以在自己的測試區，或者翻閱歷史紀錄、採用草稿功能等。
// @see [[mw:Extension:SandboxLink]] 首欄個人沙盒要裝沙盒擴展才出現
summary = '沙盒清理作業。若想保留較長時間，可以在[[Special:MyPage/Sandbox|個人測試區]]作測試，或者翻閱歷史紀錄。';
// 強制更新。
var force = CeL.env.arg_hash && CeL.env.arg_hash.force,
// 若是最後編輯時間到執行的時刻小於這個時間間隔，則跳過清理。
min_interval = '30m', JD = CeL.date.Julian_day(new Date);

// --------------------------------------------------------

function clean_wiki(wiki, replace_to, _summary, page) {
	if (!CeL.wiki.is_wiki_API(wiki)) {
		/** {Object}wiki operator 操作子. */
		wiki = Wiki(true, wiki);
	}

	wiki.redirect_to(page || 'Project:Sandbox', function(redirect_data,
			page_data) {
		// console.log(page_data.response.query);
		// console.log(redirect_data);

		wiki.page(redirect_data);
		if (false) {
			// 頂多一開始執行一次。
			wiki.protect({
				protections : 'move=sysop',
				reason : (_summary || summary) + ': 預防公共測試區被隨意移動.'
						+ ' Incase the public sandbox being moved.'
			});
		}
		wiki.edit(function(page_data) {
			// 在執行清理工作前，先行檢查用戶最後編輯時間。
			var time_diff = Date.now()
					- Date.parse(page_data.revisions[0].timestamp);
			if (time_diff < CeL.date.to_millisecond(min_interval)) {
				return [ CeL.wiki.edit.cancel,
				// 這一次沒清理到的話，會等到下一次再清理。
				'用戶最後編輯時間短於' + min_interval + '，跳過清理。' ];
			}

			var
			/**
			 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
			 */
			content = CeL.wiki.content_of(page_data);

			// 運作原理: 在清除前後空白之後，若是與預設的文字相同，就不會更動。
			if (replace_to.trim() === content.trim()
			// 但也不能太過份。
			&& !/[\n\s]{3}$/.test(content) && !/^[\n\s]{3}/.test(content)) {
				return [ CeL.wiki.edit.cancel, 'skip' ];
			}

			/**
			 * <code>
			var PATTERN = /\n==[^=]+==([\n\s]*(?:<[^<>]+>)?)\n?$/;
			'header</noinclude>'.trim() === 'header\n== 請在這行文字底下進行您的測試 ==</noinclude>\n'.replace(PATTERN, '$1').trim()
			'header'.trim() === 'header\n== 請在這行文字底下進行您的測試 ==\n'.replace(PATTERN, '$1').trim()
			'header\n</noinclude>'.trim() === 'header\n== 請在這行文字底下進行您的測試 ==\n</noinclude>\n'.replace(PATTERN, '$1').trim()
			'header\n'.trim() === 'header\n== 請在這行文字底下進行您的測試 ==\n'.replace(PATTERN, '$1').trim()
			</code>
			 */
			if (CeL.wiki.site_name(wiki) === 'zhwiki'
			// 為 Jimmy-bot 特設, 避免與 Jimmy-bot 編輯戰. e.g., [[Template:沙盒]]
			&& replace_to.replace(
			//
			/\n==[^=]+==([\n\s]*(?:<[^<>]+>)?)\n?$/, '$1').trim()
			//
			=== content.trim()) {
				return [ CeL.wiki.edit.cancel, 'skip' ];
			}

			return replace_to;
		}, {
			summary : _summary || summary,
			nocreate : 1,
			bot : 1
		});
	});
}

// --------------------------------------------------------

clean_wiki(
		'test',
		'<noinclude>{{Sandbox}}</noinclude>\n== Please start your testing below this line ==\n',
		'Clearing the sandbox. If you want to keep a longer time, please tasting in the [[Special:MyPage/Sandbox|personal sandbox]], and you may want to check the revision history of the sandbox as well.');

// --------------------------

var zhwiki = Wiki(true, 'zh'),
// <!-- 請注意：請不要變更這行文字以及這行文字以上的部份！ -->\n\n
// ここから下に書き込んでください。
zhwiki_announcement = '{{請注意：請在這行文字底下進行您的測試，請不要刪除或變更這行文字以及這行文字以上的部份。}}\n{{请注意：请在这行文字底下进行您的测试，请不要删除或变更这行文字以及这行文字以上的部分。}}\n';
clean_wiki(zhwiki, zhwiki_announcement// + '== 請在這行文字底下進行您的測試 ==\n'
);

// 預防改完以後又被 Jimmy-bot 改過來，現在採用相同的格式。

// @see [[Special:链入页面/Template:Sandbox]]
// TODO: [[模块:沙盒]], [[File:沙盒.png]]
clean_wiki(zhwiki, zhwiki_announcement// + '== 請在這行文字底下進行您的測試 ==\n'
, null, 'Wikipedia:使用指南 (编辑)/沙盒');
clean_wiki(zhwiki, zhwiki_announcement// + '== 請在這行文字底下進行您的測試 ==\n'
, null, 'Draft:沙盒');
clean_wiki(zhwiki, zhwiki_announcement// + '== 請在這行文字底下進行您的測試 ==\n'
, null, 'Category:Foo');
clean_wiki(zhwiki, '<noinclude>' + zhwiki_announcement.trim()
// + '== 請在這行文字底下進行您的測試 =='
+ '</noinclude>\n', null, 'Template:沙盒');
clean_wiki(zhwiki, zhwiki_announcement + '{{S/wnote}}\n'
// + '== 請在這行文字底下進行您的測試 ==\n'
, null, 'User talk:Sandbox for user warnings~zhwiki');

// --------------------------

clean_wiki('wikinews',
		'<noinclude>{{Sandbox}}</noinclude>\n== 請在這行文字底下進行您的測試 ==\n');

// --------------------------

// 由於維基文庫參與人數太少，沙盒清理可以放寬期限，例如每週一次。
if (force || JD % 7 === 0) {
	clean_wiki('wikisource',
			'<noinclude>{{Sandbox}}</noinclude>\n== 請在這行文字底下進行您的測試 ==\n', null,
			'Wikisource:沙盒');
}

// --------------------------

clean_wiki('zh-classical',
		'<noinclude>{{Sandbox}}</noinclude>\n== 請於此行文下習纂而莫去本行以上文 ==\n');

// --------------------------------------------------------

/** {Object}wiki operator 操作子. */
var moegirl = Wiki(true, 'https://zh.moegirl.org/api.php');

// 一天個人認為還是略嫌小。——From AnnAngela the sysop
// 改2天一次試試。
if (force || JD % 2 === 0) {
	moegirl.page('Help:沙盒‎‎').edit('<noinclude>{{沙盒顶部}}</noinclude>\n'
	// 對於沙盒編輯區域的提示以二級標題作為分割，可方便點選章節標題旁之"編輯"按鈕開始編輯。
	+ '== 請在這行文字底下進行您的測試 ==\n', {
		summary : summary,
		nocreate : 1,
		// [[Special:tags]] "tag應該多加一個【Bot】tag"
		tags : 'Bot',
		bot : 1
	});
}
