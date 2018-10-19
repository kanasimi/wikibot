// cd /d D:\USB\cgi-bin\program\wiki && node 20181016.import_earthquake_shakemap.js

/*

 2018/10/15 19:52:52	Import M 6+ USGS earthquake shakemaps	via [[commons:Special:Diff/324101051#Automatic upload of USGS earthquake shakemaps|Bots/Work requests: Automatic upload of USGS earthquake shakemaps]]
 2018/10/18 13:27:26	初版試營運



 */

// ----------------------------------------------------------------------------
'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

var fetch = CeL.fetch,
//
media_directory = base_directory + 'media/' && null, skip_cached = true,
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'commons'/* && 'test' */);

// ----------------------------------------------------------------------------

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
if (media_directory) {
	prepare_directory(base_directory);
	prepare_directory(media_directory);
}

fetch(
// https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=6&orderby=time-asc&starttime=2016-04-10&endtime=2016-04-20
'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude='
// Import M 6+ earthquakes
+ 6 + '&orderby=time-asc&starttime='
// 回溯 20天
+ (new Date(Date.now() - 20 * 24 * 60 * 60 * 1000))
//
.format('%4Y-%2m-%2d'))
//
.then(function(response) {
	// response.text().then(console.log);
	return response.json();

}).then(function(json) {
	var iterator = Promise.resolve(), length = json.features.length;
	json.features.forEach(function(feature, index) {
		// for_each_feature
		iterator = iterator.then(function() {
			// → detail
			process.stdout.write('fetch	' + feature.properties.detail + '\r');
			return fetch(feature.properties.detail).then(function(response) {
				// Did You Feel It? https://earthquake.usgs.gov/data/dyfi/
				return response.json();
			}).then(function(detail) {
				if (detail.properties.status !== "reviewed"
				//
				|| detail.properties.type !== "earthquake")
					return;

				// https://earthquake.usgs.gov/fdsnws/event/1/query?eventid=us20005hzn&format=geojson

				var eventtime = new Date(detail.properties.time),
				// intensity map
				shakemaps = detail.properties.products.shakemap;
				shakemaps.forEach(function(shakemap, index) {
					wiki.page('abbcc', function(page_data) {
						var media_data = {
							date : eventtime,
							media_url : shakemap
							//
							.contents["download/intensity.jpg"].url,
							// →"download/intensity.jpg":{"contentType":"image/jpeg","lastModified":1539216091000,"length":79442,"url":"https://earthquake.usgs.gov/archive/product/shakemap/us1000habl/us/1539216097797/download/intensity.jpg"}
							file_name : eventtime.format('%4Y-%2m-%2d ')
							// "year title earthquake shakemap %4Y-%2m-%2d.jpg"
							+ detail.properties.place.replace(/^.+? of /, '')
							//
							+ ' M' + detail.properties.mag + ' '
							//
							+ detail.properties.type + ' shakemap.jpg'
						};
						// Skip exists file on Wikimedia Commons
						if ('missing' in page_data) {
							CeL.log((index + 1) + '/' + length + '	'
							//
							+ detail.id + ' ' + detail.properties.title
							// + ' ' + media_data.media_url
							);
							// CeL.log(' ' + media_data.file_name);

							upload_media(media_data, shakemap, detail);
						} else
							CeL.log('File exists: ' + media_data.file_name);
					}, {
						prop : 'ids'
					});
				});
			});
		});
	});

	return iterator;

})['catch'](function(e) {
	console.error(e);
});

// @see 20170108.upload_TaiBNET_media.放棄.js
function upload_media(media_data, shakemap, detail) {
	// media description
	var upload_text = [
			'== {{int:filedesc}} ==',
			'{{information',
			// 美國地質調查局公布的2018年地震烈度分布圖
			'|description={{en|Shakemap from USGS for the M '
					+ detail.properties.mag
					+ ' '
					+ detail.properties.type
					+ ' near '
					+ shakemap.properties['event-description']
							.toTitleCase(true) + '}}',
			'|date=' + media_data.date.format('%4Y-%2m-%2d'),
			'|source=' + detail.properties.url,
			// United States Geological Survey
			'|author={{label|Q193755}}',
			'|permission=',
			// '|other_versions=',
			// '|other_fields=',

			'}}',
			'',

			'== {{int:license-header}} ==',
			'{{PD-USGov-USGS}}',
			'',

			'[[Category:ShakeMaps]]',
			// the day category
			// '[[Category:' + media_data.date.format('%4Y-%2m-%2d') + ']]',
			'[[Category:Earthquakes of ' + media_data.date.getUTCFullYear()
					+ ']]', '[[Category:Maps of earthquakes in '
			// Should be country name
			+ detail.properties.place.replace(/^.+, +/, '') + ']]'
	// [[Category:January 2018 in Peru]]
	];

	upload_text = upload_text.join('\n');
	CeL.debug(upload_text, 2, 'upload_media');

	CeL.log(media_data.media_url + '\n→ ' + media_data.file_name);

	if (skip_cached && media_directory
			&& CeL.fs_exists(media_directory + media_data.file_name)) {
		CeL.log('Cached: ' + media_data.file_name);
		// callback();
		return;
	}

	wiki.upload(media_data.media_url, {
		filename : media_data.file_name,
		text : upload_text,
		comment : 'Import USGS ' + detail.properties.type
		//
		+ ' shakemap, id: ' + shakemap.id,
		form_data : {
			url_post_processor : function(value, XMLHttp, error) {
				if (media_directory)
					CeL.fs_write(media_directory + media_data.file_name,
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
