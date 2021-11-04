/*
Project : Cryptotrades
FileName : userController.js
Author : LinkWell
File Created : 21/07/2021
CopyRights : LinkWell
Purpose : This is the file which used to define all user related api function.
*/

var users = require('./../model/userModel')
var jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
var randomstring = require("randomstring");
var bcrypt = require('bcrypt');
var validator = require('validator');
var config = require('./../../../helper/config')
var moment = require('moment');
var mailer = require('./../../common/controller/mailController'); 
var media = require('./../../media/controller/mediaController'); 
var cp = require('child_process');
/*
*  This is the function which used to retreive user list
*/
exports.getList = async function(req,res) {
    var logged_id = '';
    if(req.query.user_id) {
        logged_id = req.query.user_id
    }
    var keyword = req.query.keyword ? req.query.keyword : ''; 
    keyword = keyword.replace("+"," ");     
    var page = req.query.page ? req.query.page : '1';  
    var query;  
    if(logged_id) {
       var blockerIDS = [];
       blockerIDS.push(logged_id)
       query = users.find({ '_id' : { $nin : blockerIDS }});
    } else {
       query = users.find();
    }
    var offset = ( page == '1' ) ? 0 : ((parseInt(page-1))*15);
    if ( keyword != '' ) {
        search = { $or: [ { 
            first_name :   {
                $regex: new RegExp(keyword, "ig")
        }  } , {
            last_name : {
                $regex : new RegExp ( keyword , "ig")
            }
        } , {
            email : {
                $regex : new RegExp ( keyword , "ig")
            }
        } ] }
       query = query.or(search)
    }    
    query = query.where('status' , 'active').sort('-create_date')
    var options = {
    select:   'username email profile_image first_name last_name',
    page:page,
    offset:offset,
    limit:15,    
    };  
    users.paginate(query, options).then(function (result) {
        res.json({
            status: true,
            message: "Users retrieved successfully",
            data: result
        });
    }); 
}

/*
*   This is the function which used to retreive user list for admin
*/
exports.getAdminList = async function(req,res) {
    var logged_id = '';
    if(req.query.user_id) {
        logged_id = req.query.user_id
    }
    var keyword = req.query.keyword ? req.query.keyword : ''; 
    keyword = keyword.replace("+"," ");     
    var page = req.query.page ? req.query.page : '1';  
    var query;  
    if(logged_id) {
       var blockerIDS = [];
       blockerIDS.push(logged_id)
       query = users.find({ '_id' : { $nin : blockerIDS }});
    } else {
       query = users.find();
    }
    var offset = ( page == '1' ) ? 0 : ((parseInt(page-1))*15);
    if ( keyword != '' ) {
        search = { $or: [ { 
            first_name :   {
                $regex: new RegExp(keyword, "ig")
        }  } , {
            last_name : {
                $regex : new RegExp ( keyword , "ig")
            }
        } , {
            email : {
                $regex : new RegExp ( keyword , "ig")
            }
        } ] }
       query = query.or(search)
    }    
    query = query.sort('-create_date')
    var options = {
    select:   'username email profile_image first_name last_name status',
    page:page,
    offset:offset,
    limit:15,    
    };  
    users.paginate(query, options).then(function (result) {
        res.json({
            status: true,
            message: "Users retrieved successfully",
            data: result
        });
    }); 
}

/*
*  This is the function which used to retreive user list
*/
exports.getListByIds = async function(req,res) {
    var query = users.find({ '_id' : { $in : req.body.users }});
    query.select('_id first_name last_name profile_image');
    query.exec( function (err, data) { 
        res.json({
            status: true,
            message: "Users retrieved successfully",
            data: data
        });
    });    
}

/*
*  This is the function which used to retreive user detail by user id
*/
exports.details = function(req,res) {
    console.log("received params are ", req.params)
    users.findOne({_id:req.params.userId}).select('username email first_name last_name profile_image profile_cover public_key password status create_date').exec( function (err, user) {
        if (err) {
            res.json({
                status: false,
                message: "Request failed",
                errors:"User not found"
            });
            return;
        }
        if(this.isEmptyObject(user)) {
            res.json({
                status: false,
                message: "Request failed",
                errors:"User not found"
            });
            return;
        } 
        res.json({
            status: true,
            message: "Profile info retrieved successfully",
            result: user
        });
    })
}

/*
*  This is the function which used to create new user in Cryptotrades
*/
exports.register = function(req,res) {
    if(req.body.social_info) {
        this.checkSocialUserExist(req,res,function(result) {
            if(result) {
                var social_info = JSON.parse(req.body.social_info)
                var params;
                if(social_info.type == "facebook") {
                   params = {'facebook_info.id':social_info.id}
                } else if (social_info.type == "twitter") {
                   params = {'twiiter_info.id':social_info.id}
                } else if (social_info.type == "google") {
                    params = {'google_info.id':social_info.id}
                }
                this.loginUserWithSocial(params,req,res);
            } else {
                var social_info = JSON.parse(req.body.social_info)
                if(social_info.type == "facebook") {
                    media.saveFacebookImageUrl("https://graph.facebook.com/"+social_info.id+"/picture?redirect=false&width=200&height=200",social_info.id,function(result){
                        this.registerUser(req,res);
                    })
                } else if(social_info.type == "google") {
                    media.saveImageUrl(req.body.photo,social_info.id,function(result){
                        this.registerUser(req,res);
                     })
                } else {
                    this.registerUser(req,res);
                }
                
            }
        });
    } else {
        this.checkUserNameExist(req,res,function(result) {
            if(result) {
               this.checkEmailExist(req,res,function(result){
                  this.registerUser(req,res);
               });
            }
        })
    } 
}

/**
 *   This is the function handle user registration
 */
registerUser = function (req,res) { 
    
    var user = new users();
    user.username = req.body.username ? req.body.username : "";
    user.email = req.body.email ? req.body.email : "";
    user.password = req.body.password ? req.body.password : "";
    user.first_name = req.body.first_name ? req.body.first_name : "";
    user.last_name = req.body.last_name ? req.body.last_name : "";
    user.phone = req.body.phone ? req.body.phone : "";
    user.profile_image = req.body.profile_image ? req.body.profile_image : "";
    user.dob = req.body.dob ? req.body.dob : "";
    if(req.body.social_info) {
        var social_info = JSON.parse(req.body.social_info);
        social_info = {
            id : social_info.id ? social_info.id : '',
            type : social_info.type ? social_info.type : '',
        }      
        if(social_info.type == "facebook") {
            let username = randomstring.generate({
                length: 10,
                charset: 'alphabetic'
              });  
            user.username = username
            user.facebook_info = social_info;
            user.profile_image = social_info.id + '.jpg'
        } else if (social_info.type == "google") {
            let username = randomstring.generate({
                length: 10,
                charset: 'alphabetic'
              });  
            user.username = username
            user.profile_image = social_info.id + '.jpg'
            user.google_info = social_info;
        } else {
            user.twitter_info = social_info;
        }
    }

    if(req.body.device_info) {
        var device_info = JSON.parse(req.body.device_info);
        user.device_info = device_info;
    }

    user.status = 'active';
    var command = 'sh address.sh';
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
        var private_key = stdout.toString().split('Private key: ').pop().replace(/\n|\r/g, " ").split(' ')
        var public_key = stdout.toString().split('Public address: ').pop().replace(/\n|\r/g, " ").split(' ')
        console.log('private key',private_key)
        console.log('public key',public_key)
        user.private_key = private_key[0];
        user.public_key = public_key[0];
        user.save(function (err , user) {
            if (err) {
                res.json({
                    status: false,
                    message: "Request failed",
                    errors:err
                });
                return;
            } 
                let token = jwt.sign({user_id:user._id,username: user.username,email: user.email,first_name:user.first_name,last_name:user.last_name,profile_image:user.profile_image ? user.profile_image : '',status:user.status,dob:user.dob,phone:user.phone, role: user.role},
                config.secret_key,
                { expiresIn: '24h' // expires in 24 hours
                }
                );
                if(user.email) {
                mailer.mail({
                    username : user.first_name + ' ' + user.last_name,
                    content:"Congratulation, you have created new account in "+config.site_name
                },user.email,'Registration Confirmation',config.site_email,function(error,result) {
                    if(error) {
                        console.log("email not working");
                    }
                    res.json({
                        status: true,
                        token:token,
                        message:"Registration successful",
                    });
                })
                } else {
                    res.json({
                        status: true,
                        token:token,
                        message:"Registration successful",
                    });
                }  
        });
    });

}

/*
*  This function used to find whether user name exist or not
*/
checkUserNameExist = function (req,res,callback) {
    if(req.body.username) {
        users.find({'username':req.body.username},function(err,data) {
            if(err) {
                res.json({
                    status: false,
                    message: "Request failed",
                    errors:err
                });
                return;
            }
            if(data.length>0) {
                res.json({
                    status: false,
                    message: "User Name already Exist",
                    errors:"User Name already Exist"
                });
                return;
            }
            callback(true)
        })
    } else {
        res.json({
            status: false,
            message: "User Name is required",
            errors:"User Name is required"
        });
        return;
    }
}

/*
*  This function used to find whether email exist or not
*/
checkEmailExist = function (req,res,callback) {
    if(req.body.email) {
        users.find({'email':req.body.email},function(err,data) {
            if(err) {
                res.json({
                    status: false,
                    message: "Request failed",
                    errors:err
                });
                return;
            }
            if(data.length>0) {
                res.json({
                    status: false,
                    message: "Email already Exist",
                    errors:"Email already Exist"
                });
                return;
            }
            callback(true)
        })
    } else {
        res.json({
            status: false,
            message: "Email is required",
            errors:"Email is required"
        });
        return;
    }
}

/**
 * This is the function which used to check if user social account have or not
 */
checkSocialUserExist = function (req,res,callback) {
    var social_info = JSON.parse(req.body.social_info)
    var params;
    if(social_info.type == "facebook") {
       params = {'facebook_info.id':social_info.id}
    } else if (social_info.type == "twitter") {
       params = {'twiiter_info.id':social_info.id}
    } else if (social_info.type == "google") {
        params = {'google_info.id':social_info.id}
    }
    users.find(params,function(err,data) {
        if(err) {
            res.json({
                status: false,
                message: "Request failed",
                errors:err
            });
            return;
        }
        if(data.length>0) {
            callback(true)
        } else {
            if(req.body.email) {
               users.findOne({'email':req.body.email},function(err,user){
                   if(!user) {
                    callback(false);
                   } else {
                    var social_info = JSON.parse(req.body.social_info)
                    var social_info = {
                        id : social_info.id ? social_info.id : '',
                        type : social_info.type ? social_info.type : '',
                       } 
                       if(social_info.type == "facebook") {
                           user.facebook_info = social_info
                       } else if (social_info.type == "google") {
                           user.google_info = social_info
                       } else if (social_info.type == "twiiter") {
                           user.twitter_info = social_info
                       }
    
                       user.save(function(err) {
                           callback(true)
                       })
                   }
               }) 
            } else {
                callback(false);
            }
        }
        
    })
    
}

/**
 * This is the function which used to login user
 */
exports.login = function(req,res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.json({
            status: false,
            message: "Request failed",
            errors:errors.array()
        });
        return;
    }  

    if(validator.isEmail(req.body.username)) {
        params = {email:req.body.username};
    } else {
        params = {username:req.body.username};
    } 
    this.loginUser(params,req,res);
}

/**
 * This is the function which used to process login user
 */
loginUser = function(params,req,res) {
    console.log("LoginUser === ",req.body);
    users.findOne(params, function (err, user) {
        if (err) {
            res.json({
                status: false,
                message: "Request failed",
                errors:err
            });
            return;
        }
        if(this.isEmptyObject(user)) {
            res.json({
                status: false,
                message: "User not found",
            });
            return;
        }  
        user.comparePassword(req.body.password, (error, match) => {
            if(!match) {
                res.json({
                    status: false,
                    message: "Password is mismatch"
                });
                return;
            }
            if( user.status == 'inactive') {
                res.json({
                    status: false,
                    message: "Your account has been inactive. contact admin to activate your account",
                });
                return;
            }
            if(user.status == 'blocked') {
                res.json({
                    status: false,
                    message: "Your account has been blocked. contact admin to activate your account",
                });
                return;
            }        
            console.log(req.body.device_info)
            if(req.body.device_info) {
                var device_info = JSON.parse(req.body.device_info);
                user.device_info = device_info;
                user.save(function(err){
                    let token = jwt.sign({user_id:user._id,username: user.username,email: user.email,first_name:user.first_name,last_name:user.last_name,profile_image:user.profile_image ? user.profile_image : '',status:user.status,dob:user.dob,phone:user.phone, role:user.role},
                    config.secret_key,
                    { expiresIn: '24h' // expires in 24 hours
                    }
                    );
                    res.json({
                        status: true,
                        token:token,
                        message:"Login successful",
                    }); 
                })
            } else {
                let token = jwt.sign({user_id:user._id,username: user.username,email: user.email,first_name:user.first_name,last_name:user.last_name,profile_image:user.profile_image ? user.profile_image : '',status:user.status,dob:user.dob,phone:user.phone, role:user.role},
                config.secret_key,
                { expiresIn: '24h' // expires in 24 hours
                }
                );
                res.json({
                    status: true,
                    token:token,
                    message:"Login successful",
                }); 
            }
            
      
        });
    });
}

/**
 * This is the function which used to process login user with social login
 */
loginUserWithSocial = function(params,req,res) {
    users.findOne(params, function (err, user) {
        if (err) {
            res.json({
                status: false,
                message: "Request failed",
                errors:err
            });
            return;
        }
        if(this.isEmptyObject(user)) {
            res.json({
                status: false,
                message: "User not found",
            });
            return;
        }  
        if( user.status == 'inactive') {
            res.json({
                status: false,
                message: "Your account has been inactive. contact admin to activate your account",
            });
            return;
        }
        if(user.status == 'blocked') {
            res.json({
                status: false,
                message: "Your account has been blocked. contact admin to activate your account",
            });
            return;
        }          

        if(req.body.device_info) {
            var device_info = JSON.parse(req.body.device_info);
            user.device_info = device_info;
            user.save(function(err){
                let token = jwt.sign({user_id:user._id,username: user.username,email: user.email,first_name:user.first_name,last_name:user.last_name,profile_image:user.profile_image ? user.profile_image : '',status:user.status,dob:user.dob,phone:user.phone, role:user.role},
                config.secret_key,
                { expiresIn: '24h' // expires in 24 hours
                }
                );
            res.json({
                status: true,
                token:token,
                message:"Login successful",
            });  
            });
        } else {
            let token = jwt.sign({user_id:user._id,username: user.username,email: user.email,first_name:user.first_name,last_name:user.last_name,profile_image:user.profile_image ? user.profile_image : '',status:user.status,dob:user.dob,phone:user.phone, role:user.role},
            config.secret_key,
            { expiresIn: '24h' // expires in 24 hours
            }
            );
            res.json({
                status: true,
                token:token,
                message:"Login successful",
            });  
        }   
    });
}

/*
*  This is the function which used to find user password if user forgot password
*/
exports.forgot = function(req,res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.json({
            status: false,
            message: "Request failed",
            errors:errors.array()
        });
        return;
    }
    let params =  {email:req.body.email}
    users.findOne(params, function (err, user) {
        if (err) {
            res.json({
                status: false,
                message: "Request failed",
                errors:err
            });
            return;
        }
        if(this.isEmptyObject(user)) {
            res.json({
                status: false,
                message:"User not found"
            });
            return;
        }  
        if(user.status == "inactive") {
            res.json({
                status: false,
                message:"Your account has been inactive. Contact admin to activate your account"
            });
            return;
        }
        if(user.status == "blocked") {
            res.json({
                status: false,
                message:"Your account has been blocked. Contact admin to unblock your account"
            });
            return;
        }

        let newpassword = randomstring.generate({
            length: 6,
            charset: 'alphabetic'
          });  
          
        user.password = newpassword
        user.status = "reset"
        user.save(function (err) {
            if (err) {
                res.json({
                    status: false,
                    message: "Request failed",
                    errors:err
                });
                return
            }
            mailer.mail({
                username : user.first_name + ' ' + user.last_name,
                content:"Your new password is "+ newpassword
            },user.email,'Password Reset',config.site_email,function(error,result) {
                if(error) {
                    console.log("email not working");
                }
                console.log("new password is ", newpassword)
             res.json({
                status: true,
                message: "Email sent. Please refer your email for new password"
              });
            return;
        });
        });
    })
}

/*
*  This is the function which used to change password
*/
exports.changepassword = function(req,res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.json({
            status: false,
            message: "Request failed",
            errors:errors.array()
        });
        return;
    }
    users.findOne({_id:req.decoded.user_id}, function (err, user) {
        if (err) {
            res.json({
                status: false,
                message: "Request failed",
                errors:err
            });
            return;
        }
        if(this.isEmptyObject(user)) {
            res.json({
                status: false,
                message: "Request failed",
                errors:"User not found"
            });
            return;
        } 
        
        user.comparePassword(req.body.oldpassword, (error, match) => {
            if(!match) {
                res.json({
                    status: false,
                    message: "Request failed",
                    errors:"The old password you have entered for this account is incorrect",
                });
                return;
            }

            if(user.status == 'inactive') {
                res.json({
                    status: false,
                    message: "Request failed",
                    errors:"Your account has been inactive. Contact admin to activate your account"
                });
                return;
            }

            if(user.status == 'blocked') {
                res.json({
                    status: false,
                    message: "Request failed",
                    errors:"Your Account has been blocked. Contact Admin to activate your account"
                });
                return;
            }

            // override the cleartext password with the hashed one
            user.password = req.body.newpassword;
            user.save(function (err,user) {
                if (err) {
                    res.json({
                        status: false,
                        message: "Request failed",
                        errors:err
                    });
                    return
                }               
                let token = jwt.sign({user_id:user._id,username: user.username,email: user.email,first_name:user.first_name,last_name:user.last_name,profile_image:user.profile_image ? user.profile_image : '',status:user.status,dob:user.dob,social_info:user.social_info,phone:user.phone, role:user.role},
                config.secret_key,
                { expiresIn: '24h' // expires in 24 hours
                }
                );
                res.json({
                    status: true,
                    token:token,
                    message:"password changed successfully",
                });     
                
            });

        });
    })
}  

/*
*  This is the function which used to change password
*/
exports.resetpassword = function(req,res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.json({
            status: false,
            message: "Request failed",
            errors:errors.array()
        });
        return;
    }
    users.findOne({_id:req.decoded.user_id}, function (err, user) {
        if (err) {
            res.json({
                status: false,
                message: "Request failed",
                errors:err
            });
            return;
        }
        if(this.isEmptyObject(user)) {
            res.json({
                status: false,
                message:"User not found"
            });
            return;
        } 
        // override the cleartext password with the hashed one
        user.password = req.body.newpassword;
        user.status = "active"
        user.save(function (err,user) {
            if (err) {
                res.json({
                    status: false,
                    message: "Request failed",
                    errors:err
                });
                return
            }               
            let token = jwt.sign({user_id:user._id,username: user.username,email: user.email,first_name:user.first_name,last_name:user.last_name,profile_image:user.profile_image ? user.profile_image : '',status:user.status,dob:user.dob,social_info:user.social_info,phone:user.phone, role:user.role},
            config.secret_key,
            { expiresIn: '24h' // expires in 24 hours
            }
            );
            res.json({
                status: true,
                token:token,
                message:"password reset successfully",
            });     
            
        });
    })
}



/*
*  This is the function which used to update user profile
*/
exports.update = function(req,res) {
    var user_id = req.decoded.user_id;  
    var params = {};
    params['_id'] = { $ne :  user_id };
    var query  = users.find();
    if (req.body.email) {
        params['email'] = req.body.email;        
    }  
    if (req.body.username) {
        params['username'] = req.body.username;        
    }  
    console.log("params are ", params);
    query = users.find(params); 
    query.exec( function (err, data) { 
        if(req.body.email || req.body.username) {
            if (err) {
                res.json({
                    status: false,
                    message: "Request failed",
                    errors:err
                });
                return;
            }
            console.log("user data are ", data);
            if(data.length>0) {
                res.json({
                    status: false,
                    message:"Email or Username already exist"
                });
                return;
            } 
        }

        users.findOne({_id:req.decoded.user_id}, function (err, user) {
                if (err) {
                    res.json({
                        status: false,
                        message: "Request failed",
                        errors:err
                    });
                    return;
                }
                if(this.isEmptyObject(user)) {
                    res.json({
                        status: false,
                        message:"User not found"
                    });
                    return;
                } 
                if(user.status == 'inactive') {
                    res.json({
                        status: false,
                        message:"Your account has been inactive. Contact admin to activate your account"
                    });
                    return;
                }
                if(user.status == 'blocked') {
                    res.json({
                        status: false,
                        message:"Your account has been blocked. Contact admin to activate your account"
                    });
                    return;
                }
                user.first_name = req.body.first_name ? req.body.first_name : user.first_name;
                user.last_name = req.body.last_name ? req.body.last_name : user.last_name;
                user.profile_image = req.body.profile_image ? req.body.profile_image : user.profile_image;                 
                user.profile_cover = req.body.profile_cover ? req.body.profile_cover : user.profile_cover;       
                user.email = req.body.email ? req.body.email : user.email;         
                user.username = req.body.username ? req.body.username : user.username;           
                user.dob = req.body.dob ? req.body.dob : user.dob;
                user.phone = req.body.phone ? req.body.phone : user.phone;
                if(req.body.password) {
                    user.password = req.body.password
                }
                if(req.body.social_info) {
                    var social_info = JSON.parse(req.body.social_info);
                    social_info = {
                        id : social_info.id ? social_info.id : '',
                        type : social_info.type ? social_info.type : '',
                    }      
                    if(social_info.type == "facebook") {
                        user.facebook_info = social_info;
                    } else if (social_info.type == "google") {
                        user.google_info = social_info;
                    } else {
                        user.twitter_info = social_info;
                    }
                }

                if(req.body.device_info) {
                    var device_info = JSON.parse(req.body.device_info);
                    user.device_info = device_info;
                }
                 
                user.modified_date = moment().format();
                // save the user and check for errors
                user.save(function (err , user ) {
                    if (err) {
                        res.json({
                            status: false,
                            message: "Request failed",
                            errors:err
                        });
                        return;
                    }

                        let token = jwt.sign({user_id:user._id,username: user.username,email: user.email,first_name:user.first_name,last_name:user.last_name,profile_image:user.profile_image ? user.profile_image : '',status:user.status,dob:user.dob,social_info:user.social_info,phone:user.phone, role: user.role},
                        config.secret_key,
                        { expiresIn: '24h' // expires in 24 hours
                        }
                        );
                        res.json({
                            status: true,
                            token:token,
                            message:"profile updated successfully",
                        }); 
                                            
                });
            });
        })
}

/*
*  This is the function which used to update user profile
*/
exports.updatesettings = function(req,res) {
    users.findOne({_id:req.decoded.user_id}, function (err, user) {
        if (err) {
            res.json({
                status: false,
                message: "Request failed",
                errors:err
            });
            return;
        }
        if(this.isEmptyObject(user)) {
            res.json({
                status: false,
                message:"User not found"
            });
            return;
        } 
        if(user.status == 'inactive') {
            res.json({
                status: false,
                message:"Your account has been inactive. Contact admin to activate your account"
            });
            return;
        }
        if(user.status == 'blocked') {
            res.json({
                status: false,
                message:"Your account has been blocked. Contact admin to activate your account"
            });
            return;
        }
        user.is_notification = req.body.is_notification;        
        user.modified_date = moment().format();
        user.save(function (err , user ) {
            if (err) {
                res.json({
                    status: false,
                    message: "Request failed",
                    errors:err
                });
                return;
            }
            res.json({
                status: true,
                message:"profile settings updated successfully",
            }); 
                    
        });
    });
}

/**
 *   This is the function check object is empty or not
 */
exports.getUserInfoByID = function (userId, callback) {
    users.findOne({_id:userId}).exec( function (err, user) {
        if (err) {
            callback(err,null)
            return;
        }
        if(this.isEmptyObject(user)) {
            callback({
                status: false,
                message: "Request failed",
                errors:"User not found"
            },null);
            return;
        } 
        user.profile_image = user.profile_image ? user.profile_image : '';       
        callback(null,user)
    })
}


/**
 *   This is the function check object is empty or not
 */
isEmptyObject = function (obj) {
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        return false;
      }
    }
    return true;
}

/*
*   This is the function which used to create new user from admin
*/
exports.createUser = function(req,res) {

    this.checkUserNameExist(req,res,function(result) {
        if(result) {
            this.checkEmailExist(req,res,function(result){
                this.createUser(req,res);
            });
        }
    })
    
}

/**
 *    This is the function handle user registration for admin
 */
 createUser = function (req,res) { 
    
    var user = new users();
    user.username = req.body.username ? req.body.username : "";
    user.email = req.body.email ? req.body.email : "";
    user.password = req.body.password ? req.body.password : "";
    user.first_name = req.body.first_name ? req.body.first_name : "";
    user.last_name = req.body.last_name ? req.body.last_name : "";
    user.phone = req.body.phone ? req.body.phone : "";
    user.profile_image = req.body.profile_image ? req.body.profile_image : "";
    user.dob = req.body.dob ? req.body.dob : "";
    user.status = req.body.status ? req.body.status : "active"
    user.save(function (err , user) {
        if (err) {
            res.json({
                status: false,
                message: "Request failed",
                errors:err
            });
            return;
        } 
        if(user.email) {
        mailer.mail({
            username : user.first_name + ' ' + user.last_name,
            content:"Congratulation, you account has been created in "+config.site_name
        },user.email,'Registration Confirmation',config.site_email,function(error,result) {
            if(error) {
            }
            res.json({
                status: true,
                message:"Registration successful",
            });
        })
        } else {
            res.json({
                status: true,
                message:"Registration successful",
            });
        }  
    });
}


/*
*   This is the function which used to update user profile from admin
*/
exports.updateUser = function(req,res) {
    var user_id = req.body.user_id;  
    var params = {};
    params['_id'] = { $ne :  user_id };
    var query  = users.find();
    if (req.body.email) {
        params['email'] = req.body.email;        
    }  
    if (req.body.username) {
        params['username'] = req.body.username;        
    }  
    query = users.find(params); 
    query.exec( function (err, data) { 
        if(req.body.email || req.body.username) {
            if (err) {
                res.json({
                    status: false,
                    message: "Request failed",
                    errors:err
                });
                return;
            }
            if(data.length>0) {
                res.json({
                    status: false,
                    message:"Email or Username already exist"
                });
                return;
            } 
        }

        users.findOne({_id:req.body.user_id}, function (err, user) {
                if (err) {
                    res.json({
                        status: false,
                        message: "Request failed",
                        errors:err
                    });
                    return;
                }
                if(this.isEmptyObject(user)) {
                    res.json({
                        status: false,
                        message:"User not found"
                    });
                    return;
                } 
                user.first_name = req.body.first_name ? req.body.first_name : user.first_name;
                user.last_name = req.body.last_name ? req.body.last_name : user.last_name;
                user.profile_image = req.body.profile_image ? req.body.profile_image : user.profile_image;                 
                user.profile_cover = req.body.profile_cover ? req.body.profile_cover : user.profile_cover;       
                user.email = req.body.email ? req.body.email : user.email;         
                user.username = req.body.username ? req.body.username : user.username;           
                user.dob = req.body.dob ? req.body.dob : user.dob;
                user.phone = req.body.phone ? req.body.phone : user.phone;
                if(req.body.password) {
                    user.password = req.body.password
                }
                user.status = req.body.status ? req.body.status : ''
                user.modified_date = moment().format();
                user.save(function (err , user ) {
                    if (err) {
                        res.json({
                            status: false,
                            message: "Request failed",
                            errors:err
                        });
                        return;
                    }
                    res.json({
                        status: true,
                        message:"profile updated successfully",
                    });                         
                });
            });
        })
}



