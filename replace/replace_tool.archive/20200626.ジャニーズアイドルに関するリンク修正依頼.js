/*

2020/6/26 18:3:13	初版試營運

 */

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

replace_tool.replace(null, {
	'insource:"高橋海人"': '髙橋海人',
	'insource:"高地優吾"': '髙地優吾',
	'insource:"高橋優斗"': '髙橋優斗',
	'insource:"高木雄也"': '髙木雄也',
});
