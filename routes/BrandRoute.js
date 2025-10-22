const express = require('express');
const router = express.Router();
const brandController = require('../controllers/BrandController');

// Route to get all brands with pagination and filtering (GET)
router.get('/', brandController.getAllBrands);

// Route to get a single brand by its ID (GET)
router.get('/:id', brandController.getBrandById);

// Route to create a new brand (POST)
router.post('/create', brandController.createBrand);

// Route to update an existing brand by its ID (PUT)
router.put('/update/:id', brandController.updateBrand);

// Route to delete a brand by its ID (DELETE)
router.delete('/delete/:id', brandController.deleteBrand);

module.exports = router;
