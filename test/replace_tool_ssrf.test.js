/**
 * @name Unit tests for SSRF protection of replace/replace_tool.js
 *       get_task_configuration_from URL handling.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const node_http = require('node:http');

require('./helper.js');
const replace_tool = require('../replace/replace_tool.js');

const { is_reserved_ip_address, assert_safe_task_configuration_url } = replace_tool;

// A `dns.lookup`-compatible stub that always resolves to the given address(es).
function lookup_stub(...addresses) {
	return async (hostname, options) => addresses.map(address => ({ address }));
}

describe('is_reserved_ip_address', () => {
	it('flags loopback, private, link-local and cloud metadata addresses', () => {
		for (const address of [
			'127.0.0.1',
			'169.254.169.254',
			'10.0.0.1',
			'172.16.0.1',
			'192.168.1.1',
			'0.0.0.0',
			'::1',
			'fe80::1',
			'fc00::1',
		]) {
			assert.strictEqual(is_reserved_ip_address(address), true, address);
		}
	});

	it('does not flag ordinary public addresses', () => {
		for (const address of ['93.184.216.34', '8.8.8.8', '2606:4700:4700::1111']) {
			assert.strictEqual(is_reserved_ip_address(address), false, address);
		}
	});

	it('flags IPv4-mapped IPv6 addresses that embed a reserved address', () => {
		assert.strictEqual(is_reserved_ip_address('::ffff:127.0.0.1'), true);
		assert.strictEqual(is_reserved_ip_address('::ffff:10.0.0.5'), true);
	});
});

describe('assert_safe_task_configuration_url', () => {
	it('rejects non-HTTPS URLs', async () => {
		await assert.rejects(assert_safe_task_configuration_url('http://example-wiki.org/api.php'));
	});

	it('rejects URLs containing credentials', async () => {
		await assert.rejects(assert_safe_task_configuration_url('https://user:pass@example-wiki.org/api.php'));
	});

	it('rejects non-default ports', async () => {
		await assert.rejects(assert_safe_task_configuration_url('https://example-wiki.org:8443/api.php'));
	});

	it('rejects literal loopback addresses without needing DNS', async () => {
		await assert.rejects(assert_safe_task_configuration_url('https://127.0.0.1/api.php'));
	});

	it('rejects literal cloud metadata addresses without needing DNS', async () => {
		await assert.rejects(assert_safe_task_configuration_url('https://169.254.169.254/latest/meta-data/'));
	});

	it('rejects literal private-network addresses without needing DNS', async () => {
		await assert.rejects(assert_safe_task_configuration_url('https://10.0.0.1/api.php'));
	});

	it('rejects hostnames that resolve to a private address (DNS-rebinding)', async () => {
		await assert.rejects(assert_safe_task_configuration_url('https://internal.example.org/api.php', {
			lookup: lookup_stub('10.0.0.1'),
		}));
	});

	it('allows arbitrary public HTTPS MediaWiki hosts, not just Wikimedia domains', async () => {
		const url = await assert_safe_task_configuration_url('https://some-other-wiki.example.org/api.php', {
			lookup: lookup_stub('93.184.216.34'),
		});
		assert.strictEqual(url.href, 'https://some-other-wiki.example.org/api.php');
	});

	it('allows Wikimedia/Toolforge hosts as before', async () => {
		const url = await assert_safe_task_configuration_url('https://pagepile.toolforge.org/api.php?id=1', {
			lookup: lookup_stub('93.184.216.34'),
		});
		assert.strictEqual(url.hostname, 'pagepile.toolforge.org');
	});
});

describe('fetch(url, { redirect: "error" }) as used to fetch task configuration', () => {
	it('rejects instead of silently following a redirect to another host', async () => {
		const target_server = node_http.createServer((request, response) => {
			response.writeHead(200, { 'Content-Type': 'text/plain' });
			response.end('should never be reached');
		});
		const redirect_server = node_http.createServer((request, response) => {
			response.writeHead(302, { Location: `http://127.0.0.1:${target_server.address().port}/` });
			response.end();
		});

		await new Promise(resolve => target_server.listen(0, '127.0.0.1', resolve));
		await new Promise(resolve => redirect_server.listen(0, '127.0.0.1', resolve));
		try {
			await assert.rejects(fetch(`http://127.0.0.1:${redirect_server.address().port}/`, { redirect: 'error' }));
		} finally {
			await Promise.all([
				new Promise(resolve => target_server.close(resolve)),
				new Promise(resolve => redirect_server.close(resolve)),
			]);
		}
	});
});
