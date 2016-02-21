require('./wiki loder.js');

// CeL.set_debug(4);

Wiki(true)
// 錢鐘
.search(
		'钱钟',
		{
			summary : '钱钟→钱锺',
			each : function(content, title, messages, page) {
				return content.replace(/([钱錢])([钟鐘])([书書韩韓])/g, function($0,
						$1, $2, $3) {
					return $1 + ($2 === '钟' ? '锺' : '鍾') + $3;
				});
			},
			log_to : 'User:cewbot/log/20150210'
		}, 50);


// 若是將錯誤的改正之後，應該重新自 offset 0 開始 search。
// 因此這種情況下基本上不應該使用此值。
if (false)
Wiki(true)
// 錢鐘
.search(
		'钱钟',
		{
			summary : '钱钟→钱锺',
			each : function(content, title, messages, page) {
				return content.replace(/([钱錢])([钟鐘])([书書韩韓])/g, function($0,
						$1, $2, $3) {
					return $1 + ($2 === '钟' ? '锺' : '鍾') + $3;
				});
			},
			log_to : 'User:cewbot/log/20150210'
		}, {
			srlimit : 50,
			sroffset : 0
		});
