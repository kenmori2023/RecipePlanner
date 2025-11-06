const router = require('express').Router();
const c = require('../controllers/search.controller');
router.get('/', c.form);      
router.get('/results', c.results); 
module.exports = router;