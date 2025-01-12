import * as robotsParser from 'robots-parser';

var robots = robotsParser.default('http://www.example.com/robots.txt', [
	'User-agent: *',
	'Disallow: /dir/',
	'Disallow: /test.html',
	'Allow: /dir/test.html',
	'Allow: /test.html',
].join('\n'));

console.log(robots.isAllowed('http://www.example.com/test.html')); // true
console.log(robots.isAllowed('http://www.example.com/dirs')); // true
console.log(robots.isAllowed('http://www.example.com/dir/test2.html')); // true
console.log(robots.isAllowed('http://mail.example.com')); // tru