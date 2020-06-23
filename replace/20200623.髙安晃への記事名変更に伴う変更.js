/*

2020/6/23 9:11:50	初版試營運

 */

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

replace_tool.replace(null, {
	高安晃: REDIRECT_TARGET,
	'insource:"高安晃"': '髙安晃',
	髙安晃: {
		for_each_link(token, index, parent) {
			if (token[2] && token[2].toString().includes('高安')) {
				token[2] = token[2].toString().replace(/高安/g, '髙安');
			}
		}
	}
});
