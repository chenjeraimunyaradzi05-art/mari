import { test, expect } from '@playwright/test';

test.describe('User Journey: Registration to Onboarding', () => {
  
  test('Complete registration flow', async ({ page }) => {
    // 1. Navigate to Register
    await page.goto('/register');
    
    // 2. Step 1: Personal Details
    await page.getByPlaceholder('Jane').fill('Test');
    await page.getByPlaceholder('Doe').fill('User');
    
    // Generate a random email to ensure uniqueness
    const randomEmail = `test.user.${Date.now()}@example.com`;
    await page.getByPlaceholder('you@example.com').fill(randomEmail);
    
    await page.getByPlaceholder('••••••••').fill('Password123'); // Meets requirements
    
    // Click Continue
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // 3. Step 2: Persona Selection
    await expect(page.getByText('What brings you here?')).toBeVisible();
    
    // Select a Persona (e.g., Early Career)
    // Assuming the persona selection is a radio or clickable card. 
    // Based on code reading, it's likely a list of cards mapping to radio buttons or just divs.
    // I'll select by text content.
    await page.getByText('Early Career').click();
    
    // Accept Terms (Checkbox)
    await page.locator('#acceptTerms').check();
    
    // 4. Submit Registration
    // The button typically says "Create Account" or "Join Athena" in step 2
    // I need to check the exact text in a moment, but "Create account" is a safe bet for now or "Join".
    // Let's assume the button is the primary submit button.
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    // 5. Expect Redirection to Onboarding
    // The code does router.push('/onboarding') on success.
    await expect(page).toHaveURL(/\/onboarding/);
    
    // 6. Verify Onboarding Page Load
    await expect(page.getByText('Welcome to Athena')).toBeVisible(); // Hypothetical header
  });

});
