// cd /d D:\USB\cgi-bin\program\wiki && node 20181016.import_earthquake_shakemap.js

/*

 2018/10/15 19:52:52	Import M 6+ USGS earthquake shakemaps	via [[commons:Special:Diff/324101051#Automatic upload of USGS earthquake shakemaps|Bots/Work requests: Automatic upload of USGS earthquake shakemaps]]
 2018/10/18 13:27:26	初版試營運
 2018/10/20 10:23:22	add DYFI City Map

 TODO: Template:Location map
 TODO: Template:Globe location
 TODO: Template:Map
 TODO: [[File:2018 Osaka earthquake Map4.png]]

 TODO: [[Category:USGS isoseismal maps]]
 */

// ----------------------------------------------------------------------------
'use strict';

// Load CeJS library and modules.
require('./wiki loader.js');

var fetch = CeL.fetch,
// isTTY: 為 nodejs: interactive 互動形式。
is_console = process.stdout.isTTY
// Windows 7 to Windows 10
|| process.env.SESSIONNAME === 'Console',
//
geojson_directory = base_directory + 'data/',
/** {Boolean}若在 media_directory 目錄下已有 cache 檔案就不再 upload。 */
skip_cached = false, media_directory = base_directory + 'media/',
/** {Object}wiki operator 操作子. */
wiki = Wiki(true, 'commons' /* && 'test' */);

// ----------------------------------------------------------------------------

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
if (geojson_directory || media_directory) {
	prepare_directory(base_directory);
	geojson_directory && prepare_directory(geojson_directory);
	media_directory && prepare_directory(media_directory);
}

function remove_stamp(json_text) {
	// e.g., "indexid":"169910722","indexTime":1540252594561,
	return json_text.replace(/"indexid":"\d+","indexTime":\d+,/g, '');
}

fetch(
// 熊本地震
// https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=6&orderby=time-asc&starttime=2016-04-10&endtime=2016-04-20
'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude='
// Import M 6+ earthquakes
+ 6 + '&orderby=time-asc&starttime='
// 回溯 30天
+ (new Date(Date.now() - CeL.to_millisecond('30D')))
//
.format('%4Y-%2m-%2d'))
//
.then(function(response) {
	// response.text().then(console.log);
	return response.json();

}).then(function(json) {
	// https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
	var iterator = Promise.resolve(), length = json.features.length;
	json.features.forEach(function(feature, index) {
		// for_each_feature
		iterator = iterator.then(function() {
			// → detail
			if (is_console) {
				process.stdout.write('fetch '
				//
				+ feature.properties.detail + '\r');
			}
			return fetch(feature.properties.detail).then(function(response) {
				return Promise.all(
				//
				[ response, response.text(), response.json() ]);
			}).then(function(response) {
				var text = response[1], detail = response[2];
				response = response[0];
				// console.log(response);
				// console.log(detail);
				var data_filename = geojson_directory + detail.id + '.json',
				//
				original_text = CeL.read_file(data_filename);
				if (original_text) {
					if (remove_stamp(text)
					// .indexid, .indexTime 會次次不同!
					// 不可用 Buffer.compare(original_text,response.body)
					=== remove_stamp(original_text.toString())) {
						// There are already the same files.
						return;
					}

					detail.was_updated = true;
					CeL.move_file(data_filename,
					// updated. update images
					CeL.next_fso_NO_unused(data_filename));
				}

				CeL.write_file(data_filename, response.body);

				// https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson_detail.php
				if (detail.properties.status !== "reviewed"
				//
				|| detail.properties.type !== "earthquake")
					return;

				// https://earthquake.usgs.gov/fdsnws/event/1/query?eventid=us20005hzn&format=geojson

				var eventtime = new Date(detail.properties.time),
				//
				shakemaps = detail.properties.products.shakemap,
				// Did You Feel It? https://earthquake.usgs.gov/data/dyfi/
				dyfis = detail.properties.products.dyfi,
				//
				file_name_prefix = eventtime.format('%4Y-%2m-%2d ')
				// "year title earthquake shakemap %4Y-%2m-%2d.jpg"
				+ detail.properties.place.replace(/^.+? of /, '')
				//
				+ ' M' + detail.properties.mag + ' '
				//
				+ detail.properties.type;

				shakemaps && shakemaps.forEach(function(shakemap) {
					var media_data = {
						date : eventtime,
						media_url : shakemap
						// →"download/intensity.jpg":{"contentType":"image/jpeg","lastModified":1539216091000,"length":79442,"url":"https://earthquake.usgs.gov/archive/product/shakemap/us1000habl/us/1539216097797/download/intensity.jpg"}
						.contents["download/intensity.jpg"].url,
						file_name_prefix : file_name_prefix
					};

					check_media(media_data, shakemap, detail, index, length);
				});

				// 有感地震 DYFI City Map of responses by city or ZIP code
				// console.log(dyfis);
				dyfis && dyfis.forEach(function(dyfi) {
					var media_data = {
						date : eventtime,
						media_url : dyfi.contents[dyfi.code + '_ciim.jpg'].url,
						file_name_prefix : file_name_prefix
					};

					check_media(media_data, dyfi, detail, index, length);
				});

			});
		});
	});

	return iterator;

})['catch'](function(e) {
	console.error(e);
});

function check_media(media_data, product_data, detail, index, length) {
	media_data.file_name = media_data.file_name_prefix
			+ ' '
			+ (product_data.type === 'dyfi' ? 'intensity map'
					: product_data.type) + ' ('
			// 會有多於一個的情況，大多是因為來源不同。
			// 熊本地震: shakemap.length===2,
			// alternative shakemaps with different source: us, atlas
			// https://earthquake.usgs.gov/fdsnws/event/1/query?eventid=us20005hzn&format=geojson
			// https://earthquake.usgs.gov/earthquakes/eventpage/us20005hzn/shakemap/intensity
			// https://earthquake.usgs.gov/earthquakes/eventpage/us20005hzn/shakemap/intensity?source=atlas&code=atlas20160414122635
			+ (product_data.source === 'us' ? 'USGS' : product_data.source)
			//
			+ ')' + media_data.media_url.match(/\.[a-z]+$/)[0];

	// CeL.log('check_media: [[File:' + media_data.file_name + ']]');
	wiki.page('File:' + media_data.file_name, function(page_data) {
		// Skip exists file on Wikimedia Commons
		if (('missing' in page_data) || detail.was_updated) {
			CeL.log((index + 1) + '/' + length + '	'
			//
			+ detail.id + ' ' + detail.properties.title
			// + ' ' + media_data.media_url
			);
			// CeL.log(' ' + media_data.file_name);

			upload_media(media_data, product_data, detail);
		} else
			CeL.log('File exists: ' + media_data.file_name);
	}, {
		prop : 'ids'
	});

}

function linking_place(place) {
	var matched = place
			&& place
					.match(/^(.+ of (?:the )?|Offshore )?(.+?)( Region)?(?:(, )([^,]+))?$/);

	return matched ? (matched[1] || '')
			+ '[[:en:'
			+ matched[2]
			+ '|'
			+ matched[2]
			+ ']]'
			// matched[3]: " Region" || undefined
			+ (matched[3] || '')
			// matched[4]: ", "
			+ (matched[5] ? matched[4] + '[[:en:' + matched[5] + '|'
					+ matched[5] + ']]' : '') : place || '';
}

// @see 20170108.upload_TaiBNET_media.放棄.js
function upload_media(media_data, product_data, detail) {
	var place = product_data.properties['event-description'];
	// e.g., "Northwest of the Kuril Islands",
	// "Vancouver Island, Canada Region", "Fiji Region"
	// "Offshore El Salvador"
	place = place && place.toTitleCase(true);
	// detail.properties.place: e.g., "269km NW of Ozernovskiy, Russia"

	// media description
	var upload_text = [
			'== {{int:filedesc}} ==',
			'{{information',
			// 美國地質調查局公布的2018年地震震度分布圖 地震矩規模 地震震度圖。
			// 美國地質調查局提供的本次地震震度分布圖，震央以五角星標識。
			'|description={{en|'
					+ (product_data.type === 'dyfi' ? 'Intensity map'
							: product_data.type.toTitleCase(true))
					+ ' from USGS for the [[:en:Moment magnitude scale|magnitude]] '
					// 6 → 6.0
					+ detail.properties.mag.toFixed(1)
					// max ground-shaking intensity
					+ (product_data.properties.maxmmi ? ', maximum [[:en:Mercalli intensity scale|intensity]] '
							+ product_data.properties.maxmmi
							: '') + ' ' + detail.properties.type
					+ (detail.properties.tsunami ? ' with tsunami' : '')
					// https://earthquake.usgs.gov/fdsnws/event/1/query?eventid=us1000h3p4&format=geojson
					+ (place ? ' near ' + linking_place(place) : '')
					//
					+ ' (' + linking_place(detail.properties.place) + '), '
					// 震源深度
					+ product_data.properties.depth
					+ ' km [[:en:depth of focus (tectonics)|depth]].' + '}}',
			// {{Original upload date|}} (原始上傳日期)
			// [[commons:Module:ISOdate]]僅接受"YYYY-MM-DD HH:MM:SS"格式。
			'|date=' + media_data.date.toISOString().replace(/\.\d+Z$/, 'Z'),
			'|source=' + detail.properties.url,
			// United States Geological Survey
			'|author={{label|Q193755}}',
			'|permission=',
			// '|other_versions=',
			// '|other_fields=',

			'}}',
			// {{Object location|0|0}}
			'',

			'== {{int:license-header}} ==',
			'{{PD-USGov-USGS}}',
			'',

			// add categories

			'[[Category:' + (product_data.type === 'dyfi'
			// also: [[Category:United States Geological Survey maps]]
			? 'USGS community internet intensity maps'
			// assert: product_data.type === 'shakemap'
			: 'ShakeMaps') + ']]',

			// Do not add the day category
			// '[[Category:' + media_data.date.format('%4Y-%2m-%2d') + ']]',

			// [[Category:2018 earthquakes]]
			'[[Category:Earthquakes of ' + media_data.date.getUTCFullYear()
					+ ']]',

			'[[Category:Maps of earthquakes in '
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

	var date = product_data.id.match(/\d+$/);
	if (date && Date.now() > (date = +date)
			&& Date.now() - date < CeL.to_millisecond('3D')) {
		date = new Date(date);
	} else
		date = null;

	wiki.upload(media_data.media_url, {
		filename : media_data.file_name,
		text : upload_text,
		comment : 'Import USGS ' + (detail.was_updated ? 'updated ' : '')
				+ detail.properties.type + ' map, ' + product_data.type
				+ ' id: ' + product_data.id
				+ (date ? ' (' + date.toISOString() + ')' : ''),
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
