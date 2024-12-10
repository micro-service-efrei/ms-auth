exports.up = async (pgm) => {
  pgm.createTable('users', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    username: {
      type: 'varchar(50)',
      notNull: true,
      unique: true,
    },
    password: {
      type: 'varchar(255)',
      notNull: true,
    },
    role: {
      type: 'varchar(50)',
      notNull: true,
    },
  });
};

exports.down = async (pgm) => {
  pgm.dropTable('users');
};
