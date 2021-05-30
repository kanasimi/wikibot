// nohup node /data/project/cewbot/wikibot/IRC/IRC-recorder.js >> /data/project/cewbot/wikibot/IRC/IRC.out.txt &
// cd ~/wikibot/ && tail -f -n -20 IRC/\#*.text

// 2016/3/7 20:24:20
// 備份/紀錄 IRC data.
// TODO: add color, IRC Bouncer, https://wikitech.wikimedia.org/wiki/Event_Platform/EventStreams

// https://webchat.freenode.net/?channels=%23wikipedia-zh&uio=MT1mYWxzZQ9a&prompt=1&nick=kanashimi

'use strict';

globalThis.no_task_date_warning = true;

require('../wiki loader.js');

var start_time = Date.now(), fs = require('fs'),
//
irc = require('irc'),
// configuration
channels = [ '#wikipedia-zh',
// https://zh.wikinews.org/wiki/Wikinews:IRC%E8%81%8A%E5%A4%A9%E9%A0%BB%E9%81%93
'#wikinews-zh', '#wikipedia-zh-help',
// https://phabricator.wikimedia.org/T160264
'#mediawiki-i18n', '#cejs' ],
//
default_channel = channels[0],
// 2016/3/7: irc.freenode.net
// 2021/5/30: irc.libera.chat
server = 'irc.libera.chat',
// 2016/9/3 20:50:33 add
commands_file = 'commands.json';

var connection_count = 0, last_receipt = Object.create(null), last_receipt_all;

channels.forEach(function(channel) {
	last_receipt[channel] = last_receipt_all = Date.now();
});

use_project = 'IRC';
// setup login_options
set_language();
// console.trace(login_options);
var login_user_name = login_options.user_name
// CeL.wiki.extract_login_user_name(login_options.user_name)
;

// https://github.com/martynsmith/node-irc
// Create the bot name
var bot = new irc.Client(server, login_user_name, {
	userName : login_user_name,
	realName : login_user_name,
	nick : login_user_name,
	password : login_options.password,
	// https://github.com/FruitieX/teleirc/issues/63
	// ircPerformCmds : [ 'NICKSERV identify ' + login_user_name + ' ' +
	// login_options.password, 'NICKSERV regain ' + login_user_name ],

	// https://github.com/reactiflux/discord-irc/issues/463
	// sasl : true,

	channels : channels,
	showErrors : true,
	// 確保機器人將繼續重新連接
	// retryCount : 20,
	autoRejoin : true
});

bot.addListener('raw', function(message) {
	CeL.debug(message);
	var to_channel;
	/**
	 * <code>
	message.args[0] 可能有： "*", "cewbot", "Changing host", "Client Quit", "Ping timeout: 244 seconds", "Quit: Leaving.", "Quit: Page closed", "Read error: Connection reset by peer", "sinisalo.freenode.net", ...
	</code>
	 */
	if (!message.args.some(function(arg) {
		if (typeof arg === 'string' && arg.startsWith('#')) {
			to_channel = arg;
			return true;
		}
	})) {
		// return;
		to_channel = commands_file;
	}
	if (!message.args.includes(default_channel)) {
		// return;
	}

	message.time = (new Date).toISOString();
	fs.appendFileSync(bot_directory + 'IRC/'
	// Warning: Need to prepare the file first!!
	// + to_channel
	+ to_channel, JSON.stringify(message) + ',\n', 'utf8');
	connection_count++;
	last_receipt[to_channel] = last_receipt_all = Date.now();
});

// https://node-irc.readthedocs.org/en/latest/API.html#client
// Listen for any message
bot.addListener('message', function(nick, to_channel, text, message) {
	// CeL.log(message);
	// bot.say(to_channel, 'test');
	// PM said user when he posts
	// bot.say(nick, 'test');
	// CeL.debug([ from, to, text, message ]);

	// TODO: use new require('fs').WriteStream(path, options)
	// Warning: Need to prepare the file first!!
	fs.appendFileSync(bot_directory + 'IRC/' + to_channel + '.text',
	//
	(new Date).toISOString() + '	' + nick + '	'
			+ text.replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '\n', 'utf8');

	if (text.includes('kanashimi')) {
		CeL.log(nick + ': ' + text);
	}
});

bot.addListener('error', function(message) {
	CeL.error('error: ', message);
});

// 用以維持不 exit。
setInterval(function() {
	CeL.log(connection_count + ' IRC connections within '
	//
	+ Math.round((Date.now() - start_time) / 1000 / 60 / 60) + ' hr');

	channels.forEach(function(channel) {
		if (Date.now() - last_receipt_all > 60 * 60 * 1000 * 24) {
			console.error('Channel ' + channel + ' silent too long. exit.');
			process.exit(0);
		}
	});
}, 1000 * 60 * 60);
