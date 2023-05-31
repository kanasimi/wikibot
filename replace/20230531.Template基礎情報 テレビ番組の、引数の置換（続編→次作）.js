/*

2023/5/31 15:49:33	初版試營運

 */

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');
//import { replace } from './replace_tool.js';

// ----------------------------------------------------------------------------

//async function main_process()
(async () => {
	await replace_tool.replace(null, {
		'Template:基礎情報 テレビ番組': {
			for_template(token) {
				CeL.wiki.parse.replace_parameter(token, { 続編: '次作' }, 'parameter_name_only');
			}
		}
	});
})();
