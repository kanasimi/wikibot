/*

scan link targets in page

2017/9/22 16:20:25	初版試營運。
 完成。正式運用。

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

set_language('en');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true);

// ----------------------------------------------------------------------------

var page_title = 'Draft:List of the Paleozoic life of Alabama';

wiki.page(page_title, for_each_main_page, {
	redirects : 1
});

function for_each_main_page(page_data) {
	var parser = CeL.wiki.parser(page_data).parse();
	if (!parser) {
		return [
				CeL.wiki.edit.cancel,
				'No contents: ' + CeL.wiki.title_link_of(page_data)
						+ '! 沒有頁面內容！' ];
	}

	if (CeL.wiki.content_of(page_data) !== parser.toString()) {
		console.log(CeL.LCS(CeL.wiki.content_of(page_data), parser.toString(),
				'diff'));
		throw 'parser error';
	}

	var links = CeL.null_Object(), files = CeL.null_Object(), insert_after;
	parser.each('link', function(token, index) {
		links[CeL.wiki.normalize_title(token[0].toString())] = null;
	});
	parser.each('file', function(token, index) {
		token.index = index;
		insert_after = token;
		var file_title = CeL.wiki.normalize_title(token[0].toString()).replace(
				/^[^:]+:/, '');
		files[file_title] = null;
	});
	links = Object.keys(links);
	CeL.log(links.length + ' pages to scan.');
	// console.log(files);

	var files_to_add = CeL.null_Object();
	function scan_link_target(page_data) {
		var parser = CeL.wiki.parser(page_data).parse();
		if (!parser) {
			return [
					CeL.wiki.edit.cancel,
					'No contents: ' + CeL.wiki.title_link_of(page_data)
							+ '! 沒有頁面內容！' ];
		}

		if (CeL.wiki.content_of(page_data) !== parser.toString()) {
			console.log(CeL.LCS(CeL.wiki.content_of(page_data), parser
					.toString(), 'diff'));
			throw 'parser error';
		}

		parser.each('file', function(token, index) {
			var file_title = CeL.wiki.normalize_title(token[0].toString())
					.replace(/^[^:]+:/, '');
			if (file_title in files) {
				// Skip files we already have.
				return;
			}
			token = token.toString();
			if (!(file_title in files_to_add)) {
				files_to_add[file_title] = [ token ];
			} else if (!files_to_add[file_title].includes(token)) {
				files_to_add[file_title].push(token);
			}
		});
	}

	function write_back_to_page() {
		var file_list = [];
		for ( var file_title in files_to_add) {
			files_to_add[file_title].forEach(function(token) {
				file_list.push(token);
			})
		}
		if (file_list.length === 0) {
			return;
		}
		insert_after.parent.splice(insert_after.index + 1, 0,
		//
		'\n' + file_list.join('\n'));
		CeL.log(file_list.length + ' file descriptions to add');
		wiki.page(page_data).edit(parser.toString(), {
			summary : 'Scan links of an article'
			//
			+ ' and listing pictures used in these links',
			bot : 1
		});
	}

	wiki.work({
		each : scan_link_target,
		last : write_back_to_page,
		no_edit : true,
		redirects : 1
	}, links);

}