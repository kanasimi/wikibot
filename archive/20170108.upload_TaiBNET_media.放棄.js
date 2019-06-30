/**
 * @name 20170108.upload_TaiBNET_media.js
 * 
 * @fileoverview Upload images/videos from TaiBNET.
 * 
 * [[commons:Commons:Bots/Requests/Cewbot‎]] 放棄
 * 
 * @since 2017/1/5 19:57:49
 */

'use strict';

// Load CeJS library and modules.
require('./wiki loader.js');

// Load module.
// for HTML_to_Unicode()
CeL.run('interact.DOM');

var configurations_path = base_directory + 'configurations.js',
//
configurations = CeL.fs_read(configurations_path) || Object.create(null),

// last_media_index starts from 0
last_media_index = configurations.last_media_index | 0,

list_directory = base_directory + 'list/', item_directory = base_directory
		+ 'item/',

count_一 = 10, count_丨 = 10, count_per_list = count_一 * count_丨,
//
BASE_URL = 'http://taibnet.sinica.edu.tw/chi/',
// e.g.,
// http://taibnet.sinica.edu.tw/chi/listallpic.php?pc=10&pr=10&ord=`date`&dere=+asc&C1=Y&C2=Y&C3=Y&C4=Y&page=1
MENU_BASE_URL = BASE_URL + 'listallpic.php?pc=' + count_一 + '&pr=' + count_丨
		+ '&ord=`date`&dere=+asc&C1=Y&C2=Y&C3=Y&C4=Y&page=',
/** {Boolean}若在 media_directory 目錄下已有 cache 檔案就不再 upload。 */
skip_cached = true, media_directory = base_directory + 'media/',

/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'commons');
// wiki = Wiki(true, 'test');

// ----------------------------------------------------------------------------

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
prepare_directory(base_directory);
prepare_directory(list_directory);
prepare_directory(item_directory);
prepare_directory(media_directory);

last_media_index = 20300;

// list_index 0: last_media_index 0 – (count_per_list-1)
// list_index 1: last_media_index count_per_list+1 – (count_per_list*2-1)
var list_index = last_media_index / count_per_list | 0;
var cached_index, cached_html;

if (cached_index === list_index) {
	for_list(cached_html);
} else {
	// get menu list
	CeL.get_URL_cache(MENU_BASE_URL + (list_index + 1), for_list, {
		// reget : true,
		file_name : list_directory + 'list ' + count_一 + '×' + count_丨 + ' '
				+ (list_index + 1).pad(3) + '.htm'
	});
}

function for_list(html) {
	cached_html = html;

	var media_index;
	parse_list_html(html);

	// done
	configurations.last_media_index = last_media_index;
	CeL.write_file(configurations_path, configurations);
}

function get_label(html) {
	return CeL.HTML_to_Unicode(html.replace(/<[^<>]+>/g, '')).trim();
}

function parse_list_html(html, callback) {
	var media_data_list = [], get_next_between = html.find_between(
			'<table><tr><td>', '</td></tr></table>'), text;
	while ((text = get_next_between()) !== undefined) {
		var media_data = text.between(" href='", "'"),
		//
		matched = media_data.match(/name_code=([1-9]\d{5})&id=(\d{1,5})/);
		if (!matched) {
			CeL.error('Error url: ' + media_data);
			continue;
		}

		media_data = {
			// 讀者上傳生態影像: 影片照片
			// 物種編號
			species_id : +matched[1],
			// {1,5}
			media_id : +matched[2],
			item_url : BASE_URL + media_data,
			// 上傳者中文名
			uploader : text.between('<td><font class=font13>', '</font>'),
			// 拉丁化文字學名
			scientific_name : text.between('<font class=font14>', '</font>'),
			// 中文名/俗名
			Chinese_name : text
					.between('</font><font class=font13>', '</font>'),
			// 上傳日期
			date : text.between('</font><font class=font14><i>', '</font>')
		};

		media_data.file_name = media_data.scientific_name
				+ ', '
				+ media_data.Chinese_name
				+ '; '
				+ (media_data.uploader.includes('unknown') ? ''
						: media_data.uploader + ' ') + media_data.date
				+ ' TaiBNET ' + media_data.media_id;
		// 二名法 binomial nomenclature
		matched = media_data.scientific_name.match(/^[a-z]{3,} [a-z]{3,}/i);
		if (matched) {
			media_data.binomial = matched[0];
		}

		media_data_list.push(media_data);
	}

	var index = last_media_index - list_index * count_per_list;
	// console.log(media_data_list[index]);
	function upload_next() {
		if (index === media_data_list.length) {
			callback();
			return;
		}

		var media_data = media_data_list[index++];
		CeL.get_URL_cache(media_data.item_url, function(html) {
			if (false) {
				media_data.species_id = +html.between(
						"<a href='taibnet_species_detail.php?name_code=", "'");
			}
			var label_html = html.between("<font class=font20>", "</td>")
					.replace(/\|/g, ' ').replace(/<\/?i>/g, "''")
					// e.g., <i></i>
					.replace(/'{4,}/g, '');
			var matched = label_html.match(
			//		
			/^([\u0000-\u007f]+?)&nbsp;([^\u0000-\u007f].+)$/);
			if (matched && matched[2].includes(media_data.Chinese_name)) {
				media_data.description = get_label(matched[1]);
				media_data.full_Chinese_name = get_label(matched[2]);
			} else {
				media_data.description = get_label(label_html).replace(
						media_data.Chinese_name, '').trim();
			}
			if (matched = html.between("<font class=font16>", "</font>")) {
				media_data.description += get_label(matched);
			}

			/**
			 * <code>
			http://taibnet.sinica.edu.tw/chi/taibnet_addpicture3.php?name_code=347278&id=6251
			<img src='../uploads_moved/20120211032601_347278.jpg' title='Graphium&nbsp;agamemnon翠斑青鳳蝶;統帥青鳳蝶;綠斑鳳蝶;小紋青帶鳳蝶;短尾青鳳蝶;綠斑青鳳蝶'/>

			http://taibnet.sinica.edu.tw/chi/taibnet_addmovie3.php?name_code=347278&id=22814
			<source src='../uploads/20161206230448_347278_0.mp4' type='video/mp4'/>
			</code>
			 */
			matched = html.between('check()').between('<center>', '</center>');
			media_data.media_url = CeL.simplify_path(media_data.item_url
					.replace(/[^\\\/]+$/, '')
					+ matched.between(" src='", "'"));
			media_data.is_image = matched.includes('<img ');

			upload_media(media_data);
		}, {
			file_name : item_directory + media_data.file_name + '.htm'
		});
	}
	upload_next();
}

// @see 20181016.import_earthquake_shakemap.js
function upload_media(media_data, callback) {
	// media description
	var upload_text = [
			'== {{int:filedesc}} ==',
			'{{information',
			// TaiBnet 採用以下學名
			'|description=' + media_data.description,
			'{{zh-tw|'
					+ (media_data.full_Chinese_name || media_data.Chinese_name)
					+ '}}',
			// {{On Wikidata|Q}}
			'|date={{original upload date|' + media_data.date + '}}',
			'|source=' + media_data.item_url,
			'|author='
					// 不一定總找得到。 e.g.,
					// http://taibnet.sinica.edu.tw/chi/taibnet_addpicture3.php?name_code=344421&id=21827
					+ (true && media_data.uploader.includes('unknown') ? media_data.uploader
							: '[' + BASE_URL + '/taibnet_expert_list.php?nam='
									+ media_data.uploader + ' '
									+ media_data.uploader + ']'),
			'|permission={{CC-BY-2.5|' + media_data.uploader + '}}',
			// '|other_versions=',
			'|other_fields=',
			'{{information field|name=TaiBNET id|value={{TaiBNET|id='
					+ media_data.species_id + '|binomial='
					// 注意: TaiBNET採用scientific name而非binomial。
					+ media_data.scientific_name + '}}}}',
			"{{information field|name=scientific name|value=''"
					+ media_data.scientific_name + "''}}",

			'}}', '',

			// Add by {{TaiBNET}}
			// '[[Category:TaiBNET media]]',

			// TODO: add {{Check categories}}, {{Uncategorized}}

			// e.g., [[Category:Strepsinoma hapilistalis]]
			'[[Category:' + media_data.scientific_name + ']]' ];

	upload_text = upload_text.join('\n');
	CeL.debug(upload_text, 2, 'upload_media');

	media_data.file_name += media_data.media_url.match(/\.[a-z]+$/i)[0];
	CeL.log(media_data.media_url + '\n→ ' + media_data.file_name);

	if (skip_cached && CeL.fs_exists(media_directory + media_data.file_name)) {
		CeL.log('Cached: ' + media_data.file_name);
		// callback();
		return;
	}

	wiki.upload(media_data.media_url, {
		filename : media_data.file_name,
		text : upload_text,
		comment : 'TaiBNET ' + (media_data.is_image ? 'image' : 'video') + ' '
				+ media_data.media_id,
		form_data : {
			url_post_processor : function(value, XMLHttp, error) {
				CeL.write_file(media_directory + media_data.file_name,
						XMLHttp.responseText);
			}
		}

	}, function(data, error) {
		if (error) {
			CeL
					.error(typeof error === 'object' ? JSON.stringify(error)
							: error);
			if (data) {
				if (data.warnings) {
					CeL.warn(JSON.stringify(data.warnings));
				} else {
					CeL.warn(JSON.stringify(data));
				}
			}
		}
		// callback();
	});
}
