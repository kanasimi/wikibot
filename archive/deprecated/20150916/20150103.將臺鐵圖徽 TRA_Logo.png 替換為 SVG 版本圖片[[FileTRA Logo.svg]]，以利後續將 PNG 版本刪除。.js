require('./wiki loader.js');

// CeL.set_debug(4);

Wiki(true)
// 判斷依據為：File:TRA_Logo.png
// get list
.imageusage('File:TRA Logo.png', {
	summary: '將臺鐵圖徽 TRA_Logo.png 替換為 SVG 版本圖片[[:File:TRA Logo.svg]]，以利後續將 PNG 版本刪除。',
	each: function(contents) {
		// https://meta.wikimedia.org/wiki/Help:Images_and_other_uploaded_files/zh-tw
		return contents.replace(CeL.wiki.file_pattern('TRA Logo.png'),
			// https://commons.wikimedia.org/wiki/File:TRA_Logo.svg
			'[[$1File:TRA Logo.svg$3');
	},
	log_to: 'User:cewbot/log/20150103'
}, {
	limit: 200,
	namespace: 0
});
