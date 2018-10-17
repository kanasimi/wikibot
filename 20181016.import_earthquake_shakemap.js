// cd /d D:\USB\cgi-bin\program\wiki && node 20181016.import_earthquake_shakemap.js

/*

 2018/10/15 19:52:52	via [[commons:Special:Diff/324101051|Bots/Work requests: Automatic upload of USGS earthquake shakemaps]]
 初版試營運



 */

// ----------------------------------------------------------------------------
'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

var fetch = CeL.fetch,
/** {Object}wiki operator 操作子. */
var wiki = Wiki(true, 'commons' && 'test');

fetch(
		// https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=6&orderby=time-asc&starttime=2016-04-10&endtime=2016-04-20
		'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=6&orderby=time-asc&starttime='
				// 回溯20天
				+ (new Date(Date.now() - 20 * 24 * 60 * 60 * 1000))
						.format('%4Y-%2m-%2d')).then(function(response) {
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
				if (detail.properties.status !== "reviewed")
					return;

				// https://earthquake.usgs.gov/fdsnws/event/1/query?eventid=us20005hzn&format=geojson
				var eventtime = new Date(detail.properties.time);

				// intensity map
				var shakemaps = detail.properties.products.shakemap;
				// →"download/intensity.jpg":{"contentType":"image/jpeg","lastModified":1539216091000,"length":79442,"url":"https://earthquake.usgs.gov/archive/product/shakemap/us1000habl/us/1539216097797/download/intensity.jpg"}
				shakemaps.forEach(function(shakemap) {
					var filename = eventtime.format('%4Y-%2m-%2d ')
					// "year title earthquake shakemap %4Y-%2m-%2d.jpg"
					+ detail.properties.place.replace(/^.+? of /, '')
					//
					+ ' M' + detail.properties.mag + ' '
					//
					+ detail.properties.type + ' shakemap.jpg';
					console.log((index + 1) + '/' + length + '	'
					//
					+ detail.id + ' ' + detail.properties.title + '	'
					//
					+ shakemap.contents["download/intensity.jpg"].url);
					console.log('	' + filename);

					// add [[Category:ShakeMaps]]
				});
			});
		});
	});

	return iterator;

})['catch'](function(e) {
	console.error(e);
});
