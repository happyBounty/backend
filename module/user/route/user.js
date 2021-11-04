/*
Project : Cryptotrades
FileName : route.js
Author : LinkWell
File Created : 21/07/2021
CopyRights : LinkWell
Purpose : This is the file which used to define all route releated to user api request.
*/

var express = require('express')
var router = express.Router();
var userController = require("./../controller/userController")
const { check } = require('express-validator');
var auth = require("./../../../middleware/auth");
var adminauth = require("./../../../middleware/adminauth");
router.get('/',userController.getList)

router.post('/', userController.register)

router.post('/login',[check('username').not().isEmpty(),check('password').not().isEmpty()],userController.login)

router.put('/forgot', [check('email').isEmail()], userController.forgot)

router.put('/reset', [auth,check('newpassword').not().isEmpty()],userController.resetpassword)

router.put('/update/:userId',[auth], userController.update)

router.put('/change', [check('newpassword').not().isEmpty(),check('oldpassword').not().isEmpty(),auth],userController.changepassword)

router.put('/profilesettings',auth,userController.updatesettings)

router.get('/profile/:userId',userController.details)

router.post('/chat',auth,userController.getListByIds)

router.get('/adminlist',adminauth,userController.getAdminList)
router.post('/createuser',adminauth, userController.createUser)
router.post('/updateuser',adminauth, userController.updateUser)

module.exports = router