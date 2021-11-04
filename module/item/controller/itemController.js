/*
Project : Cryptotrades
FileName : itemController.js
Author : LinkWell
File Created : 21/07/2021
CopyRights : LinkWell
Purpose : This is the file which used to define all item related api function.
*/

var items = require('../model/itemModel');
var fs = require('fs')
var favourites = require('../model/favouriteModel');
var options = require('./../../common/model/optionsModel')
var offers = require('../model/offerModel');
var views = require('../model/viewModel');
var histories = require('../model/historyModel');
var prices = require('../model/priceModel');
const { validationResult } = require('express-validator');
var userController = require('./../../user/controller/userController');
var users = require('./../../user/model/userModel');
var collections = require('./../../collection/model/collectionModel');
var category = require('./../../category/model/categoryModel');
const config = require('../../../helper/config');
var Web3 = require('web3');
var web3 = new Web3(new Web3.providers.HttpProvider(config.eth_http));
var cp = require('child_process');
var mailer = require('./../../common/controller/mailController'); 

/*
* This is the function which used to add item in database
*/
exports.add = function(req,res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.json({
            status: false,
            message: "Request failed",
            errors:errors.array()
        });
        return;
    }  
    var item = new items();
    item.name = req.body.name;
    item.description = req.body.description;
    item.category_id = req.body.category_id;
    item.collection_id = req.body.collection_id;
    item.author_id = req.decoded.user_id;
    item.current_owner = req.decoded.user_id;
    item.price = req.body.price;
    item.unlock_content_url = req.body.unlock_content_url ? req.body.unlock_content_url : '';
    item.media = req.body.media ? req.body.media : '';
    item.thumb = req.body.thumb ? req.body.thumb : '';
    item.external_link = req.body.external_link ? req.body.external_link : '';
    item.attributes = req.body.attributes ? req.body.attributes : [];
    item.levels = req.body.levels ? req.body.levels : [];
    item.stats = req.body.stats ? req.body.stats : [];
    collections.findOne({_id:req.body.collection_id}, function (err, collection) {
        if (err || !collection) {
            res.json({
                status: false,
                message: "Collection not found",
                errors:err
            });
            return;
        }
        item.save(function (err ,itemObj) {
            if (err) {
                res.json({
                    status: false,
                    message: "Request failed",
                    errors:err
                });
                return;
            }
            collection.item_count = collection.item_count + 1;
            collection.save(function (err ,collectionObj) {
                res.json({
                    status: true,
                    message: "Item created successfully",
                    result: itemObj
                });
            });

        })

    });
}

/*
* This is the function which used to update item in database
*/
exports.update = function(req,res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.json({
            status: false,
            message: "Request failed",
            errors:errors.array()
        });
        return;
    }  
    console.log("item id ",req.body.item_id);
    console.log("author id ",req.decoded.user_id);
    items.findOne({_id:req.body.item_id, author_id: req.decoded.user_id, status:"inactive"}, function (err, item) {
        if (err || !item) {
            res.json({
                status: false,
                message: "Item not found",
                errors:err
            });
            return;
        }
        item.name = req.body.name ?  req.body.name : item.name;
        item.description = req.body.description ?  req.body.description : item.description;
        item.price = req.body.price ?  req.body.price : item.price;
        item.media = req.body.media ?  req.body.media : item.media;
        item.thumb = req.body.thumb ?  req.body.thumb : item.thumb;
        item.external_link = req.body.external_link ?  req.body.external_link : item.external_link;
        item.unlock_content_url = req.body.unlock_content_url ?  req.body.unlock_content_url : item.unlock_content_url;
        item.attributes = req.body.attributes ?  req.body.attributes : item.attributes;
        item.levels = req.body.levels ?  req.body.levels : item.levels;
        item.stats = req.body.stats ?  req.body.stats : item.stats;
        item.category_id = req.body.category_id ? req.body.category_id : item.category_id
        item.save(function (err , itemObj) {
            if (err) {
                res.json({
                    status: false,
                    message: "Request failed",
                    errors:err
                });
                return;
            } else {
                res.json({
                    status: true,
                    message: "Item updated successfully",
                    result: itemObj 
                });  
            }
        });
    })
}

/*
* This is the function which used to publish item in ethereum network
*/
exports.publish = function(req,res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.json({
            status: false,
            message: "Request failed",
            errors:errors.array()
        });
        return;
    } 
    items.findOne({_id:req.body.item_id, author_id: req.decoded.user_id, status:"inactive"}).populate('collection_id').exec(function (err, item) {
        if (err || !item) {
            res.json({
                status: false,
                message: "Item not found",
                errors:err
            });
            return;
        }
        userController.getUserInfoByID(req.decoded.user_id,function(err,user){
            var symbolabi = item.collection_id.contract_symbol+'.abi';
            var command = 'sh mint.sh '+user.public_key + ' ' + item.collection_id.contract_address + ' ' +  symbolabi+' ' +  user.private_key
            cp.exec(command, function(err, stdout, stderr) {
                console.log('stderr ',stderr)
                console.log('stdout ',stdout)
                // handle err, stdout, stderr
                if(err) {
                    console.log("error is ",err)
                    res.json({
                        status: false,
                        message: err.toString().split('ERROR: ').pop().replace(/\n|\r/g, "")
                    });
                    return
                }
    
                var t_array = stdout.toString().split('Transaction hash: ').pop().replace(/\n|\r/g, "").split(' ')
                var transaction_hash = t_array[0].replace('Waiting','')
    
                var status_array = stdout.toString().split('Status: ').pop().replace(/\n|\r/g, " ").split(' ')
                var status_block = status_array[0]
                if(status_block == "Failed") {
                    res.json({
                        status:false,
                        message:"Item mint failed in network",
                        data: {
                            transaction_hash:transaction_hash,
                        }
                    })
                } else {
                    var token_array = stdout.toString().split('"tokenId": ').pop().replace(/\n|\r/g, " ").split(' ')
                    var token_id = token_array[0].replace('\"','').replace('\"','');
                    item.token_id = token_id;
                    item.minted_date = new Date();
                    item.status = "active";
                    item.save(function (err ,itemObj) {
                        if (err) {
                            res.json({
                                status: false,
                                message: "Request failed",
                                errors:err
                            });
                            return;
                        }
                        var history = new histories();
                        history.item_id = item._id;
                        history.collection_id = item.collection_id._id
                        history.from_id = '000000000000000000000000';
                        history.to_id = user._id
                        history.transaction_hash = transaction_hash
                        history.price = item.price;
                        history.history_type = "minted";
                        history.save(function (err ,historyObj) {
                            var price = new prices();
                            price.item_id = item._id;
                            price.price = item.price;
                            price.user_id = user._id
                            price.save(function (err ,priceObj) {
                                res.json({
                                    status: true,
                                    message: "Item published successfully",
                                    result: itemObj
                                });
                            })
                        });
                    });
                }
            });
        });

    })
}


/*
* This is the function which used to update item price
*/

exports.updatePrice = function(req,res){

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.json({
            status: false,
            message: "Request failed",
            errors:errors.array()
        });
        return;
    }

    items.findOne({_id:req.body.item_id, status:"active"}).populate('collection_id').exec(function (err, item) {
        if (err || !item) {
            res.json({
                status: false,
                message: "Item not found",
                errors:err
            });
            return;
        }
        userController.getUserInfoByID(req.decoded.user_id,function(err,sender){

            item.price = req.body.price
            item.save(function (err , itemObj) {

                var price = new prices();
                price.item_id = itemObj._id;
                price.price = itemObj.price;
                price.user_id = sender._id
                price.save(function (err ,priceObj) {
                    res.json({
                    status: true,
                    message: "Item price updated successfully",
                    result: itemObj
                        });
                    })

            })

        })
    })


}



/*
* This is the function which used to purchase item in ethereum network
*/
exports.purchase = function(req,res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.json({
            status: false,
            message: "Request failed",
            errors:errors.array()
        });
        return;
    } 
    items.findOne({_id:req.body.item_id, status:"active"}).populate('collection_id').exec(function (err, item) {
        if (err || !item) {
            res.json({
                status: false,
                message: "Item not found",
                errors:err
            });
            return;
        }
        userController.getUserInfoByID(item.current_owner,function(err,receiver){
            userController.getUserInfoByID(req.decoded.user_id,function(err,sender){
                this.checkbalance(sender.public_key,item,function(has_balance) {
                    if(!has_balance) {
                        res.json({
                            status: false,
                            message: "Not enough balance to proceed purchase",
                            errors:err
                        });
                        return;
                    }
                    this.transferAdminComission(item, function(error, comission){
                        this.transferBalance(sender,receiver, item, comission, function(is_transferred){
                            if(!has_balance) {
                                res.json({
                                    status: false,
                                    message: "Unable to transfer ETH",
                                    errors:err
                                });
                                return;
                            }
                            var symbolabi = item.collection_id.contract_symbol+'.abi';
                            var command = 'sh transaction.sh '+receiver.public_key +' '+sender.public_key +' '+item.token_id + ' ' + item.collection_id.contract_address + ' ' +  symbolabi+' ' +  receiver.private_key
                            cp.exec(command, function(err, stdout, stderr) {
                                console.log('stderr ',stderr)
                                console.log('stdout ',stdout)
                                // handle err, stdout, stderr
                                if(err) {
                                    console.log("error is ",err)
                                    res.json({
                                        status: false,
                                        message: err.toString().split('ERROR: ').pop().replace(/\n|\r/g, "")
                                    });
                                    return
                                }
                    
                                var t_array = stdout.toString().split('Transaction hash: ').pop().replace(/\n|\r/g, "").split(' ')
                                var transaction_hash = t_array[0].replace('Waiting','')
                    
                                var status_array = stdout.toString().split('Status: ').pop().replace(/\n|\r/g, " ").split(' ')
                                var status_block = status_array[0]
                                if(status_block == "Failed") {
                                    res.json({
                                        status:false,
                                        message:"NFT item transferred failed in network",
                                        data: {
                                            transaction_hash:transaction_hash,
                                        }
                                    })
                                } else {
                                    item.current_owner = req.decoded.user_id;
                                    collections.findOne({_id:item.collection_id._id},function(err, collection){
                                        collection.volume_traded = collection.volume_traded + item.price;
                                        collection.save(function (err ,collectionsaveObj) {
                                   
                                    
                                    item.save(function (err ,itemObj) {
                                        var history = new histories();
                                        history.item_id = item._id;
                                        history.collection_id = item.collection_id._id
                                        history.from_id = receiver._id;
                                        history.to_id = sender._id
                                        history.transaction_hash = transaction_hash
                                        history.history_type = "transfer";
                                        history.price = item.price;
                                        history.save(function (err ,historyObj) {
                                            var price = new prices();
                                            price.item_id = item._id;
                                            price.price = item.price;
                                            price.user_id = sender._id
                                            price.save(function (err ,priceObj) {
                                                res.json({
                                                    status: true,
                                                    message: "Item Transfer successfully",
                                                    result: itemObj
                                                });
                                            });
    
                                        });
                                    });
                                    })
                                    });
                                }
                            });
    
                        });
                    })

                })
            })
        });
    });
}

/*
* This is the function which used to purchase item in ethereum network
*/
exports.history = function(req,res) {
    var page = req.query.page ? req.query.page : '1';  

    var query;
    if(req.query.type == "item") {
        query = histories.find({'item_id':req.query.item_id});
    } else if(req.query.type == "collection") {
        query = histories.find({'collection_id':req.query.collection_id});
    } else if(req.query.type == "profile") {
        query = histories.find({'to_id':req.query.user_id});
    } else {
        query = histories.find();
    }

    if(req.query.filter) {
        query = query.where("history_type",req.query.filter)
    }
    
    var offset = ( page == '1' ) ? 0 : ((parseInt(page-1))*10);
    query = query.populate({path: 'to_id', model: users, select:'_id username first_name last_name profile_image' })
    query = query.populate({path: 'from_id', model: users, select:'_id username first_name last_name profile_image' })
    query = query.populate({path: 'item_id', model: items, select:'_id name thumb price' })
    query = query.populate({path: 'collection_id', model: collections})
    query = query.sort('-created_date')
    var options = {
    page:page,
    offset:offset,
    limit:10,    
    };  
    histories.paginate(query, options).then(function (result) {
        res.json({
            status: true,
            message: "Histories retrieved successfully",
            data: result
        });
    }); 
}

/*
* This is the function which used to show price list
*/
exports.pricelist = function(req,res) {
    var page = req.query.page ? req.query.page : '1';  
    var query = prices.find({'item_id':req.query.item_id});
    var offset = ( page == '1' ) ? 0 : ((parseInt(page-1))*10);
    query = query.populate({path: 'user_id', model: users, select:'_id username first_name last_name profile_image' })
    query = query.sort('-created_date')
    var options = {
    page:page,
    offset:offset,
    limit:10,    
    };  
    prices.paginate(query, options).then(function (result) {
        res.json({
            status: true,
            message: "Prices retrieved successfully",
            data: result
        });
    }); 
}

/*
* This is the function which used to delete item in database
*/
exports.delete = function(req,res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.json({
            status: false,
            message: "Request failed",
            errors:errors.array()
        });
        return;
    }  
    items.findOne({_id:req.body.item_id, author_id:req.decoded.user_id, status:"inactive"}, function (err, item) {
        if (err || !item) {
            res.json({
                status: false,
                message: "Item not found",
                errors:err
            });
            return;
        } else {
            collections.findOne({_id:item.collection_id},function(err, collection){
                items.deleteOne({_id:req.body.item_id},function(err) {
                    collection.item_count = collection.item_count - 1;
                    collection.save(function(err,collectionObj){
                        res.json({
                            status: true,
                            message: "Item deleted successfully"
                        }); 
                    })
                })
            })
        }
    });
}

/*
* This is the function which used to get more from collection for item detail page
*/
exports.moreFromCollection = function(req,res) {

    query = users.find({ '_id' : { $nin : [req.query.item_id] }});
    var recentquery  = items.find({collection_id:req.query.collection_id, status:'active', '_id' : { $nin : [req.query.item_id] }}).select('name description thumb like_count create_date status price');
    recentquery = recentquery.sort('-create_date').limit(5)
    recentquery.exec(function(err,recentresult){
        res.json({
            status: true,
            message: "Collection Item retrieved successfully",
            data: recentresult
        });
    })
}

/*
* This is the function which used to check list item by collection for collection home page
*/
exports.listByCollection = function(req,res) {
    var result = {
    };
    var recentquery  = items.find({collection_id:req.query.collection_id, status:'active'}).select('name description thumb like_count create_date status price');
    recentquery = recentquery.sort('-create_date').limit(5)
    recentquery.exec(function(err,recentresult){
       result["recent"] = recentresult;
       var mintedquery  = items.find({collection_id:req.query.collection_id, status:'active'}).select('name description thumb like_count create_date status price');
       mintedquery = mintedquery.sort('-minted_date').limit(5)
       mintedquery.exec(function(err,mintedresult){
         result["minted"] = mintedresult;
         var autcionquery  = items.find({collection_id:req.query.collection_id, status:'active', has_offer: true}).select('name description thumb like_count create_date status price');
         autcionquery = autcionquery.sort('-create_date').limit(5)
         autcionquery.exec(function(err,auctionresult){
           result["onauction"] = auctionresult;
           res.json({
            status: true,
            message: "Collection Item retrieved successfully",
            data: result
           });
         })
       })
    })
}

/*
* This is the function which used to list item in database
*/
exports.list = function(req,res) {
    var keyword = req.query.keyword ? req.query.keyword : ''; 
    keyword = keyword.replace("+"," ");     
    var page = req.query.page ? req.query.page : '1';  
    var query  = items.find();
    var offset = ( page == '1' ) ? 0 : ((parseInt(page-1))*10);
    if ( keyword != '' ) {
        search = { $or: [ { 
            name :   {
                $regex: new RegExp(keyword, "ig")
        }  } , {
            description : {
                $regex : new RegExp ( keyword , "ig")
            }
        }] }
       query = query.or(search)
    }    
    if(req.query.type == "mycollection" && req.decoded.user_id != null) {
        query = query.where('collection_id',req.query.collection_id);
        query = query.sort('-create_date')
    } else if(req.query.type == "view" && req.decoded.user_id != null) {
        query = query.where('_id',req.query.item_id);
    } else {
        if(req.query.user && req.decoded.user_id != null) {
            if(req.decoded.role == 1 && req.query.user == "admin") {
            } else {
                query = query.where('status','active');
            }
            
        } else {
            query = query.where('status','active');
        }
        
        if(req.query.type == "my") {
            query = query.where('author_id',req.query.user_id).sort('-create_date');
        }else if(req.query.type == "collected") {
            query = query.where('current_owner',req.query.user_id).where("author_id",{"$ne":req.query.user_id}).sort('-create_date');
        } else if(req.query.type == "view") { 
            query = query.where('_id',req.query.item_id);
        } else if(req.query.type == "offer") { 
            query = query.where('has_offer',true);
        } else if(req.query.type == "collection") { 
            query = query.where('collection_id',req.query.collection_id);
        } else if(req.query.type == "category") { 
            query = query.where('category_id',req.query.category_id);
        } else if (req.query.type == "price") {
            query = query.where('price',{ $gte: req.query.price_range })
        } else if(req.query.type == "mostviewed") {
            query = query.sort('-view_count')
        } else if(req.query.type == "mostliked") {
            query = query.sort('-like_count')
        } else {
            query = query.sort('-create_date')
        }
    }
    var options;
    if(req.query.type != "view") { 
        options = {
            select:  'name description thumb like_count create_date status price',
            page:page,
            offset:offset,
            limit:10,    
        }; 
    } else {
        query = query.populate({path: 'collection_id', model: collections }).populate({path: 'category_id', model: category }).populate({path: 'current_owner', model: users, select:'_id username first_name last_name profile_image'})
        options = {
            page:page,
            offset:offset,
            limit:10,    
        }; 
    }

 
   
    items.paginate(query, options).then(function (result) {
        if(req.query.type != "view") { 
            res.json({
                status: true,
                message: "Item retrieved successfully",
                data: result,
                return_id:0
            });
        } else {
            var is_liked = 0;
            if(req.decoded.user_id != null) {
                favourites.findOne({item_id:req.query.item_id, user_id:req.decoded.user_id}, function (err, favourite) {
                  if(favourite) {
                      is_liked = 1
                  }
                  res.json({
                    status: true,
                    message: "Item retrieved successfully",
                    data: result,
                    return_id: is_liked
                  });
                })
            } else {
                res.json({
                    status: true,
                    message: "Item retrieved successfully",
                    data: result,
                    return_id: is_liked
                });
            }

        }

    }); 
}

/*
* This is the function which used to list item in database
*/
exports.actionFavourite = function(req,res) {
    items.findOne({_id:req.body.item_id, status:"active"}, function (err, item) {
        if (err || !item) {
            res.json({
                status: false,
                message: "Item not found",
                errors:err
            });
            return;
        }
        favourites.findOne({item_id:req.body.item_id, user_id:req.decoded.user_id}, function (err, favourite) {
            if(req.body.type == "increase") {
                if (!favourite) {
                    item.like_count = item.like_count + 1;
                    var newfavourite = new favourites();
                    newfavourite.user_id = req.decoded.user_id;
                    newfavourite.item_id = req.body.item_id;
                    newfavourite.save(function(err,result){
                        item.save(function(err,result){
                            res.json({
                                status: true,
                                message: "Favoruite added successfully",
                            });
                        })
                    })
                } else {
                    res.json({
                        status: true,
                        message: "Favoruite added successfully",
                    });
                }
            } else {
                if (!favourite) {
                    res.json({
                        status: true,
                        message: "Favoruite removed successfully",
                    });
                } else {
                    item.like_count = item.like_count - 1;
                    favourites.deleteOne({_id:favourite._id},function(err) {
                        item.save(function(err,result){
                            res.json({
                                status: true,
                                message: "Favoruite removed successfully",
                            });
                        })
                    })
                }
            }
            
        })
        
    });
}


/*
* This is the function which used to list user who add the item as favourite item
*/
exports.listFavourite = function(req,res) {
    var page = req.query.page ? req.query.page : '1';  
    var query = favourites.find();
    var offset = ( page == '1' ) ? 0 : ((parseInt(page-1))*10);
    query = query.where('user_id',req.query.user_id)
    query = query.populate({path: 'item_id', model: items, select:'_id name thumb price' })
    query = query.sort('-created_date')
    var options = {
    page:page,
    offset:offset,
    limit:15,    
    };  
    favourites.paginate(query, options).then(function (result) {
        res.json({
            status: true,
            message: "Favourites retrieved successfully",
            data: result
        });
    }); 
}


/*
* This is the function which used to add views for user
*/
exports.addViews = function(req,res) {
    items.findOne({_id:req.body.item_id, status:"active"}, function (err, item) {
        if (err || !item) {
            res.json({
                status: false,
                message: "Item not found",
                errors:err
            });
            return;
        }
        views.findOne({item_id:req.body.item_id, user_id:req.decoded.user_id}, function (err, view) {
            if (!view) {
                item.view_count = item.view_count + 1;
                var newview = new views();
                newview.user_id = req.decoded.user_id;
                newview.item_id = req.body.item_id;
                newview.save(function(err,result){
                    item.save(function(err,result){
                        res.json({
                            status: true,
                            message: "View added successfully",
                        });
                    })
                })
            } else {
                res.json({
                    status: true,
                    message: "View added successfully",
                });
            }
        })
        
    });
}

/*
* This is the function which used to list user who recently view the item
*/
exports.recentlyViewed = function(req,res) {
    var page = req.query.page ? req.query.page : '1';  
    var query = views.find();
    var offset = ( page == '1' ) ? 0 : ((parseInt(page-1))*10);
    query = query.where('item_id',req.query.item_id)
    query = query.where('user_id',req.query.user_id)
    query = query.sort('-created_date')
    var options = {
    page:page,
    offset:offset,
    limit:15,    
    };  
    views.paginate(query, options).then(function (result) {
        res.json({
            status: true,
            message: "Views retrieved successfully",
            data: result
        });
    }); 
}

/*
* This is the function which used to list item offer and profile offer
*/
exports.addOffers = function(req,res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.json({
            status: false,
            message: "Request failed",
            errors:errors.array()
        });
        return;
    } 
    items.findOne({_id:req.body.item_id, status:"active"}).populate('collection_id').exec(function (err, item) {
        if (err || !item) {
            res.json({
                status: false,
                message: "Item not found",
                errors:err
            });
            return;
        }
        userController.getUserInfoByID(req.decoded.user_id,function(err,sender){
            this.checkbalance(sender.public_key,{price:req.body.price},function(has_balance) {
                if(!has_balance) {
                    res.json({
                        status: false,
                        message: "Not enough balance to proceed purchase",
                        errors:err
                    });
                    return;
                }
                item.has_offer = true;
                item.save(function(err,itemObj){
                    offers.findOne({sender:req.decoded.user_id, item_id:req.body.item_id}).exec(function (err, offerObj) {
                        if (!offerObj) {
                            var offer = new offers();
                            offer.sender = req.decoded.user_id;
                            offer.item_id = req.body.item_id;
                            offer.receiver = item.current_owner;
                            offer.price = req.body.price;
                            offer.save(function(err,offerOb){
                                var history = new histories();
                                history.item_id = item._id;
                                history.collection_id = item.collection_id._id;
                                history.from_id = req.decoded.user_id;
                                history.to_id = item.current_owner
                                history.transaction_hash = ""
                                history.history_type = "bids";
                                history.price = req.body.price;
                                history.save(function (err ,historyObj) {
                                    res.json({
                                        status: true,
                                        message: "offer added successfully",
                                        data: offerOb
                                    });
                                });
                            });
                        } else {
                            res.json({
                                status: false,
                                message: "offer added already",
                            });
                        }
                    })

                });

            });
        });
    })
}

/*
* This is the function which used to update offer
*/
exports.actionOffers = function(req,res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.json({
            status: false,
            message: "Request failed",
            errors:errors.array()
        });
        return;
    } 

    items.findOne({_id:req.body.item_id, current_owner: req.decoded.user_id, status:"active"}).populate('collection_id').exec(function (err, item) {
        if (err || !item) {
            res.json({
                status: false,
                message: "Item not found",
                errors:err
            });
            return;
        }
        offers.findOne({_id:req.body.offer_id},function(err,offer){
           if(req.body.type == "cancel") {
            offers.deleteOne({_id:req.body.offer_id},function(err) {
                offers.count({item_id:req.body.item_id},function(err,OfferItemCount){
                    if(OfferItemCount>0) {
                        res.json({
                            status: true,
                            message: "Offer cancelled successfully"
                        }); 
                    } else {
                        item.has_offer = false
                        item.save(function(err,result){
                            res.json({
                                status: true,
                                message: "Offer cancelled successfully"
                            }); 
                        })
                    }
    
                })
            })
           } else {
            collections.findOne({_id:item.collection_id._id},function(err, collection){
                collection.volume_traded = collection.volume_traded + offer.price;
                collection.save(function (err ,collectionsaveObj) {
            item.price = offer.price;
            item.has_offer = false;
            userController.getUserInfoByID(item.current_owner,function(err,receiver){
                userController.getUserInfoByID(offer.sender,function(err,sender){
                    this.checkbalance(sender.public_key,item,function(has_balance) {
                        if(!has_balance) {
                            res.json({
                                status: false,
                                message: "Not enough balance to proceed purchase",
                                errors:err
                            });
                            return;
                        }
                        this.transferAdminComission(item, function(error, comission){
                            var comission = 0;
                            if(error == null) {
                               comission = comission
                            } 
                            this.transferBalance(sender,receiver, item, comission, function(is_transferred){
                                if(!has_balance) {
                                    res.json({
                                        status: false,
                                        message: "Unable to transfer ETH",
                                        errors:err
                                    });
                                    return;
                                }
                                var symbolabi = item.collection_id.contract_symbol+'.abi';
                                var command = 'sh transaction.sh '+receiver.public_key +' '+sender.public_key +' '+item.token_id + ' ' + item.collection_id.contract_address + ' ' +  symbolabi+' ' +  receiver.private_key
                                cp.exec(command, function(err, stdout, stderr) {
                                    console.log('stderr ',stderr)
                                    console.log('stdout ',stdout)
                                    // handle err, stdout, stderr
                                    if(err) {
                                        console.log("error is ",err)
                                        res.json({
                                            status: false,
                                            message: err.toString().split('ERROR: ').pop().replace(/\n|\r/g, "")
                                        });
                                        return
                                    }
                        
                                    var t_array = stdout.toString().split('Transaction hash: ').pop().replace(/\n|\r/g, "").split(' ')
                                    var transaction_hash = t_array[0].replace('Waiting','')
                        
                                    var status_array = stdout.toString().split('Status: ').pop().replace(/\n|\r/g, " ").split(' ')
                                    var status_block = status_array[0]
                                    if(status_block == "Failed") {
                                        res.json({
                                            status:false,
                                            message:"NFT item transferred failed in network",
                                            data: {
                                                transaction_hash:transaction_hash,
                                            }
                                        })
                                    } else {
                                        item.current_owner = offer.sender;
                                        item.save(function (err ,itemObj) {
                                            var history = new histories();
                                            history.item_id = item._id;
                                            history.collection_id = item.collection_id._id
                                            history.from_id = receiver._id;
                                            history.to_id = sender._id
                                            history.transaction_hash = transaction_hash
                                            history.price = item.price
                                            history.history_type = "transfer";
                                            history.save(function (err ,historyObj) {
                                                var price = new prices();
                                                price.item_id = item._id;
                                                price.price = item.price;
                                                price.user_id = sender._id
                                                price.save(function (err ,priceObj) {
                                                    offers.deleteMany({item_id:req.body.item_id},function(err,deleteResult){
                                                        res.json({
                                                            status: true,
                                                            message: "Item Transfer successfully",
                                                            result: itemObj
                                                        });
                                                    })
                                                })
    
                                            });
                                        })
                                    }
                                });
        
                            });
                        });

                    })
                })
            });
        });
    });
           }
        })
    });
}

/*
* This is the function which used to remove offer
*/
exports.removeOffers = function(req,res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.json({
            status: false,
            message: "Request failed",
            errors:errors.array()
        });
        return;
    } 
    offers.findOne({sender:req.decoded.user_id, _id:req.body.offer_id, }).exec(function (err, offerObj) {
        if (err || !offerObj) {
            res.json({
                status: false,
                message: "Offer not found",
                errors:err
            });
            return;
        }
        offers.deleteOne({_id:req.body.offer_id},function(err) {
            offers.count({item_id:req.body.item_id},function(err,OfferItemCount){
                if(OfferItemCount>0) {
                    res.json({
                        status: true,
                        message: "Item deleted successfully"
                    }); 
                } else {
                    items.findOne({_id:req.body.item_id, status:"active"}).exec(function (err, item) {
                        item.has_offer = false
                        item.save(function(err,result){
                            res.json({
                                status: true,
                                message: "Item deleted successfully"
                            }); 
                        })
                    });
                }

            })

        })
    })
}


/*
* This is the function which used to list item offer and profile offer
*/
exports.listOffers = function(req,res) {
    var page = req.query.page ? req.query.page : '1';  
    var query;
    var is_admin = false;
    if(req.decoded.user_id != null && req.query.user) {
        if(req.decoded.role == 1 && req.query.user == "admin") {
            is_admin = true;
        }
    }
    if(is_admin) {
        query = offers.find();
    } else {
        if(req.query.type == "item") {
            query = offers.find({'item_id':req.query.item_id});
         } else {
             query = offers.find({'receiver':req.query.user_id});
         }
    }

    
    var offset = ( page == '1' ) ? 0 : ((parseInt(page-1))*10);
    query = query.populate({path: 'sender', model: users, select:'_id username first_name last_name profile_image' })
    query = query.populate({path: 'receiver', model: users, select:'_id username first_name last_name profile_image' })
    query = query.populate({path: 'item_id', model: items, select:'_id name thumb price' })
    query = query.sort('-created_date')
    var options = {
        page:page,
        offset:offset,
        limit:10,    
    };  
    offers.paginate(query, options).then(function (result) {
        res.json({
            status: true,
            message: "offers retrieved successfully",
            data: result
        });
    }); 
}

/*
* This is the function which used to check balance of the user
*/
exports.checkUserBalance = function(req,res) {
    userController.getUserInfoByID(req.decoded.user_id,function(err,user){
        web3.eth.getBalance(user.public_key).then(balance=>{
            res.json({
                status: true,
                message: "balance details successfull",
                return_id: balance / 1000000000000000000
            });
        });
    })
}

/*
* This is the function which used to check balance of the user
*/
exports.sendETH = function(req,res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.json({
            status: false,
            message: "Request failed",
            errors:errors.array()
        });
        return;
    } 
    userController.getUserInfoByID(req.decoded.user_id,function(err,user){
        web3.eth.getBalance(user.public_key).then(balance=>{
            var eth = balance / 1000000000000000000;
            console.log(eth)
            console.log(req.body.amount)
            if(eth>req.body.amount) {
                var command = 'sh send.sh '+user.private_key+ ' ' + req.body.eth_address + ' '+ req.body.amount;
                cp.exec(command, function(err, stdout, stderr) {
                    if(err) {
                        res.json({
                            status: false,
                            message: "Trasnfer Error",
                            errors:err
                        });
                    } else {
                        res.json({
                            status: true,
                            message: "Ethereum transferred successfully",
                        });
                    }
                })
            } else {
                res.json({
                    status: false,
                    message: "Not enough balance in your ethereum address",
                    return_id: balance
                });
            }
        });
    })
}


/**
 *  This is the function which used to report item
 */
 exports.report = function(req,res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.json({
            status: false,
            message: "Request failed",
            errors:errors.array()
        });
        return;
    } 
    var query =  items.findOne({_id:req.body.item_id})
    query.exec(function (err, item) {
        if (err || !item) {
            res.json({
                status: false,
                message: "item not found",
                errors:err
            });
            return;
        } 
        userController.getUserInfoByID(req.decoded.user_id,function(err,receiver){
            var mailUser = receiver.first_name + ' ' + receiver.last_name;
            var mailTitle = "Report Notification";
            var mailContent = mailUser + ' reported Item. Item ID : ' + item._id + '\n\n' + req.body.message;
            mailer.mail({
                username : mailUser,
                content: mailContent
            },config.site_email,mailTitle,receiver.mail,function(error,result) {
                if(error) {
                }
                res.json({
                    status: false,
                    message: "Report sent successfully",
                    errors:err
                });
            })
        });
    });
}

/**
 * This is the function which used to get balance for ethereum address
 */
checkbalance = function(eth_address, item, callback) {
    web3.eth.getBalance(eth_address).then(balance=>{
        var eth = balance / 1000000000000000000;
        if(eth<(item.price+0.2)) {
            callback(false);
        } else {
            callback(true)
        }
    }); 
}

/**
 * This is the function which used to get admin comission before transaction
 */

transferAdminComission = function(item, callback) {
    options.findOne({name:"admin_commission"}, function (err, option) {
        if (err || !option) {
            callback("error",0)
            return;
        }
        var commission = item.price * (option.value/100);
        userController.getUserInfoByID(item.current_owner,function(err,sender){
            users.findOne({role:1}).exec(function(err,receiver){
                if(sender._id == receiver._id) {
                    callback("error",0)
                    return;
                }
                var command = 'sh send.sh '+sender.private_key+ ' ' + receiver.public_key + ' '+ commission;
                cp.exec(command, function(err, stdout, stderr) {
                    console.log('stderr ',stderr)
                    console.log('stdout ',stdout)
                    // handle err, stdout, stderr
                    if(err) {
                        callback("error",0)
                    } else {
                        var history = new histories();
                        history.item_id = item._id;
                        history.collection_id = item.collection_id._id;
                        history.from_id = item.current_owner;
                        history.to_id = receiver._id
                        history.transaction_hash = ""
                        history.history_type = "admin_comission";
                        history.price = commission;
                        history.save(function (err ,historyObj) {
                            callback(null,commission)
                        })
                    }
                })

            })
        })
        
    })
}


/**
 * This is the function which used to transfer erc721 token
 */
transferBalance = function(sender, receiver, item, commission, callback) {
    var sender_id = sender._id.toString();
    var receiver_id = receiver._id.toString();
    var author_id = item.author_id.toString();
    console.log("--------------")
    console.log("TRANSFER")
    console.log("--------------")
    console.log("sender ",sender_id)
    console.log("receiver ",receiver_id)
    console.log("item ",author_id)
    console.log("commission ",commission)
    if(author_id == receiver_id) {
        var price = item.price - commission;
        console.log("price going to send ",price);
        var command = 'sh send.sh '+sender.private_key+ ' ' + receiver.public_key + ' '+ price;
        cp.exec(command, function(err, stdout, stderr) {
            console.log('stderr ',stderr)
            console.log('stdout ',stdout)
            // handle err, stdout, stderr
            if(err) {
                callback(false)
            } else {
                callback(true)
            }
        })
    } else if(author_id == sender_id) {
        var price = item.price - commission;
        console.log("price going to send ",price);
        var command = 'sh send.sh '+sender.private_key+ ' ' + receiver.public_key + ' '+ price;
        cp.exec(command, function(err, stdout, stderr) {
            console.log('stderr ',stderr)
            console.log('stdout ',stdout)
            if(err) {
                callback(false)
            } else {
                callback(true)
            }
        })
    } else {
      var priceWithoutComission = item.price - commission;
       var royalty = item.price * (item.collection_id.royalties/100);
       var price = priceWithoutComission - royalty;
       userController.getUserInfoByID(item.author_id,function(err,author){
        console.log("royalties going to send ",royalty);
        var command = 'sh send.sh '+sender.private_key+ ' ' + author.public_key + ' '+ royalty;
        cp.exec(command, function(err, stdout, stderr) {
            console.log('stderr ',stderr)
            console.log('stdout ',stdout)
            if(err) {
                callback(false)
            } else {
                console.log("item price is ",price);
                var command = 'sh send.sh '+sender.private_key+ ' ' + receiver.public_key + ' '+ price;
                cp.exec(command, function(err, stdout, stderr) {
                    console.log('stderr ',stderr)
                    console.log('stdout ',stdout)
                    if(err) {
                        callback(false)
                    } else {
                        var history = new histories();
                        history.item_id = item._id;
                        history.collection_id = item.collection_id._id;
                        history.from_id = sender._id;
                        history.to_id = item.author_id
                        history.transaction_hash = ""
                        history.history_type = "comission";
                        history.price = royalty;
                        history.save(function (err ,historyObj) {
                            callback(true)
                        })
                        
                    }
                })
            }
        })
       })
    }

}

exports.generateHash = function(req,res) {
    var symbol = req.body.name.replace(" ", "_")
    var symbolsol = symbol+'.sol';
    var command = 'sh generate.sh '+symbol + ' "' + req.body.name + '" ' +  symbolsol;
    cp.exec(command, function(err, stdout, stderr) {
        console.log('stderr ',stderr)
        console.log('stdout ',stdout)
        if(err) {
            res.json({
                status: false,
                message: err.toString().split('ERROR: ').pop().replace(/\n|\r/g, "")
            });
            return
        }
        fs.readFile('/var/www/html/nftmarketplace/backend/'+symbol+'.bin', 'utf8' , (err, data) => {
            if (err) {
              res.json({
                  status: false,
                  message: err.toString().split('ERROR: ').pop().replace(/\n|\r/g, "")
              });
              console.error(err)
              return
            }
            res.json({
                status: true,
                message: 'generate abi successful',
                result:data
            });
        })
    });
}

exports.getABI = function(req,res) {
    var symbol = req.query.name.replace(" ", "_");
    fs.readFile('/var/www/html/nftmarketplace/backend/'+symbol+'.bin', 'utf8' , (err, data) => {
        if (err) {
          res.json({
              status: false,
              message: err.toString().split('ERROR: ').pop().replace(/\n|\r/g, "")
          });
          console.error(err)
          return
        }
        res.json({
            status: true,
            message: 'abi information successful',
            result:data
        });
    })
}

exports.view = function(req,res) {
    res.json({
        "description": "Friendly OpenSea Creature that enjoys long swims in the ocean.", 
        "external_url": "https://openseacreatures.io/3", 
        "image": "https://storage.googleapis.com/opensea-prod.appspot.com/puffs/3.png", 
        "name": "Dave Starbelly",
    });
    return;
}

