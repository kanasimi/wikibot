/*

SoccerbaseBot: Converting all citations link to Soccerbase using {{soccerbase season}}

2017/9/19 19:1:2	初版試營運。

 */

'use strict';

// Load CeJS library and modules.
require('./wiki loader.js');

/* eslint no-use-before-define: ["error", { "functions": false }] */
/* global CeL */
/* global Wiki */

// Set default language. 改變預設之語言。 e.g., 'zh'
// 採用這個方法，而非 Wiki(true, 'ja')，才能夠連報告介面的語系都改變。
set_language('en');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true);

// 
/** {String}編輯摘要。總結報告。 */
summary = '[[Special:PermanentLink/801307589#SoccerbaseBot|Bot request]]: '
		+ '[[Template:cite web]] → [[Template:soccerbase season]] - [['
		+ log_to + '|log]]';

// ----------------------------------------------------------------------------

// CeL.set_debug(6);

// TODO: name=Jô
var PATTERN_normal_title = /Games played by ([A-Z][A-Za-z]{1,}(?: +[A-Z][A-Za-z]{1,})*)(?: in )?([12]\d{3})/;

wiki.search('insource:"//www.soccerbase.com/players/player.sd?"', {
	each : function(page_data, messages, config) {
		/** {String}page title = page_data.title */
		var title = CeL.wiki.title_of(page_data),
		/**
		 * {String}page content, maybe undefined. 條目/頁面內容 = revision['*']
		 */
		content = CeL.wiki.content_of(page_data);

		if (!content) {
			return [ CeL.wiki.edit.cancel,
					'No contents: [[' + title + ']]! 沒有頁面內容！' ];
		}

		var parser = CeL.wiki.parser(page_data).parse();
		if (CeL.wiki.content_of(page_data) !== parser.toString()) {
			console.log(CeL.LCS(CeL.wiki.content_of(page_data), parser
					.toString(), 'diff'));
			throw 'parser error';
		}

		parser.each('template', function(token, index) {
			if (token.name !== 'Cite web' && token.name !== 'Cite news'
			//
			|| !token.parameters.url || !token.parameters.url
			//
			.includes('//www.soccerbase.com/players/player.sd?')) {
				return;
			}

			var matched = token.parameters.url
			//
			.match(/player_id(?:=|%3D)(\d+)/);
			if (!matched || !matched[1]) {
				CeL.error(CeL.wiki.title_link_of(title) + ': No player id: '
						+ token);
				return;
			}
			// [ player_id, season_id ]
			var parameters = [ matched[1], null ];

			if (token.parameters.title) {
				// get season_id from title
				// e.g., "Paul McShane"
				matched = token.parameters.title.toString().match(
						PATTERN_normal_title);
				if (matched) {
					// season_id
					parameters[1] = matched[2] | 0;
					parameters[2] = 'name=' + matched[1].trim();
				} else if (matched =
				// e.g., "Sergio Aguero {{!}} Football Stats {{!}} Manchester
				// City {{!}} Season 2002/2003 {{!}} Soccer Base"
				token.parameters.title.toString().match(/[Ss]eason (\d+)/)) {
					if (1900 < matched[1] && matched[1] < 2100)
						parameters[1] = +matched[1];
				} else if (
				// get name from title
				/^[A-Z][A-Za-z]{1,}(?: +[A-Z][A-Za-z]{1,})*$/
						.test(token.parameters.title)) {
					parameters[2] = 'name='
							+ token.parameters.title.toString().trim();
				}
			}

			// get season_id from url
			matched = token.parameters.url.match(/season_id(?:=|%3D)(\d+)/);
			if (matched && matched[1] && (matched = matched[1] | 0) > 0) {
				// See [[Template:Soccerbase season]]
				matched = matched > 145 ? matched + 1867 : matched + 1870;
				if (!parameters[1]) {
					parameters[1] = matched;
				} else if (parameters[1] !== matched) {
					CeL.error(CeL.wiki.title_link_of(title)
							+ ': Bad parameters: ' + parameters[1] + '!=='
							+ matched + ': ' + token);
					return;
				}
			}

			matched = token.parameters['access-date']
					|| token.parameters.accessdate;
			if (matched) {
				parameters.push('access-date=' + matched);
			}

			if (!parameters[1]) {
				CeL.error(CeL.wiki.title_link_of(title)
						+ ': No season id specified: ' + token);
				return;

				if (CeL.is_debug()) {
					CeL.warn(CeL.wiki.title_link_of(title)
							+ ': No season id specified: ' + token);
				}
				parameters.splice(1, 1);
			}

			return '{{Soccerbase season|' + parameters.join('|') + '}}';
		}, true);

		return parser.toString();
	},
	summary : summary,
	log_to : log_to
}, {
// for test
// srlimit : 20,
});
