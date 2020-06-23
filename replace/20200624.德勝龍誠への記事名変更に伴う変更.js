/*

2020/6/24 4:51:9	初版試營運

 */

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

replace_tool.replace(null, {
	徳勝龍誠: REDIRECT_TARGET,
	'insource:"徳勝龍"': '德勝龍',
});
