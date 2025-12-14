// Auto-generated from 2025_11_06_020300_update_onboarding_step_enum.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  const client = (knex.client && knex.client.config && knex.client.config.client) || '';
  if (!client || !client.toString().startsWith('mysql')) return;
  await knex.raw("ALTER TABLE `users` MODIFY COLUMN `onboarding_step` ENUM('welcome','profile','roles','journey','completed') DEFAULT 'welcome'");
};

exports.down = async function(knex) {
  const client = (knex.client && knex.client.config && knex.client.config.client) || '';
  if (!client || !client.toString().startsWith('mysql')) return;
  await knex.raw("UPDATE `users` SET `onboarding_step` = 'roles' WHERE `onboarding_step` = 'journey'");
  await knex.raw("ALTER TABLE `users` MODIFY COLUMN `onboarding_step` ENUM('welcome','profile','roles','completed') DEFAULT 'welcome'");
};
