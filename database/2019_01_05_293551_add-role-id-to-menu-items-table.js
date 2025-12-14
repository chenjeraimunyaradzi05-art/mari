

// Knex migration: add role_id to menu_items table
exports.up = function(knex) {
	return knex.schema.table('menu_items', function(table) {
		table.integer('role_id').unsigned().nullable().after('id');
	});
};

exports.down = function(knex) {
	return knex.schema.table('menu_items', function(table) {
		table.dropColumn('role_id');
	});
};
