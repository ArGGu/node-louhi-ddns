var louhi = require('node-louhi-ddns');

var username = "username";
var password = "password";
var domain = "example.com";
var records = [ '@', 'www' ];

louhi.DDNS(username, password, domain, records);
