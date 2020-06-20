/*

2020/6/18 18:25:14	初版試營運

 */

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

replace_tool.replace({
	language: 'ja',
}, {
	'舞姫 (森鴎外の小説)': REDIRECT_TARGET,
	'Category:森鴎外': REDIRECT_TARGET,
	'Category:森鴎外の小説': REDIRECT_TARGET,
	'Template:森鴎外': REDIRECT_TARGET,
});
