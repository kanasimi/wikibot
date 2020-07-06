/*

2020/6/26 18:3:13	初版試營運

 */

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

replace_tool.replace(null, {
	山崎夕貴: REDIRECT_TARGET,
	'insource:"山崎夕貴"': '山﨑夕貴',
});
