// cd /d D:\USB\cgi-bin\program\wiki && node 20190629.import_NHC_hurricane_track_maps.js

/*

 2019/7/2 17:17:45	初版試營運

 */

// ----------------------------------------------------------------------------
'use strict';

// Load CeJS library and modules.
require('./wiki loader.js');

var fetch = CeL.fetch,
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'commons' /* && 'test' */);

var media_directory = base_directory;

// TODO: [[File:01E 2019 5day.png]]
// https://www.nhc.noaa.gov/archive/2019/ONE-E_graphics.php?product=5day_cone_with_line_and_wind

var menu_URL = 'https://www.nhc.noaa.gov/cyclones/';
var parsed_menu_URL = CeL.parse_URI(menu_URL);

// ----------------------------------------------------------------------------

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
prepare_directory(base_directory);

// Visit tropical cyclone index page and get the recent tropical cyclones data.
fetch(menu_URL).then(function(response) {
	// console.log(response);
	return response.text();

}).then(function(html) {
	// console.log(html);

	html.each_between(
	//
	'<th align="left" nowrap><span style="font-size: 18px;">',
	//
	'</td></tr></table>', for_each_area);
});

function parse_time_string(string) {
	var date = string
			.match(/^(\d{1,2}):?(\d{2}(?: AM| PM)?) (UTC|EDT|PDT|HST) ([a-zA-Z\d ]+)$/);
	if (date) {
		if (!/ 20\d{2}$/.test(date[4]))
			date[4] += ' ' + (new Date).getFullYear();
		date = Date.parse(date[4] + ' ' + date[1] + ':' + date[2] + ' ' + ({
			EDT : 'UTC-4',
			PDT : 'UTC-7',
			HST : 'UTC-10'
		}[date[3]] || date[3]));
	}
	return date;
}

function for_each_area(token) {
	var area = token.match(/^[^<\-]*/)[0].trim();
	var date = token
			.match(/<span class="tiny">((\d{1,2}):?(\d{2}) (UTC|EDT|PDT|HST) ([a-zA-Z\d ]+))<\/span>/);
	if (date) {
		date = parse_time_string(date[1]);
	}

	html.each_between('<!--storm serial number:',
	// <!--storm serial number: EP02-->
	// <!--storm identification: EP022019 Hurricane Barbara-->
	'<!-- END graphcrosslink -->', function(token) {
		for_each_cyclones(token, area, date);
	});
}

// 有警報才會顯示連結。
// <a href="/refresh/graphics_ep2+shtml/024116.shtml?cone#contents">
//
// <img src="/...png" ... alt="Warnings and 5-Day Cone"><br clear="left">
// Warnings/Cone<br>Static Images</a>
function for_each_cyclones(token, area, date) {
	var matched = token.between('<strong style="font-weight:bold;">',
			'</strong>');
	if (matched && (matched = parse_time_string(matched)))
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
		var map_page_URL = parsed_menu_URL.origin + matched[1];
		get_Static_Images(map_page_URL, id, area, date);
	}
}

// ------------------------------------------------------------------

// Visit all "Warnings/Cone Static Images" pages.
function get_Static_Images(map_page_URL, id, area, date) {
	return fetch(map_page_URL).then(function(response) {
		return response.text();

	}).then(function(html) {
		var matched = html.match(/<img id="coneimage" src *= *"([^<>"]+)"/)[1];
		var file_name = matched.match(/\/([^\/]+?)\+png\/[^\/]+?\.png$/)[1];
		if (id)
			file_name += ' (' + id + ')';
		if (!date)
			date = new Date;
		file_name = date.format('%4Y-%2m-%2d ') + file_name + '.png';
		matched = parsed_menu_URL.origin + matched;
		// console.log(matched);
		if (false) {
			CeL.get_URL_cache(matched, upload_media, {
				directory : base_directory,
				file_name : file_name,
				reget : true
			});
		}
		// Fetch the hurricane track maps and upload it to commons.
		upload_media({
			name : id,
			area : area,
			map_page_URL : map_page_URL,
			media_url : matched,
			file_name : file_name,
			date : date
		});
	});
}

// ------------------------------------------------------------------

function upload_media(media_data) {

	// media description
	var upload_text = [
			'== {{int:filedesc}} ==',
			'{{Information',
			"|description={{en|1=The National Hurricane Center's 5-day track and intensity forecast cone.}}",
			'|date=' + media_data.date.toISOString().replace(/\.\d+Z$/, 'Z'),
			'|source=' + media_data.map_page_URL /* media_data.media_url */,
			// National Hurricane Center
			'|author={{label|Q1329523}}', '|permission=',
			// '|other_versions=',
			// '|other_fields=',

			'}}',
			// {{Object location|0|0}}
			'',

			'== {{int:license-header}} ==', '{{PD-USGov-NOAA}}', '',

			// add categories

			'[[Category:' + media_data.date.getFullYear() + ' '
			// Atlantic (- Caribbean Sea - Gulf of Mexico)
			// Eastern North Pacific
			// Central North Pacific
			+ (media_data.area.includes('Pacific') ? 'Pacific' : 'Atlantic')
			// Category:2019 Pacific hurricane season track maps
			+ ' hurricane season track maps]]'

	// [[Category:Tropical Depression One-E (2018)]]
	];

	upload_text = upload_text.join('\n');

	wiki.upload(media_data.media_url, {
		filename : media_data.file_name,
		text : upload_text,
		comment : 'Import NHC hurricane track map'
				+ (upload_media.name ? ' (' + upload_media.name + ')' : ''),
		// must be set to reupload
		ignorewarnings : 1,
		form_data : {
			url_post_processor : function(value, XMLHttp, error) {
				if (media_directory)
					CeL.write_file(media_directory + media_data.file_name,
							XMLHttp.responseText);
			}
		}

	}, function(data, error) {
		console.log(data);
		if (error) {
			CeL.error(
			//
			typeof error === 'object' ? JSON.stringify(error) : error);
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
