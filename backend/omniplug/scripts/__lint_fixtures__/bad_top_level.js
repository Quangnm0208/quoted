// This file MUST fail lint:sql. CI verifies it does.
import db from '../../src/core/db/connection.js';
const queries = {
  bad: db.prepare('SELECT 1'),
};
export { queries };
