/*
Project : Cryptotrades
FileName : itemModel.js
Author : LinkWell
File Created : 21/07/2021
CopyRights : LinkWell
Purpose : This is the file which used to define collection schema that will communicate and process collection information with mongodb through mongoose ODM.
*/

var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate-v2');
var uniqueValidator = require('mongoose-unique-validator');
var config = require('./../../../helper/config')
const Schema = mongoose.Schema;
// Setup schema

const attributeSchema = new Schema({ name: String, type:String });
const rangeSchema = new Schema({ name: String, value:Number, valueof: Number });

var itemSchema = mongoose.Schema({
    name: {
        type: String,
        minlength: [3, 'Name must be 3 characters or more'],
        maxlength: [255, "Name can't exceed 255 characters"],
        unique: [ true , 'Name already exists. Please try a different name'],
        required: [ true , 'Name is required'], 
    },   
    description: {
        type: String,
        maxlength: [1000, "Description can't exceed 1000 characters"]
    },   
    external_link: {
        type: String,
    }, 
    media: {
        type: String,
    },
    thumb: {
        type: String,
    },
    has_offer: {
        type: Boolean,
        default: false
    },
    attributes: {
        type: [attributeSchema],
    },
    levels: {
        type: [rangeSchema],
    },
    stats: {
        type: [rangeSchema],
    },
    unlock_content_url: {
        type: String,
        default:""
    },
    view_count: {
        type: Number,
        default:0
    },
    like_count: {
        type: Number,
        default:0
    },
    price: {
        type: Number,
        default:0
    },
    token_id:{
        type: String,
        default:""
    },
    category_id: { type: Schema.Types.ObjectId, ref: 'category' },
    collection_id: { type: Schema.Types.ObjectId, ref: 'collection' },
    current_owner: { type: Schema.Types.ObjectId, ref: 'users' },
    author_id: { type: Schema.Types.ObjectId, ref: 'users' },
    status:{
        type: String,
        enum : ['active','inactive'],
        default: 'inactive'
    },
    minted_date: {
        type: Date,
    },
    create_date: {
        type: Date,
        default: Date.now
    },
});

itemSchema.plugin(uniqueValidator);
itemSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('item', itemSchema,config.db.prefix+'item');