'use strict';

const { Router } = require('express');
const { transfer } = require('../controllers/transferController');
const { transferRules } = require('../validators/transferValidator');
const validate = require('../middlewares/validate');

const router = Router();

/**
 * @route  POST /transfers
 * @desc   Transfer money between two accounts (atomic)
 * @access Public
 */
router.post('/', transferRules, validate, transfer);

module.exports = router;
