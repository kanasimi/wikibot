/*

2020/6/18 5:6:15	初版試營運

 */

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

replace_tool.replace({
	language: 'ja',
	diff_id: 78059250,
}, {
	'トウ小平': REDIRECT_TARGET,
});
