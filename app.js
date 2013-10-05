var louhi = require('./louhi.js');

var username = "username";
var password = "password";
var domain = "example.com";
var records = [ '@', 'www' ];

louhi.DDNS(username, password, domain, records);
