'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

// ----------------------------------------------------------------------------

function text_processor(wikitext) {
	return wikitext.replace(/{{ *注意 *\|[^|{}=]*コモンズ移行後の即時削除を望んでいません[^|{}=]*}}/g, '{{keep local}}');
}

replace_tool.replace({
	// Do not use move configuration from section.
	no_task_configuration_from_section: true,
}, {
	'insource:コモンズ移行後の即時削除を望んでいません': { text_processor },
});
