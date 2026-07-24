/**
 * @name Unit tests of replace/replace_tool.js tool functions.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { CeL } = require('./helper.js');
const replace_tool = require('../replace/replace_tool.js');

describe('remove_slash_tail', () => {
	const { remove_slash_tail } = replace_tool;

	it('removes the tail slash of a domain only URL', () => {
		assert.strictEqual(remove_slash_tail('http://www.example.com/'),
				'http://www.example.com');
		assert.strictEqual(remove_slash_tail('https://www.example.com/'),
				'https://www.example.com');
	});

	it('keeps the tail slash of an URL with path', () => {
		assert.strictEqual(remove_slash_tail('http://www.example.com/path/'),
				'http://www.example.com/path/');
	});

	it('keeps URLs without tail slash', () => {
		assert.strictEqual(remove_slash_tail('http://www.example.com'),
				'http://www.example.com');
		assert.strictEqual(remove_slash_tail('http://www.example.com/path'),
				'http://www.example.com/path');
	});
});

describe('convert_special_move_to', () => {
	const { convert_special_move_to } = replace_tool;

	it('converts the special keywords to their symbols', () => {
		assert.strictEqual(convert_special_move_to('DELETE_PAGE'),
				globalThis.DELETE_PAGE);
		assert.strictEqual(convert_special_move_to('REDIRECT_TARGET'),
				globalThis.REDIRECT_TARGET);
	});

	it('keeps other move targets', () => {
		assert.strictEqual(convert_special_move_to('subst:'), 'subst:');
		assert.strictEqual(convert_special_move_to('Page title'), 'Page title');
		assert.strictEqual(convert_special_move_to(undefined), undefined);
	});

	it('converts .move_to_link of a configuration object in place', () => {
		const configuration = { move_to_link: 'DELETE_PAGE', extra: 1 };
		assert.strictEqual(convert_special_move_to(configuration),
				configuration);
		assert.strictEqual(configuration.move_to_link, globalThis.DELETE_PAGE);
		assert.strictEqual(configuration.extra, 1);
	});
});

describe('unshift_move_configuration', () => {
	const { unshift_move_configuration } = replace_tool;

	it('returns the original configuration when there is nothing to unshift',
			() => {
				const move_configuration = { from: 'to' };
				assert.strictEqual(unshift_move_configuration(
						move_configuration, undefined), move_configuration);
			});

	it('prepends the items to an {Object} configuration', () => {
		assert.deepStrictEqual(unshift_move_configuration({ b: '2' },
				{ a: '1' }), { a: '1', b: '2' });
	});

	it('lets the original configuration overwrite the unshifted items', () => {
		assert.deepStrictEqual(unshift_move_configuration({ a: 'new' },
				{ a: 'old' }), { a: 'new' });
	});

	it('prepends the items as pairs to an {Array} configuration', () => {
		assert.deepStrictEqual(unshift_move_configuration([['b', '2']],
				{ a: '1' }), [['a', '1'], ['b', '2']]);
	});
});

describe('normalize_page_title_token', () => {
	const { normalize_page_title_token } = replace_tool;

	it('trims the title', () => {
		assert.strictEqual(normalize_page_title_token('  Page title \n'),
				'Page title');
	});

	it('unifies the small ヶ to the normal ケ', () => {
		assert.strictEqual(normalize_page_title_token('鎌ヶ谷スタジアム'),
				'鎌ケ谷スタジアム');
	});

	it('accepts a parsed token instead of a string', () => {
		const token = CeL.wiki.parser('鎌ヶ谷市').parse();
		assert.strictEqual(normalize_page_title_token(token), '鎌ケ谷市');
	});
});

describe('text_processor_for_search', () => {
	const { text_processor_for_search } = replace_tool;

	it('replaces .replace_from with .move_to_link', () => {
		const task_configuration = {
			replace_from: /old/g,
			move_to_link: 'new'
		};
		assert.strictEqual(text_processor_for_search.call(task_configuration,
				'an old old text'), 'an new new text');
	});
});

describe('text_processor_for_exturlusage', () => {
	const { text_processor_for_exturlusage } = replace_tool;

	it('replaces the external link in wikitext', () => {
		const task_configuration = {
			move_from_link: 'http://old.example.com',
			move_to_link: 'https://new.example.com'
		};
		assert.strictEqual(text_processor_for_exturlusage.call(
				task_configuration, 'see [http://old.example.com/page here]'),
				'see [https://new.example.com/page here]');
	});

	it('returns a falsy value when there is nothing changed', () => {
		const task_configuration = {
			move_from_link: 'http://old.example.com',
			move_to_link: 'https://new.example.com'
		};
		assert.ok(!text_processor_for_exturlusage.call(task_configuration,
				'see [http://other.example.com/page here]'));
	});

	it('does not generate a double slash', () => {
		const task_configuration = {
			move_from_link: 'http://old.example.com/path/',
			move_to_link: 'https://new.example.com/path'
		};
		assert.strictEqual(text_processor_for_exturlusage.call(
				task_configuration, 'http://old.example.com/path/page'),
				'https://new.example.com/path/page');
	});

	it('accepts .move_to_url as the replacement of .move_to_link', () => {
		const task_configuration = {
			move_from_link: 'http://old.example.com',
			move_to_url: 'https://new.example.com'
		};
		assert.strictEqual(text_processor_for_exturlusage.call(
				task_configuration, 'http://old.example.com/page'),
				'https://new.example.com/page');
	});
});

describe('remove_duplicated_display_text', () => {
	const { remove_duplicated_display_text } = replace_tool;

	function link_token_of(wikitext) {
		const parsed = CeL.wiki.parser(wikitext).parse();
		let link_token;
		parsed.each('link', token => {
			link_token = token;
		});
		assert.ok(link_token, 'got the link token of ' + wikitext);
		return link_token;
	}

	it('removes the displayed text same as the page title', () => {
		const token = link_token_of('[[Page title|Page title]]');
		remove_duplicated_display_text(token);
		assert.strictEqual(token.toString(), '[[Page title]]');
	});

	it('keeps a different displayed text', () => {
		const token = link_token_of('[[Page title|other text]]');
		remove_duplicated_display_text(token);
		assert.strictEqual(token.toString(), '[[Page title|other text]]');
	});

	it('keeps the displayed text with styles', () => {
		const token = link_token_of("[[Page title|'''Page title''']]");
		remove_duplicated_display_text(token);
		assert.strictEqual(token.toString(), "[[Page title|'''Page title''']]");
	});
});
