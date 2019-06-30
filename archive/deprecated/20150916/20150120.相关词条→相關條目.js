require('./wiki loader.js');

if (false)
Wiki().search('相关词条', function(pages, hits, key) {
	CeL.show_value(pages);
}, 1);

//---------------------------------------------------------------------//


// CeL.set_debug(4);
Wiki(true).search('相关词条', {
	summary : '相关词条→相關條目',
	each : function(content, title, messages, page) {
		return content.replace(/相[关關][词詞][条條]/g, '相關條目');
	},
	log_to : 'User:cewbot/log/20150120'
}, 10);

