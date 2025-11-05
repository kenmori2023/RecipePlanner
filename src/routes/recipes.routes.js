const router = require('express').Router();
const c = require('../controllers/recipes.controller');

router.get('/', c.list);
router.get('/new', c.newForm);
router.post('/', c.create);
router.get('/:id/edit', c.editForm);
router.post('/:id', c.update);
router.post('/:id/delete', c.remove);

module.exports = router;