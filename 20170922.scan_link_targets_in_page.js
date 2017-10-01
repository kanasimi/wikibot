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

function join_by_new_line() {
	return this.join('\n');
}

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

	var main_page_links = CeL.null_Object(), main_page_files = CeL
			.null_Object();
	parser.each_section(function(section, section_index) {
		// skip the lead section
		if (section_index === 0) {
			return;
		}

		parser.each.call(section, 'link', function(token, index, parent) {
			while (parent = parent.parent) {
				// Skip [[File:image.png| [[link inside file]] ]]
				if (parent.type === 'file')
					return;
			}

			var link_page_title = CeL.wiki.normalize_title(token[0].toString())
					.replace(/^[^:]+:/, '');
			if (link_page_title in main_page_links) {
				CeL.warn('The link ' + token + ' appears more than one time. '
				//
				+ 'I will keep the first location to insert the images.');
				return;
			}
			// main_page_links[link page title] = section the link is located
			main_page_links[link_page_title] = section;
		});

		parser.each.call(section, 'file', function(token) {
			var file_title = CeL.wiki.normalize_title(token[0].toString())
					.replace(/^[^:]+:/, '');
			main_page_files[file_title] = null;
		});
	}, {
		max_depth : undefined,
		add_index : 'all'
	});

	CeL.log(Object.keys(main_page_links).length + ' pages to scan.');
	// console.log(main_page_files);

	// ------------------------------------------

	var files_to_add = CeL.null_Object();
	function scan_link_target(page_data) {
		// console.log(page_data);
		// console.trace(page_data);
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

		function add_file(file_title, token, comment) {
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
			token += '<!-- ' + CeL.wiki.title_link_of(page_data)
					+ (comment ? ': ' + comment : '') + ' -->';
			if (!(file_title in files_to_add)) {
				var section_to_insert = main_page_links[page_data.original_title
						|| page_data.title];
				if (!section_to_insert) {
					throw 'No section configured: '
							+ CeL.wiki.title_link_of(page_data.original_title
									|| page_data.title);
				}
				var file_tokens = files_to_add[file_title] = [ token ];
				file_tokens.section = section_to_insert;
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
			add_file(file_title,
					'[[File:'
							+ file_title
							+ '|thumb|right|'
							+ (token.parameters.image_caption || CeL.wiki
									.title_link_of(page_data)).toString()
									.trim() + ']]', token.name);
		});

		// add directly [[File:image]] from the lead section
		parser.each('file', function(token) {
			var file_title = CeL.wiki.normalize_title(token[0].toString())
					.replace(/^[^:]+:/, '');

			add_file(file_title, token, 'lead section');
		}, {
			slice : [ 0, first_section_index ],
			max_depth : 1
		});
		// add all [[File:image]] from the rest sections
		parser.each('file', function(token) {
			var file_title = CeL.wiki.normalize_title(token[0].toString())
					.replace(/^[^:]+:/, '');

			add_file(file_title, token);
		}, {
			slice : first_section_index
		});
	}

	function write_back_to_page() {
		var file_count = 0;
		for ( var file_title in files_to_add) {
			var file_tokens = files_to_add[file_title],
			// Insert the file descriptions to the section the link located.
			section_to_insert = file_tokens.section;
			if (section_to_insert.file_descriptions) {
				section_to_insert.file_descriptions.append(file_tokens);
			} else {
				file_tokens.unshift(section_to_insert.section_title);
				file_tokens.toString = join_by_new_line;
				// directly replace the section-title-token
				parser[section_to_insert.section_title.index] = file_tokens;
				section_to_insert.file_descriptions = file_tokens;
			}
			file_count += file_tokens.length;
		}
		if (file_count === 0) {
			CeL.info(CeL.wiki.title_link_of(page_data)
					+ ': No new image to add.');
			return;
		}

		CeL.log(CeL.wiki.title_link_of(page_data) + ': ' + file_count
				+ ' file descriptions to add.');
		wiki.page(page_data).edit(parser.toString(), {
			summary : 'Scan links of an article' + ' and adding '
			//
			+ file_count + ' file descriptions used in these links',
			bot : 1
		});
	}

	wiki.work({
		each : scan_link_target,
		last : write_back_to_page,
		no_edit : true,
		page_options : {
			multi : 'keep index',
			redirects : 1
		}
	}, Object.keys(main_page_links));
}
