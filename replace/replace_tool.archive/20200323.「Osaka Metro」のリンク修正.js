/*

2020/3/23 16:58:28	初版試營運

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
		diff_id: 76710816,
		section_title: '「Osaka Metro」のリンク修正'
	}, {
		'大阪市高速電気軌道御堂筋線': 'Osaka Metro御堂筋線',
		'大阪市高速電気軌道谷町線': 'Osaka Metro谷町線',
		'大阪市高速電気軌道四つ橋線': 'Osaka Metro四つ橋線',
		'大阪市高速電気軌道中央線': 'Osaka Metro中央線',
		'大阪市高速電気軌道千日前線': 'Osaka Metro千日前線',
		'大阪市高速電気軌道堺筋線': 'Osaka Metro堺筋線',
		'大阪市高速電気軌道長堀鶴見緑地線': 'Osaka Metro長堀鶴見緑地線',
		'大阪市高速電気軌道今里筋線': 'Osaka Metro今里筋線',
		'大阪市高速電気軌道南港ポートタウン線': 'Osaka Metro南港ポートタウン線',
		'今里駅 (大阪市高速電気軌道)': '今里駅 (Osaka Metro)',
		'梅田駅 (大阪市高速電気軌道)': '梅田駅 (Osaka Metro)',
		'中津駅 (大阪市高速電気軌道)': '中津駅 (Osaka Metro)',
		'難波駅 (大阪市高速電気軌道)': '難波駅 (Osaka Metro)',
		'平野駅 (大阪市高速電気軌道)': '平野駅 (Osaka Metro)',
	});
})();
