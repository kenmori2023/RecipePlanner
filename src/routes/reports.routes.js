const router = require('express').Router();
const c = require('../controllers/reports.controller');
router.get('/', c.filterForm);
router.post('/results', c.results);
router.get('/_ping', (_req, res) => res.send('reports router OK'));
module.exports = router;