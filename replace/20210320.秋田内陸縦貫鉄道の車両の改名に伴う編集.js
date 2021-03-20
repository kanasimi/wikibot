'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

// ----------------------------------------------------------------------------

function text_processor(wikitext) {
	return wikitext.replace(/AN(8800|8900|2000)形/g, 'AN-$1形');
}

replace_tool.replace({
	// Do not use move configuration from section.
	no_task_configuration_from_section: true,
}, {
	'秋田内陸縦貫鉄道AN-8800形気動車': { text_processor },
	'秋田内陸縦貫鉄道AN-8900形気動車': { text_processor },
	'秋田内陸縦貫鉄道AN-2000形気動車': { text_processor },
});
