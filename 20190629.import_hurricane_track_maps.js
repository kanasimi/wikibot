// cd /d D:\USB\cgi-bin\program\wiki && node 20190629.import_hurricane_track_maps.js

/*

 2019/7/2 17:17:45	初版試營運 modify from 20181016.import_earthquake_shakemap.js
 2019/7/4 22:17:53	Import 交通部中央氣象局 typhoon track map 路徑潛勢預報 https://www.cwb.gov.tw/V8/C/P/Typhoon/TY_NEWS.html
 2019/7/5 6:23:58	Import Joint Typhoon Warning Center (JTWC)'s Tropical Warnings map https://www.metoc.navy.mil/jtwc/jtwc.html
 2019/7/22 16:1:0	Import JMA typhoon track map

 TODO:
 https://www.nhc.noaa.gov/archive/2019/ONE-E_graphics.php?product=5day_cone_with_line_and_wind
 http://bagong.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin

 */

// ----------------------------------------------------------------------------
'use strict';

// Load CeJS library and modules.
require('./wiki loader.js');

var data_directory = base_directory + 'data/',
/** {Boolean}若在 media_directory 目錄下已有 cache 檔案就不再 upload。 */
skip_cached = false, media_directory = base_directory + 'media/',
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'commons' /* && 'test' */),
//
cache_filename_label = '%4Y-%2m-%2d',
// 因為每個風暴會持續好幾天，甚至跨月，因此只標注年份。
filename_prefix = '%4Y ';

// ----------------------------------------------------------------------------

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
if (data_directory || media_directory) {
	prepare_directory(base_directory);
	data_directory && prepare_directory(data_directory);
	media_directory && prepare_directory(media_directory);
}

// category_to_parent_hash[category_name] = parent_category_name
// category_to_parent_hash['Category:2019 Pacific typhoon season track maps'] =
// 'Category:2019 Pacific typhoon season'
var category_to_parent_hash = Object.create(null);

[ 'Pacific hurricane season', 'Pacific typhoon season',
// Category:Tropical cyclones by season
'Atlantic hurricane season', 'North Indian Ocean cyclone season',
// Category:2018-19 Southern Hemisphere tropical cyclone season
'South Pacific cyclone season', 'South-West Indian Ocean cyclone season',
//
'Australian region cyclone season',
// 'Southern Hemisphere tropical cyclone season',
//
'Central Weather Bureau ROC',
//
'Japan Meteorological Agency', 'Images from the Japan Meteorological Agency' ]
//
.run_serial(function(run_next, parent_category_name) {
	if (!parent_category_name.startsWith('Category:')) {
		var date = new Date;
		var year = String(date.getUTCFullYear());
		if (parent_category_name.includes('South')
				|| parent_category_name.includes('Australian')) {
			year += '-'
			// 由公元7月1日至翌年6月31日，UTC
			+ ((year / 100 | 0) + (date.getUTCMonth() < 7 - 1 ? 1 : -1));
		}
		parent_category_name = year + ' ' + parent_category_name;
	}
	wiki.categorymembers(parent_category_name, function(pages, titles, title) {
		pages.forEach(function(page_data) {
			if (page_data.ns === CeL.wiki.namespace('Category')) {
				category_to_parent_hash[page_data.title]
				// register categories
				= parent_category_name;
			}
		});
		run_next();
	}, {
		limit : 'max'
	});
}, function() {
	// console.log(category_to_parent_hash);

	start_NHC();
	start_JTWC();

	start_CWB();

	start_JMA();

	start_PAGASA();
});

function check_category_exists(category_name) {
	if (!(category_name in category_to_parent_hash))
		CeL.warn('Category does not exist: '
				+ CeL.wiki.title_link_of(category_name));
}

function normalize_name(name) {
	return CeL.wiki.upper_case_initial(name.trim().toLowerCase());
}

function search_category_by_name(TD_name, media_data) {
	var date = ' (' + (media_data.date || new Date).getUTCFullYear() + ')';
	var footer = ' '
	// e.g., " Mun (2019)"
	+ normalize_name(TD_name) + date;
	// console.log(footer);

	if (Object.keys(category_to_parent_hash)
	// e.g., [[Category:Tropical Storm Mun (2019)]]
	.some(function(category_name) {
		if (category_name.endsWith(footer)) {
			// media_data.link will be auto-added to media_data.categories
			media_data.link = category_name.replace('Category:', '');
			return true;
		}
	})) {
		return media_data.link;
	}

	var link = media_data.name
	// relief measures 救濟措施 only for significance hurricane.
	// maybe comming here
	&& media_data.name.match(/(Hurricane|Typhoon) (\w+)/i);
	if (link) {
		link = normalize_name(link[1]) + ' ' + normalize_name(link[2]) + date;
		// e.g., link === "Hurricane Barbara (2019)"
		media_data.link = link;
		return link;
	}
}

// ------------------------------------------------------------------

// General upload function
function upload_media(media_data) {
	// area / basins
	// Atlantic (- Caribbean Sea - Gulf of Mexico)
	// Eastern North Pacific
	// Central North Pacific
	var area = media_data.area;
	var track_maps_category = area.includes('Pacific') ? 'Pacific' : area
			.includes('Atlantic') ? 'Atlantic' : null;
	if (!track_maps_category) {
		CeL.error('Unknown area: ' + area);
		console.log(media_data);
		return;
	}

	track_maps_category = 'Category:' + media_data.date.getUTCFullYear() + ' '
	//
	+ track_maps_category
	// Category:2019 Pacific hurricane season track maps
	+ ' ' + media_data.type_name + ' season track maps';

	var categories = media_data.categories ? media_data.categories.clone() : [];
	categories.push(track_maps_category);
	if (media_data.link)
		categories.push('Category:' + media_data.link);
	categories.forEach(check_category_exists);

	media_data = Object.assign(Object.create(null), media_data, {
		categories : categories,
		// test_only : true,
		show_message : true,
		// must be set to reupload
		ignorewarnings : 1,
		form_data : {
			url_post_processor : function(value, XMLHttp, error) {
				if (media_directory)
					CeL.write_file(media_directory + media_data.filename,
							XMLHttp.responseText);
			}
		}
	});
	// add datetime stamp
	media_data.comment += ' (' + media_data.date.format('%4Y-%2m-%2d %2H:%2M')
			+ ')';

	// console.log(media_data);
	// return;
	wiki.upload(media_data);
}

// ============================================================================

var NHC_base_URL;

// Visit tropical cyclone index page and get the recent tropical cyclones data.
function start_NHC() {
	var NHC_menu_URL = 'https://www.nhc.noaa.gov/cyclones/';
	var parsed_NHC_menu_URL = CeL.parse_URI(NHC_menu_URL);
	NHC_base_URL = parsed_NHC_menu_URL.origin;

	fetch(NHC_menu_URL).then(function(response) {
		// console.log(response);
		CeL.write_file(data_directory
		//
		+ (new Date).format('NHC ' + cache_filename_label
		//
		+ ' menu.html'), response.body);
		return response.text();

	}).then(function(html) {
		// console.log(html);

		html.each_between(
		//
		'<th align="left" nowrap><span style="font-size: 18px;">',
		//
		null, NHC_for_each_area);
	});
}

function parse_NHC_time_string(string) {
	// CeL.info('parse_NHC_time_string: ' + string);
	var date = CeL.DOM.HTML_to_Unicode(string)
	//
	.match(/^(\d{1,2}):?(\d{2}(?: AM| PM)?) (UTC|EDT|PDT|HST) ([a-zA-Z\d ]+)$/);
	if (date) {
		if (!/ 20\d{2}$/.test(date[4]))
			date[4] += ' ' + (new Date).getUTCFullYear();
		date = date[4] + ' ' + date[1] + ':' + date[2] + ' ' + ({
			EDT : 'UTC-4',
			PDT : 'UTC-7',
			HST : 'UTC-10'
		}[date[3]] || date[3]);
		// CeL.info('parse_NHC_time_string: ' + date);
		date = Date.parse(date);
	}
	return date;
}

function NHC_for_each_area(html) {
	// console.log(html);
	var area = html.match(/^[^<\-]*/)[0].trim();
	var date;
	html.each_between('<span class="tiny">', '</span>', function(token) {
		// CeL.info('NHC_for_each_area: ' + token);
		date = date || parse_NHC_time_string(token);
	});

	html.each_between('<!--storm serial number:',
	// <!--storm serial number: EP02-->
	// <!--storm identification: EP022019 Hurricane Barbara-->
	// <!--storm identification: EP022019 Post-Tropical Cyclone Barbara-->
	'<!-- END graphcrosslink -->', function(token) {
		// EP022019: Eastern Pacific 02, 2019
		NHC_for_each_cyclones(token, area, date);
	});
}

// 有警報才會顯示連結。
// <a href="/refresh/graphics_ep2+shtml/024116.shtml?cone#contents">
//
// <img src="/...png" ... alt="Warnings and 5-Day Cone"><br clear="left">
// Warnings/Cone<br>Static Images</a>
function NHC_for_each_cyclones(token, area, date) {
	// console.log([ token, area, date ]);
	// return;

	var matched = token.between('<strong style="font-weight:bold;">',
			'</strong>');
	if (matched && (matched = parse_NHC_time_string(matched)))
		date = matched;
	var PATTERN_link = /<a href="([^<>"]+)"[^<>]*>([\s\S]+?)<\/a>/g,
	// <!--storm identification: EP022019 Hurricane Barbara-->
	id = token.between('<!--storm identification:', '-->').trim();
	// Get all Tropical Weather Outlook / Hurricane Static Images
	while (matched = PATTERN_link.exec(token)) {
		if (!matched[2].endsWith('Static Images'))
			continue;

		// delete matched.input;
		// console.log(matched);
		var source_url = NHC_base_URL + matched[1];
		var media_data = {
			name : id,
			area : area,
			date : date,
			source_url : source_url
		};
		get_NHC_Static_Images(media_data);
	}
}

// ------------------------------------------------------------------

// Visit all "Warnings/Cone Static Images" pages.
function get_NHC_Static_Images(media_data) {
	return fetch(media_data.source_url).then(function(response) {
		CeL.write_file(data_directory
		//
		+ (new Date).format('NHC ' + cache_filename_label
		//
		+ ' cyclones.html'), response.body);
		return response.text();
	}).then(parse_NHC_Static_Images.bind(null, media_data));
}

function parse_NHC_Static_Images(media_data, html) {
	var link, media_url = html
	//
	.match(/<img id="coneimage" src *= *"([^<>"]+)"/)[1];
	var filename = media_url.match(/\/([^\/]+?)\+png\/[^\/]+?\.png$/)[1]
			.replace(/_/g, ' ');
	media_data.date = media_data.date ? new Date(media_data.date) : new Date;

	var name = media_data.name;
	if (name) {
		// 5-day intensity track
		// e.g., id="EP022019 Hurricane Barbara"
		// filename="EP022019 5day cone no line and wind"
		var matched = name.match(/^\w*/)[0];
		if (matched && matched === filename.match(/^\w*/)[0]) {
			filename = filename.replace(/^\w*/, name);
			// e.g., "EP022019 Hurricane Barbara 5day cone no line and wind"
		} else {
			// relief measures 救濟措施 should not go to here
			filename += ' (' + name + ')';
			// e.g., "EP022019 5day cone no line and wind (EP022019
			// Hurricane Barbara)"
		}

		link = name.match(/ (\w+)$/i);
		if (link) {
			// e.g., link[1] === "Barbara"
			link = search_category_by_name(link[1], media_data);
		}
	}
	// year is included in filename.
	filename = /* media_data.date.format(filename_prefix) + */filename
			+ '.png';
	media_url = NHC_base_URL + media_url;
	// console.log(media_url);

	if (false) {
		CeL.get_URL_cache(media_url, upload_media, {
			directory : base_directory,
			filename : filename,
			reget : true
		});
	}

	var wiki_link = name ? link ? CeL.wiki.title_link_of(':en:' + link, name)
			: name : '';
	wiki_link = wiki_link || name ? ' of ' + (wiki_link || name) : '';

	// National Hurricane Center
	var author = '{{label|Q1329523}}';
	Object.assign(media_data, {
		media_url : media_url,
		filename : filename,
		author : author,
		type_name : 'hurricane',
		license : '{{PD-USGov-NOAA}}',
		description : '{{en|' + author
		//
		+ "'s 5-day track and intensity forecast cone" + wiki_link + '.}}',
		// categories : [ '[[Category:Tropical Depression One-E (2018)]]' ],
		comment : 'Import NHC hurricane track map' + wiki_link
	// of the 2019 Pacific hurricane season
	});

	// Fetch the hurricane track maps and upload it to commons.
	upload_media(media_data);
}

// ============================================================================

function start_JTWC() {
	return fetch('https://www.metoc.navy.mil/jtwc/rss/jtwc.rss?' + Date.now())
	// https://www.metoc.navy.mil/jtwc/jtwc.html
	.then(function(response) {
		CeL.write_file(data_directory
		//
		+ (new Date).format('JTWC ' + cache_filename_label
		//
		+ '.rss.xml'), response.body);
		return response.text();
	}).then(function(xml) {
		xml.each_between('<item>', '</item>', for_each_JTWC_area);
	});
}

// ------------------------------------------------------------------

function for_each_JTWC_area(xml) {
	// console.log(xml);
	var date = new Date(xml.between('<pubDate>', '</pubDate>'));
	var area = xml.between('<title>', '</title>');
	area = area.between('Current ', ' Tropical Systems') || area;
	var media_data = {
		date : date,
		area : area,
		author : '{{label|Q1142111}}',
		license : '{{PD-USGov-Air Force}}\n{{PD-USGov-Navy}}'
	};

	xml = xml.between('<description>', '</description>');
	xml = xml.between('<![CDATA[', ']]>') || xml;
	// console.log(xml);
	xml.each_between(null, '</ul>', function(html) {
		for_each_JTWC_cyclone(html, media_data);
	});
}

function for_each_JTWC_cyclone(html, media_data) {
	// console.log(html);
	var media_url = html
	// "TC Warning Graphic", "TCFA Graphic"
	// TCFA: Tropical Cyclone Formation Alert 熱帯低気圧形成警報
	.match(/<a href='([^<>']+)'[^<>]*>TC[^<>]* Graphic<\/a>/);
	if (!media_url)
		return;

	// https://www.usno.navy.mil/NOOC/nmfc-ph/RSS/jtwc/pubref/3140.html
	// USCINCPAC INSTRUCTION 3140.1X
	// Subj: TROPICAL CYCLONE OPERATIONS MANUAL

	// MANOP Heading Area Covered
	//
	// ABPW10 PGTW Western Pacific Significant Tropical
	// Weather Advisory
	//
	// ABIO10 PGTW Indian Ocean Significant Tropical Weather
	// Advisory
	//
	// WHPN(xx) PHNC Eastern North Pacific Area
	//
	// WTPN(xx) PGTW Western North Pacific Area
	//
	// WTIO(xx) PGTW North Indian Ocean
	//
	// WHPS(xx) PHNC Eastern South Pacific Area
	//
	// WTPS(xx) PGTW Western South Pacific Area
	//
	// WTXS(xx) PGTW South Indian Ocean

	media_url = media_url[1];
	/**
	 * <code>
	"Tropical Depression 05W (Mun) Warning #02 "
	"Hurricane 02E (Barbara) Warning #15 "
	"Tropical Storm  02E (Barbara) Warning #25   <font color=red><b>Final Warning</b></font></b><br>"
	</code>
	 */
	var name = html.between(null, '</b>').replace(/(#\d+).+$/, '$1').replace(
			/<font .+$/, '').replace(/<\w[^<>]*>/g, '').trim().replace(
			/\s{2,}/g, ' ');
	var NO;
	// Warnings.
	// Warning #05
	name = name.replace(/\s+\#(\d+)$/, function(all, _NO) {
		NO = _NO;
		return '';
	}).replace(/\s+Warning.*$/, '');
	// year is included in filename.
	var filename = /* media_data.date.format(filename_prefix) + */'JTWC '
			+ name
			// + ' warning map'
			+ ' map' + media_url.match(/\.\w+$/)[0];

	if (!name) {
		CeL.error('for_each_JTWC_cyclone: No name got for area '
				+ media_data.area + '!');
		console.log(html);
		return;
	}

	// e.g., https://commons.wikimedia.org/wiki/File:JTWC_wp0519.gif
	media_data = Object.assign({
		name : name,
		type_name : name.includes('Hurricane') ? 'hurricane' : 'typhoon',
		filename : filename,
		media_url : media_url
	}, media_data);

	// <b>Issued at 07/2200Z<b>
	// <b>Issued at 06/1600Z<b>
	var date = html.match(/Issued at (\d{2})\/(\d{2})(\d{2})Z/);
	if (date) {
		date = new Date(media_data.date.format('%4Y-%2m-' + date[1] + ' '
				+ date[2] + ':' + date[3] + ' UTC'));
		media_data.date = date;
	}

	var link = name.match(/\(([^()]+)\)/);
	if (link) {
		link = search_category_by_name(link[1], media_data);
	}
	var wiki_link = name ? link ? CeL.wiki.title_link_of(':en:' + link, name)
			: name : '';
	wiki_link = (wiki_link || name ? ' of ' + (wiki_link || name) : '')
			+ (NO ? ' #' + NO : '');
	Object.assign(media_data, {
		description : '{{en|' + media_data.author + "'s Tropical Warning"
				+ wiki_link + '.}}',
		comment : 'Import JTWC ' + media_data.type_name + ' warning map'
				+ wiki_link
	});

	upload_media(media_data);
}

// ============================================================================

function start_CWB() {
	// @see https://www.cwb.gov.tw/V8/assets/js/TY_NEWS.js
	function GetTimeNumber(Number_int) {

		var Number_str = (Number_int < 10) ? "0" + Number_int.toString()
				: Number_int.toString();

		return Number_str;
	}

	var DT = new Date(Date.now() + CeL.to_millisecond('8hr'));
	var DT_Y = DT.getUTCFullYear().toString();
	var DT_M = GetTimeNumber(DT.getUTCMonth() + 1);
	var DT_D = GetTimeNumber(DT.getUTCDate());
	var DT_H = GetTimeNumber(DT.getUTCHours());
	// [RJ] 每10分鐘清除js快取
	var DT_N = Math.floor(DT.getUTCMinutes() / 10).toString();

	var DataTime = DT_Y + DT_M + DT_D + DT_H + "-" + DT_N;
	// console.log(DataTime);

	var typhoon_data = Object.create(null), base_URL = 'https://www.cwb.gov.tw/';

	return fetch(base_URL + 'Data/js/typhoon/TY_NEWS-Data.js?T='
	//
	+ DataTime + '&_=' + Date.now())
	//
	.then(function(response) {
		CeL.write_file(data_directory
		//
		+ (new Date).format('CWB ' + cache_filename_label
		//
		+ ' typhoon.html'), response.body);
		return response.text();
	}).then(function(PTA_IMGS_data) {
		// console.log(PTA_IMGS_data);

		PTA_IMGS_data = PTA_IMGS_data.replace(/(\nvar +([\w\d]+) ?=)/g,
		//
		'$1 typhoon_data.$2=');
		eval(PTA_IMGS_data);

		// @see var callbackTY_init = function () @
		// https://www.cwb.gov.tw/V8/assets/js/TY_NEWS.js
		return fetch(base_URL + 'Data/typhoon/TY_NEWS/PTA_IMGS_'
		// 'Data/typhoon/TY_NEWS/PTA_IMGS_201907040000_zhtw.json?T='
		+ typhoon_data.TY_DataTime + '_zhtw.json?T=' + DataTime);
	}).then(function(response) {
		// console.log(response);
		CeL.write_file(data_directory
		//
		+ (new Date).format('CWB ' + cache_filename_label
		//
		+ ' menu.json'), response.body);
		if ((response.status / 100 | 0) === 4) {
			throw 'start_CWB: No new data found!';
		}
		return response.json();
	}).then(function(json) {
		Object.assign(typhoon_data, json);
	})
	//
	.then(function() {
		return process_CWB_data(typhoon_data, base_URL, DataTime);
	})
	//
	['catch'](function(error) {
		console.error(error);
	});
}

// ----------------------------------------------------------------------------

function process_CWB_data(typhoon_data, base_URL, DataTime) {
	// https://www.cwb.gov.tw/V8/assets/js/TY_NEWS.js
	// TY_COUNT = [ 熱帶性低氣壓, 颱風 ]

	// https://www.cwb.gov.tw/V8/assets/js/TY_NEWS.js
	function generate_data(data, date, VER) {
		var FileLang = {
			'C' : 'zhtw',
			'E' : 'enus'
		};

		// var TY_ID = PTA_JSON.EACH[i].id;
		var TY_ID = data.id;

		var url = base_URL + '/Data/' + typhoon_data.DataPath
		//
		+ 'Download_PTA_' + typhoon_data.TY_DataTime + '_'
		//
		+ TY_ID + '_' + FileLang[VER] + '.png';
		// console.log(url);

		var name = typhoon_data.TYPHOON[data.id].Name[VER];
		var filename = 'CWB ' + name + ' track map ('
				+ (VER === 'E' ? 'en-US' : 'zh-TW') + ')';
		return {
			name : name,
			media_url : url,
			filename : date.format(filename_prefix) + filename + '.png',
			description : [ '[[File:CWB PTA Description ' + VER + '.png]]' ],
			// comment won't accept templates
			comment : 'Import CWB typhoon track map of ' + name
		};
	}

	// console.log(typhoon_data);
	// console.log(JSON.stringify(typhoon_data));
	typhoon_data.list = typhoon_data.EACH.map(function(data) {
		// console.log(typhoon_data);
		// console.log(typhoon_data.TYPHOON);
		// console.log(data);
		var name_en = typhoon_data.TYPHOON[data.id].Name.E;
		var date = new Date(typhoon_data.TY_TIME.E);
		// 交通部中央氣象局
		var author = 'Q257136';
		var media_data = {
			id : data.id,
			en : generate_data(data, date, 'E'),
			zh : generate_data(data, date, 'C'),
			date : date,
			author : '{{label|' + author + '}}',
			type_name : 'typhoon',
			license : '{{Attribution CWB}}' // + '{{LicenseReview}}'
			,
			// 西北太平洋
			area : 'Northwest Pacific',
			// source_url : base_URL + 'V8/C/P/Typhoon/TY_NEWS.html',
			categories : [
			//
			'Category:Typhoon track maps by Central Weather Bureau ROC' ]
		};

		var footer = media_data.en.name.match(/\((\w+)\)/);
		if (footer) {
			search_category_by_name(footer[1], media_data);
		}

		return media_data;
	});

	typhoon_data.note = [ {
		C : typhoon_data.TY_LIST_1.C,
		E : typhoon_data.TY_LIST_1.E
	}, {
		C : typhoon_data.TY_LIST_2.C,
		E : typhoon_data.TY_LIST_2.E
	} ];

	function add_description(type, language_code, language) {
		var index = 0;
		typhoon_data.note[0][type].each_between('<div id="collapse-A', null,
		//
		function(token) {
			var media_data = typhoon_data.list[index++][language_code];
			var description = token.between('>').replace(/<\/?\w[^<>]*>/g, '')
			//
			.replace(/\s{2,}/g, ' ');
			media_data.description.push('{{' + (language || language_code)
					+ '|' + media_data.name + description + '}}');
			media_data.comment += ': ' + description;
		});
	}

	add_description('C', 'zh', 'zh-tw');
	add_description('E', 'en');

	// console.log(typhoon_data.TY_LIST_1);
	// console.log(JSON.stringify(typhoon_data.TY_LIST_1));
	CeL.write_file(data_directory + 'CWB_' + DataTime + '.json',
	//
	JSON.stringify(typhoon_data));

	typhoon_data.list.forEach(function(media_data) {
		if (!(Date.now() - media_data.date < 24 * 60 * 60 * 1000)) {
			// 只上傳在24小時之內的颱風警報圖片。
			// 不曉得是不是圖片幾乎都不能完全擷取成功，上傳中央氣象局的圖片時常常不會出現圖片重複的警告，並且圖片也幾乎都有最後一小段全黑的情況。因此必須限制上傳時間，以免圖片一直上傳。
			return;
		}

		Object.assign(media_data, media_data.en, {
			other_versions : '{{F|' + media_data.zh.filename
					+ '|Chinese version|80}}'
		});
		upload_media(media_data);

		Object.assign(media_data, media_data.zh, {
			other_versions : '{{F|' + media_data.en.filename
					+ '|English version|80}}'
		});
		upload_media(media_data);
	});
}

// ============================================================================

function start_JMA() {
	var language = 'en';
	// http://www.jma.go.jp/jp/typh/
	var base_URL = 'http://www.jma.go.jp/' + language + '/typh/';

	return fetch(base_URL + 'index.html')
	//
	.then(function(response) {
		CeL.write_file(data_directory
		//
		+ (new Date).format('JMA ' + cache_filename_label
		//
		+ ' typhoon.' + language + '.html'), response.body);
		return response.text();

	}).then(function(html) {
		var typhoonList = [];
		// var typhoonList=new Array(); typhoonList[0]="1905";
		// /*****************************************************************************/
		// -->
		// </script>
		eval(html.between('var typhoonList=', '</script>').between(';', '/*'));
		typhoonList.forEach(function(id) {
			var media_data = {
				id : id,
				base_URL : base_URL,
				language : language,
				author : '{{label|Q860935}}',
				// 西北太平洋
				area : 'Northwest Pacific',
				type_name : 'typhoon',
				license : '{{JMA}}',
				categories : [ 'Category:Typhoon track maps by JMA' ]
			};

			// http://www.jma.go.jp/en/typh/1905.html
			fetch(base_URL + id + '.html').then(function(response) {
				media_data.source_url = response.useFinalURL || response.url;
				return response.text();
			}).then(for_each_JMA_typhoon.bind(media_data));
		});
	});
}

function for_each_JMA_typhoon(html) {
	var media_data = this;
	// function jumpL(typhoonNo, dataType) @
	// http://www.jma.go.jp/en/typh/scripts/typhoon.js
	// e.g., http://www.jma.go.jp/en/typh/images/zooml/1905-00.png
	media_data.media_url = media_data.base_URL + 'images/zooml/'
			+ media_data.id + '-00.png';

	// 颱風減弱之後就會被除名，無法取得名稱資訊。

	/**
	 * <code>
	<div id="1905" class="typhoonInfo"><input type="button" class="operation" title="Hide Text Information" onclick="javascript:hiddenAll();" value="Close"><br>LOW<br>Issued at 12:45 UTC, 21 July 2019<div class="forecast"><table><tr><td colspan="2"><img align="left" width="100%" height="2px" src="../common/line_menu.gif"></td></tr><tr><td colspan="2">&lt;Analysis at 12 UTC, 21 July&gt;</td></tr><tr><td>Scale</td><td>-</td></tr><tr><td>Intensity</td><td>-</td></tr><tr><td></td><td>LOW</td></tr><tr><td>Center position</td><td lang='en' nowrap>N40&deg;00' (40.0&deg;)</td></tr><tr><td></td><td lang='en' nowrap>E130&deg;00' (130.0&deg;)</td></tr><tr><td>Direction and speed of movement</td><td>NNE 30 km/h (15 kt)</td></tr><tr><td> Central pressure</td><td>998 hPa</td></tr><tr><td colspan="2"><img align="left" width="100%" height="2px" src="../common/line_menu.gif"></td></tr></table></div></div>
	</code>
	 */
	var text = html.between('class="typhoonInfo">').between('<br>', '<br>'),
	// There is no UTC date in the Japanese version.
	date = new Date(html.between('Issued at ', '<'));

	Object.assign(media_data, {
		date : date,
		filename : date.getUTCFullYear() + ' JMA ' + media_data.id + ' map ('
				+ media_data.language + ').png',
		description : '{{en|' + media_data.author
				+ "'s track map of typhoon no. " + media_data.id + '.}}',
		// comment won't accept templates
		comment : 'Import JMA typhoon track map of typhoon no. '
				+ media_data.id
	});

	// for the English version.
	upload_media(media_data);

	// ----------------------------------------------------
	// for the Japanese version.

	var original_language = media_data.language;
	// http://www.jma.go.jp/jp/typh/
	media_data.language = 'jp';

	'base_URL,media_url,source_url'.split(',').forEach(function(name) {
		media_data[name] = media_data[name].replace('/'
		//
		+ original_language + '/', '/' + media_data.language + '/');
	});
	media_data.filename = media_data.filename.replace('(' + original_language
			+ ')', '(' + media_data.language + ')');

	upload_media(media_data);
}

// ============================================================================

function start_PAGASA() {
	var base_URL = 'http://bagong.pagasa.dost.gov.ph/';

	// http://bagong.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin
	fetch(base_URL + 'tropical-cyclone/severe-weather-bulletin').then(
			function(response) {
				CeL.write_file(data_directory
						+ (new Date).format('PAGASA ' + cache_filename_label
								+ ' menu.html'), response.body);
				return response.text();
			}).then(for_each_PAGASA_typhoon.bind(media_data));
}

function for_each_PAGASA_typhoon() {
	;
}
