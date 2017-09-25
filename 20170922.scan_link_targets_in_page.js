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

var page_list = [ 'Draft:List of the Paleozoic life of Alabama' ];

page_list.forEach(function(page_title) {
	wiki.page(page_title, for_each_main_page, {
		redirects : 1
	});
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

	var first_section_index = 0, main_page_links = CeL.null_Object(), main_page_files = CeL
			.null_Object(), insert_after;
	// skip the lead section
	parser.each('section_title', function(token, index) {
		first_section_index = index + 1;
		return parser.each.exit;
	}, false,
	// Only check the first level.
	1);
	parser.each('link', function(token, index, parent) {
		while (parent = parent.parent) {
			// Skip [[File:image.png| [[link inside file]] ]]
			if (parent.type === 'file')
				return;
		}
		main_page_links[CeL.wiki.normalize_title(token[0].toString())] = null;
	}, {
		add_index : 'all',
		slice : first_section_index
	});
	parser.each('file', function(token) {
		insert_after = token;
		var file_title = CeL.wiki.normalize_title(token[0].toString()).replace(
				/^[^:]+:/, '');
		main_page_files[file_title] = null;
	}, {
		slice : first_section_index,
		add_index : true
	});
	main_page_links = Object.keys(main_page_links);
	CeL.log(main_page_links.length + ' pages to scan.');
	// console.log(main_page_files);

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

		// skip the lead section
		var first_section_index = 0;
		parser.each('section_title', function(token, index) {
			first_section_index = index;
			return parser.each.exit;
		}, false,
		// Only check the first level.
		1);

		function add_file(file_title, token) {
			if (file_title in main_page_files) {
				// Skip files we already have.
				return;
			}

			// keep all images right-aligned.
			token = token.toString().replace(/(^|\|) *left *($|\|)/g,
					'$1right$2');
			if (/\[\[ *:/.test(token)) {
				// e.g., "[[:File:image]]"
				return;
			}
			if (!token.includes('right')) {
				// append right-aligned parameter.
				token = token.includes('|') ? token.replace(/\|/, '|right|')
						: token.replace(/\]\]$/, '|right]]');
			}
			// add source
			token += '<!-- ' + page_data.title + ' -->';
			if (!(file_title in files_to_add)) {
				files_to_add[file_title] = [ token ];
			} else if (!files_to_add[file_title].includes(token)) {
				files_to_add[file_title].push(token);
			}
		}

		// add image from information box
		parser.each('template', function(token, index) {
			if (!token.parameters.image) {
				return;
			}
			if (typeof token.parameters.image !== 'string') {
				if (token.parameters.image.some(function(sub_token) {
					if (sub_token.type === 'file' && sub_token[0][1]) {
						var file_title = CeL.wiki
								.normalize_title(sub_token[0][1]);
						add_file(file_title, sub_token.toString());
						return true;
					}
				})) {
					return;
				}
				console.log(token.parameters.image);
				throw 'parameters.image is not string';
			}
			var file_title = CeL.wiki.normalize_title(token.parameters.image);
			add_file(file_title, '[[File:'
					+ file_title
					+ '|thumb|right|'
					+ (token.parameters.image_caption || CeL.wiki
							.title_link_of(page_data.title)) + ']]');
		});

		parser.each('file', function(token) {
			var file_title = CeL.wiki.normalize_title(token[0].toString())
					.replace(/^[^:]+:/, '');

			add_file(file_title, token);
		}, {
			slice : first_section_index
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
		if (insert_after) {
			insert_after.parent.splice(insert_after.index + 1, 0,
			//
			'\n' + file_list.join('\n'));
		} else {
			// append to article
			parser.push('\n' + file_list.join('\n'));
		}
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
		page_options : {
			redirects : 1
		}
	}, main_page_links);
}
