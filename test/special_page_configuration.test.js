/**
 * @name Unit tests of the tool functions of "special page configuration.js".
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

require('./helper.js');
const special_page_configuration = require('../special page configuration.js');

describe('generate_headers', () => {
	const { generate_headers } = special_page_configuration;

	it('generates the header of each column', () => {
		const page_configuration = { columns: 'title;discussions' };
		const headers = generate_headers(page_configuration);
		assert.ok(headers.startsWith('! '));
		assert.strictEqual(headers.split(' !! ').length, 2);
	});

	it('caches the generated headers at .headers', () => {
		const page_configuration = { columns: 'NO;title' };
		assert.strictEqual(generate_headers(page_configuration),
				page_configuration.headers);
	});

	it('does not overwrite the assigned .headers', () => {
		const page_configuration = {
			columns: 'NO;title',
			headers: '! assigned'
		};
		assert.strictEqual(generate_headers(page_configuration), '! assigned');
	});

	it('prefers .column_to_header of the page configuration', () => {
		const page_configuration = {
			columns: 'title',
			column_to_header: { title: 'local header' }
		};
		assert.strictEqual(generate_headers(page_configuration),
				'! local header');
	});
});

describe('is_bot_user', () => {
	const { is_bot_user } = special_page_configuration;
	const using_special_users = { bot: { 'Listed bot': true } };

	it('recognizes the users listed in .bot', () => {
		assert.ok(is_bot_user('Listed bot', null, using_special_users));
	});

	it('recognizes the user names looks like a bot', () => {
		assert.ok(is_bot_user('Cewbot', null, using_special_users));
	});

	it('does not recognize a normal user name', () => {
		assert.ok(!is_bot_user('Kanashimi', null, using_special_users));
	});
});

describe('if_too_long', () => {
	const { if_too_long } = special_page_configuration;

	it('reports a short title as not too long', () => {
		assert.strictEqual(if_too_long('Short title'), false);
	});

	it('reports a long title as too long', () => {
		assert.strictEqual(if_too_long('long title '.repeat(10)), true);
	});

	it('ignores HTML tags and styles when measuring the width', () => {
		assert.strictEqual(if_too_long("<small>'''Short title'''</small>"),
				false);
	});

	it('measures CJK characters as double width', () => {
		// 21 CJK characters === 42 > 40
		assert.strictEqual(if_too_long('話'.repeat(21)), true);
		assert.strictEqual(if_too_long('話'.repeat(19)), false);
	});
});

describe('data_sort_attributes', () => {
	const { data_sort_attributes } = special_page_configuration;

	it('generates the sort value of a string', () => {
		assert.strictEqual(data_sort_attributes('key'),
				'data-sort-value="key" ');
	});

	it('adds the number sort type', () => {
		assert.strictEqual(data_sort_attributes(12),
				'data-sort-type="number" data-sort-value="12" ');
	});

	it('adds the isoDate sort type of a {Date}', () => {
		const date = new Date(Date.UTC(2020, 0, 2, 3, 4, 5));
		assert.strictEqual(data_sort_attributes(date),
				'data-sort-type="isoDate" data-sort-value="'
						+ date.toISOString() + '" ');
	});
});

describe('local_number', () => {
	const { local_number } = special_page_configuration;

	it('generates the right aligned style attributes', () => {
		assert.strictEqual(local_number(3),
				'style="text-align: right;" | 3');
	});

	it('appends the style to attributes without style', () => {
		assert.strictEqual(local_number(3, 'colspan="2"'),
				'colspan="2" style="text-align: right;" | 3');
	});

	it('inserts the style into the existing style attribute', () => {
		assert.strictEqual(local_number(3, 'style="color: red;"'),
				'style="text-align: right;color: red;" | 3');
	});

	it('accepts the additional style', () => {
		assert.strictEqual(local_number(3, null, 'color: red;'),
				'style="color: red;text-align: right;" | 3');
	});
});

describe('adapt_configuration_to_page', () => {
	const { adapt_configuration_to_page, if_too_long }
			= special_page_configuration;

	it('applies general.max_title_length of the page configuration', () => {
		try {
			adapt_configuration_to_page({ general: { max_title_length: 5 } });
			assert.strictEqual(if_too_long('long enough'), true);
			adapt_configuration_to_page({ general: { max_title_length: 100 } });
			assert.strictEqual(if_too_long('long enough'), false);
		} finally {
			// reset to the default configuration
			adapt_configuration_to_page(undefined);
		}
	});
});
