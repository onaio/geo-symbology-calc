import { expect, test } from '@playwright/test';

test('index page has expected h1', async ({ page }) => {
	await page.goto('/');
	expect(await page.textContent('h1')).toBe('Geo Symbology Transform');

	await expect(page.locator('section a:has-text("Create config")')).toHaveAttribute(
		'href',
		'/configs'
	);
	await expect(page.locator('text=See configured workflows')).toHaveAttribute('href', '/workflows');

	await expect(page.locator('#navbarNav >> text=Create Config')).toHaveAttribute(
		'href',
		'/configs'
	);
	await expect(page.locator('#navbarNav >> text=Workflows')).toHaveAttribute('href', '/workflows');
});

/**
 * - config validation
- Modification to config(adding primary key) does not affect running app.
- - WorkFlows:
- trigger manual workflow. - check that metrics are displayed ok.
- see what haapends when deleting all pipelines.
- Edit workflow. - this should reflect even in the backend.
 */
