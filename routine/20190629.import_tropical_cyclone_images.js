﻿// cd /d D:\USB\cgi-bin\program\wiki && node 20190629.import_tropical_cyclone_images.js PAGASA

/*

 2019/7/2 17:17:45	初版試營運 熱帶氣旋/颱風預測路徑圖的分類 modify from 20181016.import_earthquake_shakemap.js
 2019/7/4 22:17:53	Import 交通部中央氣象局 typhoon forecast maps 路徑潛勢預報 https://www.cwb.gov.tw/V8/C/P/Typhoon/TY_NEWS.html
 2019/7/5 6:23:58	Import Joint Typhoon Warning Center (JTWC)'s Tropical Warnings map https://www.metoc.navy.mil/jtwc/jtwc.html
 2019/7/22 16:1:0	Import JMA typhoon forecast maps
 2019/7/26 20:49:2	盡量統一檔案名稱。檔名不添加氣旋名稱，以統一氣旋存活各時期的檔案名稱。CWB, JMA 在颱風命名後無法取得命名前之編號，因此颱風命名後會採用另一個檔案名稱。現在應該只會在颱風命名前後變更一次。
 2019/8/4 19:7:13	Import PAGASA typhoon forecast maps	http://bagong.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin

 TODO:
 https://www.nhc.noaa.gov/archive/2019/ONE-E_graphics.php?product=5day_cone_with_line_and_wind
 [[Category:375m-resolution VIIRS images of tropical cyclones]]

 */

// ----------------------------------------------------------------------------
'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

CeL.get_URL.default_user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4710.4 Safari/537.36';

login_options.configuration_adapter = adapt_configuration;

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

/**
 * 由設定頁面讀入手動設定 manual settings。
 * 
 * @param {Object}latest_task_configuration
 *            最新的任務設定。
 */
function adapt_configuration(latest_task_configuration) {
	// console.log(latest_task_configuration);
	// console.log(wiki);

	// 一般設定
	var general = latest_task_configuration.general
			|| (latest_task_configuration.general = Object.create(null));
	if (!general) {
		// CeL.info('No configuration.');
	}

	// 衛星圖像優先度 https://www.nrlmry.navy.mil/tcdat/tc2021/
	var satellite_image_priority = latest_task_configuration['NRL satellite image priority'];
	if (CeL.is_Object(satellite_image_priority)) {
		for ( var area_code in satellite_image_priority) {
			satellite_image_priority[area_code] = satellite_image_priority[area_code]
			//
			.split(',').map(function(satellite) {
				return satellite.trim();
			}).filter(function(satellite) {
				return !!satellite;
			});
		}
		if (false) {
			console
					.log(wiki.latest_task_configuration['NRL satellite image priority']);
		}
	}
}

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
if (data_directory || media_directory) {
	prepare_directory(base_directory);
	data_directory && prepare_directory(data_directory);
	media_directory && prepare_directory(media_directory);
}

// https://stackoverflow.com/questions/20082893/unable-to-verify-leaf-signature
// for NRL Error: unable to verify the first certificate
// code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
// Or set https.request({... rejectUnauthorized:false })
// https://codertw.com/%E5%89%8D%E7%AB%AF%E9%96%8B%E7%99%BC/250697/

// 2021/8/3 6:18:27 Error [ERR_TLS_CERT_ALTNAME_INVALID]: Hostname/IP does not
// match certificate's altnames: Host: www.metoc.navy.mil. is not in the cert's
// altnames: ...

function area_is_Southern_Hemisphere(area) {
	return /South|Australian|India/i.test(area) && !/North Indian/i.test(area);
}

function get_year_range(is_Southern_Hemisphere, date) {
	if (!date)
		date = new Date;
	if (typeof is_Southern_Hemisphere === 'string')
		is_Southern_Hemisphere = area_is_Southern_Hemisphere(is_Southern_Hemisphere);

	var year_range = date.getUTCFullYear();
	if (is_Southern_Hemisphere) {
		// 由公元7月1日至翌年6月31日，UTC
		if (date.getUTCMonth() < 7 - 1) {
			// 從前1年算起。
			year_range--;
		}
		year_range = String(year_range) + '-' + ((year_range + 1) % 100);
	} else {
		year_range = String(year_range);
	}

	return year_range;
}

// category_to_parent_hash[category_name] = parent_category_name
// category_to_parent_hash['Category:2019 Pacific typhoon season track maps'] =
// 'Category:2019 Pacific typhoon season'
var category_to_parent_hash = Object.create(null);

[
		'Pacific hurricane season',
		'Pacific typhoon season',
		// Category:Tropical cyclones by season
		'Atlantic hurricane season',
		'North Indian Ocean cyclone season',
		'South Pacific cyclone season',
		'South-West Indian Ocean cyclone season',
		'Australian region cyclone season',
		// Category:2019 Southern Hemisphere typhoon season track maps
		// Category:2019-20 Southern Hemisphere tropical cyclone season
		'Southern Hemisphere tropical cyclone season',

		// parent categories
		'Category:University of Wisconsin CIMSS images',
		'Category:NRL images of tropical cyclones',
		'JTWC Tropical cyclone warning graphic',
		'Category:Central Weather Bureau ROC',
		'Category:Japan Meteorological Agency',
		'Category:Images from the Japan Meteorological Agency',
		'Category:Images from the Philippine Atmospheric, Geophysical and Astronomical Services Administration' ]
//
.run_serial(function(run_next, parent_category_name) {
	if (parent_category_name.startsWith('Category:')) {
		// 登記。
		category_to_parent_hash[parent_category_name] = parent_category_name;
	} else {
		parent_category_name = get_year_range(parent_category_name) + ' '
				+ parent_category_name;
	}
	// console.log(parent_category_name);

	wiki.categorymembers(parent_category_name, function(pages, error) {
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

}, main_work);

function check_category_exists(category_name) {
	if (!(category_name in category_to_parent_hash)) {
		CeL.warn('check_category_exists: Category does not exist: '
				+ CeL.wiki.title_link_of(category_name));
	}
}

function normalize_name(name) {
	if (!name)
		return name;
	return CeL.wiki.upper_case_initial(name.trim().toLowerCase());
}

// auto-search category ends with " name (year)"
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

function check_result(operator) {
	try {
		var result = operator();
		if (CeL.is_thenable(result)) {
			return result['catch'](function(error) {
				console.error(error);
			});
		}
	} catch (e) {
		console.error(e);
	}
}

function main_work() {
	if (CeL.is_debug())
		console.log(category_to_parent_hash);

	var site_mapping = {
		NHC : start_NHC,
		JTWC : start_JTWC,
		NRL : start_NRL,
		CIMSS : start_CIMSS,
		// CWB, JMA 在颱風命名後無法取得命名前之編號，因此颱風命名後會採用另一個檔案名稱。
		CWB : start_CWB,
		// tagged with "All Rights Reserved"...
		JMA : start_JMA,
		PAGASA : start_PAGASA
	};

	if (CeL.env.arg_hash) {
		var site = CeL.env.arg_hash.site;
		if (site) {
			site = site_mapping[site.toUpperCase()];
			if (site) {
				check_result(site);
			} else {
				CeL.error('Invalid site: ' + site);
			}
			return;
		}

		Object.keys(CeL.env.arg_hash).forEach(function(arg_name) {
			// console.log(arg_name);
			if (CeL.env.arg_hash[arg_name] === true
			// e.g., `node 20190629.import_tropical_cyclone_images debug nhc`
			&& (arg_name = site_mapping[arg_name.toUpperCase()])) {
				check_result(arg_name);
				site = true;
			}
		});

		if (site)
			return;
	}

	// for debug:
	// return;

	for (site in site_mapping) {
		Promise.resolve(site_mapping[site]())['catch'](console.error);
	}
}

// ------------------------------------------------------------------

function of_wiki_link(media_data) {
	var name = media_data.name;
	if (media_data.type) {
		// normalize type
		media_data.type = media_data.type.trim().toLowerCase();
		name = media_data.type + ' ' + name;
	}
	var wiki_link = name ? media_data.link ? CeL.wiki.title_link_of(':en:'
			+ media_data.link, name) : name : '';

	wiki_link = wiki_link || name ? ' of '
			+ (media_data.area ? media_data.area + ' ' : '')
			+ (wiki_link || name) : '';

	if (media_data.NO >= 1)
		wiki_link += ' #' + media_data.NO;

	if (!media_data.variable_Map)
		media_data.variable_Map = new CeL.wiki.Variable_Map();
	media_data.variable_Map.set('wiki_link', wiki_link);

	return wiki_link;
}

function fill_type_name(media_data) {
	if (media_data.type_name)
		return media_data.type_name;

	if (media_data.type) {
		if (media_data.type.includes('hurricane'))
			media_data.type_name = 'hurricane';
		else if (media_data.type.includes('typhoon'))
			media_data.type_name = 'typhoon';
		if (media_data.type_name)
			return media_data.type_name;
	}

	var area = media_data.area.toLowerCase();
	// [[Category:2019 Atlantic hurricane season]]
	media_data.type_name = area.includes('atlantic')
	// 颱風（英語：typhoon）限於赤道以北及國際換日線以西的太平洋及南海水域。於赤道以北及國際換日線以東的太平洋水域產生的風暴則被稱為颶風（英語：hurricane）
	|| area.includes('pacific')
	// [[Category:2019 Pacific hurricane season]]
	&& (area.includes('eastern') || area.includes('central')) ? 'hurricane'
	// [[File:2021 CIMSS 02L Two visible infrared satellite loop.gif]]
	// 'indian ocean': e.g., @NRL
	: area === 'indian' || area === 'indian ocean' ? 'cyclone'
	// [[Category:2019 North Indian Ocean cyclone season]]
	// But JTWC using "Northwest Pacific/North Indian Ocean*"
	// : area.includes('north indian') ? 'cyclone'
	// [[Category:2019 Pacific typhoon season]]
	: 'typhoon';

	return media_data.type_name;
}

// ------------------------------------------------------------------

// General upload function
function upload_media(media_data) {
	// area / basins
	var area = media_data.area.toLowerCase();
	var track_maps_category =
	// But JTWC using "Northwest Pacific/North Indian Ocean*"
	// TODO: using `.id`. e.g., "WP0719": Northwest Pacific
	// area.includes('north indian') ? 'North Indian Ocean' :
	area.includes('pacific') ? 'Pacific'
	//
	: area.includes('atlantic') ? 'Atlantic'
	// [[File:2021 CIMSS 02L Two visible infrared satellite loop.gif]]
	// TODO: 'South-West Indian Ocean'
	// 'indian ocean': e.g., @NRL
	: area === 'indian' || area === 'indian ocean' ? 'North Indian Ocean'
	// [[File:2019 JTWC 03S forecast map.sh0320.gif]]
	: area === 'southern hemisphere' ? 'Southern Hemisphere'
	// West Australian, Southern Indian Ocean?
	// : area === 'austeast' ? 'Indian Ocean'
	//
	: null;
	if (!track_maps_category) {
		CeL.error('upload_media: Unknown area: ' + area);
		console.log(media_data);
		return;
	}

	track_maps_category = 'Category:'
	//
	+ get_year_range(track_maps_category, media_data.date) + ' '
	//
	+ track_maps_category
	// Category:2019 Pacific hurricane season track maps
	+ ' ' + fill_type_name(media_data) + ' season';

	var explicit_track_maps_category = track_maps_category
			+ (media_data.filename.includes('satellite') ? ' satellite images'
					: ' track maps');

	var categories = media_data.categories ? media_data.categories.clone() : [];
	categories.push(explicit_track_maps_category in category_to_parent_hash
	// track_maps_category 應該都存在。
	// 假如不存在 explicit_track_maps_category 的話，就加入 track_maps_category
	// 以確保必定有個歸屬。
	// NG: 自動創建 explicit_track_maps_category
	? explicit_track_maps_category : track_maps_category);

	if (media_data.link)
		categories.push('Category:' + media_data.link);
	categories.forEach(check_category_exists);

	media_data = Object.assign(Object.create(null), media_data, {
		categories : categories,
		// test_only : true,
		show_message : true,
		// must be set to reupload
		ignorewarnings : 1,
		// 標記此編輯為機器人編輯。
		bot : 1,
		form_data : {
			url_post_processor : function(value, XMLHttp, error) {
				if (media_directory)
					CeL.write_file(media_directory + media_data.filename,
							XMLHttp.responseText);
			}
		},

		structured_data : {
			// 描繪內容 (P180) [[Commons:Structured data/Modeling/Depiction]]
			depicts : 'Q8092'
		}
	});
	// add datetime stamp
	var date = media_data.date.format({
		format : '%4Y-%2m-%2d %2H:%2M UTC',
		zone : 0
	});
	if (!media_data.comment.includes(date)) {
		media_data.comment = media_data.comment.trim() + ' (' + date + ')';
	}

	// for debug:
	if (CeL.is_debug()) {
		console.log(media_data);
		return;
	}

	// CeL.set_debug(9);
	wiki.upload(media_data/* , after_upload */);
}

// ============================================================================

var NHC_base_URL;

// Visit tropical cyclone index page and get the recent tropical cyclones data.
function start_NHC() {
	var NHC_menu_URL = 'https://www.nhc.noaa.gov/cyclones/';
	var parsed_NHC_menu_URL = new URL(NHC_menu_URL);
	NHC_base_URL = parsed_NHC_menu_URL.origin;

	return fetch(NHC_menu_URL).then(function(response) {
		// console.log(response);
		return response.text();

	}).then(function(html) {
		CeL.write_file(data_directory
		//
		+ (new Date).format('NHC ' + cache_filename_label
		//
		+ ' menu.html'), html);
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

	// Atlantic (- Caribbean Sea - Gulf of Mexico)
	// Eastern North Pacific
	// Central North Pacific
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

	var note = token.between('<strong style="font-weight:bold;">', '</td>');
	var matched = note.between(null, '</strong>');
	if (matched && (matched = parse_NHC_time_string(matched)))
		date = matched;

	note = note.between('</strong>').replace(/^\s*<br>/g, '')
	//
	.replace(/<br><br>/g, '<br>').replace(/<br>/g, '. ')
	// remove HTML tags
	.replace(/<\/?\w[^<>]*>/g, '').trim().replace(/\s{2,}/g, ' ');

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
			source_url : source_url,
			note : note
		};
		get_NHC_Static_Images(media_data);
	}
}

// ------------------------------------------------------------------

// Visit all "Warnings/Cone Static Images" pages.
function get_NHC_Static_Images(media_data) {
	return fetch(media_data.source_url).then(function(response) {
		return response.text();
	}).then(function(html) {
		CeL.write_file(data_directory
		//
		+ (new Date).format('NHC ' + cache_filename_label
		//
		+ ' cyclones.html'), html);
		parse_NHC_Static_Images(media_data, html);
	});
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
		if (true) {
			// 檔名不添加氣旋名稱，以統一氣旋存活各時期的檔案名稱。
		} else if (matched && matched === filename.match(/^\w*/)[0]) {
			// "EP022019" → "EP022019 Hurricane Barbara"
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
	// year is included in filename. e.g., "EP022019"
	filename = media_data.date.format(filename_prefix) + 'NHC ' + filename
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

	var wiki_link = of_wiki_link(media_data);

	// National Hurricane Center
	var author = '{{label|Q1329523}}';
	Object.assign(media_data, {
		media_url : media_url,
		filename : filename,
		author : author,
		// type_name : 'hurricane',
		license : '{{PD-USGov-NOAA}}',
		description : '{{en|' + author
		//
		+ "'s 5-day track and intensity forecast cone"
				+ media_data.variable_Map.format('wiki_link') + '.}}',
		// categories : [ '[[Category:Tropical Depression One-E (2018)]]' ],
		comment : 'Import NHC tropical cyclone forecast map' + wiki_link + ' '
				+ (media_data.note ? media_data.note + ' ' : '') + media_url,
		page_text_updater : media_data.variable_Map
	// of the 2019 Pacific hurricane season
	});

	// Fetch the hurricane forecast map and upload it to commons.
	upload_media(media_data);
}

// ============================================================================

function start_JTWC() {
	// CeL.set_debug(9);
	return fetch('https://www.metoc.navy.mil/jtwc/rss/jtwc.rss?' + Date.now())
	//
	.then(function(response) {
		return response.text();
	}).then(function(xml) {
		// <H1>403 ERROR</H1>
		var error = xml.between('<H1>', '</H1>')
		// <div id="header"><h1>Server Error</h1></div>
		|| xml.between('<h1>', '</h1>');
		if (error) {
			throw new Error(error);
		}

		CeL.write_file(data_directory
		//
		+ (new Date).format('JTWC ' + cache_filename_label
		//
		+ '.rss.xml'), xml);
		xml.each_between('<item>', '</item>', for_each_JTWC_area);
	});
}

// ------------------------------------------------------------------

function for_each_JTWC_area(xml) {
	// console.log(xml);
	var date = new Date(xml.between('<pubDate>', '</pubDate>'));
	var area = xml.between('<title>', '</title>');
	// ABPW typhoon: Northwest Pacific/North Indian Ocean*
	// CPHC hurricane: Central/Eastern Pacific
	// ABIO typhoon: Southern Hemisphere
	area = area.between('Current ', ' Tropical Systems').replace(/\*$/, '')
			|| area;
	var media_data = {
		date : date,
		area : area,
		author : '{{label|Q1142111}}',
		license : '{{PD-USGov-Air Force}}\n{{PD-USGov-Navy}}',
		source_url : 'https://www.metoc.navy.mil/jtwc/jtwc.html'
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
	if (media_url) {
		for_each_JTWC_cyclone_image(html, media_data, media_url);
	}

	media_url = html
	// <li><a href='https://www.metoc.navy.mil/jtwc/products/05B_020000sair.jpg'
	// target='newwin'>IR Satellite Imagery</a></li>
	.match(/<a href='([^<>']+)'[^<>]*>([^<>]* Imagery)<\/a>/);
	if (media_url) {
		media_url.image_type = media_url[2].trim();
		for_each_JTWC_cyclone_image(html, media_data, media_url);
	}
}

function for_each_JTWC_cyclone_image(html, media_data, media_url) {
	var image_type = media_url.image_type || 'forecast map';
	/**
	 * <code>
	
	https://www.usno.navy.mil/NOOC/nmfc-ph/RSS/jtwc/pubref/3140.html
	USCINCPAC INSTRUCTION 3140.1X
	Subj: TROPICAL CYCLONE OPERATIONS MANUAL

	MANOP Heading Area Covered
	ABPW10 PGTW Western Pacific Significant Tropical Weather Advisory
	ABIO10 PGTW Indian Ocean Significant Tropical Weather Advisory
	WHPN(xx) PHNC Eastern North Pacific Area
	WTPN(xx) PGTW Western North Pacific Area
	WTIO(xx) PGTW North Indian Ocean
	WHPS(xx) PHNC Eastern South Pacific Area
	WTPS(xx) PGTW Western South Pacific Area
	WTXS(xx) PGTW South Indian Ocean

	</code>
	 */

	media_url = media_url[1].replace('http://', 'https://');
	/**
	 * <code>
	"Tropical Depression 05W (Mun) Warning #02 "
	"Hurricane 02E (Barbara) Warning #15 "
	"Tropical Storm  02E (Barbara) Warning #25   <font color=red><b>Final Warning</b></font></b><br>"

	<br>
	<p><b>Tropical Depression  08W (Wipha) Warning #14A CORRECTED   <font color=red><b>Corrected</b></font>   <font color=red><b>Final Warning</b></font></b><br>
	<b>Issued at 03/0300Z<b>

	<p><b>Tropical Cyclone Formation Alert WTPN21 </b><br>
	<b>Issued at 03/1200Z<b>

	</code>
	 */
	var NO, full_name = (html.between(null, '</b>')
	// 可能有 "<b><b>Tropical Cyclone 02S (Belna) Warning #03 <b><br>"
	|| html.between(null, '<br>'))
	// Warnings.
	// Warning #05
	.replace(/\s+\#(\d+).*/, function(all, _NO) {
		NO = _NO;
		return '';
	}).replace(/<font .+$/, '')
	// remove HTML tags
	.replace(/<\/?\w[^<>]*>/g, '').replace(/\s+Warning.*$/, '').trim().replace(
			/\s{2,}/g, ' ');

	// e.g., 'Final Warning', 'Corrected Final Warning'
	var note = html.between('<font color=red><b>', 'Issued at').replace(
			/<\/?\w[^<>]*>/g, '').trim().replace(/\s{2,}/g, ' ');

	// full_name: e.g., "Tropical Depression 07W (Seven)",
	// "Tropical Storm 07W (Seven)", "Tropical Storm 07W (Nari)" → "07W"
	// 'Tropical Storm 04W (Choi-wan)' → "04W"
	// 'Tropical Cyclone Formation Alert WTPN21' → "WTPN21"
	// matched: [ all, id, name ]
	var id = full_name.match(/\s+(\w+)(?:\s+\(([\w\-]+)\))$/)
			|| full_name.match(/\s+([A-Z]+\d+)$/);
	// console.log([ full_name, id ]);

	// e.g., 'tropical depression'
	var type = full_name.slice(0, id.index).toLowerCase().replace(
			'formation alert', '').trim();
	var name = id[2] || id[1];
	id = id[1];

	// using original file name
	var filename = media_url.match(
	// For "Tropical Cyclone Formation Alert WTPN21",
	// different alerts using the same id (WTPN21),
	// so we should add more note to distinguish one from the other.
	// full_name.includes('Formation Alert') ? /[^\/]+\.\w+$/ : /\.\w+$/

	// get full file name now
	/[^\/]+$/)[0];

	if (image_type && image_type.includes('Satellite Imagery')) {
		image_type = image_type.replace('Satellite Imagery',
				'Satellite Imagery'.toLowerCase());
		// "05B_020600sair.jpg", "05B_021200sair.jpg", "05B_021800sair.jpg",
		// "05B_04000sair.jpg"
		// 之類，後面的序號似乎會隨時間改變。
		var matched = filename.replace(/_/g, ' ').match(
				/^(.+?) \d{5,6}sair\.([\w]+)$/);
		if (matched) {
			filename = id.includes(matched[1]) ? matched[2] : matched[1] + '.'
					+ matched[2];
		}
	}

	// e.g., "2019 JTWC 07W forecast map.gif"
	filename = media_data.date.format(filename_prefix) + 'JTWC ' + id
	// + ' warning map'
	+ ' ' + image_type + '.' + filename;

	if (!name) {
		CeL.error('for_each_JTWC_cyclone: No name got for area '
				+ media_data.area + '!');
		console.log(html);
		return;
	}

	// e.g., https://commons.wikimedia.org/wiki/File:JTWC_wp0519.gif
	media_data = Object.assign({
		id : id,
		name : name,
		NO : NO,
		type : type,
		full_name : full_name,
		filename : filename,
		media_url : media_url,
	}, media_data);
	media_data.source_url += '\n' + media_url;

	// <b>Issued at 07/2200Z<b>
	// <b>Issued at 06/1600Z<b>
	var date = html.match(/Issued at (\d{2})\/(\d{2})(\d{2})Z/);
	if (date) {
		date = new Date(media_data.date.format('%4Y-%2m-' + date[1] + ' '
				+ date[2] + ':' + date[3] + ' UTC'));
		media_data.date = date;
	}

	var link = search_category_by_name(name, media_data);
	if (!link && name === id[2]) {
		// e.g., "Seven" in "Tropical Storm 07W (Seven)":
		// No [[Category:Tropical Storm Seven (2019)]],
		// Only [[Category:Tropical Storm 07W (2019)]],

		// Now test "07W" in "Tropical Storm 07W (Seven)"
		link = search_category_by_name(id, media_data);
		// link: e.g., "Tropical Depression 07W (2019)"
	}

	var wiki_link = of_wiki_link(media_data);
	Object.assign(media_data, {
		// 預測路徑圖
		description : '{{en|' + media_data.author + "'s tropical warning"
				+ media_data.variable_Map.format('wiki_link') + '.}}',
		comment : 'Import JTWC tropical cyclone ' + image_type + wiki_link
				+ '. ' + (note ? note + ' ' : ''),
		page_text_updater : media_data.variable_Map
	// JTWC using the same media_url for specific tropical
	// cyclone
	// + media_url
	});

	upload_media(media_data);
}

// ============================================================================

function start_CIMSS() {
	var base_URL = 'https://tropic.ssec.wisc.edu/';

	var media_data = {
		base_URL : base_URL,
		// area : '',
		author : '{{label|Q2996587}}',
		license : '{{UWiscCIMSS}}',
		categories : [ 'Category:University of Wisconsin CIMSS images' ],
		source_url : base_URL
	};

	// http://bagong.CIMSS.dost.gov.ph/tropical-cyclone/severe-weather-bulletin
	return fetch(media_data.source_url).then(function(response) {
		return response.text();

	}).then(function(html) {
		CeL.write_file(data_directory
		//
		+ (new Date).format('CIMSS ' + cache_filename_label
		//
		+ ' menu.html'), html);

		// <div class="col-md-12 article-header" id="swb">
		var text = html.between('<MAP NAME="storms">', '</MAP>');
		if (!text) {
			return;
		}

		text.each_between('<AREA ', '>', function(token) {
			// console.log(token);
			var matched = token.match(
			/**
			 * <code>
			<MAP NAME="storms">
			<!-- STORMS LINKS HERE -->
			<AREA SHAPE="RECT" COORDS="238,27,258,47" href="#" onclick="javascript:newStormWindow('atlantic','15L','NO')" onmouseover="doTooltip(event,'Tropical Depression OMAR',1)" onmouseout="hideTip()" alt="" >
			<AREA SHAPE="RECT" COORDS="615,50,635,70" href="#" onclick="javascript:newStormWindow('westpac','11W','NO')" onmouseover="doTooltip(event,'Typhoon  HAISHEN',1)" onmouseout="hideTip()" alt="" >
			<AREA SHAPE="RECT" COORDS="154,70,174,90" href="#" onclick="javascript:newStormWindow('eastpac','90E','YES')" onmouseover="doTooltip(event,'Invest Area 90E<br>20200905 0600Z',1)" onmouseout="hideTip()" alt="" >
			<AREA SHAPE="default" alt="default" >
			</MAP>
			 */
			/newStormWindow\('([^']+)','([^']+)','NO'\)/);
			if (!matched)
				return;
			media_data.area = media_data._area = matched[1];
			media_data.id = matched[2];
			matched = media_data.area.match(/(west|east)pac/);
			if (matched) {
				media_data.area = normalize_name(matched[1]) + 'ern Pacific';
			}

			matched = token.match(/doTooltip\(event,'([^']+)',/);
			matched = matched[1].trim().replace(/\s{2,}/g, ' ');
			matched = matched.match(/^(.+) ([^\s]+)$/);
			media_data.type = matched[1];
			media_data.name = normalize_name(matched[2]);

			var _media_data = Object.clone(media_data);
			_media_data.source_url += 'real-time/storm.frame.php?&basin='
			//
			+ media_data._area + '&sname=' + media_data.id
			//
			+ '&invest=NO&zoom=4&img=7&vars=111110000000000000000&loop=1';
			fetch_CIMSS_typhoon_frame(_media_data);
		});
	});
}

function fetch_CIMSS_typhoon_frame(media_data) {
	// console.trace(media_data);
	fetch(media_data.source_url).then(function(response) {
		return response.text();

	}).then(function(html) {
		CeL.write_file(data_directory
		//
		+ (new Date).format('CIMSS ' + cache_filename_label
		//
		+ ' menu ' + media_data.id + '.html'), html);
		// console.trace(html);
		for_each_CIMSS_typhoon(media_data, html);
	});
}

function for_each_CIMSS_typhoon(media_data, token) {
	var media_url = token.match(/ src="([^"]+\/storm\/movies\/MOV8[^"]+)"/);
	media_url = media_data.source_url.replace(/[^\/]+$/, '') + media_url[1];

	/**
	 * <code>
	<input type="radio" id="VSW" name="VSW" value=" Visible/Shorwave IR Image
	    20200905/083019UTC " >VIS/SWIR&nbsp;</label>
	</code>
	 */
	var date = token.between('Visible/Shorwave IR Image', '"');
	date = date.match(/(\d{4})(\d{2})(\d{2})\/(\d{2})(\d{2})(\d{2})(UTC)/);
	if (!date) {
		console.log(token);
		console.trace(media_data);
	}
	date = new Date(date.slice(1, 4).join('-') + ' '
			+ date.slice(4, 7).join(':') + ' ' + date[7]);

	Object.assign(media_data, {
		date : date,
		media_url : media_url,
		filename : date.format(filename_prefix) + 'CIMSS ' + media_data.id
				+ ' ' + media_data.name + ' visible infrared satellite loop'
				// .GIF → .gif
				+ media_url.match(/\.\w+$/)[0].toLowerCase()
	});
	media_data.source_url += '\n' + media_url;

	search_category_by_name(media_data.name, media_data);
	var wiki_link = of_wiki_link(media_data);

	var note;

	Object.assign(media_data, {
		description : '{{en|' + media_data.author
				+ "'s visible infrared satellite loop"
				+ media_data.variable_Map.format('wiki_link') + '.}}',
		comment :
		// comment won't accept templates and external links
		'Import CIMSS tropical cyclone visible infrared satellite loop'
				+ wiki_link + '. ' + (note ? note + ' ' : ''),
		page_text_updater : media_data.variable_Map
	}, media_data);

	// media_data.test_only = true;
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
		return response.text();
	}).then(function(PTA_IMGS_data) {
		CeL.write_file(data_directory
		//
		+ (new Date).format('CWB ' + cache_filename_label
		//
		+ ' typhoon.js'), PTA_IMGS_data);
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
	function generate_data(data, media_data, VER) {
		var date = media_data.date, FileLang = {
			'C' : 'zhtw',
			'E' : 'enus'
		};

		// var TY_ID = PTA_JSON.EACH[i].id;
		var TY_ID = data.id;

		var url = base_URL + 'Data/' + typhoon_data.DataPath
		//
		+ 'Download_PTA_' + typhoon_data.TY_DataTime + '_'
		//
		+ TY_ID + '_' + FileLang[VER] + '.png';
		// console.log(url);

		var name = typhoon_data.TYPHOON[data.id].Name[VER];
		// matched: [ all, id, name ]
		var id = name.match(/^([^\s()]+)(?:\s*\(([^()]+)\))?$/);
		if (!id) {
			CeL.error('generate_data: Cannot parse name: ' + name);
		} else if (id[2]) {
			// "TD11(原百合颱風)"→{name:"百合",id:"TD11"}
			name = id[2].match(/原(.+?)颱風/);
			// "TD11 (NARI)"→{name:"Nari",id:"TD11"}
			name = name ? name[1] : id[2];
			id = id[1];
		} else if (/^\w+\d+$/.test(id[1])) {
			// e.g., "TD14"
			// "TD11"→{id:"TD11"}, "NARI"→{name:"Nari"},
			id = id[1];
			name = undefined;
		} else {
			name = id[1];
			id = undefined;
		}
		name = normalize_name(name);
		var filename = 'CWB ' + (name || id) + ' forecast map ('
				+ (VER === 'E' ? 'en-US' : 'zh-TW') + ')';
		var language_media_data = Object.assign({
			id : id,
			name : name,
			media_url : url,
			filename : date.format(filename_prefix) + filename + '.png',
			description : [ '[[File:CWB PTA Description ' + VER + '.png]]' ],
			// comment won't accept templates and external links
			// each image has its URL
			comment : 'Import CWB tropical cyclone forecast map'
		});

		// media_data.id: English, name: paerhaps Chinese.
		var link = media_data.link
		// e.g., "NARI", "TD11 (NARI)"
		|| search_category_by_name(name, media_data);
		// CeL.info('generate_data: media_data:');
		// console.log(media_data);
		return language_media_data;
	}

	// 交通部中央氣象局
	var author = '{{label|Q257136}}';

	typhoon_data.index_of_name = Object.create(null);
	// console.log(typhoon_data);
	// console.log(JSON.stringify(typhoon_data));
	typhoon_data.list = typhoon_data.EACH.map(function(data, index) {
		// console.log(typhoon_data);
		// console.log(typhoon_data.TYPHOON);
		// console.log(data);
		var date = new Date(typhoon_data.TY_TIME.E);
		var media_data = {
			id : data.id,
			date : date,
			author : author,
			// type_name : 'typhoon',
			license : '{{Attribution CWB}}' // + '{{LicenseReview}}'
			,
			// 西北太平洋
			area : 'Northwest Pacific',
			categories : [
			//
			'Category:Typhoon track maps by Central Weather Bureau ROC' ]
		};
		// media_data.id: e.g., "TD11"
		search_category_by_name(media_data.id, media_data);
		typhoon_data.index_of_name[media_data.id] = index;
		var language_media_data_hash = {
			en : generate_data(data, media_data, 'E'),
			zh : generate_data(data, media_data, 'C')
		};
		Object.assign(media_data, language_media_data_hash);
		for ( var language in language_media_data_hash) {
			var name = media_data[language].name;
			if (name) {
				typhoon_data.index_of_name[name] = index;
			}
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

	// console.log(typhoon_data.index_of_name);

	function add_description(language_type, language_code, language) {
		typhoon_data.note[0][language_type]
		// ↑ 只用 TY_LIST_1，不會用到 TY_LIST_2。
		.each_between('<h4 class="panel-title">', null,
		//
		function(token) {
			var name = token.between('<span class="fa-blue">', '</span>');
			// "WIPHA (201907)" → "WIPHA"
			name = name.trim().replace(/\s*\([^()]+\)$/, '');
			if (!/^\w+\d+$/.test(name))
				name = normalize_name(name);
			var index = typhoon_data.index_of_name[name];
			// CeL.info('add_description: ' + name + '→' + index);

			// language_media_data
			var media_data = typhoon_data.list[index];
			var language_media_data = media_data[language_code];

			if (language_media_data.name) {
				if (language_media_data.name !== name) {
					CeL.warn('process_CWB_data: Different name: '
							+ language_media_data.name + ' !== ' + name);
				}
			} else if (name) {
				language_media_data.name = name;
			}

			var name = language_media_data.name || language_media_data.id
					|| media_data.id;
			var type = token.between('<span class="fa-red">', '</span>');
			if (type) {
				language_media_data.type = type = type.trim().toLowerCase();
				name = type
						+ (/^[\w\d]/.test(name) || language_code !== 'zh' ? ' '
								: '') + name;
			}
			var _media_data = {
				name : name,
				link : language_media_data.link || media_data.link,
				source_url : base_URL + 'V8/C/P/Typhoon/TY_NEWS.html',
				area : media_data.area
			};
			var wiki_link = of_wiki_link(_media_data);
			language_media_data.variable_Map = _media_data.variable_Map;
			language_media_data.comment += wiki_link;
			language_media_data.wiki_link = language_media_data.variable_Map
					.format('wiki_link');
			// CeL.info('add_description: language_media_data:');
			// console.log(language_media_data);

			var description = token.between('<div id="collapse-A').between('>')
			//
			.replace(/<\/?\w[^<>]*>/g, '').replace(/\s{2,}/g, ' ');
			language_media_data.description
					.push('{{en|' + author + "'s forecast map"
							+ language_media_data.wiki_link + '.}}');
			if (false) {
				// described in comment
				language_media_data.description.push('{{'
						+ (language || language_code) + '|'
						+ language_media_data.name.trim() + ' ' + description
						+ '}}');
			}
			language_media_data.comment += ': ' + description + ' '
					+ language_media_data.media_url;
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
					+ '|{{language|zh-Hant}}|80}}',
			page_text_updater : media_data.en.variable_Map
		});
		upload_media(media_data);

		Object.assign(media_data, media_data.zh, {
			other_versions : '{{F|' + media_data.en.filename
					+ '|{{language|en}}|80}}',
			page_text_updater : media_data.zh.variable_Map
		});
		upload_media(media_data);
	});
}

// ============================================================================

function start_JMA() {
	var language = 'en';
	// https://www.jma.go.jp/jp/typh/
	var base_URL = 'https://www.jma.go.jp/' + language + '/typh/';

	return fetch(base_URL + 'index.html')
	//
	.then(function(response) {
		return response.text();

	}).then(function(html) {
		CeL.write_file(data_directory
		//
		+ (new Date).format('JMA ' + cache_filename_label
		//
		+ ' typhoon.' + language + '.html'), html);

		var typhoonList = [];
		// <script language="javascript">
		// <!--
		/** ************************************************************************** */
		/**
		 * <code>
		var currentType="wide";
		var typhoonList=new Array(); typhoonList[0]="1907"; typhoonList[1]="1908"; typhoonList[2]="c"; 
		</code>
		 */
		/** ************************************************************************** */
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
				// type_name : 'typhoon',
				license : '{{JMA}}',
				categories : [ 'Category:Typhoon track maps by JMA' ]
			};

			// https://www.jma.go.jp/en/typh/1905.html
			fetch(base_URL + id + '.html').then(function(response) {
				media_data.source_url = response.useFinalURL || response.url;
				return response.text();
			}).then(for_each_JMA_typhoon.bind(media_data));
		});
	});
}

function for_each_JMA_typhoon(html) {
	var media_data = this;
	var source_url = media_data.source_url;
	// function jumpL(typhoonNo, dataType) @
	// https://www.jma.go.jp/en/typh/scripts/typhoon.js
	// e.g., https://www.jma.go.jp/en/typh/images/zooml/1905-00.png
	media_data.media_url = media_data.base_URL + 'images/zooml/'
			+ media_data.id + '-00.png';

	/**
	 * <code>
	<div id="1905" class="typhoonInfo"><input type="button" class="operation" title="Hide Text Information" onclick="javascript:hiddenAll();" value="Close"><br>LOW<br>Issued at 12:45 UTC, 21 July 2019<div class="forecast"><table><tr><td colspan="2"><img align="left" width="100%" height="2px" src="../common/line_menu.gif"></td></tr><tr><td colspan="2">&lt;Analysis at 12 UTC, 21 July&gt;</td></tr><tr><td>Scale</td><td>-</td></tr><tr><td>Intensity</td><td>-</td></tr><tr><td></td><td>LOW</td></tr><tr><td>Center position</td><td lang='en' nowrap>N40&deg;00' (40.0&deg;)</td></tr><tr><td></td><td lang='en' nowrap>E130&deg;00' (130.0&deg;)</td></tr><tr><td>Direction and speed of movement</td><td>NNE 30 km/h (15 kt)</td></tr><tr><td> Central pressure</td><td>998 hPa</td></tr><tr><td colspan="2"><img align="left" width="100%" height="2px" src="../common/line_menu.gif"></td></tr></table></div></div>

	<div id="1906" class="typhoonInfo"><input type="button" class="operation" title="Hide Text Information" onclick="javascript:hiddenAll();" value="Close"><br>TS 1906 (Nari)<br>Issued at 06:45 UTC, 26 July 2019<div class="forecast"><table><tr><td colspan="2"><img align="left" width="100%" height="2px" src="../common/line_menu.gif"></td></tr><tr><td colspan="2">&lt;Analysis at 06 UTC, 26 July&gt;</td></tr><tr><td>Scale</td><td>-</td></tr><tr><td>Intensity</td><td>-</td></tr><tr><td>Center position</td><td lang='en' nowrap>N30&deg;55' (30.9&deg;)</td></tr><tr><td></td><td lang='en' nowrap>E136&deg;10' (136.2&deg;)</td></tr><tr><td>Direction and speed of movement</td><td>NNW 20 km/h (12 kt)</td></tr><tr><td> Central pressure</td><td>1000 hPa</td></tr><tr><td>Maximum wind speed near center</td><td>18 m/s (35 kt)</td></tr><tr><td>Maximum wind gust speed</td><td>25 m/s (50 kt)</td></tr><tr><td>&ge; 30 kt wind area</td><td>E 390 km (210 NM)</td></tr><tr><td></td><td>W 220 km (120 NM)</td></tr><tr><td colspan="2"><img align="left" width="100%" height="2px" src="../common/line_menu.gif"></td></tr><tr><td colspan="2">&lt;Forecast for 18 UTC, 26 July&gt;</td></tr><tr><td>Intensity</td><td>-</td></tr><tr><td>Center position of probability circle</td><td lang='en' nowrap>N32&deg;50' (32.8&deg;)</td></tr><tr><td></td><td lang='en' nowrap>E135&deg;30' (135.5&deg;)</td></tr><tr><td>Direction and speed of movement</td><td>NNW 20 km/h (10 kt)</td></tr><tr><td> Central pressure</td><td>1000 hPa</td></tr><tr><td>Maximum wind speed near center</td><td>18 m/s (35 kt)</td></tr><tr><td>Maximum wind gust speed</td><td>25 m/s (50 kt)</td></tr><tr><td>Radius of probability circle</td><td>40 km (20 NM)</td></tr><tr><td colspan="2"><img align="left" width="100%" height="2px" src="../common/line_menu.gif"></td></tr><tr><td colspan="2">&lt;Forecast for 06 UTC, 27 July&gt;</td></tr><tr><td>Intensity</td><td>-</td></tr><tr><td>Center position of probability circle</td><td lang='en' nowrap>N34&deg;40' (34.7&deg;)</td></tr><tr><td></td><td lang='en' nowrap>E136&deg;30' (136.5&deg;)</td></tr><tr><td>Direction and speed of movement</td><td>NNE 20 km/h (10 kt)</td></tr><tr><td> Central pressure</td><td>1004 hPa</td></tr><tr><td> Maximum sustained wind speed</td><td>18 m/s (35 kt)</td></tr><tr><td>Maximum wind gust speed</td><td>25 m/s (50 kt)</td></tr><tr><td>Radius of probability circle</td><td>90 km (50 NM)</td></tr><tr><td colspan="2"><img align="left" width="100%" height="2px" src="../common/line_menu.gif"></td></tr><tr><td colspan="2">&lt;Forecast for 06 UTC, 28 July&gt;</td></tr><tr><td>Intensity</td><td>-</td></tr><tr><td></td><td>TD</td></tr><tr><td>Center position of probability circle</td><td lang='en' nowrap>N36&deg;00' (36.0&deg;)</td></tr><tr><td></td><td lang='en' nowrap>E141&deg;25' (141.4&deg;)</td></tr><tr><td>Direction and speed of movement</td><td>ENE 20 km/h (11 kt)</td></tr><tr><td> Central pressure</td><td>1010 hPa</td></tr><tr><td>Radius of probability circle</td><td>170 km (90 NM)</td></tr><tr><td colspan="2"><img align="left" width="100%" height="2px" src="../common/line_menu.gif"></td></tr></table></div></div>
	</code>
	 */
	// full_name: "type NO (name)". e.g., "TS 1906 (Nari)", "TD a", "LOW", "TD"
	var full_name = html.between('class="typhoonInfo">')
			.between('<br>', '<br>');
	// matched: [ all, type, id/NO, name ]
	var name = full_name.match(/^(\w+)(?:\s+(\w+)(?:\s+\((\w+)\))?)?/);
	// https://www.jma.go.jp/en/typh/
	var type = name[1];
	type = {
		TY : 'typhoon',
		STS : 'severe tropical storm',
		TS : 'tropical storm',
		TD : 'tropical depression',
		LOW : 'extra-tropical low'
	}[type] || type || 'tropical cyclone';
	name = name[3] || media_data.id;
	if (!name) {
		// 颱風減弱之後就會被除名，無法取得名稱資訊。
		CeL.info('for_each_JMA_typhoon: No name got for ' + full_name + '!');
		// console.log(html);
		return;
	}

	// There is no UTC date in the Japanese version.
	var date = new Date(html.between('Issued at ', '<'));
	// e.g., "2019 JMA 1906 forecast map (en).png"
	var filename = date.getUTCFullYear() + ' JMA '
	// 盡量統一檔案名稱。現在應該只會在颱風命名前後變更一次。
	+ (/^\d{4}$/.test(media_data.id) ? '' : 'tropical cyclone ')
			+ media_data.id + ' forecast map (' + media_data.language + ').png';
	var jp_language = 'jp', jp_filename = filename.replace('('
			+ media_data.language + ')', '(' + jp_language + ')');

	// <tr><td colspan="2">&lt;Analysis at 09 UTC, 4 August&gt;</td></tr>
	// ...
	// <tr><td colspan="2"><img align="left" width="100%" height="2px"
	// src="../common/line_menu.gif"></td></tr>
	var note = [], _note = html.between('Analysis at ', '<td colspan="2">');
	if (_note) {
		_note.each_between('<tr>', '</tr>', function(token) {
			var value = token.match(
			//		
			/<td>([^<>]*)<\/td>[\s\n]*<td[^<>]*>([^<>]+)<\/td>/);
			if (!value)
				return;
			var name = value[1].trim();
			value = value[2].trim();
			if (!value || value === '-')
				return;

			if (name) {
				note.push(name + ': ' + value);
			} else if (note.length > 0) {
				note[note.length - 1] += ', ' + value;
			}
		});
	}
	note = note.join('. ');

	Object.assign(media_data, {
		name : name,
		full_name : full_name,
		type : type,
		date : date,
		filename : filename,
		other_versions : '{{F|' + jp_filename + '|{{language|ja}}|80}}',
	});
	media_data.source_url = source_url + ' ' + media_data.media_url;
	search_category_by_name(name, media_data);
	var wiki_link = of_wiki_link(media_data);
	var comment = 'Import JMA tropical cyclone forecast map' + wiki_link + '. '
			+ (note ? note + '. ' : '');
	Object.assign(media_data, {
		description : '{{en|' + media_data.author + "'s forecast map"
				+ media_data.variable_Map.format('wiki_link') + '.}}',
		// comment won't accept templates and external links
		comment : comment,
		page_text_updater : media_data.variable_Map
	// JMA 註解說明太長，加上 media_url 也無法完全顯現。
	// + media_data.media_url
	});

	// https://commons.wikimedia.org/wiki/Commons:Deletion_requests/Files_in_Category:Typhoon_track_maps_by_JMA
	media_data.test_only = 'no message';

	// for the English version.
	upload_media(media_data);

	// ----------------------------------------------------
	// for the Japanese version.

	var original_language = media_data.language;
	// https://www.jma.go.jp/jp/typh/
	media_data.language = jp_language;

	'base_URL,media_url'.split(',').forEach(function(name) {
		media_data[name] = media_data[name].replace('/'
		//
		+ original_language + '/', '/' + media_data.language + '/');
	});
	media_data.source_url = source_url + ' ' + media_data.media_url;
	Object.assign(media_data, {
		filename : jp_filename,
		other_versions : '{{F|' + filename + '|{{language|en}}|80}}',
		comment : comment
	// JMA 註解說明太長，加上 media_url 也無法完全顯現。
	// + media_data.media_url
	});

	upload_media(media_data);
}

// ============================================================================

function start_PAGASA() {
	return;

	// http://bagong.pagasa.dost.gov.ph/
	var base_URL = 'https://www.pagasa.dost.gov.ph/';

	var media_data = {
		base_URL : base_URL,
		// 西北太平洋
		area : 'Northwest Pacific',
		author : '{{label|Q747963}}',
		license : '{{PD-PhilippinesGov}}',
		categories : [ 'Category:Typhoon track maps by PAGASA' ],
		source_url : base_URL + 'index.php/agri-weather'
	};

	/**
	 * <code>
	[http://www.pagasa.dost.gov.ph/tropical-cyclone/tropical-cyclone-warning-for-agriculture Tropical Cyclone Warning for Agriculture] 資訊較多，但 [http://www.pagasa.dost.gov.ph/tropical-cyclone-bulletin-iframe/2 Tropical Cyclone Bulletin] 的圖比較清晰。
	[http://www.pagasa.dost.gov.ph/index.php/agri-weather Tropical Cyclone for Agriculture] 可找到國際颱風名稱。 (search: CHANTHU CONSON site:http://www.pagasa.dost.gov.ph/)
	</code>
	 */

	// Tropical Cyclone for Agriculture
	function handle_with_TCA(html) {
		CeL.write_file(data_directory
		//
		+ (new Date).format('PAGASA ' + cache_filename_label
		//
		+ ' menu.html'), html);

		// <div class="col-md-12 article-header ">
		var text = html.between('article-header');
		text = text.between(null, {
			tail : '<style type="text/css">'
		}) || text;
		media_data.synopsis = text
				.between('<div class="panel-heading">Synopsis</div>');
		text = text.between(null, '<div class="panel-heading">Synopsis</div>');
		if (!text || !media_data.synopsis) {
			return;
		}

		text.each_between('role="tabpanel"', null,
		// <div role="tabpanel" class="tab-pane active" id="tc-303">
		for_each_PAGASA_typhoon.bind(media_data));
	}

	// Tropical Cyclone Warning for Agriculture
	function handle_with_TCWA(html) {
		CeL.write_file(data_directory
		//
		+ (new Date).format('PAGASA ' + cache_filename_label
		//
		+ ' menu.html'), html);

		// <div class="col-md-12 article-header">
		var text = html.between('article-header');
		text = text.between(null, {
			tail : '<style type="text/css">'
		}) || text;
		if (!text) {
			return;
		}

		if (false) {
			/**
			 * <code>
			<ul class="nav nav-tabs" role="tablist">
				<li role="presentation" class="active"><a href="#tc-303"  role="tab" data-toggle="tab">TCWA #10 –TROPICAL STORM “JOLINA”</a></li>
				<li role="presentation"><a href="#tc-304"   role="tab" data-toggle="tab">TCWA #2 – TYPHOON “KIKO”</a></li>
			</ul>
			</code>
			 */
			html = text.between('role="tablist">', '</ul>');
			if (!html) {
				return;
				// @deprecated
				media_data.source_url = base_URL
						+ 'tropical-cyclone-bulletin-iframe';
				fetch(media_data.source_url).then(function(response) {
					return response.text();
				}).then(handle_with_SWB);
				return;
			}

			var NO_hash = Object.create(null);
			html.each_between('<li', '</li>', function(token) {
				// console.log(token);
				var name = token.between('<a').between('>', '<');
				NO_hash[name] = token.between('data-header="', '"');
			});
		}

		text.each_between('role="tabpanel"', null,
		// <div role="tabpanel" class="tab-pane active" id="tc-303">
		for_each_PAGASA_typhoon.bind(media_data));
	}

	// Severe Weather Bulletin
	// @deprecated
	function handle_with_SWB(html) {
		CeL.write_file(data_directory
		//
		+ (new Date).format('PAGASA ' + cache_filename_label
		//
		+ ' menu.html'), html);

	}

	// http://bagong.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin
	return fetch(media_data.source_url).then(function(response) {
		return response.text();
	}).then(handle_with_TCA);
}

function for_each_PAGASA_typhoon(/* NO_hash, */token) {
	/**
	 * <code>
	<h3>TROPICAL CYCLONE WARNING<br><small><strong>TCWA #10 –TROPICAL STORM “JOLINA”</strong></small></h3>
	</code>
	 */
	var name = token.between('<h3>', '</h3>');
	name = name.between('<br>') || name;
	var NO = name;
	name = name.between('–').match(/(.+) “(.+)”/);
	if (!name) {
		CeL.error('for_each_PAGASA_typhoon: Cannot parse:\n' + token);
	}
	var type = name[1].toLowerCase();
	name = normalize_name(name[2]);
	// At 3:00 AM today, the center of the eye of Typhoon "KIKO" (CHANTHU) was
	// estimated based on all available data
	name = new RegExp(name + '"\\s+\\((.+)\\)', 'i');
	console.trace(name);
	name = this.synopsis.match(name);
	if (name) {
		name = name[1];
	}

	// console.log([ this, NO_hash, token ]);
	// console.log([ this, token ]);
	if (NO && (NO = NO.match(/#(\d+)/))) {
		NO = NO[1];
	}
	// URL/tag of .pdf may NOT updated!
	if (false) {
		// <li><a
		// href="https://pubfiles.pagasa.dost.gov.ph/tamss/weather/bulletin/SWB%231.pdf"
		// target="_blank">SWB#1.pdf</a></li>
		NO = token.match(/SWB#(\d+)\.pdf</);
		if (NO)
			NO = NO[1];
	}

	console.log([ this, name, type, NO ]);

	// <h5 style="margin-bottom: 1px;">Issued at 11:00 pm, 03 August
	// 2019</h5>
	var date = token.between('<h5', '</h5>').between('>').replace(
			/Issued at[: ]*/i, '');
	if (!date) {
		// <h5>Issued at: 8AM Friday, September 10, 2021</h5>
		date = this.synopsis.between('<h5', '</h5>').between('>').replace(
				/Issued at[: ]*/i, '').replace(/(\d)([AP]M) [\w]+/, '$1:0 $2');
		// console.log(date);
	}
	if (!name || !date) {
		CeL.error('Cannot parse:\n' + this.synopsis);
		return;
	}
	date = new Date(date + ' UTC+8');
	// console.log(date);
	throw 4564

	var media_url = token.match(
	// <img
	// src="https://pubfiles.pagasa.dost.gov.ph/tamss/weather/track.png"
	// class="img-responsive image-preview">
	/<img src="([^"]+)" class="img-responsive/)[1];

	var media_data = Object.assign({
		name : name,
		type : type,
		NO : NO,
		date : date,
		media_url : media_url,
		filename : date.format(filename_prefix) + 'PAGASA ' + name
				+ ' forecast map' + media_url.match(/\.\w+$/)[0]
	}, this);
	media_data.source_url += '\n' + media_url;

	search_category_by_name(name, media_data);
	var wiki_link = of_wiki_link(media_data);

	// <div class="panel-heading">Location of Eye/center</div>
	var note = token.between('<div class="panel-heading">Location')
	//
	.between('<div class="panel-body">', '</div>')
	// remove HTML tags
	.replace(/<\/?\w[^<>]*>/g, '').trim();

	Object.assign(media_data, {
		description : '{{en|' + media_data.author + "'s forecast map"
				+ media_data.variable_Map.format('wiki_link') + '.}}',
		// comment won't accept templates and external links
		comment : 'Import PAGASA tropical cyclone forecast map' + wiki_link
				+ '. ' + (note ? note + ' ' : ''),
		page_text_updater : media_data.variable_Map
	// PAGASA using the same media_url for specific tropical cyclone
	// + media_url
	}, media_data);

	upload_media(media_data);
}

// ============================================================================

if (!CeL.wiki.wmflabs) {
	// IPv6 is not OK for `www.nrlmry.navy.mil` @ HiNET.
	require('dns').setDefaultResultOrder('ipv4first');
}
function start_NRL() {
	// 199.9.2.143
	var base_URL = 'https://www.nrlmry.navy.mil/';

	var base_media_data = {
		base_URL : base_URL,
		author : '{{label|Q1499258}}',
		license : '{{PD-USGov-Navy}}',
		// Satellite images of tropical cyclones by NRL
		categories : [ 'Category:NRL images of tropical cyclones' ],
		// https://www.nrlmry.navy.mil/TC.html
		source_url : base_URL + 'TC.html'
	};

	// console.trace(base_media_data.source_url);
	return fetch(base_media_data.source_url).then(function(response) {
		return response.text();

	}).then(function(html) {
		// console.trace(html);
		if (false) {
			base_media_data.year = html.match(/YEAR=(20\d{2})&/);
			if (base_media_data.year) {
				base_media_data.year = base_media_data.year[1];
			} else {
				CeL.error('start_NRL: Cannot get year of NRL! 網站改版?')
				base_media_data.year = (new Date()).getFullYear();
			}
		}
		html = html.between(
		// <!-- Start of the list_storms cell Width set in tc.css -->
		'<!-- Start of the list_storms cell Width set',
		//
		'<!-- End of the list_storms cell -->');
		// console.log(html);
		html.each_between('<B><a href="/tc-bin/tc_home2.cgi?', null,
		/**
		 * <code>

		<br><B><a href="/tc-bin/tc_home2.cgi?YEAR=2021&amp;MO=11&amp;BASIN=ATL&amp;STORM_NAME=null&amp;PROD=microvap&amp;AID_DIR=/SATPRODUCTS/TC/tc22/ATL/null/microvap/dmsp&amp;PHOT=yes&amp;ARCHIVE=active&amp;NAV=tc&amp;AGE=Latest&amp;SIZE=full&amp;STYLE=tables" TARGET=_top onMouseover="highlight(this,'yellow')" onMouseout="highlight(this,'')"  ><font size="+1"><font color="black">Atlantic</font></font></a></B> <br>

		<br><B><a href="/tc-bin/tc_home2.cgi?YEAR=2022&amp;MO=11&amp;BASIN=SHEM&amp;STORM_NAME=null&amp;PROD=microvap&amp;AID_DIR=/SATPRODUCTS/TC/tc20/SHEM/null/microvap/dmsp&amp;PHOT=yes&amp;ARCHIVE=active&amp;NAV=tc&amp;AGE=Latest&amp;SIZE=full&amp;STYLE=tables" TARGET=_top onMouseover="highlight(this,'yellow')" onMouseout="highlight(this,'')"  ><font size="+1"><font color="black">Southern Hem. <BR>Season: </font></font></a></B> 22<br>

		</code>
		 */
		function(area_text) {
			var year = area_text.match(/YEAR=(20\d{2})&/)[1];
			var category_name = 'Category:' + year
			//
			+ 'NRL images of tropical cyclones';
			if (category_name in category_to_parent_hash) {
				base_media_data.categories = [ category_name ];
			}
			var area = area_text.between('<font color="black">', '</font>');
			// "Southern Hem. <BR>Season:"
			area = (area.between(null, '<BR>') || area).trim();
			if (area === 'Southern Hem.')
				area = 'Southern Hemisphere';

			// console.trace([ area, year, area_text ]);
			area_text.each_between('<font size="-1">', '</font>',
			/**
			 * <code>

			<img src = "/tc_pages_docs/icons/ball.green.jpg" border="0" height=15 width=15 alt="green ball icon"><font size="-1">90S.INVEST</font></a></td>

			</code>
			 */
			function(text) {
				// e.g., text: '08E.HILDA'
				var matched = text.trim().match(/(\d{2})\w\.(.+)/);
				var media_data = Object.assign({
					area : area,
					year : year,
					NO : 0,
					id : matched[1],
					name : matched[2]
				}, base_media_data);
				// console.trace(media_data);
				for_each_NRL_cyclone(media_data);
			});
		});
	});
}

var NRL_area_to_code_mapping = {
	Atlantic : 'AL'
};

function for_each_NRL_cyclone(media_data) {
	var area_code = media_data.area_code = NRL_area_to_code_mapping[media_data.area]
			|| media_data.area.replace(/(\w)\w+/g, '$1').replace(/\s/g, '')
					.toUpperCase();
	media_data.id = area_code + media_data.id + media_data.year;
	// console.trace(media_data.id);
	// console.trace(media_data);
	[ 'Infrared-Gray', 'Visible' ].forEach(function(image_type) {
		var image_directory_URL = media_data.base_URL + 'tcdat/tc'
		// https://www.nrlmry.navy.mil/tcdat/tc2021/WP/WP062021/png_clean/Infrared-Gray/
		+ media_data.year + '/' + area_code + '/' + media_data.id
				+ '/png_clean/' + image_type + '/';
		// console.trace(image_directory_URL);
		wiki.run(for_each_NRL_cyclone_typed_image.bind(null,
				image_directory_URL, Object.assign({
					image_type : image_type.toLowerCase()
				}, media_data)));
	});
}

function for_each_NRL_cyclone_typed_image(image_directory_URL, media_data) {
	// console.log(image_directory_URL);
	return fetch(image_directory_URL).then(function(response) {
		return response.text();

	}).then(function(html) {
		// console.log(html);
		var satellites = Object.create(null);
		html.each_between(
		// <img src="/icons/folder.gif" alt="[DIR]"> <a href="aqua/">aqua/</a>
		'folder.gif" alt="[DIR]"> <a href="', '/"', function(text) {
			satellites[text] = null;
		});
		var satellite_image_priority
		//
		= wiki.latest_task_configuration['NRL satellite image priority'];
		if (satellite_image_priority) {
			satellite_image_priority
			//
			= satellite_image_priority[media_data.area_code]
			//
			|| satellite_image_priority['default'];
		}

		if (!satellite_image_priority) {
			CeL.error('for_each_NRL_cyclone_typed_image: '
			//
			+ 'No satellite image priority configuration get!');
			return;
		}

		if (false) {
			console.trace([ media_data.area_code,
			//
			satellite_image_priority, satellites ]);
		}

		var promise;
		satellite_image_priority.some(function(satellite) {
			if (!(satellite in satellites)) {
				return;
			}

			media_data.satellite = satellite;
			// console.trace(image_directory_URL + satellite + '/');
			promise = fetch(image_directory_URL += satellite + '/')
			//
			.then(function(response) {
				return response.text();

			}).then(function(html) {
				var matched, PATTERN_image =
				// \s+(\d+(?:\.\d+)?)[KM]
				/alt="\[IMG\]"> <a href="([^"]+)">[\s\S]+?<\/a>\s+(\d{2}-\w+-\d+ \d+:\d+)/g
				//
				;
				while (matched = PATTERN_image.exec(html)) {
					media_data.NO++;
					// using the latest one
					media_data.media_url
					//
					= image_directory_URL + matched[1];
					// e.g., "24-May-2021 11:11"
					media_data.date = new Date(matched[2]);
				}
				if (media_data.media_url) {
					for_each_NRL_cyclone_image(media_data);
				} else {
					CeL.error('for_each_NRL_cyclone: '
					//
					+ 'Cannot get image url of NRL: ' + media_data.id + '!');
					console.trace(media_data);
				}
			});
			return true;
		});

		return promise;
	})['catch'](function(error) {
		console.error(error);
	});
}

function for_each_NRL_cyclone_image(media_data) {
	// console.log(media_data);

	// media_data.date.format(filename_prefix)
	var _filename_prefix = media_data.year + ' ';
	var media_url = media_data.media_url;
	Object.assign(media_data, {
		// year is included in media_data.name. e.g., "AL952021"
		filename : _filename_prefix + 'NRL ' + media_data.id + ' '
		// Geostationary
		+ media_data.name + ' ' + media_data.image_type + ' satellite'
		// .GIF → .gif
		+ media_url.match(/\.\w+$/)[0].toLowerCase()
	});
	media_data.source_url += '\n' + media_url;

	search_category_by_name(media_data.name, media_data);
	var wiki_link = of_wiki_link(media_data);

	var note = 'Satellite: ' + media_data.satellite;

	Object.assign(media_data, {
		// description={{en|1=Geostationary imagery of Tropical Cyclone Fred
		// (06L) of the 2021 Atlantic hurricane season}}
		description : '{{en|' + media_data.author + "'s "
				+ media_data.image_type + ' satellite image'
				+ media_data.variable_Map.format('wiki_link') + '.}}',
		comment : CeL.wiki.title_link_of(
				wiki.latest_task_configuration.configuration_page_title, CeL
						.gettext('Import NRL tropical cyclone'))
				+ ' '
				// comment won't accept templates and external links
				+ media_data.image_type
				+ ' satellite image'
				+ wiki_link
				+ '. '
				+ (note ? note + ' ' : ''),
		page_text_updater : media_data.variable_Map
	}, media_data);

	// media_data.test_only = true;
	upload_media(media_data);
}
