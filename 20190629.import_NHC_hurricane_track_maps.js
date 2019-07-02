// cd /d D:\USB\cgi-bin\program\wiki && node 20190629.import_NHC_hurricane_track_maps.js

/*

 初版試營運

 */

// ----------------------------------------------------------------------------
'use strict';

// Load CeJS library and modules.
require('./wiki loader.js');

var fetch = CeL.fetch,
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'commons' /* && 'test' */);

var media_directory = base_directory;

var menu_URL = 'https://www.nhc.noaa.gov/refresh/graphics_at1+shtml/';
var parsed_URL = CeL.parse_URI(menu_URL), source_URL;

// ----------------------------------------------------------------------------

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
prepare_directory(base_directory);

// Visit tropical cyclone index page and get the recent data.
fetch(menu_URL).then(function(response) {
	// console.log(response);
	return response.text();
}).then(function(text) {
	// Visit "Warnings/Cone Static Images" page.
	var matched = text.between(null, 'Static Images');
	var index = matched.lastIndexOf('<a ');
	matched = matched.slice(index);
	matched = matched.match(/<a href="([^<>"]+)"/);

	source_URL = parsed_URL.origin + matched[1];

	return fetch(source_URL);

}).then(function(response) {
	return response.text();
}).then(function(text) {
	var matched = text.match(/<img id="coneimage" src *= *"([^<>"]+)"/)[1];
	var file_name = matched.match(/\/([^\/]+?)\+png\/[^\/]+?\.png$/)[1];
	file_name = (new Date).format('%4Y-%2m-%2d ') + file_name + '.png';
	matched = parsed_URL.origin + matched;
	// console.log(matched);
	if (false) {
		CeL.get_URL_cache(matched, upload_file, {
			directory : base_directory,
			file_name : file_name,
			reget : true
		});
	}
	// Fetch the hurricane track maps and upload it to commons.
	upload_file({
		media_url : matched,
		file_name : file_name,
		date : new Date
	});
});

function upload_media(media_data) {

	// media description
	var upload_text = [
			'== {{int:filedesc}} ==',
			'{{Information',
			"|description={{en|1=The National Hurricane Center's 5-day track and intensity forecast cone.}}",
			'|date=' + media_data.date.toISOString().replace(/\.\d+Z$/, 'Z'),
			'|source=' + source_URL,
			// National Hurricane Center
			'|author={{label|Q1329523}}',
			'|permission=',
			// '|other_versions=',
			// '|other_fields=',

			'}}',
			// {{Object location|0|0}}
			'',

			'== {{int:license-header}} ==',
			'{{PD-USGov-NOAA}}',
			'',

			// add categories

			'[[Category:' + (new Date).getFullYear()
					+ ' Atlantic hurricane season track maps]]' ];

	upload_text = upload_text.join('\n');

	wiki.upload(media_data.media_url, {
		filename : media_data.file_name,
		text : upload_text,
		comment : 'Import NHC hurricane track map',
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