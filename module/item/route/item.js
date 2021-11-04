/*
Project : Cryptotrades
FileName : item.js
Author : LinkWell
File Created : 21/07/2021
CopyRights : LinkWell
Purpose : This is the file which used to define all route releated to collecion api request.
*/

var express = require('express')
var router = express.Router();
var itemController = require("./../controller/itemController")
var auth = require("./../../../middleware/auth");
var adminauth = require("./../../../middleware/adminauth");
var optionalauth = require("./../../../middleware/optionalauth");
const { check } = require('express-validator');

router.post('/add',[check('name').not().isEmpty(),check('price').not().isEmpty(),check('description').not().isEmpty(),check('category_id').not().isEmpty(),check('collection_id').not().isEmpty(),auth],itemController.add)
router.put('/update',[check('item_id').not().isEmpty(),auth],itemController.update)
router.delete('/delete',[check('item_id').not().isEmpty(),auth],itemController.delete)
router.get('/list',optionalauth,itemController.list)
router.get('/listbycollection',itemController.listByCollection)
router.get('/morefromcollection',itemController.moreFromCollection)
router.post('/addviews',auth,itemController.addViews)
router.get('/viewslist',optionalauth,itemController.recentlyViewed)
router.post('/addfavourites',auth,itemController.actionFavourite)
router.get('/favouriteslist',itemController.listFavourite)
router.post('/publish',[check('item_id').not().isEmpty(),auth],itemController.publish)
router.post('/purchase',[check('item_id').not().isEmpty(),auth],itemController.purchase)
router.get('/history',itemController.history)
router.get('/prices',itemController.pricelist)
router.post('/addoffer',[check('item_id').not().isEmpty(),auth],itemController.addOffers)
router.post('/removeoffer',[check('offer_id').not().isEmpty(),auth],itemController.removeOffers)
router.post('/actionoffer',[check('item_id').not().isEmpty(),auth],itemController.actionOffers)
router.get('/offers',optionalauth,itemController.listOffers)
router.get('/checkbalance',auth,itemController.checkUserBalance)
router.post('/sendeth',[check('eth_address').not().isEmpty(),check('amount').not().isEmpty(),auth],itemController.sendETH)
router.post('/report',[check('message').not().isEmpty(), check('item_id').not().isEmpty(),auth],itemController.report)
router.post('/updateprice',[check('item_id').not().isEmpty(),auth],itemController.updatePrice)

router.get('/view/:id',itemController.view)
router.post('/generateabi',itemController.generateHash)
router.get('/getabi',itemController.getABI)
module.exports = router