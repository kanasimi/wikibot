// cd /d D:\USB\cgi-bin\program\wiki && node 20151002.WPCHECK.js

/*

 2015/10/2 20:19:48	see [[維基百科:錯誤檢查專題]], https://tools.wmflabs.org/checkwiki/cgi-bin/checkwiki.cgi?project=enwiki&view=high
 2015/10/3 0:45:25	初版試營運
 2016/2/2 20:4:48 上路前修正
 完善

 TODO:
 [[WP:維基化]]
 https://en.wikipedia.org/wiki/Wikipedia:WikiProject_Check_Wikipedia
 https://en.wikipedia.org/wiki/Wikipedia:AutoWikiBrowser/General_fixes
 https://www.mediawiki.org/wiki/API:Edit_-_Set_user_preferences

 */

'use strict';

// var CeL_path = 'S:\\cgi-bin\\lib\\JS';
require('./wiki loder.js');
// for CeL.wiki.cache(), CeL.fs_mkdir()
CeL.run('application.platform.nodejs');

/** {String}base directory */
var base_directory = bot_directory + 'WPCHECK/',
// 修正維基百科內容的語法錯誤。
/** {String}編輯摘要。總結報告。 */
summary = '[[WP:WPCHECK|修正維基語法]]',
/** {String}緊急停止作業將檢測之章節標題。 */
check_section = '20151002',
/** {String}運作記錄存放頁面。 */
log_to = 'User:cewbot/log/' + check_section;

// ---------------------------------------------------------------------//

// /\n([*#:;]+|[= ]|{\|)/:
// https://www.mediawiki.org/wiki/Markup_spec/BNF/Article#Wiki-page
// https://www.mediawiki.org/wiki/Markup_spec#Start_of_line_only
var PATTERN_plain_text_br = /\n(([*#:;]+|[= ]|{\|)(?:-{[^{}]*}-|\[\[[^\[\]]+\]\]|\[[^\[\]]+\]|{{[^{}]+}}|[^\[\]<>{}])+)<br\s*\/?>\s*\n[\s\n]*/gi;

// fix incorrect tag <br />
fix_2.title = '包含不正確的<br />';
function fix_2(content, page_data, messages, options) {
	// fix error
	content = content
	// <br></br> → <br>
	.replace(/<br\s*>\s*<[\/\\]br\s*>/gi, '<br />').replace(
			/(<br(?:\s[^<>]*)?>)\s*<[\/\\]br\s*>/gi, '$1')
	// '/' 在後
	.replace(/<\s*br\s*(?:[\\.?a-z\d•]|br)\s*[\/\\]?>/gi, '<br />')
	// '/' 在前
	.replace(/<\s*[\\\/]\s*br\s*>/gi, '<br />')
	// 前後都有 '/'
	.replace(/<\s*[\\\/]\s*br\s*(?:[\\.?a-z\d•]|br)\s*[\/\\]?>/gi, '<br />')
	// 除去不需要的 <br>
	// 下一行為列表，或者表格 <td>, <th> 末為 <br>。
	.replace(/\s*<br\s*[\/\\]?>(\r?\n[:;*# |])/gi, '$1')
	// 去掉過多的分行。
	.replace(/\r?\n(\r?\n)+<br\s*[\/\\]?>\r?\n/gi, '\n\n');

	// 一般已完結的文字
	// a<br>\n → a\n
	content = content.replace_till_stable(PATTERN_plain_text_br, function(all,
			plain_text, list) {
		return '\n' + plain_text
		// 若非 list 則多加一行，以確保會分行。
		+ (list ? '\n' : '\n\n');
	});

	// TODO: a<br>b → a\n\nb

	if (/<br\s*[\/\\]?>\s*>/i.test(content))
		// e.g., "<br />>"
		messages.add('尚留有需要人工判別之 &lt;br> tag！', page_data);

	return content;
}

// ------------------------------------

var comment_tag_start = '<!--', comment_tag_end = '-->';

fix_5.title = 'HTML注釋未首尾對應';
function fix_5(content, page_data, messages, options) {
	var need_manuilly_check, changed, has_end_only,
	//
	slice = content.split(comment_tag_start);

	slice.forEach(function(token, index) {
		var index = token.indexOf(comment_tag_end);
		if (index === NOT_FOUND) {
			if (index === slice.length - 1) {
				// 真正有問題的頁面。
				need_manuilly_check = true;
			} else {
				// e.g., <!--...<!--...-->
				// → <!--...--><!--...-->
				slice[index] += comment_tag_end;
				changed = true;
			}
		} else if (token.indexOf(comment_tag_end, index + 1) !== NOT_FOUND) {
			has_end_only = true;
		}
	});

	if (need_manuilly_check)
		messages.add('尚留有需要人工判別之HTML注釋，有開頭但沒有結尾！', page_data);

	if (has_end_only)
		messages.add('尚留有HTML注釋有結尾但沒有開頭！', page_data);

	return changed ? slice.join(comment_tag_start) : content;
}

// ------------------------------------

// fix_7, fix_19, fix_83: 須注意是不是有被 transclusion，章節標題是否為年月日。

// ------------------------------------

// TODO: 可能需要往前尋找修訂歷史，確認是否為粗心者刪掉了章節標題後半部。

fix_8.title = '章節標題未以「=」結尾';
function fix_8(content, page_data, messages, options) {
	var need_manuilly_check, using_big_equal;
	content = content
	// fix error
	.replace(/\n(=+)([^\n]+)/g, function(all, start_tag, title_token) {
		var matched = title_token.match(/=+$/);
		if (matched && matched[0].length === start_tag.length)
			// skip correct section title.
			return all;

		var matched = title_token.match(/＝+$/);
		if (matched && matched[0].length === start_tag.length) {
			// 採用了全形 "＝" 標記章節標題
			// e.g., ==t＝＝
			using_big_equal = true;
			return all.replace(/＝+$/, function($0) {
				return '='.repeat($0.length);
			});
		}

		// 規範化
		title_token = title_token.trim();
		matched = title_token.match(/=+$/);
		var end_tag = matched && matched[0];
		if (end_tag) {
			// 去首尾 "="
			title_token = title_token.slice(0, -end_tag.length);

			if (start_tag.length > end_tag.length && end_tag.length > 2
			// 若 start_tag 與 end_tag 不符，MediaWiki 會以兩這較短的為主。
			// 這邊以 level 2 以上，較短的為準。
			|| start_tag === '=' && end_tag === '==')
				start_tag = end_tag;

			// 但這可能使標題 "t=" ("==t===") 被改成 "t" ("==t==")!
			// 因此對 "==t===" 這種發出警告。但若是 "== t ===" 這種則當作本來就應該改。
			if (!/^\s/.test(title_token) || !/\s$/.test(title_token)) {
				messages.add("章節標題改變，自首或尾有 '=' 改成無 '=': '''"
						+ title_token.trim() + "'''", page_data);
				options.summary += " -- 章節標題改變，自首或尾有 '=' 改成無 '=': "
						+ title_token.trim();
			}

			return '\n' + start_tag + ' ' + title_token.trim() + ' '
					+ start_tag;
		}

		var index = start_tag.length > 1 && title_token.indexOf(start_tag);
		if (index !== NOT_FOUND
		// e.g., "==t==t==t==" 則不處理
		&& !/[=＝]/.test(title_token.slice(index + start_tag.length)))
			// e.g., ==t==c
			// → ==t==\nc
			return '\n' + start_tag + ' '
			//
			+ title_token.slice(0, index + start_tag.length) + '\n'
			//
			+ title_token.slice(index + start_tag.length)
			// 除掉不相符之 '='
			.replace(/^=+/, '')
			// ===<br />\n
			// → ===\n
			// 除掉 "<br />"
			.replace(/<br ?[\/\\]?>\n*/i);

		if (title_token.length < 20) {
			// 只在 title_token 不太長時，才將之當作章節標題而作最小修正。
			messages.add("將 '''" + title_token
			//
			+ "''' 自內文等級提升成章節標題", page_data);
			options.summary += ' -- 將 ' + start_tag + title_token
					+ ' 自內文等級提升成章節標題';
			return all.replace(/(=+\s*)/, '$1 ').replace(/\s*$/,
					' ' + start_tag);
		}

		need_manuilly_check = true;
		return all;
	});

	if (using_big_equal) {
		content = content.replace(/\n(＝+)([^\n]+)/g, function(all, start_tag,
				title_token) {
			var matched = title_token.match(/[=＝]+$/);
			if (matched && matched[0].length === start_tag.length) {
				// e.g., ＝＝t＝＝, ＝＝t==
				return all.replace(/＝+$/, function($0) {
					// assert: $0 === matched[0]
					return '='.repeat($0.length);
				}).replace(/＝+/, function($0) {
					// assert: $0 === start_tag
					return '='.repeat($0.length);
				});
			}

			need_manuilly_check = true;
			return all;
		});
	}

	if (need_manuilly_check)
		messages.add('尚留有需要人工判別之章節標題錯誤！', page_data);

	return content;
}

// test:
if (false)
	CeL.log(fix_8('\n＝＝獎＝＝\na\n==提＝＝\na\n==名＝＝\na\n', {}, [], {})),
			only_check = [];

if (false) {
	// e.g., "==t==t==t==" 則不處理
	CeL.log(fix_8('\n==獎==提＝＝\n', {}, [], {})), only_check = [];
	throw 1;
}

// ------------------------------------

// is_tail_part: 為後面之 token
function NOT_inside_square_brackets(token, is_tail_part) {
	// token: [[text]] 內部 ((text)) 部分之資料。
	// console.log(' :"' + token + '"');
	token = token.replace(/\|(.+)$/, function(all) {
		return all
		// replace matched square brackets
		// for [[L|[註][註]]] or so

		// 把所有能匹配的 pair 先消滅掉。
		// e.g., [[...]]
		.replace_till_stable(/\[\[[^\[\]]+\]\]/g, '')
		// e.g., [...]
		.replace_till_stable(/\[[^\[\]]*\]/g, '');
	});

	// console.log(' >"' + token + '"');

	var matched = token.match(is_tail_part ? /^[^\[\]]*([\[\]])/
			: /([\[\]])[^\[\]]*$/);
	// console.log(matched);
	// console.log(!matched || matched[1] !== (is_tail_part ? ']' : '['));
	// 確保不在 "]" 之前，或 "[" 之後。
	return !matched || matched[1] !== (is_tail_part ? ']' : '[');
}

// 文中的 [[ 與 ]] 總數不對應，若其中有程序代碼，請使用<source>或<code>。
fix_10.title = '連結方括號未對應';
function fix_10(content, page_data, messages, options) {
	var match_previous = NOT_inside_square_brackets;

	function match_next(text) {
		return NOT_inside_square_brackets(text, true);
	}

	// console.log('0→ ' + content);

	// e.g., [[[L]] → [[L]]
	content = content.replace_check_near(/\[{3,4}([^\[\]]{1,20})\]\]/g,
			'[[$1]]', match_previous, match_next);
	// console.log('1→ ' + content);

	// e.g., [[L] → [[L]]
	content = content.replace_check_near(/\[\[([^\[\]]{1,20})\]/g, '[[$1]]',
			match_previous, match_next);
	// console.log('2→ ' + content);

	// e.g., [[L]]] 排除 [[L|[註]]] → [[L]]
	content = content.replace_check_near(/\[\[([^\[\]]{1,20})\]{3,4}/g,
			'[[$1]]', match_previous, match_next);
	// console.log('3→ ' + content);

	// e.g., [L]] 排除 [[L|[註]]] → [[L]]
	content = content.replace_check_near(/\[([^\[\]]{1,20})\]\]/g, '[[$1]]',
			match_previous, match_next);
	// console.log('4→ ' + content);

	// e.g., [[[L]][ → [[L]]
	content = content.replace(/(\[\[[^\[\]]+\]\])\[([^a-z\[\]][^\[\]]{4,}\[)/g,
			'$1$2');

	// TODO:全形方括號 square brackets
	return content;
}

// test:
if (false) {
	// [https://h.h a[[b]]c] === [https://h.h a][[b]]c
	var tmp = '[[L|[註]]][[L|[註][註]]][[L|[註] [註]]][[L| [註] [註]]][https://h.h a[[b]]c][https://h.h a][[b]]c';
	if ('[[L]][[L]][[L]][[L]]' + tmp !==
	//
	fix_10('[[[L]][[L][[L]]][L]]' + tmp)) {
		console.log('[[[L]][[L][[L]]][L]]' + tmp);
		// →
		console.log(fix_10('[[[L]][[L][[L]]][L]]' + tmp));
		// should:
		console.log('[[L]][[L]][[L]][[L]]' + tmp);
	}
	throw 1;
	only_check = [];
}

// ------------------------------------

// fix_11: HTML named entities [[XML與HTML字符實體引用列表#HTML中的字符實體引用]]

// ------------------------------------

// 標記未首尾對應 tag. tags with no correct matchd.
function tag_corresponding_repairer(tag, title, options) {
	var chars = options && options.chars ? options.chars : '[\s\S]',
	//
	tag_s = '<' + tag + '>', tag_e = '</' + tag + '>', P_tag_e = '<\\/' + tag
			+ '>',
	// e.g., "<tag>~~~<tag>...<tag>~~~</tag>"
	pattern_ssse = new RegExp('(' + tag_s + chars + '*?)' + tag_s + '(.*?'
			+ tag_s + chars + '*?' + P_tag_e + ')', 'g'),
	// e.g., "<tag>~~~<tag>~~~</tag>"
	pattern_sse = new RegExp(tag_s + '(' + chars + '*?)' + tag_s + '(' + chars
			+ '*?' + P_tag_e + ')', 'g'),
	// e.g., "<tag>~~~</tag>~~~</tag>"
	pattern_see = new RegExp('(' + tag_s + chars + '*?)' + P_tag_e + '('
			+ chars + '*?' + P_tag_e + ')', 'g'),
	// e.g., "<tag> " 結束
	pattern_s$ = new RegExp(tag_s + '$'),
	// e.g., "<tag> "
	pattern_s1 = new RegExp(tag_s + '\\s+', 'g'), pattern_s2 = options
			&& options.remove_tail_space === 'escape'
	// e.g., "\\ </tag>"
	? new RegExp('(\\\\+|([^\\s]))\\s+' + P_tag_e, 'g')
	// e.g., " </tag>"
	: new RegExp('\\s+' + P_tag_e, 'g'),
	// 首尾需要新行。
	need_new_line = options && options.need_new_line,
	//
	repairer = function(content, page_data, messages, options) {
		content = content
		// fix error
		// pattern_ssse 須在 pattern_sse 之前。
		// e.g., "<tag>~~~<tag>...<tag>~~~</tag>"
		// → "<tag>~~~</tag>...<tag>~~~</tag>"
		.replace(pattern_ssse, '$1' + tag_e + '$2')
		// e.g., "<tag>~~~<tag>~~~</tag>"
		// → "<tag>~~~~~~</tag>"
		.replace(pattern_sse, function(all, $1, $2) {
			if (/^\s*\|[\|\-}]/.test($1) || /\n\|[\|\-}\s]/.test($1))
				// 可能 $1 中間插了個 </td>，此時反而該去掉前面的。
				// e.g., "...<sub> ||...<sub>...</sub>"
				// → "... ||...<sub>...</sub>"
				return $1 + tag_s + $2;
			// 去掉中間的 start tag
			return tag_s + $1 + $2;
		})
		// e.g., "<tag>~~~</tag>~~~</tag>"
		// → "<tag>~~~~~~</tag>"
		.replace(pattern_see, '$1$2')
		// e.g., "<tag> " 結束
		// → ""
		.trim().replace(pattern_s$, '')

		// remove head space
		.replace(pattern_s1, need_new_line ? tag_s + '\n' : tag_s);

		if (options && options.remove_tail_space === 'escape')
			content = content
			// remove tail space: 考慮 escape
			.replace(pattern_s2, function(all, previous, none_escape) {
				return (none_escape ? none_escape : previous
				// e.g., "...\ </tag>" or "...\\ </tag>"
				+ (previous.length % 2 === 0 ? '' : ' ')) + tag_e;
			});
		else
			content = content
			// remove tail space
			// e.g., " </tag>"
			// → "</tag>"
			.replace(pattern_s2, need_new_line ? '\n' + tag_e : tag_e);

		if (options && typeof options.after === 'function')
			content = options.after(content) || content;

		return content;
	};

	CeL.debug(tag_s + ': ' + pattern_sse);
	CeL.debug(tag_s + ': ' + pattern_ssse);

	repairer.title = title || (tag + ' tag 未首尾對應');
	return repairer;
}

var fix_13 = tag_corresponding_repairer('math', '數學 tag 未首尾對應', {
	chars : '[\\s\\d\\\\a-zA-Z{},;()+\\-=_!]',
	remove_tail_space : 'escape'
}),
//
fix_14 = tag_corresponding_repairer('source', '源代碼 tag 未首尾對應'),
//
fix_15 = tag_corresponding_repairer('code', '代碼 tag 未首尾對應'),
//
fix_23 = tag_corresponding_repairer('nowiki'),
//
fix_24 = tag_corresponding_repairer('pre'),
// [[Help:图像#新的MediaWiki<nowiki><gallery></nowiki>标记]]
fix_29 = tag_corresponding_repairer('gallery', '圖片集 tag 未首尾對應', {
	// 首尾需要新行。
	need_new_line : true
});

// test:
if (false) {
	CeL.log('<math>1+2+3=3+2+1</math>' ===
	//
	fix_13('<math>1+2+3=<math>3+2+1</math>'));
	CeL.log('<math>1+2+3=4</math> kkk <math>3+2+1</math>' ===
	//
	fix_13('<math>1+2+3=4<math> kkk <math>3+2+1</math>'));
	only_check = [];
}

// ------------------------------------

var PATTERN_category = /\[\[(?:Category|分類|分类):([^|\[\]]+)(\|[^|\[\]]+)?\]\][\r\n]*/ig;

// 頁面分類名稱重複
fix_17.title = '分類名稱重複';
function fix_17(content, page_data, messages, options) {
	var category_index_hash = {}, category_hash = {}, matched;
	// search all category list
	while (matched = PATTERN_category.exec(content)) {
		// 經測試，排序索引會以後面出現者為主。
		category_index_hash[matched[1]] = matched[2];
	}

	content = content
	// fix error
	// [[Help:分类]]
	.replace(PATTERN_category, function(all, name, index) {
		if ((name in category_hash) || index !== category_index_hash[name])
			return '';
		category_hash[name] = true;
		return all;
	});

	return content;
}

// ------------------------------------

function add_quote(text, type) {
	if (text = text.trim()) {
		if (!type)
			type = "'''";
		return type + text + type;
	}
	return '';
}

// (''), (''') 不能跨行！

fix_26.title = '使用HTML粗體 tag';
function fix_26(content, page_data, messages, options) {
	// 須注意因為模板或表格之特殊設計，造成錯誤結果的可能！
	content = content
	// fix error
	// 不處理有指定 style 的。
	// /<b(?:\s[^<>\n]*)?>([^<>]*)<\/b>/;
	.replace(/<b>([^<>\n]*)<\/b>/gi, function(all, inner) {
		return add_quote(inner);
	})
	// 處理表格中僅標示<b>的情況。
	.replace(/<b>([^<>\n\|]*)(\|\||\n\|[\-}])/gi, function(all, inner, tail) {
		return add_quote(inner) + " " + tail;
	})
	// <b>...<b>
	.replace(/<b>([^<>\n]*)<b>(.*\n)/gi, function(all, inner, tail) {
		if (/<\/b/i.test(tail))
			return all;
		return add_quote(inner) + tail;
	});

	// 檢查是否有剩下 <b>, </b> 的情況。
	var matched = content.match(/<b(?:\s[^<>]*)?>|<\/b>/i);
	if (matched)
		messages.add('尚留有需要人工判別之HTML粗體 tag: <nowiki>' + matched[0]
				+ '</nowiki>', page_data);

	return content;
}

// ------------------------------------

// (''), (''') 不能跨行！

fix_38.title = '使用HTML斜體 tag';
function fix_38(content, page_data, messages, options) {
	// 須注意因為模板或表格之特殊設計，造成錯誤結果的可能！
	content = content
	// fix error
	// 不處理有指定 style 的。
	// /<i(?:\s[^<>\n]*)?>([^<>]*)<\/i>/;
	.replace(/<i>([^<>\n]*)<\/i>/gi, function(all, inner) {
		return add_quote(inner, "''");
	})
	// 處理表格中僅標示<b>的情況。
	.replace(/<i>([^<>\n\|]*)(\|\||\n\|[\-}])/gi, function(all, inner, tail) {
		return add_quote(inner, "''") + " " + tail;
	})
	// <i>...<i>
	.replace(/<i>([^<>\n]*)<i>(.*\n)/gi, function(all, inner, tail) {
		if (/<\/i/i.test(tail))
			return all;
		return add_quote(inner, "''") + tail;
	});

	// 檢查是否有剩下 <i>, </i> 的情況。
	var matched = content.match(/<i(?:\s[^<>]*)?>|<\/i>/i);
	if (matched)
		messages.add('尚留有需要人工判別之HTML斜體 tag: <nowiki>' + matched[0]
				+ '</nowiki>', page_data);

	return content;
}

// ------------------------------------

// fix_32 需考量在 <code>, <source>, <nowiki> 中之情況。

// fix_50 合併至 fix_11

// ------------------------------------

fix_54.title = '列表內容最後加入分行號';
function fix_54(content, page_data, messages, options) {
	content = content
	// fix error
	.replace_till_stable(/(\*[^*\n]*?)<br(?:\s[^<>]*|\/)?>\n/gi, function(all,
			text) {
		return text + '\n';
	});

	// 檢查是否有剩下出問題的情況。

	return content;
}

// ------------------------------------

fix_64.title = '內部連結顯示名稱和目標條目相同';
function fix_64(content, page_data, messages, options) {
	content = content
	// fix error
	.replace(/\[\[([^\[\]\|]+)\|('''?)?\1\2\]\]/g, function(all, link, quote) {
		link = '[[' + link + ']]';
		if (quote)
			link = quote + link + quote;
		return link;
	});

	return content;
}

// ------------------------------------

// 2016/2/24 20:30:57
fix_65.title = '檔案或圖片的描述以換行結尾';
function fix_65(content, page_data, messages, options) {
	content = CeL.wiki.parser(content).parse()
	//
	.each('file', function(token, parent, index) {
		return token.toString()
		// fix error
		.replace_till_stable(/(.)(?:\s|&nbsp;)*<br\s*[\/\\]?>\s*(\||\]\])/ig,
		//
		function(all, head, tail) {
			if (head === '}'
			// ||head===']'
			)
				// 遇上 ...{{PDB|2AF8}}]] 會出現錯誤，得在中間放置間隔。
				head += ' ';
			return head + tail;
		});
	}, true).toString();

	return content;
}

// ------------------------------------

var PATTERN_ISBN = /([^\d])(1[03])?([\- ]*)(?:ISBN|\[\[\s*ISBN\s*\]\])[\-\s]*(?:1[03])?[:\s#.]*([\dx\-\s]{10,})/gi;
// 不可更改 parameter 為 "ISBN = ..." 的情況!
fix_69.title = 'ISBN用法錯誤';
function fix_69(content, page_data, messages, options) {
	content = content
	// fix error
	.replace(PATTERN_ISBN, function(all, head, head_1013, head_space, ISBN) {
		if (!/\s/.test(head) && head_space.includes(' '))
			// "ISBN" 與前面的文句間插入空格。
			// 但 "/ISBN" 將變成 "/ ISBN"。
			head += ' ';
		var tail = ISBN.match(/\s+$/);
		ISBN = ISBN.replace(/\s+/g, '');
		var length = ISBN.replace(/-/g, '').length;
		if (length === 10 || length === 13) {
			if (tail) {
				// 保留最後的 \s+
				ISBN += tail[0].replace(/ {2,}/g, ' ');
			}
			return head + 'ISBN ' + ISBN;
		}
		return all;
	});

	// 檢查是否有剩下出問題的情況。

	return content;
}

// ------------------------------------

// CeL.wiki.parser.parse('[[File:a.jpg|thumb|d]]')
fix_76.title = '檔案或圖片的連結中包含空格';
function fix_76(content, page_data, messages, options) {
	content = CeL.wiki.parser(content).parse()
	//
	.each('file', function(token, parent, index) {
		// [0]: 僅處理連結部分。
		token[0] = token[0].toString()
		// fix error
		.replace(/%20/gi, ' ');
	}, true).toString();

	return content;
}

// ------------------------------------

var
// 因存在誤判 (false positive) 可能，因此限制 matched 長度。但這也造成漏判 (false negative) 的可能。
// 誤判例: "[ftp://x.x d\n, so the regexp is /\]/..."
// should be: "[ftp://x.x d]\n, so the regexp is /\]/..."
// NOT: "[ftp://x.x d , so the regexp is /\]/..."
/**
 * {RegExp}pattern to parse [[WP:外部連結]].
 * 
 * matched: [all,precedes,URL,title_and_space]
 * 
 * 依[[維基百科:外部連結]]標準 "[" 後不應有空格!<br />
 * 對於在模板中，而此 parameter 本來就設計成未首尾對應的情況，會因為找不到 "]" 而直接忽略。 e.g., [[16個夏天]]
 */
PATTERN_external_link = /([^\[])\[[\s\n]*([a-z]{3,5}:[^\[\]\s\n]{3,120})([\s\n]+[^\[\]]{0,80})\]/gi;

fix_80.title = '外部連結中起新行或含有不必要的空格';
function fix_80(content, page_data, messages, options) {
	content = content
	// fix error
	.replace(PATTERN_external_link, function(all, precedes, URL, title) {
		if (!title.includes('\n'))
			// 不影響解析的不要專門去修，如果這頁有換行的順便改改就好，沒有的直接跳過。
			return all;
		if (title = title.replace(/\s*\r?\n\s*/g, ' ').trim()) {
			if (false && title.endsWith('\\'))
				// 不處理。但不保證所有例外皆為此情形，仍可能存有誤判。
				return all;
			// 將換行轉為空格。
			title = ' ' + title;
		}
		return precedes + '[' + URL + title + ']';
	});

	// 檢查是否有剩下 [title/summary only] 的情況。
	var matched = content
			.match(/[^\[](\[[^a-z:\[][^a-z:\[\]]*(?::[^\]]*)?\])/i);
	if (matched)
		messages.add('尚留有需要人工判別之外部連結: <nowiki>' + matched[1].slice(0, 20)
				+ '</nowiki>', page_data);

	return content;
}

// ------------------------------------

// https://zh.wikipedia.org/wiki/條目#hash 說明
// https://zh.wikipedia.org/zh-tw/條目#hash 說明
// https://zh.wikipedia.org/zh-hans/條目#hash 說明
// https://zh.wikipedia.org/w/index.php?title=條目
// https://zh.wikipedia.org/w/index.php?uselang=zh-tw&title=條目
// [ all, lang, 條目名稱, hash, 說明 ]
var PATTERN_WIKI_LINK = /^(?:https?:)?\/\/([a-z]{2,9})\.wikipedia\.org\/(?:(?:wiki|zh-[a-z]{2,4})\/|w\/index\.php\?(?:uselang=zh-[a-z]{2}&)?title=)([^ #]+)(#[^ ]*)?( .+)?$/i;

// CeL.wiki.parser.parse('[[http://www.wikipedia.org Wikipedia]]')
fix_86.title = '使用內部連結之雙括號表現外部連結';
function fix_86(content, page_data, messages, options) {
	content = CeL.wiki.parser(content).parse()
	//
	.each('link', function(token, parent, index) {
		// 取得內部資料。
		// e.g., 'http://www.wikipedia.org Wikipedia'
		var text = token.toString().slice(2, -2);
		if (!/^(?:https?:)?\/\//i.test(text))
			// 正常內部連結。
			return;

		// [ all, target, 說明 ]
		var matched = text.match(/^([^\|]+)\|(.*)$/);
		if (matched) {
			if (/[\|\[\]]/.test(matched[2])) {
				messages.add('存在 "[", "]" 或兩個以上的 "|"，無法辨識: <nowiki>[['
				// 不處理。
				+ text + ']]</nowiki>', page_data);
				return;
			}
			text = matched[1].trim().replace(/ /g, '%20')
			// 不需要 pipe
			+ ' ' + matched[2].trim();
		}
		matched = text.match(PATTERN_WIKI_LINK);
		if (matched) {
			matched[2] = decodeURIComponent(matched[2]);
			matched[3] = decodeURIComponent(
			//
			(matched[3] || '').replace(/\./g, '%'));
			return '[[' + (matched[1].toLowerCase()
			// lang
			=== 'zh' ? '' : ':' + matched[1] + ':')
			//
			+ matched[2] + matched[3] + (matched[4]
			//
			&& (matched[4] = matched[4].trim()) !== matched[2] ? '|'
			//
			+ matched[4] : '') + ']]';
		}
		return '[' + text.trim() + ']';
	}, true).toString();

	return content;
}

// ------------------------------------
// 2016/2/19 22:9:6

fix_93.title = '外部連結含有雙http(s)';
function fix_93(content, page_data, messages, options) {
	content = content
	// fix error
	// 以後面的 protocol 為主。
	.replace(/(\[|url=|<ref[^>]*>)https?:?\/*(https?:)\/*/ig,
	//
	function(all, prefix, protocol) {
		return prefix + protocol.toLowerCase() + '//';
	}).replace(
	//
	/https?:\/\/(web\.archive\.org\/[a-z\d*\/]+?\/)https?:\/\/(https?:\/\/)/ig,
	//
	function(all, prefix, protocol) {
		return 'https://' + prefix + protocol.toLowerCase();
	});

	// 檢查是否有剩下雙 http(s) 的情況。
	var matched = content.match(/https?[:\/]*https?[:\/]*.{0,20}/i);
	if (matched)
		messages.add(
		//
		'尚留有需要人工判別之雙 http(s): <nowiki>' + matched[0] + '</nowiki>', page_data);

	return content;
}

// ------------------------------------

/**
 * <code>
 CeL.wiki.parser('{| class="wikitable"\n|-\n! h1 !! h2\n|-\n| <sub>d1 || d2\n|}').parse().each('plain', function(token, parent, index){console.log(JSON.stringify(token));console.log(parent);})
 CeL.wiki.parser('{{T|p=a<sub>s}}').parse().each('plain', function(token, parent, index){console.log(JSON.stringify(token));console.log(parent);})
 CeL.wiki.parser("{| class=\"wikitable sortable\" border=\"1\"\n|+ '''上海外国语大学'''外国语言专业布局<br><sub>（1949年——2011年）</sub>\n! <sub># !! <sub>语种名称 !! <sub>[[Language]] !! <sub>所属院系 !! <sub>设置时间 !! <sub>备注\n|-align=\"center\"\n| <sub>'''1'''\n|width=\"120\"| <sub>[[俄语]]\n|width=\"120\"| <sub>[[Русский]]\n|width=\"150\"| <sub>俄语系\n|width=\"100\"| <sub>1949年\n|width=\"250\"| \n|-align=\"center\"\n|  <sub>'''2''' \n|| <sub>[[英语]] || <sub>[[English]] || <sub>英语学院 || <sub>1950年  || <sub>1952年停办，1956年重设</sub>\n|}").parse()
 CeL.wiki.page('上海外国语大学',function(page_data){CeL.wiki.parser(page_data).parse();})
 </code>
 */

function check_tag(token, parent) {
	var matched = (parent ? parent.toString() : token)
			.match(/<(su[bp])(?:\s[^<>]*)?>([\s\S]*?)$/i),
	//
	end_tag = matched && matched[1];
	if (end_tag
	// 檢查是否未包含 tag 結尾。
	&& !new RegExp('</' + end_tag + '\\s*>', 'i').test(matched[2])) {
		end_tag = '</' + end_tag + '>';
		// 保留 \s$。
		return token.replace(/\s*$/, function(all) {
			return end_tag + all;
		}).replace_till_stable(
		// 去除內容為空的 tag。
		/<(su[bp])(?:\s[^<>]*)?>(\s*)<\/\1\s*>/ig, '$2');
	}
}

fix_98.title = 'sub/sup tag 未首尾對應';
function fix_98(content, page_data, messages, options) {
	content = CeL.wiki.parser(content).parse()
	//
	.each('plain', function(token, parent, index) {
		if (parent.table_type
		//
		? parent.table_type !== 'td' && parent.table_type !== 'th'
		// 此 token 不為最後一個。
		|| index < parent.length - 1
		//
		: parent.type !== 'transclusion')
			return;

		// console.log(JSON.stringify(token));
		// console.log(parent);
		if (!token.match)
			// for debug
			console.log(token);

		var replaced = check_tag(token);
		if (replaced !== undefined)
			return replaced;

		if ((parent.table_type === 'td' || parent.table_type === 'th')
		// 確認整個 cell 有首尾對應。
		&& (replaced = check_tag(token, parent)) !== undefined) {
			return replaced;
		}

		// TODO:末尾為 <ref> 時添加在前一個。

	}, true).toString();

	return content;
}

var fix_99 = fix_98;

// ------------------------------------
// [[:en:WP:PMID]]
// https://www.mediawiki.org/wiki/Markup_spec/BNF/Magic_links
// TODO: RFC, ISBN
/** {RegExp}pattern to parse PMID. */
var PATTERN_PMID_1 = /([^a-z])PMID(?:\s*[:：]\s*|)(\d{1,9})([^\d\]}\n][^\n]*)?\n/gi,
/** {RegExp}pattern to parse PMID. */
PATTERN_PMID_2 = /([^a-z])(?:PubMed|PMC)\s*[:：]?\s*(\d{1,9})([^\d\]}\n][^\n]*)?\n/gi;

function replace_PMID(all, precedes, id, follows) {
	var matched = follows && follows.match(/[\[\]<>]/);
	if (matched && /^[>\]]$/.test(matched[0]))
		// 不處理外部連結中的PMID。
		return all;
	// 要有 space 才能產生作用。
	if (precedes.charCodeAt(0) > 255 && !/\s$/.test(precedes))
		precedes += ' ';
	return precedes + 'PMID ' + id + (follows || '') + '\n';
}

fix_102.title = 'PMID語法錯誤';
function fix_102(content, page_data, messages, options) {
	// 一般皆在 <ref> 中。推薦改成 {{cite journal|pmid=dddd}}。
	// <ref name="PMID dddd"> 可被接受。
	// TODO: 考量於 link 中的可能性。
	return content
	// fix error
	.replace_till_stable(PATTERN_PMID_1, replace_PMID)
	// PMC != PMID
	// .replace_till_stable(PATTERN_PMID_2, replace_PMID)
	;
}

// ------------------------------------

// 這種做法大多放在模板中。只是現在的 MediaWiki 版本已經不需要如此的避諱方法。
fix_103.title = '連結中包含 pipe magic word';
function fix_103(content, page_data, messages, options) {
	content = CeL.wiki.parser(content).parse()
	//
	.each('link', function(token, parent, index) {
		var link;
		if (token.length === 1 && token[0].length === 1
		//
		&& typeof (link = token[0][0]) === 'string'
		//
		&& link.split('{{!}}').length === 2)
			token[0][0] = link.replace('{{!}}', '|');
	}, true).toString();

	return content;
}

// ------------------------------------

fix_104.title = 'Unbalanced quotes in ref name';
function fix_104(content, page_data, messages, options) {
	content = content
	// fix error
	.replace(/<ref\s+name\s*=\s*(["'])([^>]*?)>/ig, function(all, quote, name) {
		name = name.trim();
		var single = /[^\/]\/$/.test(name);
		if (single)
			name = name.slice(0, -1).trim();
		if (name.endsWith(quote) && !name.slice(0, -1).includes(quote))
			// 正常無恙。
			return all;
		// 去尾。
		while (name.endsWith(quote))
			name = name.slice(0, -1);
		// 去頭。
		while (name.startsWith(quote))
			name = name.slice(1);
		name = name.trim();
		if (name.includes(quote)) {
			if (name.slice(0, -1).includes(quote))
				messages.add('尚留有需要人工判別之 ref name: <nowiki>' + all
						+ '</nowiki>', page_data);
			return all;
		}
		// console.log(all);
		if (name.endsWith(quote === '"' ? "'" : '"'))
			name = name.slice(0, -1) + quote;
		else
			name += quote;
		return '<ref name=' + quote + name + (single ? ' /' : '') + '>';
	});

	// 檢查是否有剩下出問題的情況。

	return content;
}

// ---------------------------------------------------------------------//
// main

// prepare directory: reset base directory
CeL.fs_remove(base_directory, function() {
	CeL.fs_mkdir(base_directory);
});

var checkwiki_api_URL = 'https://tools.wmflabs.org/checkwiki/cgi-bin/checkwiki.cgi?project='
		+ 'zhwiki' + '&view=bots&offset=0&id=',

// const: 基本上與程式碼設計合一，僅表示名義，不可更改。(== -1)
NOT_FOUND = ''.indexOf('_'),

/** {Object}wiki 操作子. */
wiki = Wiki(true),
/** {Natural|Array}Only check the NO(s). 僅處理此項。 */
only_check,
/** {Natural|Array}每一項最大處理頁面數。 */
處理頁面數;

only_check = [ 10, 80, 102 ];
// 處理頁面數 = 50;
// 處理頁面數 = [ 50, 100 ];
// 處理頁面數 = [ 100, 150 ];
// 處理頁面數 = [ 400, 500 ];
only_check = [ 17, 26, 38, 54, 64, 65, 69, 76, 80, 86, 93, 98, 99, 103, 104 ];
處理頁面數 = 30;

new Array(200).fill(null).forEach(function(fix_function, checking_index) {
	if (only_check) {
		if (Array.isArray(only_check)) {
			if (!only_check.includes(checking_index))
				return;
		} else if (only_check > 0 && checking_index !== only_check)
			return;
	}

	fix_function = eval('typeof fix_' + checking_index
	// global 無效。
	+ ' === "function" && fix_' + checking_index + ';');
	if (!fix_function)
		return;

	CeL.debug('Add #' + checking_index, 2);
	CeL.get_URL_cache(checkwiki_api_URL + checking_index, function(page_list) {
		page_list = JSON.parse(page_list);
		// CeL.set_debug(3);
		if (page_list.length === 0)
			return;

		if (Array.isArray(處理頁面數))
			page_list = page_list.slice(處理頁面數[0], 處理頁面數[1]);
		else if (處理頁面數 > 0)
			page_list = page_list.slice(0, 處理頁面數);

		// process pages
		wiki.work({
			each : function(page_data, messages, options) {
				var content = CeL.wiki.content_of(page_data);
				// 預防有被刪之頁面。
				if (!content)
					return;
				return fix_function(content, page_data, messages, options);
				// TODO: Set article as done
			},
			// ((fix function)).title = {String}Error name / Reason
			summary : summary + ' ' + checking_index
			//
			+ ': ' + fix_function.title,
			log_to : log_to,
			slice : 100
		// only_check === 10 ? 100 : 0
		}, page_list);

	}, {
		file_name : base_directory + 'list_' + checking_index + '.json',
		postprocessor : function(data) {
			if (data.charAt(0) === '<')
				// 僅取得 <pre> 間的 data。
				data = data.between('<pre>', '</pre>');
			data = data.trim().split(/\r?\n/);
			return JSON.stringify(data);
		}
	});
});
