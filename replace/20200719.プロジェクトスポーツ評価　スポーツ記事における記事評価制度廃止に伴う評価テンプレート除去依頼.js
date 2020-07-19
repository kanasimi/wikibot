'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

replace_tool.replace(null, {
	'Template:ウィキプロジェクト スポーツ': { move_to_link: DELETE_PAGE, namespace:'ノート' }
});
