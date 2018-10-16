// cd /d D:\USB\cgi-bin\program\wiki && node 20181016.import_earthquake_shakemap.js

/*

 2018/10/15 19:52:52	via [[commons:Special:Diff/324101051|Bots/Work requests: Automatic upload of USGS earthquake shakemaps]]
 初版試營運



 */

// ----------------------------------------------------------------------------
'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

var fetch = CeL.fetch;

/** {Object}wiki operator 操作子. */
// var wiki = Wiki(true, 'commons');
fetch(
		// https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=6&orderby=time-asc&starttime=2018-09-01
		'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=6&orderby=time-asc&starttime='
				// 回溯20天
				+ (new Date(Date.now() - 20 * 24 * 60 * 60 * 1000))
						.format('%4Y-%2m-%2d')).then(function(response) {
	// response.text().then(console.log);
	return response.json();

}).then(function(json) {
	var iterator = Promise.resolve(), length = json.features.length;
	// → detail
	json.features.forEach(function(feature, index) {
		// for_each_feature
		iterator = iterator.then(function() {
			return fetch(feature.properties.detail).then(function(response) {
				return response.json();
			}).then(function(json) {
				var shakemaps = json.properties.products.shakemap;
				// →"download/intensity.jpg":{"contentType":"image/jpeg","lastModified":1539216091000,"length":79442,"url":"https://earthquake.usgs.gov/archive/product/shakemap/us1000habl/us/1539216097797/download/intensity.jpg"}
				shakemaps.forEach(function(shakemap) {
					console.log((index + 1) + '/' + length + '	'
					//
					+ feature.id + ' ' + feature.properties.title + '	'
					//
					+ shakemap.contents["download/intensity.jpg"].url);
				});
			});
		});
	});

	return iterator;

})['catch'](function(e) {
	console.error(e);
});
