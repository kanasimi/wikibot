/*

2020/3/26 20:24:29	初版試營運

 */

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');
//import { replace } from './replace_tool.js';

// ----------------------------------------------------------------------------

//async function main_process()
(async () => {
	await replace_tool.replace({
		language: 'en',
		speedy_criteria: 'merging',
	}, {
		'Category:Israeli confections': 'Category:Israeli confectionery‎',
	});
})();
