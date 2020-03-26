/*

2020/3/2 17:2:26	初版試營運

 */

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');
//import { replace } from './replace_tool.js';

// ----------------------------------------------------------------------------

//async function main_process()
(async () => {
	await replace_tool.replace({
		language: 'ja',
		//summary: '',
		// 'small_oldid/big_new_diff' or {Number}new
		diff_id: '76416006/76424403',
		section_title: 'ジャパンエフエムネットワークのリンク修正'
	}, {
		'ジャパンエフエムネットワーク|JFN': '全国FM放送協議会|JFN',
		'ジャパンエフエムネットワーク|JFN系': '全国FM放送協議会|JFN系',
		'JAPAN FM NETWORK|JFN': '全国FM放送協議会|JFN',
		'JAPAN FM NETWORK|JFN系': '全国FM放送協議会|JFN系',
		'ジャパンエフエムネットワーク|JFNC': 'ジャパンエフエムネットワーク (企業)|JFNC',
		'JAPAN FM NETWORK|JFNC': 'ジャパンエフエムネットワーク (企業)|JFNC',
	});
})();
